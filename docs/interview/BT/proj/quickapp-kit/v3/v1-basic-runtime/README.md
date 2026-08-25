# V1 Basic Runtime Phase 2

## 目录

- [1. 定位](#1-定位)
- [2. 当前波次](#2-当前波次)
- [3. 后续波次](#3-后续波次)
- [4. Agent 规则](#4-agent-规则)
- [5. LVGL 实施路线](#5-lvgl-实施路线)

## 1. 定位

本目录的“Phase 2”指**最小主链之后的 V1 基础能力补齐阶段**，不是 Product V2。

目标不是一次完成全部 V1，而是用短垂直切片把基础能力逐步变成可运行、可观察、可回收的产品能力。
当前入口是 `M1-Spine` 已通过之后；因此已经由 M1 验证的首屏、事件、路由、增量更新、返回和销毁不再重复实现。

```text
M1-Spine
  -> Phase 2/B1 CASE-002 完整状态/条件/Keyed 语义
  -> B2 BLOCK-001
  -> B3 基础组件与样式
  -> M1-S3 Capability
  -> B4 Android/iOS 同 Fixture 复用
  -> B5 基础 Benchmark
```

## 2. 当前波次

当前只授权 `B1 CASE-002`。其中 state -> Binding -> RenderTransaction -> Mount 的最小链路已由 M1-S3.5 验证；本轮重点是把 `if`、keyed `for` 和身份保持接到同一条已验证链路上：

```text
state
-> Binding/Dirty
-> microtask flush
-> RenderTransaction
-> Core staged commit
-> incremental Mount
-> LVGL/SDL visible result
```

当前主验收平台是 LVGL/SDL。Android、iOS、Benchmark 暂不修改。

B1 必须证明：

1. 已有 `count: 0 -> 1` 增量更新证据保持通过。
2. `if` 条件节点被移除并正确清理。
3. keyed list `[A,B] -> [B,A]`。
4. A/B 的 BlockInstanceId、NodeId、HandlerId、NativeHandle 保持。
5. 不使用 Remove + Instantiate 替代 Move。
6. 一次同步状态更新只产生一个 RenderTransaction。
7. LVGL 可见结果、Trace 和资源归零证据成立。

## 3. 后续波次

| 波次 | 目标 | 当前状态 |
|---|---|---|
| M1-S3 | 核心 Feature：router/prompt/device/title/meta | `CODE_ALLOWED` |
| B1 | CASE-002：完成 if/keyed 与增量身份保持 | `FUNCTIONALLY_VERIFIED` |
| B2 | BLOCK-001：add/remove/Handler/Node cleanup | `FUNCTIONALLY_VERIFIED` |
| B3 | Image/Input/基础样式补齐 | `LVGL_FOUNDATION_VERIFIED` |
| B4 | Android/iOS 使用同一 Fixture 复用验收 | `HOLD_B3` |
| B5 | 三平台基础 Benchmark | `HOLD_B4` |

一个波次通过后，由总架构检查，再显式放行下一波次。

快速实施规则：Phase 2 的波次门禁以真实 RPK 可运行、用户可见结果、核心事务结果和资源清理为准。已有运行输出能够证明的身份保持、操作类型和错误结果，不再要求为了放行下一波次新增专用观测代码或反复补快照。详细身份矩阵、故障注入和完整观测证据统一放入 V1 Hardening，不阻塞基础能力连续实现。

## 4. Agent 规则

使用一个长期 Integration Agent 保持跨项目连续性，但每次只授权一个波次。

Agent 可以在同一波次内修改共享链路所需的 Core、JS、Examples 和 LVGL；Toolkit 只有在当前 Artifact 无法表达目标语义时才修改。

禁止同时修改 Android、iOS 和 Benchmark，禁止私改公共 Contract。

## 5. LVGL 实施路线

本目录唯一的 LVGL 实施事实源是 [`LVGL-IMPLEMENTATION-ROADMAP.md`](./LVGL-IMPLEMENTATION-ROADMAP.md)。先完成 Core Track，形成第一个基本可用 LVGL 快应用，再进入外围能力和 Android/iOS 复用；Agent 的阶段、优先级、验收和连续执行合同均以该文件为准。
