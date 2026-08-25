# QuickApp 框架分析交接

## 目录

- [1. 目标与顺序](#1-目标与顺序)
- [2. HAP 总体模型](#2-hap-总体模型)
- [3. HAP Toolkit](#3-hap-toolkit)
- [4. HAP 运行链路](#4-hap-运行链路)
- [5. HAP Bridge、事件与异步](#5-hap-bridge事件与异步)
- [6. QuickApp Kit 模型](#6-quickapp-kit-模型)
- [7. QuickApp Kit ID 系统](#7-quickapp-kit-id-系统)
- [8. 路由与内存](#8-路由与内存)
- [9. 关键判断与后续](#9-关键判断与后续)

## 1. 目标与顺序

当前集中理解联盟 HAP 的 `runtime + toolkit`，再分析 Vela QuickApp 的嵌入式方案，最后对照 QuickApp Kit。回答采用第一性、结论先行、少噪音，并区分事实与推断。

```text
HAP -> Toolkit / Bridge / 渲染 / 事件 / 生命周期
Vela -> libuv + Yoga + LVGL / 线程 / 内存
QuickApp Kit -> 对照吸收 / 架构验证 / Benchmark
```

## 2. HAP 总体模型

HAP 是面向 Android 的两层运行时：

```text
JS Framework
  <-> J2V8 / JNI / Android Runtime
  <-> Android View / System API
```

JS 侧负责页面 VM、模板、样式、数据绑定、生命周期、事件 Handler 和能力调用；Android Runtime 负责 RPK 加载、页面容器、Android View、系统能力和原生事件。底层 C++/JNI 主要是 JS 引擎和语言绑定基础设施，不是平台无关的 Runtime Core。

## 3. HAP Toolkit

Case 001 的构建目录：

```text
build/
├── manifest.json
├── app.js
├── pages/Demo/index.js
├── pages/DemoDetail/index.js
├── CardDemo/index.js
├── assets/
└── sitemap.json
```

之后由 `hap-packager` 封装为 debug/release RPK/RPKS。

页面 `index.js` 的本质是：

```text
Page VM + Template + Style + module registration/bootstrap
```

典型产物：

```js
$app_define$('@app-component/index', [], factory)
$app_bootstrap$('@app-component/index', { packagerVersion: '2.1.0' })
```

三个入口：

```text
$app_define$    注册模块
$app_bootstrap$ 启动已注册模块
$app_require$   获取 Runtime 模块/系统能力 Facade
```

Toolkit 主链路：

```text
.ux / JS / manifest / assets
-> hap-compiler: script/template/style
-> Webpack: 页面 Bundle
-> hap-packager: 资源、分包、签名、RPK
```

联盟默认以页面 Bundle 为主；公共依赖抽取是可选的 splitChunks 能力，不应预设一定存在 common bundle。

## 4. HAP 运行链路

```text
RPK
-> Manifest
-> 创建 JS Runtime
-> 注入 Runtime 入口
-> app.js
-> 入口页面 index.js
-> Page VM
-> onInit
-> Template/Style 求值
-> 创建/更新 Android View
-> Present
```

源码：

```html
<text>{{ title }}</text>
<input onclick="onDetailBtnClick" />
```

会编译为动态表达式和事件映射：

```js
value: function () { return this.title }
events: { click: 'onDetailBtnClick' }
```

当前产物能证明 Template、Style、VM 和事件定义存在；不能仅凭 Toolkit 产物确认 HAP 内部有正式、独立、平台无关的 `MountTransaction` 协议。

## 5. HAP Bridge、事件与异步

Bridge 的本质：

> JS Framework 通过 Runtime 暴露的外部对象/函数调用 Android 能力，Android 完成后通过 J2V8/JNI 回调 JS。

```text
JS system.xxx()
-> Runtime module facade
-> J2V8/JNI
-> Android Runtime / System API
-> callback / result
```

事件是两边协作：

```text
Android View Listener
-> HAP Runtime 找到事件关系
-> J2V8 调用 JS 事件入口
-> JS Framework 找到 Page VM Handler
-> Handler 修改状态或发起能力/路由
```

Toolkit 解析和校验事件；Android Runtime 注册 Listener、捕获物理事件；JS Framework 保存和执行业务 Handler；Bridge 负责对象转换和跨层调用。

HAP 支持异步。Native 边界的本质是请求关联和结果回调，Promise/async-await 可以由 JS Facade 在回调之上包装，不要求 Native 持有 JS 的 `resolve/reject` 句柄。

## 6. QuickApp Kit 模型

```text
JS Framework
  -> 表达状态变化和增量意图
C++ Core
  -> 唯一权威 Runtime Tree、Binding、Layout、事件、路由、事务
Platform Adapter
  -> Host 操作、平台输入、平台能力
```

更新链路：

```text
State mutation
-> Proxy 标记 Dirty Binding/Block
-> 注册一次 Microtask
-> 批量求值和合并
-> RenderTransaction
-> C++ 更新 Runtime Tree
-> Style/Layout
-> MountTransaction
-> Android / LVGL / iOS Adapter
```

JS 不提交完整 VNode Tree，不直接传 `NodeId` 或 `NativeHandle`；Platform 不做逻辑 Diff、不拥有路由栈。

JS-C++ 使用 typed message：

```text
JS -> C++: StateTransaction / NavigationRequest / FeatureRequest / LifecycleCommand
C++ -> JS: JsEventDispatch / FeatureResult / NavigationResult / LifecycleEvent
```

异步采用：

```text
RequestId + Typed Request
-> C++ / Platform
-> RequestId + Typed Result
-> JS pending map
-> resolve/reject
```

## 7. QuickApp Kit ID 系统

ID 的本质是用稳定身份代替跨层对象引用，并关联异步事务。

```text
定义 ID：TemplateNodeId / TemplateBindingId / TemplateBlockId / TemplateHandlerId
实例 ID：AppRuntimeId / SurfaceId / ComponentInstanceId / BlockInstanceId / HandlerId / NodeId
关联 ID：RequestId / TransactionId / MountAttemptId / Revision
```

寻址链：

```text
OwnerInstanceId + TemplateBindingId
-> Page IR BindingDef
-> LogicalNodeRef(OwnerInstanceId, TemplateNodeId)
-> NodeId
-> RuntimeNode
-> Platform NodeId -> NativeHandle
```

底层结构按查询和生命周期选择：

```text
vector      静态 Page IR 定义表
slot map    动态 RuntimeNode / Surface / 实例对象
hash map    组合键索引、EventBinding、PendingRequest
Set/bitset  Dirty Binding / Block
arena       单批事务短命内存
ring buffer 有界跨线程消息队列
```

## 8. 路由与内存

路由的本质是：**Core 根据 Route 创建、提交和销毁 Surface，并维护唯一权威页面栈。**

```text
router.push
-> Core 解析 Route、分配 SurfaceId
-> Platform 创建隐藏容器
-> JS 收到 SurfaceContext 并创建首屏
-> full Mount
-> Platform Present
-> Core 原子提交 NavigationStack
-> onHide / onShow
```

失败时销毁未提交目标，原页面和页面栈保持不变。V1 支持 Root、Push、Back、参数和生命周期；不支持任意层级删除、历史跳转和页面缓存复用。

`NavigationClose` 成功后才 pop 栈，并释放 JS Page VM、Runtime Tree、实例索引、Handler、NativeHandle 映射和 Pending Request。Page IR 是不可变静态定义，可以按策略释放或缓存；Runtime Tree 是页面实例内存，V1 页面关闭后释放。

## 9. 关键判断与后续

HAP 的优点是 Android 单平台链路短、落地直接；代价是 JS Framework 较重，Runtime 语义与 Android 紧耦合，下沉到跨平台 Core 成本高。

QuickApp Kit 的优点是 Core 权威、事务边界清晰、Platform Adapter 薄、适合 LVGL/RTOS 和多平台；代价是初始实现复杂度更高，必须用真实 RPK、LVGL、Android 和 Benchmark 证明事务、ID、内存和队列开销。

拥堵的第一性原因是：

```text
生产速率 > 串行执行域的消费速率
```

Bridge 同时承载业务和渲染会放大拥堵，但不是唯一原因。治理手段是减少工作量、批量提交、输入和当前帧优先、合并过期更新和背压。

后续按以下顺序推进：

1. 继续从 HAP 源码确认 Bridge 注册、模块解析、页面创建和事件回调的 Android 实现。
2. 单独还原 HAP 渲染管线、首次渲染、状态更新、View 操作和线程归属。
3. 分析 HAP 页面依赖与公共模块加载。
4. 分析 Vela 的 `libuv + Yoga + LVGL`、线程、内存、Host 映射和事件。
5. 最后将事实与 QuickApp Kit 设计逐项对照，并形成 Benchmark 场景。

交接原则：先还原 HAP/Vela 事实，再讨论 QuickApp Kit 的优化；不要在事实未确认前把 HAP 内部实现直接推断成 QuickApp Kit 设计。
