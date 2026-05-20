# 快应用框架布局方案与核心架构

## 一、布局方案：Yoga（Facebook Flexbox 引擎）

### 结论

快应用框架的布局方案使用的是 **Facebook Yoga**，不是自研的 Flex 布局引擎。

### 依赖版本

| 模块 | Yoga 版本 | 说明 |
|------|-----------|------|
| 主框架（runtime） | `com.facebook.yoga:yoga:1.5.0-16kb` | 定制的 16KB 页面对齐版本 |
| 卡片模块（card） | `com.facebook.yoga:yoga:2.0.1` | 自定义版本 |

### 核心实现类

```
YogaLayout.java（布局基类）
  └── PercentFlexboxLayout.java（快应用容器组件的 View）
```

### 工作原理

1. **每个 View 对应一个 YogaNode**：`YogaLayout` 内部维护 `Map<View, YogaNode>` 映射
2. **叶子节点测量回调**：通过 `YogaMeasureFunction` 将 Yoga 的测量请求转发给 Android View 的 `measure()`
3. **布局计算**：调用 `yogaNode.calculateLayout()` 由 Yoga 引擎完成 Flexbox 计算
4. **结果应用**：`applyLayoutRecursive()` 递归遍历 YogaNode 树，将计算结果（x, y, width, height）应用到 Android View

### 关键代码片段

```java
// YogaLayout.java — 布局计算入口
protected void createLayout(int widthMeasureSpec, int heightMeasureSpec) {
    final int widthSize = MeasureSpec.getSize(widthMeasureSpec);
    final int heightSize = MeasureSpec.getSize(heightMeasureSpec);
    
    if (heightMode == MeasureSpec.EXACTLY) mYogaNode.setHeight(heightSize);
    if (widthMode == MeasureSpec.EXACTLY) mYogaNode.setWidth(widthSize);
    
    // Yoga 引擎计算布局
    mYogaNode.calculateLayout(YogaConstants.UNDEFINED, YogaConstants.UNDEFINED);
}

// YogaLayout.java — 递归应用布局结果到 View 树
protected void applyLayoutRecursive(YogaNode node, float xOffset, float yOffset) {
    View view = (View) node.getData();
    if (view != null && view != this) {
        view.layout(
            Math.round(xOffset + node.getLayoutX()),
            Math.round(yOffset + node.getLayoutY()),
            Math.round(xOffset + node.getLayoutX() + node.getLayoutWidth()),
            Math.round(yOffset + node.getLayoutY() + node.getLayoutHeight()));
    }
    // 递归子节点...
}
```

### 默认 Flex 属性

```java
// PercentFlexboxLayout.java — 容器默认值
getYogaNode().setFlexDirection(YogaFlexDirection.ROW);  // 默认横向排列
getYogaNode().setFlexShrink(1f);                        // 默认可收缩
```

### 与 React Native 的对比

| 维度 | 快应用 | React Native |
|------|--------|-------------|
| 布局引擎 | Yoga 1.5.0（定制版） | Yoga（最新版） |
| 桥接方式 | Java YogaNode API | C++ 直接调用 |
| View 层 | Android ViewGroup + YogaLayout | Android ViewGroup + ReactShadowNode |
| 默认方向 | ROW（横向） | COLUMN（纵向） |

---

## 二、框架整体架构

### 架构全景

```
┌─────────────────────────────────────────────────────────┐
│                    快应用（rpk 包）                        │
│              开发者用 HTML/CSS/JS 编写                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  DSL 层      │  │  JS 引擎层    │  │  游戏引擎层    │  │
│  │  Vue / XVM   │  │  V8 Runtime  │  │  Cocos/Unity  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                  │           │
│  ┌──────┴─────────────────┴──────────────────┴────────┐  │
│  │              JS Bridge（Native ↔ JS）               │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────┴─────────────────────────────┐  │
│  │              Android Native 层                      │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐            │  │
│  │  │ Runtime │ │ Features │ │  Widgets  │            │  │
│  │  │ 渲染引擎 │ │ 系统API  │ │  原生组件  │            │  │
│  │  └─────────┘ └──────────┘ └───────────┘            │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              App Shell（com.miui.hybrid）            │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   Android 系统 (MIUI)                    │
└─────────────────────────────────────────────────────────┘
```

### 核心仓库

| 仓库 | 路径 | 职责 |
|------|------|------|
| quickapp | `packages/quickapp` | 框架内核（标准实现，不含小米定制） |
| vendor/framework | `packages/vendor/framework` | 游戏运行时 JS |
| vendor/platform/android | `packages/vendor/platform/android` | 主工程（编译入口，组装 APK） |
| vendor/plugins/android | `packages/vendor/plugins/android` | 小米服务插件（账号/支付/推送/广告） |

---

## 三、渲染流链路

### 三级管线

```
编译时模板（.ux → JSON 模板树）
    → 运行时虚拟 DOM（JS 层 infras.js）
    → Native View（Android 原生组件）
```

### 关键流程

1. **编译时**：hap-toolkit 将 `.ux` 文件编译为 `$app_template$`（JSON 模板树）+ `$app_style$` + `$app_script$`，打包为 rpk
2. **JS 层**：infras.js 根据模板构建虚拟 DOM，DOM 变更通过 Listener 封装为 Action，由 Streamer 批量（阈值 50 条）通过 `callNative` 发送给 Native
3. **Native 层**：RenderActionParser 解析 JSON → VDomActionApplier 应用到 View 树 → ComponentFactory 创建对应 Widget

### 渲染性能设计

| 优化点 | 实现 |
|--------|------|
| Action 批量发送 | Streamer 以 50 条为阈值批量发送，减少 Bridge 调用次数 |
| 异步 JSON 解析 | RenderWorker 在 IO 线程池解析 JSON，不阻塞 UI 线程 |
| 编译时模板优化 | 模板在编译时已转为 JSON，运行时无需解析 HTML |
| 组件注册表 | `@WidgetAnnotation` 编译时代码生成，tagName → Widget 类的 O(1) 查找 |

---

## 四、JS ↔ Native 通信机制

### 方案：V8 引擎直接绑定（JSI 思路）

快应用嵌入 J2V8（V8 的 Java 绑定），不依赖 WebView，JS 代码运行在独立 V8 实例中。

### 双通道设计

| 通道 | 全局函数 | 用途 |
|------|---------|------|
| Feature 调用 | `JsBridge.invoke(feature, action, params, cbId)` | 系统 API 调用 |
| 渲染操作 | `callNative(pageId, actionsJson)` | DOM 变更指令 |

### 回调 ID 机制

```
JS 侧：
  device.getInfo({ success, fail, complete })
  → 生成 callbackId，存入 _callbacks[cbId]
  → 只传 cbId（数字）给 Native

Native 侧：
  Device.java 收集设备信息
  → 带着 cbId + 结果数据回传 JS

JS 侧：
  execInvokeCallback(event)
  → 根据 cbId 找到回调函数
  → 根据 code 分发到 success/fail/complete
```

### 线程模型

```
JS 线程（JsThread）
  └── V8 引擎实例，执行所有 JS 代码
  └── JS→Native 同步调用
  └── Native→JS 通过 Handler 异步投递

主线程（UI Thread）
  └── View 创建和渲染
  └── 事件采集 → postFireEvent → JS 线程

IO 线程池
  └── RenderWorker：解析渲染 JSON
  └── AsyncInvocation：异步 Feature 执行
```

---

## 五、RPK 包加载流程

```
用户点击快应用
  → 缓存检查（FilePackageInstaller）
  → 签名校验（SignatureVerifier）
  → 解压到私有目录（ZipExtractor）
  → 解析 manifest.json → AppInfo
  → 创建 JS 运行环境（V8 + infras.js）
  → 执行 app.js（$app_bootstrap$）
  → 加载页面 JS → 构建虚拟 DOM → Bridge → Native View
```

---

## 六、技术栈总结

| 层次 | 技术 |
|------|------|
| JS 框架层 | JavaScript + Rollup（DSL 解析、虚拟 DOM、样式计算） |
| 布局引擎 | Facebook Yoga 1.5.0（Flexbox 计算） |
| JS 引擎 | V8（通过 J2V8 绑定） |
| Native 层 | Java/Kotlin + Gradle（渲染引擎、系统 API、原生组件） |
| 构建系统 | Gradle 8.10 + AGP 8.8 + npm |
| 版本管理 | Repo + Gerrit |

---

## 七、面试要点

### 布局方案相关

- Q: 快应用的布局方案是什么？
- A: 使用 Facebook Yoga 引擎做 Flexbox 布局计算。每个 Android View 对应一个 YogaNode，Yoga 负责计算位置和尺寸，结果递归应用到 View 树。和 React Native 思路一致，只是 RN 默认 column 方向，快应用默认 row 方向。

### 渲染流相关

- Q: 从开发者写的模板到屏幕显示经历了什么？
- A: 三级管线——编译时 .ux → JSON 模板树；运行时 JS 层构建虚拟 DOM，变更封装为 Action 批量发送；Native 层解析 Action 创建 Android View。关键优化是 Action 批量发送（50 条阈值）和异步 JSON 解析（IO 线程池）。

### Bridge 相关

- Q: JS 和 Native 怎么通信的？
- A: V8 引擎直接绑定（JSI 思路），不走 WebView。Feature 调用通过回调 ID 机制——JS 侧存回调函数，只传数字 ID 给 Native，Native 完成后带 ID 回传触发回调。双通道设计：Feature 调用和渲染操作走不同通道互不干扰。
