# Core Alpha 实现校审

## 目录

- [1. 结论](#1-结论)
- [2. 已验证事实](#2-已验证事实)
- [3. 未完成项](#3-未完成项)
- [4. 当前门禁](#4-当前门禁)
- [5. 下一步指令](#5-下一步指令)

## 1. 结论

结论：**Core Agent 已完成 M1-Alpha 所需的局部 Core 实现，局部实现通过；允许进入跨项目组装验证，但不能宣称真实 Case 001 已跑通，也不能宣称完整 Core M1 已完成。**

当前结论：`ALPHA_COMPONENT_PASS + INTEGRATION_ALLOWED`。

这不是完整 Core 的 `VERIFIED`，也不是完整 Render/容灾能力的验收结论。

| 范围 | 结论 |
|---|---|
| CORE-S03 evidence | `VERIFIED`，source manifest 全部通过 |
| CORE-S04 Surface/Navigation 局部实现 | 局部实现通过，进入跨项目验证 |
| Alpha CORE-S06/S07/S08 | 局部实现通过，允许接入真实 Toolkit/LVGL 链路 |
| 完整增量 Render/Event/Capability/容灾 | 未完成，保持后续范围 |
| 真实 RPK -> Core -> LVGL | 尚未验证 |

## 2. 已验证事实

1. `build-alpha` CTest 全量 `14/14 PASS`。
2. ASan/UBSan 全量 `14/14 PASS`。
3. TSan 全量 `14/14 PASS`，完整集合连续 3 轮通过。
4. `evidence/source-manifest.sha256` 全部校验通过。
5. Alpha Core 测试覆盖：
   - PageIrHandle 到唯一 RuntimeTreeStore。
   - Surface/Revision 接入。
   - 初始 Tree staging。
   - Yoga Layout 和 MeasurePort。
   - View/Text/Button 的 full MountTransaction。
   - Mount correlation、成功提交、Measure 失败不发布。
   - Runtime Node 和 Surface teardown 归零。
   - 结构化 Render/Mount Trace。
6. 实现没有引入第二棵 Runtime Tree，也没有把 LVGL、SDL、JNI、UIKit 或 JS Engine 类型带入 Core。

## 3. 未完成项

### 3.1 证据仍是 Core fixture

`m1-alpha-core-verification.md` 使用合法的 Core PageIrHandle fixture，证明 Core 侧管线行为；它没有消费 Toolkit TK-S07 产出的真实 Runtime RPK，也没有连接真实 LVGL Host。因此真实链路仍必须单独运行：

```text
Case 001 Source
-> Toolkit TK-S05/TK-S06
-> TK-S07 Runtime RPK
-> Core PackageLoader
-> JS Module Loader/VM
-> Core Render/Layout/Mount
-> LVGL Host Present
```

### 3.2 Mount 失败恢复是后续完整能力门禁

当前 Alpha MountCoordinator 在 Mount 失败后保留已提交 Runtime Tree，并返回失败结果；这符合“Mount 失败不回滚已提交 Revision”的方向，但本局部实现没有继续完成公共 Render Contract 要求的 `degraded -> 一次 full rebuild -> failed/destroy` 完整恢复状态机。

这不阻塞 Alpha 成功路径的组装验证，但在完整 M1 Render/容灾验收前必须补齐，并增加平台 Mount 失败、full rebuild 成功和二次失败销毁测试。

### 3.3 首次 Present 仍由跨模块流程完成

Core Alpha fixture 的 `MountTransactionResult(mounted)` 只证明 Host Tree 已挂载；完整合同要求后续 `PresentSurfaceHostResult(presented)` 成功后，Core 才提交 visible 状态并向上层返回 presented。该过程不能由 Core fixture 的 `prepared=true` 代替。

## 4. 当前门禁

- Core Alpha 局部代码：允许进入跨项目组装。
- Core Agent：停止继续扩展 Alpha，等待真实 RPK 联调反馈。
- 不启动 CORE-S09/CORE-S10/CORE-S11 等后续完整能力。
- 不把 Core fixture 证据写成真实 Case 001 S1 证据。
- Alpha 总状态仍取决于 Toolkit TK-S07、JS 修正、LVGL 接入和 Examples Runner。

## 5. 下一步指令

```text
继续当前 Runtime Core 对话。

总架构校审结论：Core Alpha 局部实现通过，状态为 ALPHA_COMPONENT_PASS + INTEGRATION_ALLOWED。

已确认：
1. build-alpha、ASan/UBSan、TSan 全量 14/14 PASS；TSan 连续 3 轮通过。
2. source-manifest.sha256 全部通过。
3. 单一 RuntimeTreeStore、PageIrHandle、Yoga/Measure、full Mount、Trace 和 teardown 边界成立。

现在停止扩展 Core Alpha，不启动后续 Core 能力。等待 Toolkit TK-S07 生成真实 Runtime RPK 后，参与真实 Case 001 联调：RPK -> PackageLoader -> PageIrHandle -> JS/VM -> InitialRender -> LVGL Mount/Present。

完整 Render Contract 的 Mount 失败恢复（degraded -> 一次 full rebuild -> failed/destroy）保留为完整 M1 后续门禁；本轮不要为此扩张 Alpha 范围。

更新 AGENT-HANDOFF.md，保留上述边界并标记 READY_FOR_INTEGRATION。
```
