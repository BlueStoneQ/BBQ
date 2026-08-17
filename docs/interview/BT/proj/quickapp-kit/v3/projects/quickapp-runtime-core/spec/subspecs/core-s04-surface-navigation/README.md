# CORE-S04 Surface 与 Navigation

## 目录

- [1. 结论](#1-结论)
- [2. 责任](#2-责任)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖与边界](#4-依赖与边界)
- [5. 交付物](#5-交付物)
- [6. 当前状态](#6-当前状态)

## 1. 结论

CORE-S04 是 Surface lifecycle、health、Revision gate 和 Core Navigation 栈的唯一 owner：Root/Push/Close 都先准备不可失败的 Core commit，再执行 Platform command，只有 Platform 成功才原子提交逻辑状态。

## 2. 责任

- 管理每个 AppRuntime 的 Surface 表、SurfaceId allocator 与 tombstone。
- 冻结 lifecycle、health、Revision 和单在途规则。
- 协调 Root 创建、Navigation Push、Navigation Close 和整栈销毁。
- 维护唯一权威 Core Navigation 栈；Platform 只执行明确的 source/target command。
- 通过 S03 完成 Page Module/VM/Hook，通过后续流水线完成 Tree/Layout/Mount。
- 在失败时保持已提交栈和可见状态一致，并确定释放未提交资源。

## 3. 输入与输出

| 方向 | typed 输入/输出 |
|---|---|
| Host -> Core | `CreateSurfaceRequest`、Host 发起的 `NavigationClose` |
| JS -> Core | `NavigationPush`、`NavigationClose`、`InstantiateTemplate` 及后续 Render intent |
| Core -> Platform | Create/Present/Visibility/Close/Destroy Surface Host command |
| Platform -> Core | 与 command 同 RequestId 的 typed Result |
| S03 <-> S04 | AppRuntime state、Page VM/Hook、foreground/background/destroy collaborator |
| Core -> Host/JS | Surface/Instantiate/Navigation typed Result、`SurfaceStatusChanged` |

## 4. 依赖与边界

- 依赖 CORE-S01 的强类型 ID、allocator、Port、queue、Trace 和 Counter。
- 依赖 CORE-S02 的 verified route/Page IR/Module handle，不读取 PackageSource 或原始 JSON。
- 依赖 CORE-S03 唯一 AppRuntime 状态和 Page lifecycle 服务，不复制 AppRuntime lifecycle。
- 后续 CORE-S06/S07/S08 通过内部 permit/commit authority 接入；S04 不实现 Render、Layout 或 Mount。
- S05 RuntimeTreeStore 是每个 Surface 唯一运行时树；未提交 target、mutation 和 Platform Host Tree 都不是第二棵权威树。

## 5. 交付物

- [requirements.md](./requirements.md)：可验证需求和边界。
- [design.md](./design.md)：状态、路由、原子提交、失败与释放。
- [tasks.md](./tasks.md)：通过校审后才可执行的实现任务。
- [acceptance.md](./acceptance.md)：Root/Push/Close、故障和资源验收。

## 6. 当前状态

`READY_FOR_REVIEW / CODE_BLOCKED`

本目录只完成设计；未获得 `PASS + CODE_ALLOWED` 前不得实现 CORE-S04。
