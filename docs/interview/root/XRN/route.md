# XRN 路由设计

## 目录

- [一、路由方案：原生路由 + JS 内部路由混合模式](#一xrn-路由方案原生路由--js-内部路由-混合模式)
- [二、路由架构详解](#二路由架构详解)
- [三、两种路由模式对比](#三两种路由模式对比)
- [三-A、XRN 需要为业务层封装什么](#三-axrn-需要为业务层封装什么)
- [四、转页动画](#四转页动画)
- [五、为什么这样设计](#五为什么这样设计)
- [五-A、CRN 的路由方案对比](#五-acrn-的路由方案对比)
- [六、总结](#六总结)

---

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

## 三-A、XRN 需要为业务层封装什么

**问题：基于多 Activity 设计，React Navigation 不能直接用于跨模块，XRN 需要提供什么？**

### 为什么 React Navigation 不够

```
React Navigation 的前提：所有页面在同一个 JS Context 中

多 Bundle 架构下：
  home.hbc  → Instance 1 → JS Context A
  order.hbc → Instance 2 → JS Context B

React Navigation 看不到另一个 Instance 中的页面 → 跨模块跳不了
```

### XRN 需要封装的路由 API

```javascript
// 业务开发者统一调用：
import { XRNRouter } from '@x-rn/router'

XRNRouter.push('order/detail', { id: '123' })
XRNRouter.back()
XRNRouter.replace('home/index')
```

**内部实现逻辑**：

```javascript
// @x-rn/router 核心判断
function push(route: string, params?: object) {
  const targetBundleId = route.split('/')[0]  // "order"
  const currentBundleId = getCurrentBundleId() // "home"

  if (targetBundleId === currentBundleId) {
    // 模块内 → 走 React Navigation（纯 JS，零开销）
    navigation.navigate(route, params)
  } else {
    // 跨模块 → 走 NativeModule → 触发 Intent → 新 Activity
    NativeModules.XRNRouter.push(route, params)
  }
}
```

**Native 侧 TurboModule 实现**：

```kotlin
// XRNRouterModule.kt
class XRNRouterModule : TurboModule {
    fun push(route: String, params: ReadableMap?) {
        val intent = Intent(context, XRNActivity::class.java).apply {
            putExtra("route", route)
            putExtra("params", params?.toBundle())
        }
        currentActivity?.startActivity(intent)
    }

    fun back() {
        currentActivity?.finish()
    }
}
```

### 对业务开发者的价值

| 特性 | 说明 |
|------|------|
| **统一 API** | 业务层不需要关心是跨模块还是模块内 |
| **自动判断** | 框架根据 bundleId 决定走 Native 还是 JS 路由 |
| **开发体验** | 和标准 React Navigation 用法一致 |
| **可扩展** | 支持路由拦截、鉴权、埋点等中间件 |

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

## 五-A、CRN 的路由方案对比

CRN（携程）的路由方案本质和 XRN 一致，也是**原生路由 + JS 内部路由混合**。

### CRN 路由核心设计

```javascript
// CRN 的统一路由 API
CRNNavigator.open('ctrip://rn/hotel/detail?id=123')

// 内部逻辑：
// 1. 解析 URL scheme → 判断目标是 RN 页面还是 Native 页面
// 2. 跨模块 → 调用 Native 路由（CTNavigator），启动新 CRNActivity
// 3. 模块内 → 走 React Navigation
```

### XRN vs CRN 路由对比

| 维度 | CRN | XRN |
|------|-----|-----|
| **URL 格式** | `ctrip://rn/hotel/detail?id=123` | `xrn://order/detail?id=123` |
| **跨模块跳转** | Native CTNavigator → 新 CRNActivity | Native XRNRouter → 新 XRNActivity |
| **模块内跳转** | React Navigation | React Navigation |
| **统一 API** | `CRNNavigator.open(url)` | `XRNRouter.push(route, params)` |
| **与 Native 混排** | 支持（统一 URL scheme） | 支持（统一两段式 URL） |
| **深链接** | 统一 scheme 直接匹配 | 同左 |

### 共同点

- 跨模块必须走 Native 路由（React Navigation 跨不了 JS Context）
- 模块内可以用 React Navigation
- 统一 API 屏蔽底层差异，业务开发者无感知
- 与 Native 页面共享同一个导航栈

---

## 六、总结

| 问题 | 答案 |
|------|------|
| **纯 RN 路由？** | ❌ 混合模式：模块内用 JS 路由，跨模块用原生路由 |
| **能使用 native 路由？** | ✅ 跨模块跳转就是原生路由 |
| **转页动画？** | 跨模块用原生动画，模块内用 JS 动画 |
| **Activity 需要多个？** | ❌ 只有一个通用 XRNActivity，通过参数复用 |

XRN 的路由方案兼顾了**隔离性、性能和原生体验**，是一种成熟的企业级设计方案。