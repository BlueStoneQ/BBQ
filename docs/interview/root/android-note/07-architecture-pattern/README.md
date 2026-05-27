# 07. 架构模式

> MVC → MVP → MVVM → MVI 演进，Jetpack 组件。

## 目录

- [一、架构演进](#一架构演进)
- [二、MVVM（当前主流）](#二mvvm当前主流)
- [三、Jetpack 核心组件](#三jetpack-核心组件)
- [四、Jetpack Compose（声明式 UI）](#四jetpack-compose声明式-ui)
- [五、和前端框架的对比](#五和前端框架的对比)

---

## 一、架构演进

| 模式 | 数据流 | 问题 | 时代 |
|------|--------|------|------|
| MVC | View ←→ Controller ←→ Model | Activity 既是 V 又是 C，臃肿 | 早期 |
| MVP | View ←→ Presenter ←→ Model | Presenter 和 View 接口耦合，大量模板代码 | 2015-2017 |
| **MVVM** | View ←→ ViewModel ←→ Model | 数据绑定，View 观察 ViewModel | 2017-至今（主流） |
| MVI | View ← State ← Intent → Reducer | 单向数据流，状态不可变 | 2020+（Compose 时代） |

### 类比前端

| Android | 前端 |
|---------|------|
| MVC | jQuery 时代（DOM 操作和逻辑混在一起） |
| MVP | 早期 Angular（Controller 模式） |
| MVVM | Vue（数据绑定 + 响应式） |
| MVI | Redux / Vuex（单向数据流 + 不可变状态） |

---

## 二、MVVM（当前主流）

```
View（Activity/Fragment）
  ↓ 观察 LiveData/StateFlow
ViewModel（持有状态，处理逻辑）
  ↓ 调用
Repository（数据层）
  ↓
Network / Database / Cache
```

### 核心特征

- View 不直接操作数据，只观察 ViewModel 的状态变化
- ViewModel 不持有 View 引用（避免内存泄漏）
- 数据变化自动驱动 UI 更新（类似 Vue 的响应式）

### 代码示例

```kotlin
// ViewModel
class UserViewModel : ViewModel() {
    private val _user = MutableLiveData<User>()
    val user: LiveData<User> = _user
    
    fun loadUser(id: String) {
        viewModelScope.launch {
            _user.value = repository.getUser(id)
        }
    }
}

// Activity（View 层）
class UserActivity : AppCompatActivity() {
    private val viewModel: UserViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        viewModel.user.observe(this) { user ->
            // 数据变了，更新 UI
            nameText.text = user.name
        }
        viewModel.loadUser("123")
    }
}
```

类比 Vue：
```javascript
// Vue 的等价写法
const user = ref(null)
async function loadUser(id) {
    user.value = await api.getUser(id)
}
// template 里 {{ user.name }} 自动更新
```

---

## 三、Jetpack 核心组件

Jetpack 是 Google 官方的 Android 组件库集合，解决常见开发问题：

| 组件 | 解决什么 | 类比前端 |
|------|---------|---------|
| **ViewModel** | 管理 UI 状态，屏幕旋转不丢失 | Pinia/Vuex Store |
| **LiveData** | 可观察的数据容器，生命周期感知 | Vue ref() + watch |
| **Room** | SQLite ORM | Prisma / TypeORM |
| **Navigation** | 页面导航（Fragment 间） | Vue Router |
| **WorkManager** | 后台任务调度 | cron job |
| **DataStore** | 键值存储（替代 SharedPreferences） | localStorage |
| **Hilt** | 依赖注入 | provide/inject |
| **Paging** | 分页加载 | 无限滚动 |
| **Compose** | 声明式 UI | React/Vue 模板 |

### ViewModel 的特殊之处

ViewModel 的生命周期比 Activity 长——屏幕旋转时 Activity 会被销毁重建，但 ViewModel 不会：

```
Activity 创建 → ViewModel 创建
屏幕旋转 → Activity 销毁 → Activity 重建 → ViewModel 还在（数据不丢）
Activity 真正退出 → ViewModel 销毁
```

这解决了 Android 特有的问题：配置变更（旋转/语言切换）导致 Activity 重建，数据丢失。前端没有这个问题（浏览器不会因为窗口大小变化而销毁页面）。

---

## 四、Jetpack Compose（声明式 UI）

### 传统 View vs Compose

```kotlin
// 传统：命令式（告诉系统"怎么做"）
val textView = TextView(context)
textView.text = "Hello"
textView.setTextColor(Color.RED)
layout.addView(textView)

// Compose：声明式（告诉系统"要什么"）
@Composable
fun Greeting() {
    Text(text = "Hello", color = Color.Red)
}
```

### 类比前端

| Compose | React | Vue |
|---------|-------|-----|
| @Composable 函数 | Function Component | `<template>` + `<script setup>` |
| remember {} | useState() | ref() |
| LaunchedEffect | useEffect() | onMounted + watch |
| State 驱动重组 | State 驱动 re-render | 响应式驱动更新 |

### Compose 的重组（Recomposition）

状态变化 → 只重新执行受影响的 @Composable 函数 → 只更新变化的 UI 部分。

和 React 的 re-render + Virtual DOM diff 类似，但 Compose 没有 Virtual DOM，直接操作 Compose 节点树。

---

## 五、和前端框架的对比

| 维度 | Android (MVVM + Jetpack) | Vue 3 |
|------|-------------------------|-------|
| 状态管理 | ViewModel + LiveData/StateFlow | Pinia + ref/reactive |
| 响应式 | LiveData.observe() / StateFlow.collect() | watch / computed |
| 依赖注入 | Hilt / Dagger | provide / inject |
| 路由 | Navigation Component | Vue Router |
| 列表 | RecyclerView + Adapter | v-for + key |
| 声明式 UI | Jetpack Compose | `<template>` |
| 生命周期 | Lifecycle-aware components | onMounted / onUnmounted |
| 异步 | Coroutine + Flow | async/await + Promise |

### 快应用框架的架构模式

快应用框架本身不是 MVVM——它是一个**运行时框架**，架构更接近浏览器：

```
浏览器：HTML/CSS/JS → 浏览器引擎 → 渲染到屏幕
快应用：JS/CSS/模板 → 快应用框架（V8 + Bridge + 原生渲染）→ 渲染到屏幕
```

但开发者写的快应用代码可以用类 MVVM 模式（数据驱动视图更新），框架内部帮你做了数据绑定和 diff。
