# TK-S01 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 功能需求](#2-功能需求)
- [3. 质量需求](#3-质量需求)
- [4. 非目标](#4-非目标)
- [5. 上游需求映射](#5-上游需求映射)

## 1. 结论

TK-S01 必须提供一个**无业务语义、非交互、可复用、可确定失败**的 Toolkit 入口层：任何调用都先得到唯一 Workspace 和配置，再调用 Application Service，最终只产生一个结构化结果。

## 2. 功能需求

| ID | 需求 |
|---|---|
| TK-S01-R01 | CLI 必须保留且只保留 V1 顶层命令名 `build`、`inspect`、`run`；未知命令稳定失败。 |
| TK-S01-R02 | 顶层必须支持 `--help`、`--version`；三个命令必须共享 `--config <path>`、`--format <human\|json>`、`--no-color` 和命令级 `--help`。 |
| TK-S01-R03 | CLI 必须非交互；缺少、冲突或非法参数必须直接返回 Diagnostic，不得提问、猜测或等待 stdin。 |
| TK-S01-R04 | `build [workspace]` 的 workspace 为空时必须从调用 `cwd` 向上发现最近 Workspace；显式路径优先于自动发现。 |
| TK-S01-R05 | Workspace 根标记必须是根目录的 `quickapp.config.json` 或默认位置 `src/manifest.json`；无标记时返回 `TK_WORKSPACE_NOT_FOUND`。 |
| TK-S01-R06 | 配置必须使用版本化 JSON；显式 `--config` 优先于 `<workspace>/quickapp.config.json`，单次调用只加载一个配置文件，不做隐式级联继承。 |
| TK-S01-R07 | 配置值优先级固定为 `typed/CLI explicit override > workspace config > built-in default`；环境变量不得提供编译语义值。 |
| TK-S01-R08 | 配置解析必须保留每个最终值的 provenance；未知字段、未知版本、类型错误、非法路径不得静默忽略。 |
| TK-S01-R09 | Workspace 必须产出规范绝对根路径、POSIX 逻辑路径、source/output/cache 根、Manifest SourceUnit 和配置 provenance。 |
| TK-S01-R10 | 下游文件读取必须通过 `SourceAccess`；读取结果为不可变 `SourceUnit`，包含逻辑路径、bytes、byteLength、SHA-256 和文本编码事实。 |
| TK-S01-R11 | `SourceAccess` 必须拒绝绝对成员路径、反斜线、空段、`.`/`..`、NUL、Workspace 越界、非普通文件和越界符号链接。 |
| TK-S01-R12 | 同一 Build Session 内同一逻辑文件只能暴露同一 bytes；构建结束前检测已读文件变化，变化时整次操作失败。 |
| TK-S01-R13 | Toolkit Application Service 必须暴露 `build`、`inspect`、`run` 三个 typed operation；CLI 只能调用该服务，不得直接调用 Compiler 或 Runtime Launcher。 |
| TK-S01-R14 | `build` 必须委派给 `BuildUseCasePort`；`inspect/run` 的 request、校验和 UseCase 由 TK-S08 定义，TK-S01 只冻结方法名、公共上下文和结果形态。 |
| TK-S01-R15 | Application Service 必须接收显式 `cwd`、取消令牌和依赖 Port，不得读取可变进程全局作为业务输入。 |
| TK-S01-R16 | 每次 Application Service 调用必须返回 `operation=build\|inspect\|run` 的 `ToolkitResult<T>`；成功、失败、取消和内部错误不得依赖异常文本、日志文本或文件存在性判断。 |
| TK-S01-R17 | 所有用户可处理问题必须返回稳定 `Diagnostic`，至少包含 severity、code、phase、message，可选 file/range/hint。 |
| TK-S01-R18 | `--format json` 必须只向 stdout 写一个版本化 `ToolkitResult \| CliDiagnosticResult` JSON 文档；两种信封必须可机器区分并在序列化前分别校验，人类装饰文本、进度、版本 banner 和 ANSI 不得混入。 |
| TK-S01-R19 | Human 模式成功摘要写 stdout，warning/error 写 stderr；JSON 模式的全部 Diagnostic 写入结果文档。 |
| TK-S01-R20 | CLI 必须按冻结失败类别映射退出码；任何非成功结果不得返回 `0`，帮助和版本返回 `0`。 |
| TK-S01-R21 | CLI Adapter 是唯一允许读取 argv、设置进程退出状态和处理 SIGINT/SIGTERM 的部件；Application Service 不调用 `process.exit`。 |
| TK-S01-R22 | `build` 必须尝试产生公共 `build.started` 与且仅一个 `build.completed` 或 `build.failed`；marker 失败不得改变构建结果。 |
| TK-S01-R23 | Toolkit 观测只通过本地 `ToolkitObservationPort` 输出公共 marker；不得实现或依赖 Runtime `TraceSink`、Platform Collector 或文件存储。 |
| TK-S01-R24 | 路径、配置和 SourceUnit 的规范化结果必须与当前平台路径分隔符无关；相同 Workspace 内容不得因调用目录不同改变逻辑输入。 |
| TK-S01-R25 | TK-S01 必须能仅用 Fake Build/Inspect/Run Port 完成单元和 CLI 集成验收，不等待 Compiler、RPK 或 Platform Runtime 实现。 |
| TK-S01-R26 | CLI 分派前失败必须使用 CLI Adapter 私有、`schemaVersion=1`、`kind=cliDiagnostic`、`status=failure` 的 `CliDiagnosticResult`；该信封不得携带 `operation` 或 `data`。 |
| TK-S01-R27 | `CliDiagnosticResult` 不得进入 Application Service、UseCase Port、公共包入口或未来 MCP 调用面；这些调用面只接受和返回 operation-scoped typed contract。 |
| TK-S01-R28 | CLI Adapter 必须为 `CliDiagnosticResult` 提供独立 type guard/运行期 validator；`ToolkitResult` 与 `CliDiagnosticResult` 任一非法信封都不得被 renderer 输出。 |

## 3. 质量需求

| 维度 | 要求 |
|---|---|
| 分层 | CLI -> Application -> Workspace/UseCase Port；文件系统和进程细节不得反向进入 Domain/Compiler。 |
| 确定性 | 配置来源、逻辑路径、目录枚举、Diagnostic 排序和 JSON 字段语义固定。 |
| 可移植 | 逻辑路径统一使用 `/`；Windows/macOS/Linux 文件系统差异封装在 Workspace Adapter。 |
| 安全 | 所有路径经 canonical containment 校验；不跟随 Workspace 外符号链接；读取有显式 byte limit。 |
| 可诊断 | 不输出裸堆栈作为用户合同；内部异常有稳定外部码并可在开发模式保留内部 cause。 |
| 可复用 | CLI、未来入口共用 Application Service request/result；CLI 私有诊断信封和终端文本都不进入其他入口。 |
| 可测试 | 时钟、文件系统、cwd、signal、Observation、UseCase 均可注入 Fake。 |
| 轻量 | 不引入 watch daemon、全局容器、动态插件系统或第二套 Schema 平台。 |
| 内存 | Source bytes 只在一次 Build Session 内持有，结束后整体释放；目录枚举和 Diagnostic 有界。 |
| 兼容 | Case 001/002 默认目录无需额外配置即可解析为 Workspace。 |

## 4. 非目标

- 定义 Compiler Pipeline 或构建产物内容。
- 定义 Manifest、Page IR、Bundle、RPK 或 Runtime Composition Schema。
- 定义 `inspect/run` 的业务参数、成功条件或目标 Runtime 协议。
- 实现 watch、dev server、交互选择、远程下载、ADB 或设备发现。
- 实现 Skill/MCP、VS Code 插件或 Agent 专用输出。
- 直接执行联盟 RPK/RPKS。

## 5. 上游需求映射

| 上游需求 | TK-S01 覆盖 |
|---|---|
| `QK-R13` / `TK-R01` | 顶层命令、非交互 CLI、Application Service、结构化结果和退出码 |
| `TK-R13` | 仅保留 `inspect` 命令入口；包分析语义归 TK-S08 |
| `TK-R14` | 仅保留 `run` 命令入口和委派边界；Launch Profile 归 TK-S08 |
| `QK-R18` | Toolkit 私有跨层结构具备结构、所有权、生命周期和错误语义 |
| `QK-R21` | Toolkit 只产生公共 Build Marker，不建设 Runtime 观测机制 |
| Toolkit 质量需求 | 确定性、可诊断、可测试、可扩展、平台无关 |
