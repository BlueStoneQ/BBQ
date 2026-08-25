# QuickApp Kit V1 基础运行时能力矩阵

## 目录

- [1. 结论](#1-结论)
- [2. 产品分层](#2-产品分层)
- [3. V1 能力矩阵](#3-v1-能力矩阵)
- [4. Feature 边界](#4-feature-边界)
- [5. 验收方式](#5-验收方式)
- [6. Spec 映射](#6-spec-映射)
- [7. 当前动作](#7-当前动作)

## 1. 结论

QuickApp Kit V1 的目标不是只跑通 Case 001 主链，而是形成一个**基本可用、五脏俱全、能力有限但边界完整**的快应用框架。

最小主链只回答：

```text
RPK -> JS -> C++ Core -> Platform -> 首屏/点击/路由/销毁
```

V1 基本可用还必须回答：

```text
联盟 DSL 基础子集
-> 可重复 Runtime RPK
-> 基础组件与样式
-> 状态和增量更新
-> 基础交互与页面生命周期
-> 核心 Feature
-> 三个平台语义一致
-> 可诊断、可回收、可裁剪
```

这里的“三个平台语义一致”不是像素一致，也不是每个平台实现相同的系统 API；它表示相同的应用输入在 LVGL、Android、iOS 上拥有一致的组件语义、交互结果、页面状态、错误分类和资源生命周期。

## 2. 产品分层

### 2.1 最小主链

最小主链是架构成立性验证，不等于产品完成：

| 能力 | 目标 |
|---|---|
| 加载 | 真实 Runtime RPK 可加载 |
| 初始化 | App/Page/Root Surface 可创建 |
| 渲染 | 首屏 View/Text/Button 可见 |
| 交互 | Button click 可进入 JS Handler |
| 路由 | Core 执行一次 NavigationPush |
| 清理 | Runtime teardown 后资源归零 |

### 2.2 V1 基本可用

V1 必须具备基础应用开发所需的完整闭环，但不追求联盟全量 API：

| 领域 | V1 判断标准 |
|---|---|
| 编译 | 基础联盟 DSL 能稳定构建为 Runtime RPK |
| 运行 | RPK、页面、模块和生命周期可确定执行 |
| 渲染 | 基础组件、样式、文本和布局可以组成真实页面 |
| 更新 | 状态变化可以产生增量更新，不重建无关节点 |
| 交互 | 点击和基础输入可以驱动状态、Feature 和路由 |
| 页面 | root、push、back、show、hide、destroy 闭环成立 |
| Feature | 核心平台 API 有统一 typed 能力模型和 unsupported/failure |
| 平台 | LVGL、Android、iOS 实现同一 Runtime 语义 |
| 质量 | 失败可诊断、资源可回收、可观测和可裁剪 |

## 3. V1 能力矩阵

状态含义：

- `P0`：V1 基本可用必须具备。
- `P1`：V1 可选增强；不阻塞第一版基础投产闭环，但应保留清晰接口。
- `V2+`：不进入 V1 门禁。
- `已验证`：已有真实运行或合同证据；不表示该领域全部完成。
- `待实现`：属于 V1 目标但当前尚未形成完整证据。

| 领域 | V1 能力边界 | 优先级 | 当前状态 | 主要责任 |
|---|---|---:|---|---|
| Artifact | Manifest、`.ux`、template、style、script、assets -> JS Bundle/Page IR/Metadata/Runtime RPK | P0 | 已验证最小链路；待补齐全量基线 | TK-S01..TK-S09 |
| Loader | RPK 校验、模块依赖、页面 IR、资源读取和兼容性预检 | P0 | 已验证最小链路；待补齐负例 | CORE-S02、TK-S07 |
| App/Page VM | App、Page、Surface、Context、初始化和销毁 | P0 | 已验证主链 | JS-S03..S04、CORE-S03..S04 |
| 生命周期 | create、show、hide、destroy；Host signal 不直接调用 JS Hook | P0 | 主链已验证；矩阵场景待补 | JS-S04、CORE-S03、平台 Host |
| 基础容器 | View/Container、父子层级、属性和布局 | P0 | View 已验证；待补齐稳定组件合同 | CORE-S05..S08、平台 Mount |
| 文本 | Text、文本内容、颜色、字号、对齐、字体测量 | P0 | 已验证部分 | Core Layout、平台 Measure |
| 按钮 | Button、label、基础样式、click | P0 | 已验证 | JS-S08、平台 Input/Mount |
| 图片 | Image、基础资源引用、尺寸和加载失败 | P0 | 待实现 | Toolkit、Core、三端 Mount |
| 输入 | Input、value、change/input、基础焦点语义 | P0 | 待实现 | JS、Core、三端 Input |
| 滚动容器 | 基础 Scroll 容器和内容裁剪 | P1 | 待实现 | Core、三端 Mount |
| 基础样式 | width/height、margin/padding、background、color、font、display/flex、borderRadius、opacity | P0 | 已验证部分；待补齐矩阵 | TK-S03..S06、CORE-S07、平台 Measure/Mount |
| 布局 | Yoga/Flex 基础布局、测量、最终 Rect、布局失败 | P0 | 已验证基础布局；待补齐负例 | CORE-S07、平台 Measure |
| 状态 | JS state、Proxy、Binding dependency、Dirty、批量 flush | P0 | 待形成端到端证据 | JS-S05、CORE-S06..S08 |
| 条件渲染 | `if` 的创建、移除和清理 | P0 | 待形成完整证据 | TK-S04..S06、JS-S06、Core |
| 列表渲染 | keyed `for` 的复用、移动、增删和身份清理 | P0 | 待形成完整证据 | TK-S04..S06、JS-S06、Core |
| 增量渲染 | State -> Binding -> RenderTransaction -> Core commit -> Mount；失败支持 full rebuild | P0 | 待实现完整链路 | JS-S05..S07、CORE-S06..S08 |
| 事件 | click、基础 input、Handler、RequestId、target/currentTarget 基础语义 | P0 | click 主链已验证；待补完整事件基线 | JS-S08、CORE-S09、三端 Input |
| 路由 | root、push、back、close、栈提交和失败恢复 | P0 | push 已验证；back/close 待补 | JS-S09、CORE-S04/S10 |
| 页面控制 | title、meta、prompt/toast | P0 | toast/title 路径待统一证据 | CORE-S10、平台 Provider |
| 设备能力 | `system.device.getInfo`、typed result、unsupported/failed | P0 | 合同已定义；待实现 fixture | CORE-S10、三端 Provider |
| 核心 Feature | `system.router`、`system.prompt`、`system.device`、Page title/meta | P0 | 已定义；待完整跨平台验收 | CORE-S10、JS-S09、平台 Provider |
| 延后 Feature | fetch facade 可解析但不承诺真实网络能力 | P1 | 已定义为 deferred | JS-S09 |
| 错误和降级 | typed error、Mount failure、full rebuild、unsupported/failure、teardown 拒绝迟到输入 | P0 | 部分已验证；待完整案例 | CORE-S08..S11、平台项目 |
| 可裁剪 | 固定 Kernel 不裁剪；Feature、Provider、Backend、诊断按 Composition Profile 裁剪 | P0 | 架构已冻结；待双 Profile 证据 | CORE-S01、各平台 Composition |
| 可观测 | Build/Load/Render/Mount/Event/Navigation/Capability/Lifecycle/Destroy marker 和计数器 | P0 | 最小合同已定义；待三端报告 | BM-S02..S07 |

V1 不要求：动画系统、完整手势、复杂文本、全量组件、完整网络/存储/账号/权限、动态插件包、完整 Inspector、AI Feature、Skills/MCP 和外部框架排名。

## 4. Feature 边界

Feature 是平台 API 的开放方式，不是 Core 业务语义的替代品。

```text
JS Facade
  -> typed Runtime ABI
  -> Core ModuleRegistry/Invoker
  -> Platform Provider
  -> Android / iOS / LVGL API
```

V1 Feature 必须具备：

1. 稳定名称和 typed 输入输出。
2. Manifest 声明和 Composition 选择。
3. success、unsupported、not-declared、failed 的区分。
4. RequestId、SurfaceId 和生命周期关联。
5. Provider 可插拔，未选 Provider 不进入最终链接产物。
6. AppRuntime 销毁时取消在途调用并拒绝 late result。

V1 只实现核心 Feature 集合：

```text
system.router
system.prompt
system.device
system.page.title/meta
```

Feature 的数量可以少，但 Feature 机制必须完整。新增 Feature 不得要求修改 Runtime Tree、Navigation 权威状态或三大系统边界。

## 5. 验收方式

V1 不能只用 Case 001 验收。验收分为四层：

| 验收层 | 目标 | 输入 |
|---|---|---|
| Spine | 骨架成立 | Case 001 首屏、点击、push、销毁 |
| Basic Runtime | 基本可用 | 基础组件/样式/输入/绑定/if/for/back/Feature |
| Platform | 平台复用 | 同一 Artifact 在 LVGL、Android、iOS 执行相同语义 |
| Quality | 可投产底线 | 失败、资源、可裁剪、观测、构建复现 |

建议的 V1 focused fixtures：

1. `CASE-001`：启动、基础渲染、点击、push。
2. `CASE-002`：state、if、keyed reorder、增量 Render。
3. `BLOCK-001`：keyed add/remove、Handler 和 Node 清理。
4. `EVENT-REQUEST-001`：连续输入、target/bubble、同步/异步因果。
5. `CAP-DEVICE-001`：核心 Feature success/unsupported/failure/cleanup。
6. `PLATFORM-BACK-001`：back、close/reveal、资源回收。

同一 Fixture 只证明它声明的机制；截图证明可见结果，Trace/快照证明身份、事务、错误和资源。

## 6. Spec 映射

现有 72 个 Spec 保留为责任地图，映射如下：

| 能力域 | 主要 Spec |
|---|---|
| Artifact/Loader | TK-S01..S09、CORE-S02 |
| JS VM/State/Block/Event/API | JS-S01..S10 |
| Runtime Tree/Layout/Transaction/Navigation/Feature | CORE-S01..S11 |
| LVGL 基础平台 | LV-S01..S10 |
| Android 基础平台 | AND-S01..S09 |
| iOS 基础平台 | IOS-S01..S09 |
| Fixture 与跨平台基线 | EX-S01..S04 |
| 观测与基础报告 | BM-S01..S07 |
| V2 Agent 接口和完整对比 | TK-S10、BM-S08..S09 |

执行原则：

1. 不是先完成某项目全部 Spec，再开始下一个项目。
2. 不是为了打勾实现与 V1 无关的外围功能。
3. V1 必需能力必须有 Spec、代码、Fixture 和跨平台证据。
4. V1 非必需能力保留 Spec 边界，但标记 `V2+`，不进入当前门禁。
5. 集成证据可以覆盖多个 Spec，但不能降低任何公共合同断言。

## 7. 当前动作

架构师当前只做以下工作：

1. 关闭 iOS A1 的真实 Simulator 运行证据。
2. 依据本矩阵审计现有 72 个 Spec，标记 `P0/P1/V2+` 和证据缺口。
3. 将当前执行覆盖层从“Case 001 S1-S5 主线”扩展为“V1 Basic Runtime 能力闭环”；M1 仍表示 LVGL/SDL 平台里程碑，不改变底层架构。
4. 发布长期 Integration Agent，但当前只放行 [Phase 2/B1](../v1-basic-runtime/README.md) 的 `CASE-002`。
5. 每个能力完成后，由总架构检查跨平台语义和边界；通过后再进入下一能力。
6. 三个平台只实现同一能力矩阵对应的 Platform Adapter；不分别发明平台私有语义。
7. V1 Basic Runtime 通过后，再启动基础 Benchmark 报告和 V2 Feature 扩展。

本文件不改变已有公共 Contract；若实现发现 Contract 缺口，只能在对应 Handoff 记录 `[待决策]`，由总架构统一处理。
