# M1-Alpha Agent 指令

## 目录

- [1. 总规则](#1-总规则)
- [2. Toolkit](#2-toolkit)
- [3. JS](#3-js)
- [4. Core](#4-core)
- [5. LVGL](#5-lvgl)
- [6. Examples](#6-examples)
- [7. 停止项](#7-停止项)

## 1. 总规则

```text
M1-Alpha 是现有 v3 项目的垂直执行切片，不是新项目，不新增公共合同，不创建 Alpha 专用 Runtime。
正式合同以 v3/spec/contracts 为准；代码仍写入各自 quickapp-kit-ai 项目。
目标是 Case 001 S1：真实 RPK 加载后，LVGL/SDL 根页面可见。
```

## 2. Toolkit

```text
继续当前 Toolkit 对话。

TK-S05/TK-S06 已通过组件校验；TK-S07 打包实现和五份详细分 Spec 已完成，Core PackageLoader 可以打开当前 RPK。
真实联调发现两项上游语义缺口，只做定向修正：
1. 按现有 Canonical state symbol resolution，把受支持的 DSL 状态字段生成到 Runtime Page VM 根对象；Case 001 的 `private.title` 必须使 evaluator 生成并执行 `this.title`，不得依赖自由变量或由 Runner 注入。
2. Package dependency graph 只包含 App/Shared/Page 的静态包内依赖；App/Shared/Page Bundle 的 define 依赖与 Runtime Metadata `dependencies[]` 必须完全一致。修复 Shared 自依赖，并把静态 `require.context` 在构建期展开为直接依赖/require。
3. 把联盟 `system.*` import 规范化为公共合同冻结的 `@app-module/system.*`；typed facade 不进入 Package dependency graph。

修正后重新生成 Case 001 RPK、机器证据和 Core Loader probe，并证明 Core `VerifiedModule` 可以交给 JS ModuleLoader。旧 RPK 只保留为修正前证据，不再作为 Alpha 最终输入。

Alpha 输入只能是唯一 CanonicalLoweredAppModel；不得重新解析 DSL、重新 Lower 或重新分配 ID。
Alpha 输出必须包含 App/Page Bundle、Page IR、Manifest、Runtime Metadata 和可被 Core 打开的 RPK。
不得实现完整 inspect/run、签名、TK-S08、TK-S09 或后续生态能力；不得借本次修正增加通用兼容层。
```

## 3. JS

```text
继续当前 JS Runtime 对话。

JS-S03 和 Alpha initial-only 分层修正已完成：`VmLifecycleService` 只编排 `PageInitializationStagePort`，Binding Stage 与 Initial Transaction Builder 各自拥有对应职责；CTest `9/9 PASS`，源码清单全部通过。

现在只实现 Case 001 S1 所需的最小 typed facade：
1. Module Loader 通过静态 facade catalog 解析公共合同冻结的 Router moduleId；保持当前 ESM 产物所需的 default export 形态。S1 只要求模块可解析，不调用 `push`。
2. Page VM 根据 `SurfaceContext.hostCapabilities` 安装 `$page.setTitleBar/setMeta`，并通过现有 typed Runtime ABI 发送对应消息；不得在 Runner 中吞掉调用。
3. 消费 Toolkit 修正后的 Core `VerifiedModule`，证明 App/Page Module -> VM -> onInit -> initial binding -> InstantiateTemplate 成立。

不得实现通用 module/method/JSON Bridge，不启动完整 Reactive、Block、Event、Navigation、Capability 或 S2-S5。
```

## 4. Core

```text
继续当前 Runtime Core 对话。

Core Alpha 组件与真实 RPK Loader 已通过。只做公共 Artifact Contract 的定向对齐：读取并校验 App/Shared/Page 的 Package `dependencies[]`，拒绝未知、自依赖和 Shared cycle，并原样发布到 `VerifiedModule`。不得把 `@app-module/system.*` 当作 Package dependency。

对齐完成后停止扩展；输入可用时只参与真实联调：Runtime RPK -> PackageLoader -> PageIrHandle -> InitialRender -> Yoga/Measure -> 唯一 RuntimeTreeStore -> MountTransaction。

Alpha 不实现完整增量 Render、Block、Event、Capability、Navigation S2-S5 或完整容灾。
Core 仍只维护一棵权威 Runtime Tree，Platform 只消费 Mount command。

不得手写 Page IR、第二棵 Tree 或 Alpha 专用 Runtime；完成后提交真实联调证据。
```

## 5. LVGL

```text
继续当前 LVGL Runtime 对话。

LV-S03/LV-S06 已 VERIFIED；LV-S04 Alpha 组件已通过校验。停止扩展 LVGL，参与真实 Runtime RPK -> Core MountTransaction -> LVGL Mount -> S03 Present 联调。

必须使用真实 LVGL/SDL Host；所有 object 操作在 owner thread；Surface、Node 映射、Mount commit 和 close 资源释放可观察。
不得复制 Core Runtime Tree、Revision、路由或 Layout 权威状态。
不得实现 LV-S05、LV-S07、LV-S08、LV-S09、LV-S10。

不得把 typed Mount fixture 证据冒充真实 RPK 证据。Case 001 的 `fontSize` 必须按照既有 LV-S06 `system-default` 字体合同和已确认字体资产实现，不得静默忽略或使用未声明的系统字体；联调完成后提交真实 CJK visible、mount、present 和资源证据。
```

## 6. Examples

```text
Examples Agent 当前保持 `INTEGRATION_BLOCKED_UPSTREAM`，不得为绕过上游缺口创建兼容 Runner。
Toolkit、JS、LVGL 修正完成后，只实现 Case 001 S1：加载重新生成的 `quickapp-toolkit/evidence/tk-s07-case001.rpk`，依次装配 JS、Core、LVGL/SDL，跑通真实首屏。
不得手写或预置 Page IR、Bundle、RenderTransaction、MountTransaction，不得用 Fake Host 替代真实 LVGL/SDL。
Runner 完成后提交可复现命令、真实页面可见证据、结构化 Trace 和 Surface/Node/Handler/Module/Engine 资源归零证据。
```

## 7. 停止项

```text
Android、iOS、Benchmark、Examples 的完整后续能力保持停止。
Examples 只允许提供 Alpha runner、Case 001 输入和结果快照，不实现 Runtime。
```
