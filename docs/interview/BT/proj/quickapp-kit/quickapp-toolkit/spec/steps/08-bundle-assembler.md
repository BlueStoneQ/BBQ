# Step 8：Bundle Assembler

## 目录

- [目标](#目标)
- [Step 8.1：产物格式契约](#step-81产物格式契约)
- [Step 8.2：实现 bundle 骨架模板](#step-82实现-bundle-骨架模板)
- [Step 8.3：实现页面 bundle 组装](#step-83实现页面-bundle-组装)
- [Step 8.4：实现 app bundle 组装](#step-84实现-app-bundle-组装)
- [Step 8.5：接入 build 管线](#step-85接入-build-管线)
- [Step 8.6：单元测试](#step-86单元测试)
- [Step 8.7：逐层验证](#step-87逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把三路编译产物组装为符合 Runtime 接口约定 的 bundle。**

| 输入 | 输出 |
|---|---|
| template 代码 + style 代码 + script 函数 | 完整 IIFE bundle，eval 后调用 `$app_define$` + `$app_bootstrap$` |

这一步是 toolkit 与 Runtime 的契约落地点。前面七步的产物都是片段，这里拼成 Runtime 能直接 eval 的完整文件。

**验收标准：**
- bundle eval 后 `$app_define$` 被调用一次，组件名为 `@app-component/index`
- `$app_bootstrap$` 在其后被调用
- `exports.template`、`exports.style`、`exports.private` 结构正确
- app.js 组装产物包含 `@app-application/app` 定义
- IIFE 包裹，`window` 未定义时直接执行

**本步不包含：**
- RPK 打包（Step 9）
- Release 压缩（Step 10）
- npm 依赖打包（V1 不支持）

---

## Step 8.1：产物格式契约

回顾 Runtime 侧的启动序列（来自 Android 的 `runtime_bootstrap.cpp` 和 `js_bridge.cpp`）：

```text
1. C++ 注入 $app_define$ / $app_bootstrap$ / $app_require$ / console 到全局
2. eval(framework.js)      -> framework.js 定义组件注册表和 VM 创建逻辑
3. eval(app.js)            -> 触发 $app_define$('@app-application/app') + $app_bootstrap$
4. eval(pages/Demo/index.js) -> 触发 $app_define$('@app-component/index') + $app_bootstrap$
5. framework.js 创建 VM，调用 onInit，构建 VNode，调用 __native_render__
```

bundle 的职责是第 3、4 步：**eval 后同步调用 `$app_define$` 注册组件，然后调用 `$app_bootstrap$` 启动。**

契约的六个约束：

| 约束 | 具体要求 | 违反的后果 |
|---|---|---|
| IIFE 包裹 | 立即执行，不污染全局 | 变量泄漏到全局，多页面互相干扰 |
| 组件名固定 | 页面用 `@app-component/index`，应用用 `@app-application/app` | framework.js 按名查找，找不到则启动失败 |
| define 先于 bootstrap | 同一次 eval 内，同步顺序 | bootstrap 时组件未注册，抛「Component not found」 |
| exports.template 存在 | 必须是 JSON 树对象 | VNode 构建拿不到模板，页面空白 |
| exports.style 存在 | 必须是选择器映射对象 | StyleResolver 无样式可合并，页面无样式 |
| `window` 检测 | 未定义时直接执行并 return | Runtime 环境没有 window，若无检测则 bundle 什么都不做 |

最后一条容易被忽略。回顾 RPK 里的实际产物结尾：

```javascript
if (typeof window === "undefined") {
  return createPageHandler();
} else {
  window.createPageHandler = createPageHandler;
}
```

同一份 bundle 要能在两种环境运行：Runtime（无 `window`，直接执行）和浏览器预览工具（有 `window`，挂载后由工具调用）。V1 只需支持前者，但保留这个结构以兼容官方工具链的产物形态。

---

## Step 8.2：实现 bundle 骨架模板

```text
@add quickapp-toolkit/src/bundler/templates.ts（新建文件）
```

```typescript
/**
 * 最小 webpack runtime。
 *
 * 只实现模块表查找和缓存，约 10 行。不引入完整 webpack：
 * 快应用 bundle 的模块表固定为三项（script/style/template），
 * 不需要 chunk 拆分、异步加载、HMR 等能力。
 *
 * 模块 ID 用字符串字面量（"script"/"style"/"template"）而非
 * webpack 的数字 ID：可读性更好，且我们不需要 ID 压缩。
 */
export const WEBPACK_RUNTIME = `var __webpack_module_cache__ = {};
      function __webpack_require__(moduleId) {
        var cached = __webpack_module_cache__[moduleId];
        if (cached !== undefined) return cached.exports;
        var module = __webpack_module_cache__[moduleId] = { exports: {} };
        __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
        return module.exports;
      }`;

/**
 * 页面 bundle 的注册与启动代码。
 *
 * 这段结构必须与官方产物一致 —— framework.js 的 $app_define$ 实现
 * 依赖 factory 的三个参数顺序，以及 __esModule 判断逻辑。
 *
 * @param componentName 组件名，页面固定为 "@app-component/index"
 * @param packagerVersion toolkit 版本，写入 $app_bootstrap$ 的 options
 * @returns 注册启动代码
 */
export function pageBootstrapCode(
  componentName: string,
  packagerVersion: string
): string {
  return `var $app_script$ = __webpack_require__("script");

      $app_define$('${componentName}', [], function ($app_require$, $app_exports$, $app_module$) {
        $app_script$($app_module$, $app_exports$, $app_require$);
        if ($app_exports$.__esModule && $app_exports$.default) {
          $app_module$.exports = $app_exports$.default;
        }
        $app_module$.exports.template = __webpack_require__("template");
        $app_module$.exports.style = __webpack_require__("style");
      });

      $app_bootstrap$('${componentName}', { packagerVersion: "${packagerVersion}" });`;
}

/**
 * 应用 bundle 的注册与启动代码。
 *
 * 与页面的差异：没有 template 和 style 模块，只有 script。
 * 应用级 bundle 承载全局变量注入和 onCreate 生命周期。
 *
 * @param packagerVersion toolkit 版本
 * @returns 注册启动代码
 */
export function appBootstrapCode(packagerVersion: string): string {
  return `var $app_script$ = __webpack_require__("script");

      $app_define$('@app-application/app', [], function ($app_require$, $app_exports$, $app_module$) {
        $app_script$($app_module$, $app_exports$, $app_require$);
        if ($app_exports$.__esModule && $app_exports$.default) {
          $app_module$.exports = $app_exports$.default;
        }
      });

      $app_bootstrap$('@app-application/app', { packagerVersion: "${packagerVersion}" });`;
}

/**
 * 外层 IIFE 包裹。
 *
 * createPageHandler 的双环境检测保持与官方产物一致：
 *   Runtime 环境（无 window）  -> 直接执行并 return
 *   浏览器预览（有 window）    -> 挂载到 window 供工具调用
 *
 * V1 只需支持 Runtime 环境，保留这个结构是为了产物形态与官方一致，
 * 便于用官方工具做交叉验证。
 *
 * @param innerCode 模块表 + webpack runtime + 注册启动代码
 * @returns 完整 bundle 代码
 */
export function wrapBundle(innerCode: string): string {
  return `(function () {
  var createPageHandler = function () {
    return (function () {
${innerCode}
    })();
  };

  if (typeof window === "undefined") {
    return createPageHandler();
  } else {
    window.createPageHandler = createPageHandler;
  }
})();
`;
}
```

`wrapBundle` 内层用 `(function () { ... })()` 而非箭头函数 IIFE。官方产物用的是箭头函数 `(() => { ... })()`，两者语义等价——但 `function` 形式对更老的 JS 引擎兼容，且这层包裹里不需要 `this` 绑定。选择不影响功能。

---

## Step 8.3：实现页面 bundle 组装

```text
@add quickapp-toolkit/src/bundler/assembler.ts（新建文件）
```

```typescript
import type { BuildMode, Diagnostic, SFCDescriptor } from '../types';
import { compileTemplate } from '../compiler/template-compiler';
import { compileStyle } from '../compiler/style-compiler';
import { compileScript } from '../compiler/script-compiler';
import {
  WEBPACK_RUNTIME,
  pageBootstrapCode,
  appBootstrapCode,
  wrapBundle,
} from './templates';

/** 页面组件的固定注册名，framework.js 按此名查找 */
const PAGE_COMPONENT_NAME = '@app-component/index';

/** 组装结果 */
export interface AssembleResult {
  /** 完整 bundle 代码，可直接写入 RPK */
  code: string;
  /** 组装过程中累积的诊断（主要来自样式编译的 warning） */
  diagnostics: Diagnostic[];
}

/**
 * 生成模块表代码。
 *
 * @param modules 模块 ID 到模块工厂代码的映射；顺序决定产物中的顺序
 * @returns var __webpack_modules__ = { ... } 代码
 */
function moduleTableCode(modules: Array<[string, string]>): string {
  const entries = modules.map(([id, factory]) => {
    // 模块工厂统一为 function (module, exports, __webpack_require__) 形式。
    // script 模块本身已是这个签名（Step 7 产出），
    // style 和 template 模块需要包一层把对象赋给 module.exports
    return `        "${id}": ${factory}`;
  });

  return `      var __webpack_modules__ = {
${entries.join(',\n')}
      };`;
}

/**
 * 把一个对象字面量代码包装为 webpack 模块工厂。
 *
 * style 和 template 的编译产物是对象字面量（如 { type: "div", ... }），
 * 需要包成 function (module) { module.exports = <对象> } 才能进模块表。
 *
 * @param objectCode 对象字面量代码
 * @returns 模块工厂代码
 */
function wrapAsModule(objectCode: string): string {
  return `function (module) {
          module.exports = ${objectCode};
        }`;
}

/**
 * 组装页面 bundle。
 *
 * 三路编译在此汇聚。任一路抛错则整个页面组装失败 —— 调用方负责
 * 捕获并记入 diagnostics，不影响其他页面。
 *
 * @param descriptor      已解析的 SFC 描述符
 * @param mode            构建模式
 * @param packagerVersion toolkit 版本，写入 bootstrap options
 * @returns bundle 代码和诊断
 * @throws TemplateCompileError | StyleCompileError | ScriptCompileError
 */
export function assemblePageBundle(
  descriptor: SFCDescriptor,
  mode: BuildMode,
  packagerVersion: string
): AssembleResult {
  const { filename, template, style, script } = descriptor;
  const diagnostics: Diagnostic[] = [];

  // template 必须存在 —— validatePageSFC 已保证，此处是防御性检查
  if (template === null) {
    throw new Error(`内部错误：页面 ${filename} 缺少 template 区块`);
  }

  const templateCode = compileTemplate(
    template.content,
    filename,
    template.startLine,
    mode
  );

  // style 缺失时用空对象。Runtime 侧 StyleResolver 遍历空表不报错
  let styleCode = '{}';
  if (style !== null) {
    const result = compileStyle(
      style.content,
      filename,
      style.startLine,
      style.lang,
      mode
    );
    styleCode = result.code;
    diagnostics.push(...result.diagnostics);
  }

  // script 缺失时生成空模块。纯展示页面没有 VM 逻辑，
  // framework.js 会用空 private 和无生命周期创建 VM
  const scriptCode =
    script === null
      ? 'function (module, exports, $app_require$) {}'
      : compileScript(script.content, filename, script.startLine, mode);

  // 模块顺序与官方产物一致：script、style、template
  const inner = [
    moduleTableCode([
      ['script', scriptCode],
      ['style', wrapAsModule(styleCode)],
      ['template', wrapAsModule(templateCode)],
    ]),
    '',
    `      ${WEBPACK_RUNTIME}`,
    '',
    `      ${pageBootstrapCode(PAGE_COMPONENT_NAME, packagerVersion)}`,
  ].join('\n');

  return { code: wrapBundle(inner), diagnostics };
}
```

`wrapAsModule` 的包裹参数只有 `module`，没有 `exports` 和 `__webpack_require__`。JS 允许函数接收比声明更多的参数，`__webpack_require__` 调用时传三个实参，函数只用第一个——这与官方产物一致，也让产物更简洁。

---

## Step 8.4：实现 app bundle 组装

`app.ux` 与页面的差异：

| 维度 | 页面 | app |
|---|---|---|
| 组件名 | `@app-component/index` | `@app-application/app` |
| template | 必须有 | 不需要 |
| style | 可选 | 不需要 |
| script | 可选 | 通常有（全局变量、onCreate） |
| 是否可缺失 | 不可 | 可以（生成最小 bundle） |

```text
@add quickapp-toolkit/src/bundler/assembler.ts — 在 assemblePageBundle 之后插入
```

```typescript
/**
 * 校验 app.ux 描述符。
 *
 * 与 validatePageSFC 的差异：app 不要求 template。这就是 Step 2
 * 里 app.ux 走 validatePageSFC 会报错的原因 —— 那里刻意留了一条
 * 可见的 error 作为待办提醒，本函数是它的正解。
 *
 * @param descriptor app.ux 的描述符
 * @param diagnostics 诊断收集数组；template/style 存在时产生 warning
 */
function validateAppSFC(descriptor: SFCDescriptor, diagnostics: Diagnostic[]): void {
  if (descriptor.template !== null) {
    diagnostics.push({
      severity: 'warning',
      file: descriptor.filename,
      line: descriptor.template.startLine - 1,
      column: 0,
      message: 'app.ux 中的 <template> 区块不会被使用，应用级 bundle 无模板',
    });
  }
  if (descriptor.style !== null) {
    diagnostics.push({
      severity: 'warning',
      file: descriptor.filename,
      line: descriptor.style.startLine - 1,
      column: 0,
      message: 'app.ux 中的 <style> 区块不会被使用，应用级 bundle 无样式',
    });
  }
}

/**
 * 组装应用 bundle（app.js）。
 *
 * @param descriptor      app.ux 的描述符；null 表示项目未提供 app.ux
 * @param mode            构建模式
 * @param packagerVersion toolkit 版本
 * @returns bundle 代码和诊断
 * @throws ScriptCompileError script 区块语法错误
 */
export function assembleAppBundle(
  descriptor: SFCDescriptor | null,
  mode: BuildMode,
  packagerVersion: string
): AssembleResult {
  const diagnostics: Diagnostic[] = [];

  let scriptCode: string;

  if (descriptor === null) {
    // 项目未提供 app.ux：生成最小 bundle。
    // 不能省略 app.js —— Runtime 的启动序列会 eval 它，
    // 文件不存在时 RPKLoader 返回空字符串，eval 空串虽不报错，
    // 但 $app_define$('@app-application/app') 永不调用，
    // framework.js 可能因缺少应用注册而启动失败
    scriptCode = 'function (module, exports, $app_require$) {}';
  } else {
    validateAppSFC(descriptor, diagnostics);
    scriptCode =
      descriptor.script === null
        ? 'function (module, exports, $app_require$) {}'
        : compileScript(
            descriptor.script.content,
            descriptor.filename,
            descriptor.script.startLine,
            mode
          );
  }

  const inner = [
    moduleTableCode([['script', scriptCode]]),
    '',
    `      ${WEBPACK_RUNTIME}`,
    '',
    `      ${appBootstrapCode(packagerVersion)}`,
  ].join('\n');

  return { code: wrapBundle(inner), diagnostics };
}
```

`app.ux` 缺失时仍生成 `app.js` 的理由值得记录。Runtime 的启动序列是固定的：`eval(framework.js)` → `eval(app.js)` → `eval(page bundle)`。如果 RPK 里没有 `app.js`，`RPKLoader.readText("app.js")` 返回空字符串，`eval("")` 不报错但 `$app_define$('@app-application/app')` 永不被调用。

framework.js 的实现可能依赖应用注册（比如把应用的 `onCreate` 挂到某个全局状态）。缺少这一步的后果取决于 framework.js 的容错程度——生成一个空的但结构完整的 `app.js` 消除了这个不确定性。

---

## Step 8.5：接入 build 管线

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
import { assemblePageBundle, assembleAppBundle } from '../bundler/assembler';
import { CompileError } from '../diagnostics/errors';
import { fromError, reportDiagnostics } from '../diagnostics/diagnostic';

/** toolkit 版本，写入 bundle 的 packagerVersion */
const PACKAGER_VERSION: string = require('../../package.json').version;
```

`parsePageFile` 需要调整：`app.ux` 不应走 `validatePageSFC`。

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 parsePageFile 函数
```

```typescript
/**
 * 读取并解析单个 .ux 文件。
 *
 * @param sourcePath .ux 文件绝对路径
 * @param ctx        构建上下文，失败时向其 diagnostics 追加
 * @param isPage     true 表示按页面校验（要求 template）；app.ux 传 false
 * @returns 解析成功的描述符；失败时为 null
 */
function parseUxFile(
  sourcePath: string,
  ctx: BuildContext,
  isPage: boolean
): SFCDescriptor | null {
  let source: string;
  try {
    source = fs.readFileSync(sourcePath, 'utf8');
  } catch (e) {
    ctx.diagnostics.push({
      severity: 'error',
      file: sourcePath,
      line: 0,
      column: 0,
      message: `无法读取文件：${(e as Error).message}`,
    });
    return null;
  }

  try {
    const descriptor = parseSFC(source, sourcePath);
    if (isPage) {
      validatePageSFC(descriptor);
    }
    return descriptor;
  } catch (e) {
    if (e instanceof CompileError) {
      ctx.diagnostics.push(fromError(e));
      return null;
    }
    throw e;
  }
}
```

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换「SFC 解析」段到函数结尾
```

```typescript
  // ---- Step 2/8：解析并组装 ----
  console.log('编译：');

  /** 产物路径 -> bundle 代码 */
  const bundles = new Map<string, string>();

  // app.js 总是产出，即使项目没有 app.ux
  const appDescriptor =
    tree.appPath === null ? null : parseUxFile(tree.appPath, ctx, false);
  try {
    const result = assembleAppBundle(appDescriptor, ctx.mode, PACKAGER_VERSION);
    bundles.set('app.js', result.code);
    ctx.diagnostics.push(...result.diagnostics);
    console.log(`  app.js  ${formatSize(result.code.length)}`);
  } catch (e) {
    if (e instanceof CompileError) {
      ctx.diagnostics.push(fromError(e));
    } else {
      throw e;
    }
  }

  for (const page of tree.pages) {
    const descriptor = parseUxFile(page.sourcePath, ctx, true);
    if (descriptor === null) continue;

    try {
      const result = assemblePageBundle(descriptor, ctx.mode, PACKAGER_VERSION);
      bundles.set(page.outputPath, result.code);
      ctx.diagnostics.push(...result.diagnostics);
      console.log(`  ${page.outputPath}  ${formatSize(result.code.length)}`);
    } catch (e) {
      // 单页面编译失败不影响其他页面
      if (e instanceof CompileError) {
        ctx.diagnostics.push(fromError(e));
      } else {
        throw e;
      }
    }
  }
  console.log('');

  console.log(`静态资源（${tree.assets.length}）：`);
  for (const asset of tree.assets) {
    console.log(`  ${asset.outputPath}`);
  }
  console.log('');

  const hasError = reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
  if (hasError) {
    console.error('存在错误，未产出 RPK');
    return 1;
  }

  // Step 9 起在此接入 RPK 打包
  console.log(
    `组装完成：${bundles.size} 个 bundle。RPK 打包尚未接入（Step 9 实现）。`
  );
  return 0;
```

```text
@add quickapp-toolkit/src/cli/cmd-build.ts — 在 printBlockSummary 之后插入
```

```typescript
/**
 * 格式化字节数为可读字符串。
 * @param bytes 字节数
 * @returns 如 "1.2 KB"
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
```

注意 `hasError` 时提前 return，不进入打包。这实现了 Property 8（编译失败不产出半成品）的前半部分——后半部分（原子写入）在 Step 9。

---

## Step 8.6：单元测试

测试的核心思路：**在 Node 中 eval bundle，注入 mock 的 `$app_define$` / `$app_bootstrap$` / `$app_require$`，断言调用序列和 exports 结构。** 这直接验证了产物格式契约。

```text
@add quickapp-toolkit/test/unit/bundle-assembler.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  assemblePageBundle,
  assembleAppBundle,
} = require('../../dist/bundler/assembler.js');
const { parseSFC } = require('../../dist/parser/sfc-parser.js');

const FILE = '/proj/src/pages/Demo/index.ux';
const VERSION = '1.0.0';

/**
 * 在隔离环境中执行 bundle，捕获注入的全局函数调用。
 *
 * 模拟 Runtime 的执行环境：注入 $app_define$ / $app_bootstrap$ /
 * $app_require$，然后 eval bundle。这与 C++ 侧 js_bridge.cpp 的
 * 注入行为等价。
 *
 * @param code bundle 代码
 * @param modules $app_require$ 的返回值映射
 * @returns 调用记录和最终 exports
 */
function runBundle(code, modules = {}) {
  const defineCalls = [];
  const bootstrapCalls = [];
  const requireCalls = [];
  let componentExports = null;

  const $app_define$ = (name, deps, factory) => {
    defineCalls.push({ name, deps });
    // 模拟 framework.js：立即执行 factory 收集 exports
    const $app_module$ = { exports: {} };
    const $app_exports$ = $app_module$.exports;
    factory($app_require$, $app_exports$, $app_module$);
    componentExports = $app_module$.exports;
  };

  const $app_bootstrap$ = (name, options) => {
    bootstrapCalls.push({ name, options });
  };

  const $app_require$ = (name) => {
    requireCalls.push(name);
    return modules[name] ?? {};
  };

  // 用 Function 构造器隔离作用域，避免污染测试文件的全局
  const fn = new Function(
    '$app_define$',
    '$app_bootstrap$',
    '$app_require$',
    code
  );
  fn($app_define$, $app_bootstrap$, $app_require$);

  return { defineCalls, bootstrapCalls, requireCalls, exports: componentExports };
}

/** 构造一个完整的页面 SFC */
function pageSFC(opts = {}) {
  const template = opts.template ?? '<div class="wrapper"><text>{{title}}</text></div>';
  const style = opts.style ?? '.wrapper { flex-direction: column }';
  const script = opts.script ?? "export default { private: { title: 'x' } };";

  const parts = [`<template>\n${template}\n</template>`];
  if (style !== null) parts.push(`<style>\n${style}\n</style>`);
  if (script !== null) parts.push(`<script>\n${script}\n</script>`);

  return parseSFC(parts.join('\n\n'), FILE);
}

// ---------- 页面 bundle 结构 ----------

test('页面 bundle 是 IIFE，eval 后立即执行', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.defineCalls.length, 1, '$app_define$ 应被调用一次');
});

test('组件名为 @app-component/index', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.defineCalls[0].name, '@app-component/index');
});

test('$app_bootstrap$ 在 define 之后被调用', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.bootstrapCalls.length, 1);
  assert.strictEqual(r.bootstrapCalls[0].name, '@app-component/index');
});

test('bootstrap options 含 packagerVersion', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', '2.5.0');
  const r = runBundle(code);
  assert.strictEqual(r.bootstrapCalls[0].options.packagerVersion, '2.5.0');
});

test('define 的 deps 为空数组', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  assert.deepStrictEqual(r.defineCalls[0].deps, []);
});

// ---------- exports 结构 ----------

test('exports.template 是模板树对象', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.exports.template.type, 'div');
  assert.deepStrictEqual(r.exports.template.classList, ['wrapper']);
});

test('exports.style 是样式表对象', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  assert.deepStrictEqual(r.exports.style, {
    '.wrapper': { flexDirection: 'column' },
  });
});

test('exports.private 来自 script 的 export default', () => {
  const { code } = assemblePageBundle(
    pageSFC({ script: "export default { private: { title: '演示' } };" }),
    'debug',
    VERSION
  );
  const r = runBundle(code);
  assert.deepStrictEqual(r.exports.private, { title: '演示' });
});

test('exports 上的生命周期方法可调用', () => {
  const { code } = assemblePageBundle(
    pageSFC({
      script: 'export default { private: {}, onInit() { this.ok = true; } };',
    }),
    'debug',
    VERSION
  );
  const r = runBundle(code);
  const vm = { ...r.exports };
  vm.onInit.call(vm);
  assert.strictEqual(vm.ok, true);
});

test('模板中的函数属性以 VM 为 this 求值', () => {
  const { code } = assemblePageBundle(pageSFC(), 'debug', VERSION);
  const r = runBundle(code);
  const valueFn = r.exports.template.children[0].attr.value;
  assert.strictEqual(typeof valueFn, 'function');
  assert.strictEqual(valueFn.call({ title: '欢迎' }), '欢迎');
});

// ---------- 缺失区块处理 ----------

test('缺 style 时 exports.style 为空对象', () => {
  const { code } = assemblePageBundle(
    pageSFC({ style: null }),
    'debug',
    VERSION
  );
  const r = runBundle(code);
  assert.deepStrictEqual(r.exports.style, {});
});

test('缺 script 时仍能组装并有 template/style', () => {
  const { code } = assemblePageBundle(
    pageSFC({ script: null }),
    'debug',
    VERSION
  );
  const r = runBundle(code);
  assert.strictEqual(r.exports.template.type, 'div');
  assert.ok(r.exports.style);
});

// ---------- $app_require$ 链路 ----------

test('script 中的 require 到达 $app_require$', () => {
  const { code } = assemblePageBundle(
    pageSFC({
      script: [
        "import router from '@app-module/system.router';",
        'export default {',
        '  private: {},',
        "  go() { router.push({ uri: '/x' }); }",
        '};',
      ].join('\n'),
    }),
    'debug',
    VERSION
  );

  const pushCalls = [];
  const r = runBundle(code, {
    '@app-module/system.router': {
      default: { push: (o) => pushCalls.push(o) },
    },
  });

  assert.ok(
    r.requireCalls.includes('@app-module/system.router'),
    `requireCalls: ${JSON.stringify(r.requireCalls)}`
  );

  r.exports.go();
  assert.deepStrictEqual(pushCalls, [{ uri: '/x' }]);
});

// ---------- app bundle ----------

test('app bundle 组件名为 @app-application/app', () => {
  const app = parseSFC('<script>\nexport default { onCreate() {} };\n</script>', '/app.ux');
  const { code } = assembleAppBundle(app, 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.defineCalls[0].name, '@app-application/app');
  assert.strictEqual(r.bootstrapCalls[0].name, '@app-application/app');
});

test('app bundle 无 template 和 style', () => {
  const app = parseSFC('<script>\nexport default {};\n</script>', '/app.ux');
  const { code } = assembleAppBundle(app, 'debug', VERSION);
  const r = runBundle(code);
  assert.ok(!('template' in r.exports));
  assert.ok(!('style' in r.exports));
});

test('app bundle 的 onCreate 可调用', () => {
  const app = parseSFC(
    '<script>\nexport default { onCreate() { return 42; } };\n</script>',
    '/app.ux'
  );
  const { code } = assembleAppBundle(app, 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.exports.onCreate(), 42);
});

test('descriptor 为 null 时生成最小 app bundle', () => {
  const { code } = assembleAppBundle(null, 'debug', VERSION);
  const r = runBundle(code);
  assert.strictEqual(r.defineCalls.length, 1);
  assert.strictEqual(r.defineCalls[0].name, '@app-application/app');
  assert.strictEqual(r.bootstrapCalls.length, 1);
});

test('app.ux 含 template 时产生 warning', () => {
  const app = parseSFC(
    '<template>\n<div></div>\n</template>\n<script>\nexport default {};\n</script>',
    '/app.ux'
  );
  const { diagnostics } = assembleAppBundle(app, 'debug', VERSION);
  assert.ok(diagnostics.some((d) => /template.*不会被使用/.test(d.message)));
});

// ---------- 诊断传递 ----------

test('样式 warning 被传递到组装结果', () => {
  const { diagnostics } = assemblePageBundle(
    pageSFC({ style: '.a { -webkit-mask: none }' }),
    'debug',
    VERSION
  );
  assert.ok(diagnostics.some((d) => /-webkit-mask/.test(d.message)));
});

// ---------- 模式差异 ----------

test('release 模式产物更小', () => {
  const sfc = pageSFC();
  const debug = assemblePageBundle(sfc, 'debug', VERSION).code;
  const release = assemblePageBundle(sfc, 'release', VERSION).code;
  assert.ok(release.length < debug.length, `release ${release.length} 应小于 debug ${debug.length}`);
});

test('两种模式的 exports 结构等价', () => {
  const sfc = pageSFC();
  const d = runBundle(assemblePageBundle(sfc, 'debug', VERSION).code);
  const r = runBundle(assemblePageBundle(sfc, 'release', VERSION).code);

  assert.deepStrictEqual(d.exports.style, r.exports.style);
  assert.deepStrictEqual(d.exports.private, r.exports.private);
  assert.strictEqual(d.exports.template.type, r.exports.template.type);
  // 函数属性行为等价
  const vm = { title: 'T' };
  assert.strictEqual(
    d.exports.template.children[0].attr.value.call(vm),
    r.exports.template.children[0].attr.value.call(vm)
  );
});

// ---------- 完整示例对齐 ----------

test('示例 Demo 页面完整组装验证', () => {
  const sfc = pageSFC({
    template: [
      '<div class="wrapper">',
      '  <text class="title">{{title}}</text>',
      '  <input class="btn" type="button" value="跳转到详情页" @click="onDetailBtnClick" />',
      '</div>',
    ].join('\n'),
    style: [
      '.wrapper { flex-direction: column; justify-content: center }',
      '.wrapper .title { font-size: 40px; color: #000000 }',
      '.wrapper .btn { width: 450px; background-color: #09ba07 }',
    ].join('\n'),
    script: [
      "import router from '@app-module/system.router';",
      'export default {',
      "  private: { title: '欢迎体验快应用开发' },",
      '  onInit() {},',
      "  onDetailBtnClick() { router.push({ uri: '/pages/DemoDetail' }); }",
      '};',
    ].join('\n'),
  });

  const { code, diagnostics } = assemblePageBundle(sfc, 'debug', VERSION);
  assert.strictEqual(diagnostics.length, 0, '不应有诊断');

  const pushCalls = [];
  const r = runBundle(code, {
    '@app-module/system.router': { default: { push: (o) => pushCalls.push(o) } },
  });

  // 注册与启动
  assert.strictEqual(r.defineCalls[0].name, '@app-component/index');
  assert.strictEqual(r.bootstrapCalls[0].name, '@app-component/index');

  // VM 数据
  assert.deepStrictEqual(r.exports.private, { title: '欢迎体验快应用开发' });

  // 模板结构
  const tpl = r.exports.template;
  assert.strictEqual(tpl.type, 'div');
  assert.deepStrictEqual(tpl.classList, ['wrapper']);
  assert.strictEqual(tpl.children.length, 2);
  assert.strictEqual(
    tpl.children[0].attr.value.call(r.exports.private),
    '欢迎体验快应用开发'
  );
  assert.deepStrictEqual(tpl.children[1].events, { click: 'onDetailBtnClick' });

  // 样式
  assert.strictEqual(r.exports.style['.wrapper'].flexDirection, 'column');
  assert.strictEqual(r.exports.style['.wrapper .title'].fontSize, '40px');

  // 事件处理链路
  r.exports.onDetailBtnClick();
  assert.deepStrictEqual(pushCalls, [{ uri: '/pages/DemoDetail' }]);
});
```

最后一个用例是本 Step 的核心验收，它一次性验证了：注册启动序列、VM 数据、模板结构、函数属性求值、事件映射、样式表、以及 `router.push` 的完整调用链。

这个用例通过意味着产物格式契约成立——剩下的不确定性只在 Runtime 侧的实现是否与契约一致，那是 Step 11 的验收内容。

---

## Step 8.7：逐层验证

### 8.7.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** bundle-assembler 的 22 个用例全部通过，累计 195 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `$app_define$ is not defined` | `new Function` 的参数名与 bundle 内引用不一致 | 确认三个参数名完全匹配 |
| `exports.template` 为 undefined | `$app_define$` mock 未执行 factory | mock 里要立即调用 factory 并收集 exports |
| `Cannot read property 'default' of undefined` | `$app_require$` mock 返回 `{}` 而代码访问 `.default` | 测试的 modules 映射要提供 `{ default: {...} }` 结构 |
| release 产物不比 debug 小 | 紧凑序列化未生效 | 确认 mode 传到了 compileTemplate/compileStyle |

### 8.7.2：产物结构人工检视

```bash
node -e "
const { parseSFC } = require('./dist/parser/sfc-parser.js');
const { assemblePageBundle } = require('./dist/bundler/assembler.js');

const sfc = parseSFC([
  '<template>',
  '<div class=\"wrapper\"><text>{{title}}</text></div>',
  '</template>',
  '',
  '<style>',
  '.wrapper { flex-direction: column }',
  '</style>',
  '',
  '<script>',
  \"export default { private: { title: 'hi' } };\",
  '</script>'
].join('\n'), '/x/index.ux');

console.log(assemblePageBundle(sfc, 'debug', '1.0.0').code);
"
```

**预期产物骨架：**

```javascript
(function () {
  var createPageHandler = function () {
    return (function () {
      var __webpack_modules__ = {
        "script": function (module, exports, $app_require$) {
          ...
          exports.default = { private: { title: 'hi' } };
        },
        "style": function (module) {
          module.exports = {
            ".wrapper": { flexDirection: "column" }
          };
        },
        "template": function (module) {
          module.exports = {
            type: "div",
            attr: {},
            classList: ["wrapper"],
            children: [ ... ]
          };
        }
      };

      var __webpack_module_cache__ = {};
      function __webpack_require__(moduleId) { ... }

      var $app_script$ = __webpack_require__("script");

      $app_define$('@app-component/index', [], function ($app_require$, $app_exports$, $app_module$) {
        $app_script$($app_module$, $app_exports$, $app_require$);
        if ($app_exports$.__esModule && $app_exports$.default) {
          $app_module$.exports = $app_exports$.default;
        }
        $app_module$.exports.template = __webpack_require__("template");
        $app_module$.exports.style = __webpack_require__("style");
      });

      $app_bootstrap$('@app-component/index', { packagerVersion: "1.0.0" });
    })();
  };

  if (typeof window === "undefined") {
    return createPageHandler();
  } else {
    window.createPageHandler = createPageHandler;
  }
})();
```

**逐项核对：**

| 检查项 | 位置 |
|---|---|
| 外层 IIFE | 首行 `(function () {` |
| 模块表三项 | `"script"`、`"style"`、`"template"` |
| webpack runtime | `__webpack_module_cache__` + `__webpack_require__` |
| `$app_define$` 组件名 | `'@app-component/index'` |
| `__esModule` 判断 | factory 内 |
| template/style 挂载 | factory 内两行赋值 |
| `$app_bootstrap$` | define 之后 |
| window 检测 | 末尾 |

### 8.7.3：在 Node 中模拟 Runtime 执行

这是最接近真实场景的验证：完整模拟 C++ 侧的全局函数注入。

```bash
node -e "
const { parseSFC } = require('./dist/parser/sfc-parser.js');
const { assemblePageBundle } = require('./dist/bundler/assembler.js');

const sfc = parseSFC([
  '<template>',
  '<div class=\"wrapper\">',
  '  <text class=\"title\">{{title}}</text>',
  '  <input class=\"btn\" type=\"button\" value=\"跳转\" @click=\"onTap\" />',
  '</div>',
  '</template>',
  '<style>',
  '.wrapper { flex-direction: column }',
  '.title { font-size: 40px }',
  '</style>',
  '<script>',
  \"import router from '@app-module/system.router';\",
  'export default {',
  \"  private: { title: '欢迎体验快应用开发' },\",
  '  onInit() { console.log(\"[JS] onInit\"); },',
  \"  onTap() { router.push({ uri: '/pages/DemoDetail' }); }\",
  '};',
  '</script>'
].join('\n'), '/x/index.ux');

const code = assemblePageBundle(sfc, 'debug', '1.0.0').code;

// ===== 模拟 C++ js_bridge.cpp 的注入 =====
const registry = {
  '@app-module/system.router': {
    default: { push: (o) => console.log('[C++] router.push', JSON.stringify(o)) }
  },
  '@app-module/system.prompt': {
    default: { showToast: (o) => console.log('[C++] showToast', JSON.stringify(o)) }
  }
};

let component = null;

const \$app_define\$ = (name, deps, factory) => {
  console.log('[C++] \$app_define\$:', name);
  const mod = { exports: {} };
  factory(\$app_require\$, mod.exports, mod);
  component = mod.exports;
};

const \$app_bootstrap\$ = (name, opts) => {
  console.log('[C++] \$app_bootstrap\$:', name, JSON.stringify(opts));

  // ===== 模拟 framework.js 的 VM 创建 =====
  const vm = Object.assign({}, component, component.private);
  if (vm.onInit) vm.onInit.call(vm);

  // ===== 模拟 VNode 构建：求值函数属性 =====
  const buildVNode = (node) => {
    const out = { type: node.type, classList: node.classList || [], attr: {} };
    for (const [k, v] of Object.entries(node.attr || {})) {
      out.attr[k] = typeof v === 'function' ? v.call(vm) : v;
    }
    if (node.events) out.events = node.events;
    if (node.children) out.children = node.children.map(buildVNode);
    return out;
  };

  const vnode = buildVNode(component.template);
  console.log('[C++] VNode:', JSON.stringify(vnode, null, 2));
  console.log('[C++] StyleSheet:', JSON.stringify(component.style));

  // ===== 模拟点击事件 =====
  const btn = vnode.children[1];
  if (btn.events && btn.events.click) {
    console.log('[C++] dispatchClick -> ' + btn.events.click);
    vm[btn.events.click].call(vm);
  }
};

const \$app_require\$ = (name) => {
  console.log('[C++] \$app_require\$:', name);
  return registry[name] || {};
};

new Function('\$app_define\$', '\$app_bootstrap\$', '\$app_require\$', 'console', code)(
  \$app_define\$, \$app_bootstrap\$, \$app_require\$, console
);
"
```

**预期输出：**

```text
[C++] $app_require$: @app-module/system.router
[C++] $app_define$: @app-component/index
[C++] $app_bootstrap$: @app-component/index {"packagerVersion":"1.0.0"}
[JS] onInit
[C++] VNode: {
  "type": "div",
  "classList": ["wrapper"],
  "attr": {},
  "children": [
    {
      "type": "text",
      "classList": ["title"],
      "attr": { "value": "欢迎体验快应用开发" }
    },
    {
      "type": "input",
      "classList": ["btn"],
      "attr": { "type": "button", "value": "跳转" },
      "events": { "click": "onTap" }
    }
  ]
}
[C++] StyleSheet: {".wrapper":{"flexDirection":"column"},".title":{"fontSize":"40px"}}
[C++] dispatchClick -> onTap
[C++] router.push {"uri":"/pages/DemoDetail"}
```

**关键验证点：**

`attr.value` 已求值为 `"欢迎体验快应用开发"` —— 说明函数属性的 `this` 正确绑定到 VM。这是整条链路中最容易出错的环节。

`router.push` 收到完整参数 —— 说明 `$app_require$` 返回的 `{ default: {...} }` 结构与 Babel 生成的 `.default` 访问链匹配。

如果这里报「Cannot read property 'push' of undefined」，说明 Step 7 QA 里提到的 `_interopRequireDefault` 多包一层的问题确实存在。诊断方法：

```bash
node -e "
const { compileScriptBody } = require('./dist/compiler/script-compiler.js');
console.log(compileScriptBody(\"import router from 'm';\nrouter.push();\", '/x.ux', 2));
"
```

如果输出里是 `_m.default.default.push()`（两层 default），需要在 Runtime 侧的 `native_app_require` 返回对象上加 `__esModule: true`。这个结论要带到 Step 11 验证。

### 8.7.4：示例项目端到端

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

编译：
  app.js  1.2 KB
  pages/Demo/index.js  3.4 KB
  pages/DemoDetail/index.js  3.1 KB

静态资源（1）：
  assets/images/logo.png

组装完成：3 个 bundle。RPK 打包尚未接入（Step 9 实现）。
```

**验证点：** 三个 bundle 都产出，无 error。体积在 KB 量级（官方 debug 版单页 29KB，我们更小是因为不生成 sourcemap）。

### 8.7.5：Release 模式对照

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=release
```

**预期：** 各 bundle 体积明显小于 debug（模板和样式走紧凑序列化，注释被去掉）。

Terser 压缩在 Step 10 接入，此时的 release 产物只是「紧凑序列化 + 无注释」，尚未变量名压缩。体积降幅约 30%，接入 Terser 后应达到 80%。

---

## 技术决策

### 1. 手写最小 webpack runtime，不引入 webpack

产物需要的只是「模块表 + 按 ID 查找 + 缓存」，约 10 行代码。完整 webpack 会带来配置复杂度、loader 生态依赖和构建速度损耗。

代价是无法打包 npm 依赖。V1 假设页面只依赖 `@app-module/*` 系统模块。V2 需要时应引入真实 bundler 替换这一层，而不是自己实现模块解析——那是重造 webpack。

### 2. 模块 ID 用字符串而非数字

官方产物用 webpack loader 的完整路径（debug）或数字（release）作为 ID。我们用 `"script"` / `"style"` / `"template"`。

可读性更好，且模块数量固定为三个，不需要 ID 压缩带来的体积收益。debug 产物里能一眼看出每个模块是什么。

### 3. 保留 `window` 检测结构

Runtime 环境没有 `window`，直接执行分支即可。保留 `else` 分支是为了产物形态与官方一致——便于用官方的浏览器预览工具做交叉验证，也便于将来接入 Web 预览。

代价是几行无用代码，可忽略。

### 4. `app.ux` 缺失时仍生成 `app.js`

Runtime 的启动序列固定 eval `app.js`。缺失时 `RPKLoader` 返回空字符串，`eval("")` 不报错但 `$app_define$('@app-application/app')` 永不调用。

framework.js 可能依赖应用注册（把 `onCreate` 挂到全局状态）。生成结构完整但内容为空的 `app.js` 消除这个不确定性。

### 5. `validateAppSFC` 与 `validatePageSFC` 分开

app 不要求 template，页面要求。这就是 Step 2 里 `app.ux` 走 `validatePageSFC` 会报错的正解——那条 error 是刻意留的待办提醒。

app.ux 里有 template/style 时产生 warning 而非报错：开发者可能从页面复制了模板，提示他们这部分不生效即可，不必阻止构建。

### 6. 单页面组装失败不影响其他页面

`assemblePageBundle` 抛错时捕获并记入 diagnostics，继续下一个页面。一次 build 报出所有页面的问题。

`app.js` 组装失败同样不中止——它可能只是 script 语法错误，其他页面仍可编译。最终 `hasError` 检查会阻止产出 RPK。

### 7. 有 error 时提前 return，不进入打包

这是 Property 8（编译失败不产出半成品）的前半部分。后半部分是 Step 9 的原子写入——两者结合保证 `dist/` 下永远不会出现残缺的 `.rpk`。

### 8. 诊断通过返回值传递，不用全局收集器

`assemblePageBundle` 返回 `{ code, diagnostics }`，调用方负责合并到 `ctx.diagnostics`。

全局收集器（如模块级数组）会让函数变成有状态的，测试时需要清理，并发编译时会串扰。返回值传递让组装函数保持纯函数特性。

### 9. `wrapAsModule` 只声明一个参数

`function (module) { module.exports = ... }` 而非三个参数。JS 允许函数接收比声明更多的实参，`__webpack_require__` 传三个，函数只用第一个。

与官方产物一致，且产物更简洁。

---

## QA

**Q：`runBundle` 测试辅助里用 `new Function` 而不是 `eval`，为什么？**

`eval` 在当前作用域执行，bundle 里的变量会污染测试文件的作用域，多个测试之间可能串扰。`new Function` 创建独立作用域，只能访问显式传入的参数和全局对象。

这也更接近 Runtime 的实际情况：QuickJS 的 `JS_Eval` 在全局作用域执行，但每个 Runtime 实例有独立的 JSContext，相当于独立作用域。

**Q：`$app_define$` 的 mock 里立即执行 factory，真实的 framework.js 也是这样吗？**

不一定。framework.js 可能延迟到 `$app_bootstrap$` 时才执行 factory——那样更符合「define 是注册，bootstrap 是启动」的语义。

测试里立即执行是为了简化断言。这个差异不影响产物正确性：无论何时执行 factory，其行为都一样（同步收集 exports）。

Step 11 的 Runtime 契约验收会用真实的 framework.js，届时能确认实际时序。

**Q：`packagerVersion` 有什么用？**

Runtime 可以据此做兼容性判断——比如某个版本的 toolkit 产出的 bundle 有已知问题，Runtime 可以警告或降级处理。

当前 Runtime 侧不读这个字段，但保留它与官方产物一致，且为将来的版本协商留了位置。

**Q：为什么 template 模块在最后，script 在最前？**

与官方产物的模块顺序一致。实际上顺序不影响功能——`__webpack_require__` 按 ID 查找，不依赖声明顺序。

保持一致是为了降低与官方产物 diff 的噪音，便于回归比对。

**Q：如果一个页面的 template 编译失败，产物里会有残缺的 bundle 吗？**

不会。`assemblePageBundle` 在三路编译中的任一路抛错时直接抛出，不会返回部分结果。调用方捕获后不往 `bundles` 里放任何内容。

**Q：`exports.private` 是必须的吗？如果 script 里没写 `private` 会怎样？**

不是必须的。framework.js 用 `comp.private || {}` 兜底（见 Android design.md 里的 framework.js 示例）。

没有 `private` 的页面就是无数据的静态页面，模板里不应有插值——如果有，函数属性求值时 `this.title` 得到 undefined，渲染出空文本。这是合理的降级行为，不需要编译期拦截。

**Q：bundle 里的缩进用了硬编码的空格数（`      `），不会很脆弱吗？**

会，但影响仅限可读性。缩进错乱不影响 JS 语义，产物仍能正确执行。

更优雅的做法是生成时不管缩进，最后用 prettier 格式化。但那会引入一个 20MB 依赖，只为了 debug 产物好看一点——收益不匹配。

release 模式走 Terser，缩进被完全去掉，这个问题不存在。

**Q：`PACKAGER_VERSION` 用 `require('../../package.json')` 读取，TypeScript 编译后路径还对吗？**

对。`dist/cli/cmd-build.js` 相对 `dist/cli/` 的 `../../package.json` 就是项目根的 `package.json`。

用 `require` 而非 `import`：`resolveJsonModule` 开启后 `import` 会把 JSON 内容编译进产物，且 `rootDir` 检查会报错（package.json 在 `src/` 之外）。

---

## 下一步

Step 9 实现 RPK Packager：手写 ZIP 写入器，把 manifest、bundles、assets 打包为标准 RPK，生成 build.txt，原子写入。
