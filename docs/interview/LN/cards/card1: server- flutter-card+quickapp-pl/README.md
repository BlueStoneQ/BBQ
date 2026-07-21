# Card 1: Server-Driven UI + Flutter 卡片渲染 + 快应用平台

> 核心能力：跨平台动态渲染引擎全链路 — 协议定义 → 引擎核心 → 渲染后端 → 多端适配

---

## 核心叙事

跨平台动态渲染引擎的**完整方案设计者**：从协议定义 → 引擎核心 → 渲染后端 → 多端适配，全链路覆盖。

---

## 关键技术点

| 维度 | 内容 |
|------|------|
| 架构 | 四层分离：应用层(DSL) → 运行时(解析+响应式) → 引擎核心(C++ DOM+CSS+Layout) → 渲染后端(Flutter/LVGL/Android) |
| 引擎核心 | C++ W3C DOM 子集 + CSS 层叠继承 + Yoga Flexbox，平台无关，零 GC |
| 跨层通信 | Dart FFI 直调 C++ .so，SharedUpdateBuffer 增量帧同步 |
| 三种卡片 | JS 卡（QuickJS，类 RN 快应用）+ 轻卡（无 JS，JSON 数据驱动 + deeplink 交互）+ IoT 设备卡（纯 C++ + LVGL，手表小屏） |
| 多端覆盖 | 手机 Flutter + 手表 LVGL + Android Native |
| 快应用框架 | JS 驱动 Native View 渲染，V8 + J2V8 同步 Bridge（类 JSI） |

---

## 技术对照

| 岗位能力要求 | 切入点 |
|-------------|--------|
| JSON/XML 协议驱动动态 UI | 快应用 + 卡片框架双重实践，协议→解析→布局→渲染全链路 |
| 受限硬件渲染 | C++ 引擎 < 3MB，手表端 LVGL 受限渲染已落地 |
| 跨硬件 UI 协议规范 | 渲染后端可替换（Flutter/LVGL/Android View），引擎核心不变 |
| Skill DSL / Preview JSON | 快应用 DSL 解析 + Server-Driven UI 数据绑定经验 |

---

## TODO

- [ ] 四层架构白板画（30s 版）
- [ ] 轻卡 vs JS 卡 trade-off 一句话总结
- [ ] SharedUpdateBuffer 增量帧同步机制细节
- [ ] Dart FFI vs Platform Channel 选型理由
- [ ] 快应用包体优化故事（153MB → 60MB）
- [ ] 受限设备方案推演：为什么不用 Flutter，为什么选 C++ + Yoga
