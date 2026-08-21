# M1-Alpha 执行覆盖层

## 目录

- [1. 结论](#1-结论)
- [2. 定位](#2-定位)
- [3. 最小链路](#3-最小链路)
- [4. 约束](#4-约束)
- [5. 阅读顺序](#5-阅读顺序)

## 1. 结论

**M1-Alpha 只追求一件事：使用冻结的联盟 DSL Case 001，生成真实 Runtime RPK，并在 LVGL/SDL 上让根页面可见。**

它是 v3 的执行覆盖层，不是新产品、新项目或第二套架构。正式公共合同和项目分 Spec 继续是唯一设计依据。

## 2. 定位

M1-Alpha 解决当前执行过慢的问题：把 41 个 M1 分 Spec 中形成首屏所必需的最小子集抽成一条垂直链路，先验证系统能运行，再回填完整模块能力。

Alpha 不修改：

- v3 公共合同、Schema、ID、线程和所有权决策。
- 既有项目目录和代码归属。
- M1 的完整 41 分 Spec 责任地图。

Alpha 只选择已有分 Spec 的最小实现范围；代码仍写入对应 Toolkit、JS、Core、LVGL 和 Examples 项目。

## 3. 最小链路

```text
Case 001 联盟 DSL Source
  -> Toolkit: JS Bundle + Page IR + 最小 Runtime RPK
  -> Core: Package Load + App/Page + Surface + Render + Layout + Mount
  -> JS: Module Load + VM + initial binding evaluation
  -> LVGL: View/Text/Button Host Mount
  -> Root Surface Presented
```

Alpha 只验收 Case 001 的 S1 `launch-root`；S2 路由、S3 Capability、S4 返回、S5 完整销毁属于后续 M1 主线，但 Alpha 仍要求本次运行资源可确定释放。

## 4. 约束

1. 输入必须来自 Case 001 冻结 Source snapshot；不得手写 IR、Bundle 或 RPK 绕过 Toolkit。
2. JS 不维护完整 VNode Tree；初始 Binding 通过冻结的 Definition、Page IR ID 和 JS/Core 合同传递。
3. Core 维护唯一权威 Runtime Tree；Platform 只维护 Host object 映射。
4. Alpha 可以只实现静态首屏和 initial-only binding，不实现完整 Reactive、Event、Navigation、Capability。
5. 每个项目只实现 Alpha 需要的最小纵向切片，不提前实现同分 Spec 的完整后续能力。
6. Alpha 通过后，继续扩展同一代码和同一分 Spec，不创建 Alpha 专用 Runtime。

## 5. 阅读顺序

1. [范围](./scope.md)
2. [任务](./tasks.md)
3. [验收](./acceptance.md)
4. [统一 Agent 指令](./agent-instructions.md)
5. [当前状态](./status.md)
6. [Case 001 基线](../../../../../../../../quickapp-kit-ai/quickapp-examples/baselines/case-001/README.md)
