# JS Bridge 通信阻塞

> 问题：JS ↔ Native 通信频率高时，Bridge 排队导致 UI 卡顿/数据延迟
> 本质：旧架构 Bridge 是异步 JSON 序列化队列，高频通信时成为瓶颈
> 方案：迁移 TurboModule（JSI 直调）+ Native 层事件聚合

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| Performance Monitor | 高频 BLE 回调时 JS 帧率是否掉 |
| Perfetto | Bridge 线程是否有排队（旧架构） |
| 自定义打点 | Native 发出 → JS 收到的延迟 |

**判断是否是 Bridge 瓶颈**：
- 旧架构（< 0.76）+ 高频通信（每秒 10+ 次）→ 大概率是
- 新架构（0.82+）→ 已用 JSI，Bridge 瓶颈不存在

---

## 如何优化

### 根本方案：迁移 TurboModule（JSI）

```
旧架构：JS → JSON.stringify → Bridge 队列 → JSON.parse → Native（ms 级延迟）
新架构：JS → JSI C++ 直调 → Native（μs 级延迟，无序列化）
```

迁移后 Bridge 阻塞问题彻底消失。

### 辅助方案：Native 层事件聚合

即使用了 JSI，高频回调仍然会占 JS 线程。解决：

```
BLE 每秒 30 次回调 → Native 层聚合为每 100ms 一次 → JS 只收到 10 次/秒
= JS 线程负担降 3 倍
```

### 辅助方案：状态精准更新

```typescript
// Zustand selector：只有变化的字段触发重渲染
const pressure = useDeviceStore(s => s.pressure);
// pressure 没变 → 组件不重渲染（即使 store 其他字段变了）
```

---

## 和 card-2 的关系

Bridge 阻塞的**根本解决方案**（TurboModule/JSI 架构）在 [card-2（跨层通信架构）](../card-2-cross-layer.md) 中详细展开。本文聚焦"性能视角下的分析和优化"。
