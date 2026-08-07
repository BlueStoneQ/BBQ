# Step 1：CLI 骨架与项目扫描

## 目录

- [目标](#目标)
- [Step 1.1：初始化 Node 项目](#step-11初始化-node-项目)
- [Step 1.2：定义共享类型](#step-12定义共享类型)
- [Step 1.3：实现诊断输出](#step-13实现诊断输出)
- [Step 1.4：实现项目扫描](#step-14实现项目扫描)
- [Step 1.5：实现 CLI 入口](#step-15实现-cli-入口)
- [Step 1.6：逐层验证](#step-16逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**建立 CLI 命令入口和项目结构扫描能力，此时不做任何编译。**

| 模块 | 职责 | 文件 |
|---|---|---|
| 类型定义 | 贯穿管线的共享类型 | `src/types/index.ts` |
| 诊断 | 错误收集与终端格式化 | `src/diagnostics/diagnostic.ts` |
| 项目扫描 | 推导待编译文件列表 | `src/scanner/project-scanner.ts` |
| CLI | 命令注册与 argv 解析 | `src/cli/index.ts`、`cmd-build.ts` |
| 可执行入口 | shebang 脚本 | `bin/quickapp.js` |

**验收标准：**
- `quickapp build` 在示例项目下执行，输出待编译页面列表和资源列表
- `quickapp build --mode=release` 正确解析 mode
- 缺少 `src/` 目录时输出清晰错误并以退出码 1 退出

**本步不包含：**
- SFC 解析、模板/样式/脚本编译
- Manifest 验证（Step 3）
- Bundle 组装、RPK 打包
- watch 模式

---

## Step 1.1：初始化 Node 项目

```text
@add quickapp-toolkit/package.json（新建文件）
```

```json
{
  "name": "@quickapp-kit/toolkit",
  "version": "1.0.0",
  "description": "QuickApp CLI toolchain: .ux DSL -> RPK",
  "bin": {
    "quickapp": "./bin/quickapp.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "test": "node --test test/unit/*.test.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "htmlparser2": "9.1.0",
    "postcss": "8.4.38",
    "@babel/core": "7.24.5",
    "terser": "5.31.0"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "@types/node": "20.12.12"
  }
}
```

依赖版本全部固定，不用 `^`。工具链产物要能被 Runtime 稳定消费，依赖漂移会导致同一份源码在不同机器上编译出不同产物。

```text
@add quickapp-toolkit/tsconfig.json（新建文件）
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

`module` 用 CommonJS 而不是 ESM：CLI 需要 `require.resolve` 定位模板目录，ESM 下这条路径会复杂化，且 Node 的 ESM CLI 启动开销略高。

---

## Step 1.2：定义共享类型

```text
@add quickapp-toolkit/src/types/index.ts（新建文件）
```

```typescript
/**
 * 构建模式。
 * debug   保留完整变量名，config.debug = true
 * release Terser 压缩，config.debug = false
 */
export type BuildMode = 'debug' | 'release';

/**
 * 一个 .ux 文件中单个区块（template/style/script）的描述。
 */
export interface BlockDescriptor {
  /** 区块内的源码文本，不含包裹标签本身 */
  content: string;
  /**
   * 区块起始行号（1-based，指向 <template> 标签所在行的下一行）。
   * 编译器报错时用它把区块相对行号换算为文件绝对行号。
   */
  startLine: number;
  /** lang 属性值，如 "less"；无该属性时为 null */
  lang: string | null;
}

/**
 * 一个 .ux 文件解析后的中间表示。
 * 三个区块保持原始文本，由各自编译器处理。
 */
export interface SFCDescriptor {
  /** 源文件绝对路径，用于错误定位 */
  filename: string;
  template: BlockDescriptor | null;
  style: BlockDescriptor | null;
  script: BlockDescriptor | null;
}

/**
 * 诊断信息严重级别。
 * error   阻止产出 RPK
 * warning 记录但不阻止构建
 */
export type Severity = 'error' | 'warning';

/**
 * 一条编译诊断。所有编译阶段的错误都归一到这个结构。
 */
export interface Diagnostic {
  severity: Severity;
  /** 出错文件绝对路径 */
  file: string;
  /** 文件绝对行号（1-based）；无法定位时为 0 */
  line: number;
  /** 列号（1-based）；无法定位时为 0 */
  column: number;
  /** 面向用户的错误描述，不包含堆栈 */
  message: string;
}

/**
 * 一个待编译页面的定位信息。
 */
export interface PageEntry {
  /** manifest.router.pages 的 key，如 "pages/Demo" */
  routePath: string;
  /** 源文件绝对路径，如 /proj/src/pages/Demo/index.ux */
  sourcePath: string;
  /** RPK 内的产物路径，如 "pages/Demo/index.js" */
  outputPath: string;
}

/**
 * 一个静态资源的定位信息。
 */
export interface AssetEntry {
  /** RPK 内路径，如 "assets/images/logo.png" */
  outputPath: string;
  /** 源文件绝对路径 */
  sourcePath: string;
}

/**
 * 项目扫描结果。
 */
export interface FileTree {
  /** manifest.json 绝对路径 */
  manifestPath: string;
  /** app.ux 绝对路径；项目未提供时为 null */
  appPath: string | null;
  /** 待编译页面列表，顺序与 manifest.router.pages 声明顺序一致 */
  pages: PageEntry[];
  /** 静态资源列表 */
  assets: AssetEntry[];
}

/**
 * 贯穿整条编译管线的上下文。
 * 各组件从这里读配置，不重复读文件系统。
 */
export interface BuildContext {
  /** 项目根目录绝对路径 */
  projectRoot: string;
  /** 源码目录绝对路径，默认 <projectRoot>/src */
  srcDir: string;
  /** 产物目录绝对路径，默认 <projectRoot>/dist */
  distDir: string;
  mode: BuildMode;
  /** 累积的诊断信息；构建结束时统一输出 */
  diagnostics: Diagnostic[];
}
```

`BuildContext.diagnostics` 是可变数组，各阶段往里 push。这样一次 build 能收集所有页面的错误后统一输出，而不是在第一个错误处退出——开发者一次就能看到全部问题。

---

## Step 1.3：实现诊断输出

```text
@add quickapp-toolkit/src/diagnostics/errors.ts（新建文件）
```

```typescript
/**
 * 编译错误基类。
 * 所有阶段的错误都带文件路径和行号，保证能定位到源码。
 */
export class CompileError extends Error {
  /**
   * @param message 面向用户的错误描述
   * @param file    出错文件绝对路径
   * @param line    文件绝对行号（1-based）；未知时传 0
   * @param column  列号（1-based）；未知时传 0
   */
  constructor(
    message: string,
    public readonly file: string,
    public readonly line: number = 0,
    public readonly column: number = 0
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** .ux 文件三段式拆分失败 */
export class SFCParseError extends CompileError {}

/** 模板 XML 解析或转换失败 */
export class TemplateCompileError extends CompileError {}

/** 样式 CSS 解析失败 */
export class StyleCompileError extends CompileError {}

/** 脚本 JS 解析或转换失败 */
export class ScriptCompileError extends CompileError {}

/** manifest.json 缺失字段或页面文件不存在 */
export class ManifestError extends CompileError {}

/** 项目结构不符合要求（缺 src、缺 manifest） */
export class ProjectError extends CompileError {}

/** RPK 打包阶段失败 */
export class PackageError extends CompileError {}
```

`this.name = new.target.name` 让子类实例的 `name` 自动是子类名，不用每个子类重复写构造函数。

```text
@add quickapp-toolkit/src/diagnostics/diagnostic.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Diagnostic, Severity } from '../types';
import { CompileError } from './errors';

/** ANSI 颜色码。TTY 环境外自动禁用，避免日志文件里出现乱码 */
const useColor = process.stdout.isTTY === true;
const RED = useColor ? '\x1b[31m' : '';
const YELLOW = useColor ? '\x1b[33m' : '';
const GRAY = useColor ? '\x1b[90m' : '';
const RESET = useColor ? '\x1b[0m' : '';

/**
 * 从 CompileError 构造一条 Diagnostic。
 * @param err      任意编译错误
 * @param severity 严重级别，默认 error
 */
export function fromError(err: CompileError, severity: Severity = 'error'): Diagnostic {
  return {
    severity,
    file: err.file,
    line: err.line,
    column: err.column,
    message: err.message,
  };
}

/**
 * 读取源文件中指定行附近的内容，用于诊断输出时展示代码片段。
 * @param file    源文件绝对路径
 * @param line    目标行号（1-based）
 * @param context 上下文行数，前后各取这么多行
 * @returns 行号到行内容的映射；文件读取失败时返回空 Map
 */
function readSnippet(file: string, line: number, context = 2): Map<number, string> {
  const result = new Map<number, string>();
  if (line <= 0) return result;
  let lines: string[];
  try {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    return result;
  }
  const from = Math.max(1, line - context);
  const to = Math.min(lines.length, line + context);
  for (let i = from; i <= to; i++) {
    result.set(i, lines[i - 1]);
  }
  return result;
}

/**
 * 将一条诊断格式化为多行终端输出。
 * @param diag        诊断信息
 * @param projectRoot 项目根目录，用于把绝对路径显示为相对路径
 * @returns 可直接打印的字符串，不含末尾换行
 */
export function formatDiagnostic(diag: Diagnostic, projectRoot: string): string {
  const color = diag.severity === 'error' ? RED : YELLOW;
  const label = diag.severity.toUpperCase();
  const relFile = path.relative(projectRoot, diag.file) || diag.file;

  const loc = diag.line > 0
    ? `${relFile}:${diag.line}${diag.column > 0 ? ':' + diag.column : ''}`
    : relFile;

  const head = `${color}${label}${RESET}  ${loc}`;
  const body = `  ${diag.message}`;

  const snippet = readSnippet(diag.file, diag.line);
  if (snippet.size === 0) {
    return `${head}\n${body}`;
  }

  // 行号右对齐宽度，保证代码片段竖线对齐
  const width = String(Math.max(...snippet.keys())).length;
  const snippetLines: string[] = [];
  for (const [num, text] of snippet) {
    const gutter = String(num).padStart(width);
    snippetLines.push(`  ${GRAY}${gutter} |${RESET} ${text}`);
    if (num === diag.line && diag.column > 0) {
      const pad = ' '.repeat(width) + ' | ' + ' '.repeat(diag.column - 1);
      snippetLines.push(`  ${pad}${color}^${RESET}`);
    }
  }

  return `${head}\n${body}\n\n${snippetLines.join('\n')}`;
}

/**
 * 输出全部诊断并返回是否存在 error。
 * @param diagnostics 累积的诊断列表
 * @param projectRoot 项目根目录
 * @returns true 表示存在 error 级别诊断，调用方应以非零码退出
 */
export function reportDiagnostics(diagnostics: Diagnostic[], projectRoot: string): boolean {
  if (diagnostics.length === 0) return false;

  for (const diag of diagnostics) {
    console.error(formatDiagnostic(diag, projectRoot));
    console.error('');
  }

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;

  if (errors > 0) {
    console.error(`${RED}编译失败${RESET}：${errors} 个错误，${warnings} 个警告`);
    return true;
  }
  console.error(`${YELLOW}编译完成${RESET}：${warnings} 个警告`);
  return false;
}
```

诊断输出走 `stderr` 而不是 `stdout`：这样 `quickapp build > out.txt` 只捕获产物信息，错误仍然直接可见。

---

## Step 1.4：实现项目扫描

扫描的核心问题：**待编译页面列表从哪来？**

两种可选策略：

| 策略 | 做法 | 问题 |
|---|---|---|
| 目录遍历 | 递归找所有 `.ux` 文件 | 会编译 manifest 未声明的页面，产物里出现死代码 |
| manifest 驱动 | 从 `router.pages` 的 key 推导 | 需要先读 manifest，但这是应有的约束 |

选 manifest 驱动。理由：`router.pages` 是 Runtime 唯一的路由来源，未声明的页面永远不可达，编译它没有意义。这也让「新增页面忘记注册路由」在编译期就暴露——不注册就不编译，开发者立刻发现。

```text
@add quickapp-toolkit/src/scanner/project-scanner.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileTree, PageEntry, AssetEntry } from '../types';
import { ProjectError } from '../diagnostics/errors';

/** 资源目录名，固定为 assets，与 manifest 中的资源路径约定一致 */
const ASSETS_DIR = 'assets';

/**
 * 递归收集目录下所有文件。
 * @param dir     待遍历的绝对路径目录；不存在时返回空数组
 * @param baseDir 计算相对路径的基准目录
 * @returns 每项包含 RPK 内路径和源文件绝对路径
 */
function collectFiles(dir: string, baseDir: string): AssetEntry[] {
  if (!fs.existsSync(dir)) return [];

  const result: AssetEntry[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        // ZIP 条目路径必须用正斜杠，Windows 上 path.relative 返回反斜杠
        const rel = path.relative(baseDir, full).split(path.sep).join('/');
        result.push({ outputPath: rel, sourcePath: full });
      }
    }
  }

  return result;
}

/**
 * 读取 manifest.json 中的路由页面 key 列表。
 * 这一步只做 JSON 解析和 router.pages 提取，完整字段校验在 Step 3 的
 * ManifestProcessor 中完成。扫描阶段只需要知道"要编译哪些页面"。
 *
 * @param manifestPath manifest.json 绝对路径
 * @returns [routePath, componentName] 元组数组，顺序保持声明顺序
 * @throws ProjectError manifest 无法读取、JSON 非法或 router.pages 缺失
 */
function readRoutePages(manifestPath: string): Array<[string, string]> {
  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    throw new ProjectError('无法读取 manifest.json', manifestPath);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new ProjectError(
      `manifest.json 不是合法 JSON：${(e as Error).message}`,
      manifestPath
    );
  }

  const pages = (json as any)?.router?.pages;
  if (typeof pages !== 'object' || pages === null) {
    throw new ProjectError('manifest.json 缺少 router.pages 配置', manifestPath);
  }

  const result: Array<[string, string]> = [];
  for (const [routePath, config] of Object.entries(pages)) {
    // component 缺省为 "index"，与快应用官方约定一致
    const component = (config as any)?.component ?? 'index';
    result.push([routePath, String(component)]);
  }
  return result;
}

/**
 * 扫描项目结构，推导待编译文件列表。
 *
 * 页面列表由 manifest.router.pages 驱动，不做目录遍历：未声明路由的
 * 页面在 Runtime 中不可达，编译它只会产生死代码。
 *
 * @param projectRoot 项目根目录绝对路径
 * @param srcDir      源码目录绝对路径
 * @returns 完整的文件树
 * @throws ProjectError 源码目录缺失、manifest 缺失或声明的页面文件不存在
 */
export function scanProject(projectRoot: string, srcDir: string): FileTree {
  if (!fs.existsSync(srcDir)) {
    throw new ProjectError(
      `源码目录不存在：${path.relative(projectRoot, srcDir)}/`,
      srcDir
    );
  }

  const manifestPath = path.join(srcDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new ProjectError('缺少 manifest.json', manifestPath);
  }

  // app.ux 可选：纯页面项目可以没有应用级逻辑
  const appCandidate = path.join(srcDir, 'app.ux');
  const appPath = fs.existsSync(appCandidate) ? appCandidate : null;

  const pages: PageEntry[] = [];
  const missing: string[] = [];

  for (const [routePath, component] of readRoutePages(manifestPath)) {
    const sourcePath = path.join(srcDir, routePath, `${component}.ux`);
    if (!fs.existsSync(sourcePath)) {
      missing.push(path.relative(projectRoot, sourcePath));
      continue;
    }
    pages.push({
      routePath,
      sourcePath,
      outputPath: `${routePath}/${component}.js`,
    });
  }

  // 一次性报告所有缺失页面，避免开发者逐个试错
  if (missing.length > 0) {
    throw new ProjectError(
      `manifest.router.pages 声明的页面文件不存在：\n    ${missing.join('\n    ')}`,
      manifestPath
    );
  }

  const assets = collectFiles(path.join(srcDir, ASSETS_DIR), srcDir);

  return { manifestPath, appPath, pages, assets };
}
```

两个细节值得注意：

`collectFiles` 用显式栈而非递归。资源目录深度不可控，递归在极端嵌套下会栈溢出；显式栈没有这个上限。

路径分隔符统一转正斜杠。ZIP 格式规定条目路径用正斜杠，`path.relative` 在 Windows 上返回反斜杠。如果不转换，Windows 上打出的 RPK 在 Android 的 `RPKLoader` 里会因为条目名不匹配而找不到文件——这类问题只在特定平台出现，排查成本很高。

---

## Step 1.5：实现 CLI 入口

```text
@add quickapp-toolkit/src/cli/cmd-build.ts（新建文件）
```

```typescript
import * as path from 'node:path';
import type { BuildContext, BuildMode } from '../types';
import { scanProject } from '../scanner/project-scanner';
import { CompileError } from '../diagnostics/errors';
import { fromError, reportDiagnostics } from '../diagnostics/diagnostic';

export interface BuildOptions {
  /** 项目根目录，默认 process.cwd() */
  projectRoot: string;
  mode: BuildMode;
}

/**
 * 执行 build 命令。
 *
 * Step 1 仅完成扫描并打印结果；编译与打包在后续 Step 接入。
 *
 * @param options 构建选项
 * @returns 进程退出码：0 成功，1 存在 error 级别诊断
 */
export function runBuild(options: BuildOptions): number {
  const { projectRoot, mode } = options;

  const ctx: BuildContext = {
    projectRoot,
    srcDir: path.join(projectRoot, 'src'),
    distDir: path.join(projectRoot, 'dist'),
    mode,
    diagnostics: [],
  };

  let tree;
  try {
    tree = scanProject(ctx.projectRoot, ctx.srcDir);
  } catch (e) {
    // 项目结构错误是致命的，无法继续扫描其他内容
    if (e instanceof CompileError) {
      ctx.diagnostics.push(fromError(e));
      reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
      return 1;
    }
    throw e;
  }

  console.log(`模式：${mode}`);
  console.log(`源码：${path.relative(projectRoot, ctx.srcDir)}/`);
  console.log('');

  console.log(`待编译页面（${tree.pages.length}）：`);
  for (const page of tree.pages) {
    console.log(`  ${page.routePath}  ->  ${page.outputPath}`);
  }
  console.log('');

  console.log(`应用入口：${tree.appPath ? 'app.ux' : '（未提供）'}`);
  console.log('');

  console.log(`静态资源（${tree.assets.length}）：`);
  for (const asset of tree.assets) {
    console.log(`  ${asset.outputPath}`);
  }
  console.log('');

  // Step 2 起在此接入 SFC 解析与编译管线
  console.log('扫描完成。编译管线尚未接入（Step 2 起实现）。');

  const hasError = reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
  return hasError ? 1 : 0;
}
```

```text
@add quickapp-toolkit/src/cli/index.ts（新建文件）
```

```typescript
import * as path from 'node:path';
import type { BuildMode } from '../types';
import { runBuild } from './cmd-build';

const USAGE = `
用法：quickapp <command> [options]

命令：
  build              编译项目并打包为 RPK
  watch              监听变更并增量编译（Step 12 实现）
  init <name>        创建项目骨架（Step 13 实现）

选项：
  --mode=<mode>      构建模式：debug（默认）| release
  --root=<path>      项目根目录，默认当前目录
  -h, --help         显示帮助
  -v, --version      显示版本
`.trim();

interface ParsedArgs {
  command: string | null;
  positional: string[];
  flags: Map<string, string | boolean>;
}

/**
 * 解析命令行参数。
 *
 * 手写解析而非引入 commander/yargs：命令和选项都很少，
 * 手写约 30 行即可，避免为此增加依赖体积和启动开销。
 *
 * @param argv process.argv.slice(2) 的结果
 * @returns 命令名、位置参数和选项映射
 */
function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq >= 0) {
        flags.set(body.slice(0, eq), body.slice(eq + 1));
      } else {
        flags.set(body, true);
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      // 短选项：-h、-v
      flags.set(arg.slice(1), true);
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional.length > 0 ? positional[0] : null,
    positional: positional.slice(1),
    flags,
  };
}

/**
 * 从选项中解析构建模式。
 * @param flags 选项映射
 * @returns 构建模式
 * @throws Error mode 取值非法时
 */
function resolveMode(flags: Map<string, string | boolean>): BuildMode {
  const raw = flags.get('mode');
  if (raw === undefined) return 'debug';
  if (raw === 'debug' || raw === 'release') return raw;
  throw new Error(`--mode 取值非法："${String(raw)}"，应为 debug 或 release`);
}

/**
 * 从选项中解析项目根目录。
 * @param flags 选项映射
 * @returns 绝对路径
 */
function resolveRoot(flags: Map<string, string | boolean>): string {
  const raw = flags.get('root');
  if (typeof raw === 'string') return path.resolve(raw);
  return process.cwd();
}

/**
 * CLI 主入口。
 * @param argv process.argv.slice(2)
 * @returns 进程退出码
 */
export function main(argv: string[]): number {
  const { command, flags } = parseArgs(argv);

  if (flags.has('h') || flags.has('help') || command === null) {
    console.log(USAGE);
    return command === null ? 1 : 0;
  }

  if (flags.has('v') || flags.has('version')) {
    // require 而非 import：避免把 package.json 编译进 dist
    const pkg = require('../../package.json');
    console.log(pkg.version);
    return 0;
  }

  try {
    switch (command) {
      case 'build':
        return runBuild({ projectRoot: resolveRoot(flags), mode: resolveMode(flags) });

      case 'watch':
        console.error('watch 命令尚未实现（Step 12）');
        return 1;

      case 'init':
        console.error('init 命令尚未实现（Step 13）');
        return 1;

      default:
        console.error(`未知命令："${command}"\n`);
        console.error(USAGE);
        return 1;
    }
  } catch (e) {
    console.error(`${(e as Error).message}`);
    return 1;
  }
}
```

```text
@add quickapp-toolkit/bin/quickapp.js（新建文件）
```

```javascript
#!/usr/bin/env node
'use strict';

// 入口只做一件事：调用编译后的 main 并用其返回值作为退出码。
// 把退出码决策放在 main 里而不是这里，是为了让 main 可被测试直接调用。
const { main } = require('../dist/cli/index.js');
process.exit(main(process.argv.slice(2)));
```

`main` 返回退出码而不是自己调 `process.exit`：这样单元测试可以直接调用 `main(['build'])` 并断言返回值，不会把测试进程一起杀掉。

---

## Step 1.6：逐层验证

### 1.6.1：编译验证

```bash
cd quickapp-toolkit
npm install
npm run build
```

**预期输出：** 无错误，生成 `dist/` 目录，包含 `cli/index.js`、`scanner/project-scanner.js`、`diagnostics/*.js`、`types/index.js` 及对应 `.d.ts`。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `Cannot find module 'node:fs'` | `@types/node` 未安装或版本过低 | 确认 devDependencies 已装，Node ≥ 18 |
| `TS2564: Property has no initializer` | `strict` 下类属性未初始化 | 给属性加初值或 `!` 断言 |
| `TS6059: rootDir` 相关 | 有文件在 `src/` 之外被引用 | 确认 `bin/` 不在 `include` 里 |

### 1.6.2：CLI 可执行验证

```bash
npm link
quickapp --help
```

**预期输出：** 打印 USAGE 文本，退出码 0。

```bash
quickapp --version
```

**预期输出：** `1.0.0`

如果 `quickapp: command not found`，改用直接调用验证：

```bash
node ./bin/quickapp.js --help
```

### 1.6.3：扫描验证

用示例项目验证。示例项目结构：

```text
quickapp-examples/quickapp-code-test1/
├── src/
│   ├── manifest.json
│   ├── app.ux
│   ├── pages/
│   │   ├── Demo/index.ux
│   │   └── DemoDetail/index.ux
│   └── assets/images/logo.png
```

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1
```

**预期输出：**

```text
模式：debug
源码：src/

待编译页面（2）：
  pages/Demo  ->  pages/Demo/index.js
  pages/DemoDetail  ->  pages/DemoDetail/index.js

应用入口：app.ux

静态资源（1）：
  assets/images/logo.png

扫描完成。编译管线尚未接入（Step 2 起实现）。
```

**验证点：**
- 页面顺序与 manifest 中 `router.pages` 的声明顺序一致
- `outputPath` 用正斜杠
- 资源路径相对于 `srcDir`，不含 `src/` 前缀

### 1.6.4：mode 解析验证

```bash
quickapp build --root=<示例项目> --mode=release
```

**预期输出：** 首行为 `模式：release`

```bash
quickapp build --root=<示例项目> --mode=prod
```

**预期输出：**

```text
--mode 取值非法："prod"，应为 debug 或 release
```

退出码 1。

### 1.6.5：错误路径验证

**缺少 src 目录：**

```bash
mkdir -p /tmp/empty-proj && quickapp build --root=/tmp/empty-proj
```

**预期输出：**

```text
ERROR  src
  源码目录不存在：src/

编译失败：1 个错误，0 个警告
```

退出码 1。

**缺少 manifest.json：**

```bash
mkdir -p /tmp/no-manifest/src && quickapp build --root=/tmp/no-manifest
```

**预期输出：**

```text
ERROR  src/manifest.json
  缺少 manifest.json

编译失败：1 个错误，0 个警告
```

**manifest 声明的页面不存在：** 在示例项目的 manifest 里临时加一个 `"pages/NotExist": { "component": "index" }`：

**预期输出：**

```text
ERROR  src/manifest.json
  manifest.router.pages 声明的页面文件不存在：
    src/pages/NotExist/index.ux
```

验证点：所有缺失页面一次性列出，不是报第一个就退出。

### 1.6.6：退出码验证

```bash
quickapp build --root=<示例项目>; echo "exit=$?"
```

**预期：** `exit=0`

```bash
quickapp build --root=/tmp/empty-proj; echo "exit=$?"
```

**预期：** `exit=1`

退出码正确是 CI 集成的前提。如果失败时返回 0，构建流水线不会中断，坏产物会流到下游。

---

## 技术决策

### 1. 页面列表由 manifest 驱动，不做目录遍历

`router.pages` 是 Runtime 唯一的路由来源，未声明的页面在 Runtime 中永远不可达。编译它们只会让 RPK 里多出死代码。

副作用是正面的：新增页面忘记注册路由时，编译期就不会产出该页面，开发者立刻察觉。如果走目录遍历，页面会被编译进包但运行时无法访问，问题被推迟到运行阶段。

### 2. 手写 argv 解析，不引入 commander

命令只有三个（build/watch/init），选项只有三个（mode/root/help）。手写约 30 行覆盖全部需求，而 commander 会带来约 200KB 依赖和额外的启动开销。

如果后续命令数量增长到十个以上，或需要子命令嵌套、交互式提示，再引入成熟库。当前规模下手写是更合适的选择。

### 3. 依赖版本全部固定

工具链的产物要被三端 Runtime 稳定消费。`htmlparser2` 或 `postcss` 的一个小版本变更就可能改变模板树或样式对象的细节结构，导致同一份源码在不同机器上编译出行为不同的产物。

这类问题的排查路径很长：现象出现在 Runtime 侧，根因在 toolkit 的间接依赖里。固定版本把这个风险消除在源头。

### 4. main 返回退出码而不是自己 exit

`process.exit` 写在 `main` 里会让单元测试无法调用它——测试进程会被一起杀掉。返回退出码让 `bin/quickapp.js` 承担唯一的 exit 责任，`main` 保持纯函数特性可测。

### 5. 诊断走 stderr，产物信息走 stdout

`quickapp build > build.log` 时，产物路径和大小进日志文件，错误仍然直接显示在终端。这是 CLI 工具的常规约定，也让 CI 的日志分组更清晰。

### 6. 诊断累积后统一输出

`BuildContext.diagnostics` 是可变数组，各阶段往里 push，构建结束时统一 report。开发者一次 build 就能看到所有页面的全部问题，不需要「修一个、重跑、再修一个」。

例外是项目结构错误（缺 src、缺 manifest）：这类错误让后续扫描无法进行，只能立即中止。

### 7. 路径分隔符在扫描阶段就统一为正斜杠

ZIP 格式规定条目路径用正斜杠。如果把转换推迟到打包阶段，中间所有环节都要记得处理这件事。在产生路径的唯一入口（`collectFiles`）就转换，后续环节无需关心。

---

## QA

**Q：为什么 `app.ux` 是可选的？**

纯页面项目不需要应用级逻辑。快应用的 `app.ux` 主要用途是注册全局变量和 `onCreate` 生命周期，这两者都不是必需的。缺失时 `appPath` 为 null，后续 Step 会生成一个最小的 `app.js`（只有 `$app_define$` + `$app_bootstrap$`，无业务逻辑），保证 Runtime 的启动序列完整。

**Q：`component` 缺省为 `index` 是哪里的约定？**

快应用官方约定。`manifest.router.pages` 的每一项可以写 `{ "component": "index" }`，省略时默认就是 `index`。示例项目的两个页面都显式写了 `component`，但省略同样合法，所以扫描器要处理这个缺省。

**Q：为什么 `readRoutePages` 只做部分校验，不做完整的 manifest 验证？**

职责分离。扫描阶段只需要回答「要编译哪些文件」，为此只需 `router.pages`。完整校验（必填字段、features 格式、display 配置）是 Step 3 `ManifestProcessor` 的职责。

如果在扫描阶段做完整校验，Step 3 就变成重复工作，且两处校验逻辑容易不一致。

**Q：`collectFiles` 为什么不过滤文件类型？**

`assets/` 下的所有文件都应该进 RPK，包括开发者放的字体、JSON 数据、音频等。过滤会导致「我放了文件但包里没有」这类问题，且过滤白名单永远不完整。

需要排除的是 `.DS_Store` 这类系统文件，但那属于打包阶段的过滤职责（Step 9），不在扫描阶段处理——扫描的结果应该忠实反映目录内容。

**Q：TypeScript 的 `strict` 模式下，`(json as any)?.router?.pages` 这种写法是否可以避免？**

可以，代价是引入 JSON schema 校验库或写完整的类型守卫。但这里的输入是用户提供的任意 JSON，任何类型断言最终都要落到运行时检查。`as any` + 显式运行时判断（`typeof pages !== 'object'`）已经保证了安全性，且代码更短。

Step 3 的 `ManifestProcessor` 会定义完整的 `Manifest` 类型和逐字段校验，那里才需要严格的类型建模。

**Q：为什么 `-h` 和 `--help` 在 `command === null` 时返回 1？**

无参数调用 `quickapp` 时打印帮助并返回 1，是 CLI 的常规行为：用户没有表达有效意图，属于用法错误。显式 `quickapp --help` 是有效意图，返回 0。

这个区别影响 CI：脚本里误写了 `quickapp`（漏了子命令）时应该失败，而不是静默通过。

---

## 下一步

Step 2 实现 SFC Parser：把 `.ux` 文件拆分为 template/style/script 三个带行号的区块，为三路编译器准备输入。
