# B1 CASE-002 Code Agent 指令

下面代码块可直接转发给新的 Code Agent。

```text
你是 QuickApp Kit V1 Basic Runtime 的 B1 Integration Code Agent。

本轮只实现 B1 CASE-002，不实现整个 V1，也不启动 B2 及后续波次。

一、先读取

/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/README.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/architecture.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/acceptance.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/v1-basic-runtime-capability-matrix.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/README.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-examples/spec/subspecs/ex-s02-runtime-focused-fixtures/requirements.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/projects/quickapp-examples/spec/subspecs/ex-s02-runtime-focused-fixtures/design.md

读取代码：

/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit

二、目标

用真实 Toolkit 生成的 CASE-002 Runtime RPK，打通：

state
-> Binding dependency
-> Dirty
-> microtask flush
-> 一个 RenderTransaction
-> Core staged change
-> atomic commit
-> incremental MountTransaction
-> LVGL/SDL visible result

CASE-002 初始状态：

- count = 0
- visible = true
- keyed items = [A, B]

点击一次“更新状态”后必须得到：

- count = 1
- 条件节点被移除
- keyed items = [B, A]
- 只产生一个增量 RenderTransaction
- A/B 的 BlockInstanceId、Runtime NodeId、HandlerId、NativeHandle 保持
- A/B 不得 Remove + Instantiate，必须使用 Move 语义

三、允许修改范围

允许修改：

/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples

只有当现有 Toolkit 无法表达 CASE-002 DSL 时，才允许最小修改：

/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit

禁止修改：

- quickapp-runtime-android
- quickapp-runtime-ios
- quickapp-benchmark
- v3/spec/contracts/

四、架构约束

1. Core 维护唯一 Runtime Tree、Revision、Layout、Navigation 和 Commit。
2. JS 不维护完整 VNode Tree，不向 Platform 发送 Mount 指令。
3. JS 只负责 State、Binding、Dirty、Block/Handler snapshot 和 RenderTransaction。
4. Platform 只消费 MountTransaction，不决定逻辑状态和布局结果。
5. 不创建第二棵 Tree、第二套路由、第二套 Bridge 或通用 JSON 协议。
6. 不私自新增 NodeId、BlockId、BindingId、HandlerId 或 RequestId 语义。
7. 不修改冻结公共 Contract；发现缺口就记录 [待决策] 并停止受影响部分。

五、执行顺序

1. 先检查现有 CASE-002 源码、RPK、Toolkit 能力和已有 Core/JS/LVGL 测试。
2. 先补最小 Fixture 或测试，再实现缺失的 JS/Core/LVGL 链路。
3. 先通过 Core/JS 合同测试，再运行真实 LVGL/SDL。
4. 只修复 B1 实际暴露的最小问题，不顺手实现 BLOCK、Feature、Back、Image、Input 或 Benchmark。
5. 运行真实 RPK，不能用手写 Page IR、RenderTransaction、MountTransaction 或 Fake Host 冒充结果。

六、验收证据

必须提供：

1. CASE-002 源码 provenance 和 Artifact SHA-256。
2. Toolkit build/inspect 命令和结果。
3. LVGL/SDL 首始状态和点击后可见结果。
4. RenderTransaction operation 清单。
5. MountTransaction operation 清单。
6. A/B 身份前后快照。
7. RequestId、Revision、TransactionId 的关联证据。
8. 条件节点移除和 keyed Move 证据。
9. Mount 失败或非法事务的测试；已有 full rebuild 兜底不得破坏。
10. teardown 后 Surface、Node、Handler、JS 资源和 Platform 对象归零。
11. 可重复构建和运行命令。

截图只能证明视觉结果，不能替代结构化 Trace 和身份快照。

七、通信文件

只写：

/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md

完成后追加：

- 状态：READY_FOR_ARCH_REVIEW 或 BLOCKED
- 已完成
- 修改的工程
- 执行命令和测试结果
- Artifact SHA-256
- LVGL/SDL 运行证据
- 已验证事实
- 合理推断
- 待验证项
- 公共 Contract 是否变化
- 下一步建议

B1 通过后停止，不自动进入 B2。等待总架构复核和下一波次放行。
```
