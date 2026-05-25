# 页面路由切换性能

> 问题：页面跳转时卡顿/白屏/动画不流畅
> 本质：切换瞬间 JS 线程在做重计算（渲染新页面 + 动画），帧预算超 16ms
> 目标：页面切换 < 300ms，转场动画 60fps

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| Performance Monitor | 切换瞬间 JS/UI 帧率是否掉 |
| Perfetto | 切换时各线程在做什么 |
| 肉眼 | 是否有白屏/闪烁/卡顿 |

---

## 如何优化

### RN/JS 层

| 手段 | 做什么 | 效果 |
|------|--------|------|
| `native-stack` | 页面转场走原生导航（UINavigationController/Fragment） | 转场动画在 Native 执行，不占 JS |
| `InteractionManager.runAfterInteractions` | 延迟非关键任务到转场动画结束后 | 转场期间 JS 不做重活 |
| 骨架屏 | 新页面先显示骨架，数据来了再填充 | 不白屏 |
| React.lazy + Suspense | 非首屏页面懒加载 | 减少首次加载量 |
| 页面预渲染 | 高概率访问的页面提前渲染 | 切换时秒出 |

### Native 层

| 手段 | 做什么 | 效果 |
|------|--------|------|
| `@react-navigation/native-stack` | 底层用原生导航控制器 | 转场动画性能 = 原生 App |
| 容器预热 | 提前创建 ReactInstanceManager | 多 Bundle 场景跳转快 |
| `detachInactiveScreens` | 离开的页面从视图树移除 | 减少内存占用 |

```typescript
// native-stack：转场动画走原生，不占 JS
import { createNativeStackNavigator } from '@react-navigation/native-stack';
const Stack = createNativeStackNavigator();

// 延迟非关键任务：转场动画结束后再执行
InteractionManager.runAfterInteractions(() => {
  // 这里做数据请求/重计算，不影响转场动画
  fetchDeviceDetail(deviceId);
});
```
