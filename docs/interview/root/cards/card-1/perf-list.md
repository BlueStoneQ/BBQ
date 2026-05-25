# 列表滑动流畅度

> 问题：长列表快速滚动时掉帧/白屏/卡顿
>
> 本质：每帧 16ms 内要完成 item 渲染，超了就掉帧
>
> 目标：快速滚动时稳定 55-60fps，无白屏

---

## 目录

- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [RN/JS 层](#rnjs-层)
  - [Native 层](#native-层)
  - [C++ 层（Fabric）](#c-层fabric)
- [列表最佳实践总结](#列表最佳实践总结)

---

## 如何分析

| 工具 | 看什么 | 定位到什么 |
|------|--------|-----------|
| Performance Monitor | 滚动时 JS/UI 帧率 | JS 慢还是 Native 慢 |
| React DevTools | Highlight Updates | 哪些 item 在不必要重渲染 |
| Hermes Profiler | renderItem 里哪个函数慢 | 具体慢函数 |
| Perfetto | UI Thread 每帧耗时 | View 层级深/图片解码慢 |

**判断逻辑**：
- JS 帧率低 → renderItem 重渲染 / 计算重
- UI 帧率低 → View 层级深 / 图片大 / 离屏渲染
- 都低 → 换 FlashList

---

## 如何优化

### RN/JS 层

| 手段 | 做什么 | 为什么 |
|------|--------|--------|
| **FlashList** 替代 FlatList | View 复用（类似 RecyclerView） | FlatList 销毁重建 View，FlashList 复用 |
| **React.memo** 包裹 item | props 没变就不重渲染 | 避免滚动时所有 item 都重渲染 |
| **useCallback** 缓存 onPress | 函数引用不变 → memo 生效 | 否则每次渲染新函数 → memo 失效 |
| **estimatedItemSize** | 预设 item 高度 | FlashList 提前计算布局，减少白屏 |
| **keyExtractor** 用稳定 ID | 不用 index | 避免 item 销毁重建 |
| **windowSize** 调优 | 控制渲染窗口大小 | 太大浪费内存，太小白屏 |
| **getItemLayout**（固定高度时） | 精确告诉列表每个 item 的位置 | 跳过布局计算 |

### Native 层

| 手段 | 做什么 | 为什么 |
|------|--------|--------|
| **FastImage** | 图片 Native 缓存 + 异步解码 | 图片不闪烁，解码不占 JS。[详见 FastImage 原理](../../RN/iot-ble-performance.md) |
| 简化 item 布局 | 减少 View 嵌套层级 | 层级深 → Native 布局计算慢 |
| 避免阴影/圆角 | 复杂样式触发离屏渲染 | 离屏渲染 = GPU 额外开销 |

### C++ 层（Fabric）

Fabric 渲染器在 C++ 层做布局计算（Yoga），优化手段：
- 减少 Yoga 节点数（简化组件树）
- 避免频繁触发重新布局（固定尺寸）

```typescript
// ✅ 完整的高性能列表
import { FlashList } from '@shopify/flash-list';

const renderItem = useCallback(({ item }) => (
  <DeviceCard device={item} onPress={handlePress} />
), [handlePress]);

const handlePress = useCallback((id) => {
  navigateTo('DeviceDetail', { id });
}, []);

<FlashList
  data={devices}
  renderItem={renderItem}
  estimatedItemSize={80}
  keyExtractor={(item) => item.id}
/>

// DeviceCard 用 React.memo 包裹
const DeviceCard = React.memo(({ device, onPress }) => (
  <Pressable onPress={() => onPress(device.id)} style={({ pressed }) => [
    styles.card, pressed && styles.pressed
  ]}>
    <FastImage source={{ uri: device.avatar }} style={{ width: "100%", aspectRatio: 16/9 }} />
    <Text>{device.name}</Text>
  </Pressable>
));
```


---

## 列表最佳实践总结

**FlashList 解决了最核心的问题（View 复用），但不是"用了就全搞定"。**

```
FlashList 解决的：View 复用（不销毁重建）→ 滚动时不白屏不卡顿
FlashList 解决不了的：
  - renderItem 里重渲染 → 需要 React.memo + useCallback
  - 图片重复下载/闪烁 → 需要 FastImage
  - item 高度不确定导致跳动 → 需要 estimatedItemSize
```

**完整最佳实践 = FlashList + memo + useCallback + FastImage + estimatedItemSize**：

```typescript
// 完整的高性能列表
const handlePress = useCallback((id) => navigateTo('Detail', { id }), []);

const renderItem = useCallback(({ item }) => (
  <DeviceCard device={item} onPress={handlePress} />
), [handlePress]);

<FlashList
  data={devices}
  renderItem={renderItem}
  estimatedItemSize={80}           // 预设高度
  keyExtractor={(item) => item.id} // 稳定 key
/>

// DeviceCard：memo 包裹 + FastImage
const DeviceCard = React.memo(({ device, onPress }) => (
  <Pressable onPress={() => onPress(device.id)}>
    <FastImage source={{ uri: device.avatar }} style={{ width: "100%", aspectRatio: 16/9 }} />
    <Text>{device.name}</Text>
  </Pressable>
));
```

缺一个都可能有问题：
- 没 memo → 滚动时所有 item 重渲染 → 卡
- 没 useCallback → memo 失效（函数引用每次都变）
- 没 FastImage → 图片闪烁/重复下载
- 没 estimatedItemSize → 白屏/跳动
