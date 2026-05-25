# 加载态体验（骨架屏 / Shimmer / Loading）

> 问题：异步操作期间用户不知道"在加载还是卡了"
>
> 本质：给等待一个视觉反馈，让用户知道"系统在工作"
>
> 目标：每个异步操作都有对应的加载态

---

## 目录

- [加载态类型](#加载态类型)
- [RN 骨架屏方案](#rn-骨架屏方案)
- [统一 Loading 组件体系](#统一-loading-组件体系)
- [规范](#规范)

---

## 加载态类型

| 类型 | 适用场景 | 效果 |
|------|---------|------|
| **骨架屏（Skeleton）** | 页面/列表首次加载 | 布局先出来，数据填充后替换 |
| **Shimmer 动画** | 骨架屏上的闪光效果 | 用户知道"在加载"不是"卡了" |
| **全屏 Loading** | 重操作（配网/连接设备） | 阻塞交互，明确等待 |
| **行内 Loading** | 按钮/列表底部加载更多 | 不阻塞其他操作 |
| **渐进式图片** | 图片加载 | 先模糊后清晰 |

---

## RN 骨架屏方案

```typescript
// 方案：react-native-skeleton-placeholder（Shimmer 效果）
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

function DeviceCardSkeleton() {
  return (
    <SkeletonPlaceholder borderRadius={8}>
      <SkeletonPlaceholder.Item flexDirection="row" padding={12}>
        <SkeletonPlaceholder.Item width={56} height={56} borderRadius={8} />
        <SkeletonPlaceholder.Item marginLeft={12}>
          <SkeletonPlaceholder.Item width={120} height={16} />
          <SkeletonPlaceholder.Item width={80} height={12} marginTop={8} />
        </SkeletonPlaceholder.Item>
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder>
  );
}

// 使用：数据没来 → 骨架 | 来了 → 真实内容
function DeviceList() {
  const { data, isLoading } = useDevices();
  if (isLoading) return <>{[1,2,3].map(i => <DeviceCardSkeleton key={i} />)}</>;
  return <FlashList data={data} renderItem={...} />;
}
```

**关键规范**：骨架屏布局 = 真实内容布局（高度/间距一致）→ 数据填充时无跳动。

---

## 统一 Loading 组件体系

```typescript
<Skeleton />          // 页面级骨架屏
<ImagePlaceholder />  // 图片占位（模糊缩略图）
<LoadingOverlay />    // 全屏 loading（配网/BLE 连接）
<InlineLoading />     // 行内 loading（按钮/列表底部）
<EmptyState />        // 空状态（无设备/无数据）
<ErrorState />        // 错误状态（重试按钮）
```

---

## 规范

| 规范 | 要求 |
|------|------|
| 每个异步操作 | 必须有 loading + error + empty 三态 |
| 每个图片 | 必须有 placeholder |
| 每个页面 | 必须有 ErrorBoundary 兜底 |
| 骨架屏 | 布局必须和真实内容一致 |
