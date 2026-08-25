# Gallery-001 Product Baseline

## 目录

- [1. 结论](#1-结论)
- [2. 目标](#2-目标)
- [3. 范围](#3-范围)
- [4. 页面与交互](#4-页面与交互)
- [5. 交付物](#5-交付物)
- [6. 边界](#6-边界)
- [7. 验收](#7-验收)
- [8. 后续](#8-后续)
- [9. Example Agent 指令](#9-example-agent-指令)

## 1. 结论

`Gallery-001` 的展示产品是一个面向嵌入式设备的“设备巡检/任务看板”：Home 展示少量带缩略图的设备或任务，Detail 展示单项详情和操作结果。它用于证明框架能够运行一个有实际结构的多页快应用，不是高分辨率照片墙。案例只使用 1-3 张小型本地图片。现有 Case 001/002 继续作为合同和回归 Fixture，不被替换。

第一版使用 RPK 内置的小尺寸本地缩略图和确定性数据；路由和已经实现的 Feature 进入展示。定时器作为下一项最小 Runtime Service 接入同一个应用，不通过 Simulator 或 Example 旁路伪造。

## 2. 目标

组合并验证已经存在的主链能力：

```text
联盟 DSL
-> Toolkit
-> Runtime RPK
-> JS Runtime
-> C++ Core
-> Image/Text/Button
-> keyed for
-> if
-> Event
-> Navigation
-> Platform teardown
```

## 3. 范围

必须包含：

- Home 与 Detail 两个页面；
- 本地 Image 资源；
- Image + Text 组成的 keyed `for` 列表；
- 列表刷新按钮，执行确定性数据变更；
- `if` loading/empty 状态切换；
- 点击列表项或详情按钮进入 Detail；
- Detail 返回 Home；
- 调用已经实现的 `system.prompt` 展示刷新或操作结果；
- RPK 资源路径和构建元数据可检查。

必须删除：

- 页面中的 `@system.device` import 和调用；
- `manifest.json` 中的 `system.device` capability；
- 任何依赖设备型号或设备信息返回值的展示状态。

构建后的 Gallery RPK 也不得声明 `system.device`。设备信息属于后续可选 Feature，不是基础 Showcase 的运行前提。

不要求第一版包含：

- 网络请求；
- `setInterval`/`setTimeout` 自动刷新；
- 账号、权限、媒体和复杂手势；
- 自定义 Runtime、Core 或平台旁路逻辑。

定时器和设备信息不作为本轮 Example Agent 的隐式前置条件。看板使用确定性本地数据和手动刷新完成基线；Timer、Camera 等平台能力使用独立 Feature RPK 后续验证。

## 4. 嵌入式资源约束

图片是本案例的约束对象，必须按嵌入式资源预算设计：

- 图片资源数量为 `1-3` 张；
- 每张图片最大 `48x48` 像素；
- 每张图片压缩后不超过 `4 KiB`；
- 图片资源总压缩大小不超过 `12 KiB`；
- 列表最多 3 个条目；
- Detail 复用同一张小缩略图，不引入大图或高清详情图；
- 基线优先使用小型 PNG；不为了本案例新增 SVG 解析器或 SVG Runtime Contract；
- 图片必须作为源码资产提交，不使用 Simulator 截图；可以用简单 SVG 作为设计源，但交付前必须预转换为固定尺寸 PNG；
- 不使用网络图片、Base64 图片、运行时下载、预加载队列或无限图片缓存；
- 构建验收必须记录图片尺寸、压缩字节数和 RPK 总大小；
- 运行验收必须记录 Image Host object 数量和资源释放结果。

图片显示尺寸不应通过放大来伪造大图体验；视觉重点是卡片布局、状态变化、交互和资源生命周期。

以上是 `Gallery-001` 的案例预算，不是所有 QuickApp Kit 应用的全局图片限制。后续若支持 SVG，应作为独立的资源格式能力定义解码、内存预算和平台一致性验收。

## 5. 页面与交互

### Home

```text
标题
状态信息：条目数量 / 当前刷新序号
刷新按钮
loading 或 empty 条件节点
紧凑信息卡片列表：小图标、标题、状态摘要、查看详情按钮
```

### Detail

```text
小尺寸缩略图
标题
摘要或正文
返回 Home 按钮
```

标准流程：

```text
Home 首屏
-> 列表可见
-> 点击刷新
-> 列表内容或顺序发生确定性变化
-> 点击列表项
-> Detail 可见
-> 返回 Home
-> 再次刷新
-> teardown
```

Timer 接入后的展示流程为：

```text
Home
-> system.timer.start
-> 时间或巡检序号状态更新
-> 页面离开或 teardown
-> system.timer.cancel
-> 无 late callback、无资源泄漏
```

## 6. 交付物

目录固定为：

```text
quickapp-examples/showcases/gallery-001/
```

至少交付：

- `src/manifest.json`；
- `src/app.ux`；
- `src/pages/Home/index.ux`；
- `src/pages/Detail/index.ux`；
- `src/assets/images/*`；
- `README.md`；
- Toolkit 可重复构建的 Gallery RPK；
- 构建元数据和最小运行说明。

## 7. 边界

Example Agent 只能修改 `quickapp-examples` 与必要的 Toolkit Example Fixture/构建测试。

禁止修改：

- `quickapp-runtime-core`；
- `quickapp-runtime-js`；
- `quickapp-runtime-lvgl`、Android、iOS；
- 公共 Contract、Schema、Bridge、Runtime Tree、Navigation；
- 当前 `tk-s12-lvgl-p0` 基线及既有 Case。

如果某个平台尚未支持 Image，不得在 Example 侧降级伪造；记录为 Platform Adapter 待办。

## 8. 验收

### Toolkit

- Alliance DSL 源码构建成功；
- RPK 可重复生成；
- manifest 含 Home/Detail 路由；
- RPK 含图片资源；
- 图片尺寸、单图字节、图片总字节和 RPK 总大小满足嵌入式预算；
- Home Page IR 含 Image、Text、Button、`for`、`if`；
- Detail Page IR 含 Image、Text、Button；
- 基线若调用 Feature，Page/JS 产物必须使用已经存在的 typed ABI；不得为了展示假设嵌入式设备型号或能力。
- 资源路径全部位于 RPK 资源空间。

### Runtime

使用同一 Gallery RPK 在 LVGL、Android、iOS 逐步验收：

```text
首屏
-> 图片列表
-> 刷新状态
-> 列表更新
-> Detail
-> back
-> teardown
```

Example Agent 负责产物和静态验收；各 Platform Agent 负责自己的 Image Mount、资源加载和真实交互验收。

## 9. 后续

`Gallery-001` 通过后，单独设计并实现最小 `system.timer` Contract，再将自动巡检/更新时间接回本应用；不把定时器隐式塞进 JS Framework，也不让平台直接修改应用状态。

## 9. Example Agent 指令

```text
你是 QuickApp Kit 的 Example Agent。请实现 v3/v1-basic-runtime 的 Gallery-001 基线 RPK。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/EXAMPLE-GALLERY-PLAN.md
2. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/NEXT-EXECUTION-PLAN-2026-08-24.md
3. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md
4. quickapp-examples 中已通过的联盟 DSL 案例、Toolkit 构建命令和 manifest 约束

产品定位：设备巡检/任务看板，不是照片墙。

交付目录：
quickapp-examples/showcases/gallery-001/

必须实现：
1. Home 和 Detail 两个页面；
2. Home 有标题、条目数量、手动刷新按钮；
3. 使用 if 表示 loading/empty 或操作状态；
4. 使用 keyed for 渲染最多 3 个条目的列表；
5. 每个条目包含一张 32x32 或 48x48 的小图片、标题、状态和详情入口；
6. 点击条目进入 Detail，使用真实 router.push；
7. Detail 使用同一张小图片，提供真实 router.back 返回 Home；
8. 返回后 Home 可再次点击详情，不能出现旧 Handler 或旧 Surface 问题；
9. 在已有 ABI 可用的前提下，可调用 system.prompt 显示刷新或操作结果；
10. 刷新使用确定性 state 变化，必须产生可见列表/状态变化。

图片约束：
- 只使用 1-3 张本地小型 PNG；
- 每张最大 48x48，单张压缩后不超过 4 KiB，总图片不超过 12 KiB；
- 可以用 SVG 或绘图工具作为设计源，但最终提交给 RPK 的必须是预生成 PNG；
- 禁止截图作为图片资产；禁止网络、Base64、运行时下载和大图；
- 不新增 SVG Runtime 支持。

本轮明确不做：
- 不加入 setInterval/setTimeout、system.timer 或 system.device；
- 不加入网络、存储、权限、媒体和复杂动画；
- 不修改 Core、JS Runtime、LVGL、Android、iOS、公共 Contract、Navigation 或 Event；
- 不在 C++ composition 中手写 UI、Page IR、RenderTransaction 或 MountTransaction；
- 不创建第二套路由、第二棵 Tree 或旁路 Bridge。

执行要求：
1. 使用真实联盟 DSL 源码；
2. 用现有 Toolkit 生成真实、可重复的 Gallery RPK；
3. 检查 manifest、路由、Page IR、图片路径和图片字节预算；
4. 用已有 LVGL/SDL 入口加载 RPK 做最小运行验收；
5. 回归既有 Case 001、CASE-002、BLOCK-001，不修改它们；
6. 普通 DSL、资源路径和构建问题自行解决；若现有 Feature ABI 不可用，记录事实，不伪造 API；
7. 完成后追加 INTEGRATION-HANDOFF.md：源码路径、RPK 路径、SHA-256、图片尺寸/字节、运行命令、Home/Detail/back 结果和 teardown 结果；
8. 完成基线后停止，不自动开始 Timer 或其他外围能力。
```
