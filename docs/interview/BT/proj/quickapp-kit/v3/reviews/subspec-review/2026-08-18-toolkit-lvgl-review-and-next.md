# Toolkit 与 LVGL Alpha 校审及下一步

## 目录

- [1. 结论](#1-结论)
- [2. Toolkit 校验](#2-toolkit-校验)
- [3. LVGL 校验](#3-lvgl-校验)
- [4. Alpha 下一步](#4-alpha-下一步)
- [5. Agent 指令](#5-agent-指令)

## 1. 结论

结论：**Toolkit TK-S05/TK-S06 与 LVGL LV-S04 的局部实现均通过；现在停止扩展这三项，进入真实 Runtime RPK 生成与跨项目组装阶段。**

| 项目 | 结论 | 下一门禁 |
|---|---|---|
| TK-S05 JS Module Emitter | `VERIFIED` | 放行 TK-S07 |
| TK-S06 Page IR Emitter | `VERIFIED` | 放行 TK-S07 |
| LV-S04 Mount/Host Components | `ALPHA_COMPONENT_VERIFIED` | 接入真实 Core MountTransaction |
| TK-S07 Runtime Artifact | 未开始 | 生成 Case 001 Runtime RPK |
| 真实 RPK -> JS -> Core -> LVGL | 未开始 | Alpha S1 端到端验收 |

## 2. Toolkit 校验

已验证：

- `npm run typecheck`、`npm run lint`、`npm run build` 通过。
- `npm test`：`74/74 PASS`。
- `npm run test:cli`：`17/17 PASS`。
- Emitter 集成、Case 001/002 Golden、ABI、Page IR Schema、确定性、取消、预算和边界扫描通过。
- App/Page 通过 `module.exports` 导出 Definition；App/Page 各一个 bootstrap；Shared 不 bootstrap。
- S05/S06 仍只消费同一 CanonicalLoweredAppModel，不生成 Runtime Node、Artifact 之外的运行时状态，不读取彼此产物。

结论：S05/S06 的设计边界和实现行为一致，可以放行 TK-S07；不要求继续修改 S05/S06。

## 3. LVGL 校验

已验证：

- source manifest 全部通过。
- LV-S04 Debug/Release 的专项测试和边界扫描通过。
- embedded-only：`8/8 PASS`。
- 真实 SDL window、S03 page root、View/Text/Button object、full Mount、incremental Move/Remove、Present 后 visible、失败清理、owner thread 和 close 资源归零均有证据。
- Platform 只维护 `(SurfaceId, NodeId)` 本地映射，不复制 Core Runtime Tree、Revision、Route 或 Layout。

证据边界：LV-S04 当前测试消费 typed MountTransaction fixture，不是 Toolkit 生成的真实 RPK；它证明 Platform Mount 组件成立，不证明完整链路成立。

结论：LV-S04 可以停止继续扩展，允许参加真实 Alpha 组装；不启动 LV-S05/LV-S07/LV-S08/LV-S09/LV-S10。

## 4. Alpha 下一步

```text
TK-S07 生成真实 Runtime RPK
  -> Examples Alpha Runner 打开 RPK
  -> Core PackageLoader / PageIrHandle
  -> JS Module Loader / App-Page VM
  -> JS initial binding
  -> Core InitialRender / Yoga / MountTransaction
  -> LVGL MountHost / S03 Present
  -> root Surface visible
  -> Trace 与资源归零
```

当前真正阻塞：

1. TK-S07 尚未实现，当前没有可供 Runtime 打开的真实 RPK。
2. JS-S03 source manifest 和 Alpha RequestId allocator 尚未修正。
3. Core、JS、LVGL、Examples 尚未形成同一个 Composition Root/Runner。
4. 真实 Alpha 证据尚未产生。

## 5. Agent 指令

### 5.1 Toolkit Agent

```text
继续当前 Toolkit 对话。

总架构校审结论：TK-S05/TK-S06 实现验证通过，状态为 VERIFIED；现在只启动 TK-S07，禁止继续扩展 S05/S06。

TK-S07 只消费 S05 生成的 App/Shared/Page Bundle 与 Source Map、S06 生成的 Page IR，以及已冻结 Artifact Contract、Runtime Launch Profile 和 Case 001 派生事实。

TK-S07 必须生成 Runtime Metadata、Artifact Descriptor、member path/byteLength/SHA-256、Bundle/Page IR 关系索引，以及可由 Core PackageLoader 打开的确定性 Runtime RPK。

必须满足输入不可变、关系闭包、路径安全、预算、有界内存、原子发布、失败无部分 RPK、重复构建字节和 SHA-256 一致。只做 Case 001 S1 最小 RPK；不得启动 TK-S08/TK-S09，不做签名、inspect/run、Skill/MCP 或后续生态能力。

完成后提交 source manifest、RPK 解包检查、Core PackageLoader 可读取证据、Case 001 运行输入和 READY_FOR_REVIEW Handoff。
```

### 5.2 JS Agent

```text
继续当前 JS Runtime 对话。

按 2026-08-18-js-s03-alpha-review.md 完成两个定向修正：重新生成 JS-S03 source manifest 并全部校验通过；删除 VmLifecycleService 自有 RequestId 序列，改为消费 JS Framework AppRuntime 级共享 allocator/port，并补跨请求生产者唯一性测试。

修正后等待真实 TK-S07 RPK，补真实 Case 001 App/Page Bundle -> Module Loader -> VM -> initial binding 集成证据。不要启动 JS-S05，不实现完整 JS-S04，不修改公共合同或 Schema。
```

### 5.3 Core Agent

```text
继续当前 Runtime Core 对话。

Core Alpha 局部实现已通过，状态为 ALPHA_COMPONENT_PASS + INTEGRATION_ALLOWED。停止扩展 Core，等待 TK-S07 真实 RPK。

参与真实联调：Runtime RPK -> PackageLoader -> PageIrHandle -> InitialRender -> Yoga/Measure -> MountTransaction -> Present。真实联调必须使用 Core 唯一 RuntimeTreeStore，不得使用手写 Page IR、Fake Page IR 或第二棵树。

完整 Mount 失败恢复保留为后续 M1 门禁；本轮不扩张实现。
```

### 5.4 LVGL Agent

```text
继续当前 LVGL Runtime 对话。

LV-S04 Alpha Mount 组件已通过，状态为 ALPHA_COMPONENT_VERIFIED。停止扩展 LVGL，不启动 LV-S05/LV-S07/LV-S08/LV-S09/LV-S10。

参与真实联调：消费 Core 生成的 typed MountTransaction，在既有 S03 page root 上执行 owner-thread Mount；Mount 成功后由 S03 Surface Host 执行 Present，向 Core 返回 typed Result。

联调不得把 typed fixture 证据冒充真实 RPK 证据；保留 Mount/Present/visible/资源归零 Trace。
```

### 5.5 Examples Agent

```text
继续当前 Examples 对话。

只实现 M1-Alpha Case 001 S1 Runner/Integration，不扩展 EX-S02 之后能力。

Runner 必须使用 Toolkit TK-S07 生成的真实 Runtime RPK，依次装配 Toolkit、JS、Core、LVGL/SDL，不得手写 Page IR、Bundle、RenderTransaction 或 MountTransaction，不得使用 Fake Host 替代真实 LVGL/SDL。

输出可复现启动命令、真实页面可见证据、结构化 Trace、Surface/Node/Module/Engine 资源归零证据。等待 TK-S07 RPK 后开始。
```
