# RN → CRN → 快应用框架 → Android 原生：系统认知

> 一条从上层框架到底层原生的纵深线。每一层都能讲清楚"是什么、为什么、怎么做"。

---

## 目录

- [全景图](#全景图)
- [核心认知](#核心认知)
- [索引（子文件）](#索引)
  - [rn-architecture.md](./rn-architecture.md) — RN 架构原理（旧 Bridge vs 新 JSI/Fabric/TurboModules）
  - [crn-enterprise.md](./crn-enterprise.md) — CRN 企业级定制（分 bundle/热更新/容器化）
  - [quickapp-runtime.md](./quickapp-runtime.md) — 快应用框架运行时（三线程/J2V8 Bridge/渲染引擎）
  - [android-native.md](./android-native.md) — Android 底层（V8 嵌入/JNI/NDK/DEX/R8）
- [常见追问串联](#常见追问串联)

---

## 全景图

```
┌─────────────────────────────────────────────────────────┐
│  React Native 标准架构                                    │
│  JS Thread ←→ Bridge/JSI ←→ Native Thread               │
│  旧架构(Bridge) vs 新架构(JSI/Fabric/TurboModules)       │
├─────────────────────────────────────────────────────────┤
│  CRN 企业级定制                                           │
│  分 Bundle / 热更新 / 性能监控 / 容器化                    │
│  在标准 RN 上做工程化增强                                  │
├─────────────────────────────────────────────────────────┤
│  快应用框架（类 RN 自研运行时）                            │
│  三线程模型 / V8+J2V8 同步 Bridge / Native View 渲染      │
│  比 RN 更底层：自己实现了 Bridge 和渲染引擎               │
├─────────────────────────────────────────────────────────┤
│  Android 原生底层                                         │
│  V8 嵌入 / JNI 通信 / NDK / DEX 布局 / R8 混淆          │
│  框架运行的基石                                           │
└─────────────────────────────────────────────────────────┘
```

## 核心认知

**从上到下，抽象层级递减，控制力递增：**

| 层 | 你的角色 | 类比 |
|---|---|---|
| RN | 使用者 + 深度定制者 | 开车 |
| CRN | 改装者（在 RN 上做企业级增强） | 改装车 |
| 快应用框架 | 造车者（自研类 RN 运行时） | 造车 |
| Android 原生 | 发动机工程师（底层引擎） | 造发动机 |

**这条线的价值**：大部分 RN 开发者停留在第一层（用 RN 写业务），少数到第二层（做工程化），极少数能到第三四层（造框架/改底层）。你四层都有实战。

---

## 索引

| 文件 | 内容 |
|------|------|
| [rn-architecture.md](./rn-architecture.md) | RN 架构原理（旧 Bridge vs 新 JSI/Fabric/TurboModules） |
| [crn-enterprise.md](./crn-enterprise.md) | CRN 企业级定制（分 bundle/热更新/容器化） |
| [quickapp-runtime.md](./quickapp-runtime.md) | 快应用框架运行时（三线程/J2V8 Bridge/渲染引擎） |
| [android-native.md](./android-native.md) | Android 底层（V8 嵌入/JNI/NDK/DEX/R8） |

---

## 常见追问串联

**Q: 你对 RN 架构的理解？**
→ 从标准 RN 架构讲起 → 引出 CRN 的企业级增强 → 引出快应用框架"我们自己造了一个类似的" → 引出底层 Android 原生实现

**Q: RN 的 Bridge 有什么问题？新架构怎么解决的？**
→ rn-architecture.md

**Q: 你们的热更新方案是怎么做的？**
→ crn-enterprise.md

**Q: 快应用框架和 RN 的区别？**
→ quickapp-runtime.md + 对比 rn-architecture.md

**Q: 你做的性能优化，底层原理是什么？**
→ android-native.md（DEX 布局/R8/内存）
