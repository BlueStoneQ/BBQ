# RN 性能优化（分层体系）

> 本质：在哪个阶段、把什么工作量、从哪里移到哪里（或消除）。
> 分四层：React 层 → RN 框架层 → Native 层 → 工程化层。

---

## 目录

- [一、React 层优化](#一react-层优化)
- [二、RN 框架层优化](#二rn-框架层优化)
- [三、Android/iOS Native 层优化](#三androidios-native-层优化)
- [四、工程化层优化](#四工程化层优化)
- [五、场景题实战](#五场景题实战)

---

## 一、React 层优化

**本质**：减少不必要的重渲染（JS 线程少干活 → 帧预算不超 16ms）。

| 问题 | 原因 | 手段 |
|------|------|------|
| 组件频繁重渲染 | 父组件 state 变了，子组件跟着重渲染 | `React.memo` 包裹子组件 |
| 每次渲染创建新对象/函数 | 引用变了 → memo 失效 | `useMemo` 缓存对象，`useCallback` 缓存函数 |
| 状态放太高 | 顶层 state 变了，整棵树重渲染 | 状态下沉（放到需要的组件里）/ Zustand selector |
| 列表 item 全部重渲染 | key 不稳定 / renderItem 没 memo | 稳定 keyExtractor + memo item 组件 |
| 大量计算在 render 里 | 每次渲染都重新算 | `useMemo` 缓存计算结果 |

**核心原则**：只有真正变了的组件才重渲染。用 React DevTools 的"Highlight updates"检查哪些组件在不必要地重渲染。

### React 层核心 API 详解

**结论**：useMemo 缓存父组件props.值 + useCallback 缓存父组件props.函数 + React.memo(包裹子组件) 拦截重渲染。三者配合，避免子组件无意义重渲染。

**例子**：设备列表 100 个 item，父组件 state 变了（搜索框输入），不优化 → 100 个 DeviceCard 全部重渲染 → 卡。加了这套 → 只有真正变了的 item 重渲染 → 流畅。

**本质**：React 每次渲染都重新执行函数组件 → 里面的变量/函数都是新创建的 → 传给子组件的 props 引用变了 → 子组件跟着重渲染。useMemo/useCallback 就是"让引用不变"，React.memo 就是"引用没变就不重渲染"。

```typescript
// 父组件
function DeviceList() {
  const [search, setSearch] = useState('');
  
  // useCallback：缓存函数引用，search 变了列表重渲染时 handlePress 不变
  const handlePress = useCallback((id) => navigate('Detail', { id }), []);
  
  // useMemo：缓存过滤结果，只有 devices/search 变了才重算
  const filtered = useMemo(() => devices.filter(d => d.name.includes(search)), [devices, search]);

  return filtered.map(d => <DeviceCard key={d.id} device={d} onPress={handlePress} />);
}

// 子组件：React.memo 缓存拦截，props 没变就不重渲染, 直接命中缓存
const DeviceCard = React.memo(({ device, onPress }) => (
  <Pressable onPress={() => onPress(device.id)}><Text>{device.name}</Text></Pressable>
));
```

**其他 React 层优化手段**：

| 手段 | 本质 | 场景 |
|------|------|------|
| 状态下沉 | state 放到真正需要的组件里 | 避免顶层变了整棵树重渲染 |
| Zustand selector | `useStore(s => s.count)` 只订阅 count | 其他字段变了不触发 |
| `React.lazy` + `Suspense` | 组件懒加载 | 非首屏延迟加载 |
| key 稳定 | 用唯一 ID 不用 index | 避免 item 销毁重建 |
| 避免 render 里创建对象 | `style={{flex:1}}` 每次新对象 | 用 StyleSheet.create |
| children 模式 | 不变的部分作为 children | children 不受父 state 影响 |

---

## 二、RN 框架层优化

**本质**：减少 JS ↔ Native 跨线程通信开销 + 把性能敏感逻辑下沉到 UI 线程。

| 问题 | 原因 | 手段 |
|------|------|------|
| 动画卡顿 | 动画逻辑在 JS 线程，和业务抢帧预算 | Reanimated worklet（动画在 UI 线程执行） |
| 手势不跟手 | 手势事件走 JS 线程处理 | Gesture Handler（Native 层识别手势） |
| 列表白屏/卡顿 | FlatList 销毁重建 View | FlashList（View 复用，类似 RecyclerView） |
| Bridge 阻塞（旧架构） | 高频通信序列化排队 | 迁移 TurboModule（JSI 直调，无序列化） |
| 首屏渲染慢 | 首屏组件树太大 | `InteractionManager.runAfterInteractions` 延迟非首屏 |
| 图片闪烁/重复下载 | Image 组件无缓存 | FastImage（原生缓存） |

### 详解：手势不跟手 → Gesture Handler + Reanimated

> ⚠️ TODO：需要进一步理解，后续深入

**本质问题**：手势事件从 UI Thread 产生，默认要传到 JS Thread 处理再传回来 → 每帧跨两次线程 → 延迟 → 不跟手。

**Gesture Handler 做了什么**：把"手势识别"从 JS 线程移到 Native UI 线程。Native 层直接识别手势类型（Pan/Tap/LongPress），识别完才通知 JS 结果。JS 不参与每帧的原始触摸事件处理。

**配合 Reanimated 的完整链路**：

```
不优化：触摸 → JS 识别手势 → JS 算动画值 → 跨线程 → UI 更新（每帧两次跨线程）
优化后：触摸 → Native 识别手势（UI Thread）→ worklet 算动画值（UI Thread）→ 直接更新 View
        全程 UI Thread，零跨线程 → 完美跟手
```

**手势冲突**：ScrollView 里嵌套可拖拽元素 → Native 层声明式配置（simultaneousHandlers/waitFor/方向区分），不需要 JS 判断。

**一句话**：手势识别 + 动画计算都搬到 UI 线程，触摸→响应链路不跨线程 → 零延迟。

**代码对比**：

```typescript
// ❌ 优化前：PanResponder（每帧触摸事件都传到 JS 线程处理 → 卡）
const pan = useRef(new Animated.ValueXY()).current;
const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: () => true,
  // 每帧都在 JS 线程算新位置 → JS 忙了就掉帧
  onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }]),
  onPanResponderRelease: () => pan.flattenOffset(),
});
<Animated.View {...panResponder.panHandlers} style={pan.getLayout()} />
```

```typescript
// ✅ 优化后：Gesture Handler + Reanimated（全程 UI 线程 → 流畅）
const offset = useSharedValue({ x: 0, y: 0 });

// 手势识别在 Native 层，不过 JS
const gesture = Gesture.Pan().onUpdate((e) => {
  'worklet'; // 标记：这段代码在 UI 线程执行，不在 JS 线程
  offset.value = { x: e.translationX, y: e.translationY };
});

// 动画值变化直接驱动 View 属性，不过 JS
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }],
}));

<GestureDetector gesture={gesture}>
  <Animated.View style={animatedStyle} />
</GestureDetector>
```

**区别**：前者每帧在 JS 线程执行 `onPanResponderMove`；后者 `'worklet'` 标记的函数在 UI 线程执行，JS 线程完全不参与。

**RN 的线程模型和浏览器不同**：

浏览器：JS + 渲染在同一个主线程（互相阻塞）。
RN：JS Thread 和 UI Thread 是**分开的两个线程**，通过 Fabric 通信。

```
JS Thread（Hermes）→ JSI → C++ Fabric（算布局）→ JNI → UI Thread（画界面）
```

Reanimated worklet 的本质：在 UI 线程上开一个独立的轻量 JS 运行时，动画计算直接在 UI 线程跑，完全不经过 JS Thread。JS Thread 卡死了动画照样流畅。

**核心原则**：性能敏感的逻辑从 JS 线程下沉到 UI 线程或 Native 层。

---

## 三、Android/iOS Native 层优化
**本质**：减少 Native 层的启动开销、内存占用、渲染负担。

| 问题 | 原因 | 手段 |
|------|------|------|
| 启动慢（Native 初始化） | 全量注册 Native Module | TurboModule 懒加载 |
| 启动慢（page fault） | DEX 中热代码分散 | DEX 布局优化（热代码前置） |
| 包体大 | 多架构 .so / 未裁剪模块 | abiFilters + 模块裁剪 + R8 |
| 内存高 | 大图未压缩 / 页面未释放 | FastImage resize + 导航栈控制 + 容器回收 |
| ANR | 主线程做了耗时操作 | IO/网络移到子线程 |
| Native Crash | 空指针 / OOM | LeakCanary + Sentry + 防御性编码 |
| RN 容器创建慢 | 每次跳转都新建实例 | 实例池化（预热 + 复用） |

**核心原则**：启动路径最小化 + 内存可控 + 主线程不做重活。

---

## 四、工程化层优化

**本质**：构建时减少产物体积 + 运行时按需加载。

| 问题 | 原因 | 手段 |
|------|------|------|
| Bundle 太大 | 所有代码打成一个文件 | 分 Bundle（Common + Business） |
| Bundle 含无用代码 | 未使用的模块也打入 | Tree Shaking + 条件编译 |
| JS 解析慢 | 运行时解析 JS 源码 | Hermes AOT（预编译为 .hbc） |
| 资源未压缩 | 图片/字体原始大小 | 图片压缩 + WebP + 字体子集化 |
| 热更新包大 | 全量下发 | 差量更新（bsdiff） |
| 首屏加载全部模块 | 不管用不用都加载 | 按路由懒加载 Bundle + 预加载策略 |

**核心原则**：构建时能删的删，运行时能延迟的延迟。

---

## 五、场景题实战

### 场景 A："用户反馈 App 启动慢，你怎么排查？"

```
1. 测量：adb shell am start -W 看 TotalTime，分段打点（Native init → Bundle load → JS exec → 首屏渲染）
2. 定位：哪个阶段最慢？
   - Native init 慢 → TurboModule 懒加载 + SDK 延迟初始化
   - Bundle load 慢 → 分 Bundle + Hermes AOT
   - JS exec 慢 → 首屏最小化 + 减少顶层 import
   - 首屏渲染慢 → 简化首屏 UI + 骨架屏
3. 验证：优化后对比数据
```

### 场景 B："列表滑动卡顿，怎么解决？"

```
1. 测量：Performance Monitor 看 JS/UI 帧率
2. 定位：
   - JS 帧率低 → renderItem 重渲染（React DevTools 检查）→ memo + useCallback
   - UI 帧率低 → View 层级深 / 图片大 → 简化 item + FastImage
   - 两个都低 → 换 FlashList（View 复用）
3. 配置：getItemLayout / estimatedItemSize / windowSize 调优
4. 验证：优化后帧率稳定 60fps
```

### 场景 C："App 用一段时间后越来越卡"

```
1. 测量：Android Profiler 看内存趋势（持续增长 = 泄漏）
2. 定位：
   - JS 层：useEffect 未 cleanup（订阅/定时器）
   - 图片：大图未释放（FastImage 缓存策略）
   - 导航：页面栈无限堆积（unmountOnBlur / reset）
   - Native：BLE 连接未断开 / 对象未释放
3. 工具：LeakCanary（Java 泄漏）+ Hermes 内存统计
4. 验证：长时间使用后内存稳定不增长
```

### 场景 D："BLE 数据上报延迟高"

```
1. 定位：延迟在哪一层？
   - 硬件层：信号弱 / 连接参数不合理 → requestConnectionPriority
   - 通信层：旧 Bridge 序列化排队 → 迁移 TurboModule（JSI 直调）
   - JS 层：事件处理慢 → 事件节流 / 批量更新 UI
2. 优化：TurboModule + 事件节流 + 只更新变化的 item（不刷新整个列表）
3. 验证：端到端延迟 < 100ms
```

---

## 六、方法论总结

```
任何性能问题的排查步骤：
1. 测量（用工具量化，不靠感觉）
2. 分层定位（React / RN 框架 / Native / 工程化，哪一层的问题？）
3. 针对性优化（一次只改一个变量）
4. 数据验证（优化前后对比）
5. 持续监控（上线后不退化）
```
