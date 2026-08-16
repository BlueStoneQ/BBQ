# TK-S01 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)

## 1. 结论

TK-S01 实现按“合同 -> Workspace -> Application Service -> CLI -> 观测 -> 验收”推进。每项任务都必须能在 Compiler 尚未实现时通过 Fake UseCase 独立验证。

本文是后续编码任务，不代表当前获得编码授权。

## 2. 门禁

开始实现前必须同时满足：

1. 本分 Spec 独立校审 `PASS`。
2. `AGENT-WORK-BOARD.md` 对 TK-S01 明确设置 `CODE_ALLOWED`。
3. 产品工程仍为空基线，不恢复旧 Toolkit 实现。

未满足时只能修改本分 Spec 和 Handoff。

## 3. 实现任务

### TK-S01-T01 工程基线

- 初始化 Node.js 22 + TypeScript strict + ESM 工程。
- 建立 `src/cli`、`src/application`、`src/workspace`、`src/diagnostics`、`src/observation` 和 `test`。
- 固定 `typecheck`、`test`、`lint` 和 CLI integration test 命令。
- 禁止初始化 Compiler、IR、Bundle 或 RPK 目录占位实现。

完成定义：最小 CLI 可输出 help/version；所有测试命令在 clean checkout 可执行。

### TK-S01-T02 Result、Diagnostic 与错误码

- 实现 `ToolkitResult<T>` 判别联合及不变量校验。
- 实现 CLI Adapter 私有 `CliDiagnosticResult`、独立 type guard/validator 和可渲染封闭联合；禁止 `operation=cli`。
- 实现 Diagnostic 类型、稳定排序和 TK-S01 错误码目录。
- 实现预期错误到 typed failure、未预期异常到 `TK_INTERNAL_ERROR` 的收口。
- 添加 JSON serialization 正负例。

完成定义：非法 Result 无法通过类型/运行期断言；错误不依赖异常 message 分类。

### TK-S01-T03 WorkspaceResolver

- 实现显式 Workspace 与 cwd 最近祖先发现。
- 识别 `quickapp.config.json` 或默认 `src/manifest.json` 根标记。
- canonicalize root 并实现 containment、路径冲突、符号链接越界校验。
- 添加 Case 001/002 默认目录发现集成测试。

完成定义：相同根从根目录和任意内部目录发现为同一 canonical Workspace。

### TK-S01-T04 ConfigResolver

- 实现严格 JSON、`schemaVersion=1`、workspace section 和 typed ConfigSection Registry。
- 实现 `explicit override > config > default` 和 provenance。
- 校验 source/output/cache 路径、重叠和 Workspace containment。
- 证明语义配置不读取环境变量。

完成定义：未知字段/版本/类型稳定失败；每个最终值可回溯来源。

### TK-S01-T05 SourceAccess 与 WorkspaceSnapshot

- 实现 POSIX 逻辑路径验证、确定性 list/stat/read。
- 实现 `ReadPolicy` byte limit、strict UTF-8、immutable bytes 和 SHA-256。
- 实现 session 内去重读取、已读文件 identity 记录和 `verifyUnchanged`。
- 实现 dispose 释放与取消后的 late result 丢弃。

完成定义：越界、symlink escape、重复 canonical target、过大、非法 UTF-8 和构建中变更均有固定 Diagnostic。

### TK-S01-T06 Application Service

- 实现 `InvocationContext`、CancellationToken 和每次调用独立 session。
- 实现 build/inspect/run 方法和静态 UseCase Port 注入。
- 完整实现 build 的 Workspace/config/session 编排。
- 为 inspect/run 保留 TK-S08 typed contribution，未安装时返回 `TK_OPERATION_UNAVAILABLE`。
- 确保 service 不读取 argv、不写 stdout/stderr、不调用 `process.exit`。

完成定义：Fake UseCase 可证明请求只委派一次、typed failure 原样返回、异常被收口、session 必定 dispose。

### TK-S01-T07 CLI Adapter

- 实现顶层 command registry、公共选项和 build workspace operand。
- 实现非交互 parse、help/version 和未知参数失败。
- 实现 Human/JSON renderer 与 ExitCodeMapper。
- renderer 必须分别校验 `ToolkitResult` 与 `CliDiagnosticResult`，并保证 JSON stdout 只有一个文档。
- 实现 SIGINT/SIGTERM 到 CancellationToken 的单向转换。

完成定义：JSON stdout 只有一个文档；Human stdout/stderr 分流正确；深层模块不设置进程退出状态。

### TK-S01-T08 Build Marker

- 实现 `ToolkitObservationPort` 和 Noop/Fake Adapter。
- 在 build service 边界产生 started 与唯一 terminal marker。
- 对齐公共 Observation Schema 的 runId、clockDomain、sequence、整数纳秒和 errorCode。
- 证明 marker emitter 失败不改变 ToolkitResult。

完成定义：公共 Schema 可校验全部 marker；parse failure 无 marker，Workspace failure 有 started/failed。

### TK-S01-T09 集成与边界测试

- 使用 Fake BuildUseCase 从 CLI 跑通 root discovery -> service -> result -> renderer -> exit。
- 覆盖 Case 001/002、嵌套 cwd、显式 config、JSON/Human、取消和内部异常。
- 添加架构依赖检查：CLI 不直接依赖 Compiler/Runtime，Workspace 不依赖 CLI。
- 添加架构依赖检查：Application Service、UseCase Port 和公共包入口不得依赖 CLI 私有结果类型。
- 覆盖未知命令、非法公共参数、错误信封拒绝、JSON 单文档和 Application Service 隔离。
- 扫描产品代码，确保没有 Skill/MCP、Runtime TraceSink、Collector、IR/Bundle/RPK 实现。

完成定义：满足 [Acceptance](./acceptance.md) 全部 TK-S01 条目并保存机器可读证据。

## 4. 依赖顺序

```text
T01
  -> T02
  -> T03 + T04
  -> T05
  -> T06
  -> T07 + T08
  -> T09
```

T03/T04 可并行，但 T05 必须消费二者冻结后的 WorkspaceContext。T07/T08 可并行，但都只能通过 Application Service 边界接入。

## 5. 完成定义

TK-S01 只有同时满足以下条件才可标记实现完成：

1. 需求 `TK-S01-R01..R28` 均有测试或静态证据。
2. Case 001/002 可被默认 Workspace 规则发现并读取 Manifest SourceUnit。
3. Fake UseCase 证明 CLI 和 Application Service 委派闭环，不伪造真实 Compiler 成功。
4. JSON/Human、Diagnostic、exit code、取消和 Build Marker 正负例全部通过。
5. 路径越界、文件变化和配置错误不会调用 BuildUseCase。
6. 未产生 Compiler、Artifact、Skill/MCP 或 Runtime 观测实现。
7. 代码、测试和证据通过本分 Spec独立验收后，才允许推进依赖 TK-S01 的 TK-S02/TK-S03。
