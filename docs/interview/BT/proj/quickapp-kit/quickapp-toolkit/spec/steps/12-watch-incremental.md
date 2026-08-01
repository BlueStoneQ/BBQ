# Step 12：Watch 模式与增量编译

## 目录

- [目标](#目标)
- [Step 12.1：增量边界](#step-121增量边界)
- [Step 12.2：抽取可复用的编译单元](#step-122抽取可复用的编译单元)
- [Step 12.3：实现文件监听](#step-123实现文件监听)
- [Step 12.4：实现增量调度](#step-124实现增量调度)
- [Step 12.5：接入 CLI](#step-125接入-cli)
- [Step 12.6：单元测试](#step-126单元测试)
- [Step 12.7：逐层验证](#step-127逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**文件变更后只重编译受影响的页面，缩短开发反馈循环。**

| 变更文件 | 重编译范围 |
|---|---|
| `pages/X/index.ux` | 仅该页面 bundle |
| `app.ux` | 仅 app.js |
| `manifest.json` | 全量（路由表和全局配置变了） |
| `assets/**` | 无需编译，仅重新打包 |

**验收标准：**
- 修改单页面后，输出只显示该页面重编译，耗时明显低于全量
- 增量产出的 bundle 与全量 build 的该页面产物**字节一致**（Property 6）
- 编译错误不终止 watch 进程
- `manifest.json` 变更触发全量重建
- Ctrl-C 能干净退出，不留临时文件

**本步不包含：**
- HMR（热替换）—— 需要 Runtime 侧配合，V1 不做
- 增量打包（RPK 仍整体重写，见技术决策）
- 编译结果的磁盘缓存（进程内缓存即可）
- release 模式的 watch（开发时不需要压缩）

---

## Step 12.1：增量边界

### 为什么页面粒度是天然边界

页面之间没有编译期依赖。回顾编译管线：

```text
pages/Demo/index.ux
    → SFCParser        只读这一个文件
    → 三路编译          template / style / script 都是页面私有
    → BundleAssembler  只用这三路产物
    → pages/Demo/index.js
```

整条链路里没有任何一步需要读其他页面的内容。这意味着不需要依赖图分析——改哪个页面就重编译哪个页面。

对比一下需要依赖图的场景：如果支持自定义组件（`<import>`），页面 A 引用了组件 C，改 C 就要重编译 A。V1 不支持自定义组件（HANDOFF 的「V1 明确不支持」），所以这个复杂度不存在。

**这条性质会在支持自定义组件时失效。** 届时需要维护「组件 → 引用它的页面」的反向索引，或退化为全量重建。

### manifest 变更为什么触发全量

`manifest.json` 影响三件事：

```text
router.pages   决定编译哪些页面 —— 可能新增或删除页面
display        影响 TitleBar 渲染 —— 但不影响 bundle 内容
config.debug   由 mode 注入，源文件的值被覆盖
```

其中 `router.pages` 的变更会改变编译目标集合。新增页面要编译，删除页面要从产物里移除。判断「变了哪些」需要对比新旧路由表，逻辑不比全量重建简单，而全量重建在示例规模下只需几百毫秒。

`display` 变更虽然不影响 bundle，但要重新打包 RPK（manifest.json 是 RPK 里的一个条目）。既然要重新打包，顺便重新编译的额外成本很低。

### 增量的收益边界

```text
全量 build：扫描 + manifest 处理 + N 个页面编译 + 打包
增量 build：1 个页面编译 + 打包
```

打包步骤没法增量——RPK 是单个 ZIP 文件，改一个条目要重写整个文件。所以增量的收益上限是「省掉 N-1 个页面的编译时间」。

示例项目只有 2 个页面，单页编译约 30ms，收益约 30ms。页面数量到 20 个时，收益从 600ms 降到 30ms，才有明显体感。

**这不意味着小项目做增量没意义。** watch 模式的价值一半在增量、一半在「不用手动敲命令」——保存即编译的反馈循环本身就是收益。

---

## Step 12.2：抽取可复用的编译单元

当前 `runBuild` 把「扫描 → manifest → 编译 → 压缩 → 打包」揉在一个函数里。增量编译需要单独调用其中一部分，先做抽取。

抽取的目标是三个可独立调用的函数：

```text
compileOnePage    编译单个页面 -> bundle 代码
compileAppBundle  编译 app.js -> bundle 代码
packAll           用已有的 bundles 打包 -> RPK
```

```text
@add quickapp-toolkit/src/compiler/compile-unit.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import type { BuildContext, PageEntry, SFCDescriptor } from '../types';
import { parseSFC, validatePageSFC } from '../parser/sfc-parser';
import { assemblePageBundle, assembleAppBundle } from '../bundler/assembler';
import { CompileError } from '../diagnostics/errors';
import { fromError } from '../diagnostics/diagnostic';

/** 单个文件的编译结果 */
export interface CompileUnitResult {
  /** 成功时为 bundle 代码；失败时为 null */
  code: string | null;
  /** 本次编译产生的诊断，调用方负责合并到 ctx */
  diagnostics: BuildContext['diagnostics'];
}

/**
 * 读取并解析一个 .ux 文件。
 *
 * @param sourcePath .ux 文件绝对路径
 * @param isPage     true 时按页面校验（要求有 template）；app.ux 传 false
 * @param diagnostics 诊断收集数组，解析失败时追加
 * @returns 解析成功的描述符；失败时为 null
 */
function parseUx(
  sourcePath: string,
  isPage: boolean,
  diagnostics: BuildContext['diagnostics']
): SFCDescriptor | null {
  let source: string;
  try {
    source = fs.readFileSync(sourcePath, 'utf8');
  } catch (e) {
    diagnostics.push({
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
    if (isPage) validatePageSFC(descriptor);
    return descriptor;
  } catch (e) {
    if (e instanceof CompileError) {
      diagnostics.push(fromError(e));
      return null;
    }
    throw e;
  }
}
```

```text
@add quickapp-toolkit/src/compiler/compile-unit.ts — 在 parseUx 之后插入
```

```typescript
/**
 * 编译单个页面为 bundle 代码。
 *
 * 这是增量编译的最小单元。它不读其他页面、不读 manifest —— 页面
 * 之间没有编译期依赖，所以单页编译是自包含的。
 *
 * 编译失败时返回 code 为 null，诊断记入返回值。调用方决定是中止
 * 还是继续处理其他页面 —— 全量 build 时继续，watch 时保留上次的
 * 产物不变。
 *
 * @param page            页面定位信息（源路径 + 产物路径）
 * @param mode            构建模式，影响序列化紧凑度和注释保留
 * @param packagerVersion toolkit 版本，写入 bootstrap 的 options
 * @returns 编译结果；code 为 null 表示失败
 */
export function compileOnePage(
  page: PageEntry,
  mode: BuildContext['mode'],
  packagerVersion: string
): CompileUnitResult {
  const diagnostics: BuildContext['diagnostics'] = [];

  const descriptor = parseUx(page.sourcePath, true, diagnostics);
  if (descriptor === null) {
    return { code: null, diagnostics };
  }

  try {
    const result = assemblePageBundle(descriptor, mode, packagerVersion);
    diagnostics.push(...result.diagnostics);
    return { code: result.code, diagnostics };
  } catch (e) {
    if (e instanceof CompileError) {
      diagnostics.push(fromError(e));
      return { code: null, diagnostics };
    }
    throw e;
  }
}

/**
 * 编译 app.js。
 *
 * @param appPath         app.ux 绝对路径；null 表示项目未提供，
 *                        此时生成结构完整但内容为空的 app.js
 * @param mode            构建模式
 * @param packagerVersion toolkit 版本
 * @returns 编译结果；code 为 null 表示失败
 */
export function compileAppBundle(
  appPath: string | null,
  mode: BuildContext['mode'],
  packagerVersion: string
): CompileUnitResult {
  const diagnostics: BuildContext['diagnostics'] = [];

  const descriptor =
    appPath === null ? null : parseUx(appPath, false, diagnostics);

  // appPath 非 null 但解析失败时，descriptor 为 null —— 此时不应
  // 当作"项目没有 app.ux"处理，而应报错。用 diagnostics 长度判断
  if (appPath !== null && descriptor === null) {
    return { code: null, diagnostics };
  }

  try {
    const result = assembleAppBundle(descriptor, mode, packagerVersion);
    diagnostics.push(...result.diagnostics);
    return { code: result.code, diagnostics };
  } catch (e) {
    if (e instanceof CompileError) {
      diagnostics.push(fromError(e));
      return { code: null, diagnostics };
    }
    throw e;
  }
}
```

`compileAppBundle` 里那个 `appPath !== null && descriptor === null` 的判断值得注意。两种情况都会让 `descriptor` 为 null，但含义完全不同：

```text
appPath === null            项目没有 app.ux  -> 生成空 app.js（正常路径）
appPath !== null 但解析失败   app.ux 有语法错误 -> 应该报错
```

不区分的后果是：用户的 `app.ux` 写错了，编译器静默生成一个空的 app.js，全局变量和 `onCreate` 都丢了，而构建显示成功。

---

## Step 12.3：实现文件监听

### 为什么用 `fs.watch` 而不是 chokidar

| 维度 | `fs.watch`（Node 内置） | chokidar |
|---|---|---|
| 依赖 | 无 | 1 个包 + 依赖树 |
| 递归监听 | Node 20+ 支持 `recursive: true`（macOS/Windows 一直支持，Linux 从 20 起） | 全平台支持 |
| 事件去重 | 无，同一次保存可能触发多次 | 内置 |
| 原子保存 | 编辑器的「写临时文件再 rename」会报 rename 事件 | 内置处理 |

`package.json` 声明 `node >= 18`，而 Linux 上的 `recursive` 要 Node 20+。两种应对：要求 Node 20+，或自己实现递归（遍历子目录逐个 watch）。

选**自己实现递归**。理由是 `assets/` 下可能有嵌套目录，而 `src/` 的目录结构在开发过程中会变化（新增页面目录）。自己实现虽然要处理「新增目录时补上 watcher」，但不抬高 Node 版本要求。

事件去重和原子保存必须自己处理——这是 `fs.watch` 最主要的坑，见下面的实现。

```text
@add quickapp-toolkit/src/watch/watcher.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

/** 变更事件类型 */
export type ChangeKind = 'add' | 'change' | 'unlink';

/** 一次变更事件 */
export interface ChangeEvent {
  kind: ChangeKind;
  /** 变更文件的绝对路径 */
  file: string;
}

/** 监听器配置 */
export interface WatchOptions {
  /** 监听的根目录绝对路径 */
  root: string;
  /**
   * 防抖窗口（毫秒）。
   *
   * 必需的理由：一次编辑器保存通常触发 2-4 个 fs 事件（写入、
   * 元数据更新、临时文件 rename）。不防抖会导致同一次保存触发
   * 多轮编译，输出刷屏且浪费 CPU。
   *
   * 100ms 是经验值：足够合并同一次保存的事件，又不会让用户感到延迟。
   */
  debounceMs?: number;
  /** 变更回调，收到的是防抖后合并的事件列表 */
  onChange: (events: ChangeEvent[]) => void;
}

/** 应忽略的目录名 */
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.tmp']);

/** 应忽略的文件名 */
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/**
 * 判断路径是否应被忽略。
 * @param name 文件或目录名（不含路径）
 * @returns true 表示忽略
 */
function isIgnored(name: string): boolean {
  return IGNORED_DIRS.has(name) || IGNORED_FILES.has(name) || name.startsWith('.');
}
```

```text
@add quickapp-toolkit/src/watch/watcher.ts — 在 isIgnored 之后插入
```

```typescript
/**
 * 递归文件监听器。
 *
 * 自己实现递归而不用 fs.watch 的 recursive 选项：后者在 Linux 上
 * 需要 Node 20+，而 package.json 声明支持 Node 18。
 *
 * 生命周期：构造后调用 start() 开始监听，close() 停止并释放全部
 * watcher。start() 之后新增的子目录会被自动补上 watcher。
 */
export class RecursiveWatcher {
  private readonly root: string;
  private readonly debounceMs: number;
  private readonly onChange: (events: ChangeEvent[]) => void;

  /** 目录路径 -> 该目录的 FSWatcher */
  private watchers = new Map<string, fs.FSWatcher>();

  /** 防抖窗口内累积的事件，key 为 "kind:file" 用于去重 */
  private pending = new Map<string, ChangeEvent>();
  private timer: NodeJS.Timeout | null = null;
  private closed = false;

  /**
   * @param options 监听配置
   */
  constructor(options: WatchOptions) {
    this.root = options.root;
    this.debounceMs = options.debounceMs ?? 100;
    this.onChange = options.onChange;
  }

  /**
   * 开始监听。
   * @throws Error 根目录不存在
   */
  start(): void {
    if (!fs.existsSync(this.root)) {
      throw new Error(`监听目录不存在：${this.root}`);
    }
    this.watchDir(this.root);
  }

  /**
   * 停止监听并释放全部 watcher。
   *
   * 必须调用，否则 Node 进程不会退出 —— 活跃的 FSWatcher 会保持
   * 事件循环非空。
   */
  close(): void {
    this.closed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const w of this.watchers.values()) {
      w.close();
    }
    this.watchers.clear();
    this.pending.clear();
  }

  /** 当前监听的目录数，用于验证递归是否生效 */
  get watchedDirCount(): number {
    return this.watchers.size;
  }

  /**
   * 为一个目录建立 watcher，并递归处理其子目录。
   * @param dir 目录绝对路径
   */
  private watchDir(dir: string): void {
    if (this.closed || this.watchers.has(dir)) return;

    let watcher: fs.FSWatcher;
    try {
      watcher = fs.watch(dir, (eventType, filename) => {
        if (filename === null) return;
        this.handleRawEvent(dir, filename);
      });
    } catch {
      // 目录可能在建立 watcher 前被删除，忽略
      return;
    }

    // watcher 自身出错时（如目录被删）移除它，不让错误冒泡终止进程
    watcher.on('error', () => {
      this.watchers.delete(dir);
      watcher.close();
    });

    this.watchers.set(dir, watcher);

    // 递归子目录
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !isIgnored(entry.name)) {
        this.watchDir(path.join(dir, entry.name));
      }
    }
  }
}
```

事件处理是这个类最容易出错的部分，单独说明。

```text
@add quickapp-toolkit/src/watch/watcher.ts — 在 watchDir 之后插入（类内）
```

```typescript
  /**
   * 处理 fs.watch 的原始事件。
   *
   * fs.watch 的 eventType 只有 'rename' 和 'change' 两种，且语义
   * 与直觉不符：
   *   'rename' 既可能是新增、删除，也可能是编辑器的原子保存
   *   'change' 是内容修改
   *
   * 所以不能直接映射 eventType，要用 fs.existsSync 判断当前状态：
   *   文件存在 -> add 或 change（合并为 change，调用方不区分）
   *   文件不存在 -> unlink
   *
   * @param dir      事件所属目录的绝对路径
   * @param filename fs.watch 回调给出的文件名（相对 dir，不含路径）
   */
  private handleRawEvent(dir: string, filename: string): void {
    if (this.closed || isIgnored(filename)) return;

    const full = path.join(dir, filename);

    let stat: fs.Stats | null = null;
    try {
      stat = fs.statSync(full);
    } catch {
      // 不存在：删除，或原子保存的中间态
      stat = null;
    }

    if (stat !== null && stat.isDirectory()) {
      // 新增目录：补上 watcher，让其中的文件也被监听。
      // 不产生变更事件 —— 目录本身不参与编译，其中的文件会各自触发
      this.watchDir(full);
      return;
    }

    const kind: ChangeKind = stat === null ? 'unlink' : 'change';
    this.enqueue({ kind, file: full });
  }

  /**
   * 把事件加入防抖队列。
   *
   * 去重键用 "kind:file"：同一文件的多次 change 合并为一次，但
   * change 和 unlink 分别保留 —— 「改了又删」和「删了又改」的
   * 最终状态不同，都保留让调用方按顺序处理。
   *
   * @param event 变更事件
   */
  private enqueue(event: ChangeEvent): void {
    this.pending.set(`${event.kind}:${event.file}`, event);

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /**
   * 触发回调并清空队列。
   *
   * 回调抛出的异常在此捕获：watch 进程不能因为一次编译失败而退出。
   * 异常打印到 stderr 但不中止监听。
   */
  private flush(): void {
    this.timer = null;
    if (this.closed || this.pending.size === 0) return;

    const events = [...this.pending.values()];
    this.pending.clear();

    try {
      this.onChange(events);
    } catch (e) {
      console.error('变更处理出错：');
      console.error(e instanceof Error ? e.stack ?? e.message : String(e));
    }
  }
```

三个坑值得记录：

**`eventType` 不可信。** `fs.watch` 只给 `'rename'` 和 `'change'`，且编辑器的原子保存（写临时文件 → rename 覆盖）会报 `'rename'`。用 `fs.statSync` 判断当前状态才可靠。

**原子保存会产生一个瞬时的「文件不存在」窗口。** 如果在那个瞬间 `statSync`，会得到 `unlink`。防抖窗口在这里起了第二个作用：100ms 后再处理，此时 rename 已完成，文件存在。

**`onChange` 的异常必须捕获。** 编译错误在 `compileOnePage` 内部已转为诊断，但意外的异常（比如磁盘满导致打包失败）会冒泡到这里。不捕获会终止 watch 进程，用户以为还在监听但实际已经死了。

---

## Step 12.4：实现增量调度

调度器持有编译状态（已编译的 bundles、文件树、manifest），根据变更事件决定重编译范围。

```text
@add quickapp-toolkit/src/watch/incremental.ts（新建文件）
```

```typescript
import * as path from 'node:path';
import type { BuildContext, Diagnostic, FileTree } from '../types';
import type { Manifest } from '../manifest/schema';
import { scanProject } from '../scanner/project-scanner';
import { processManifest } from '../manifest/processor';
import { compileOnePage, compileAppBundle } from '../compiler/compile-unit';
import { packRPK } from '../packager/rpk-packager';
import { CompileError } from '../diagnostics/errors';
import { fromError } from '../diagnostics/diagnostic';
import type { ChangeEvent } from './watcher';

/** 一次增量编译的结果 */
export interface RebuildResult {
  /** 本次重编译的产物路径列表，如 ["pages/Demo/index.js"] */
  rebuilt: string[];
  /** true 表示走了全量重建 */
  full: boolean;
  /** 本次累积的诊断 */
  diagnostics: Diagnostic[];
  /** 打包是否成功；false 时 rpkPath 无效 */
  packed: boolean;
  /** 产出的 RPK 路径；packed 为 false 时为 null */
  rpkPath: string | null;
  /** 本次耗时（毫秒） */
  elapsedMs: number;
}

/**
 * 增量编译调度器。
 *
 * 持有跨次编译的状态：已编译的 bundles、文件树、manifest。
 * 变更到来时只重编译受影响的部分，然后整体重新打包 —— RPK 是
 * 单个 ZIP，无法增量写入。
 *
 * 状态一致性由 rebuildAll 保证：任何影响编译目标集合的变更
 * （manifest 修改、页面新增删除）都走全量，避免状态与磁盘脱节。
 */
export class IncrementalBuilder {
  private readonly ctx: BuildContext;
  private readonly packagerVersion: string;

  /** 产物路径 -> bundle 代码。增量编译时只更新其中的一项 */
  private bundles = new Map<string, string>();
  private tree: FileTree | null = null;
  private manifest: Manifest | null = null;

  /**
   * @param ctx             构建上下文；diagnostics 每次编译前会被清空
   * @param packagerVersion toolkit 版本
   */
  constructor(ctx: BuildContext, packagerVersion: string) {
    this.ctx = ctx;
    this.packagerVersion = packagerVersion;
  }

  /** 当前已编译的 bundle 数量，用于验证增量是否保留了其他页面 */
  get bundleCount(): number {
    return this.bundles.size;
  }
}
```

```text
@add quickapp-toolkit/src/watch/incremental.ts — 在 bundleCount getter 之后插入（类内）
```

```typescript
  /**
   * 全量重建：重新扫描、重新校验 manifest、重新编译全部页面。
   *
   * 触发条件：首次构建、manifest 变更、页面文件新增或删除。
   * 共同点是「编译目标集合可能变了」，此时增量无法保证状态正确。
   *
   * @returns 重建结果
   */
  rebuildAll(): RebuildResult {
    const start = Date.now();
    this.ctx.diagnostics = [];
    this.bundles.clear();

    // 扫描与 manifest 校验失败时无法继续 —— 路由表不可用
    try {
      this.tree = scanProject(this.ctx.projectRoot, this.ctx.srcDir);
      this.manifest = processManifest(this.ctx.srcDir, this.ctx.mode);
    } catch (e) {
      if (e instanceof CompileError) {
        this.ctx.diagnostics.push(fromError(e));
        return this.fail(start, true);
      }
      throw e;
    }

    const rebuilt: string[] = [];

    const app = compileAppBundle(
      this.tree.appPath,
      this.ctx.mode,
      this.packagerVersion
    );
    this.ctx.diagnostics.push(...app.diagnostics);
    if (app.code !== null) {
      this.bundles.set('app.js', app.code);
      rebuilt.push('app.js');
    }

    for (const page of this.tree.pages) {
      const result = compileOnePage(page, this.ctx.mode, this.packagerVersion);
      this.ctx.diagnostics.push(...result.diagnostics);
      if (result.code !== null) {
        this.bundles.set(page.outputPath, result.code);
        rebuilt.push(page.outputPath);
      }
    }

    return this.finish(start, rebuilt, true);
  }

  /**
   * 处理一批变更事件。
   *
   * 分类规则见 Step 12.1 的增量边界表。判断顺序有讲究：先看是否
   * 需要全量，需要就直接全量，不再逐个处理页面 —— 全量已经覆盖了
   * 所有页面。
   *
   * @param events 防抖后合并的变更事件
   * @returns 重建结果
   */
  rebuild(events: ChangeEvent[]): RebuildResult {
    if (this.tree === null || this.manifest === null) {
      // 首次构建失败过，状态不完整，只能全量
      return this.rebuildAll();
    }

    if (this.needsFullRebuild(events)) {
      return this.rebuildAll();
    }

    const start = Date.now();
    this.ctx.diagnostics = [];

    const rebuilt: string[] = [];
    const touchedPages = new Set<string>();
    let appTouched = false;
    let assetsOnly = true;

    for (const event of events) {
      const page = this.findPage(event.file);
      if (page !== null) {
        touchedPages.add(page.routePath);
        assetsOnly = false;
        continue;
      }
      if (this.tree.appPath !== null && event.file === this.tree.appPath) {
        appTouched = true;
        assetsOnly = false;
      }
    }

    if (appTouched) {
      const app = compileAppBundle(
        this.tree.appPath,
        this.ctx.mode,
        this.packagerVersion
      );
      this.ctx.diagnostics.push(...app.diagnostics);
      // 编译失败时保留上次的产物：让开发者仍能运行上一个可用版本，
      // 而不是产出一个缺少 app.js 的包
      if (app.code !== null) {
        this.bundles.set('app.js', app.code);
        rebuilt.push('app.js');
      }
    }

    for (const routePath of touchedPages) {
      const page = this.tree.pages.find((p) => p.routePath === routePath);
      if (page === undefined) continue;

      const result = compileOnePage(page, this.ctx.mode, this.packagerVersion);
      this.ctx.diagnostics.push(...result.diagnostics);
      if (result.code !== null) {
        this.bundles.set(page.outputPath, result.code);
        rebuilt.push(page.outputPath);
      }
    }

    // 只有资源变更时也要重新打包 —— 资源是 RPK 的条目
    if (assetsOnly) {
      // 重新扫描资源列表：可能有新增或删除的文件
      try {
        this.tree = scanProject(this.ctx.projectRoot, this.ctx.srcDir);
      } catch (e) {
        if (e instanceof CompileError) {
          this.ctx.diagnostics.push(fromError(e));
          return this.fail(start, false);
        }
        throw e;
      }
    }

    return this.finish(start, rebuilt, false);
  }
```

```text
@add quickapp-toolkit/src/watch/incremental.ts — 在 rebuild 之后插入（类内）
```

```typescript
  /**
   * 判断是否需要全量重建。
   *
   * 三种情况需要全量：
   *   manifest.json 变更     路由表和全局配置可能变了
   *   .ux 文件新增或删除     编译目标集合变了
   *   未知路径的 .ux 变更     可能是新页面，但 manifest 未声明
   *
   * 第三种情况的处理值得说明：新建了 pages/New/index.ux 但还没在
   * manifest 里注册路由时，走全量会让 scanProject 忽略它（页面列表
   * 由 manifest 驱动），最终产物不含该页面 —— 这是正确行为，
   * 且开发者在下一步注册路由时会再次触发全量。
   *
   * @param events 变更事件列表
   * @returns true 表示需要全量重建
   */
  private needsFullRebuild(events: ChangeEvent[]): boolean {
    const manifestPath = path.join(this.ctx.srcDir, 'manifest.json');

    for (const event of events) {
      if (event.file === manifestPath) return true;

      if (event.file.endsWith('.ux')) {
        // 删除：编译目标可能减少
        if (event.kind === 'unlink') return true;
        // 新增或修改了不在已知页面列表里的 .ux
        if (this.findPage(event.file) === null && event.file !== this.tree?.appPath) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 按源文件路径查找对应的页面条目。
   * @param file 变更文件的绝对路径
   * @returns 匹配的页面；不是已知页面时返回 null
   */
  private findPage(file: string) {
    if (this.tree === null) return null;
    return this.tree.pages.find((p) => p.sourcePath === file) ?? null;
  }

  /**
   * 打包并组装结果。
   *
   * 存在 error 级别诊断时跳过打包 —— 与全量 build 的行为一致
   * （Step 8 的「有 error 时提前 return，不进入打包」）。
   *
   * @param start   本次编译的起始时间戳
   * @param rebuilt 重编译的产物路径列表
   * @param full    是否为全量重建
   * @returns 重建结果
   */
  private finish(start: number, rebuilt: string[], full: boolean): RebuildResult {
    const hasError = this.ctx.diagnostics.some((d) => d.severity === 'error');
    if (hasError || this.tree === null || this.manifest === null) {
      return {
        rebuilt,
        full,
        diagnostics: this.ctx.diagnostics,
        packed: false,
        rpkPath: null,
        elapsedMs: Date.now() - start,
      };
    }

    const assetMap = new Map<string, string>();
    for (const asset of this.tree.assets) {
      assetMap.set(asset.outputPath, asset.sourcePath);
    }

    try {
      const result = packRPK({
        ctx: this.ctx,
        manifest: this.manifest,
        bundles: this.bundles,
        assets: assetMap,
        toolkitVersion: this.packagerVersion,
      });
      return {
        rebuilt,
        full,
        diagnostics: this.ctx.diagnostics,
        packed: true,
        rpkPath: result.rpkPath,
        elapsedMs: Date.now() - start,
      };
    } catch (e) {
      if (e instanceof CompileError) {
        this.ctx.diagnostics.push(fromError(e));
        return this.fail(start, full);
      }
      throw e;
    }
  }

  /**
   * 构造失败结果。
   * @param start 起始时间戳
   * @param full  是否为全量重建
   * @returns 未打包的重建结果
   */
  private fail(start: number, full: boolean): RebuildResult {
    return {
      rebuilt: [],
      full,
      diagnostics: this.ctx.diagnostics,
      packed: false,
      rpkPath: null,
      elapsedMs: Date.now() - start,
    };
  }
```

`rebuild` 里「编译失败时保留上次产物」的决定值得强调。两种选择：

```text
A. 保留上次产物  RPK 仍是上一个可用版本，开发者能继续运行旧版本调试
B. 移除该 bundle RPK 缺少这个页面，运行时报 Entry not found
```

选 A。开发过程中编译失败是常态（写代码的中间态），此时产出一个坏包不如保留能跑的旧包。而且 `finish` 里有 error 时根本不打包，所以实际上 RPK 文件保持不变——磁盘上还是上次成功的版本。

---

## Step 12.5：接入 CLI

```text
@add quickapp-toolkit/src/cli/cmd-watch.ts（新建文件）
```

```typescript
import * as path from 'node:path';
import type { BuildContext, BuildMode } from '../types';
import { RecursiveWatcher, type ChangeEvent } from '../watch/watcher';
import { IncrementalBuilder, type RebuildResult } from '../watch/incremental';
import { reportDiagnostics } from '../diagnostics/diagnostic';

export interface WatchOptions {
  projectRoot: string;
  mode: BuildMode;
}

/** toolkit 版本 */
const PACKAGER_VERSION: string = require('../../package.json').version;

/**
 * 格式化字节数。
 * @param bytes 字节数
 * @returns 如 "1.2 KB"
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * 输出一次重建的结果。
 *
 * @param result      重建结果
 * @param projectRoot 项目根目录，用于把绝对路径显示为相对路径
 */
function printResult(result: RebuildResult, projectRoot: string): void {
  const tag = result.full ? '全量' : '增量';
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });

  if (result.rebuilt.length > 0) {
    console.log(`[${time}] ${tag}重建 ${result.rebuilt.length} 个 bundle：`);
    for (const p of result.rebuilt) {
      console.log(`  ${p}`);
    }
  }

  reportDiagnostics(result.diagnostics, projectRoot);

  if (result.packed && result.rpkPath !== null) {
    console.log(
      `  -> ${path.relative(projectRoot, result.rpkPath)}  ${result.elapsedMs}ms`
    );
  } else {
    console.log(`  未产出 RPK（${result.elapsedMs}ms）`);
  }
  console.log('');
}

/**
 * 执行 watch 命令。
 *
 * 首次执行全量构建，之后监听 src/ 变更做增量。返回的 Promise 只在
 * 收到 SIGINT（Ctrl-C）时 resolve —— watch 是长驻进程。
 *
 * @param options watch 选项
 * @returns 进程退出码；正常退出为 0
 */
export async function runWatch(options: WatchOptions): Promise<number> {
  const { projectRoot, mode } = options;

  const ctx: BuildContext = {
    projectRoot,
    srcDir: path.join(projectRoot, 'src'),
    distDir: path.join(projectRoot, 'dist'),
    mode,
    diagnostics: [],
  };

  console.log(`watch 模式启动`);
  console.log(`模式：${mode}`);
  console.log(`监听：${path.relative(projectRoot, ctx.srcDir)}/`);
  console.log('');

  const builder = new IncrementalBuilder(ctx, PACKAGER_VERSION);

  // 首次全量构建。失败也继续进入监听 —— 开发者可能正是要靠 watch
  // 的反馈来修这个错误
  printResult(builder.rebuildAll(), projectRoot);

  let watcher: RecursiveWatcher;
  try {
    watcher = new RecursiveWatcher({
      root: ctx.srcDir,
      onChange: (events: ChangeEvent[]) => {
        printResult(builder.rebuild(events), projectRoot);
      },
    });
    watcher.start();
  } catch (e) {
    console.error(`无法启动监听：${(e as Error).message}`);
    return 1;
  }

  console.log(`监听中（${watcher.watchedDirCount} 个目录），Ctrl-C 退出`);
  console.log('');

  // 等待 SIGINT。必须显式 close watcher —— 活跃的 FSWatcher 会让
  // 事件循环非空，进程不会自然退出
  await new Promise<void>((resolve) => {
    const onSignal = () => {
      console.log('');
      console.log('停止监听');
      watcher.close();
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      resolve();
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
  });

  return 0;
}
```

```text
@update quickapp-toolkit/src/cli/index.ts — 替换 watch 分支
```

```typescript
      case 'watch':
        return await runWatch({
          projectRoot: resolveRoot(flags),
          mode: resolveMode(flags),
        });
```

```text
@add quickapp-toolkit/src/cli/index.ts — 在 import 段末尾追加
```

```typescript
import { runWatch } from './cmd-watch';
```

---

## Step 12.6：单元测试

测试分两部分：`RecursiveWatcher` 的事件行为（依赖真实文件系统，有时序），`IncrementalBuilder` 的调度决策（纯逻辑）。

```text
@add quickapp-toolkit/test/unit/incremental.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { IncrementalBuilder } = require('../../dist/watch/incremental.js');

/**
 * 创建一个可编译的临时项目。
 *
 * @param pages 页面名数组，如 ['Demo', 'Detail']
 * @returns 项目根目录绝对路径
 */
function makeProject(pages = ['Demo']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-inc-'));
  const srcDir = path.join(root, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const routerPages = {};
  for (const name of pages) {
    routerPages[`pages/${name}`] = { component: 'index' };
  }

  fs.writeFileSync(
    path.join(srcDir, 'manifest.json'),
    JSON.stringify(
      {
        package: 'com.test.inc',
        name: 'inc',
        versionName: '1.0.0',
        versionCode: 1,
        router: { entry: `pages/${pages[0]}`, pages: routerPages },
      },
      null,
      2
    )
  );

  for (const name of pages) {
    const dir = path.join(srcDir, 'pages', name);
    fs.mkdirSync(dir, { recursive: true });
    writePage(dir, name);
  }

  return root;
}

/**
 * 写一个最小可编译的页面。
 * @param dir   页面目录绝对路径
 * @param title 显示文本，用于区分不同版本的产物
 */
function writePage(dir, title) {
  fs.writeFileSync(
    path.join(dir, 'index.ux'),
    [
      '<template>',
      '  <div class="wrapper"><text>{{title}}</text></div>',
      '</template>',
      '',
      '<style>',
      '.wrapper { flex-direction: column }',
      '</style>',
      '',
      '<script>',
      `export default { private: { title: '${title}' } };`,
      '</script>',
    ].join('\n')
  );
}

/** 构造 BuildContext */
function makeCtx(root, mode = 'debug') {
  return {
    projectRoot: root,
    srcDir: path.join(root, 'src'),
    distDir: path.join(root, 'dist'),
    mode,
    diagnostics: [],
  };
}

/** 变更事件构造辅助 */
function change(file) {
  return { kind: 'change', file };
}

function unlink(file) {
  return { kind: 'unlink', file };
}
```

```javascript
// ---------- 全量构建 ----------

test('首次全量构建产出全部 bundle', () => {
  const root = makeProject(['Demo', 'Detail']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  const r = b.rebuildAll();

  assert.strictEqual(r.full, true);
  assert.strictEqual(r.packed, true);
  // app.js + 2 个页面
  assert.strictEqual(b.bundleCount, 3);
  assert.ok(r.rebuilt.includes('app.js'));
  assert.ok(r.rebuilt.includes('pages/Demo/index.js'));
  assert.ok(r.rebuilt.includes('pages/Detail/index.js'));
});

test('项目无 app.ux 时仍产出 app.js', () => {
  const root = makeProject(['Demo']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();
  assert.strictEqual(b.bundleCount, 2, 'app.js + 1 个页面');
});

// ---------- 增量范围 ----------

test('单页变更只重编译该页面', () => {
  const root = makeProject(['Demo', 'Detail']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const target = path.join(root, 'src/pages/Demo/index.ux');
  writePage(path.dirname(target), '改后的标题');

  const r = b.rebuild([change(target)]);

  assert.strictEqual(r.full, false, '不应触发全量');
  assert.deepStrictEqual(r.rebuilt, ['pages/Demo/index.js']);
  assert.strictEqual(b.bundleCount, 3, '其他 bundle 应保留');
});

test('两个页面同时变更时都重编译', () => {
  const root = makeProject(['Demo', 'Detail']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const p1 = path.join(root, 'src/pages/Demo/index.ux');
  const p2 = path.join(root, 'src/pages/Detail/index.ux');

  const r = b.rebuild([change(p1), change(p2)]);

  assert.strictEqual(r.full, false);
  assert.strictEqual(r.rebuilt.length, 2);
});

test('同一页面的重复事件只编译一次', () => {
  const root = makeProject(['Demo']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const target = path.join(root, 'src/pages/Demo/index.ux');
  const r = b.rebuild([change(target), change(target), change(target)]);

  assert.deepStrictEqual(r.rebuilt, ['pages/Demo/index.js']);
});

test('app.ux 变更只重编译 app.js', () => {
  const root = makeProject(['Demo']);
  const appPath = path.join(root, 'src/app.ux');
  fs.writeFileSync(appPath, '<script>\nexport default {};\n</script>');

  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const r = b.rebuild([change(appPath)]);

  assert.strictEqual(r.full, false);
  assert.deepStrictEqual(r.rebuilt, ['app.js']);
});

// ---------- 全量触发条件 ----------

test('manifest 变更触发全量', () => {
  const root = makeProject(['Demo']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const manifestPath = path.join(root, 'src/manifest.json');
  const r = b.rebuild([change(manifestPath)]);

  assert.strictEqual(r.full, true);
});

test('页面文件删除触发全量', () => {
  const root = makeProject(['Demo', 'Detail']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const target = path.join(root, 'src/pages/Detail/index.ux');
  const r = b.rebuild([unlink(target)]);

  assert.strictEqual(r.full, true);
});

test('未注册的新 .ux 触发全量', () => {
  const root = makeProject(['Demo']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  // 新建页面目录但未在 manifest 注册
  const newDir = path.join(root, 'src/pages/New');
  fs.mkdirSync(newDir, { recursive: true });
  writePage(newDir, 'New');

  const r = b.rebuild([change(path.join(newDir, 'index.ux'))]);

  assert.strictEqual(r.full, true);
  // manifest 未注册，所以产物里不应有它
  assert.strictEqual(b.bundleCount, 2, 'app.js + Demo');
});

test('资源变更不重编译任何 bundle 但重新打包', () => {
  const root = makeProject(['Demo']);
  const assetsDir = path.join(root, 'src/assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const imgPath = path.join(assetsDir, 'a.png');
  fs.writeFileSync(imgPath, Buffer.alloc(16, 1));

  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  fs.writeFileSync(imgPath, Buffer.alloc(32, 2));
  const r = b.rebuild([change(imgPath)]);

  assert.strictEqual(r.full, false);
  assert.deepStrictEqual(r.rebuilt, [], '无 bundle 需要重编译');
  assert.strictEqual(r.packed, true, '仍需重新打包');
});
```

```javascript
// ---------- Property 6：增量与全量产物一致 ----------

/**
 * 从 RPK 里读出指定条目的内容。
 *
 * 简化的 ZIP 解析，逻辑与 Step 9 测试里的 parseZip 相同。
 *
 * @param rpkPath RPK 文件绝对路径
 * @param entry   条目路径，如 "pages/Demo/index.js"
 * @returns 条目内容字符串；未找到时返回 null
 */
function readRpkEntry(rpkPath, entry) {
  const zlib = require('node:zlib');
  const buf = fs.readFileSync(rpkPath);

  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;

  const numEntries = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < numEntries; i++) {
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lhOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    if (name === entry) {
      const lhNameLen = buf.readUInt16LE(lhOffset + 26);
      const lhExtraLen = buf.readUInt16LE(lhOffset + 28);
      const dataStart = lhOffset + 30 + lhNameLen + lhExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compressedSize);
      const data = method === 0 ? raw : zlib.inflateRawSync(raw);
      return data.toString('utf8');
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

test('增量产物与全量产物字节一致', () => {
  const root = makeProject(['Demo', 'Detail']);
  const target = path.join(root, 'src/pages/Demo/index.ux');

  // 路径 1：全量构建 -> 改文件 -> 增量重建
  const b1 = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b1.rebuildAll();
  writePage(path.dirname(target), '新标题');
  const r1 = b1.rebuild([change(target)]);
  const incremental = readRpkEntry(r1.rpkPath, 'pages/Demo/index.js');

  // 路径 2：同样的源码状态下做全量构建
  const b2 = new IncrementalBuilder(makeCtx(root), '1.0.0');
  const r2 = b2.rebuildAll();
  const full = readRpkEntry(r2.rpkPath, 'pages/Demo/index.js');

  assert.ok(incremental !== null && full !== null);
  assert.strictEqual(
    incremental,
    full,
    '增量产出的 bundle 必须与全量一致（Property 6）'
  );
});

test('增量后未变更的页面产物也保持一致', () => {
  const root = makeProject(['Demo', 'Detail']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  const r0 = b.rebuildAll();
  const detailBefore = readRpkEntry(r0.rpkPath, 'pages/Detail/index.js');

  // 只改 Demo
  const target = path.join(root, 'src/pages/Demo/index.ux');
  writePage(path.dirname(target), '改后');
  const r1 = b.rebuild([change(target)]);
  const detailAfter = readRpkEntry(r1.rpkPath, 'pages/Detail/index.js');

  assert.strictEqual(detailAfter, detailBefore, '未变更页面的产物不应改变');
});

test('整个 RPK 在源码相同时字节一致', () => {
  const root = makeProject(['Demo']);

  const b1 = new IncrementalBuilder(makeCtx(root), '1.0.0');
  const r1 = b1.rebuildAll();
  const bytes1 = fs.readFileSync(r1.rpkPath);

  const b2 = new IncrementalBuilder(makeCtx(root), '1.0.0');
  const r2 = b2.rebuildAll();
  const bytes2 = fs.readFileSync(r2.rpkPath);

  // 依赖 Step 9 的固定时间戳决策
  assert.ok(bytes1.equals(bytes2), 'RPK 应可复现');
});

// ---------- 错误处理 ----------

test('页面编译失败时不产出 RPK 但保留状态', () => {
  const root = makeProject(['Demo', 'Detail']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  // 写入语法错误的模板（未闭合标签）
  const target = path.join(root, 'src/pages/Demo/index.ux');
  fs.writeFileSync(target, '<template>\n<div>\n</template>');

  const r = b.rebuild([change(target)]);

  assert.strictEqual(r.packed, false, '有 error 时不应打包');
  assert.ok(r.diagnostics.some((d) => d.severity === 'error'));
  assert.strictEqual(b.bundleCount, 3, '失败时保留上次的产物');
});

test('编译失败后修复可恢复', () => {
  const root = makeProject(['Demo']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const target = path.join(root, 'src/pages/Demo/index.ux');

  // 先写坏
  fs.writeFileSync(target, '<template>\n<div>\n</template>');
  const bad = b.rebuild([change(target)]);
  assert.strictEqual(bad.packed, false);

  // 再修好
  writePage(path.dirname(target), '修复后');
  const good = b.rebuild([change(target)]);

  assert.strictEqual(good.packed, true);
  assert.deepStrictEqual(good.rebuilt, ['pages/Demo/index.js']);
});

test('manifest 写坏时全量失败且不打包', () => {
  const root = makeProject(['Demo']);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  b.rebuildAll();

  const manifestPath = path.join(root, 'src/manifest.json');
  fs.writeFileSync(manifestPath, '{ invalid json');

  const r = b.rebuild([change(manifestPath)]);

  assert.strictEqual(r.full, true);
  assert.strictEqual(r.packed, false);
  assert.ok(r.diagnostics.some((d) => d.severity === 'error'));
});

test('首次构建失败后的变更走全量', () => {
  const root = makeProject(['Demo']);
  // 一开始 manifest 就是坏的
  fs.writeFileSync(path.join(root, 'src/manifest.json'), '{ bad');

  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');
  const first = b.rebuildAll();
  assert.strictEqual(first.packed, false);

  // 修好 manifest 后，任何变更都应触发全量（状态不完整）
  fs.writeFileSync(
    path.join(root, 'src/manifest.json'),
    JSON.stringify({
      package: 'com.test.inc',
      name: 'inc',
      versionName: '1.0.0',
      versionCode: 1,
      router: { entry: 'pages/Demo', pages: { 'pages/Demo': { component: 'index' } } },
    })
  );

  const target = path.join(root, 'src/pages/Demo/index.ux');
  const r = b.rebuild([change(target)]);

  assert.strictEqual(r.full, true);
  assert.strictEqual(r.packed, true);
});

// ---------- 耗时 ----------

test('增量耗时低于全量', () => {
  const pages = Array.from({ length: 8 }, (_, i) => `P${i}`);
  const root = makeProject(pages);
  const b = new IncrementalBuilder(makeCtx(root), '1.0.0');

  const full = b.rebuildAll();

  const target = path.join(root, 'src/pages/P0/index.ux');
  writePage(path.dirname(target), '改后');
  const inc = b.rebuild([change(target)]);

  // 打包耗时两者相同，差异只在编译部分。8 个页面时应有可测差异
  assert.ok(
    inc.elapsedMs <= full.elapsedMs,
    `增量 ${inc.elapsedMs}ms 应不高于全量 ${full.elapsedMs}ms`
  );
});
```

**用例统计：** 21 个。累计 292 个（Step 10 结束时 271 个）。

`增量耗时低于全量` 这条用 `<=` 而非 `<`：打包耗时在两者中相同，页面少时编译差异可能小于计时精度。断言方向正确即可，不追求严格小于。

`RecursiveWatcher` 的测试依赖真实文件系统事件，有时序性。

```text
@add quickapp-toolkit/test/unit/watcher.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RecursiveWatcher } = require('../../dist/watch/watcher.js');

/**
 * 等待指定毫秒。
 *
 * 文件系统事件是异步的，且不同平台的延迟不同（macOS 的 FSEvents
 * 比 Linux 的 inotify 慢）。测试里的等待时间要留足余量。
 *
 * @param ms 毫秒
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 创建临时目录 */
function makeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qa-watch-'));
}

/**
 * 启动 watcher 并收集事件。
 *
 * @param root       监听根目录
 * @param debounceMs 防抖窗口
 * @returns { watcher, events } —— events 会被回调持续追加
 */
function startWatcher(root, debounceMs = 50) {
  const events = [];
  const watcher = new RecursiveWatcher({
    root,
    debounceMs,
    onChange: (batch) => events.push(...batch),
  });
  watcher.start();
  return { watcher, events };
}

test('监听到文件修改', async () => {
  const root = makeDir();
  const file = path.join(root, 'a.txt');
  fs.writeFileSync(file, 'v1');

  const { watcher, events } = startWatcher(root);
  await sleep(50);

  fs.writeFileSync(file, 'v2');
  await sleep(300);
  watcher.close();

  assert.ok(events.length > 0, '应收到事件');
  assert.ok(events.some((e) => e.file === file && e.kind === 'change'));
});

test('监听到文件删除', async () => {
  const root = makeDir();
  const file = path.join(root, 'a.txt');
  fs.writeFileSync(file, 'v1');

  const { watcher, events } = startWatcher(root);
  await sleep(50);

  fs.unlinkSync(file);
  await sleep(300);
  watcher.close();

  assert.ok(events.some((e) => e.file === file && e.kind === 'unlink'));
});

test('递归监听子目录', async () => {
  const root = makeDir();
  const sub = path.join(root, 'pages', 'Demo');
  fs.mkdirSync(sub, { recursive: true });
  const file = path.join(sub, 'index.ux');
  fs.writeFileSync(file, 'v1');

  const { watcher, events } = startWatcher(root);
  // root + pages + pages/Demo
  assert.strictEqual(watcher.watchedDirCount, 3);

  await sleep(50);
  fs.writeFileSync(file, 'v2');
  await sleep(300);
  watcher.close();

  assert.ok(events.some((e) => e.file === file));
});

test('新增目录后其中的文件也被监听', async () => {
  const root = makeDir();
  const { watcher, events } = startWatcher(root);
  await sleep(50);

  const newDir = path.join(root, 'pages');
  fs.mkdirSync(newDir);
  await sleep(200);

  const file = path.join(newDir, 'x.ux');
  fs.writeFileSync(file, 'v1');
  await sleep(300);
  watcher.close();

  assert.ok(
    events.some((e) => e.file === file),
    `新目录下的文件应被监听，实际事件：${JSON.stringify(events)}`
  );
});

test('防抖合并同一文件的多次修改', async () => {
  const root = makeDir();
  const file = path.join(root, 'a.txt');
  fs.writeFileSync(file, 'v0');

  const { watcher, events } = startWatcher(root, 100);
  await sleep(50);

  // 快速连续写入
  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(file, `v${i}`);
    await sleep(10);
  }
  await sleep(400);
  watcher.close();

  const changeEvents = events.filter(
    (e) => e.file === file && e.kind === 'change'
  );
  assert.strictEqual(
    changeEvents.length,
    1,
    `5 次写入应合并为 1 个事件，实际 ${changeEvents.length}`
  );
});

test('忽略点开头的文件', async () => {
  const root = makeDir();
  const { watcher, events } = startWatcher(root);
  await sleep(50);

  fs.writeFileSync(path.join(root, '.DS_Store'), 'junk');
  fs.writeFileSync(path.join(root, '.hidden'), 'x');
  await sleep(300);
  watcher.close();

  assert.strictEqual(events.length, 0, '点开头的文件应被忽略');
});

test('忽略 node_modules 目录', () => {
  const root = makeDir();
  fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });

  const { watcher } = startWatcher(root);
  // root + pages，不含 node_modules
  assert.strictEqual(watcher.watchedDirCount, 2);
  watcher.close();
});

test('close 后不再触发回调', async () => {
  const root = makeDir();
  const file = path.join(root, 'a.txt');
  fs.writeFileSync(file, 'v1');

  const { watcher, events } = startWatcher(root);
  await sleep(50);
  watcher.close();

  fs.writeFileSync(file, 'v2');
  await sleep(300);

  assert.strictEqual(events.length, 0);
});

test('close 释放全部 watcher', () => {
  const root = makeDir();
  fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });

  const { watcher } = startWatcher(root);
  assert.ok(watcher.watchedDirCount > 0);

  watcher.close();
  assert.strictEqual(watcher.watchedDirCount, 0);
});

test('回调抛异常不终止监听', async () => {
  const root = makeDir();
  const file = path.join(root, 'a.txt');
  fs.writeFileSync(file, 'v1');

  let callCount = 0;
  const watcher = new RecursiveWatcher({
    root,
    debounceMs: 50,
    onChange: () => {
      callCount++;
      if (callCount === 1) throw new Error('故意失败');
    },
  });
  watcher.start();
  await sleep(50);

  fs.writeFileSync(file, 'v2');
  await sleep(250);
  fs.writeFileSync(file, 'v3');
  await sleep(250);
  watcher.close();

  assert.strictEqual(callCount, 2, '第一次抛异常后仍应继续接收事件');
});

test('监听不存在的目录抛错', () => {
  assert.throws(
    () => {
      const w = new RecursiveWatcher({
        root: '/nonexistent/path/xyz',
        onChange: () => {},
      });
      w.start();
    },
    /监听目录不存在/
  );
});
```

**用例统计：** 11 个。累计 303 个。

这组测试有平台差异风险：`fs.watch` 在 macOS 用 FSEvents、Linux 用 inotify、Windows 用 ReadDirectoryChangesW，事件延迟和粒度都不同。测试里的 `sleep` 时间按最慢的平台留余量。CI 上偶发失败时优先怀疑等待时间不足，而不是逻辑错误。

---

## Step 12.7：逐层验证

### 12.7.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** 303 个用例通过（incremental 21 + watcher 11 + 之前 271）。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `TS2564: Property 'tree' has no initializer` | `strict` 下类属性未初始化 | 声明为 `FileTree \| null = null` |
| watcher 测试超时 | 平台事件延迟超过 sleep 时间 | 加大 sleep；macOS 上 FSEvents 有约 100ms 延迟 |
| `新增目录后其中的文件也被监听` 失败 | 目录创建事件未触发 `watchDir` | 检查 `handleRawEvent` 里 `stat.isDirectory()` 分支 |
| `防抖合并` 失败，事件数 > 1 | 写入间隔超过防抖窗口 | 写入间隔 10ms 应小于 debounceMs 100ms |
| 测试跑完进程不退出 | 有 watcher 未 close | 每个测试末尾都要 `watcher.close()` |

最后一项值得注意：活跃的 `FSWatcher` 会让 Node 事件循环非空，进程挂住。如果 `npm test` 跑完不返回提示符，检查是否有测试漏了 `close()`。

### 12.7.2：watch 基本行为

```bash
cd ../quickapp-examples/quickapp-code-test1
quickapp watch --root=.
```

**预期输出：**

```text
watch 模式启动
模式：debug
监听：src/

[14:23:01] 全量重建 3 个 bundle：
  app.js
  pages/Demo/index.js
  pages/DemoDetail/index.js
  -> dist/com.example.case1.debug.1.0.0.rpk  312ms

监听中（5 个目录），Ctrl-C 退出
```

监听目录数取决于项目结构：`src` + `src/pages` + `src/pages/Demo` + `src/pages/DemoDetail` + `src/assets` + `src/assets/images`。

在另一个终端里改文件：

```bash
# 修改 Demo 页面的标题
sed -i.bak "s/欢迎体验快应用开发/修改后的标题/" \
  quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux
```

**预期 watch 终端输出：**

```text
[14:23:45] 增量重建 1 个 bundle：
  pages/Demo/index.js
  -> dist/com.example.case1.debug.1.0.0.rpk  47ms
```

**核对点：**
- 标签是「增量」不是「全量」
- 只列出 `pages/Demo/index.js`，不含另一个页面
- 耗时明显低于首次全量（47ms vs 312ms）

恢复：

```bash
mv quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux.bak \
   quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux
```

### 12.7.3：全量触发验证

在 watch 运行中修改 manifest：

```bash
# 改一个不影响功能的字段
sed -i.bak 's/"versionCode": 1/"versionCode": 2/' \
  quickapp-examples/quickapp-code-test1/src/manifest.json
```

**预期：**

```text
[14:24:12] 全量重建 3 个 bundle：
  app.js
  pages/Demo/index.js
  pages/DemoDetail/index.js
  -> dist/com.example.case1.debug.1.0.0.rpk  298ms
```

**核对点：** 标签是「全量」，三个 bundle 都列出。

删除一个页面文件：

```bash
mv quickapp-examples/quickapp-code-test1/src/pages/DemoDetail/index.ux /tmp/
```

**预期：**

```text
[14:24:30] 全量重建 0 个 bundle：
ERROR  src/manifest.json
  router.pages 声明的页面文件不存在：
    pages/DemoDetail/index.ux

编译失败：1 个错误，0 个警告
  未产出 RPK（12ms）
```

**核对点：** 走了全量，报错明确，且 `未产出 RPK`——磁盘上的 RPK 仍是上次成功的版本。

恢复后应自动恢复正常：

```bash
mv /tmp/index.ux quickapp-examples/quickapp-code-test1/src/pages/DemoDetail/
```

**预期：** 下一次全量重建成功，产出 RPK。

### 12.7.4：错误恢复验证

watch 的关键能力是「出错不退出」。

```bash
# 写入语法错误
cat > quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux <<'EOF'
<template>
  <div class="wrapper">
</template>
EOF
```

**预期：**

```text
[14:25:01] 增量重建 0 个 bundle：
ERROR  src/pages/Demo/index.ux:1
  未闭合的标签 <div>

  1 | <template>
  2 |   <div class="wrapper">
  3 | </template>

编译失败：1 个错误，0 个警告
  未产出 RPK（8ms）
```

**核对点：**
- watch 进程仍在运行（终端没有回到提示符）
- 错误信息带行号和代码片段（Step 1 的诊断输出）
- 未产出 RPK

修复后：

```bash
git checkout quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux
```

**预期：** 自动重编译成功。

### 12.7.5：Property 6 验证 —— 增量与全量产物一致

这是本步最重要的验证。

```bash
cd quickapp-examples/quickapp-code-test1

# 1. 全量构建，保存产物
quickapp build --root=.
cp dist/com.example.case1.debug.1.0.0.rpk /tmp/full-before.rpk

# 2. 改一个页面
sed -i.bak 's/欢迎体验快应用开发/增量测试标题/' src/pages/Demo/index.ux

# 3. 全量构建（改动后）
quickapp build --root=.
cp dist/com.example.case1.debug.1.0.0.rpk /tmp/full-after.rpk

# 4. 恢复源码，全量构建回到初始状态
mv src/pages/Demo/index.ux.bak src/pages/Demo/index.ux
quickapp build --root=.
```

现在用 watch 走增量路径：

```bash
# 后台启动 watch
quickapp watch --root=. > /tmp/watch.log 2>&1 &
WATCH_PID=$!
sleep 2

# 触发增量
sed -i.bak 's/欢迎体验快应用开发/增量测试标题/' src/pages/Demo/index.ux
sleep 2

kill $WATCH_PID
cp dist/com.example.case1.debug.1.0.0.rpk /tmp/incremental.rpk

# 恢复
mv src/pages/Demo/index.ux.bak src/pages/Demo/index.ux
```

比对：

```bash
cd /tmp
rm -rf a b && unzip -q full-after.rpk -d a && unzip -q incremental.rpk -d b
diff -r a b && echo "产物完全一致（Property 6 通过）"
```

**预期：** `产物完全一致（Property 6 通过）`

也可以直接比字节：

```bash
cmp full-after.rpk incremental.rpk && echo "字节一致"
```

**预期：** `字节一致`

**不一致时的排查方向：**

| 差异位置 | 原因 |
|---|---|
| `pages/Demo/index.js` | 增量编译的输入或参数与全量不同（mode、packagerVersion） |
| `pages/DemoDetail/index.js` | 增量时该页面的 bundle 被意外重新编译或丢失 |
| `META-INF/build.txt` | hash 基于压缩后内容，若 bundles 内容一致则应相同；不同说明 bundle 有差异 |
| `manifest.json` | 增量时 manifest 未重新处理，但 mode 注入应是幂等的 |
| 整体字节不同但解压后一致 | ZIP 条目顺序不同 —— 检查 `bundles` Map 的插入顺序 |

最后一项容易发生：全量时 `bundles` 的插入顺序是 `app.js` 然后按 manifest 页面顺序；增量时如果只更新了某一项，Map 的顺序保持不变（JS 的 Map 在 `set` 已存在的 key 时不改变顺序），所以顺序应该一致。如果不一致，检查是否有 `delete` 后重新 `set` 的操作。

### 12.7.6：退出与资源释放

```bash
quickapp watch --root=../quickapp-examples/quickapp-code-test1
# 按 Ctrl-C
```

**预期输出：**

```text
^C
停止监听
```

进程退出，返回 shell 提示符。

**核对点：**
- 退出码为 0：`echo $?`
- 无残留临时文件：`ls -la dist/.tmp/`（应为空或不存在）
- 无残留进程：`ps aux | grep quickapp`

如果 Ctrl-C 后进程挂住不退出，说明 `watcher.close()` 没有释放全部 `FSWatcher`。验证方法：

```bash
quickapp watch --root=<项目> &
WATCH_PID=$!
sleep 2
kill -INT $WATCH_PID
sleep 1
ps -p $WATCH_PID > /dev/null && echo "进程未退出（问题）" || echo "已退出"
```

### 12.7.7：多页面项目的增量收益

示例项目只有 2 个页面，增量收益不明显。构造一个多页面项目验证。

```bash
mkdir -p /tmp/many/src/pages
cd /tmp/many

# 生成 20 个页面
PAGES=""
for i in $(seq 1 20); do
  mkdir -p src/pages/P$i
  cat > src/pages/P$i/index.ux <<EOF
<template>
  <div class="wrapper"><text>{{title}}</text></div>
</template>
<style>
.wrapper { flex-direction: column }
</style>
<script>
export default { private: { title: 'Page $i' } };
</script>
EOF
  PAGES="$PAGES\"pages/P$i\": { \"component\": \"index\" },"
done

# 生成 manifest
cat > src/manifest.json <<EOF
{
  "package": "com.test.many",
  "name": "many",
  "versionName": "1.0.0",
  "versionCode": 1,
  "router": {
    "entry": "pages/P1",
    "pages": { ${PAGES%,} }
  }
}
EOF

quickapp watch --root=. > /tmp/many-watch.log 2>&1 &
WATCH_PID=$!
sleep 3

# 触发增量
sed -i.bak "s/Page 1/Page 1 改/" src/pages/P1/index.ux
sleep 2

kill $WATCH_PID
cat /tmp/many-watch.log
```

**预期日志：**

```text
[..] 全量重建 21 个 bundle：
  app.js
  pages/P1/index.js
  ...
  -> dist/com.test.many.debug.1.0.0.rpk  680ms

监听中（22 个目录），Ctrl-C 退出

[..] 增量重建 1 个 bundle：
  pages/P1/index.js
  -> dist/com.test.many.debug.1.0.0.rpk  95ms
```

**核对点：** 全量 680ms vs 增量 95ms，降幅约 86%。

95ms 里的大部分是打包耗时（21 个条目的 DEFLATE 压缩），编译只占约 30ms。这印证了 12.1 的分析：**打包无法增量，是增量收益的下限。**

如果项目规模继续增长（100 个页面），打包耗时会成为主要瓶颈。届时的优化方向是缓存已压缩的条目——ZIP 的每个条目独立压缩，未变更的条目可以复用上次的压缩结果。这属于 V2 的优化，V1 不做（见技术决策 4）。

---

## 技术决策

### 1. 页面粒度增量，不做依赖图

**为什么：** 页面之间没有编译期依赖——模板、样式、脚本都是页面私有，编译单个页面不需要读其他页面的任何内容。这让「改哪个页面重编译哪个页面」成为完备的规则，不需要依赖分析。

**代价：** 这条性质在支持自定义组件（`<import>`）后失效。届时页面 A 引用组件 C，改 C 要重编译 A，需要维护「组件 → 引用它的页面」的反向索引。

V1 明确不支持自定义组件（HANDOFF 的「V1 明确不支持」），所以这个代价是延后的而非当下的。真要支持时，`needsFullRebuild` 是唯一需要改的地方——加一条「变更的是组件文件」的判断，退化为全量或按索引重编译。

### 2. manifest 变更走全量

**为什么：** `router.pages` 的变更会改变编译目标集合——新增页面要编译，删除页面要从产物移除。判断「变了哪些」需要对比新旧路由表，逻辑不比全量重建简单。

`display` 变更虽不影响 bundle，但要重新打包（manifest.json 是 RPK 条目）。既然要打包，顺便重编译的额外成本很低。

**代价：** 改一个 `titleBarText` 也触发全量。示例规模下约 300ms，20 页面项目约 700ms。开发过程中改 manifest 的频率远低于改页面，可接受。

### 3. 编译失败时保留上次产物

**为什么：** 开发中编译失败是常态（代码写到一半保存）。此时两种选择：

```text
A. 保留上次产物  磁盘上的 RPK 仍是可运行的旧版本
B. 移除该 bundle RPK 缺页面，运行时报 Entry not found
```

选 A。开发者可能正在设备上调试，一次编译失败不该让运行中的应用失效。

**代价：** 磁盘上的 RPK 与源码不同步。缓解方式是输出里明确写 `未产出 RPK`——开发者知道当前包是旧的。

实际上 `finish` 里有 error 时根本不打包，所以 RPK 文件保持不变，连写入都没发生。

### 4. RPK 整体重写，不做增量打包

**为什么：** RPK 是单个 ZIP 文件。ZIP 的结构是「条目数据 + Central Directory + EOCD」，改一个条目会改变后续所有条目的偏移量，必须重写 Central Directory。真正的增量打包需要：保留未变更条目的压缩数据、重算偏移、重建 Central Directory——约 100 行额外逻辑。

收益在当前规模下很小：示例项目打包约 20ms，20 页面项目约 60ms。

**代价：** 打包耗时是增量收益的下限。100 页面项目的打包可能到 300ms，那时值得优化。

**优化方向（V2）：** 缓存每个条目的压缩结果（`Map<entryPath, { crc, compressed }>`），未变更条目直接复用。`ZipWriter` 需要增加「接受预压缩数据」的接口。这个改动不影响产物格式——ZIP 不记录压缩时机。

### 5. 用 `fs.watch` 自己实现递归，不引入 chokidar

**为什么：** `package.json` 声明 `node >= 18`，而 `fs.watch` 的 `recursive: true` 在 Linux 上需要 Node 20+。三种选择：抬高 Node 版本要求、引入 chokidar、自己实现递归。

自己实现约 40 行（`watchDir` 的递归 + 新增目录时补 watcher），换来零依赖和不抬高版本要求。

**代价：** 要自己处理三个坑——事件去重（防抖）、`eventType` 不可信（用 `statSync` 判断）、新增目录要补 watcher。这些在 12.3 的实现里都有对应处理，且有单测覆盖。

chokidar 会带来 1 个直接依赖加其依赖树（`readdirp`、`normalize-path` 等），且它内部也是在做同样的事——只是做得更完善（处理了符号链接、网络文件系统等边界情况）。这些边界在「监听项目的 src 目录」场景下不出现。

### 6. 防抖窗口 100ms

**为什么：** 一次编辑器保存通常触发 2-4 个 fs 事件：写入内容、更新元数据、原子保存的 rename。不防抖会导致同一次保存触发多轮编译，输出刷屏且浪费 CPU。

100ms 是经验值：足够合并同一次保存的事件（它们通常在 10ms 内发生），又不会让用户感到延迟。

**代价：** 极快的连续保存（100ms 内两次）会被合并为一次。这不是问题——最后一次的内容才是当前状态，编译它就够了。

防抖还顺带解决了原子保存的瞬时「文件不存在」窗口：100ms 后 rename 已完成，`statSync` 能拿到文件。

### 7. 变更回调的异常必须捕获

**为什么：** 编译错误在 `compileOnePage` 内部已转为诊断，但意外异常（磁盘满、权限问题导致打包失败）会冒泡到 `flush`。不捕获会终止 watch 进程。

最坏的情况是进程死了但终端没有明显提示——用户以为还在监听，实际改文件已经没反应了。这类问题的排查会浪费很多时间。

**代价：** 真正的 bug 被降级为一条错误日志，不会立即暴露。缓解方式是打印完整堆栈（`e.stack`），让问题可报告。

### 8. `IncrementalBuilder` 持有状态，`RecursiveWatcher` 无状态

**为什么：** 职责分离。watcher 只负责「告诉我什么文件变了」，不理解编译；builder 只负责「根据变更决定重编译什么」，不理解文件系统事件。

这让两者可以独立测试：watcher 的测试用真实文件系统但不涉及编译；builder 的测试直接构造 `ChangeEvent` 数组，不依赖文件系统事件的时序。后者是纯逻辑测试，稳定且快。

**代价：** 多一层抽象。但这层抽象恰好对应了两类不同的失败——「没监听到变更」和「监听到了但重编译范围错了」，分开定位更快。

---

## QA

**Q：为什么不支持 HMR（热替换）？**

HMR 需要 Runtime 侧配合，改动面远超 toolkit。完整链路是：

```text
toolkit 检测到变更
    → 通过某个通道（WebSocket / adb forward）通知设备
    → Runtime 收到通知，重新加载该页面的 bundle
    → framework.js 销毁旧 VM、创建新 VM
    → 重新构建 VNode 并渲染
```

其中三件事当前都不存在：设备与开发机的通信通道、Runtime 侧的 bundle 热加载能力、framework.js 的 VM 销毁重建逻辑（`quickapp-runtime-js` 项目尚未开始）。

V1 的开发流程是「watch 产出 RPK → 手动重装 APK 或推送 RPK 到设备」。这个流程的反馈周期是几十秒，HMR 能压到几秒——收益明确，但属于跨项目的功能，需要在 Runtime 侧规划。

**Q：watch 模式为什么不支持 release？**

代码上支持——`runWatch` 接受 `mode` 参数并透传。但没有实际用途：

```text
开发时用 release：每次变更都跑 Terser，增量收益被压缩耗时抵消
发布时用 watch：没有场景，发布是一次性操作
```

`quickapp watch --mode=release` 能跑，只是慢。文档不宣传这个用法，但不禁止。

**Q：增量编译时 manifest 没有重新处理，`config.debug` 会不对吗？**

不会。`manifest` 在 `rebuildAll` 时处理一次，之后增量编译复用同一个对象。`config.debug` 由 `mode` 决定，而 `mode` 在 `BuildContext` 里，watch 期间不变。

如果开发者改了 manifest 里的 `config.debug`，那次变更会触发全量（决策 2），重新处理时 mode 注入会再次覆盖它——行为与全量 build 一致。

**Q：为什么 `bundleCount` 是个 getter，只为测试服务吗？**

主要为测试服务，但也有调试价值。它验证的是「增量后其他 bundle 还在」——这是增量正确性的核心不变量。

如果不暴露这个数字，测试只能通过检查 RPK 内容间接验证，那样耦合了打包逻辑。暴露一个只读的计数器是最小的可测性开口。

**Q：`needsFullRebuild` 里 `unlink` 一律触发全量，会不会太保守？**

会，但保守是对的。`unlink` 的三种情况：

```text
删除了已注册的页面    -> manifest 校验会失败，需要全量发现这个错误
删除了未注册的 .ux    -> 无影响，但全量的代价只是几百毫秒
编辑器的原子保存中间态 -> 防抖窗口通常已经过滤掉，漏过来时全量无害
```

第三种情况值得注意：某些编辑器的保存方式是「删除原文件 → 写新文件」，如果两个事件被拆到不同的防抖窗口，会先收到 `unlink` 触发全量，再收到 `change` 触发增量。结果是编译两次——浪费但不错误。

精确处理需要判断「文件现在是否存在」，但 `unlink` 事件到达时文件确实不存在（`handleRawEvent` 已经 `statSync` 过）。要区分只能加延迟重试，复杂度不值得。

**Q：`assetsOnly` 分支里重新扫描项目，会不会太重？**

`scanProject` 的成本是遍历 `src/` 目录，示例项目约 1ms。重新扫描的必要性在于：资源文件可能新增或删除，`tree.assets` 需要更新，否则打包时会漏掉新文件或读不到已删文件。

只扫描 `assets/` 会更轻，但 `scanProject` 是现成的且成本可忽略。真要优化，可以给 `scanProject` 加一个「只重扫资源」的参数。

**Q：多个 watch 进程同时跑同一个项目会怎样？**

两个进程会各自打包，写同一个 RPK 路径。原子写入（Step 9）保证不会产出损坏文件——临时文件名带 `process.pid`，rename 是原子的。最终 RPK 是最后完成的那个进程的产物。

内容上两者应该一致（同源码同 mode）。如果 mode 不同（一个 debug 一个 release），文件名不同（`.debug.` vs `.release.`），互不干扰。

没有加锁机制。同时跑多个 watch 是误用，不值得为此加复杂度。

**Q：`RecursiveWatcher` 监听的目录数在项目增长后会不会爆掉？**

每个 `fs.watch` 消耗一个文件描述符（Linux 上是 inotify watch）。系统默认限制通常是几千到几万（`/proc/sys/fs/inotify/max_user_watches` 默认 8192）。

快应用项目的目录数在几十量级（每个页面一个目录），远低于限制。`node_modules` 被忽略（决策 5 的实现里有 `IGNORED_DIRS`），那才是目录数爆炸的常见来源。

如果真的超限，`fs.watch` 会抛 `ENOSPC`，`watchDir` 里的 try-catch 会静默跳过——结果是部分目录未被监听，表现为「改某些文件没反应」。这个失败模式不好，但触发条件不现实。

**Q：为什么 `printResult` 用 `toLocaleTimeString` 而不是 ISO 格式？**

watch 的输出是给人看的，本地时间更直观。`hour12: false` 保证 24 小时制，避免 AM/PM 干扰。

日志文件场景（`quickapp watch > watch.log`）下 ISO 格式更好排序，但 watch 的日志不是用来归档的——它是实时反馈。

**Q：增量编译能保证 Property 6，是因为编译器是纯函数吗？**

是。`compileOnePage` 的输出只依赖三个输入：源文件内容、mode、packagerVersion。没有全局状态、没有时间戳、没有随机数。

三个曾经可能破坏这个性质的地方都已处理：

```text
Step 4  序列化器的 key 顺序保持插入顺序，不排序也不随机
Step 9  ZIP 时间戳固定，build.txt 的 timeStamp 固定、hash 行排序
Step 10 Terser 版本锁定，配置无随机项
```

如果将来引入任何依赖外部状态的编译步骤（比如读环境变量注入版本号），Property 6 就会失效。届时要么把那个状态纳入输入（作为参数传入），要么接受增量与全量产物不一致。

---

## 下一步

Step 13：`quickapp init` 项目模板（Task 4.3）。

Step 12 完成后，开发流程的两端都通了：`quickapp build` 出包，`quickapp watch` 增量迭代。剩下的缺口是**从零开始**——新用户拿到 toolkit 后，需要手写 `manifest.json`、建目录、写第一个 `.ux` 文件才能跑起来。

Step 13 提供项目骨架，把这个过程压到一条命令。它的验收标准不是「文件齐全」，而是：

```text
quickapp init my-app && cd my-app && quickapp build
```

一次成功，且产物能在 Runtime 上渲染出可见内容。模板本身要经过 Step 11 的契约验收——一个生成出来就编译失败或渲染空白的模板，比没有模板更糟。
