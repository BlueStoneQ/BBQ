# EX-S01 任务

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 有序任务](#3-有序任务)
- [4. 完成定义](#4-完成定义)

## 1. 结论

实施阶段只把已冻结的 Case 事实固化为机器可读证据并驱动同一 Artifact 的三平台验收；任何失败先归因 Toolkit/Runtime，不修改 Case 源码。

## 2. 门禁

当前仅完成设计。以下实施任务必须等待 EX-S01 独立校审通过且工作看板显式设置 `CODE_ALLOWED`；不得在本阶段执行或生成产物。

## 3. 有序任务

| Task | 依赖 | 工作 | 完成证据 |
|---|---|---|---|
| EX-S01-T01 | 无 | 生成 Source inventory：相对路径、byte length、SHA-256、snapshot digest；拒绝集合外构建输入和私钥内容 | digest 与本 Spec 一致的机器可读清单 |
| EX-S01-T02 | T01 | 建立 provenance 记录，保留未知上游字段为待验证，不伪造来源 | Case ID/version、来源状态、获取证据引用 |
| EX-S01-T03 | T01 | 生成 build/debug/release RPK/RPKS reference inventory；记录成员、bytes、SHA-256 和 build metadata | 四个归档 identity 与成员清单 |
| EX-S01-T04 | T01 | 固化 DSL/组件/Binding/Event/Style/Module/Page Control 使用矩阵 | 矩阵与源码静态扫描无差异 |
| EX-S01-T05 | T01,T04 | 定义平台无关场景描述：S1 launch、S2 push、S3 toast、S4 back、S5 destroy | 操作目标、前置状态、终点状态和可见断言 |
| EX-S01-T06 | T05 | Toolkit 从冻结源码构建正式 Runtime RPK，记录 Artifact identity；Widget 输出 V1 排除诊断 | 非交互 build 成功、inspect 结果、Artifact SHA-256 |
| EX-S01-T07 | T06 | 在 LVGL/SDL 执行 S1-S5，采集屏幕事实、Trace 与资源回落 | 一套有效 run evidence |
| EX-S01-T08 | T06 | 在 Android 执行相同 S1-S5 | 同 Artifact 的有效 run evidence |
| EX-S01-T09 | T06 | 在 iOS 执行相同 S1-S5 | 同 Artifact 的有效 run evidence |
| EX-S01-T10 | T07,T08,T09 | 比较三平台逻辑结果、Lifecycle 偏序、ID/marker、错误与资源；记录允许差异 | 一致性报告，无源码分叉 |
| EX-S01-T11 | T10 | 用 Noop/Recording TraceSink 各运行一次，确认除观测证据外行为等价 | 状态、结果、Revision、错误与线程顺序等价证据 |

任务所有权：Examples 拥有 T01-T05 的基线数据；Toolkit 拥有 T06 构建证据；各 Platform 拥有 T07-T09；Benchmark 采集和比较 T10-T11。Examples 不接管其他项目实现。

## 4. 完成定义

- 所有证据引用同一 `CASE-001@1` Source snapshot。
- 三平台引用同一个 QuickApp Kit Runtime Artifact SHA-256。
- S1-S5 的可见结果、Lifecycle/Trace 和资源断言全部通过。
- 没有修改 Case 源码、建立平台分支或把其他 Case 行为并入 Case 001。
- provenance 未知项保持显式，不影响本地快照身份的可重复验证。
