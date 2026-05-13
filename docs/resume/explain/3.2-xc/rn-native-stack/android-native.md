# Android 原生底层

> 第一性原理：跨端框架跑在 Android 上，底层发生了什么？

---

## 一、本质问题

**JS 代码最终怎么变成屏幕上的像素？中间经过了哪些 Android 底层机制？**

这一层是框架的"发动机"，理解它才能做深度性能优化。

---

## 二、V8 嵌入

### 2.1 为什么嵌入 V8

- 快应用框架需要一个 JS 引擎来执行业务代码
- V8 是性能最强的 JS 引擎（JIT 编译）
- 通过 NDK 将 V8 编译为 .so 库，嵌入到 Android App 中

### 2.2 V8 在 Android 中的生命周期

```
App 启动
  → 加载 libv8.so（NDK）
  → 创建 V8 Isolate（独立的 V8 实例）
  → 创建 V8 Context（执行上下文）
  → 加载并执行 JS Bundle
  → JS 运行中...
  → App 退出 → 销毁 Context → 销毁 Isolate
```

### 2.3 V8 vs Hermes

| 维度 | V8 | Hermes |
|------|-----|--------|
| JIT | ✅（运行时编译，峰值性能高） | ❌（AOT 字节码，启动快） |
| 启动速度 | 较慢（需要解析+编译） | 快（预编译字节码） |
| 峰值性能 | 高 | 中 |
| 内存占用 | 较高 | 低 |
| 包体大小 | 大（~7MB .so） | 小（~3MB） |
| 适用场景 | 长时间运行、计算密集 | 移动端、启动敏感 |

**快应用框架选 V8 的原因**：系统级应用长时间运行，JIT 的峰值性能优势更重要。

---

## 三、JNI（Java Native Interface）

### 3.1 什么是 JNI

JNI 是 Java 和 C/C++ 之间的桥梁。让 Java 代码可以调用 C++ 函数，C++ 也可以回调 Java 方法。

### 3.2 在框架中的角色

```
Java 层（Android Framework / App 代码）
    ↕ JNI
C++ 层（V8 引擎 / 性能敏感逻辑）
```

### 3.3 JNI 的性能考量

| 操作 | 开销 |
|------|------|
| Java → C++ 调用 | 低（几十 ns） |
| C++ → Java 调用 | 中（需要查找方法 ID） |
| 字符串传递 | 高（UTF-16 ↔ UTF-8 转换 + 拷贝） |
| 数组传递 | 高（可能需要拷贝） |
| 对象创建 | 高（需要通过 JNI 反射） |

**优化原则**：
- 减少 JNI 调用次数（批量传递）
- 缓存方法 ID 和类引用
- 大数据用 DirectByteBuffer 避免拷贝
- 性能敏感逻辑放 C++ 侧

---

## 四、NDK（Native Development Kit）

### 4.1 什么是 NDK

NDK 让你可以在 Android App 中使用 C/C++ 代码。编译产物是 .so（共享库）。

### 4.2 在框架中的使用

- V8 引擎编译为 .so
- 性能敏感的图像处理/布局计算用 C++ 实现
- 通过 CMake/ndk-build 构建

### 4.3 .so 与包体的关系

```
libv8.so          ~7MB（V8 引擎）
libj2v8.so        ~1MB（J2V8 绑定）
libquickapp.so    ~2MB（框架核心 C++ 逻辑）
```

**包体优化手段**：
- 只保留目标 ABI（arm64-v8a，去掉 armeabi-v7a）
- strip 去除调试符号
- LTO（Link Time Optimization）
- 按需加载（dlopen 延迟加载非核心 .so）

---

## 五、DEX 与 R8

### 5.1 什么是 DEX

DEX（Dalvik Executable）是 Android 的字节码格式。Java/Kotlin 源码 → .class → .dex → ART 运行。

```
源码(.java/.kt) → javac → .class → D8/R8 → .dex → ART 执行
```

### 5.2 R8 是什么

R8 = 代码压缩 + 混淆 + 优化，合并了 ProGuard 的功能。

| 功能 | 作用 |
|------|------|
| Tree Shaking | 移除未使用的类/方法/字段 |
| 代码压缩 | 内联短方法、移除空方法 |
| 混淆 | 类名/方法名缩短（a.b.c） |
| 优化 | 常量折叠、死代码消除 |

### 5.3 DEX 布局优化（启动性能）

**问题**：App 启动时，ART 需要从 DEX 文件中加载类。如果热代码（启动路径用到的类）分散在 DEX 文件各处，会产生大量 page fault（磁盘随机读取）。

**方案**：DEX 布局优化 — 把启动路径的热代码集中排列在 DEX 文件前部。

```
优化前：
DEX 文件: [冷代码][热代码][冷代码][热代码][冷代码]
           ↑ page fault  ↑ page fault  ↑ page fault

优化后：
DEX 文件: [热代码][热代码][热代码][冷代码][冷代码]
           ↑ 顺序读取，少 page fault
```

**实现方式**：
1. 收集启动路径的类列表（Profile-Guided）
2. 在 R8/D8 编译时指定类排列顺序
3. 热代码前置到 primary DEX

**效果**：PSS MAX 41MB → 35.8MB（减少 page fault = 减少内存映射页 = 降低 PSS）

### 5.4 multidex 与包体

- 单个 DEX 文件方法数上限 65536（64K）
- 大型 App 需要多个 DEX（multidex）
- DEX 数量影响启动速度（每个 DEX 都要加载）
- **优化**：R8 Tree Shaking 减少方法数 → 减少 DEX 数量

---

## 六、Gradle 构建系统

### 6.1 在框架中的角色

```
Gradle
├── 编译 Java/Kotlin → .class
├── R8 压缩/混淆 → .dex
├── NDK 编译 C++ → .so
├── 资源处理 → resources.arsc
├── 签名 → .apk
└── 多 variant 管理（debug/release/不同渠道）
```

### 6.2 与包体优化的关系

| Gradle 配置 | 包体影响 |
|-------------|---------|
| minifyEnabled true | 开启 R8，减小 DEX |
| shrinkResources true | 移除未使用资源 |
| ndk.abiFilters | 只保留目标架构的 .so |
| proguardFiles | 混淆规则，影响 Tree Shaking 效果 |
| splits.abi | 按架构分包（不同设备下载不同 APK） |

### 6.3 consumerProguardFiles 问题

**场景**：框架作为 AAR 被宿主 App 依赖时，框架的混淆规则需要传递给宿主。

**问题**：如果 consumerProguardFiles 配置不当，宿主 R8 可能错误地移除框架需要的类（反射调用的类被 Tree Shaking 掉了）。

**解决**：
- 框架 AAR 中正确配置 consumerProguardFiles
- 对反射调用的类添加 @Keep 注解或 -keep 规则
- CI 中加入混淆后的自动化测试验证

---

## 七、模块裁剪方案

### 7.1 问题

快应用框架预装在 ROM 中，包体极度敏感。但框架有很多功能模块（地图/支付/推送/AR...），不是所有设备都需要全部模块。

### 7.2 方案：反射解耦 + metadata 控制

```
编译时：
  模块 A、B、C 独立编译为 AAR
  宿主通过 compileOnly 依赖（不打入包）

运行时：
  读取 AndroidManifest metadata → 确定当前设备需要哪些模块
  通过反射加载模块入口类
  模块不存在 → 降级方案（提示升级/功能不可用）
```

**关键设计**：
- **反射解耦编译依赖**：compileOnly + 反射，编译时不依赖，运行时按需加载
- **metadata 入口控制**：AndroidManifest 中声明模块入口类名
- **自升级兜底**：模块缺失时引导用户升级框架版本

### 7.3 效果

- 预装包 153MB → ~60MB
- DEX 44.4MB → 27MB（-39%）
- 按设备/地区配置不同的模块组合

---

## 八、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| V8 Isolate | V8 的独立实例，有自己的堆和 GC |
| JNI | Java 和 C/C++ 之间的调用接口 |
| NDK | Android 上编写和编译 C/C++ 代码的工具集 |
| .so | 共享库（C/C++ 编译产物），类似 Windows 的 .dll |
| DEX | Android 字节码格式，ART 虚拟机执行 |
| R8 | 代码压缩+混淆+优化工具（替代 ProGuard） |
| Tree Shaking | 移除未使用的代码，减小包体 |
| Page Fault | 访问未加载到内存的页面时触发磁盘读取 |
| PSS | 进程实际占用的物理内存（含按比例分摊的共享内存） |
| ABI | 应用二进制接口（arm64-v8a/armeabi-v7a/x86） |
| AAR | Android Archive，Android 库的打包格式 |
| consumerProguardFiles | AAR 中声明的混淆规则，会传递给使用者 |
| compileOnly | Gradle 依赖配置，编译时可见但不打入最终包 |
