# LV-S04 Design

## 目录

- [1. 设计结论](#1-设计结论)
- [2. 边界与数据](#2-边界与数据)
- [3. 映射](#3-映射)
- [4. 事务算法](#4-事务算法)
- [5. 线程与容量](#5-线程与容量)
- [6. 关闭与失败](#6-关闭与失败)
- [7. M1-Alpha 边界](#7-m1-alpha-边界)

## 1. 设计结论

Mount Host 是一个 owner-thread Platform Adapter。Core 产生公共 `MountTransaction`，Mount Host 只把它投影到指定 Surface 的 LVGL page root；完成后返回公共语义的 typed Result。Platform 没有第二棵 Runtime Tree，因此不做新旧 Host Tree Diff。

```text
Core MountTransaction
  -> MountHost bounded admission
  -> owner task queue
  -> owner-thread preflight
  -> owner-thread LVGL commit
  -> MountResult
  -> Core decides Present/recovery
```

## 2. 边界与数据

公共消息中的 `SurfaceId`、`MountAttemptId`、`sourceId`、`revision` 原样保留用于结果关联；Platform 不解释 `sourceId` 的业务来源，也不生成 Revision。`MountHost` 内部只保存固定容量的 transaction slot、HostSlot 和只携带 slot index 的 queue task。

HostSlot 只保存 `NodeId`、组件类型、opaque native object 和可选私有 Button label。公共头文件只使用 typed IDs、数值和 bounded value；`lvgl.h` 只出现在 `.cpp` 和实际 LVGL backend/test。

## 3. 映射

`SurfaceId` 通过 S03 `SurfaceHostAdapter::withPageRootForMount` 查找本地 page root，再由 `LvglMountBackend` 取得 opaque native root。S03 仍拥有 Surface 生命周期和 root 表；S04 不复制它。

| 公共类型 | LVGL object | 额外本地资源 |
|---|---|---|
| View | `lv_obj_create(pageRoot)` | 无 |
| Text | `lv_label_create(pageRoot)` | 无 |
| Button | `lv_button_create(pageRoot)` | 一个私有 `lv_label`，用于按钮文本 |

`CreateHost` 先建立本地映射。full Mount 的第一个 Create 是 root，其余新对象先挂到 page root，再由 `InsertHostChild` 挂到 Runtime 指定父节点；incremental 的 `InsertHostChild` 只允许事务中新建且尚未挂接的节点。`MoveHost` 保留对象和后代映射，只改变 LVGL parent/index。

M1-Alpha 只实现：`text`、`enabled(Button)`、`backgroundColor`、`color`、`borderRadius`、`textAlign`，以及非负整数 logical-px 的 `SetHostLayout`。未知属性、截断文本、非法颜色和不支持的类型在预检或提交中失败。

## 4. 事务算法

Core producer 调用 `post`：检查 accepting/closed，以有界 try-critical-section 保护 slot 分配；事务槽或 owner queue 满时立即失败。成功 post 只表示已进入 owner queue，不表示已挂载或可见。

Owner task 先解析有效 page root，再检查 operation_count、sourceId、full/incremental 操作集合、NodeId 唯一性、目标存在性、创建顺序、父子关系、Move 环和文本边界。预检失败不创建 LVGL object，发出恰好一个 failed Result。

full 模式先在 owner thread 清理该 Host 的全部本地对象和映射，再按有序 operation 创建/设置/插入。incremental 按顺序执行。`RemoveHost` 递归清理 Host 子树；`MoveHost` 不创建或销毁对象。任一提交失败，清理本次 Host 状态并返回 failed；不跳过失败操作，不伪造 mounted。

成功只表示 Host object 已落地，不等价于 Present 或 Core visible。Core 必须继续走 S03 Present，成功后才提交 visible。

## 5. 线程与容量

LVGL、S03 root、HostSlot 表、transaction slot 和 ResultSink 的调用均归属同一个 owner thread。Producer 只能提交 typed transaction，不能读取或触碰 LVGL object。`service(owner,budget)` 只 pump 有界 task 数；没有无界 spin、无界等待或动态扩容。

| Profile | transactions | Host objects | operations/transaction |
|---|---:|---:|---:|
| `lvgl-simulator-dev` | 16 | 512 | 64 |
| `lvgl-embedded-min` | 4 | 64 | 16 |

Button 的私有 label 计入 LVGL object 资源事实，不占 Runtime Node 映射槽。双 Profile 使用同一状态机和数据结构，只改变上限与 Backend 组成。

## 6. 关闭与失败

`close()` 只关闭 admission；owner 必须继续 pump 已接受 task，或由上游按既有 stop policy 取消并产生明确终态。`finishClose(owner)` 仅在 pending 为零时销毁全部 LVGL object，清空映射和 slot，设置 closed。析构要求 closed、pending 和 live object 均为零，不隐藏执行清理。

Mount 失败不回滚 Core Runtime Tree，也不决定 degraded/rebuild/recreate；Platform 返回 typed failed Result 和本地资源事实，Core 按公共 Render Contract 决定恢复。Present 仍由 S03 执行，Mount 不自动显示 root。

## 7. M1-Alpha 边界

M1-Alpha S1 采用真实 LVGL SDL window、S03 page root 和 S04 Host object，验证 mount、present、visible 与资源归零。S04 不新增 RPK Loader 或 Alpha Runtime；真实 RPK bytes 经公共 Loader/Core 生成 MountTransaction 的端到端装配由后续集成负责，本分 Spec 不提前实现。

