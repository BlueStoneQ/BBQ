# QuickApp Kit Benchmark 方案与架构调研

## 结论

Benchmark 应该是一个可拆卸、可裁剪的外围项目，不进入 Core 主链，也不成为 Runtime 的运行时依赖。

Core 只提供最小的公共观测出口：单调时钟、`TraceSink`、稳定计数器和已冻结的 Observation Contract。Benchmark 负责场景驱动、目标平台适配、数据采集、原始样本保存、统计和报告。关闭 Benchmark 后，Runtime 的状态、事务结果、错误和线程顺序必须保持一致。

业界方案可以借鉴指标分类和采集工具，但不能直接复制单个平台的数字。RN、Flutter、Lynx、小程序和快应用的线程模型、渲染管线、包格式和设备环境不同，横向比较必须建立在同设备、同构建模式、同场景和同启动定义上。

QuickApp Kit 的 V1 应先完成三件事：

1. 建立同一份 RPK 在 Simulator、Android、iOS、LVGL/嵌入式上的可重复基线。
2. 按性能、稳定性、功耗、内存、包体五个一级域组织指标；启动、事件、布局和 Mount 作为性能域下的二级指标。
3. 保存原始数据和环境身份，先做趋势和回归检测，暂不做外部框架排名。

## 一、当前项目状态

`quickapp-kit-ai/quickapp-benchmark` 当前已经具备一层基础能力：

| 已有能力 | 现状 | 归属 |
|---|---|---|
| Observation Schema 校验 | 已有 | Benchmark |
| Marker/Trace 覆盖校验 | 已有 | Benchmark |
| 有界 Collector | 已有 | Benchmark |
| Noop/Recording 等价性 | 已有 | Benchmark |
| Trace 热路径开销测量 | 已有 | Benchmark |
| Android/LVGL/iOS Target Adapter | 尚未形成统一执行层 | Benchmark 外围 |
| RPK 场景驱动 | 尚未形成统一 Catalog | Benchmark 外围 |
| 原始运行样本和环境封存 | 只有 Trace 证据 | Benchmark 外围 |
| 跨平台性能报告 | 尚未实现 | Benchmark 外围 |

因此，Benchmark 不是从零开始；当前仓库更接近“观测合同验证库”，下一步是增加独立的实验执行层和报告层。

## 二、目标架构

```text
benchmark CLI
  -> scenario catalog
  -> experiment controller
  -> target adapter
       -> Simulator / Android / iOS / LVGL / Embedded
  -> trace collector + platform collector
  -> immutable raw sample store
  -> validator + aggregator
  -> report / regression gate
```

### 2.1 模块边界

| 模块 | 负责内容 | 是否必选 | 与 Core 的关系 |
|---|---|---:|---|
| Scenario Catalog | RPK、步骤、输入、预热、重复次数、成功断言 | 是 | 只调用公开 SDK/Host 能力 |
| Experiment Controller | 重置目标、启动、执行步骤、停止、封存样本 | 是 | 不读取 Runtime 内部对象 |
| Target Adapter | 构建、安装、启动、输入、日志和停止 | 按平台加载 | 平台插件，不进入 Core |
| Trace Collector | 接收公共 Observation marker，记录丢样 | 是 | 通过 `TraceSink` 或导出文件接入 |
| Platform Collector | CPU、内存、帧时间、温度等平台事实 | 按指标加载 | 平台插件 |
| Raw Sample Store | 保存原始事件、环境、构建和失败原因 | 是 | 独立文件格式 |
| Validator | 校验 Schema、边界、关联和覆盖 | 是 | 消费公共合同 |
| Aggregator | 计算分位数、失败率、趋势和回归 | 可选 | 不改变 Runtime |
| Reporter | 输出 JSON、CSV、Markdown、HTML 或 CI 结果 | 可选 | 不改变 Runtime |

### 2.2 可裁剪形态

Benchmark 应按能力拆成独立 profile：

| Profile | 包含内容 | 适用场景 |
|---|---|---|
| `contract` | Schema、Trace、覆盖和等价性校验 | Core/平台开发和 CI |
| `runtime` | RPK 场景、启动、更新、导航、销毁 | 三端运行时基线 |
| `embedded` | LVGL、设备输入、内存和帧时间采集 | ESP32、手表、手环 |
| `mobile` | Android/iOS 安装、冷暖启动、帧和内存采集 | 移动端 |
| `compare` | 多次运行聚合和回归门禁 | CI、版本比较 |
| `report` | 报告渲染和趋势展示 | 离线分析 |

设备固件只需链接必要的 `contract` 或 `embedded` 采集适配；Benchmark CLI、报告和外部依赖不能被打入 Runtime SDK 或 RPK。

### 2.3 Core 最小依赖

Core 只保留以下稳定出口：

```text
MonotonicClock.nowNs() noexcept
TraceSink.emit(immutable TraceEvent) noexcept
RuntimeCounters.snapshot() noexcept
```

Benchmark 不应通过扫描 Runtime Tree、读取内部队列或注入私有回调获得指标。需要新增 marker 或字段时，先更新公共 Observation Contract 和 Schema，再由 Benchmark 消费。

## 三、业界项目调研

以下内容按照公开官方文档、官方调试工具和常见性能实践整理。各项目的指标名称和工具接口不能直接作为 QuickApp Kit 的公共合同。

### 3.1 React Native

| 指标域 | 指标 | 业界做法 | QuickApp Kit 采用结论 |
|---|---|---|---|
| 启动 | 冷启动、暖启动、首屏可交互 | 关注 JS bundle 加载、原生启动和首屏时间 | 采用冷/暖分组；用 `startup.total`，并分解 package、module、mount、present |
| 帧性能 | UI FPS、JS FPS、掉帧、长帧 | 分开观察原生 UI 线程和 JS 线程 | 采用“平台帧时间 + JS/Runtime 队列”两条线，不直接复制 FPS 定义 |
| 更新 | 事件到响应、JS 执行耗时 | 使用性能监视器和时间线定位 JS 阻塞 | 采用 `event.input.captured -> render.transaction.presented` |
| 内存 | 常驻、峰值、泄漏趋势 | 结合平台工具观察 JS 与 Native 内存 | 采用统一 `memoryBytes`，另记录 Node/Host object count |
| 包体 | JS bundle、资源和安装体积 | 观察 bundle 分包和资源体积 | 采用 RPK、Page IR、Shared Framework、assets 分项大小 |
| 调试开销 | 调试模式与发布模式差异 | 区分 DevTools/调试开销 | 采用 debug/release 与 Noop/Recording 分组 |

借鉴重点是把 UI 线程和 JS 线程分开观察；QuickApp Kit 不把“JS FPS”当成所有平台通用的唯一帧指标。

### 3.2 Flutter

| 指标域 | 指标 | 业界做法 | QuickApp Kit 采用结论 |
|---|---|---|---|
| 帧流水线 | UI thread、Raster thread、build/layout/paint、frame time | 通过 DevTools Timeline 和 frame chart 定位超预算帧 | 采用平台帧时间；Core 侧补充 render/layout/mount 阶段时间 |
| 启动 | 首帧、首帧栅格化、暖启动 | 区分 frame build 和 raster 完成 | 采用 present 作为跨平台可比终点；保留 platform present 分段 |
| 渲染 | 布局、绘制、光栅化、shader 编译 | 关注 shader jank 和首屏缓存 | 采用 Yoga/Measure/Layout/Mount；shader 只作为平台可选指标 |
| 滚动 | 滚动帧时间、掉帧、列表负载 | 用长列表和滚动时间线定位 jank | 采用滚动场景、可见项、frame p95/p99 和 mount churn |
| 内存 | Dart heap、Raster cache、Native heap | 按运行时子系统观察 | 不要求各平台暴露同名 heap；统一 bytes 和采样阶段 |
| 包体 | AOT、资源、压缩包大小 | 单独分析 release 包体 | 采用构建产物总量和成员级大小，不把安装包与 RPK 混称 |

借鉴重点是阶段化的 frame timeline。QuickApp Kit 的 `render`、`layout`、`mount` 和 `present` 应保持可拆分，避免只留下一个总耗时。

### 3.3 Lynx

| 指标域 | 指标 | 业界做法 | QuickApp Kit 采用结论 |
|---|---|---|---|
| 首屏 | 首屏渲染、首屏可交互、JS/native 初始化 | 关注跨 JS/native 边界的启动和首屏链路 | 采用完整链路 `package.open -> surface.create.presented` |
| 跨线程 | JS、UI/native、渲染任务耗时 | 通过线程时间线分析任务阻塞 | 采用 JS queue、Core owner、Platform present 分段 |
| 更新 | 状态更新、布局更新、渲染提交 | 关注增量更新而非只测初始化 | 采用 state、flush、render transaction、mount transaction 的关联 |
| 帧性能 | FPS、长帧、掉帧 | 结合场景和设备观察体验 | 采用 frame time 与掉帧率，保留设备和刷新率元数据 |
| 包体 | Framework、业务代码、资源、分包 | 关注公共运行时代码复用 | 采用 Shared Framework 单份校验和页面重复代码大小 |
| 列表 | 可见区域更新、复用、滚动负载 | 观察长列表和复用机制 | 采用 visible item、host object、mount operation 和 scroll p95 |

借鉴重点是把 JS、Core、Platform 的边界成本作为一等指标，这与 QuickApp Kit 的结构化 marker 最匹配。

### 3.4 小程序

这里的小程序以微信小程序等主流实现的公开性能实践为参照。

| 指标域 | 指标 | 业界做法 | QuickApp Kit 采用结论 |
|---|---|---|---|
| 启动 | 包下载、代码包加载、逻辑层启动、首屏 | 关注分包、预加载和首屏耗时 | 采用 RPK 打开、校验、Framework/App/Page 加载和首屏 present |
| 数据更新 | `setData` 调用次数、数据量、更新耗时 | 关注逻辑层到渲染层的数据传输 | 采用 logical payload bytes、transaction operations、state-to-presented |
| 页面 | 页面切换、返回、页面栈 | 关注页面栈和缓存造成的内存 | 采用 navigation push/back 延迟、surface live、销毁回落 |
| 资源 | 图片、网络、缓存和包体 | 关注资源大小、首屏请求和缓存命中 | 采用静态资源大小、加载结果和资源失败，不把网络能力混入基础 Runtime 基线 |
| 帧性能 | 滚动、动画、长任务 | 关注低端设备掉帧 | 采用小屏 LVGL 和移动端分别测量，不跨硬件直接排名 |
| 稳定性 | 启动失败、超时、内存超限 | 失败样本纳入质量指标 | 采用失败率、错误码、OOM、队列溢出和 teardown 结果 |

借鉴重点是测量“数据提交边界”与“页面生命周期”，同时保留跨平台 Runtime 的统一事件关联。

### 3.5 快应用 HAP

这里以快应用/HAP 生态常见的包体、启动、页面和设备性能关注点为参照。

| 指标域 | 指标 | 业界做法 | QuickApp Kit 采用结论 |
|---|---|---|---|
| 包体 | HAP/RPK 总大小、代码、资源、分包 | 包体直接影响安装和启动 | 采用 RPK 总大小、Page、Shared、IR、assets 分项大小 |
| 启动 | 安装后冷启动、再次启动、首屏 | 关注系统 Host 与应用 Runtime 的组合 | 采用 Host 启动和 Runtime 启动分界，禁止混成一个无法解释的数字 |
| 页面 | 首屏、页面跳转、返回、生命周期 | 关注页面栈和生命周期回收 | 采用 surface create/destroy、navigation push/present/fail |
| 组件 | 组件创建、布局、事件响应 | 关注组件数量和复杂页面表现 | 采用节点数、Host object 数、layout、mount operations 和 event latency |
| 设备 | 内存、CPU、电量、低端设备体验 | 结合真实设备评估 | 采用设备 profile、内存峰值、稳态和 teardown 回落；电量作为后续平台扩展 |
| 能力 | 网络、文件、媒体等 Feature 延迟和失败 | 关注平台能力调用结果 | 采用 typed capability latency、status 和 error rate，单独分组 |

借鉴重点是把包体、页面生命周期和真实设备作为一组完整验收对象；QuickApp Kit 保持 RPK 与 SDK 解耦。

### 3.6 QuickApp Kit 当前方案

| 一级指标域 | 二级指标 | 当前公共合同/项目状态 | 下一步采用结论 |
|---|---|---|---|
| 性能 | 构建耗时、加载、首屏、事件响应、状态更新、布局、渲染、Mount、滚动、导航、Feature 延迟 | Toolkit、Core、JS、Platform 已有部分公共 marker | 作为主性能报告，保留二级阶段用于定位 |
| 稳定性 | 启动成功率、运行失败率、Feature 失败/取消/不支持、OOM、队列溢出、崩溃、Teardown、资源残留 | Observation、错误和生命周期合同已有基础 | 失败样本进入报告，不能只统计成功样本 |
| 功耗 | 平均功耗、峰值功耗、滚动/播放/待机功耗、单位操作能耗 | 依赖 Android/iOS/嵌入式平台采集器 | 作为平台指标接入，不进入 Core |
| 内存 | 启动峰值、稳态内存、页面增量、列表增长、缓存占用、销毁回落、Node/Handler/Surface/Queue 数量 | 现有平台证据已有计数器 | 统一 bytes/count 单位，保存采样阶段 |
| 包体 | RPK 总大小、Framework、Page、IR、assets 大小、压缩率、SHA-256、构建耗时 | Toolkit 可生成 RPK，Benchmark 已有 Trace 合同消费 | 纳入 Scenario Catalog，记录构建身份和产物清单 |

## 四、QuickApp Kit 应采用的指标域

### 4.1 V1 指标表

业界项目的对照表保留细分指标，便于定位各框架的实现差异。QuickApp Kit 对外报告和 Benchmark 目录只使用五个一级指标域；二级指标可以继续细分，但不再提升为一级域。

| 一级指标域 | 二级指标 | 主要边界或来源 | V1 作用 |
|---|---|---|---|
| 性能 | 构建/加载耗时、首屏、事件响应、状态更新、布局、Render/Mount、滚动、导航、Feature 延迟、Noop/Recording 开销 | Toolkit、JS、Core、Platform 公共 marker；平台帧采集 | 建立运行效率和体验基线 |
| 稳定性 | 启动成功率、运行失败率、超时、Feature 状态、OOM、队列溢出、崩溃、Teardown 残留、失败恢复 | 错误合同、生命周期 marker、场景断言 | 形成质量门禁 |
| 功耗 | 平均/峰值功耗、滚动/播放/待机功耗、单位操作能耗 | Android/iOS/嵌入式平台采集器 | 评估真实设备续航成本 |
| 内存 | 启动峰值、稳态、页面增量、列表增长、缓存、销毁回落、Node/Handler/Surface/Queue | `memory.*`、`runtime.counter.*`、平台采样 | 发现泄漏和资源增长 |
| 包体 | RPK 总大小、Framework/Page/IR/assets 大小、压缩率、SHA-256、构建耗时 | Toolkit 产物清单和构建记录 | 进行包体与构建回归 |

### 4.2 指标分级

| 级别 | 内容 | 采集方式 |
|---|---|---|
| Required | 性能、稳定性、内存、包体 | 所有目标平台都应提供 |
| Platform | Frame、CPU、GPU、温度、电量、系统内存 | 由 Android/iOS/LVGL Adapter 按能力提供 |
| Diagnostic | 性能域的 Layout 分解、JS heap、Transport bytes、缓存命中、可见列表项 | diagnostic profile 按需开启 |
| Experimental | 功耗域的跨设备能耗模型、跨框架排名、复杂异常模型 | 不进入 V1 门禁 |

## 五、数据模型与运行流程

每次实验保存一个不可变 Raw Sample，至少包含：

```text
runId
scenarioId
targetId
profileId
artifactSha256
runtimeVersion
engineIdentity
compositionManifestSha256
device / OS / viewport / refreshRate
buildMode / observationLevel
warmup / iteration
ordered observations
platform samples
assertions
status / failureReason
```

运行顺序固定为：

```text
resolve artifact and environment
  -> validate scenario
  -> reset target
  -> optional warmup
  -> start collectors
  -> execute steps and assertions
  -> stop collectors
  -> persist raw sample
  -> validate and aggregate
  -> render report
```

失败样本保留原始事件和失败原因，不进入成功延迟分布，但必须计入失败率。不同设备、编译模式、刷新率、Observation level 和 JS Engine 不混合统计。

## 六、场景设计

| 场景 | 主要覆盖 | 目标 |
|---|---|---|
| `startup-001` | RPK open、Framework/App/Page load、首屏 present、teardown | 建立三端首屏基线 |
| `controls-001` | Button/Input/Switch/Slider、事件和状态更新 | 测量 input-to-presented 和增量事务 |
| `navigation-001` | push、params、back、重复进入、销毁 | 测量页面切换和资源回收 |
| `list-001` | 短列表、Scroll、重复更新 | 测量布局、mount 和滚动基础成本 |
| `long-list-001` | 20/50/100 条数据、分批 Mount、虚拟列表 | 识别嵌入式预算和列表扩展能力 |
| `feature-001` | prompt/fetch/file/media 请求 | 测量 Feature 延迟、失败和取消 |
| `teardown-001` | 重复启动、退出、晚到回调、资源清零 | 验证稳定性和泄漏回归 |
| `wearable-001` | 240x240、圆屏、触摸、卡片/列表 | 建立嵌入式真实设备基线 |

场景只引用公开 RPK 和 SDK API，不把 Core 私有 NodeId、内部队列或平台对象写进测试脚本。

## 七、实施顺序

1. 保持现有 BM-S02 作为 `contract` profile，并补一份稳定的公共指标读取说明。
2. 在 Benchmark 内增加 Scenario Catalog、Raw Sample Schema 和最小 Experiment Controller。
3. 先接 Simulator/LVGL，跑通 `startup-001`、`controls-001`、`navigation-001`、`teardown-001`。
4. 接入 Android 和 iOS Target Adapter，使用同一份 RPK、同一套场景和同一份 Raw Sample 格式。
5. 增加滚动、长列表、布局诊断和嵌入式设备采集。
6. 最后增加聚合、趋势和 CI 回归门禁；外部框架比较单独立项。

## 八、边界与风险

| 问题 | 处理原则 |
|---|---|
| Benchmark 影响 Runtime | TraceSink 非阻塞、有界、失败只使样本无效；Noop/Recording 必须等价 |
| Core 被 Benchmark 绑死 | Core 只保留 Clock、TraceSink、Counters 和公共合同，不依赖 CLI、JSON、文件或平台采集器 |
| 三端指标不可比 | 保存设备、OS、刷新率、Profile、Engine 和构建身份；不可校准的时钟只报告分段 |
| FPS 口径不一致 | 保存 frame time、刷新率和掉帧规则，FPS 只作为报告派生值 |
| 失败样本被忽略 | 原始失败样本保留，单独报告失败率和排除原因 |
| 指标无限膨胀 | Required、Platform、Diagnostic、Experimental 分级，新增指标先过公共合同 |
| 固件资源不足 | `embedded` profile 只编译固定容量 Collector 或关闭 Collector，报告由主机离线完成 |
| 外部框架比较失真 | V1 不做排名；满足同设备、同场景、同版本和同启动定义后再单独开展 |

## 九、参考资料

| 项目 | 官方资料入口 |
|---|---|
| React Native | https://reactnative.dev/docs/performance |
| Flutter | https://docs.flutter.dev/perf/ui-performance |
| Lynx | https://lynxjs.org/ |
| 微信小程序 | https://developers.weixin.qq.com/miniprogram/dev/framework/performance/ |
| 快应用/HAP | https://doc.quickapp.cn/ |

本报告只借鉴各项目公开的性能观测维度和工具思路；QuickApp Kit 的实际指标边界以公共 Observation Contract 为准。
