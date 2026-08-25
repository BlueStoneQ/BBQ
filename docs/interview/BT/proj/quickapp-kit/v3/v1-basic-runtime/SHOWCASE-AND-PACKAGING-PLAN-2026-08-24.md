# V1 Showcase And Packaging Plan

## 目录

- [1. 结论](#1-结论)
- [2. 展示目标](#2-展示目标)
- [3. 四个案例](#3-四个案例)
- [4. 执行顺序](#4-执行顺序)
- [5. 共享边界](#5-共享边界)
- [6. Agent 提示词](#6-agent-提示词)
- [7. 今晚完成定义](#7-今晚完成定义)

## 1. 结论

当前不再扩展外围架构，直接进入产品展示和项目包装阶段。

本轮目标不是继续打勾 Spec，而是用真实联盟 DSL 生成几个可运行、可交互、看起来像产品的 RPK：

```text
联盟 DSL
-> Toolkit
-> RPK
-> JS Framework
-> C++ Core
-> LVGL/SDL、Android、iOS
-> 可见应用和视频
```

Timer 具有长期价值，但不是本轮展示门槛。Timer 当前保持 `DEFERRED`；本轮展示应用使用手动刷新，不等待 Timer。设备信息也不作为基础 RPK 的前置能力。

## 2. 展示目标

第一阶段的产品判断标准：

> 用户打开应用后，看到的是一个有信息层级、列表、状态、详情和返回路径的真实快应用，而不是只验证一个按钮的技术夹具。

必须体现：

- `View/Text/Button/Image`；
- `state` 驱动文本和状态变化；
- `if` 状态节点；
- keyed `for` 列表；
- `router.push/back`；
- 基础 Feature 调用；
- 小尺寸本地图片；
- 基础样式、卡片、间距和信息层级；
- 三端使用同一个 RPK；
- teardown 后资源归零。

AI 采用独立 Showcase 验证，不阻塞三个基础案例。第一版只要求 Chat 组件和可替换 AI Provider 跑通，不要求真实模型、网络、录音或摄像头。

不在本轮加入：

- 网络、Storage、权限、媒体；
- Timer 自动刷新；
- `system.device` 设备假设；
- 新组件 Contract；
- 新 Bridge、第二套路由或第二棵树；
- 大图片、截图资源或 SVG Runtime。

## 3. 四个案例

### 3.1 Gallery-001：技术基线

保留现有设备巡检/任务看板，继续用于验证：

- Image、state、if、keyed `for`；
- prompt 请求；
- push/back；
- 真实 RPK 和资源清理。

它是机制和主链基线，不要求成为最终产品展示的唯一应用。

基础 Gallery 不要求声明 `system.device`。`system.router` 属于 Runtime 固定语义，`system.prompt` 可作为通用 Provider；Camera、Haptics、Storage 等平台能力另建 Feature Showcase，不阻塞基础应用。

### 3.2 Consumer-001：普通 C 端应用

产品定位：轻量“每日清单/内容卡片”应用。

Home：

- 顶部标题和今日摘要；
- 3 个内容卡片；
- 每个卡片包含小图、标题、分类/状态、详情按钮；
- 手动刷新改变状态或顺序；
- `if` 显示空状态/刷新状态；
- keyed `for` 保持卡片身份。

Detail：

- 复用小图；
- 标题、分类、摘要和操作按钮；
- 返回 Home；
- 返回后再次打开详情。

### 3.3 Wearable-001：手表/手环应用

产品定位：有限屏幕上的“今日摘要/健康任务”应用。

约束：

- 只在安全区域内布局，避免依赖大屏宽度；
- 信息优先于装饰；
- 只使用 1-3 张 `32x32` 或 `48x48` 小图片；
- 列表最多 3 条；
- 每条只显示图标、短标题、状态；
- Detail 页面保持紧凑；
- 使用现有 viewport/profile，不为手表新增平台旁路；
- 不加入复杂动画、手势、网络和后台能力。

它重点证明同一 Runtime 模型可以适配有限屏幕，而不是伪造完整手表系统。

### 3.4 Platform Feature Showcase：平台能力案例

平台 Feature 不要求所有 RPK 跨平台相同：

| 平台 | Feature Showcase | 说明 |
|---|---|---|
| LVGL/RTOS | 小屏/手表摘要 | 重点验证有限屏幕、资源和裁剪，不假设 Camera |
| Android | Camera/图片采集 | 使用 Android Provider，展示 typed success/unsupported/failed |
| iOS | Camera/图片采集 | 使用 iOS Provider，复用同一 Feature Contract |

Feature Showcase 在基础三端 RPK 通过后再启动，不修改固定 Kernel。

### 3.5 AI-Chat-001：AI 应用基线

产品定位：一个面向小屏和手机的轻量 AI 助手，不是模型性能演示。

页面：

- Home：助手卡片、最近会话、开始对话按钮；
- Chat：消息列表、输入框、发送按钮、加载/错误/空状态；
- Detail/About：展示当前助手信息，支持返回 Chat 或 Home。

必须验证：

- `View/Text/Button/Input` 组合渲染；
- keyed `for` 渲染消息列表；
- `if` 表示 loading、empty、failed 和 completed；
- state 驱动输入内容、消息追加和状态切换；
- 点击发送按钮调用 `system.ai.chat` typed Feature；
- Provider 返回确定性的增量消息或完成结果；
- 消息列表超过屏幕后可通过现有页面 viewport 滑动查看；
- `router.push/back` 和重复进入 Chat；
- teardown 后请求、Handler、消息和 Provider 资源归零。

第一版使用 `MockAiProvider`，例如将输入转换为确定性的回复。它必须经过真实 Bridge/Core Feature Registry/Provider 路径，不得由 Example Agent 直接改页面状态伪造 AI 结果。后续 Android/iOS/Rust Provider 替换时，JS Chat 组件和 Core 路由不变。

VoiceChat 不在本轮实现；它后续组合 `Recorder + Network/AI + Playback` Feature。

## 4. 执行顺序

| 顺序 | Agent | 工作 | 依赖 |
|---|---|---|---|
| 0 | Timer Agent | 停止 Timer 扩展，恢复默认 Core/JS/LVGL 构建绿色 | 无 |
| 1 | Example Agent | 一次完成 Gallery 增强、Consumer-001、Wearable-001 | 无 |
| 2 | Toolkit Agent | 构建三个真实 RPK，检查资源和确定性 | Example 源码 |
| 3 | LVGL Agent | 三个 RPK 逐一运行、点击、截图、teardown | Toolkit RPK |
| 4 | Android Agent | 使用同三个 RPK 做平台运行和录制 | Toolkit RPK |
| 5 | iOS Agent | 使用同三个 RPK 做平台运行和录制 | Toolkit RPK |
| 6 | AI Feature Agent | 冻结最小 `system.ai.chat` typed Contract，实现 Mock Provider | 三态/流式结果和清理测试 |
| 7 | AI Example Agent | 实现 AI-Chat-001 联盟 DSL 和真实 RPK | AI Feature Contract |
| 8 | Platform Feature Agent | 在 LVGL 先跑 Mock AI，再规划 Android/iOS/Rust Provider | AI-Chat 运行结果 |
| 9 | Packaging Agent | 更新 README、案例索引、构建命令、产物哈希和视频位置 | 至少基础案例通过 |

Example Agent 可以与 Timer Agent、平台 Agent 并行。AI Feature Agent 只允许增加可选 Feature Contract/Provider，不得改动 Runtime Tree、Render、Event、Navigation。Core/JS 公共代码同一时间只允许一个 Agent 写入。

## 5. 共享边界

### Example Agent

只修改 `quickapp-examples/showcases/` 下的案例源码、资产、构建脚本和说明。不得修改 Core、JS、LVGL、Android、iOS、公共 Contract 或既有机制案例。

### Toolkit Agent

只修复三个案例无法由现有联盟 DSL 生成 RPK 的问题。不得为案例新增 SVG、Timer、网络或新的 Runtime ABI。

### Platform Agent

只修改自己的 Host/Adapter、Composition Root 和平台测试。不得创建第二套路由、第二棵 Tree 或旁路 UI。

### Timer Agent

本轮保持 `DEFERRED`，不得阻塞展示案例。Timer 后续重新单独启动。

### Feature Agent

Feature Agent 只实现平台 Provider 和 Feature Showcase：

- Core 只提供 typed message、ModuleRegistry/Invoker、声明校验、生命周期和结果关联；
- Camera、Haptics、Storage 等具体实现位于 Android/iOS/LVGL Provider；
- 未选 Provider 不进入最终链接产物；
- 不修改 Runtime Tree、Render、Event、Navigation 固定语义；
- Feature 不得成为基础 Gallery/Consumer/Wearable RPK 的阻塞依赖。

### AI Feature Agent

AI Feature Agent 只实现最小 `system.ai.chat` 能力：

- Core 只负责 typed request、`RequestId`/`SessionId` 关联、异步 chunk、completed/failed/unsupported/cancelled 和生命周期；
- MockAiProvider 只用于确定性验收，不代表生产模型；
- Provider 不拥有 Runtime Tree、Navigation 或页面状态；
- 未来 Rust Agent Engine 通过同一个 Provider Port 接入 `.so`、静态库或平台封装；
- 未链接的 AI Provider 必须返回 `unsupported`，不能伪造成功；
- 不实现录音、摄像头、相册、网络和真实模型接入。

## 6. Agent 提示词

### 6.1 Timer Agent：立即止损

```text
你是 QuickApp Kit Timer Agent。

当前展示主线不依赖 Timer。立即暂停 Timer 功能扩展，优先恢复默认构建绿色。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/SHOWCASE-AND-PACKAGING-PLAN-2026-08-24.md
2. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md

执行：
1. 保留已有 Timer 修改，不删除他人工作；
2. 修复或隔离 timer_registry.cpp、JS ABI Timer switch/codec 的编译问题；
3. 确保默认 Core、JS、LVGL、Examples 构建和既有 Case 回归通过；
4. 不继续扩展 Timer API，不接入 Gallery，不修改 Android/iOS；
5. 在 INTEGRATION-HANDOFF.md 记录 Timer=DEFERRED、默认构建=GREEN；
6. 完成后停止，不等待下一项确认。
```

### 6.2 Example Agent：一次完成三个展示案例

```text
你是 QuickApp Kit V1 Showcase Example Agent。

你的任务不是只完成一个 Fixture，而是一次连续完成三个可展示的真实联盟 DSL 应用。不要在完成 Gallery-001 后停止，不要等待确认，按 E1 -> E2 -> E3 连续执行。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/SHOWCASE-AND-PACKAGING-PLAN-2026-08-24.md
2. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/EXAMPLE-GALLERY-PLAN.md
3. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md
4. quickapp-examples 中已通过的联盟 DSL 案例和 Toolkit 构建脚本

只允许修改：
- quickapp-examples/showcases/**
- 相关最小构建说明和索引

禁止修改：
- quickapp-runtime-core、quickapp-runtime-js、quickapp-runtime-lvgl；
- Android、iOS、公共 Contract、Bridge、Render、Event、Navigation；
- 既有 Case 001/002/BLOCK-001；
- C++ composition 中的手写 UI、Page IR、RenderTransaction、MountTransaction 或第二套路由。

E1：增强 Gallery-001
1. 保留现有设备巡检/任务看板；
2. 删除页面中的 `@system.device` import、调用和设备信息状态字段；
3. 从 `manifest.json` capabilities/features 中删除 `system.device`；
4. 初始就展示 3 个条目，而不是只有 1 个；
5. 使用 2-3 张不同的小 PNG，单张 32x32 或 48x48、单张不超过 4 KiB、总图片不超过 12 KiB；
6. 增加顶部摘要、正常/待复核/异常状态、最后刷新序号；
7. 保留 if、keyed for、手动刷新、Detail、push/back；
8. Detail 展示被点击条目的稳定内容，不要永远写死为同一条目；
9. 不加入 Timer，刷新保持确定性。

E2：新增 Consumer-001
目录：quickapp-examples/showcases/consumer-001/
产品：轻量每日清单/内容卡片。
必须有：
- Home/Detail；
- 3 个小图卡片；
- 标题、分类、状态、摘要；
- state 更新；
- if 刷新/空状态；
- keyed for 列表；
- router.push/back；
- 手动刷新和 prompt；
- 基础卡片样式和清晰的信息层级。

E3：新增 Wearable-001
目录：quickapp-examples/showcases/wearable-001/
产品：手表/手环今日摘要或健康任务。
必须有：
- 紧凑 Home/Detail；
- 安全区域内布局；
- 最多 3 个短信息条目；
- 1-3 张小 PNG；
- if、keyed for、state、push/back；
- 适合有限屏幕的信息密度；
- 不新增手表专用 Runtime、组件或平台逻辑。

三个案例共同约束：
- 只使用现有联盟 DSL 和已经支持的组件/样式；
- 不使用 `system.device`、网络、Storage、权限、媒体、Timer、SVG Runtime；
- 不使用 Simulator 截图作为资产；
- 每个案例必须由 Toolkit 生成真实 RPK；
- 每个案例构建两次，SHA-256 必须一致；
- 每个案例输出 manifest、RPK、元数据、资源尺寸/字节和运行命令。
- 构建前使用 `rg` 确认三个案例源码和 manifest 均不声明 `system.device`；构建后检查 RPK manifest 也不含该能力。

执行顺序：
1. 先检查并增强 Gallery-001；
2. 再创建 Consumer-001；
3. 再创建 Wearable-001；
4. 分别构建三个 RPK；
5. 使用现有 LVGL/SDL Simulator 至少启动并验证每个 RPK；
6. 回归既有 Case 001、CASE-002、BLOCK-001；
7. 将全部结果追加到 INTEGRATION-HANDOFF.md；
8. 三个案例全部完成后才停止。

如果某个普通 DSL 或构建问题存在，直接采用现有代码最小修复并继续。只有无法由现有 DSL/Runtime 表达且会改变公共 Contract 时，记录 BLOCKED，同时继续完成其他案例。
```

### 6.3 Toolkit Agent：三个 RPK

```text
你是 QuickApp Kit Toolkit Agent。

等待 Example Agent 产出三个 showcase 源码后，连续构建：
1. quickapp-examples/showcases/gallery-001
2. quickapp-examples/showcases/consumer-001
3. quickapp-examples/showcases/wearable-001

要求：
- 使用真实联盟 DSL；
- 不手写 Page IR 或 Runtime Transaction；
- 每个案例构建两次并比较 SHA-256；
- 检查 manifest、路由、Image、Text、Button、if、for、资源大小；
- 不新增 Timer、网络、Storage、SVG 或公共 ABI；
- 回归现有 Toolkit 测试；
- 将三个 RPK 路径、大小、SHA-256 和测试结果追加到 INTEGRATION-HANDOFF.md；
- 三个 RPK 全部生成后停止，不等待架构师确认。
```

### 6.4 LVGL/Android/iOS Agent：三端运行

```text
你是 QuickApp Kit Platform Showcase Agent。只修改你负责的平台项目。

使用同一批 RPK：
- gallery-001.rpk
- consumer-001.rpk
- wearable-001.rpk

连续完成：
1. 启动每个 RPK；
2. 验证首屏、列表、if、状态刷新、Image、详情、push/back；
3. 验证重复进入详情和 teardown；
4. 保存真实运行命令、退出码、资源结果和视频/截图路径；
5. 记录平台视觉差异，但不改变应用语义。

禁止：
- 修改 Core、JS、Toolkit 和公共 Contract；
- 创建第二套路由、第二棵 Tree 或平台私有业务状态；
- 为某个平台单独改写案例 DSL；
- 为了截图伪造 UI 或事件。

三个案例全部完成后，把结果追加到 INTEGRATION-HANDOFF.md 并停止。
```

### 6.4.1 LVGL Showcase Simulator Agent：通用 RPK 入口

```text
你是 QuickApp Kit LVGL Showcase Simulator Agent。

目标：修复并验证通用 Showcase Simulator，使它能够加载任意符合当前 RPK Contract 的 Showcase RPK。当前已确认的问题是 Composition Root 只注册一个图片资源，而真实 RPK 可能包含多个图片资源，导致后续 Image Mount 失败。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/SHOWCASE-AND-PACKAGING-PLAN-2026-08-24.md
2. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md 的 V1 Showcase Suite E1-E3 和后续 Simulator 修复记录
3. quickapp-examples/composition 当前 Simulator/Composition Root
4. quickapp-runtime-lvgl 当前 Mount、Image 资源和 Input 代码

只修改：
- quickapp-examples/composition/ 的通用 Showcase Simulator 入口；
- quickapp-runtime-lvgl 的必要资源装配、Mount 生命周期和平台测试；
- 对应构建说明和验收记录。

必须实现：
1. 从真实 RPK 资源表枚举并注册全部图片资源，不写死单张图片；
2. 图片资源按 RPK 路径和资源描述绑定，不能按固定文件名或固定序号注入；
3. 页面 Host Node、Image Native Object、Handler 和 Surface 生命周期必须由现有 Core/Render/Event/Navigation 链路驱动；
4. 连续验收 Gallery-001、Consumer-001、Wearable-001 三个真实 RPK；
5. 每个 RPK 验证：Home 首屏、Image 列表、if、keyed for、页面滑动、点击条目、Detail、router.back、再次进入 Detail、teardown；
6. 至少重复进入 Detail 三次，确认图片、Handler、Native Object 不使用旧实例；
7. 记录每个 RPK 的资源数量、Image Mount 数量、Handler 数量、退出码和 `resources_released=true`；
8. 交互入口保持持续 SDL event loop，窗口关闭和 SIGINT 必须正常 teardown。

严格禁止：
- 修改 Core 唯一 Runtime Tree、Navigation、Bridge、RenderTransaction 或公共 Contract；
- 在 Simulator 中创建第二套路由、第二棵树或手写业务 UI；
- 通过固定资源、固定节点、旁路按钮或直接调用 Navigation 绕过真实 RPK；
- 为了通过测试删除多图片、替换 Image 为 Text 或跳过失败资源；
- 顺手修复 Timer、AI、Android/iOS 或 Benchmark。

验收顺序：
1. 先构建 Simulator；
2. 用三个真实 Showcase RPK 分别启动；
3. 保存真实交互命令、截图/视频路径和退出结果；
4. 回归 Case 001、CASE-002、BLOCK-001、Binding-001；
5. `lv_s02` Libuv close 失败若仍存在，单独记录为既有问题，不与本任务混合；
6. 将完整结果追加到 INTEGRATION-HANDOFF.md；
7. 验收完成后停止，不等待下一项确认。
```

### 6.5 Packaging Agent：项目包装

```text
你是 QuickApp Kit V1 Packaging Agent。

在至少 LVGL 三个案例运行通过后，整理项目展示入口，不修改 Runtime 语义。

完成：
1. 更新 quickapp-examples/README.md 和 README_zh.md；
2. 增加三个 Showcase 的定位、源码目录、构建命令和 RPK 路径；
3. 增加 LVGL、Android、iOS 的运行命令；
4. 增加 RPK SHA-256、版本和平台状态表；
5. 为每个平台预留真实视频链接位置，不伪造视频或截图；
6. 增加从 Toolkit -> RPK -> Runtime Host 的最短使用路径；
7. 生成一个只读 Showcase Index，不复制源码和 RPK；
8. 不修改 Core、JS、LVGL、Android、iOS、公共 Contract；
9. 完成 README 和索引后停止。
```

### 6.6 AI Feature Agent：最小 AI 能力

```text
你是 QuickApp Kit AI Feature Agent。

目标：为 AI-Chat-001 提供一个最小、可替换、可裁剪的 system.ai.chat Feature。不要实现真实模型，不要把 AI Engine 放进 Core。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/SHOWCASE-AND-PACKAGING-PLAN-2026-08-24.md
2. BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec
3. quickapp-runtime-core 当前 ModuleRegistry/Invoker 和 typed Feature Contract
4. quickapp-runtime-js 当前 Feature ABI

实现：
1. 定义最小 chat.send request：sessionId、message、requestId；
2. 定义结果：chunk、completed、failed、unsupported、cancelled；
3. 保证每个结果携带 requestId 和 sessionId；
4. 实现 MockAiProvider，返回确定性回复，可验证多次发送和 teardown；
5. 通过现有 Core Registry/Invoker 和 JS ABI 路由，不允许 Example 直接修改聊天状态伪造结果；
6. Provider 生命周期必须在 Surface teardown 后清理，不能留下请求、队列或回调；
7. 增加 Core、JS 和 Provider 定向测试。

严格禁止：
- 修改 Runtime Tree、Render、Event、Navigation 主语义；
- 新增 Chat 原生 Host Component；
- 接入真实网络、模型、录音、摄像头、相册或 Rust；
- 修改基础 Gallery/Consumer/Wearable 的运行条件；
- 创建第二套 Bridge 或绕过 ModuleRegistry。

完成后追加 INTEGRATION-HANDOFF.md，写清 Contract、测试、资源清理和未实现项，然后停止。
```

### 6.7 AI Example Agent：AI-Chat-001

```text
你是 QuickApp Kit AI-Chat-001 Example Agent。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/SHOWCASE-AND-PACKAGING-PLAN-2026-08-24.md
2. quickapp-examples 中已经通过的联盟 DSL 案例
3. AI Feature Agent 交付的 system.ai.chat Contract

只修改 quickapp-examples/showcases/ai-chat-001/** 和必要的 Example 构建索引。

实现一个真实联盟 DSL 应用：
1. Home：助手卡片、最近会话、开始对话按钮；
2. Chat：Input、消息 keyed for 列表、发送 Button、loading/failed/completed if 状态；
3. 发送按钮调用 system.ai.chat，不直接写入假回复；
4. 收到 Mock Provider 的 chunk/completed 后更新消息 state；
5. 消息超过首屏后可通过现有页面 viewport 滑动查看；
6. router.push/back 到 Chat 和 Detail，并验证重复进入；
7. teardown 后无旧 Handler、请求或 Provider 资源；
8. 使用小型本地图片，遵守嵌入式资源预算。

禁止：
- 修改 Core、JS Runtime、LVGL、Android、iOS、公共树/渲染/事件/路由语义；
- 直接调用 C++、Platform API 或旁路 Bridge；
- 伪造 AI 返回、引入真实网络或模型；
- 新增 Chat 原生 Host Component；
- 把 VoiceChat、Recorder、Camera、Album、Network 放进本案例。

使用 Toolkit 生成真实、可重复的 ai-chat-001.rpk，运行两次比较 SHA-256，并追加构建和验收结果到 INTEGRATION-HANDOFF.md。完成后停止，不等待确认。
```

## 7. 今晚完成定义

今晚不要求 Timer、网络、真实 AI 模型或完整组件库。

最低完成线：

```text
Gallery-001 增强
Consumer-001
Wearable-001
-> 三个真实 RPK
-> LVGL 至少全部可运行
-> 既有主链回归通过
-> README 有构建和运行入口
```

理想完成线：

```text
三个 RPK
-> LVGL 视频
-> Android 视频
-> iOS 视频
-> README 展示入口
```

Timer、Scroll、更多输入组件和系统能力进入下一轮基础产品增强，不阻塞今晚的第一个可展示版本。

AI-Chat-001 在三个基础案例通过后启动；AI Feature Contract 可以先独立实现，但不得阻塞基础 RPK 和三端回归。
