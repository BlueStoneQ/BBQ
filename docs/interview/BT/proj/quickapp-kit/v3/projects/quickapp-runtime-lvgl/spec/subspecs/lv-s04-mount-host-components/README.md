# LV-S04 Mount 与 Host Components

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 依赖与产物](#3-依赖与产物)
- [4. 门禁](#4-门禁)

## 1. 结论

LV-S04 是 Platform 对公共 `MountTransaction` 的最小 LVGL Adapter：在已有 S03 Surface page root 下，按 owner thread 创建、更新、插入、移动和删除 View/Text/Button；Platform 只拥有 `NodeId -> NativeHandle` 的本地映射，不拥有 Runtime Tree、Revision、路由或 Layout 语义。

## 2. 范围

本分 Spec 冻结：

- `SurfaceId -> S03 page root` 的挂载目标解析。
- `NodeId -> LVGL object` 的平台本地映射。
- `full` 与 `incremental` Mount 的有序操作。
- owner-thread 执行、事务失败处理、固定容量和确定关闭。
- 真实 LVGL/SDL simulator 的 Case 001 S1 mount/present/visible/resource 证据。

本分 Spec 不实现：

- Core Runtime Tree、Revision、Route/Navigation、Layout/Measure 或 Diff。
- RPK 解包、JS 执行、Core MountTransaction 生成。
- LV-S05 Input/Event、LV-S06 Measure、LV-S07 Capability、LV-S08 Full Runtime、LV-S09 Observation Collector、LV-S10 Case Integration。

## 3. 依赖与产物

依赖：LV-S01 OwnerTaskQueue，LV-S02 Runtime Host，LV-S03 Surface Host，以及 v3 公共 Render、Surface、Lifecycle、Observation 合同。

代码产物位于 `quickapp-runtime-lvgl`；分 Spec 产物为本目录五份文件。不得新增 v3 公共合同或 Alpha 专用 Runtime。

## 4. 门禁

`ALPHA_COMPONENT_VERIFIED + INTEGRATION_ALLOWED`：真实 LVGL/SDL、owner thread、full/incremental Mount、Present/visible、失败清理和 close 资源证据已通过。当前输入仍是 typed MountTransaction fixture；真实 RPK -> Core -> LVGL 联调尚未完成。不得启动后续 LV-S05/LV-S07/LV-S08/LV-S09/LV-S10。
