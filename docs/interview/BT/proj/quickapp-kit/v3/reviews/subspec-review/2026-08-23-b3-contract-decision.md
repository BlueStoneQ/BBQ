# B3 合同扩展决策

## 目录

- [1. 结论](#1-结论)
- [2. 决策](#2-决策)
- [3. 边界](#3-边界)
- [4. 执行顺序](#4-执行顺序)

## 1. 结论

**采用方案 1：允许一次向后兼容的最小公共 Contract 扩展，然后继续 B3。**

B3 的 Image/Input 属于 V1 基础组件目标；如果继续冻结当前 `View/Text/Button + click` 合同，Phase 2 将无法达到“基本可用”的既定目标。

## 2. 决策

在不改变已有语义的前提下，V1 增加：

- Host Component：`Image`、`Input`。
- Image：RPK 资源引用、尺寸和资源加载失败结果。
- Input：`value`、基础 `input`、`change`、`focus` 事件。
- 对应 Page IR、Toolkit lowering、Runtime Tree、Mount 和 Platform Adapter 语义。

已有 `View`、`Text`、`Button`、`click` 和既有 RPK 必须保持兼容。

## 3. 边界

- 不改变 Core 唯一 Runtime Tree、RenderTransaction、MountTransaction、Event Router 或 Bridge 分层。
- Image 只能引用 RPK 内声明资源，不允许文件路径或平台对象穿过 Core。
- Input 事件必须使用既有 typed `PlatformInputMessage` -> Core Event Router -> JS Handler 链路。
- 不增加通用 JSON Bridge、网络、权限、复杂焦点系统、手势或动态组件注册。
- 不加入 `blur`、复杂输入法、上传、远程图片和异步网络资源；这些后置。
- 公共 Contract 变更完成后，旧 Case 001、B1、B2 必须回归通过。

## 4. 执行顺序

1. B3 Agent 先提交最小 Contract/Schema/旧用例回归补丁，状态 `CONTRACT_EXTENSION_READY`。
2. 总架构快速复核并放行后，继续 Image/Input 的 Toolkit、JS、Core、LVGL 实现。
3. 真实 RPK 在 LVGL/SDL 运行通过后，B3 标记 `FUNCTIONALLY_VERIFIED`。
4. Android/iOS 复用和完整组件/事件矩阵留到 B4/V1 Hardening。
