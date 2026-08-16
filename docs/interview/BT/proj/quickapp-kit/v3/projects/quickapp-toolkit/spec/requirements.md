# Toolkit 总 Spec：需求

## 目录

- [1. 结论](#1-结论)
- [2. 项目使命](#2-项目使命)
- [3. V1 输入与输出](#3-v1-输入与输出)
- [4. 功能需求](#4-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 边界与后置项](#6-边界与后置项)

## 1. 结论

Toolkit 的唯一使命是：**把联盟 DSL 源码确定性编译为 Runtime 可直接校验和执行的静态事实、JS 动态语义与标准 Runtime RPK。**

Toolkit 不实现 Runtime，不把平台差异写入产物，也不建立第二套公共协议。

## 2. 项目使命

Toolkit 位于全链路入口：

```text
联盟 DSL 源码
  -> 解析与语义校验
  -> 组件/Style/Binding/Block/Event Lowering
  -> JS Bundle + Page IR + Runtime Metadata
  -> 合同校验
  -> Runtime RPK
```

它对下游作出三项保证：

1. Core 不需要解释联盟模板 DSL。
2. JS Runtime 不需要维护完整 VNode Tree。
3. Platform 不需要识别联盟标签、Binding 或 Style 语法。

## 3. V1 输入与输出

### 3.1 输入

- 联盟应用 Manifest。
- App、Page、Shared JavaScript。
- 页面 `.ux` 中的 template、style 和 script。
- Less/Style 与应用资源。
- Case 001、Case 002、`BLOCK-001` 与 `CAP-DEVICE-001` focused fixture 作为冻结验收输入。
- 联盟现成 RPK/RPKS 只作为 `inspect` 和行为研究输入。

### 3.2 输出

- `manifest.json`。
- `app.js` 与页面 JS Bundle。
- 每页不可变 Page IR。
- `quickapp-kit/runtime.json` Runtime Metadata。
- Assets 与 Artifact Descriptor。
- 可重复构建的 Runtime RPK。
- Source Map、诊断、构建清单、耗时和哈希。

## 4. 功能需求

| ID | 需求 |
|---|---|
| TK-R01 | 提供 CLI-first 的 `build`、`inspect`、`run` 命令；命令必须非交互，并提供稳定退出码和结构化结果，供编辑器及 Agent Adapter 复用。 |
| TK-R02 | 解析 Manifest，冻结入口 route、页面映射、moduleId、能力声明和资源关系。 |
| TK-R03 | 解析 V1 联盟 DSL 子集，并对未知组件、属性、事件和不支持语义给出定位明确的诊断。 |
| TK-R04 | 将 `div/text/input[type=button]` Lowering 为 `View/Text/Button`，将 Style 规范化为 Host Component Contract。 |
| TK-R05 | 为 Template Node、Binding、Block、Handler 生成稳定正整数 ID；相同输入必须产生相同 ID。 |
| TK-R06 | 将静态结构输出为 Page IR；IR 必须满足单根、可达、无环、无多父和 Binding/Handler scope 一致。 |
| TK-R07 | 将动态表达式输出为按 TemplateBindingId 索引的 `bindingEvaluators`，将事件方法输出为按 TemplateHandlerId 索引的 `handlerMethods`；target 只写入 Page IR。 |
| TK-R08 | 输出 `$app_define$/$app_bootstrap$/$app_require$` 兼容的 App/Shared/Page Bundle，不输出完整 VNode Tree。 |
| TK-R09 | 不在 Bundle 复制 Binding/Handler target descriptor；JS 只传 Owner + Template ID，Core 从 Page IR 解析 target。 |
| TK-R10 | 保留 `system.router/prompt/device` 模块引用并映射到固定 typed Facade；识别 `system.fetch` 为 V1 deferred facade，只允许加载时解析，不生成 Core request；禁止生成通用 JSON Bridge。 |
| TK-R11 | 为 `if` 和基础 keyed `for` 输出 Block IR 与运行期 evaluator 所需事实；无 key 列表必须诊断受限语义。 |
| TK-R12 | 生成 Runtime Metadata、Artifact Descriptor、SHA-256 和固定 RPK 布局，并在打包前完成公共 Schema 与关系校验。 |
| TK-R13 | `inspect` 能区分联盟包和 Runtime RPK，展示成员、入口、Bundle、IR、哈希、版本与不兼容原因。 |
| TK-R14 | `run` 只负责构建、产生公共 `RuntimeLaunchProfile` 并调用目标 Runtime，不在 Toolkit 内嵌入平台渲染逻辑。 |
| TK-R15 | Case 001 固定验证真实联盟源码构建；Case 002 固定验证 update、if 和 keyed move；`BLOCK-001` 固定验证 keyed add/remove 产物与 Handler 定义；`CAP-DEVICE-001` 固定验证声明和 typed device facade 产物。 |
| TK-R17 | 按 Page IR target 编译 evaluator 输出类型：Text/Button text 为 UTF-8 string，Button enabled 为 boolean；Case 002 的 `0` 必须输出 `"0"`。 |
| TK-R18 | TK-S03/TK-S05 必须建立 Case-derived feature matrix；Case 001 实际使用的 `require.context`、ES import/CommonJS require、global 注入、Less import/mixin/arithmetic/nested selector、CSS shorthand 全部必须支持并有 Golden，不得降为诊断；冻结 Case 外语义才可明确诊断为不支持。 |
| TK-R19 | `inspect/run` 必须读取目标 Runtime Composition Manifest，展示 Profile、JS Engine identity、实际组件/能力和链接模块；可静态确定不兼容时提前失败，但不得替代 Runtime 的启动/加载期预检。 |

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 相同源码、配置和工具版本产生字节一致的逻辑产物与稳定哈希。 |
| 可诊断性 | 错误包含阶段、文件、位置、错误码和修复方向；不输出裸异常堆栈作为用户合同。 |
| 可追踪性 | 每个 Runtime Artifact 能追溯到源码、编译阶段和工具版本。 |
| 可测试性 | Parser、Lowering、IR、Bundle、Package 均有 Golden 与负例。 |
| 平台无关 | 产物不得包含 JNI、UIKit、LVGL 或平台对象语义。 |
| 合同唯一 | 直接消费全局 Schema；项目内不得复制或改写同名 Schema。 |
| 可扩展 | CLI 通过 Toolkit Application Service 调用核心能力，后续 UI、Skill/MCP 只需增加薄适配。 |
| 组成透明 | Toolkit 不定义平台模块开关，只消费公共 Composition Manifest 并报告 Artifact/Profile 兼容性。 |

## 6. 边界与后置项

V1 不做：

- 直接把联盟 Toolkit RPK/RPKS 转换为可执行 Runtime RPK。
- 全量联盟组件、Style、动画、Widget/Card。
- Release 签名和完整分发信任链。
- 编辑器 UI；只保证 Toolkit 服务和 CLI 合同可复用。
- Skill/MCP、`create/validate/debug/bench` Agent tools、自动应用生成、能力发现和 Agent 评测。
- Runtime Loader、JS Engine、Runtime Tree 或任一平台 Host。
