# TK-S01 Design

## 目录

- [1. 结论](#1-结论)
- [2. 分层与所有权](#2-分层与所有权)
- [3. CLI 合同](#3-cli-合同)
- [4. Application Service](#4-application-service)
- [5. Workspace](#5-workspace)
- [6. 配置](#6-配置)
- [7. Result 与 Diagnostic](#7-result-与-diagnostic)
- [8. 退出码与输出](#8-退出码与输出)
- [9. Build Marker](#9-build-marker)
- [10. 状态与流程](#10-状态与流程)
- [11. 并发、取消与生命周期](#11-并发取消与生命周期)
- [12. 错误与降级](#12-错误与降级)
- [13. 实现结构](#13-实现结构)
- [14. 后续扩展边界](#14-后续扩展边界)

## 1. 结论

采用 **Ports and Adapters + 单次 Invocation/Build Session**：CLI 只是输入输出 Adapter，Application Service 是唯一用例入口，Workspace 是唯一文件访问边界。

```text
CLI Adapter
  -> ToolkitApplicationService
       -> WorkspaceResolver
       -> ConfigResolver
       -> BuildUseCasePort / InspectUseCasePort / RunUseCasePort
       -> ToolkitObservationPort
  -> ToolkitResult
  -> ResultRenderer
  -> ExitCodeMapper
```

这个设计不需要动态插件系统。分 Spec 在编译期组合 typed Port；未实现的 UseCase 不能以空成功代替。

## 2. 分层与所有权

| 层/部件 | 拥有 | 不得拥有 |
|---|---|---|
| CLI Adapter | argv、help/version、renderer、进程 signal/exit code | Workspace 状态、编译规则、Runtime 启动逻辑 |
| Application Service | invocation 编排、统一结果、取消边界、Build Marker 边界 | stdout/stderr、`process.exit`、DSL AST、平台进程细节 |
| WorkspaceResolver | root/config/source/output/cache 的规范路径 | Manifest 语义、module graph、Artifact |
| SourceAccess | 受约束读取、不可变 SourceUnit、session 一致性 | DSL 分类、依赖解析、代码转换 |
| ConfigResolver | 版本、优先级、provenance、typed section 合并 | 猜测未知配置、环境语义覆盖 |
| UseCase Port | operation-specific typed request/result | CLI 文本与进程状态 |
| Renderer | Human/JSON 表示 | 成功判定、错误分类 |

所有可变状态绑定一次 invocation。模块级全局变量不得保存 cwd、配置、Workspace、Diagnostic 或 Build Session。

## 3. CLI 合同

### 3.1 顶层命令

```text
quickapp --help
quickapp --version
quickapp build [workspace] [common options] [build options]
quickapp inspect <TK-S08 operands> [common options] [inspect options]
quickapp run <TK-S08 operands> [common options] [run options]
```

顶层命令名不可增加别名。V1 不注册 `watch/server/debug/create/validate/bench/mcp`。

`build [workspace]` 的 workspace 语义由本分 Spec冻结：相对路径以 invocation `cwd` 为基准，省略时从 `cwd` 自动发现。`build options` 由后续 Build 分 Spec定义。

TK-S01 只为 `inspect/run` 保留顶层名字和公共选项槽位；它不定义 operand、target、Artifact 识别或启动成功条件。TK-S08 必须通过静态 `CommandContribution` 补齐二者的 operation parser 与 UseCase，不得修改公共选项语义。

### 3.2 公共选项

| 选项 | 语义 |
|---|---|
| `--config <path>` | 选择当前 Workspace 内唯一配置文件 |
| `--format <human\|json>` | 选择结果表示；默认 `human` |
| `--no-color` | Human 模式禁用 ANSI；JSON 模式天然无 ANSI |
| `--help` | 输出当前命令帮助并成功退出 |

顶层 `--version` 输出一行 Toolkit semantic version。`NO_COLOR` 只等价于 `--no-color`；显式选项优先。其他环境变量不进入配置。

未知命令、未知选项、重复的单值选项、互斥选项或选项缺值均在调用 Application Service 前失败。它们尚未产生 operation，必须返回 CLI Adapter 私有 `CliDiagnosticResult`，不得伪造 `operation`。

### 3.3 CommandContribution

这是静态组合点，不是 Runtime 插件：

```text
CommandContribution<Request> {
  name: build | inspect | run
  parseOperationArgs(tokens, commonOptions) -> ParseResult<Request>
  invoke(service, request, context) -> ToolkitResult
}
```

每个名字必须且只能注册一次；重复或缺失注册属于启动期内部错误。CLI Registry 不能直接引用 Compiler、Package Inspector 或 Runtime Launcher 实现。

## 4. Application Service

### 4.1 接口

```text
ToolkitApplicationService {
  build(BuildRequest, InvocationContext) -> Promise<ToolkitResult<BuildResult>>
  inspect(InspectRequest, InvocationContext) -> Promise<ToolkitResult<InspectResult>>
  run(RunRequest, InvocationContext) -> Promise<ToolkitResult<RunResult>>
}
```

本分 Spec只冻结三种 operation 和公共 envelope。`BuildRequest` 的 Workspace 部分现在冻结；其编译选项和 `BuildResult` 的 Artifact 字段由 TK-S02..S07 扩充。`InspectRequest/Result`、`RunRequest/Result` 由 TK-S08 冻结。

```text
InvocationContext {
  invocationId: "inv:<non-empty>"
  runId: "run:<non-empty>"
  cwd: canonical absolute path
  cancellation: CancellationToken
}

BuildRequest {
  workspace?: path input
  config?: path input
  overrides: typed build overrides
}
```

Application Service API 不接收 argv、stdout/stderr、ANSI、`process.env` 或平台 Runtime handle。

### 4.2 委派规则

```text
build request
  -> resolve Workspace/config
  -> create BuildSession
  -> BuildUseCasePort.execute(BuildInvocation)

inspect request
  -> TK-S08 validation/resolution
  -> InspectUseCasePort.execute(...)

run request
  -> TK-S08 validation/resolution
  -> RunUseCasePort.execute(...)
```

`BuildInvocation` 至少携带：`WorkspaceContext`、`WorkspaceSnapshot`、resolved config、Diagnostic collector、cancellation、invocation/run ID。Compiler 后续阶段不得重新发现 Workspace 或重新读取配置。

### 4.3 成功事实

Application Service 返回的 `ToolkitResult.status` 是唯一成功事实。CLI 不得根据以下信号改写结果：

- 输出路径存在。
- stdout 含有某段文本。
- Runtime 窗口或进程出现。
- 某个 marker 写出成功。

## 5. Workspace

### 5.1 发现算法

```text
start = explicit build workspace ? resolve(cwd, input) : cwd
if explicit:
  require directory
  require root marker in that directory
else:
  for start and each parent up to filesystem root:
    first directory containing quickapp.config.json or src/manifest.json wins
if none:
  TK_WORKSPACE_NOT_FOUND
```

只选择最近祖先，不合并嵌套 Workspace。根目录同时存在两个 marker 时仍是同一个 Workspace；配置文件覆盖默认 Workspace paths。

### 5.2 WorkspaceContext

```text
WorkspaceContext {
  root: canonical absolute path
  logicalRoot: "."
  configPath?: canonical absolute path
  sourceRoot: canonical absolute path
  outputRoot: canonical absolute path
  cacheRoot: canonical absolute path
  manifestPath: canonical absolute path
  manifest: SourceUnit
  config: ResolvedToolkitConfig
}
```

绝对路径只存在 Workspace/Application 基础设施中。Compiler Model、Artifact 和 Diagnostic 的公开 file 字段只能使用 Workspace-relative POSIX path。

### 5.3 逻辑路径

合法逻辑路径必须：

1. 是非空 UTF-8 相对路径。
2. 使用 `/`，不含反斜线、NUL、`.`、`..` 或空 segment。
3. 规范化后仍在 Workspace root 内。
4. canonical target 仍在 Workspace root 内。

目录枚举按逻辑路径 UTF-8 bytes 升序返回。大小写保持输入，不做 locale 排序；两个路径解析为同一 canonical target 时返回冲突诊断。

### 5.4 SourceAccess 与 SourceUnit

```text
SourceAccess {
  stat(logicalPath) -> SourceEntry | Diagnostic
  list(logicalDirectory, ListPolicy) -> ordered SourceEntry[] | Diagnostic
  read(logicalPath, ReadPolicy) -> SourceUnit | Diagnostic
  verifyUnchanged() -> success | TK_WORKSPACE_CHANGED
}

ListPolicy {
  maxEntries: positive integer
}

ReadPolicy {
  content: bytes | strictUtf8
  maxBytes: positive integer
}

SourceUnit {
  logicalPath: workspace-relative POSIX path
  contentKind: bytes | utf8
  bytes: immutable byte storage
  text?: decoded string
  byteLength: non-negative integer
  sha256: lowercase hex
}
```

`SourceUnit` 不包含 AST、组件类型、moduleId、Template ID 或 Runtime ID。扩展名只可用于调用方选择 parser，不能由 Workspace 推断语义成功。

每次 Build Session 首次读取时固定 bytes 与文件 identity，后续读取返回同一 SourceUnit。结束前对全部已读文件执行 `verifyUnchanged`；变化、替换或删除使整次构建失败，不提交最终 Artifact。

输出目录和缓存目录不能与 sourceRoot 相同，也不能互为祖先/后代；`SourceAccess.list` 默认排除 output/cache，防止旧产物成为输入。

## 6. 配置

### 6.1 文件形态

默认文件名：`quickapp.config.json`。V1 只接受严格 JSON：

```json
{
  "schemaVersion": 1,
  "workspace": {
    "sourceRoot": "src",
    "outputRoot": "dist",
    "cacheRoot": ".quickapp-kit/cache"
  },
  "build": {},
  "inspect": {},
  "run": {}
}
```

`schemaVersion` 必填。`workspace` 由 TK-S01 拥有；三个 operation section 是静态 typed extension point，其字段分别由对应分 Spec 注册的 `ConfigSection` 校验。没有 owner 的字段必须失败，不得保留为任意 JSON。

### 6.2 默认值与约束

| 字段 | 默认值 | 约束 |
|---|---|---|
| `workspace.sourceRoot` | `src` | Workspace-relative directory |
| `workspace.outputRoot` | `dist` | Workspace-relative directory，不与 source/cache 重叠 |
| `workspace.cacheRoot` | `.quickapp-kit/cache` | Workspace-relative directory，不与 source/output 重叠 |

`manifestPath` 固定由 `sourceRoot + /manifest.json` 得到，配置不能另设绝对入口。Case 001/002 因此无需配置即可发现。

### 6.3 解析顺序

```text
1. resolve Workspace root
2. choose explicit --config or root/quickapp.config.json
3. parse schemaVersion and workspace section
4. register and validate installed typed operation sections
5. merge built-in defaults <- config <- explicit request/CLI override
6. canonicalize paths and validate containment/overlap
7. produce immutable ResolvedToolkitConfig + provenance
```

单值采用最高优先级完全替换，不做字符串拼接；数组的合并规则由拥有该字段的分 Spec明确，默认也是完全替换。`null` 不能表示删除，除非字段 owner 明确允许。

```text
ConfigValue<T> {
  value: T
  source: default | config
  location?: workspace-relative file + JSON pointer
  overriddenBy?: request
}
```

## 7. Result 与 Diagnostic

### 7.1 ToolkitResult

```text
ToolkitResult<T> {
  schemaVersion: 1
  operation: build | inspect | run
  status: success | failure | cancelled
  invocationId: "inv:<non-empty>"
  data?: T
  failure?: {
    kind: usage | workspace | config | operation | cancelled | internal
    code: stable diagnostic code
  }
  diagnostics: Diagnostic[]
}
```

不变量：

- `success` 必须有 operation data，不得有 failure。
- `failure/cancelled` 必须有 failure，且至少一个 Diagnostic 的 code 与 `failure.code` 一致。
- warning 不把 success 自动改为 failure。
- data 和 Diagnostic 必须可直接序列化为 JSON，不含 Error、function、stream、handle 或 cyclic object。

### 7.2 CliDiagnosticResult

`CliDiagnosticResult` 只表达 CLI Adapter 在 operation 分派前产生的错误：

```text
CliDiagnosticResult {
  schemaVersion: 1
  kind: cliDiagnostic
  status: failure
  invocationId: "inv:<non-empty>"
  failure: {
    kind: usage | internal
    code: stable diagnostic code
  }
  diagnostics: Diagnostic[]
}
```

不变量：

- 顶层 `kind=cliDiagnostic` 是与 `ToolkitResult` 的机器判别字段。
- 不得携带 `operation`、`data` 或 `cancelled` 状态；分派前不存在业务 operation。
- 至少一个 Diagnostic 的 code 必须与 `failure.code` 一致。
- CLI Adapter 必须通过独立 `isCliDiagnosticResult` 与 `assertCliDiagnosticResult` 校验该信封。
- Application Service、UseCase Port、公共包入口和未来 MCP Adapter 不得引用或接收该类型；CLI 通过独立 bin 入口装配，不由 Application Service 包根导出。

### 7.3 JSON 可渲染联合

```text
RenderableResult = ToolkitResult<JsonValue> | CliDiagnosticResult
```

Renderer 先按 `kind=cliDiagnostic` 选择 CLI validator，否则使用 `ToolkitResult` validator；校验失败时不得序列化原对象。该联合只属于 CLI Adapter，不改变 Application Service 合同。

### 7.4 Diagnostic

```text
Diagnostic {
  severity: error | warning | info
  code: stable UPPER_SNAKE_CASE
  phase: stable phase name
  message: user-facing text
  file?: workspace-relative POSIX path
  range?: {
    start: { line, column }
    end: { line, column }
  }
  hint?: user-facing text
}
```

行列从 `1` 开始，end 为 exclusive。`message/hint` 可以演进，自动化只依赖 code 和结构。Diagnostic 返回前按 `phase order -> file UTF-8 -> range -> code -> emission sequence` 稳定排序。

### 7.3 TK-S01 错误码

| 类别 | 错误码 |
|---|---|
| CLI | `TK_CLI_UNKNOWN_COMMAND`、`TK_CLI_INVALID_ARGUMENT`、`TK_CLI_MISSING_ARGUMENT`、`TK_CLI_CONFLICTING_OPTION` |
| Workspace | `TK_WORKSPACE_NOT_FOUND`、`TK_WORKSPACE_MARKER_MISSING`、`TK_WORKSPACE_PATH_ESCAPE`、`TK_WORKSPACE_PATH_CONFLICT`、`TK_WORKSPACE_CHANGED` |
| Source | `TK_SOURCE_NOT_FOUND`、`TK_SOURCE_NOT_REGULAR`、`TK_SOURCE_TOO_LARGE`、`TK_SOURCE_INVALID_UTF8`、`TK_SOURCE_READ_FAILED` |
| Config | `TK_CONFIG_NOT_FOUND`、`TK_CONFIG_INVALID_JSON`、`TK_CONFIG_VERSION_UNSUPPORTED`、`TK_CONFIG_UNKNOWN_FIELD`、`TK_CONFIG_INVALID_VALUE` |
| Control | `TK_OPERATION_UNAVAILABLE`、`TK_OPERATION_CANCELLED`、`TK_INTERNAL_ERROR` |

后续分 Spec增加自己的稳定码，不得复用上述码表达另一语义。

## 8. 退出码与输出

### 8.1 退出码

| 退出码 | Result/failure kind |
|---:|---|
| `0` | success、help、version |
| `2` | usage |
| `3` | workspace |
| `4` | config |
| `10` | operation |
| `70` | internal |
| `130` | SIGINT cancellation |
| `143` | SIGTERM cancellation |

Library caller不消费进程退出码，只消费 ToolkitResult。CLI Adapter 在 renderer 完成后设置退出状态；不得在深层调用 `process.exit`。

### 8.2 JSON 模式

stdout 必须恰好包含一个 `ToolkitResult | CliDiagnosticResult` JSON 文档和末尾换行。stderr 必须为空；Diagnostic 和内部失败进入对应信封。禁止 ANSI、banner、progress 和非 JSON 日志。

已分派的 `build/inspect/run` 只能输出 `ToolkitResult`；未知命令和非法公共参数等分派前失败只能输出 `CliDiagnosticResult`。两种信封都必须在输出前通过各自 validator。

### 8.3 Human 模式

- 成功数据摘要写 stdout。
- warning/error Diagnostic 写 stderr。
- `--no-color` 或 `NO_COLOR` 禁用 ANSI。
- renderer 不改变 status、failure code 或 exit code。

## 9. Build Marker

TK-S01 在 Application Service 的 build 边界注入独立 `ToolkitObservationPort`：

```text
accepted build request
  -> build.started
  -> Workspace/config/use case
  -> success: build.completed
  -> failure/cancelled/internal: build.failed(errorCode)
```

规则：

1. CLI parse 失败尚未进入 build service，不产生 marker。
2. Workspace/config 失败已经进入 build service，产生 `build.failed`。
3. 每个 accepted build 只有一个 terminal marker。
4. marker 使用公共 Observation Schema：`producer=toolkit`、InvocationContext.runId、单调整数纳秒、稳定 clockDomain 和递增 sequence。
5. UseCase 返回 Artifact SHA-256 后，`build.completed` 才可携带 `artifactSha256`；TK-S01 不计算或猜测 Artifact hash。
6. Observation Port 拒绝、丢样或抛出内部异常时吞掉观测失败并保留业务结果；不得写入 Runtime `TraceSink`。

## 10. 状态与流程

### 10.1 Invocation 状态

```text
created
  -> parsed
  -> resolving_workspace
  -> ready
  -> executing
  -> succeeded | failed | cancelled
  -> disposed
```

任何 terminal 状态只能进入 `disposed`。`disposed` 释放 SourceUnit bytes、Diagnostic collector、临时句柄和 marker sequence state。

### 10.2 Build 流程

```text
parse argv
  -> create InvocationContext
  -> ApplicationService.build
  -> emit build.started
  -> resolve root/config
  -> load Manifest SourceUnit
  -> create WorkspaceSnapshot
  -> BuildUseCasePort.execute
  -> SourceAccess.verifyUnchanged
  -> normalize ToolkitResult
  -> emit terminal build marker
  -> dispose session
  -> render result
  -> map exit code
```

`verifyUnchanged` 必须发生在 UseCase 报告成功之后、最终成功提交之前。后续 TK-S07 的原子 Artifact commit 必须位于该检查之后。

## 11. 并发、取消与生命周期

TK-S01 运行在 Node.js 事件循环和异步 I/O 上，不新增 worker/thread。CPU 密集编译是否使用 worker 属于后续 Compiler 分 Spec。

- 一个 CLI 进程一次只执行一个顶层 operation。
- Library 形式的 Application Service 可并发调用，但每次 invocation 必须拥有独立 WorkspaceSnapshot、Diagnostic 和 marker sequence。
- SIGINT/SIGTERM 由 CLI Adapter 转为 CancellationToken；UseCase 在稳定边界检查。
- 取消后不开始新文件读取或新阶段；在途 I/O完成后丢弃结果并返回 cancelled。
- dispose 为幂等；迟到 callback 只能观察已取消 token，不能复活 session。

## 12. 错误与降级

| 失败 | 行为 |
|---|---|
| CLI 参数错误 | 不调用 Application Service；返回 usage Diagnostic |
| Workspace/config 错误 | 不调用 UseCase；返回对应失败和 build.failed（build 时） |
| Source 读取/变化 | 失败整次 operation，不使用旧缓存伪装成功 |
| UseCase typed failure | 原样保留 operation Diagnostic；统一 Result envelope |
| UseCase 抛出异常 | 收口为 `TK_INTERNAL_ERROR`；Human 默认不暴露堆栈 |
| Observation 失败 | 仅丢失样本，不增加业务 warning，不改变 Result |
| Renderer 失败 | 尝试最小内部错误输出并返回 `70`；不改写已执行 UseCase 的事实记录 |
| 未安装 operation contribution | `TK_OPERATION_UNAVAILABLE`，不得空成功 |

TK-S01 不提供自动修复配置、自动选择其他 Workspace、自动重试 Compiler 或恢复半成品。

## 13. 实现结构

对应分 Spec通过并获得编码授权后，代码按以下责任目录初始化：

```text
src/
├── cli/
│   ├── main.ts
│   ├── command-registry.ts
│   ├── common-options.ts
│   ├── result-renderer.ts
│   └── exit-code-mapper.ts
├── application/
│   ├── toolkit-application-service.ts
│   ├── invocation-context.ts
│   ├── operation-contracts.ts
│   └── use-case-ports.ts
├── workspace/
│   ├── workspace-resolver.ts
│   ├── config-resolver.ts
│   ├── source-access.ts
│   └── workspace-types.ts
├── diagnostics/
│   ├── diagnostic.ts
│   └── diagnostic-collector.ts
└── observation/
    └── toolkit-observation-port.ts

test/
├── unit/
├── integration/
└── fixtures/
```

依赖方向固定：`cli -> application -> workspace/ports`；workspace 不依赖 cli，UseCase Port 不依赖 renderer。Node 文件系统、时钟和 signal 通过 Adapter 注入测试替身。

## 14. 后续扩展边界

- TK-S02/TK-S03 消费 `SourceAccess`，不修改 Workspace 发现。
- TK-S07 完成 BuildUseCase 与原子 Artifact commit，不把打包规则写回 CLI。
- TK-S08 为 inspect/run 提供 typed parser、ConfigSection、UseCase 和 result data；不新建第二个 Application Service。
- TK-S09 追加真实 Case/Golden，不改变 Result/Diagnostic/exit 基础合同。
- 第二期入口直接构造 typed request 并调用 Application Service；不得执行 argv 或解析 Human 输出。
