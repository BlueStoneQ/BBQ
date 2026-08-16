# TK-S01 CLI 与 Workspace

## 目录

- [1. 结论](#1-结论)
- [2. 本质](#2-本质)
- [3. 范围](#3-范围)
- [4. 输入与输出](#4-输入与输出)
- [5. 依赖](#5-依赖)
- [6. 事实与决策](#6-事实与决策)
- [7. 交付物](#7-交付物)
- [8. 状态](#8-状态)

## 1. 结论

TK-S01 冻结 Toolkit 的稳定入口：**把 CLI 或其他调用方的意图规范化为 Application Service 请求，把工作目录规范化为不可变 Workspace 上下文，再把结构化结果映射为输出与退出码。**

主链路固定为：

```text
argv / typed caller
  -> Command Adapter
  -> pre-dispatch failure: CliDiagnosticResult
  -> dispatched request: Toolkit Application Service
  -> WorkspaceResolver + ConfigResolver + SourceAccess
  -> Build / Inspect / Run UseCase Port
  -> ToolkitResult
  -> Human/JSON Renderer(ToolkitResult | CliDiagnosticResult) + ExitCodeMapper
```

CLI 不包含编译规则；Workspace 不解释 Manifest、UX、Script 或 Style；Application Service 不依赖终端、进程退出或平台 Runtime。`inspect/run` 的输入语义与执行过程由 TK-S08 定义。

## 2. 本质

CLI 解决“用户如何表达一次操作”，Workspace 解决“这次操作能读取哪一组确定输入”。二者都不是 Compiler。

TK-S01 建立三个稳定边界：

1. **调用边界**：所有入口调用同一 Toolkit Application Service。
2. **文件边界**：下游只通过受约束的 `SourceAccess` 读取 Workspace，不直接散落文件系统访问。
3. **结果边界**：已分派 operation 只产生 `ToolkitResult`；分派前 CLI 错误只产生私有 `CliDiagnosticResult`；二者不靠日志判断且不能跨层混用。

## 3. 范围

### 3.1 负责

- 注册顶层 `build`、`inspect`、`run` 命令名。
- 冻结公共 CLI 参数、帮助/版本行为和非交互约束。
- 发现 Workspace、加载配置、计算优先级并保留配置来源。
- 建立 `WorkspaceContext`、`WorkspaceSnapshot`、`SourceUnit` 与 `SourceAccess`。
- 冻结 Toolkit Application Service 的调用形态。
- 冻结 `ToolkitResult`、CLI 私有 `CliDiagnosticResult`、`Diagnostic`、JSON 输出和退出码映射。
- 为 `build` 调用边界产生公共 `build.started/completed/failed` marker。
- 定义取消、异常收口、路径越界和 Workspace 变化行为。

### 3.2 不负责

- Manifest/Module Graph、UX/Script/Style 解析。
- Canonical Lowering、Template ID、Page IR、JS Bundle、Runtime Metadata、RPK。
- `inspect` 的包识别/报告语义和 `run` 的 Runtime Launch Profile/Launcher 语义。
- Runtime `TraceSink`、Collector、日志存储、统计和分析。
- Skill、MCP、编辑器 UI、交互式向导、watch/server。
- 恢复或兼容旧 Toolkit 代码结构。

## 4. 输入与输出

### 4.1 输入

```text
Process argv + cwd + process signals
或 typed Application Service request
  + optional quickapp.config.json
  + Workspace files
```

### 4.2 输出

```text
Resolved Command
WorkspaceContext + WorkspaceSnapshot/SourceAccess
ToolkitResult<T>
CliDiagnosticResult（仅 CLI 分派前失败）
Diagnostic[]
CLI stdout/stderr + exit code
build.* Observation Marker（仅 build）
```

TK-S01 本身不产生 Runtime Artifact。使用 Fake UseCase Port 验收委派、结果和边界；真实构建产物由 TK-S02 至 TK-S07 完成。

## 5. 依赖

### 5.1 上游合同

- [平台总 Spec](../../../../../spec/README.md)
- [Toolkit 总 Spec](../../README.md)
- [Toolkit 分 Spec 索引](../../subspec-index.md)
- [Runtime Artifact Contract](../../../../../spec/contracts/artifact-contract.md)
- [Runtime Launch Profile Contract](../../../../../spec/contracts/runtime-launch-profile.md)
- [Runtime Composition Contract](../../../../../spec/contracts/runtime-composition-contract.md)
- [Observation Contract](../../../../../spec/contracts/observation-contract.md)

### 5.2 下游使用者

| 下游 | 使用 TK-S01 的内容 |
|---|---|
| TK-S02/TK-S03 | `WorkspaceContext`、`SourceAccess`、Diagnostic contract |
| TK-S04..TK-S07 | Build Session 上下文、Result/Diagnostic contract |
| TK-S08 | `inspect/run` 命令槽位、Application Service 方法、公共 CLI 参数和结果合同 |
| TK-S09 | CLI、Workspace、结构化结果、退出码和 Build Marker 验收 |
| 第二期入口 | 直接调用 Application Service，不解析 CLI 文本输出 |

## 6. 事实与决策

### 6.1 已验证事实

- Case 001/002 都以 `src/manifest.json` 为源码入口结构。
- Case 001 通过 `hap build/release/debug` 调用联盟 Toolkit；联盟 CLI 接收工作目录并将编译结果写入 build/dist。
- Case 001 包含 `.ux`、JS、Less、JSON 和二进制资源，Workspace 不能只处理单一文件类型。
- 联盟 Toolkit CLI 与编译实现存在进程全局状态和直接日志/退出行为；该事实只用于识别风险，不作为 v3 结构依据。

### 6.2 本分 Spec 冻结决策

- V1 Toolkit 实现基线为 Node.js 22、TypeScript strict、ESM；CLI 核心优先使用 Node 标准能力，不引入业务框架。
- Workspace 默认入口为 `<root>/src/manifest.json`；可由版本化 `quickapp.config.json` 修改 `sourceRoot`，但不得把路径解析成 Workspace 外部访问。
- 语义配置不读取环境变量；环境只允许影响 `NO_COLOR` 这类显示行为。
- Application Service 返回值是唯一成功事实；日志、窗口出现、输出文件存在都不能单独代表成功。
- 预期错误不跨 Application Service 边界抛出；未预期异常统一收口为内部失败。

### 6.3 待后续分 Spec 冻结

- `build` 的 Compiler options 与真实 Artifact 结果字段。
- `inspect` 的输入类型、报告字段和 Composition Manifest 语义。
- `run` 的目标选择、Launch Profile 和目标进程生命周期。

以上不是 TK-S01 阻塞项。

## 7. 交付物

1. [Requirements](./requirements.md)
2. [Design](./design.md)
3. [Tasks](./tasks.md)
4. [Acceptance](./acceptance.md)

## 8. 状态

`READY_FOR_REVIEW`：TK-S01 已完成 CLI Diagnostic 定向返修；TK-S02 仍不得启动。
