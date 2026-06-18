# XRN Native Shell 设计

> Native Shell = App 中承载 RN 页面的 Native 基座。负责 Bundle 加载、页面容器、路由、稳定性保障。

---

## 目录

- [Shell 职责全景](#shell-职责全景)
- [一、加载容器](#一加载容器)
- [二、路由](#二路由)
- [三、Bundle 文件管理](#三bundle-文件管理)
- [四、稳定性保障（CrashGuard）](#四稳定性保障crashguard)
- [五、热更新接口](#五热更新接口)
- [六、内存管理](#六内存管理)
- [七、预加载策略](#七预加载策略)
- [八、跨模块通信](#八跨模块通信)

---

## Shell 职责全景

```
XRN Native Shell
├── ① 加载容器     ReactInstance 实例池 + Bundle 加载 + ReactRootView 组装
├── ② 路由         两段式 URL + 跨模块 Native 路由 + 模块内 JS 路由
├── ③ Bundle 管理  builtin/hot 目录 + manifest + 版本切换 + 路径解析
├── ④ CrashGuard   崩溃计数 + 自动回退 + 白屏检测
├── ⑤ 热更新接口   TurboModule 暴露 installBundle / reload / getManifest
├── ⑥ 内存管理     实例池 autoScale + shrink + 泄漏检测
├── ⑦ 预加载策略   preload / idle / on-demand / conditional
└── ⑧ 跨模块通信   Native EventBus 中转（实例间 JS Context 隔离）
```

---

## 一、加载容器

**核心问题**：如何用 RN + Android 原生 API 组装一个能运行 Bundle 的容器？

→ 详见 [bundle-runtime.md](./bundle-runtime.md)

**要点**：
- 三个时间点：Application.onCreate（ReactHost） → Activity.onCreate（实例 + Bundle + RootView） → Activity.onDestroy（释放）
- 核心部件：ReactHost / ReactInstance / ReactRootView / AppRegistry
- 多 Activity vs 单 Activity 的 trade-off（混合 App 选多 Activity）

---

## 二、路由

**核心问题**：多 Bundle 架构下，React Navigation 跨不了模块，XRN 的路由怎么做？

→ 详见 [route.md](./route.md)

**要点**：
- 混合模式：跨模块走 Native 路由（Intent），模块内走 React Navigation
- XRN 封装统一 Router API，业务层无感知
- 两段式 URL：`xrn://bundleId/pageName?params`
- 与 CRN 方案一致

---

## 三、Bundle 文件管理

**核心问题**：多版本 Bundle 怎么存、怎么找、怎么切换？

→ 详见 [qa.md — Native 壳多 Bundle 文件管理](./qa.md#native-壳多-bundle-文件管理)

**要点**：
- 目录结构：`builtin/`（只读，随包） + `hot/`（可写，热更新下载）
- manifest.json：记录每个 bundle 的 activeVersion / source / builtinVersion
- 路径解析优先级：hot > builtin
- 版本清理：保留最近 N 个版本，自动清理旧版本

---

## 四、稳定性保障（CrashGuard）

**核心问题**：热更新后崩溃了怎么办？

→ 详见 [qa.md — CrashGuard 设计与实现](./qa.md#热更新后-crash白屏处理crashguard)

**要点**：
- 三层防线：客户端 CrashGuard → 白屏降级 → 服务端停灰度
- 崩溃计数器：启动 +1，稳定运行 5s 清零，连续 2 次触发回退
- 白屏检测：ReactMarker 超时 + View 树检测双重保障
- 回退策略：清空 hot/ → 重置 manifest → 使用 builtin 版本

---

## 五、热更新接口

**核心问题**：Shell 需要暴露什么接口给 @x-rn/updater（JS 层）？

**TurboModule 接口**：

```typescript
interface XRNUpdaterNativeModule {
  getManifest(): Promise<BundleManifest>
  installBundle(bundleId: string, version: string, filePath: string): Promise<boolean>
  reload(immediate?: boolean): void
  reportCrash(): void
  getBundlePath(bundleId: string): Promise<string>
  isModuleLoaded(moduleId: string): boolean
}
```

**数据流**：
```
@x-rn/updater (JS)  →  TurboModule  →  Native Shell
检查更新 / 下载           接口层          文件管理 / manifest 更新
```

---

## 六、内存管理

**核心问题**：多实例架构下如何控制内存？

**实例池 autoScale 策略**：

| 设备内存 | poolSize | maxInstances |
|---------|----------|-------------|
| ≥ 6GB | 3 | 5 |
| 4-6GB | 2 | 4 |
| 2-4GB | 1 | 3 |
| < 2GB | 0（不预热） | 2 |

**内存压力响应**：
- 系统 `onTrimMemory` 回调 → 调用 `instancePool.shrink()` → 释放所有 IDLE 实例
- 压力恢复后 → 重新预热

**泄漏检测**：
- IN_USE 超过 10 分钟 → 判定泄漏 → 强制回收

---

## 七、预加载策略

**核心问题**：多个 business bundle 什么时候加载？

| 策略 | 触发时机 | 实现 | 适用模块 |
|------|---------|------|---------|
| `preload` | common 加载完立即 | 异步并行加载 | 首页、搜索 |
| `idle` | 主线程空闲 | IdleHandler（Android）/ RunLoop idle（iOS） | 次高频模块 |
| `on-demand` | 用户打开时 | 显示 loading → 加载 → 渲染 | 低频模块 |
| `conditional` | 用户行为触发 | 事件驱动预加载 | 预测性加载 |

**配置方式**（xrn.config.ts）：
```typescript
modules: {
  home: { loadStrategy: 'preload' },
  search: { loadStrategy: 'preload' },
  profile: { loadStrategy: 'idle' },
  settings: { loadStrategy: 'on-demand' },
  order: { loadStrategy: 'conditional', trigger: 'cart_viewed' }
}
```

---

## 八、跨模块通信

**核心问题**：不同 ReactInstance 之间 JS Context 隔离，怎么通信？

**方案：Native EventBus 中转**

```
Page A (Instance 1)          Native EventBus           Page B (Instance 2)
     │                           │                        │
     │  NativeModule.emit(       │                        │
     │    'cart_updated',        │                        │
     │    {count: 3})            │                        │
     │ ─────────────────────────▶│                        │
     │                           │───────────────────────▶│
     │                           │   NativeModule.on(     │
     │                           │    'cart_updated', cb)  │
```

**实现要点**：
- JS 层通过 TurboModule 调用 Native 的 EventBus
- Native 层维护事件订阅表，广播给所有注册了该事件的 Instance
- 序列化：事件数据经过 JSI / JSON 序列化传递
