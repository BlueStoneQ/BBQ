jia# RN 性能优化（六维度 × 四层）

> 6 个体验维度：应用启动 / 页面启动 / 列表流畅 / 动画流畅 / 内存稳定 / 包体大小
> 每个维度从四层优化：React 层 / RN 框架层 / Native 层 / 工程化层

---

## 目录

- [一、应用启动](#一应用启动)
- [二、页面启动](#二页面启动)
- [三、列表流畅](#三列表流畅)
- [四、动画流畅](#四动画流畅)
- [五、内存稳定](#五内存稳定)
- [六、包体大小](#六包体大小)

---

## 一、应用启动

> 冷启动到首屏可交互

| 层 | 手段 | 优先级 | 效果 |
|----|------|--------|------|
| Native | TurboModule 懒加载（用到才创建） | P0 | 减少启动注册开销 |
| Native | 容器预热（提前创建 ReactInstance） | P0 | 首屏秒开 |
| Native | DEX 布局优化（热代码前置） | P1 | 减少 page fault，PSS 降低 |
| Native | SDK 延迟初始化（非首屏 SDK 后加载） | P1 | 启动路径最小化 |
| 工程化 | 分 Bundle（首屏只加载 Common + 当前页） | P0 | Bundle 加载时间减半 |
| 工程化 | Hermes AOT（.hbc 预编译） | P0 | 跳过 JS 解析编译 |
| React | 首屏最小化（延迟非首屏组件） | P1 | JS 执行时间减少 |
| React | 减少顶层 import（Tree Shaking） | P2 | 减少首屏 JS 执行量 |

---

## 二、页面启动

> 页面跳转到可交互

| 层 | 手段 | 优先级 | 效果 |
|----|------|--------|------|
| 工程化 | Bundle 按需加载（路由触发加载） | P0 | 不预加载不需要的模块 |
| 工程化 | Bundle 预加载（空闲时预热高频页面） | P1 | 跳转时已加载好，秒开 |
| Native | 实例池化（ReactInstance 复用） | P0 | 避免每次跳转创建新实例 |
| React | 骨架屏（先展示占位 UI） | P1 | 感知快（有东西看） |
| React | 数据预加载（路由跳转前发请求） | P1 | 到达页面时数据已就绪 |
| RN 框架 | InteractionManager（动画结束后再渲染重内容） | P2 | 转场动画不卡 |

---

## 三、列表流畅

> 滚动不掉帧（60fps）

| 层 | 手段 | 优先级 | 效果 |
|----|------|--------|------|
| RN 框架 | FlashList 替代 FlatList（View 复用） | P0 | 快 5-10x，无白屏 |
| React | React.memo + useCallback（减少 item 重渲染） | P0 | 只有变了的 item 重渲染 |
| React | 稳定 keyExtractor（用 ID 不用 index） | P1 | 避免 item 销毁重建 |
| RN 框架 | getItemLayout / estimatedItemSize（跳过测量） | P1 | 减少布局计算 |
| RN 框架 | removeClippedSubviews（移除屏幕外 View） | P2 | 减少内存和绘制 |
| Native | FastImage（原生图片缓存） | P1 | 图片不闪烁不重复下载 |

---

## 四、动画流畅

> 手势跟手、转场不卡

| 层 | 手段 | 优先级 | 效果 |
|----|------|--------|------|
| RN 框架 | Reanimated worklet（动画在 UI 线程执行） | P0 | JS 忙了动画也不卡 |
| RN 框架 | Gesture Handler（Native 层识别手势） | P0 | 手势不过 JS 线程 |
| React | 避免动画期间触发重渲染 | P1 | 不和动画抢 JS 帧预算 |
| RN 框架 | useNativeDriver（旧 Animated API 的 Native 驱动） | P2 | 部分动画可下沉 |

---

## 五、内存稳定

> 不泄漏、不 OOM、后台不被杀

| 层 | 手段 | 优先级 | 效果 |
|----|------|--------|------|
| React | useEffect cleanup（清理订阅/定时器） | P0 | 页面离开不泄漏 |
| React | 导航栈控制（unmountOnBlur / reset） | P1 | 页面不无限堆积 |
| Native | FastImage resize（大图压缩后渲染） | P1 | 图片不爆内存 |
| Native | 实例池回收（onTrimMemory 释放非当前实例） | P1 | 内存压力时主动释放 |
| Native | LeakCanary 检测（Java 层泄漏） | P2 | 开发阶段发现泄漏 |
| RN 框架 | Hermes 内存统计（JS 堆监控） | P2 | 定位 JS 层泄漏 |

---

## 六、包体大小

> 下载快、安装快、占用空间小

| 层 | 手段 | 优先级 | 效果 |
|----|------|--------|------|
| 工程化 | 分 Bundle（不打全量，按需加载） | P0 | APK 内只带 Common + 首屏 |
| 工程化 | Hermes AOT（.hbc 比 .js 紧凑） | P1 | Bundle 体积减小 |
| 工程化 | Tree Shaking + 条件编译（移除无用代码） | P1 | JS 层裁剪 |
| Native | R8 + shrinkResources（移除无用 Java 代码和资源） | P0 | DEX + 资源裁剪 |
| Native | abiFilters（只保留 arm64） | P0 | .so 体积减半 |
| Native | 模块裁剪（反射解耦，不需要的模块不打入） | P1 | 整块模块移除 |
| 工程化 | 图片压缩 + WebP | P2 | 资源体积减小 |
