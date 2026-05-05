# 快应用框架架构笔记 - 总览

> 问题驱动，从骨架到支干到叶。

## 框架核心大件清单

### 问题：一个快应用框架的核心大件有哪些？

初始假设：JS 引擎、渲染层、DSL 解析层、JS Bridge、路由系统、远程加载和缓存系统。

Check 后修正为 **9 个核心大件**：

| # | 大件 | 源码位置 | 职责 | 详细文档 |
|---|------|---------|------|---------|
| 1 | JS 引擎层 | `render/jsruntime/` | V8 实例管理、快照加速、沙箱隔离 | [js-engine.md](js-engine.md) |
| 2 | JS Framework | `core/framework/src/dsls/` + `infras/` | DSL 模板解析、响应式数据、虚拟 DOM | |
| 3 | JS Bridge | `render/jsruntime/JsBridge.java` + `bridge/ExtensionManager.java` | 双通道：渲染(callNative) + Feature(JsBridge.invoke) | |
| 4 | 渲染引擎 | `render/action/` + `render/vdom/` + `component/` + `widgets/` | Action 解析 → VDom → ComponentFactory → Native View | |
| 5 | 样式引擎 | `render/css/` + JS 侧 `infras/styling/` | CSS 解析、Flexbox 布局（Yoga）、样式继承计算 | |
| 6 | Feature/API 系统 | `bridge/ExtensionManager` + `features/` | 60+ 系统能力的注册、权限、分发 | |
| 7 | 路由系统 | `render/PageManager.java` + `JsBridgeHistory.java` | 页面栈、TabBar、多窗口、deeplink | |
| 8 | 包管理/缓存系统 | `cache/` | rpk 下载 → 签名校验 → 解压 → 版本缓存 | |
| 9 | 生命周期/进程管理 | `runtime/` + `bridge/HybridManager.java` | App/Page 生命周期、资源回收、多实例 | |

### 初始假设漏了什么

| 漏掉的大件 | 为什么是核心 |
|-----------|-------------|
| Feature/API 系统 | 框架的扩展性设计——60+ 系统 API 的注册、权限、分发机制 |
| 样式引擎 | 渲染的完整性——不是简单属性映射，有继承、优先级、动态计算 |
| 生命周期/进程管理 | 系统级应用的资源管控——必须精细管理内存和进程 |

### 面试价值

- Feature 系统 → 体现"框架的扩展性设计"（注解注册 + 反射分发 + 权限拦截）
- 样式引擎 → 体现"渲染的完整性"（不只是 View 创建，还有布局计算）
- 生命周期管理 → 体现"系统级应用的资源管控"（和三方 App 不同的约束）
