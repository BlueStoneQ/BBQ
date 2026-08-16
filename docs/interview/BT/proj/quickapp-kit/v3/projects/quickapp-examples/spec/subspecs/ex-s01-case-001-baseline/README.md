# EX-S01 Case 001 Baseline

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 基线身份](#3-基线身份)
- [4. 事实状态](#4-事实状态)
- [5. 依赖与交付](#5-依赖与交付)
- [6. 阅读顺序](#6-阅读顺序)
- [7. 状态](#7-状态)

## 1. 结论

`Case 001` 是联盟真实样例的冻结验收基线：同一份源码必须在 LVGL/SDL、Android 和 iOS 上得到相同的应用生命周期、页面内容、点击、页面跳转、Toast、返回和销毁语义。

Case 001 只定义输入事实和可观察结果，不定义 Toolkit 或 Runtime 如何实现；联盟 build、RPK、RPKS 只作参考事实，不是 QuickApp Kit Runtime 的正式执行输入。

## 2. 范围

包含：

- 本地样例来源和内容身份。
- 源码、联盟 build、debug/release RPK/RPKS 的分层身份。
- DSL、Host Component、系统模块和 Page Control 使用矩阵。
- 固定操作步骤、可见结果、Lifecycle/Trace 断言和跨平台一致性。
- Case 变更与重新验收规则。

不包含：

- 修改 Case 001 源码或生成任何实现产物。
- Case 002 的 state update、`if`、keyed `for`。
- `BLOCK-001`、`CAP-DEVICE-001` 或负例行为。
- Widget/Card Runtime 验收。
- Toolkit、JS Runtime、C++ Core 或 Platform Adapter 设计。

## 3. 基线身份

| 字段 | 冻结值 |
|---|---|
| Case ID | `CASE-001` |
| Case version | `1` |
| 本地项目 | `quickapp-examples/quickapp-code-test1` |
| package | `com.example.case1` |
| app version | `1.0.0` / `1` |
| entry route | `/pages/Demo` |
| second route | `/pages/DemoDetail` |
| Source snapshot SHA-256 | `aa99ea04873aa3fa22a006b37dada4608b06d903fed90370b117074a3834e78a` |
| 联盟 Toolkit 参考版本 | `2.1.0` |

Source snapshot 的精确定义和算法见 [design.md](./design.md#3-基线身份模型)。

## 4. 事实状态

| 标签 | 含义 |
|---|---|
| `[已验证事实]` | 已从本地源码、build 或归档字节直接核验 |
| `[验收断言]` | QuickApp Kit 必须满足的公共合同结果 |
| `[待验证]` | 当前快照无法证明，不能升级为 provenance 事实 |

`[待验证]`：当前目录不是 Git worktree，README 未给出上游仓库 URL、commit、许可证或原始获取时间；在得到来源证据前，provenance 只能声明“本地联盟模板快照”，不能声称具体仓库版本。

## 5. 依赖与交付

本分 Spec 依赖平台总 Spec、V1 Scope，以及 Artifact、Lifecycle、Render、Event、Capability、Observation 公共合同。其交付由以下文档组成：

- [requirements.md](./requirements.md)
- [design.md](./design.md)
- [tasks.md](./tasks.md)
- [acceptance.md](./acceptance.md)

## 6. 阅读顺序

先读本文件和 `requirements.md`，再读 `design.md` 的事实与治理，最后按 `tasks.md` 产出证据并用 `acceptance.md` 判定结果。

## 7. 状态

`PASS + CODE_ALLOWED`。Examples Agent 当前只执行 T01-T05；T06-T11 仍按各项目所有权和依赖推进。
