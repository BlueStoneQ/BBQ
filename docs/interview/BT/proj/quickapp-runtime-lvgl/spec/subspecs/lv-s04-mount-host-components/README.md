# LV-S04 Mount 与 Host Components

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 依赖](#3-依赖)
- [4. 交付](#4-交付)

## 1. 结论

LV-S04 是现有 v3 Platform Adapter 的 Mount 实现：在 owner thread 将公共 `MountTransaction` 应用到 S03 创建的 LVGL page root，完成 View/Text/Button 的创建、属性、最终布局、移动、删除和资源释放。

Platform 只拥有 `SurfaceId -> page root` 与 `NodeId -> native object` 的本地映射；Core Runtime Tree、Revision、路由和 Layout 仍由 Core 权威管理。

## 2. 范围

本 Spec 同时冻结完整 Mount 合同的 Platform 落地方式，并实现 M1-Alpha Case 001 S1 所需的真实 LVGL/SDL 路径：

- View、Text、Button 的真实 LVGL object 创建。
- `CreateHost`、`SetHostProp`、`SetHostLayout`、`InsertHostChild`、`MoveHost`、`RemoveHost`。
- 隐藏 page root 中的 full mount、之后由 S03 单独 Present。
- owner-thread、固定容量、事务失败、确定关闭和资源归零。
- 结构化 mount、visible、present 和资源计数证据。

不实现 LV-S05 Input、LV-S07 Capability、LV-S08 Full Runtime、LV-S09 Collector、LV-S10 Case 总集成；不新增公共合同或 Alpha 专用 Runtime。

## 3. 依赖

- v3 公共 `render-contract.md`、`host-component-contract.md`、`platform-surface-contract.md`、`lifecycle-and-threading.md`、`observation-contract.md`。
- LV-S01 Foundation 与 owner task 语义。
- LV-S03 Surface Host 与 page root 生命周期。
- LV-S06 的测量结果；S04 不自行测量。
- LVGL 真实实现；SDL 只负责 simulator 的窗口/display backend，不进入 Mount API。

## 4. 交付

| 文件 | 内容 |
|---|---|
| `requirements.md` | 可验收需求与 M1-Alpha 限定 |
| `design.md` | 边界、映射、事务和销毁设计 |
| `tasks.md` | 实现、证据和禁止事项 |
| `acceptance.md` | 合同、真实 Host、线程、失败和资源验收 |

代码写入 `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl/`，不修改 Core 公共合同。
