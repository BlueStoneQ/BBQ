# Feature 插件化架构

> 系统能力是怎么暴露给 JS 的？

## 目录

- [一、核心问题](#一核心问题)
- [二、设计本质](#二设计本质)
- [三、三层分发架构](#三三层分发架构)
- [四、Feature 生命周期](#四feature-生命周期)
- [五、插件化扩展机制](#五插件化扩展机制)
- [六、Android 知识映射](#六android-知识映射)

---

## 一、核心问题

| 问题 | 本质 |
|------|------|
| 几十个系统 API 怎么组织？ | 模块化 + 注册表 |
| 怎么支持第三方扩展？ | 插件化（ClassLoader 动态加载） |
| 权限怎么管理？ | 拦截器模式（调用前检查） |
| 同步/异步怎么选择？ | 由 Feature 元数据声明 |

## 二、设计本质

**场景**：开发者写 `system.device.getInfo()`，框架需要：
1. 找到 `system.device` 对应的 Java 类（`Device.java`）
2. 找到 `getInfo` 对应的方法
3. 检查权限
4. 执行并回调结果

**本质是一个 RPC 框架**：JS 侧是 client，Native 侧是 server，Bridge 是传输层。

## 三、三层分发架构

```
ExtensionManager（路由层）
    │  查找 Feature → 权限检查 → 模式判断
    ▼
AbstractExtension（模板方法层）
    │  invoke() → invokeInner()（子类实现）
    ▼
Device / Fetch / Storage ...（具体实现层）
    │  getInfo() / request() / get() ...
    ▼
Callback → ExtensionManager.callback() → JS 回调
```

### 三种 Bridge

| Bridge | 管理的扩展类型 | 来源 |
|--------|--------------|------|
| FeatureBridge | 系统 API（device/fetch/storage） | quickapp 核心 + vendor 插件 |
| ModuleBridge | 框架模块（router/page） | quickapp 核心 |
| WidgetBridge | UI 组件方法（animate/getBoundingRect） | quickapp 核心 |

查找顺序：FeatureBridge → ModuleBridge → WidgetBridge

### 三种调用模式

| 模式 | 行为 | 适用场景 |
|------|------|---------|
| SYNC | JS 线程同步执行，直接返回结果 | 纯计算（如 getInfo） |
| ASYNC | IO 线程异步执行，通过回调返回 | 耗时操作（如网络请求） |
| CALLBACK | 异步执行，支持多次回调 | 持续监听（如 GPS 定位） |

## 四、Feature 生命周期

```
ClassLoader.loadClass() → newInstance()  // 懒加载，首次调用时创建
    │
    ▼
FeatureExtension.setParams()  // 配置参数（manifest 中声明的）
    │
    ▼
invoke() → invokeInner()  // 每次调用
    │
    ▼
dispose()  // 页面销毁时清理资源
```

**懒加载设计**：Feature 不是启动时全部创建，而是第一次被调用时才实例化（`ExtensionBridge.getExtension()` 内部 `putIfAbsent`）。60+ 个 Feature，大部分用户只会用到几个。

## 五、插件化扩展机制

### 注册方式

通过 `@ExtensionAnnotation` 注解 + APT 生成 `MetaDataSet`：

```java
@ExtensionAnnotation(
    name = "system.device",
    actions = { "getInfo", "getId", "getCpuInfo" }
)
public class Device extends FeatureExtension { ... }
```

编译时生成注册表，运行时通过名字查找类名，再通过 ClassLoader 加载。

### 三仓库的插件分层

```
quickapp/features/     → 标准 Feature（device/fetch/storage/...）
vendor/plugins/        → 厂商 Feature（account/pay/push/ad/...）
vendor/platform/overlay/ → 厂商覆盖（替换标准实现）
```

**overlay 机制**：如果厂商需要修改标准 Feature 的行为（比如剪贴板加安全检查），不修改 quickapp 源码，而是在 overlay 层提供同名实现覆盖。

## 六、Android 知识映射

| 框架概念 | Android 知识点 |
|----------|---------------|
| ExtensionBridge | ClassLoader 动态加载 |
| MetaDataSet | APT 注解处理器 |
| 权限检查 | Runtime Permission |
| 异步执行 | Executor 线程池 |
| Callback 机制 | 观察者模式 |
| overlay | 类比 Android 的 resource overlay |

---

## 待深入（后续填充）

- [ ] 一个完整 Feature 的实现示例（从注解到调用）
- [ ] 权限模型设计（manifest 声明 + 运行时弹窗）
- [ ] Feature 拦截器（ExtensionInterceptProvider）的应用场景
- [ ] 与 Android Service 的对比（Feature vs Bound Service）
