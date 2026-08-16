# Android Runtime Spec

## 目录

- [1. 目标](#1-目标)
- [2. 总 Spec](#2-总-spec)
- [3. 状态](#3-状态)

## 1. 目标

先阅读：`../../../AGENT-WORK-BOARD.md`、`../../../spec/architecture.md` 和 `../../../spec/contracts/`。

联盟 Android 事实研究仅作为证据来源：`../../../../v2/research/alliance-android-runtime-toolkit.md`；它不是 v3 执行合同。

目标：以联盟 Android Runtime 建立行为基线，完成 Android Runtime Host、PackageSource、JNI Adapter、Platform Surface Host、Host Component、prompt/device PlatformProvider、字体 Measure Adapter、输入以及首屏/更新/路由集成；共享 RPK Loader、Core 和 JS Executor 分别来自 Core/JS Runtime 工程。

## 2. 总 Spec

- [需求](./requirements.md)
- [总体架构](./architecture.md)
- [分 Spec 索引](./subspec-index.md)
- [验收](./acceptance.md)

## 3. 状态

第五次定向复核 `PASS`；当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 AND-S01。
