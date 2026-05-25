# 白屏检测与治理

> 问题：页面跳转后/列表滚动时出现白屏（空白区域）
> 本质：内容还没渲染出来，用户看到空白
> 目标：任何场景下用户都不会看到纯白屏

---

## 白屏分类

| 类型 | 原因 | 现象 |
|------|------|------|
| **启动白屏** | Bundle 加载 + JS 执行期间没有 UI | 点击图标后白屏 1-2s |
| **页面跳转白屏** | 新页面组件还没渲染完 | 跳转后短暂白屏 |
| **列表滚动白屏** | FlatList 来不及渲染新 item | 快速滚动时 item 区域空白 |
| **JS Crash 白屏** | JS 异常导致组件树崩溃 | 整个页面变白 |
| **数据加载白屏** | 数据没来，条件渲染为空 | `{data && <View/>}` → 空 |

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| 肉眼 + 录屏 | 白屏出现的时机和持续时间 |
| Performance Monitor | 白屏时 JS/UI 帧率 |
| React DevTools | 组件树是否为空 / ErrorBoundary 是否触发 |
| Sentry | 是否有 JS 异常导致白屏 |

---

## 如何优化

### 启动白屏

| 手段 | 做什么 |
|------|--------|
| Splash Screen | Native 层立刻显示品牌画面（不让用户看到白屏） |
| 骨架屏 | Splash 消失后立刻显示骨架（不是空白） |

→ 详见 [perf-splash.md](./perf-splash.md)

### 页面跳转白屏

| 手段 | 做什么 |
|------|--------|
| native-stack | 原生转场动画，切换瞬间有过渡 |
| 骨架屏 | 新页面先显示骨架 |
| 容器预热 | 提前创建页面实例 |
| InteractionManager | 转场动画结束后再做重计算 |

### 列表滚动白屏

| 手段 | 做什么 |
|------|--------|
| **FlashList** | View 复用，不销毁重建 |
| `estimatedItemSize` | 预设高度，提前计算布局 |
| 增大 `windowSize` | 渲染窗口更大，提前渲染屏幕外的 item |
| FastImage | 图片缓存，不重复下载 |

### JS Crash 白屏

| 手段 | 做什么 |
|------|--------|
| **ErrorBoundary** | 捕获渲染错误 → 显示兜底 UI（不是白屏） |
| 页面级 ErrorBoundary | 每个页面包一层，一个页面崩了不影响其他 |
| 全局兜底 | App 根组件包 ErrorBoundary → 最坏情况显示"重试"按钮 |

```typescript
// 每个页面都有 ErrorBoundary → 崩了显示兜底，不白屏
function DeviceDetailScreen() {
  return (
    <ErrorBoundary fallback={<ErrorState message="页面加载失败" onRetry={reload} />}>
      <DeviceDetail />
    </ErrorBoundary>
  );
}
```

### 数据加载白屏

| 手段 | 做什么 |
|------|--------|
| 骨架屏 | 数据没来时显示骨架（不是空白） |
| 避免 `{data && <View/>}` | 用三态组件（loading/content/error） |

---

## 白屏检测方案

```typescript
// 自动检测白屏：页面渲染后检查是否有内容
function useWhiteScreenDetection(screenName: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      // 如果 3 秒后页面仍然没有内容 → 上报白屏事件
      if (!hasVisibleContent()) {
        reportWhiteScreen(screenName);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
}
```
