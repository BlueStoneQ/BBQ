# Android Runtime Spec Agent Handoff

启动阅读：本文件、`../README.md`、`../../AGENT-WORK-BOARD.md`，以及 `projects/quickapp-runtime-android/README.md`。

目标：建立联盟 Android Runtime 的行为基线，覆盖 RPK Loader、JS 执行、Bridge、首屏、更新、事件和路由闭环。

JNI 只属于 Android Platform Adapter；不得把 Android 类型带入 Core，也不得自行改变公共协议。

交付顺序：`requirements.md` -> `arch-design.md` -> `tech-design.md` -> `tasks.md` -> `steps/`。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 事件：启动 Android Runtime Spec 并行设计。
- 意图：Android 提供联盟行为基线，不作为 Core 的平台实现模板。
