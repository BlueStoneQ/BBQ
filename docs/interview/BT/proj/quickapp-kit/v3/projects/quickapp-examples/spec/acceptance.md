# Examples 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. Case 001 验收](#3-case-001-验收)
- [4. Case 002 验收](#4-case-002-验收)
- [5. Focused Fixture 验收](#5-focused-fixture-验收)
- [6. 基线治理验收](#6-基线治理验收)
- [7. 证据](#7-证据)

## 1. 结论

Examples 通过的标准是：任何 Agent 都能从同一 Case 得到同一输入身份、操作步骤和预期行为，不需要阅读某个平台实现猜测测试目标。

## 2. 总 Spec 通过条件

- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 的职责互不重叠且共同覆盖 V1。
- Source、Reference、Expectation 三类事实明确分离。
- Case 修改不能绕过总架构和跨项目重新验收。
- 不包含框架实现或平台分叉代码。
- Toolkit、Runtime、Benchmark 对 Case identity 的引用一致。

## 3. Case 001 验收

- 来源、原始源码、build 目录、debug/release RPK 可追溯。
- entry route、页面路径、操作步骤和可见结果明确。
- 生命周期、click、router、prompt、Page Control 和 destroy Trace 期望明确。
- 明确不验证 state update、if 和 keyed for。
- 不为了补验证目标修改真实样例业务逻辑。

## 4. Case 002 验收

- 源码只使用冻结 V1 DSL/组件/Style/事件子集。
- 一个确定操作可验证 text update、if 切换和 keyed reorder。
- 明确预期 BlockInstanceId/NodeId/NativeHandle 复用语义。
- Android、LVGL/SDL、iOS 使用同一源码和操作。
- 不把 keyed add/remove 声称为 Case 002 当前源码行为。

## 5. Focused Fixture 验收

- `BLOCK-001` 必须用独立步骤证明 keyed add 和 remove；remove 后旧 BlockInstanceId 不复用，相关 Handler/Node/NativeHandle 均不可再路由。
- `CAP-DEVICE-001` 必须显式声明并调用 `system.device.getInfo`，验证 required fields、物理像素、density、unsupported/failure 和无设备唯一标识。
- 两个 fixture 均不得通过修改 Case 001 产生。
- `PROFILE-MISSING-001` 分别提供缺失 Host Component 与缺失 Capability 的最小 Artifact；两者预期均为 JS 执行前 `RUNTIME_PROFILE_INCOMPATIBLE`。

## 6. 基线治理验收

- 每个 Case 有稳定 ID、版本和内容哈希。
- 变更记录包含原因、影响合同和预期差异。
- Reference 产物更新不自动改变 Runtime Expectation。
- 未通过架构确认的实现适配型改动会被拒绝。

## 7. 证据

- Case 清单、来源和内容哈希。
- Case 001 联盟源码/产物研究记录。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 操作与期望表。
- `PROFILE-MISSING-001` 内容哈希、缺失项和预期错误表。
- Toolkit build、Runtime execution、Benchmark scenario 对同一 Case ID 的引用检查。
