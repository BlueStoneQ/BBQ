# Toolkit 总 Spec：总体架构

## 目录

- [1. 结论](#1-结论)
- [2. 架构分层](#2-架构分层)
- [3. 编译主流程](#3-编译主流程)
- [4. 核心数据边界](#4-核心数据边界)
- [5. CLI 与增量构建](#5-cli-与增量构建)
- [6. 第二期 Agent 调用面](#6-第二期-agent-调用面)
- [7. 错误与观测](#7-错误与观测)
- [8. 跨项目合同](#8-跨项目合同)

## 1. 结论

Toolkit 采用**前端语义模型与后端 Artifact Emitter 分离**的编译器架构：联盟语法只存在前端，Runtime 合同只存在后端，中间使用平台无关的规范语义模型连接。

## 2. 架构分层

```text
CLI / Config
  -> Workspace & Source Loader
  -> Manifest Resolver
  -> UX / Script / Style Frontend
  -> Semantic Model
  -> Template / Style / Binding / Block / Event Lowering
  -> JS Bundle Emitter + Page IR Emitter
  -> Runtime Metadata & Artifact Validator
  -> RPK Packager
```

| 部件 | 负责 | 不负责 |
|---|---|---|
| CLI | 命令、参数、退出码、输出和 Runtime 调用 | 编译语义 |
| Source Loader | 工作区、路径、编码、依赖读取 | DSL 解释 |
| Frontend | 解析联盟语法并保留源码位置 | Runtime ID、平台对象 |
| Semantic Model | 统一 route、component、style、expression、block、event 语义 | 序列化格式 |
| Lowering | 规范组件/Style、静态 ID、Binding/Block/Event 关系 | Runtime NodeId |
| Emitters | 输出 Bundle、Page IR、Metadata、Source Map | 执行 JS 或渲染 |
| Validator | Schema、图关系、跨 Artifact 一致性 | 修复无效产物 |
| Packager | 固定布局、哈希、ZIP 和可重复构建 | Release 信任策略 |

## 3. 编译主流程

```text
discover manifest and sources
  -> parse all source units
  -> resolve routes/modules/assets
  -> build immutable semantic model
  -> assign stable Template*Id
  -> lower canonical components/styles
  -> compile Binding/Block/Handler exports
  -> emit app/shared/page bundles
  -> emit per-page IR
  -> emit runtime metadata and descriptors
  -> validate schemas and cross-file relations
  -> package deterministic RPK
```

失败是阶段原子的：任一阶段失败不得继续打包半成品。

## 4. 核心数据边界

### 4.1 静态与动态分离

```text
Page IR
  = 静态节点 + Style + Binding target + Block template + Handler declaration

JS Bundle
  = App/Page VM + 按 Template ID 索引的 evaluator/handler method + lifecycle + typed module reference
```

Page IR 不包含 JS 函数；Bundle 不复制模板树，也不复制 Binding/Handler target。Core 以 Owner + Template ID 从 Page IR 解析 target。

### 4.2 ID 分配

Toolkit 只生成：

- `TemplateNodeId`
- `TemplateBindingId`
- `TemplateBlockId`
- `TemplateHandlerId`

稳定性由规范化遍历顺序和确定性分配保证。Runtime ID 不得出现在编译产物中。

### 4.3 Host Lowering

Frontend 可以识别联盟标签，Semantic Model 之后只允许规范组件和规范 Style。未知语义在编译期失败，不透传给 Platform 猜测。

Binding evaluator 的输出类型由 Toolkit 根据 Page IR target 在 Lowering 时冻结：`Text.text` 和 `Button.text` 插值输出 UTF-8 string，`Button.enabled` 输出 boolean。Case 002 的 `count=0` 必须直接求值为 `"0"`；JS Framework 和 Core 不再进行 target 类型推断或隐式转换。

Case-derived frontend 基线只有一套：Case 001 使用的 `require.context`、ES import/CommonJS require、global 注入，以及 Less import/mixin/arithmetic/nested selector/CSS shorthand 都是 V1 必须编译成功的输入；每项必须有独立 Golden。编译器可以拒绝冻结 Case 之外的语义，但不能用“不支持诊断”代替 Case 001 闭环。

## 5. CLI 与增量构建

CLI 是无状态命令外壳；构建状态由 Build Session 管理。缓存键至少包含源码内容、配置、依赖版本和编译器版本，缓存命中不得改变产物字节。

```text
quickapp build <project>
quickapp inspect <rpk>
quickapp run <project|rpk> --platform <target>
```

`run` 通过目标 Runtime 的公开启动合同执行，不直接链接某个平台内部模块。

V1 启动语义只由公共 [Runtime Launch Profile Contract](../../../spec/contracts/runtime-launch-profile.md) 冻结。TK-S08 产生 artifact、entry route、params、viewport、trace output、target；各 Runtime Host 只消费。Runtime 只有在上层收到 `presented` 后报告启动成功；启动失败必须返回稳定 error code 和非零 exit，正常关闭返回零。该进程级 profile 不进入 JS/Core Runtime ABI。

## 6. 第二期 Agent 调用面

Agent 调用面是 Toolkit 的薄适配，不属于 Runtime 架构，也不参与 V1 门禁：

```text
Agent
  -> Toolkit Skill：DSL、工作流、样例和诊断知识
  -> Toolkit MCP Adapter：typed build / inspect / run tools
  -> Toolkit Application Service
  -> 与 CLI 相同的 Build Session、产物和结果
```

V1 只实现 CLI，并通过 Toolkit Application Service 调用核心能力。第二期 MCP 必须调用同一服务；公共请求和结果至少包含 operation、workspace/artifact、target、status、diagnostics、artifacts、trace reference 和稳定错误码。人类日志只是显示层，不是 Agent 合同。

第二期 Skill 不执行编译，MCP 不解释 DSL、不修改 Runtime 合同、不直接调用平台内部模块。未来 VS Code 插件和更多 Agent tools 继续复用同一服务。

## 7. 错误与观测

每个阶段输出统一 Diagnostic：

```text
severity + code + phase + file + range + message + hint
```

构建 Trace 至少包含阶段耗时、输入数、输出数、缓存命中、Bundle/IR/RPK 大小和最终哈希。日志不得进入 Artifact 语义。

## 8. 跨项目合同

| 下游 | Toolkit 交付 |
|---|---|
| Core | Manifest、Runtime Metadata、Page IR、RPK 成员和哈希 |
| JS Runtime | JS Module ABI、moduleId、bootstrap metadata、evaluator/handler export |
| Platform | 无直接编译合同；只通过 Core 消费规范 Host 语义 |
| Examples | 读取 Case 源码，不修改验收语义 |
| Benchmark | 构建耗时、产物大小、哈希和 Source Map 证据 |

公共合同发生冲突时停止受影响 Emitter，记录 `[待决策]`，不得在 Toolkit 内私自扩展字段。
