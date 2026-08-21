# LV-S04 Tasks

## 目录

- [1. 任务](#1-任务)
- [2. 证据要求](#2-证据要求)

## 1. 任务

| ID | 任务 | 状态 |
|---|---|---|
| T01 | 对齐公共 Render/Surface/Lifecycle 合同，冻结 S04 不新增消息和 ID。 | `[x]` |
| T02 | 实现 bounded `MountTransaction`、HostSlot、NodeId 映射和 simulator/embedded limits。 | `[x]` |
| T03 | 实现 View/Text/Button create、属性、layout 和 Button 私有 label。 | `[x]` |
| T04 | 实现 full create/set/insert 与 incremental prop/layout/move/remove。 | `[x]` |
| T05 | 实现 owner task admission、preflight、原子失败清理、typed Result。 | `[x]` |
| T06 | 实现显式 close、pending drain、递归销毁和资源归零断言。 | `[x]` |
| T07 | 使用真实 LVGL/SDL window 验证 Case 001 S1 的 mount/present/visible。 | `[x]` |
| T08 | 添加 public boundary scan，证明公共头不泄漏 LVGL/SDL/libuv/Core authority。 | `[x]` |
| T09 | 生成 source manifest 和 Debug/Release/ASan/UBSan/TSan/embedded-only 证据。 | `[x]` |

## 2. 证据要求

1. S04 源码摘要与可复现构建命令。
2. Debug、Release、ASan/UBSan、TSan 的 S04 合同测试结果。
3. embedded-only 构建和 SDL/libuv 依赖扫描结果。
4. full Mount、incremental Move/Remove、Present 后 visible、Mount close 后 live/pending 为零的事实。
5. 非 owner、队列满、非法操作、失败清理和资源上限结果。

