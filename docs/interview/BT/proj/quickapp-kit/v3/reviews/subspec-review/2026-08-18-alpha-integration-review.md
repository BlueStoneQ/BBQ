# M1-Alpha 集成校审与下一步

## 目录

- [1. 结论](#1-结论)
- [2. 已验证事实](#2-已验证事实)
- [3. 当前进度](#3-当前进度)
- [4. 剩余阻塞](#4-剩余阻塞)
- [5. 下一步指令](#5-下一步指令)

## 1. 结论

**M1-Alpha 进入真实集成阶段，当前约 70%；尚未通过 S1。**

Toolkit 已产出确定性的真实 Runtime RPK，Core Loader 已成功打开并读取 App、Page 和 Page IR；JS 的上次定向修正也已完成。现在的唯一主线是把真实 RPK 接入 JS/Core/LVGL/SDL Composition Root，并形成首屏可见证据。

本轮不启动新的完整分 Spec，不扩展 Reactive、Event、Navigation、Capability、Android、iOS 或 Benchmark。

## 2. 已验证事实

### 2.1 Toolkit TK-S07

- `npm run typecheck`、`npm run lint`、`npm run build` 通过。
- `npm test`：`76/76 PASS`；CLI：`17/17 PASS`。
- Case 001 RPK 共 19 个成员，`unzip -t` 全部通过。
- RPK SHA-256：`6a8c0d1acc690e97594e4a625436485cb8c92f283f9b347e6a6123c693fa3141`。
- RPK source manifest：`6/6 OK`。
- Core PackageLoader 已成功读取：App Module、`/pages/Demo` Page Module、`/pages/Demo` Page IR。
- 输入不可变、关系闭包、预算、取消、失败无部分产物和重复构建一致性均有测试。

因此 TK-S07 在 Alpha 范围内标记为 `ALPHA_ARTIFACT_VERIFIED`。由于当前没有独立 `tk-s07` 五份详细分 Spec 目录，暂不把完整 `TK-S07` 分 Spec 标记为 `VERIFIED`；该追溯性补件不阻塞 Alpha 集成。

### 2.2 JS Runtime

- `JS-S03` source manifest 当前 `6/6 OK`。
- `VmLifecycleService` 已消费 AppRuntime 级共享 `JsRequestIdAllocatorPort`。
- 跨请求生产者唯一性测试已存在。
- 当前 Debug 构建与 CTest `9/9 PASS`；问题是职责分层，不是行为回归。
- JS Alpha 仍是组件级合成证据，尚未加载 TK-S07 真实 RPK。
- 当前 `VmLifecycleService` 直接调用 `evaluateInitialBindingsOnExecutor` 并发送 `InstantiateTemplate`，违反 JS-S04 已冻结边界：S04 只能编排 `PageInitializationStagePort`，不得实现 evaluator 或 Render/Instantiate 提交。
- 纠正方式不推翻现有实现：S04 保留 VM/Hook 生命周期；把 initial evaluator 移入 Alpha 最小 JS-S05 Binding Stage，把 `InstantiateTemplate` 构造与提交移入 Alpha 最小 JS-S07 Initial Transaction Builder。

### 2.3 Core 与 LVGL

- Core Alpha 局部链路已通过：`PackageLoader -> PageIrHandle -> InitialRender -> Yoga/Measure -> MountTransaction`。
- LVGL Alpha 局部 Mount/Present 已通过，但其既有证据输入是 typed fixture，不是真实 RPK。
- Case 001 Page IR 含 `fontSize: 40/30`；当前 LVGL Mount 对 `fontSize` 显式返回 `kHostFeatureUnsupported`。该属性必须在 Alpha 真实页面上完成既有 LV-S06 字体合同到 LVGL Host 的接线，不能静默忽略。

### 2.4 Examples

- `CASE-001@1` baseline 校验通过。
- 当前没有真实 `RPK -> JS -> Core -> LVGL/SDL` Alpha Runner 和 S1 运行证据。

## 3. 当前进度

| Alpha 阶段 | 状态 | 进度判断 |
|---|---|---:|
| Case 001 基线与公共合同 | 已完成 | 100% |
| Toolkit Bundle/IR/RPK | Alpha 已完成 | 100% |
| JS Module/VM/initial binding 组件 | Module/VM 完成；Binding/Instantiate 职责需归位 | 70% |
| Core Render/Layout/Mount 组件 | 已完成，待真实输入 | 100% |
| LVGL Host Mount/Present | 组件完成，fontSize 接线待完成 | 80% |
| Composition Root 与真实 RPK 装配 | 未开始 | 0% |
| S1 可见、Trace、资源归零证据 | 未开始 | 0% |

约 `70%` 是 Alpha 垂直主线的工程进度，不等于 M1 的 `14/41` Spec 完成率，也不等于完整 V1 完成率。

## 4. 剩余阻塞

1. **Examples Runner**：建立唯一 Composition Root，使用真实 TK-S07 RPK，不手写 Page IR、Bundle、RenderTransaction 或 MountTransaction。
2. **JS 分层纠正与接线**：S04 只调用 `PageInitializationStagePort`；Alpha 最小 S05 拥有 initial evaluator，Alpha 最小 S07 拥有 `InstantiateTemplate` 构造与提交。随后用 Core 验证后的 Bundle/Module bytes 补真实 App/Page Module、VM 和 initial binding 证据；JS 不读取 RPK 路径。
3. **Core 接线**：把真实 PageIrHandle 和 JS 的 `InstantiateTemplate` 接入唯一 RuntimeTreeStore，提交真实 MountTransaction。
4. **LVGL 接线**：消费真实 MountTransaction，在 owner thread 完成 View/Text/Button Mount 和 Present；完成 `fontSize` 与既有字体资产/Measure 合同的映射，并保留 CJK 文本可见证据。
5. **S1 验收**：输出启动命令、页面可见证据、结构化 Trace、Surface/Node/Handler/Module/Engine 资源归零证据。
6. **追溯性补件**：Alpha 通过后补齐 TK-S07 五份详细分 Spec；不在当前集成主线中扩展功能。

## 5. 下一步指令

### 5.1 Toolkit Agent

```text
TK-S07 Alpha 实现校审通过，标记为 ALPHA_ARTIFACT_VERIFIED。
停止 Toolkit 代码扩展，不启动 TK-S08/TK-S09，不做签名、inspect/run、Skill/MCP。
保留并交接 evidence/tk-s07-case001.rpk、tk-s07.json、tk-s07-core-loader.txt 和 source manifest。
Alpha 通过后补齐 TK-S07 五份详细分 Spec，使实现、合同、测试和证据可追溯；补件不得改变已冻结 Artifact Contract 或 RPK 字节。
```

### 5.2 JS Agent

```text
JS-S03 定向修正已通过：source manifest 6/6 OK，共享 RequestId allocator 已接入。
当前发现一项架构纠正：VmLifecycleService 不得直接执行 binding evaluator 或发送 InstantiateTemplate。
保留 S04 的 VM/Hook 生命周期，把 initial evaluator 移入 Alpha 最小 JS-S05 Binding Stage，把 InstantiateTemplate 构造与提交移入 Alpha 最小 JS-S07 Initial Transaction Builder；S04 只通过 PageInitializationStagePort 编排二者。
这只是 Alpha 最小实现，不启动完整 Reactive、Block、Event 或普通 RenderTransaction。
完成职责归位后参与真实装配：消费 Core 验证后的 App/Page Bundle bytes，形成真实 Case 001 App/Page Module -> VM -> initial binding -> InstantiateTemplate 证据。
JS 不读取 RPK、文件路径或 Page IR；不得修改公共合同。
```

### 5.3 Core Agent

```text
Core Alpha 组件通过，停止扩展 Core。
参与唯一真实链路：Runtime RPK -> PackageLoader -> PageIrHandle -> JS initial binding -> InitialRender -> Yoga/Measure -> 唯一 RuntimeTreeStore -> MountTransaction。
只补真实 Case 001 Composition Root 接线和 Trace/资源证据；不得手写 Page IR、第二棵 Tree 或 Alpha 专用 Runtime。
```

### 5.4 LVGL Agent

```text
LVGL Alpha 组件通过，停止启动 LV-S05/LV-S07/LV-S08/LV-S09/LV-S10。
参与真实链路：消费 Core MountTransaction，在 owner thread 完成 View/Text/Button Mount、fontSize 映射、Present 和资源释放。
fontSize 必须按照既有 LV-S06 system-default 字体合同和已确认字体资产实现；不得静默忽略，不得使用未声明的系统字体作为证据。
提交真实 RPK 联调的 visible、mount、present、CJK 文本和资源归零证据。
```

### 5.5 Examples Agent

```text
现在由 Examples Agent 负责 M1-Alpha Composition Root/Runner。
只实现 Case 001 S1：加载 quickapp-toolkit/evidence/tk-s07-case001.rpk，依次装配 JS、Core、LVGL/SDL，跑通真实首屏。
不得手写或预置 Page IR、Bundle、RenderTransaction、MountTransaction，不得用 Fake Host 替代真实 LVGL/SDL。
Runner 完成后提交可复现命令、真实页面可见证据、结构化 Trace 和 Surface/Node/Handler/Module/Engine 资源归零证据。
```
