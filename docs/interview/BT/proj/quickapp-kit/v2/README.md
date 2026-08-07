# QuickApp Kit v2

## 目录

- [1. 结论](#1-结论)
- [2. 产品矩阵](#2-产品矩阵)
- [3. 目录结构](#3-目录结构)
- [4. 阅读入口](#4-阅读入口)

## 1. 结论

QuickApp Kit v2 is a platform-oriented quick app runtime solution for mobile OS and embedded devices.

Core idea:

```text
One Runtime Core
Multiple Render Backends
TurboModule-like Capability System
Observable Benchmark
```

## 2. 产品矩阵

| Project | Role |
|---|---|
| quickapp-runtime-core | Shared C++ runtime core: package, lifecycle, VNode, diff, layout, render mutation, event, capability bridge |
| quickapp-runtime-js | JS framework: `$app_define$`, `$app_bootstrap$`, `$app_require$`, VM model |
| quickapp-runtime-android | Android runtime backend and NDK embedder |
| quickapp-runtime-ios | iOS runtime backend and embedder |
| quickapp-runtime-lvgl | LVGL runtime backend for embedded devices |
| quickapp-toolkit | CLI, RPK build, validation, developer workflow |
| quickapp-examples | Sample quick apps and RPK inputs |
| quickapp-benchmark | Observable benchmark suite and framework comparison |

## 3. 目录结构

```text
v2/
├── REQUIREMENTS.md  Overall requirements and execution model
├── DOC-WRITING-RULES.md  Document writing rules
├── contracts/    Runtime contracts and extension protocols
├── decisions/    Architecture decision records
├── research/     RN, Lynx, Flutter, QuickApp architecture research
├── benchmarks/   Benchmark design and metrics
└── projects/     Per-project scope and milestones
```

## 4. 阅读入口

- [REQUIREMENTS.md](./REQUIREMENTS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DOC-WRITING-RULES.md](./DOC-WRITING-RULES.md)
