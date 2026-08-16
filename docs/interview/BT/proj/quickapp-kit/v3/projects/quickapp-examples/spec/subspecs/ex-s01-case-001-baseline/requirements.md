# EX-S01 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)

## 1. 结论

EX-S01 必须把一个会漂移的样例目录变成可追溯、可重复引用、可跨平台执行的事实基线，同时保持样例业务行为不变。

## 2. 输入与输出

### 2.1 输入

- `quickapp-code-test1/src/**`、`package.json`、`package-lock.json`。
- 现存 `build/**`、`dist/debug/**`、`dist/release/**`。
- 现存 debug/release `.rpk` 和 `.rpks`。
- v3 公共合同与 Examples 总 Spec。

### 2.2 输出

- 稳定 Case identity 与 provenance 记录。
- Source/Reference/Expectation 三层清单。
- DSL、模块、组件和控制面使用矩阵。
- 平台无关操作脚本语义、可见结果及结构化 Trace 断言。
- 变更治理、证据格式和通过条件。

## 3. 功能需求

| ID | 需求 |
|---|---|
| EX-S01-R01 | Case identity 必须包含 Case ID/version、package、app version、entry route、Source snapshot digest。 |
| EX-S01-R02 | Source snapshot 必须由明确文件集合、排序和 SHA-256 算法唯一计算，排除 `node_modules`、私钥、build、dist 和编辑器状态。 |
| EX-S01-R03 | Source、build 目录、RPK 和 RPKS 必须分别记录身份，不得用任一参考产物代替源码身份。 |
| EX-S01-R04 | 必须记录联盟 build 中 `app.js`、两页 `index.js` 的 Module ABI、VM、template 和 style 形态；该形态只作参考事实。 |
| EX-S01-R05 | 必须冻结 Manifest 路由、声明能力、页面 DSL、组件、Binding、事件、Style 与 Page Control 使用矩阵。 |
| EX-S01-R06 | 必须定义 launch、root click、detail click、back、destroy 五段确定操作及可见结果。 |
| EX-S01-R07 | 每段操作必须定义 Lifecycle、Event、Navigation、Capability、Surface 和资源 Trace 断言。 |
| EX-S01-R08 | LVGL/SDL、Android、iOS 必须消费同一 Source identity 和 Toolkit 生成的同一 Runtime Artifact identity，不允许平台源码分叉。 |
| EX-S01-R09 | 跨平台必须比较逻辑文本、组件语义、操作结果、生命周期顺序、关联 ID 和错误分类；不得要求像素完全一致。 |
| EX-S01-R10 | 联盟 RPK/RPKS 只能用于研究与 inspect；Case 001 的正式 Runtime 输入必须是本 Toolkit 从冻结源码生成的 Runtime RPK。 |
| EX-S01-R11 | Case 001 不得声称覆盖状态增量、条件块、keyed block、device 或 Widget/Card Runtime。 |
| EX-S01-R12 | 任何变更必须产生新 Case version 和 Source snapshot，并重新执行 Toolkit 与三平台验收；不得覆盖旧身份。 |
| EX-S01-R13 | provenance 缺失项必须显式标记 `[待验证]`，不得根据文件内容推定上游仓库、commit 或许可证。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 真实性 | 已验证事实可回到具体本地文件或归档成员。 |
| 可重复 | 任一 Agent 可按同一算法复算 identity，并按同一步骤执行 Case。 |
| 隔离性 | 参考产物变化不自动改变 Runtime 期望；平台失败不驱动样例改写。 |
| 可观测 | 屏幕事实和结构化 Trace 同时成立，截图不能替代 Trace。 |
| 最小性 | 只断言样例实际包含的业务行为。 |
| 安全性 | identity 和证据不得包含或复制 `sign/private.pem` 内容。 |

## 5. 非目标

- 不定义 QuickApp Kit 的 Bundle、Page IR、Runtime Tree 或平台实现。
- 不复现联盟 Toolkit 的字节级产物。
- 不执行联网请求；`system.fetch` 只验证模块可加载但未被业务调用。
- 不把 `system.shortcut` 的 Manifest 声明视为调用覆盖。
- 不验收 CardDemo；V1 Widget 输出应由 Toolkit 给出排除诊断。
