# TK-S01 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. 验收边界](#2-验收边界)
- [3. 正例](#3-正例)
- [4. 负例](#4-负例)
- [5. 故障注入与资源](#5-故障注入与资源)
- [6. 需求覆盖](#6-需求覆盖)
- [7. 证据](#7-证据)
- [8. 通过条件](#8-通过条件)

## 1. 结论

TK-S01 的通过标准是：**在没有真实 Compiler/Runtime 的前提下，CLI 和 typed caller 都能确定地解析同一 Workspace、调用同一 Application Service，并得到同一结构化成功或失败事实。**

本分 Spec 不以生成 JS Bundle、Page IR 或 RPK 作为通过条件；把 Fake UseCase 结果说成真实 build 成功反而验收失败。

## 2. 验收边界

测试对象：

```text
Command Registry / common options / build workspace operand
ToolkitApplicationService
WorkspaceResolver / ConfigResolver / SourceAccess
ToolkitResult / Diagnostic / Renderer / ExitCodeMapper
CliDiagnosticResult / independent validator
ToolkitObservationPort build markers
```

测试替身：

- Memory/File-system sandbox。
- Fake Build/Inspect/Run UseCase Port。
- Fake monotonic clock 和 Observation Port。
- Fake CancellationToken/signal Adapter。

真实输入只用于 Workspace 兼容证明：Case 001 和 Case 002 源码目录。联盟 build/dist/RPK 只作研究事实，不进入 TK-S01 执行合同。

## 3. 正例

### 3.1 CLI 与委派

| Case | 操作 | 预期 |
|---|---|---|
| `CLI-P01` | `quickapp --help` | 列出且只列出 build/inspect/run；退出 `0`；不调用 service |
| `CLI-P02` | `quickapp --version` | 单行 semantic version；退出 `0`；不调用 service |
| `CLI-P03` | `quickapp build <case001>` | Workspace 解析成功；BuildUseCase 只调用一次；Fake success 映射退出 `0` |
| `CLI-P04` | 在 Case 001 页面子目录执行 `quickapp build` | 向上找到 Case 001 根，结果与显式根一致 |
| `CLI-P05` | `--format json` Fake success | stdout 恰好一个 schemaVersion=1 Result；stderr 为空；无 ANSI/banner |
| `CLI-P06` | Human Fake success with warning | success 摘要到 stdout，warning 到 stderr，退出仍为 `0` |
| `CLI-P07` | typed caller 调用 service.build | 不依赖 argv/stdout；返回与等价 CLI request 同语义 Result |
| `CLI-P08` | 注册 TK-S08 Fake inspect/run contribution | 各自只调用对应 service 方法；公共选项语义不变 |

### 3.2 Workspace 与配置

| Case | 操作 | 预期 |
|---|---|---|
| `WS-P01` | 解析 Case 001 | root、`src`、Manifest SourceUnit 和逻辑路径正确 |
| `WS-P02` | 解析 Case 002 | 无配置也按默认值成功 |
| `WS-P03` | nested Workspace | 最近祖先胜出，不合并父 Workspace |
| `WS-P04` | root 同时有 config 和 manifest marker | 唯一 root；config 覆盖 workspace defaults |
| `CFG-P01` | default + config + explicit override | 每个值按优先级解析，provenance 完整 |
| `CFG-P02` | 显式内部 config path | 只加载该文件，不再叠加 root 默认 config |
| `SRC-P01` | 两次读取同一文件 | 返回同一 bytes/hash 事实；不重复访问可变文件内容 |
| `SRC-P02` | 枚举同一目录 | 不同 OS/locale 下按 UTF-8 logical path 稳定排序 |
| `SRC-P03` | strict UTF-8 text | text、byteLength、SHA-256 与原 bytes 一致 |

### 3.3 Build Marker

| Case | 预期 |
|---|---|
| `OBS-P01` Fake build success | `build.started -> build.completed`，sequence 递增，同一 runId/clockDomain |
| `OBS-P02` Workspace failure | `build.started -> build.failed(errorCode=TK_WORKSPACE_NOT_FOUND)` |
| `OBS-P03` Artifact hash available | completed 可携带 UseCase 返回的 SHA-256；TK-S01 不自行计算 Artifact hash |

全部 marker 必须通过公共 `observation.schema.json`。

## 4. 负例

### 4.1 CLI 与结果

| Case | 输入 | 预期码/行为 |
|---|---|---|
| `CLI-N01` | 未知命令 | `kind=cliDiagnostic`、无 operation、`TK_CLI_UNKNOWN_COMMAND` / exit `2` / service 未调用 |
| `CLI-N02` | `--format yaml` | `kind=cliDiagnostic`、无 operation、`TK_CLI_INVALID_ARGUMENT` / exit `2` / service 未调用 |
| `CLI-N03` | 选项缺值或重复单值 | missing/conflicting Diagnostic / exit `2` |
| `CLI-N04` | JSON parse failure output | 仍为单一 `CliDiagnosticResult` JSON，stderr 空 |
| `CLI-N05` | 未安装 inspect/run contribution | `TK_OPERATION_UNAVAILABLE` / exit `10`，不得空成功 |
| `RES-N01` | Fake UseCase 返回非法 Result | 收口内部失败，不把非法 data 输出为成功 |
| `RES-N02` | warning-only success | 退出 `0`；warning 不升级为 failure |
| `RES-N03` | CliDiagnosticResult 带 operation/data、缺少 kind 或 primary Diagnostic | CLI validator 拒绝，renderer 不输出原对象 |
| `RES-N04` | CliDiagnosticResult 传入 ToolkitResult validator/Application Service 边界 | 必须拒绝；UseCase 不得收到该对象 |

### 4.2 Workspace、Source 与配置

| Case | 输入 | 预期 |
|---|---|---|
| `WS-N01` | cwd 到根均无 marker | `TK_WORKSPACE_NOT_FOUND` / exit `3` / UseCase 未调用 |
| `WS-N02` | 显式目录无 marker | `TK_WORKSPACE_MARKER_MISSING` / exit `3` |
| `WS-N03` | 绝对 logical member、`..`、反斜线、NUL | `TK_WORKSPACE_PATH_ESCAPE` |
| `WS-N04` | symlink 指向 root 外 | 读取前拒绝，UseCase 不获得 bytes |
| `WS-N05` | 两个 logical path 指向同一 canonical file | `TK_WORKSPACE_PATH_CONFLICT` |
| `SRC-N01` | 文件不存在/目录/设备文件 | 对应 not-found/not-regular Diagnostic |
| `SRC-N02` | 超过 ReadPolicy.maxBytes | `TK_SOURCE_TOO_LARGE`，不做无界读取 |
| `SRC-N03` | 非法 UTF-8 按 strictUtf8 读取 | `TK_SOURCE_INVALID_UTF8` |
| `CFG-N01` | 配置不存在/非法 JSON | exit `4`，UseCase 未调用 |
| `CFG-N02` | schemaVersion 未知 | `TK_CONFIG_VERSION_UNSUPPORTED` |
| `CFG-N03` | 未注册字段/section field | `TK_CONFIG_UNKNOWN_FIELD`，不静默保留 |
| `CFG-N04` | source/output/cache 越界或重叠 | `TK_CONFIG_INVALID_VALUE` |
| `CFG-N05` | 设置任意语义环境变量 | 结果不变；只有 NO_COLOR 可改变显示 |

## 5. 故障注入与资源

### 5.1 故障注入

| Case | 注入 | 预期 |
|---|---|---|
| `FI-01` | BuildUseCase typed failure | 保留其 primary code，exit `10`，started/failed 各一次 |
| `FI-02` | BuildUseCase throw/reject | `TK_INTERNAL_ERROR`，exit `70`，不暴露裸堆栈 |
| `FI-03` | Observation Port throw/drop | ToolkitResult、exit code 和 UseCase 调用次数不变 |
| `FI-04` | 文件首次读取后被替换/修改/删除 | `verifyUnchanged` 返回 `TK_WORKSPACE_CHANGED`，最终 success 被拒绝 |
| `FI-05` | SIGINT while UseCase pending | token cancelled；最终 status cancelled；exit `130`；session dispose 一次 |
| `FI-06` | SIGTERM while UseCase pending | token cancelled；exit `143` |
| `FI-07` | Renderer failure | 最小内部错误路径；exit `70`；不重跑 UseCase |

### 5.2 资源与生命周期

1. 连续 100 次 Fake build 后，活动 BuildSession、SourceUnit storage、signal listener 和 Observation sequence state 回到基线。
2. 取消、Workspace failure、UseCase failure 和 success 四条路径都只 dispose 一次。
3. late file/use-case callback 不得改变 terminal Result 或产生第二个 terminal marker。
4. `SourceAccess.list/read` 必须受数量/byte policy 控制，不创建无界内存队列。
5. 并发 library invocation 的 cwd/config/Diagnostic/runId 不串扰。

## 6. 需求覆盖

| 需求 | 主要证据 |
|---|---|
| R01-R03 | CLI-P01/P02、CLI-N01..N04 |
| R04-R05 | CLI-P03/P04、WS-P01..P04、WS-N01/N02 |
| R06-R08 | CFG-P01/P02、CFG-N01..N05 |
| R09-R12 | WS-P01/P02、SRC-P01..P03、WS-N03..N05、SRC-N01..N03、FI-04 |
| R13-R15 | CLI-P03/P07/P08、CLI-N05、Application Service unit tests |
| R16-R17 | RES-N01/N02、FI-01/FI-02、Diagnostic serialization fixtures |
| R18-R21 | CLI-P05/P06、CLI-N04、FI-05/FI-06/FI-07 |
| R22-R23 | OBS-P01..P03、FI-03、public Schema validation |
| R24 | WS-P03、SRC-P02、cross-platform path fixtures |
| R25 | 全部测试只使用 Fake UseCase，不依赖 Compiler/Runtime |
| R26 | CLI-N01..N04、CliDiagnosticResult serialization fixture |
| R27 | CLI-N01/N02、RES-N04、Application/UseCase/public export architecture scan |
| R28 | RES-N01、RES-N03/N04、renderer validator unit tests |

## 7. 证据

实现 Agent 必须提交：

- Node/TypeScript 版本与 clean install 记录。
- typecheck、lint、unit、integration 的机器可读结果。
- Case 001/002 WorkspaceContext 摘要与 Manifest SourceUnit SHA-256。
- Human/JSON stdout/stderr/exit code Golden。
- Config provenance Golden。
- 路径越界、symlink、file-change、取消和内部异常负例。
- 公共 Observation Schema 对 Build Marker 的校验结果。
- 依赖扫描和禁止范围扫描结果。

证据不得包含私钥内容；Case 001 的 `sign/private.pem` 不属于 Workspace 默认 sourceRoot，也不得被测试输出读取。

## 8. 通过条件

必须同时满足：

1. 正例、负例、故障注入和资源项全部通过。
2. `TK-S01-R01..R28` 无未覆盖项。
3. Case 001/002 只证明 Workspace 兼容，不伪造 Compiler/RPK 成功。
4. `inspect/run` 只验证静态委派槽位，没有抢占 TK-S08 语义。
5. 产品代码中不存在 Compiler Pipeline、IR、Bundle、RPK、Skill/MCP、Runtime TraceSink 或 Collector 实现。
6. 无公共合同冲突；若后续发现冲突，必须先在 Handoff 记录 `[待决策]`。
