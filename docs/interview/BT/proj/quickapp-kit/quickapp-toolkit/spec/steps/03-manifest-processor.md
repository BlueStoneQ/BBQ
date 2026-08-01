# Step 3：Manifest Processor

## 目录

- [目标](#目标)
- [Step 3.1：定义 Manifest 类型](#step-31定义-manifest-类型)
- [Step 3.2：实现字段校验](#step-32实现字段校验)
- [Step 3.3：实现 mode 注入](#step-33实现-mode-注入)
- [Step 3.4：接入 build 管线](#step-34接入-build-管线)
- [Step 3.5：单元测试](#step-35单元测试)
- [Step 3.6：逐层验证](#step-36逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**校验 manifest.json 并按构建模式注入 config 字段。**

| 阶段 | 职责 |
|---|---|
| 读取 | 读文件、JSON 解析 |
| 校验 | 必填字段、类型、路由自洽性、页面文件存在性 |
| 注入 | 按 mode 设置 `config.debug` 和 `config.logLevel` |

manifest 是 toolkit 与 Runtime 共享的唯一配置源。Runtime 侧的 `ManifestParser`（C++）假定字段合法就直接读取，不做容错。所以校验必须在编译期完成——这里漏掉的问题会在 Runtime 表现为空字符串或崩溃。

**验收标准：**
- 示例项目 manifest 通过校验，`config.debug` 按 mode 正确注入
- 缺失必填字段时，错误信息指出具体字段路径
- `router.entry` 不在 `router.pages` 中时报错
- 声明的页面文件不存在时一次性列出全部缺失项

**本步不包含：**
- `permissions` 语义校验（V1 只校验结构）
- `features` 与 Runtime 能力注册表的匹配（属于 Runtime 侧职责）
- `widgets` 卡片配置（V1 不支持）
- manifest 副本写入 app.js（Step 8）

---

## Step 3.1：定义 Manifest 类型

类型定义要与 Runtime 侧的 C++ `Manifest` 结构体对齐。C++ 侧的定义（来自 `manifest_parser.h`）：

```cpp
struct Manifest {
    std::string package;
    std::string name;
    std::string versionName;
    int versionCode = 0;
    std::string entry;                                    // router.entry
    std::unordered_map<std::string, std::string> pages;    // router.pages
    std::string titleBarBgColor;                           // display.*
    std::string titleBarTextColor;
    std::unordered_map<std::string, PageDisplay> pageDisplays;
    std::vector<std::string> features;
    bool debug = false;
    std::string logLevel;
};
```

TypeScript 侧保持 JSON 的原始嵌套结构（`router.entry` 而非扁平的 `entry`），因为 toolkit 要把 manifest 原样写入 RPK。扁平化是 Runtime 解析时的内部表示，不是产物格式。

```text
@add quickapp-toolkit/src/manifest/schema.ts（新建文件）
```

```typescript
/**
 * router.pages 中单个页面的配置。
 */
export interface PageConfig {
  /** 页面组件文件名（不含 .ux 扩展名），缺省为 "index" */
  component?: string;
  /** 页面级路由参数默认值，Runtime 透传给页面 */
  params?: Record<string, unknown>;
}

/**
 * display.pages 中单个页面的显示配置。
 */
export interface PageDisplayConfig {
  /** 标题栏文本；缺省时 Runtime 使用 manifest.name */
  titleBarText?: string;
  /** 是否显示标题栏，缺省 true */
  titleBar?: boolean;
  /** 是否全屏，缺省 false */
  fullScreen?: boolean;
}

/**
 * 声明一个系统能力。Runtime 据此决定预加载哪些 NativeModule。
 */
export interface FeatureConfig {
  /** 能力名，如 "system.router"、"system.prompt" */
  name: string;
}

/**
 * 权限声明。V1 只校验结构，不做语义检查。
 */
export interface PermissionConfig {
  /** 允许访问的来源，"*" 表示不限制 */
  origin: string;
}

/**
 * 路由配置。
 */
export interface RouterConfig {
  /** 入口页面路径，必须是 pages 的一个 key */
  entry: string;
  /** 页面路径 -> 页面配置 */
  pages: Record<string, PageConfig>;
}

/**
 * 显示配置，作用于所有页面的默认值 + 页面级覆盖。
 */
export interface DisplayConfig {
  titleBarBackgroundColor?: string;
  titleBarTextColor?: string;
  /** 页面路径 -> 页面级显示配置 */
  pages?: Record<string, PageDisplayConfig>;
}

/**
 * 运行时配置。这两个字段由 toolkit 按构建模式注入，
 * 源文件中的值会被覆盖 —— 避免开发者手动改错导致 release 包开着 debug 日志。
 */
export interface RuntimeConfig {
  /** true 时 Runtime 输出详细日志和 JS 异常堆栈 */
  debug: boolean;
  /** 日志级别："debug" | "info" | "warn" | "error" */
  logLevel: string;
}

/**
 * manifest.json 的完整结构。
 *
 * 这个类型同时是产物格式：processManifest 的返回值会被序列化后
 * 写入 RPK 根目录的 manifest.json，由 Runtime 侧 ManifestParser 消费。
 */
export interface Manifest {
  /** 包名，如 "com.example.case1"，同时决定 RPK 文件名 */
  package: string;
  /** 应用名，Runtime 在无页面级 titleBarText 时用作默认标题 */
  name: string;
  /** 版本名，如 "1.0.0"，同时决定 RPK 文件名 */
  versionName: string;
  /** 版本号，用于增量更新比较 */
  versionCode: number;
  /** 最低平台版本，Runtime 可据此拒绝加载 */
  minPlatformVersion?: number;
  /** 应用图标路径，相对 RPK 根目录 */
  icon?: string;
  router: RouterConfig;
  display?: DisplayConfig;
  features?: FeatureConfig[];
  permissions?: PermissionConfig[];
  config: RuntimeConfig;
}

/** 字段路径描述，用于错误信息定位，如 "router.pages" */
export type FieldPath = string;

/**
 * 单条必填字段规则。
 */
export interface RequiredFieldRule {
  /** 点分字段路径 */
  path: FieldPath;
  /** 期望的 JS 类型 */
  type: 'string' | 'number' | 'object';
  /** 字符串类型时是否允许空串 */
  allowEmpty?: boolean;
}

/**
 * 必填字段规则表。
 *
 * 用数据驱动而非一串 if：新增必填字段只需加一行，
 * 且错误信息格式自动统一。
 */
export const REQUIRED_FIELDS: readonly RequiredFieldRule[] = [
  { path: 'package', type: 'string' },
  { path: 'name', type: 'string' },
  { path: 'versionName', type: 'string' },
  { path: 'versionCode', type: 'number' },
  { path: 'router', type: 'object' },
  { path: 'router.entry', type: 'string' },
  { path: 'router.pages', type: 'object' },
] as const;
```

---

## Step 3.2：实现字段校验

```text
@add quickapp-toolkit/src/manifest/processor.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BuildMode } from '../types';
import { ManifestError } from '../diagnostics/errors';
import {
  type Manifest,
  type RequiredFieldRule,
  REQUIRED_FIELDS,
} from './schema';

/**
 * 按点分路径读取嵌套值。
 * @param obj  任意对象
 * @param path 点分路径，如 "router.entry"
 * @returns 目标值；路径中任一层不存在时返回 undefined
 */
function getByPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * 校验单条必填字段规则。
 * @param raw  已解析的 manifest 原始对象
 * @param rule 规则
 * @returns 错误描述；通过校验时返回 null
 */
function checkField(raw: unknown, rule: RequiredFieldRule): string | null {
  const value = getByPath(raw, rule.path);

  if (value === undefined || value === null) {
    return `缺少必填字段 "${rule.path}"`;
  }

  if (rule.type === 'object') {
    // 数组也是 object，但这里的 object 字段都期望是普通对象
    if (typeof value !== 'object' || Array.isArray(value)) {
      return `字段 "${rule.path}" 应为对象，实际为 ${describeType(value)}`;
    }
    return null;
  }

  if (typeof value !== rule.type) {
    return `字段 "${rule.path}" 应为 ${rule.type}，实际为 ${describeType(value)}`;
  }

  if (rule.type === 'string' && rule.allowEmpty !== true && value === '') {
    return `字段 "${rule.path}" 不能为空字符串`;
  }

  return null;
}

/**
 * 生成便于阅读的类型描述。
 * @param value 任意值
 * @returns 类型名，数组显示为 "array"，null 显示为 "null"
 */
function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * 校验 router 配置的自洽性。
 *
 * 除了字段类型，还要保证：
 * - entry 是 pages 的一个 key（否则 Runtime 启动时找不到入口页面）
 * - 每个 page 的 component 是非空字符串
 *
 * @param raw          manifest 原始对象
 * @param manifestPath 用于错误定位
 * @returns 错误描述数组；全部通过时为空数组
 */
function checkRouter(raw: unknown): string[] {
  const errors: string[] = [];
  const entry = getByPath(raw, 'router.entry') as string;
  const pages = getByPath(raw, 'router.pages') as Record<string, unknown>;

  const pageKeys = Object.keys(pages);
  if (pageKeys.length === 0) {
    errors.push('router.pages 不能为空，至少需要声明一个页面');
    return errors;
  }

  if (!pageKeys.includes(entry)) {
    errors.push(
      `router.entry "${entry}" 不在 router.pages 中。` +
        `已声明的页面：${pageKeys.map((k) => `"${k}"`).join('、')}`
    );
  }

  for (const [key, config] of Object.entries(pages)) {
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      errors.push(`router.pages["${key}"] 应为对象`);
      continue;
    }
    const component = (config as Record<string, unknown>).component;
    if (component !== undefined && (typeof component !== 'string' || component === '')) {
      errors.push(`router.pages["${key}"].component 应为非空字符串`);
    }
  }

  return errors;
}

/**
 * 校验 features 数组结构。
 * @param raw manifest 原始对象
 * @returns 错误描述数组
 */
function checkFeatures(raw: unknown): string[] {
  const features = getByPath(raw, 'features');
  if (features === undefined) return [];

  if (!Array.isArray(features)) {
    return [`字段 "features" 应为数组，实际为 ${describeType(features)}`];
  }

  const errors: string[] = [];
  features.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      errors.push(`features[${index}] 应为对象`);
      return;
    }
    const name = (item as Record<string, unknown>).name;
    if (typeof name !== 'string' || name === '') {
      errors.push(`features[${index}].name 应为非空字符串`);
    }
  });
  return errors;
}

/**
 * 校验声明的页面文件是否存在于源码目录。
 *
 * 这项校验与 Step 1 的 scanProject 有重叠，但职责不同：
 * scanProject 是为了知道"编译哪些文件"，遇到缺失就无法继续；
 * 这里是完整性校验的一部分，与其他字段错误一起汇总报告。
 *
 * @param pages  router.pages 配置
 * @param srcDir 源码目录绝对路径
 * @returns 缺失文件的相对路径数组
 */
function checkPageFiles(
  pages: Record<string, { component?: string }>,
  srcDir: string
): string[] {
  const missing: string[] = [];
  for (const [routePath, config] of Object.entries(pages)) {
    const component = config.component ?? 'index';
    const filePath = path.join(srcDir, routePath, `${component}.ux`);
    if (!fs.existsSync(filePath)) {
      missing.push(`${routePath}/${component}.ux`);
    }
  }
  return missing;
}
```

---

## Step 3.3：实现 mode 注入

```text
@add quickapp-toolkit/src/manifest/processor.ts — 在 checkPageFiles 之后插入
```

```typescript
/**
 * 按构建模式生成运行时配置。
 *
 * 无条件覆盖源文件中的 config 字段，不做合并。理由：
 * 如果开发者在 manifest.json 里写了 "debug": true 而用 --mode=release
 * 构建，产出的 release 包会开着详细日志。这类问题在灰度或线上才暴露，
 * 排查成本高。让 mode 成为唯一决定因素，消除这种不一致的可能。
 *
 * @param mode 构建模式
 * @returns 运行时配置
 */
function buildRuntimeConfig(mode: BuildMode): { debug: boolean; logLevel: string } {
  if (mode === 'debug') {
    return { debug: true, logLevel: 'debug' };
  }
  return { debug: false, logLevel: 'error' };
}

/**
 * 读取、校验并按 mode 处理 manifest.json。
 *
 * 所有校验错误一次性收集后统一抛出，开发者一次就能看到全部问题，
 * 不需要"修一个字段、重跑、再修一个"。
 *
 * @param srcDir 源码目录绝对路径，manifest.json 应位于此目录下
 * @param mode   构建模式，决定 config.debug 和 config.logLevel
 * @returns 处理后的 manifest 对象，可直接序列化写入 RPK
 * @throws ManifestError 文件缺失、JSON 非法、字段校验失败或页面文件不存在
 */
export function processManifest(srcDir: string, mode: BuildMode): Manifest {
  const manifestPath = path.join(srcDir, 'manifest.json');

  let rawText: string;
  try {
    rawText = fs.readFileSync(manifestPath, 'utf8');
  } catch (e) {
    throw new ManifestError(
      `无法读取 manifest.json：${(e as Error).message}`,
      manifestPath
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    throw new ManifestError(
      `manifest.json 不是合法 JSON：${(e as Error).message}`,
      manifestPath,
      locateJsonError(rawText, e as Error)
    );
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ManifestError('manifest.json 顶层应为对象', manifestPath, 1);
  }

  // ---- 阶段 1：必填字段与类型 ----
  const errors: string[] = [];
  for (const rule of REQUIRED_FIELDS) {
    const err = checkField(raw, rule);
    if (err !== null) errors.push(err);
  }

  // 必填字段缺失时后续校验没有意义，直接报告
  if (errors.length > 0) {
    throw new ManifestError(formatErrors(errors), manifestPath);
  }

  // ---- 阶段 2：结构自洽性 ----
  errors.push(...checkRouter(raw));
  errors.push(...checkFeatures(raw));

  if (errors.length > 0) {
    throw new ManifestError(formatErrors(errors), manifestPath);
  }

  // ---- 阶段 3：页面文件存在性 ----
  const pages = (raw as { router: { pages: Record<string, { component?: string }> } })
    .router.pages;
  const missing = checkPageFiles(pages, srcDir);
  if (missing.length > 0) {
    throw new ManifestError(
      `router.pages 声明的页面文件不存在：\n    ${missing.join('\n    ')}`,
      manifestPath
    );
  }

  // ---- 阶段 4：mode 注入 ----
  const manifest = raw as Manifest;
  manifest.config = buildRuntimeConfig(mode);

  return manifest;
}

/**
 * 把多条错误合并为一条可读消息。
 * @param errors 错误描述数组
 * @returns 单条错误时直接返回，多条时加编号列表
 */
function formatErrors(errors: string[]): string {
  if (errors.length === 1) return errors[0];
  return `manifest.json 校验失败（${errors.length} 项）：\n` +
    errors.map((e, i) => `    ${i + 1}. ${e}`).join('\n');
}

/**
 * 从 JSON.parse 的错误信息中提取行号。
 *
 * V8 的错误消息形如 "Unexpected token } in JSON at position 123"，
 * 需要把字符位置换算为行号。Node 20+ 的消息格式包含 "line X column Y"，
 * 两种格式都尝试解析。
 *
 * @param text JSON 原文
 * @param err  JSON.parse 抛出的错误
 * @returns 行号（1-based）；无法定位时返回 0
 */
function locateJsonError(text: string, err: Error): number {
  // Node 20+ 格式
  const lineMatch = /line (\d+)/.exec(err.message);
  if (lineMatch) return Number(lineMatch[1]);

  // 旧格式：从 position 换算
  const posMatch = /position (\d+)/.exec(err.message);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    let line = 1;
    for (let i = 0; i < pos && i < text.length; i++) {
      if (text[i] === '\n') line++;
    }
    return line;
  }

  return 0;
}
```

三个阶段的顺序不是随意的：

**阶段 1 失败就停。** 如果 `router` 字段本身缺失，`checkRouter` 里的 `getByPath(raw, 'router.pages')` 会得到 undefined，遍历时崩溃。必填字段是后续校验的前提。

**阶段 2 和 3 分开。** 结构错误（entry 不在 pages 里）是配置问题，页面文件缺失是文件系统问题。前者优先报告，因为如果 `router.pages` 的 key 写错了，「文件不存在」只是这个错误的次生表现——先修正 key，缺失问题可能自动消失。

---

## Step 3.4：接入 build 管线

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 import 段
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BuildContext, BuildMode, SFCDescriptor } from '../types';
import type { Manifest } from '../manifest/schema';
import { scanProject } from '../scanner/project-scanner';
import { processManifest } from '../manifest/processor';
import { parseSFC, validatePageSFC } from '../parser/sfc-parser';
import { CompileError } from '../diagnostics/errors';
import { fromError, reportDiagnostics } from '../diagnostics/diagnostic';
```

```text
@add quickapp-toolkit/src/cli/cmd-build.ts — 在 scanProject 的 try/catch 之后插入
```

```typescript
  // ---- Step 3：Manifest 处理 ----
  let manifest: Manifest;
  try {
    manifest = processManifest(ctx.srcDir, ctx.mode);
  } catch (e) {
    // manifest 错误是致命的：路由表不可用，无法确定编译目标
    if (e instanceof CompileError) {
      ctx.diagnostics.push(fromError(e));
      reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
      return 1;
    }
    throw e;
  }

  console.log(`应用：${manifest.name} (${manifest.package}) v${manifest.versionName}`);
  console.log(`入口：${manifest.router.entry}`);
  console.log(
    `配置：debug=${manifest.config.debug}, logLevel=${manifest.config.logLevel}`
  );
  const featureNames = (manifest.features ?? []).map((f) => f.name);
  console.log(`能力：${featureNames.length > 0 ? featureNames.join('、') : '（无）'}`);
  console.log('');
```

`scanProject` 和 `processManifest` 都读了 manifest.json，看起来重复。保留这个重复是有意的：

`scanProject` 需要 `router.pages` 才能知道扫描哪些文件，而它运行在 `processManifest` 之前——因为 `processManifest` 的页面存在性校验需要知道 `srcDir` 结构。两者有循环依赖的倾向。

解法是让 `scanProject` 只做最小解析（只取 `router.pages`，不校验其他字段），`processManifest` 做完整校验。两次 JSON.parse 的开销可以忽略（manifest 通常 1-2KB），换来的是职责清晰、无循环依赖。

---

## Step 3.5：单元测试

```text
@add quickapp-toolkit/test/unit/manifest-processor.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { processManifest } = require('../../dist/manifest/processor.js');
const { ManifestError } = require('../../dist/diagnostics/errors.js');

/**
 * 创建临时项目目录。
 * @param manifest manifest 对象或原始字符串
 * @param pages    要创建的页面文件相对路径数组，如 ['pages/Demo/index.ux']
 * @returns srcDir 绝对路径
 */
function makeProject(manifest, pages = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-manifest-'));
  const srcDir = path.join(root, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const text = typeof manifest === 'string' ? manifest : JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(srcDir, 'manifest.json'), text);

  for (const rel of pages) {
    const full = path.join(srcDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '<template><div></div></template>');
  }

  return srcDir;
}

/** 最小合法 manifest */
function validManifest() {
  return {
    package: 'com.test.app',
    name: 'test',
    versionName: '1.0.0',
    versionCode: 1,
    router: {
      entry: 'pages/Demo',
      pages: { 'pages/Demo': { component: 'index' } },
    },
  };
}

test('合法 manifest 通过校验', () => {
  const srcDir = makeProject(validManifest(), ['pages/Demo/index.ux']);
  const m = processManifest(srcDir, 'debug');
  assert.strictEqual(m.package, 'com.test.app');
  assert.strictEqual(m.router.entry, 'pages/Demo');
});

test('debug 模式注入 debug=true', () => {
  const srcDir = makeProject(validManifest(), ['pages/Demo/index.ux']);
  const m = processManifest(srcDir, 'debug');
  assert.strictEqual(m.config.debug, true);
  assert.strictEqual(m.config.logLevel, 'debug');
});

test('release 模式注入 debug=false', () => {
  const srcDir = makeProject(validManifest(), ['pages/Demo/index.ux']);
  const m = processManifest(srcDir, 'release');
  assert.strictEqual(m.config.debug, false);
  assert.strictEqual(m.config.logLevel, 'error');
});

test('mode 覆盖源文件中的 config', () => {
  const raw = validManifest();
  raw.config = { debug: true, logLevel: 'debug' };
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  const m = processManifest(srcDir, 'release');
  // 源文件写了 debug:true，但 mode=release 应覆盖为 false
  assert.strictEqual(m.config.debug, false);
});

test('component 缺省为 index', () => {
  const raw = validManifest();
  raw.router.pages = { 'pages/Demo': {} };
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  const m = processManifest(srcDir, 'debug');
  assert.ok(m.router.pages['pages/Demo']);
});

test('缺少 package 时报错并指出字段名', () => {
  const raw = validManifest();
  delete raw.package;
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.ok(err instanceof ManifestError);
      assert.match(err.message, /缺少必填字段 "package"/);
      return true;
    }
  );
});

test('多个必填字段缺失时一次性报告', () => {
  const raw = validManifest();
  delete raw.package;
  delete raw.versionName;
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /校验失败（2 项）/);
      assert.match(err.message, /"package"/);
      assert.match(err.message, /"versionName"/);
      return true;
    }
  );
});

test('versionCode 类型错误时报告实际类型', () => {
  const raw = validManifest();
  raw.versionCode = '1';
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /应为 number，实际为 string/);
      return true;
    }
  );
});

test('entry 不在 pages 中时报错并列出已声明页面', () => {
  const raw = validManifest();
  raw.router.entry = 'pages/NotDeclared';
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /不在 router\.pages 中/);
      assert.match(err.message, /"pages\/Demo"/);
      return true;
    }
  );
});

test('router.pages 为空时报错', () => {
  const raw = validManifest();
  raw.router.pages = {};
  const srcDir = makeProject(raw);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /router\.pages 不能为空/);
      return true;
    }
  );
});

test('页面文件不存在时一次性列出全部缺失', () => {
  const raw = validManifest();
  raw.router.pages = {
    'pages/A': { component: 'index' },
    'pages/B': { component: 'index' },
    'pages/C': { component: 'index' },
  };
  raw.router.entry = 'pages/A';
  // 只创建 A，B 和 C 缺失
  const srcDir = makeProject(raw, ['pages/A/index.ux']);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /pages\/B\/index\.ux/);
      assert.match(err.message, /pages\/C\/index\.ux/);
      assert.ok(!err.message.includes('pages/A/index.ux'));
      return true;
    }
  );
});

test('features 结构错误时报错', () => {
  const raw = validManifest();
  raw.features = [{ name: 'system.router' }, { nome: 'typo' }];
  const srcDir = makeProject(raw, ['pages/Demo/index.ux']);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /features\[1\]\.name/);
      return true;
    }
  );
});

test('features 缺省时不报错', () => {
  const srcDir = makeProject(validManifest(), ['pages/Demo/index.ux']);
  const m = processManifest(srcDir, 'debug');
  assert.strictEqual(m.features, undefined);
});

test('非法 JSON 报错并附行号', () => {
  const bad = '{\n  "package": "com.test",\n  "name":,\n}';
  const srcDir = makeProject(bad);
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.ok(err instanceof ManifestError);
      assert.match(err.message, /不是合法 JSON/);
      assert.ok(err.line > 0, '应能定位到行号');
      return true;
    }
  );
});

test('manifest.json 缺失时报错', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-nomanifest-'));
  const srcDir = path.join(root, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  assert.throws(() => processManifest(srcDir, 'debug'), ManifestError);
});

test('顶层为数组时报错', () => {
  const srcDir = makeProject('[]');
  assert.throws(
    () => processManifest(srcDir, 'debug'),
    (err) => {
      assert.match(err.message, /顶层应为对象/);
      return true;
    }
  );
});
```

---

## Step 3.6：逐层验证

### 3.6.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** 编译无错误，manifest-processor 的 17 个用例全部通过，加上 Step 2 的 12 个共 29 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `TS2339: Property 'router' does not exist on type 'unknown'` | 阶段 3 取 pages 时的类型断言写法 | 确认用了代码中的内联类型断言 |
| `TS4104: readonly array` | `REQUIRED_FIELDS` 是 `readonly` | 用 `for...of` 遍历而非 `.forEach` 或索引赋值 |

### 3.6.2：示例项目验证

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1
```

**预期输出：**

```text
模式：debug
源码：src/

应用：case1 (com.example.case1) v1.0.0
入口：pages/Demo
配置：debug=true, logLevel=debug
能力：system.prompt、system.router、system.shortcut、system.fetch

待编译页面（2）：
  pages/Demo  ->  pages/Demo/index.js
  pages/DemoDetail  ->  pages/DemoDetail/index.js
...
```

**验证点：** `能力` 一行的内容与示例项目 manifest 的 `features` 数组一致，说明 features 校验通过且顺序保持。

### 3.6.3：mode 覆盖验证

这是本 Step 最重要的行为验证。

示例项目的 manifest 里 `config.debug` 是 `true`。用 release 模式构建：

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=release
```

**预期输出：**

```text
配置：debug=false, logLevel=error
```

**验证点：** 尽管源文件写的是 `"debug": true`，产物中必须是 `false`。

如果这里显示 `debug=true`，说明 `buildRuntimeConfig` 的结果没有覆盖原值，或者用了合并而非替换。后果是 release 包在设备上开着详细日志——这类问题在开发和测试环境都不会暴露，只在线上表现为日志量异常和性能下降。

### 3.6.4：错误路径验证

**缺少必填字段：**

```bash
mkdir -p /tmp/m-test/src
cat > /tmp/m-test/src/manifest.json <<'EOF'
{
  "name": "test",
  "router": {
    "entry": "pages/Demo",
    "pages": { "pages/Demo": { "component": "index" } }
  }
}
EOF
quickapp build --root=/tmp/m-test
```

**预期输出：**

```text
ERROR  src/manifest.json
  manifest.json 校验失败（3 项）：
    1. 缺少必填字段 "package"
    2. 缺少必填字段 "versionName"
    3. 缺少必填字段 "versionCode"

编译失败：1 个错误，0 个警告
```

验证点：三个缺失字段一次性列出，不是报第一个就停。

**entry 不在 pages 中：**

```bash
cat > /tmp/m-test/src/manifest.json <<'EOF'
{
  "package": "com.test.m",
  "name": "test",
  "versionName": "1.0.0",
  "versionCode": 1,
  "router": {
    "entry": "pages/Home",
    "pages": {
      "pages/Demo": { "component": "index" },
      "pages/About": { "component": "index" }
    }
  }
}
EOF
quickapp build --root=/tmp/m-test
```

**预期输出：**

```text
ERROR  src/manifest.json
  router.entry "pages/Home" 不在 router.pages 中。已声明的页面："pages/Demo"、"pages/About"
```

验证点：错误信息列出所有已声明页面。开发者通常是拼写错误，看到候选列表能立刻发现差异。

**JSON 语法错误：**

```bash
cat > /tmp/m-test/src/manifest.json <<'EOF'
{
  "package": "com.test.m",
  "name":,
  "versionName": "1.0.0"
}
EOF
quickapp build --root=/tmp/m-test
```

**预期输出：**

```text
ERROR  src/manifest.json:3
  manifest.json 不是合法 JSON：Unexpected token ',' ...

  1 | {
  2 |   "package": "com.test.m",
  3 |   "name":,
  4 |   "versionName": "1.0.0"
  5 | }
```

验证点：行号为 3，且代码片段展示了出错行。如果行号是 0，说明 `locateJsonError` 没有匹配到 Node 的错误消息格式——不同 Node 版本消息格式不同，需要补充匹配规则。

### 3.6.5：与 Runtime 的字段对齐验证

toolkit 产出的 manifest 要被 C++ 的 `ManifestParser` 消费。逐字段核对：

| C++ 字段 | 读取路径 | toolkit 是否保证 |
|---|---|---|
| `package` | `package` | 必填校验 |
| `name` | `name` | 必填校验 |
| `versionName` | `versionName` | 必填校验 |
| `versionCode` | `versionCode` | 必填校验，类型为 number |
| `entry` | `router.entry` | 必填校验 + 自洽性校验 |
| `pages` | `router.pages[*].component` | 类型校验 + 文件存在性 |
| `titleBarBgColor` | `display.titleBarBackgroundColor` | 可选，不校验 |
| `titleBarTextColor` | `display.titleBarTextColor` | 可选，不校验 |
| `pageDisplays` | `display.pages[*].titleBarText` | 可选，不校验 |
| `features` | `features[*].name` | 结构校验 |
| `debug` | `config.debug` | mode 注入，保证是 boolean |
| `logLevel` | `config.logLevel` | mode 注入，保证是 string |

`display` 相关字段不做校验：缺失时 Runtime 有默认值（用 `manifest.name` 作标题），写错颜色格式最坏结果是渲染成默认色，不会崩溃。校验它们收益低于维护成本。

`config.debug` 必须是 boolean 而非字符串 `"true"`：C++ 侧用 `JS_ToBool` 读取，字符串 `"false"` 在 JS 里是 truthy，会导致 release 包被识别为 debug。mode 注入保证了这一点。

---

## 技术决策

### 1. mode 无条件覆盖 config，不做合并

源文件里的 `config.debug` 会被丢弃。理由是消除「源文件写 true、用 release 构建」这种不一致的可能。

这类问题的代价不对称：漏掉它，release 包带着 debug 日志上线，表现为日志量异常、性能下降，且在开发测试环境都不会暴露。而覆盖的代价只是开发者无法在 manifest 里手动控制 debug——但那本来就应该由 `--mode` 决定。

### 2. 校验分三个阶段，前一阶段失败就停

必填字段是后续校验的前提：`router` 缺失时，`checkRouter` 里的 `Object.entries(undefined)` 会崩溃。

结构自洽性优先于文件存在性：如果 `router.pages` 的 key 拼错了，「文件不存在」只是这个错误的次生表现，先修正 key 可能让缺失问题自动消失。

### 3. 必填字段用规则表驱动

`REQUIRED_FIELDS` 是数据，`checkField` 是逻辑。新增必填字段只需加一行，错误信息格式自动统一。

如果写成一串 `if (!raw.package) errors.push(...)`，每个字段的错误信息措辞容易漂移，且加字段时容易漏掉类型检查。

### 4. 保留 JSON 原始嵌套结构，不扁平化

TypeScript 侧用 `router.entry` 而非扁平的 `entry`。原因是 `processManifest` 的返回值会被直接序列化写入 RPK——它既是内部模型也是产物格式。

扁平化是 C++ `ManifestParser` 的内部表示选择，与产物格式无关。如果 toolkit 也扁平化，写入 RPK 前还要还原，多一次转换多一处出错可能。

### 5. scanProject 和 processManifest 都读 manifest

看起来重复，但避免了循环依赖：`scanProject` 需要 `router.pages` 才知道扫描什么，`processManifest` 的文件存在性校验需要知道目录结构。

解法是 `scanProject` 只做最小解析（只取 `router.pages`），`processManifest` 做完整校验。manifest 通常 1-2KB，两次 parse 的开销可忽略。

### 6. display 字段不校验

缺失时 Runtime 有合理默认值，写错时最坏结果是渲染成默认样式。校验的收益低于维护成本——每加一条校验规则都要考虑「这个值合法范围是什么」，而颜色、布尔开关这些字段的容错本来就应该在 Runtime。

### 7. features 只校验结构，不校验能力名

toolkit 不知道 Runtime 支持哪些能力。三端 Runtime 的能力集合可能不同（LVGL 端没有 Toast），把能力白名单放在 toolkit 会导致「toolkit 拒绝编译，但目标平台其实支持」。

能力可用性检查是 Runtime 侧 Capability Registry 的职责。toolkit 只保证 `features[].name` 是非空字符串。

### 8. JSON 错误行号做两种格式匹配

Node 20 之前的 `JSON.parse` 错误消息是 `position N`，之后是 `line X column Y`。两种都尝试解析，`position` 时手动换算行号。

不做这个兼容的后果是：在某些 Node 版本上 JSON 语法错误的行号是 0，诊断输出没有代码片段，开发者只能自己在文件里找。

---

## QA

**Q：为什么 manifest 错误直接 return 1，不像页面错误那样累积？**

manifest 提供路由表，路由表决定编译哪些页面。manifest 不可用时无法继续任何编译工作，累积错误没有意义。

页面错误不同：一个页面出错，其他页面仍可编译，累积报告让开发者一次看到全部问题。

**Q：`checkPageFiles` 与 Step 1 `scanProject` 的页面存在性检查重复了吗？**

功能重复，触发时机和目的不同。

`scanProject` 遇到缺失文件时立即抛错，因为它无法产出 `PageEntry`——后续流程需要这个列表。

`processManifest` 的检查是完整性校验的一部分。实际执行时 `scanProject` 会先报错，`checkPageFiles` 很少被触发。保留它是为了让 `processManifest` 成为独立可用的函数——Step 12 的 watch 模式在 manifest 变更时会单独调用它，那时需要完整校验。

**Q：`versionCode` 为什么必须是 number？**

Runtime 侧用 `JS_ToInt32` 读取，用于增量更新时的版本比较。如果是字符串 `"10"`，`JS_ToInt32` 能转换成功，但 `"1.0"` 会得到 1，静默丢失精度。

要求 number 类型让这个问题在编译期暴露。

**Q：`config` 字段在源文件里可以完全不写吗？**

可以。`REQUIRED_FIELDS` 里没有 `config`，`processManifest` 最后无条件赋值 `manifest.config = buildRuntimeConfig(mode)`。

源文件写了也会被覆盖，不写就直接生成。两种情况结果一致。

**Q：`minPlatformVersion` 为什么不是必填？**

它是 Runtime 侧的兼容性检查依据：Runtime 版本低于这个值时拒绝加载。缺失时 Runtime 应视为「无限制」。

强制要求开发者填这个字段没有意义——他们无法准确知道自己用的 API 对应哪个平台版本。这个字段更适合由 toolkit 根据实际使用的 features 自动推导（V2 可以做），当前作为可选透传。

**Q：如果 `router.pages` 里有页面没被任何 `router.push` 引用，会报警告吗？**

不会。toolkit 不做 JS 调用分析——`router.push` 的 uri 可能是运行时拼接的字符串，静态分析无法覆盖。

误报的代价（开发者被无效警告干扰）高于漏报（包里多一个未使用页面）。

**Q：`permissions` 字段完全不校验，会有问题吗？**

V1 不会。Runtime 侧 V1 也不实现权限检查，`permissions` 只是透传。

V2 引入权限模型后，需要校验 `origin` 格式并与 `features` 交叉验证（如声明了 `system.fetch` 但 `permissions` 里没有对应 origin）。届时在 `checkPermissions` 里补充。

---

## 下一步

Step 4 实现对象字面量序列化器：支持把含 function 值的对象序列化为 JS 代码字符串，这是模板编译器的前置依赖。
