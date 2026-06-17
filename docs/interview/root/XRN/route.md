## 一、XRN 路由方案：**原生路由 + JS 内部路由 混合模式**

### 核心设计原则

| 跳转类型 | 路由方式 | 行为 |
|---------|---------|------|
| **跨模块** | 原生路由 | 新 Activity + 新 ReactInstance + 加载目标 bundle |
| **模块内** | JS 内部路由 | 同一 Activity/Instance，仅组件树切换 |

---

## 二、路由架构详解

### 1. URL 格式

```
xrn://order/detail?id=123
         ─────  ──────  ────────
         bundleId  内部路由  参数
```

### 2. 完整跳转流程

```
1. JS 调用 XRNRouter.push("xrn://order/detail?id=123")
         │
         ▼
2. 原生路由层解析 URL → 提取 bundleId = "order"
         │
         ▼
3. 判断是否跨模块：当前 bundle != 目标 bundle → 跨模块
         │
         ▼
4. 创建 XRNActivity（通用模板类，只需声明一次）
         │
         ▼
5. 从实例池取一个已预加载 common.hbc 的 ReactInstance
         │
         ▼
6. 加载业务 bundle（order.hbc）
         │
         ▼
7. 创建 ReactRootView，通过 initialProperties 传入内部路由和参数
         │
         ▼
8. Bundle 内部组件根据 route 渲染对应页面
```

---

## 三、两种路由模式对比

### 跨模块跳转（原生路由）

```kotlin
// Android 示例：跨模块跳转
val intent = Intent(context, XRNActivity::class.java).apply {
    putExtra("route", "order/detail")
    putExtra("params", bundleOf("id" to "123"))
}
startActivity(intent)  // 原生导航栈 push，有转场动画
```

**特点**：
- ✅ 新 Activity，独立 ReactInstance
- ✅ 页面完全隔离
- ✅ **原生转场动画**（平台默认）
- ✅ 手势返回支持

### 模块内跳转（JS 路由）

```javascript
// JS 内部路由（使用 React Navigation 或自定义）
navigate("detail", { id: "123" })
// 同一个 Activity、同一个 ReactInstance，仅组件树切换
```

**特点**：
- ✅ 零开销（纯 JS 操作）
- ✅ 保持状态
- ✅ JS 层面的转场动画（如 React Navigation 的动画）

---

## 四、转页动画

### 跨模块转场（原生动画）

```
┌─────────────────────────────────────────────────────┐
│ 原生导航栈                                          │
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                │
│  │ XRNActivity │───▶│ XRNActivity │  ← 原生转场    │
│  │    home     │    │    order    │  动画          │
│  └─────────────┘    └─────────────┘                │
│       ←── 返回 ──                                    │
│           ↑                                         │
│      原生返回动画                                    │
└─────────────────────────────────────────────────────┘
```

### 模块内转场（JS 动画）

```javascript
// React Navigation 示例
<Stack.Navigator
  screenOptions={{
    animationEnabled: true,
    gestureEnabled: true,
  }}
>
  <Stack.Screen name="List" component={OrderList} />
  <Stack.Screen name="Detail" component={OrderDetail} />
</Stack.Navigator>
```

---

## 五、为什么这样设计

| 维度 | 设计决策 | 优势 |
|------|---------|------|
| **隔离性** | 跨模块用独立实例 | 一个模块崩溃不影响其他模块 |
| **性能** | 模块内零开销，跨模块靠池化预热 | 打开速度快 |
| **体验** | 跨模块用原生动画 | 平台级流畅体验 |
| **热更新** | 单 bundle 更新 | 粒度细，影响范围小 |
| **内存** | Activity 销毁 → 实例回池 | 可控，不累积 |

---

## 六、总结

| 问题 | 答案 |
|------|------|
| **纯 RN 路由？** | ❌ 混合模式：模块内用 JS 路由，跨模块用原生路由 |
| **能使用 native 路由？** | ✅ 跨模块跳转就是原生路由 |
| **转页动画？** | 跨模块用原生动画，模块内用 JS 动画 |
| **Activity 需要多个？** | ❌ 只有一个通用 XRNActivity，通过参数复用 |

XRN 的路由方案兼顾了**隔离性、性能和原生体验**，是一种成熟的企业级设计方案。