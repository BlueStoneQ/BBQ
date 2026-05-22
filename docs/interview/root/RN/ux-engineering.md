# 性能体验升级治理专项

> 专项目标：从"能用"到"好用"，推动设计到软件工程的体验升级
> 标杆：众安 App 级体验——每个交互有反馈、每个等待有过渡、每个切换都丝滑
> 定位：入职后推动的第一个专项，不是修 bug，是建体系

---

## 目录

- [一、体验差距分析](#一体验差距分析)
- [二、体验升级四层模型](#二体验升级四层模型)
- [三、感知速度：让用户觉得快](#三感知速度让用户觉得快)
- [四、交互反馈：每个操作都有响应](#四交互反馈每个操作都有响应)
- [五、视觉稳定：不跳不闪不抖](#五视觉稳定不跳不闪不抖)
- [六、流畅度：60fps 无掉帧](#六流畅度60fps-无掉帧)
- [七、体验组件体系](#七体验组件体系)
- [八、体验规范与度量](#八体验规范与度量)
- [九、落地路径](#九落地路径)

---

## 一、体验差距分析

### 现状（Root App 观察）

| 问题 | 用户感知 |
|------|---------|
| 首屏多个 loading 闪烁 | 混乱，不知道在等什么 |
| Splash 后还有 loading + 抖动 | 启动慢，不稳定 |
| Tab 切换布局跳动 | 不专业，粗糙 |
| 图片加载慢无占位 | 白块闪烁 |
| 操作无即时反馈 | 不确定按没按到 |
| 滑动/切换不够流畅 | 卡顿感 |

### 目标（众安级体验）

| 维度 | 标准 |
|------|------|
| 感知速度 | 用户觉得"秒开"（不一定真快，但感知快） |
| 交互反馈 | 每个触摸/操作都有即时视觉响应（< 100ms） |
| 视觉稳定 | 页面加载过程中零布局跳动（CLS = 0） |
| 流畅度 | 滑动/转场/动画稳定 60fps |
| 错误处理 | 任何异常都有优雅降级，不白屏 |
| 一致性 | 全 App 统一的交互模式和视觉语言 |

---

## 二、体验升级四层模型

```
┌─────────────────────────────────────────┐
│  第四层：流畅度（技术底层）               │
│  60fps / memo / FlashList / Reanimated  │
├─────────────────────────────────────────┤
│  第三层：视觉稳定（布局工程）            │
│  固定尺寸 / 骨架屏 / 预渲染 / 占位      │
├─────────────────────────────────────────┤
│  第二层：交互反馈（状态设计）            │
│  按下态 / loading / 成功 / 失败 / 空态  │
├─────────────────────────────────────────┤
│  第一层：感知速度（心理学）              │
│  骨架屏 / 渐进式 / 乐观更新 / 预加载    │
└─────────────────────────────────────────┘

从下往上建：先保证流畅 → 再保证不跳 → 再加反馈 → 最后优化感知
```

**核心认知**：体验不只是"快"，是"让用户觉得快、觉得稳、觉得有控制感"。

---

## 三、感知速度：让用户觉得快

> 本质：人对速度的感知不是客观时间，而是"等待时有没有东西在动"。

### 3.1 骨架屏（Skeleton）

**原理**：页面结构先出来（灰色块 + Shimmer 闪光动画），数据填充后原地替换。用户看到"有东西在动"→ 感知等待时间短。

**RN 骨架屏方案**：

| 方案 | 实现 | 适合 |
|------|------|------|
| 三方库 `react-native-skeleton-placeholder` | LinearGradient + Reanimated Shimmer | 快速落地 |
| 自建（Reanimated opacity 呼吸） | 灰色 View + opacity 动画 | 有 Design System 时 |

```typescript
// 方案 1：三方库（Shimmer 闪光效果）
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

function DeviceCardSkeleton() {
  return (
    <SkeletonPlaceholder borderRadius={8}>
      <SkeletonPlaceholder.Item flexDirection="row" alignItems="center" padding={12}>
        <SkeletonPlaceholder.Item width={56} height={56} borderRadius={8} />
        <SkeletonPlaceholder.Item marginLeft={12}>
          <SkeletonPlaceholder.Item width={120} height={16} />
          <SkeletonPlaceholder.Item width={80} height={12} marginTop={8} />
        </SkeletonPlaceholder.Item>
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder>
  );
}

// 方案 2：自建（opacity 呼吸动画，更轻量）
function SkeletonBlock({ width, height, borderRadius = 4 }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#E0E0E0' }, style]} />;
}
```

**使用模式**：

```typescript
function DeviceListScreen() {
  const { data, isLoading } = useDevices();
  if (isLoading) return <>{[1,2,3,4,5].map(i => <DeviceCardSkeleton key={i} />)}</>;
  return <FlashList data={data} renderItem={...} />;
}
```

**规范**：
- 骨架屏布局 = 真实内容布局（高度/间距一致）→ 数据填充无跳动
- 用 Shimmer/呼吸动画 → 用户知道"在加载"（不是卡了）
- Splash → 骨架屏 → 内容，三段式无缝衔接

### 3.2 渐进式图片加载

```
阶段 1：显示本地 placeholder（纯色/模糊缩略图）→ 0ms
阶段 2：加载低质量缩略图（10KB）→ 200ms
阶段 3：加载高清原图 → 1-3s
```

用户感知：图片"秒出"（虽然高清还在加载）。

### 3.3 乐观更新（Optimistic Update）

**原理**：用户操作后，UI 立即更新（不等服务端响应），失败了再回滚。

```typescript
// 场景：用户切换吸奶器档位
function changeMode(newMode) {
  // 1. UI 立即更新（乐观）
  setMode(newMode);
  // 2. 发送 BLE 指令
  bleService.sendCommand({ mode: newMode }).catch(() => {
    // 3. 失败回滚 + 提示
    setMode(previousMode);
    toast.error('指令发送失败');
  });
}
```

**适用场景**：控制指令（调档位/开关）、收藏/取消、设置修改。
**不适用**：需要服务端确认的操作（支付/配网）。

### 3.4 预加载

```typescript
// 在设备列表页，预加载设备详情页的数据
function DeviceListItem({ device }) {
  const prefetch = usePrefetch();
  
  return (
    <Pressable
      onPress={() => navigate('DeviceDetail', { id: device.id })}
      // 手指按下时就开始预加载（不等松手）
      onPressIn={() => prefetch.deviceDetail(device.id)}
    >
      ...
    </Pressable>
  );
}
```

---

## 四、交互反馈：每个操作都有响应

> 本质：用户的每个动作都需要在 100ms 内得到视觉反馈，否则感觉"没反应"。

### 4.1 按钮状态机

> **按下态（4.2）和状态机的关系**：按下态是状态机的第一步（pressed），状态机是完整的异步操作生命周期。
> - **触摸反馈（pressed）**：只管"按下那一瞬间"的视觉响应 → 适用于**所有可点击元素**（卡片/列表项/图标）
> - **按钮状态机**：管"按下 → 等待 → 结果"全过程 → 适用于**有异步操作的按钮**（连接/提交/发送）
> - 例：设备卡片 → 只需按下态；"连接设备"按钮 → 需要完整状态机

每个有异步操作的按钮都有完整的状态：

```
idle → pressed → loading → success/error → idle

idle：默认态
pressed：按下态（缩放/变暗，< 50ms 响应）
loading：等待态（loading 指示器，按钮 disabled）
success：成功态（✓ 动画，1s 后恢复）
error：失败态（shake 动画 + 错误提示）
```

```typescript
// 统一按钮组件：内置状态机
<ActionButton
  onPress={handleConnect}
  loadingText="连接中..."
  successText="已连接"
  errorText="连接失败"
/>
```

### 4.2 触摸反馈（按下态）

**问题**：没有按下反馈 = "搓玻璃板"，用户不知道按没按到。

**实现方式**：用 RN 内置的 `Pressable` 组件（不是事件，是组件），它提供 `pressed` 状态：

```typescript
import { Pressable } from 'react-native';

// Pressable 的 style 接收函数，参数里有 pressed 布尔值
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    styles.card,
    pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }
  ]}
>
  <Text>设备名称</Text>
</Pressable>
```

**RN 可点击组件对比**：

| 组件 | 按下效果 | 推荐度 |
|------|---------|--------|
| `Pressable` | **完全自定义**（style 函数拿到 pressed） | ✅ 2026 标准 |
| `TouchableOpacity` | 固定效果：按下变透明 | 旧 API，能用但不灵活 |
| `TouchableHighlight` | 固定效果：按下加底色 | 旧 API |
| `TouchableWithoutFeedback` | 无反馈 | ❌ 就是"搓玻璃板" |

**实际做法：封装统一可点击组件**

```typescript
// 全局通用 PressableCard，所有卡片/列表项都用它
function PressableCard({ onPress, children, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 8, backgroundColor: '#fff' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
```

**更高级：Reanimated 弹性按下（更有质感）**

```typescript
// 按下弹性缩小，松手弹性回弹（物理弹簧效果，比瞬间变化更丝滑）
const scale = useSharedValue(1);

const gesture = Gesture.Tap()
  .onBegin(() => { 'worklet'; scale.value = withSpring(0.95); })
  .onFinalize(() => { 'worklet'; scale.value = withSpring(1); });

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));

<GestureDetector gesture={gesture}>
  <Animated.View style={[styles.card, animatedStyle]}>
    {children}
  </Animated.View>
</GestureDetector>
```

**规范**：
- 全 App 统一用 `Pressable`，废弃 `Touchable*` 系列
- 按下态响应 < 50ms（Pressable 原生支持，无延迟）
- 效果：缩放 0.95-0.97 + 透明度 0.7（轻微，不夸张）
- 重要操作加震动反馈：`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`

### 4.3 BLE 操作反馈

| 操作 | 反馈 |
|------|------|
| 连接设备 | 按钮 loading + 进度提示 + 连接动画 |
| 发送指令 | 乐观更新 + 失败 shake |
| 断连 | 状态栏提示 + 自动重连指示 |
| 配网 | 分步进度条（扫描→连接→传密码→验证） |

### 4.4 空状态与错误状态

```typescript
// 每个列表/页面都有空态和错误态
function DeviceList() {
  const { data, isLoading, error } = useDevices();
  
  if (isLoading) return <SkeletonList />;
  if (error) return <ErrorState onRetry={refetch} message="加载失败" />;
  if (data.length === 0) return <EmptyState icon="device" message="还没有设备" action="添加设备" />;
  return <List data={data} />;
}
```

---

## 五、视觉稳定：不跳不闪不抖

> 本质：页面加载过程中，已渲染的内容不应该发生位移。（Web 里叫 CLS = 0）

### 5.1 从设计源头规范（根本解决）

> 抖动问题的根本解决不是代码层面打补丁，而是从设计规范源头就约束住。
> 把问题消灭在设计阶段，而不是开发阶段补救。

**设计规范要求**：

| 设计稿必须标注 | 为什么 | 开发怎么落地 |
|---------------|--------|-------------|
| 图片宽高比 | 开发不用猜尺寸 | `aspectRatio: 16/9` |
| 卡片/列表项固定高度 | 数据填充不改变布局 | `height: 80` / `minHeight` |
| 每个页面的骨架屏设计 | 骨架屏布局和真实内容一致 | 按设计稿写骨架组件 |
| 四态设计（loading/content/empty/error） | 不是只画"有数据"的状态 | 每个状态都有对应 UI |
| 文字最大行数 | 不会因为文字长度撑开布局 | `numberOfLines` + ellipsis |
| 动态内容的容器尺寸 | 内容变化不影响外部布局 | 容器固定，内容自适应 |

**推动方式**：

```
1. 输出《组件状态设计规范》→ 和设计对齐
2. 设计评审加检查项：
   □ 图片有标注比例？
   □ 有骨架屏设计？
   □ 有 loading/empty/error 态？
   □ 卡片有标注高度？
3. 开发侧：设计没出四态 → 不开发（倒逼设计补全）
4. Code Review：没有骨架屏/没有固定尺寸 → 不合入
```

**一句话**：视觉稳定不是开发的事，是设计 + 开发协同的事。设计确定了尺寸和状态，开发就不会出现"数据来了布局变了"。

### 5.2 防抖动技术方案（按灵活度排序）

> 本质不是"写死尺寸"，而是"数据到来之前，布局空间已经预留好"。

| 方案 | 原理 | 灵活度 | 适用场景 |
|------|------|--------|---------|
| **aspectRatio** | 只定宽度，高度按比例自动算 | 高 | 图片/视频/卡片 |
| **骨架屏占位** | 数据没来时用相同布局的灰色块占位 | 高 | 所有异步内容 |
| **服务端返回尺寸** | 接口返回图片宽高，渲染前就知道 | 高 | 图片列表 |
| **minHeight** | 不写死高度，但保证最小高度 | 中 | 文字内容不确定长度 |
| **容器固定 + 内容自适应** | 外层固定高度，内容 overflow hidden | 中 | 卡片 |
| **动画过渡** | 高度变化时用动画（不是瞬间跳） | 高 | 展开/收起 |
| **固定宽高** | 写死像素 | 低 | 头像/图标/缩略图 |

```typescript
// 1. aspectRatio（最常用，图片场景）
// 不写死高度，只定宽度 + 比例 → 高度自动算 → 图片加载前后不跳
<View style={{ width: '100%', aspectRatio: 16 / 9 }}>
  <FastImage source={{ uri }} style={{ flex: 1 }} />
</View>

// 2. 服务端返回尺寸（图片列表最佳实践）
// 接口返回 { url, width, height }，渲染前就知道高度
<FastImage
  source={{ uri: item.url }}
  style={{ width: screenWidth, height: screenWidth * (item.height / item.width) }}
/>

// 3. 动画过渡（高度确实要变的场景：展开/收起）
import { LayoutAnimation } from 'react-native';
function toggleExpand() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpanded(!expanded);
}
// 高度变化有动画 → 用户感知是"展开"不是"跳动"

// 4. minHeight（文字内容不确定长度）
<View style={{ minHeight: 60 }}>
  <Text>{description}</Text>
</View>
```

**防抖动本质总结**：
1. 数据到来之前，布局空间已预留（骨架屏 / aspectRatio / 服务端尺寸）
2. 如果高度确实要变，用动画过渡而不是瞬间跳（LayoutAnimation）
3. 图片永远有容器包裹（aspectRatio 或固定尺寸），不让图片撑开布局

### 5.2 图片固定尺寸

```typescript
// ❌ 图片加载完才知道尺寸 → 撑开布局 → 跳动
<FastImage source={{ uri }} style={{ width: '100%' }} />

// ✅ 固定宽高 → 加载前后布局不变
<FastImage source={{ uri }} style={{ width: 100, height: 100 }} />

// ✅ 固定宽高比（知道比例但不知道具体尺寸）
<View style={{ aspectRatio: 16/9, width: '100%' }}>
  <FastImage source={{ uri }} style={{ flex: 1 }} />
</View>
```

### 5.3 列表预设高度

```typescript
// FlashList：预设 item 高度，避免渲染时跳动
<FlashList
  data={devices}
  estimatedItemSize={80}  // 预估高度
  renderItem={...}
/>

// FlatList：精确高度（如果 item 高度固定）
<FlatList
  data={devices}
  getItemLayout={(data, index) => ({
    length: 80, offset: 80 * index, index
  })}
/>
```

### 5.4 条件渲染不跳动

```typescript
// ❌ 条件渲染：元素突然出现 → 下方内容被推开
{device && <DeviceInfo device={device} />}

// ✅ 始终占位：没数据时显示骨架（高度一致）
<DeviceInfo device={device} isLoading={!device} />

// ✅ 或者用固定高度容器包裹
<View style={{ height: 120 }}>
  {device ? <DeviceInfo device={device} /> : <DeviceInfoSkeleton />}
</View>
```

### 5.5 Tab 预渲染

```typescript
// ❌ 懒加载：切换时才渲染 → 从无到有 → 跳动
<Tab.Navigator>
  <Tab.Screen name="Devices" component={DeviceList} />
</Tab.Navigator>

// ✅ 预渲染相邻 Tab（或用骨架屏过渡）
<Tab.Navigator
  screenOptions={{ lazy: false }}  // 所有 Tab 预渲染
  // 或者：
  // lazy={true} + lazyPlaceholder={() => <SkeletonPage />}
>
```

### 5.6 统一初始化编排

```typescript
// ❌ 多个异步各自为政 → 多个 loading 闪烁
useEffect(() => { bleInit() }, []);
useEffect(() => { fetchUser() }, []);
useEffect(() => { fetchDevices() }, []);

// ✅ 统一编排 → 一次性就绪
function useAppInit() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([bleInit(), fetchUser(), fetchDevices()])
      .then(() => setReady(true));
  }, []);
  return ready;
}
```

---

## 六、流畅度：60fps 无掉帧

> 本质：每帧 16ms 内完成所有工作（JS 计算 + 渲染）。

| 手段 | 做什么 | 解决什么 |
|------|--------|---------|
| React.memo + useCallback | 控制重渲染 | 子组件不必要重渲染 |
| FlashList | View 复用 | 列表滚动卡顿 |
| Reanimated worklet | 动画在 UI 线程 | 动画掉帧 |
| native-stack | 原生页面转场 | 切换卡顿 |
| InteractionManager | 延迟非关键任务 | 转场时不抢帧 |
| Zustand selector | 精准订阅 | 全局状态变化不触发无关组件 |

详见 [performance-layers.md](./performance-layers.md)。

---

## 七、体验组件体系

### 统一组件库（Design System）

```
基础层：
  <Button />          — 内置 pressed/loading/success/error 状态机
  <Pressable />       — 统一按下态（scale + opacity）
  <Image />           — 封装 FastImage + placeholder + 固定尺寸

加载态：
  <Skeleton />        — 骨架屏（Shimmer 动画）
  <SkeletonList />    — 列表骨架
  <LoadingOverlay />  — 全屏 loading（配网/连接）
  <InlineLoading />   — 行内 loading（按钮/列表底部）

状态态：
  <EmptyState />      — 空状态（图标 + 文案 + 操作按钮）
  <ErrorState />      — 错误状态（重试按钮）
  <OfflineState />    — 离线状态

反馈：
  <Toast />           — 轻提示（成功/失败/警告）
  <ActionSheet />     — 底部操作面板
  <ProgressBar />     — 进度条（配网/固件升级）
```

### 组件规范

| 规范 | 要求 |
|------|------|
| 每个异步操作 | 必须有 loading + error + empty 三态 |
| 每个图片 | 必须有固定宽高 + placeholder |
| 每个可点击元素 | 必须有 pressed 态 |
| 每个列表 | 必须有 estimatedItemSize + 骨架屏 |
| 每个页面 | 必须有 ErrorBoundary 兜底 |

---

## 八、体验规范与度量

### 体验指标

| 指标 | 目标 | 度量方式 |
|------|------|---------|
| 首屏时间（FCP） | < 1.5s | 自定义打点 |
| 可交互时间（TTI） | < 2s | 自定义打点 |
| 布局稳定性（CLS） | 0 | 视觉检查 + 自动化测试 |
| 帧率（滚动/动画） | > 55fps | Performance Monitor |
| 交互响应延迟 | < 100ms | 按下到视觉反馈 |
| 图片加载（二次） | < 50ms | FastImage 缓存命中 |
| 错误兜底覆盖率 | 100% | 代码审查 |

### 体验 Code Review 检查清单

```
□ 异步操作有 loading/error/empty 三态？
□ 图片有固定尺寸 + placeholder？
□ 列表有 estimatedItemSize？
□ 可点击元素有 pressed 态？
□ 页面有 ErrorBoundary？
□ 条件渲染不会导致布局跳动？
□ 动画用 Reanimated 不用 Animated？
□ 页面切换用 native-stack？
```

---

## 九、落地路径

### 第一步：建规范（1 周）

- 输出《体验规范文档》（上面的检查清单）
- 建统一组件库骨架（Skeleton/Button/EmptyState/ErrorState）
- 和设计对齐：每个状态都要有设计稿

### 第二步：改存量（2-4 周）

- 首屏改造：统一初始化 + 骨架屏
- 图片全量替换 FastImage + 固定尺寸
- 列表替换 FlashList
- 按钮/卡片加 pressed 态

### 第三步：建机制（持续）

- Code Review 加体验检查项
- 性能监控埋点（帧率/首屏/CLS）
- 新页面必须用组件库 + 通过体验检查
- 定期体验走查（每个版本发布前）

### 推动方式

```
不是一个人闷头改代码，而是：
1. 先让团队看到差距（对比竞品/录屏对比）
2. 输出规范（让大家知道"好"的标准是什么）
3. 建组件库（让大家用起来简单，不增加工作量）
4. Code Review 卡点（让规范落地）
5. 数据度量（让改进可见）
```

---

## 概念速查

| 概念 | 一句话 |
|------|--------|
| 感知速度 | 不是真快，是让用户觉得快（骨架屏/渐进式/乐观更新） |
| CLS | Cumulative Layout Shift，布局跳动指标，目标 = 0 |
| 乐观更新 | UI 先更新不等服务端，失败再回滚 |
| 骨架屏 | 页面结构先出来（灰色块），数据填充后替换 |
| Shimmer | 骨架屏上的闪光动画，表示"正在加载" |
| 三态 | 每个异步操作必须有 loading / error / empty 状态 |
| pressed 态 | 按下时的视觉反馈（缩放+透明度），< 50ms 响应 |
| ErrorBoundary | React 错误边界，捕获子组件崩溃，显示兜底 UI |
