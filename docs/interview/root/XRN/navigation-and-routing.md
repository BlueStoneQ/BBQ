# 导航与路由设计

## 核心模型

```
URL: xrn://order/detail?id=123
         ─────  ──────  ────────
         bundleId  内部路由  参数
```

每次页面跳转的完整流程：

1. 原生路由层解析 URL → 提取 bundleId
2. 创建 XRNActivity/XRNViewController（通用模板类，只声明一次）
3. 从 ReactInstance 实例池取一个已预加载 common.hbc 的实例
4. 在该实例上加载业务 bundle（如 order.hbc）
5. 创建 ReactRootView，通过 initialProperties 传入内部路由和参数
6. Bundle 内部组件根据 route 渲染对应页面

## 关键概念

### Activity/ViewController 不需要池化

Activity 由系统管理，创建成本低（几毫秒）。我们只定义一个通用的 `XRNActivity` 类，通过 Intent extras 传入不同的 route 参数复用：

```kotlin
// 打开任意 RN 页面
val intent = Intent(context, XRNActivity::class.java).apply {
    putExtra("route", "order/detail")
    putExtra("params", bundleOf("id" to "123"))
}
startActivity(intent)
```

AndroidManifest 只需声明一次：

```xml
<activity android:name=".XRNActivity" />
```

### ReactInstance 需要池化

创建 ReactInstance + 加载 common.hbc 耗时约 500ms，这是池化的对象。池中的实例已经完成了"创建 JS 运行时 + 加载公共代码"，用户打开页面时只需加载很小的业务 bundle（~50ms）。

### ReactRootView 是一个普通 View

ReactRootView 继承 FrameLayout（Android）/ UIView（iOS），不是 Activity。它被放进 Activity 的 content view 中显示。

## 路由粒度

采用方案 B：一个 bundle = 一个业务模块（包含多个页面）。

| 跳转类型 | 行为 | 示例 |
|---------|------|------|
| 跨模块 | 新 Activity + 新 ReactInstance + 加载目标 bundle | order → profile |
| 模块内 | bundle 内部路由切换，不创建新 Activity | order/list → order/detail |

### 跨模块跳转

```
order/list 页面点击"查看用户"
  → JS 调用 XRNRouter.push("xrn://profile/detail?uid=456")
  → 原生层解析：bundleId = "profile"，与当前 "order" 不同
  → 创建新 XRNActivity + 新 ReactInstance + 加载 profile.hbc
  → 原生导航栈 push（有转场动画）
```

### 模块内跳转

```
order/list 页面点击某个订单
  → JS 内部路由：navigate("detail", { id: "123" })
  → 同一个 Activity、同一个 ReactInstance
  → 只是 RN 组件树切换（React Navigation 或自定义路由）
```

## 为什么这样设计

- **隔离性**：跨模块用独立实例，一个模块 JS 崩溃不影响其他模块
- **性能**：模块内跳转零开销（纯 JS 路由），跨模块跳转通过实例池预热也很快
- **原生体验**：跨模块跳转有原生转场动画和手势返回
- **热更新粒度**：可以只更新单个模块的 bundle，不影响其他模块
- **内存可控**：页面关闭 → Activity 销毁 → ReactInstance 释放，不会累积

## 数据流示意

```
┌─────────────────────────────────────────────────────┐
│ 原生导航栈                                            │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ XRNActivity │  │ XRNActivity │  │ XRNActivity │ │
│  │ instance #1 │  │ instance #2 │  │ instance #3 │ │
│  │ home.hbc    │  │ order.hbc   │  │ profile.hbc │ │
│  │             │  │             │  │             │ │
│  │ route:      │  │ route:      │  │ route:      │ │
│  │  home/feed  │  │  order/list │  │  profile/me │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│       ←── 返回 ──      ←── 返回 ──                   │
└─────────────────────────────────────────────────────┘
```

每个 Activity 持有独立的 ReactInstance，互不干扰。用户按返回键时，Activity 销毁，实例释放回池（销毁后池补充新实例）。
