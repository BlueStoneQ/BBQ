# V1 Scope And Acceptance

> 定位：本文件提供 V1 子集与 Case 细节；平台级需求和最终门禁分别以 [`requirements.md`](./requirements.md) 与 [`acceptance.md`](./acceptance.md) 为标准入口。

## 目录

- [1. 结论](#1-结论)
- [2. V1 范围](#2-v1-范围)
- [3. 唯一纵向主链路](#3-唯一纵向主链路)
- [4. Case 001 验收](#4-case-001-验收)
- [5. Case 002 验收](#5-case-002-验收)
- [6. Focused Fixture 验收](#6-focused-fixture-验收)
- [7. 平台顺序](#7-平台顺序)
- [8. 证据与门禁](#8-证据与门禁)

## 1. 结论

V1 只证明一件事：**联盟 DSL 能被 Toolkit 编译成 `quickapp-kit-rpk`，并由同一套 JS Runtime 与 C++ Core 在 LVGL/SDL、Android 和 iOS 正确运行。**

LVGL/SDL 是首个可运行闭环和核心价值验证端，Android 随后证明联盟语义与跨平台复用，iOS 最后复用同一 Core。公共 Schema 通过不是 V1 成功；真实 Artifact、真实页面和真实输入跑通才是成功。

## 2. V1 范围

| 必须完成 | 明确后置 |
|---|---|
| 联盟 `.ux`、Manifest、Less/Style 的 V1 子集 | 直接执行联盟 Toolkit 已构建 RPK/RPKS |
| CLI `build / inspect / run` | Skill/MCP、VS Code 插件与 Agent 应用生态 |
| JS Bundle、Page IR、Runtime Metadata、Runtime RPK | 全量联盟组件、接口和权限治理 |
| App/Page 最小生命周期 | 动态插件包和运行时卸载插件 |
| 单一 C++ Runtime Tree、Style/Yoga、Measure Adapter | 完整字体排版系统和动画系统 |
| typed Bridge、Render、Event、Navigation 与最小 Capability | 无类型通用 JSON Bridge、通用插件系统 |
| 固定 Kernel、编译期可组合外围、Runtime Composition Manifest 与双 LVGL Profile 证据 | 动态模块装卸、远程插件与完整组件市场 |
| `JsEnginePort`、单 Engine Provider 组成和 QuickJS V1 实现 | 多 Engine 并存、运行时热切换和自动降级 |
| `system.router`、`system.prompt`、`system.device`；`system.fetch` 仅 deferred resolver | AI Feature 与 Chat 组件，见总 TODO |
| Manifest 声明校验、App/Page Context 最小结构 | 完整权限、账号、Service/Agent 协同 |
| Android、LVGL/SDL、iOS；按优先级依次集成 | Widget/Card Runtime、更多嵌入式 Backend |
| Case 001、Case 002、`BLOCK-001`、`CAP-DEVICE-001` 与基础 Trace/指标 | 完整 Benchmark 平台、外部框架排名、正式发行签名 |

V1 的标准输入是“联盟 DSL 源码”，正式运行输入是本 Toolkit 生成的 Runtime RPK。联盟现成 RPK/RPKS 只用于研究、inspect 和行为对照。

Case 001 在 bootstrap 时 import `system.fetch`，但主链路不调用网络。V1 只提供 load-only deferred facade：模块可解析，`supports(system.fetch, fetch)=false`，若调用则立即返回 `CAPABILITY_UNSUPPORTED`，不进入 Core 或 Platform。

V1 只有七组阻塞合同：

1. **Artifact**：Toolkit 输出什么，Loader 如何读取。
2. **JS 执行**：Bundle 如何加载，状态和 Handler 如何产生 Runtime 意图。
3. **渲染**：`InstantiateTemplate/RenderTransaction -> Runtime Tree -> MountTransaction`。
4. **事件**：`PlatformInputMessage -> Event Router -> JsEventDispatch`。
5. **页面控制**：生命周期、路由和 Case 所需最小能力。
6. **平台端口**：Surface、Mount、Input、Measure 与启动入口。
7. **Runtime 组成**：固定 Kernel、外围依赖方向、Build Profile、实际链接清单和 Artifact 兼容性预检。

其余文档、Schema、扩展点和失败组合可以继续完善，但不得阻塞项目分 Spec 启动。

## 3. 唯一纵向主链路

```text
联盟 DSL
  -> Toolkit
  -> JS Bundle + Page IR + Runtime Metadata + Runtime RPK
  -> RPK Loader
  -> Verified Module Load
  -> QuickJS + JS Framework
  -> App/Page lifecycle
  -> InstantiateTemplate / RenderTransaction
  -> C++ Runtime Tree + Style/Layout/Measure
  -> MountTransaction
  -> LVGL/SDL、Android 或 iOS Host
  -> PlatformInputMessage
  -> C++ Event Router
  -> JsEventDispatch / Handler
  -> state update 或 typed Capability
  -> Trace / Benchmark
```

任何项目总 Spec 都必须说明自己在这条链路中的输入、输出、失败和观测点，不得建立旁路。

## 4. Case 001 验收

Case 001 固定为 `quickapp-examples/quickapp-code-test1`，是联盟真实样例基线。

| 阶段 | 必须观察到的结果 |
|---|---|
| Build | 源码构建为可重复的 JS Bundle、Page IR、Metadata 和 Runtime RPK；Widget 输出 V1 排除诊断 |
| Load | Loader 在执行 JS 前完成路径、版本、结构和 Artifact SHA-256 校验；JS 只接收 verified bytes 并校验 bootstrap/expected export |
| App | `app.onCreate` 在该 AppRuntime 内恰好执行一次，并先于任一 Page `onInit` |
| Root Page | Demo Page 依次完成 `onInit`、初始 Binding、`onReady`、full Mount、Present、`onShow` |
| First Screen | 标题文本和按钮可见；`setTitleBar` 与可选 `setMeta` 通过 typed Page Host Control 执行 |
| Event | 点击按钮只通过 `NodeId -> HandlerId` 路由一次，JS 执行 `onDetailBtnClick` |
| Navigation | `system.router.push` 由 Core 创建并原子提交 Detail Surface；原页面 `onHide`，新页面 `onShow` |
| Capability | 点击 Detail 按钮后，`system.prompt.showToast` 通过 ModuleRegistry 和 PlatformProvider 成功 |
| Destroy | 非 Root 栈顶通过 NavigationClose/CloseSurfaceHost 成功后再 pop/reveal；Handler、Page VM、Runtime Tree、Host Tree 和映射均释放，生命周期不重复 |

Case 001 不验证 state update、`if` 或 keyed `for`，这些只由 Case 002 负责。

## 5. Case 002 验收

Case 002 固定为 `quickapp-examples/quickapp-code-test2`，只补齐渲染增量语义。

一次“更新状态”点击必须产生以下可观察事实：

1. JS Handler 执行一次；同一轮同步状态写入合并为一个 Dirty flush。
2. `count` 只产生目标 `UpdateBinding`，由 Core 按 Page IR 解析 prop，不重建静态页面树。
3. `visible` 由 `true -> false` 产生 `RemoveBlock`；下一次点击产生 `InstantiateBlock`。
4. `[a,b] -> [b,a]` 复用原 `BlockInstanceId` 并产生 `MoveBlock`，不得删除后重建同 key 节点。
5. Core 只更新唯一 Runtime Tree；Platform 只消费对应 Mount ops。
6. Trace 能关联 Event、Handler、RenderTransaction、MountTransaction 和 Revision。

Case 002 只覆盖 keyed reorder/move/reuse，不修改当前交互来伪造其他覆盖。

## 6. Focused Fixture 验收

`BLOCK-001` 独立验证 keyed add/remove 与 Handler 清理，不修改 Case 002。

`CAP-DEVICE-001` 是独立的能力 focused fixture：Manifest 显式声明并调用 `system.device.getInfo`，验证成功字段、unsupported/failure、物理像素与 logical-px density 关系，并禁止设备唯一标识。不得修改 Case 001 来承载该能力。

## 7. 平台顺序

1. 联盟 Android 源码从第一天作为 DSL、生命周期和系统能力语义参考，但不承载共享 Core。
2. LVGL + SDL 使用公共 Artifact、JS Runtime 和 C++ Core 完成首个可见、可点击闭环，再进入真实设备验证。
3. Android 随后运行同一 Artifact/Core/JS，证明公共合同没有被 LVGL 特性反向定义。
4. iOS Spec 可并行设计，实现排在 LVGL/Android 闭环之后；最终产品仍必须提供 iOS Runtime。

Core 与 JS Runtime 从第一天就是独立共享工程。LVGL-first 只改变可运行闭环顺序，不允许 LVGL 类型、线程模型或对象语义进入 Core。

## 8. 证据与门禁

| 门禁 | 通过证据 |
|---|---|
| 总架构 | 上述七组阻塞合同无所有权冲突，能组成唯一主链路 |
| 项目总 Spec | 对应项目明确主链路输入、输出、所有者、最小失败和 Case 验收；第二期事项可以只留扩展点 |
| 项目分 Spec | 对应项目总 Spec 的主链路校审通过；不等待其他项目或第二期事项 |
| 编码启动 | 对应项目分 Spec 校审通过 |
| 嵌入式首闭环 | 同一 Runtime RPK 的 Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 在 LVGL/SDL 交互运行并有 Trace |
| Android 复用闭环 | 相同 Case 在 Android 真机或模拟器跑通，逻辑语义与 LVGL 一致并有 Trace |
| iOS 闭环 | 同一 Runtime RPK 在 iOS 完成相同逻辑行为；排在 LVGL/Android 之后，不阻塞前两个里程碑 |
| Capability 合同 | Case 所需 router/prompt/device 与 unsupported fallback 可运行；复杂授权策略不阻塞 |
| 可裁剪组成 | `lvgl-simulator-dev` 与 `lvgl-embedded-min` 均通过 V1 Case；embedded-min 不链接 SDL/diagnostic-only 模块，并记录体积与内存差异 |
| JS Engine Service | 两个 LVGL Profile 均只链接 Manifest 指定的一个 QuickJS Provider；Fake Engine 合同测试证明 Framework 不依赖 QuickJS 类型 |
| 最小可观测 | Noop/Recording Sink 行为等价；整数纳秒、关联 ID、结构化计数和 OOM/队列溢出/full rebuild Marker 通过公共 Schema；Collector 与分析不进入 Kernel |
| V1 完成 | 三个平台完成 Case 断言，并输出启动、首屏、更新、事件、事务大小和内存基础指标 |
