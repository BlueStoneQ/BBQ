# 快应用框架运行时

> 第一性原理：怎么从零造一个"类 RN"的跨端运行时？

---

## 一、本质问题

**怎么让 JS 代码在 Android 上渲染原生 View，而不是 WebView？**

RN 的答案：用 Bridge/JSI 连接 JS 和 Native。
快应用框架的答案：用 V8 + J2V8 同步 Bridge 连接 JS 和 Native。

两者思路相同，实现路径不同。

---

## 二、与 RN 的本质区别

| 维度 | React Native | 快应用框架 |
|------|-------------|-----------|
| 定位 | 通用跨端框架 | 系统级应用运行时（预装在 ROM 中） |
| JS 引擎 | Hermes（Meta 自研） | V8（Google） |
| Bridge | JSI（C++ 层） | J2V8（Java 层，同步调用） |
| 渲染 | Native View（通过 Fabric） | Native View（自研渲染引擎） |
| 布局 | Yoga（C++ Flexbox） | 自研 Flexbox 引擎 |
| 分发 | App Store 下载 | ROM 预装 + 系统升级 |
| 包体约束 | 相对宽松 | 极度敏感（预装占系统空间） |
| 启动约束 | 秒级可接受 | 毫秒级要求（系统级体验） |

**核心差异**：快应用框架是**系统级**的，预装在 ROM 里，对包体和启动性能的要求比普通 App 严苛得多。

---

## 三、三线程模型

```
┌─────────────────┐
│   JS Thread     │  ← 业务逻辑、组件树 diff
│   (V8 Engine)   │
└────────┬────────┘
         │ J2V8 同步调用
         ↓
┌─────────────────┐
│  Bridge Thread  │  ← 指令转换、调度
│  (Java/J2V8)    │
└────────┬────────┘
         │ Handler/Message
         ↓
┌─────────────────┐
│   UI Thread     │  ← 原生 View 创建/更新/布局/绘制
│  (Android Main) │
└─────────────────┘
```

### 为什么是三线程？

- **JS Thread**：运行 V8，执行业务 JS 代码，计算 Virtual DOM diff
- **Bridge Thread**：J2V8 所在线程，负责 JS 和 Native 之间的指令转换
- **UI Thread**：Android 主线程，负责实际的 View 操作

### 为什么不是两线程（像 RN 旧架构）？

RN 旧架构的 Shadow Thread 做布局计算。快应用框架把布局计算放在 JS Thread（JS 侧实现 Flexbox），Bridge Thread 只做指令转发，职责更清晰。

---

## 四、J2V8 同步 Bridge

### 4.1 什么是 J2V8

J2V8 = Java Bindings for V8。让 Java 代码可以直接调用 V8 引擎，也让 V8 中的 JS 可以直接调用 Java 方法。

### 4.2 为什么选 J2V8 而不是标准 JNI

| 维度 | 纯 JNI | J2V8 |
|------|--------|------|
| 开发效率 | 低（手写 C++ 胶水代码） | 高（Java 直接绑定） |
| 调用方式 | 异步为主 | **同步调用** |
| 类型映射 | 手动转换 | 自动映射（JS Object ↔ Java Object） |
| 维护成本 | 高 | 中 |

### 4.3 同步 Bridge 的优势

**对比 RN 旧架构的异步 Bridge：**

```
RN 旧架构：
JS: "创建一个 View" → 序列化JSON → 放入队列 → 等待 → Native 处理
                                    ↑ 延迟在这里

快应用框架：
JS: "创建一个 View" → J2V8 同步调用 → Native 立即处理 → 返回结果
                      ↑ 没有延迟
```

- **无序列化开销**：不需要 JSON 序列化/反序列化
- **同步返回**：JS 调用 Native 方法后立即拿到返回值
- **手势跟手性好**：触摸事件 → JS 处理 → 立即更新 UI，无异步延迟

### 4.4 与 RN 新架构 JSI 的对比

| 维度 | JSI（RN 新架构） | J2V8（快应用框架） |
|------|-----------------|-------------------|
| 实现语言 | C++ | Java |
| 同步调用 | ✅ | ✅ |
| 性能 | 更高（C++ 无 GC） | 略低（Java GC） |
| 开发效率 | 低（C++ 复杂） | 高（Java 生态） |
| 跨平台 | iOS + Android | Android only |

**本质相同**：都是为了解决异步 Bridge 的性能瓶颈，实现 JS 和 Native 的同步通信。

---

## 五、渲染引擎

### 5.1 渲染流程

```
JS 组件树变化
  → Virtual DOM Diff（JS Thread）
  → 生成渲染指令（createElement / updateProps / removeChild）
  → J2V8 同步调用传递指令（Bridge Thread）
  → Android View 操作（UI Thread）
  → 布局（Measure → Layout → Draw）
```

### 5.2 与 WebView 的区别

| 维度 | WebView | 快应用框架 |
|------|---------|-----------|
| 渲染 | HTML → DOM → 浏览器渲染 | JS → Native View → Android 渲染 |
| 性能 | 受浏览器限制 | 原生性能 |
| 体验 | Web 感（滚动/动画差） | 原生感 |
| 能力 | 受限于 Web API | 可调用任何 Native API |
| 包体 | 需要 WebView 内核 | 不需要 |

### 5.3 组件映射

```
JS 组件          →    Android Native View
─────────────────────────────────────────
<div>            →    FrameLayout / LinearLayout
<text>           →    TextView
<image>          →    ImageView
<scroll-view>    →    ScrollView / RecyclerView
<input>          →    EditText
<canvas>         →    SurfaceView + Canvas
```

---

## 六、性能优化手段

### 6.1 包体优化（153MB → ~60MB）

- **模块裁剪**：反射解耦编译依赖，按需加载模块
- **条件编译**：AOT 裁剪不需要的平台代码
- **R8 混淆**：代码压缩 + 无用代码移除
- **资源压缩**：图片/字体/配置文件压缩

### 6.2 启动内存优化（PSS 41MB → 35.8MB）

- **DEX 布局优化**：热代码前置，减少 page fault
- **懒加载**：非核心模块延迟初始化
- **对象池**：复用频繁创建的对象

### 6.3 渲染性能

- **View 复用**：类似 RecyclerView 的复用机制
- **批量更新**：合并多次 DOM diff 为一次 Native 操作
- **异步布局**：非首屏内容异步计算布局

---

## 七、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| V8 | Google 的 JS 引擎（Chrome 用的），性能强但体积大 |
| J2V8 | V8 的 Java 绑定，让 Java 和 JS 可以同步互调 |
| 三线程模型 | JS Thread + Bridge Thread + UI Thread，职责分离 |
| 同步 Bridge | JS 调 Native 立即返回结果，无异步等待 |
| Native View 渲染 | JS 驱动创建真正的 Android View，不是 WebView |
| 渲染指令 | JS diff 后生成的操作指令（create/update/remove） |
| 模块裁剪 | 按需移除不需要的功能模块，减小包体 |
