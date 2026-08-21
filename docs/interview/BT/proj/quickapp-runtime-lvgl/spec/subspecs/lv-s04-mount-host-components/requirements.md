# LV-S04 Requirements

## 目录

- [1. 必须满足](#1-必须满足)
- [2. M1-Alpha](#2-m1-alpha)
- [3. 不在本轮](#3-不在本轮)

## 1. 必须满足

| ID | 要求 | 验收证据 |
|---|---|---|
| LV-S04-R01 | 输入只接受公共 MountTransaction 语义：SurfaceId、Revision、MountAttemptId、SourceId、Mode 和有序操作；不解释 JS、IR 或业务状态 | 类型与边界扫描 |
| LV-S04-R02 | 所有 LVGL object 的创建、属性、布局、移动、删除和 Present 前状态变更只能由 owner thread 执行 | wrong-thread 测试、TSan |
| LV-S04-R03 | `View`、`Text`、`Button` 分别映射到真实 LVGL object；Button 的内部 label 是平台私有对象，不分配 Runtime NodeId | 真实 LVGL smoke、映射断言 |
| LV-S04-R04 | 每个 Runtime NodeId 最多拥有一个平台本地映射；重复创建、重复挂接、未知父节点和非法顺序整笔拒绝 | preflight 测试 |
| LV-S04-R05 | Mount 先在隐藏 page root 中完成；Mount 成功不等于页面可见，Present 只能由 S03 执行 | mount/present 分离证据 |
| LV-S04-R06 | full 只接受 Create/Prop/Layout/Insert，并先清空该 Surface 的本地 Host 映射；incremental 支持 Create/Prop/Layout/Insert/Move/Remove | full/incremental 测试 |
| LV-S04-R07 | 一笔事务要么完整提交，要么返回失败；失败不得跳过操作继续返回成功 | 失败注入、状态快照 |
| LV-S04-R08 | Move 保留 NodeId 与 native object，禁止环；Remove 递归删除后代并清理全部本地映射 | move/remove 测试 |
| LV-S04-R09 | Layout 只应用 Core 给出的最终 logical-px；Platform 不运行 Layout、Measure、Diff 或 Revision | boundary scan |
| LV-S04-R10 | 队列、事务操作数、Host object 数和 private Button label 数有固定上限，满载拒绝，不动态扩容 | capacity 测试 |
| LV-S04-R11 | Close 在 owner thread 显式完成：停止接收、排空或取消明确 pending mount、删除全部 object、清空映射，资源计数归零 | close/resource 测试 |
| LV-S04-R12 | MountSubmitted、MountCompleted、MountFailed 以及 visible/mount/present 的关联 ID 可通过既有 Observation Port 观察；不开启观测不改变行为 | 结构化事件证据 |

## 2. M1-Alpha

Case 001 S1 只要求真实 RPK 链路最终产生一个可见根页面。S04 本轮必须提供可由现有加载/运行链提交的最小 Mount：

```text
hidden page root
  -> View root
    -> Text title
    -> Button action
  -> mount committed
  -> S03 Present root
  -> visible
```

M1-Alpha 不以虚拟 object、字符串快照或 Fake 代替真实 LVGL/SDL Host。Fake 只用于失败、容量、线程和资源合同测试。

## 3. 不在本轮

- 不实现 click/input handler、Event dispatch 或 HandlerId。
- 不实现 Measure、字体选择、Yoga、Layout 计算或本地自动布局。
- 不实现 Capability、路由、RPK Loader、JS Engine、Trace Collector 或 benchmark 分析。
- 不复制 Core Runtime Tree、Revision、Navigation stack 或 Core 的 NodeId 生成逻辑。
