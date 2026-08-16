# 第一批分 Spec 总检查

## 目录

- [1. 结论](#1-结论)
- [2. 检查基线](#2-检查基线)
- [3. 项目结论](#3-项目结论)
- [4. 必须修订](#4-必须修订)
- [5. 已通过项](#5-已通过项)
- [6. 自动校验](#6-自动校验)
- [7. 门禁](#7-门禁)

## 1. 结论

**架构主线成立，不需要重开总 Spec。**

第一批八项中：五项 `PASS`，三项 `CHANGES_REQUIRED`；P0 = 0。问题都属于合同精确定义，不涉及推翻单一 Runtime Tree、typed Bridge、Render/Mount、Event Router、平台 Port 或可裁剪组成。

```text
JS 无 VNode Tree，只维护 VM/Binding/Block/Handler
-> C++ Core 维护唯一 Runtime Tree、Revision 和状态机
-> Platform 消费 Mount、回传 Input/Result
```

## 2. 检查基线

逐项检查了每个分 Spec 的 `README/requirements/design/tasks/acceptance`，重点验证：

1. 职责是否落在项目总 Spec 指定的唯一模块。
2. 数据、线程、所有权、背压、关闭和错误是否闭环。
3. 是否重复定义公共合同或建立第二棵权威树、第二条 Bridge。
4. 需求是否能映射到任务和可执行验收。
5. 是否把第二期能力带入 V1。

## 3. 项目结论

| 分 Spec | 结论 | 核心判断 |
|---|---|---|
| BM-S02 | `PASS` | 只验证 Trace/Collector 合同，不把完整 Benchmark 放进 Runtime。 |
| TK-S01 | `PASS` | CLI 是 Application Service 薄入口；Workspace、配置、路径和错误可确定。 |
| JS-S01 | `CHANGES_REQUIRED` | Engine/Executor 边界成立；需删除不可实现的 Sink 违约兜底表述。 |
| CORE-S01 | `CHANGES_REQUIRED` | Foundation 边界成立；需消费新冻结的 `AppRuntimeId` 合同。 |
| LV-S01 | `PASS` | 有界任务、时钟、唤醒、Display/Input Port 干净且适合嵌入式。 |
| AND-S01 | `PASS` | Host 只装配和代理，不复制 Core 状态机；PackageSource 与生命周期闭环。 |
| IOS-S01 | `CHANGES_REQUIRED` | Host/PackageSource 边界成立；需精确区分 Scene 信号去重与公共 control 结果。 |
| EX-S01 | `PASS` | Case 001 正确区分 Source、联盟参考产物和 QuickApp Kit Runtime Artifact。 |

## 4. 必须修订

### S1-JS-001：TraceSink 违约行为不可由调用方兜底

位置：`JS-S01 requirements.md` R17、`design.md` Observation、`acceptance.md` A38。

`TraceSink::emit(...) noexcept` 是注入前置合同。若 C++ Sink 实现仍抛异常，进程会终止；若它内部阻塞，调用方无法可靠识别并隔离。因此 Spec 不能承诺“Sink 抛错或真实阻塞时 Engine 不受影响”。

修订要求：只允许注入满足 `noexcept + nonblocking + no reentry` 的 Sink；验收覆盖 Noop、正常 Recording、容量满/拒绝/丢样、关闭和重入意图。真实 throw/block 属于非法实现，由静态约束、受控替身和集成检查拒绝，不写成 Runtime 可恢复场景。

### S1-CORE-001：AppRuntimeId 公共归属已冻结，子 Spec 尚未同步

位置：公共 `ID Contract`、CORE-S01 `design.md` 4.2、`acceptance.md` FND-ID-001、Core Handoff `CORE-S01-ID-001`。

已冻结：`AppRuntimeId` 由 Core `AppRuntimeFactory` 唯一生成；作用域为一个 Runtime Host 实例；Host 生命周期内不复用；allocator 晚于全部 AppRuntime 销毁。Platform Host 不生成或传入该 ID。

修订要求：Core 分 Spec 写清 Factory/allocator ownership、连续创建/销毁多个 AppRuntime 的不复用验收，以及 Factory teardown 后资源归零。RequestId 多 producer 仍使用共享分配器或互斥命名分区，不能被“每类一个局部单调序列”覆盖。

### S1-IOS-001：Scene 去重与公共 Lifecycle Control 语义混在一起

位置：IOS-S01 R10、`design.md` 8、`acceptance.md` 4.2。

原始 Scene notification 可以在形成公共请求前去重；一旦 Host 接受并生成 `RuntimeLifecycleControl + RequestId`，就必须原样进入 Core 并返回唯一 typed Result，不能合并为成功。并发公共 control 的 `LIFECYCLE_BUSY` 必须保留。

修订要求：分别定义 raw Scene signal 和 accepted Host control；补充“信号去重不生成 RequestId”“已接受请求不合并”“Core 返回 LIFECYCLE_BUSY 原样透传”三组验收。

### S2-IOS-002：custom Profile 与 off 不是同义条件

位置：IOS-S01 R03。

公共 Composition Contract 只规定 `custom` 可以选择 `off`；custom 也可以选择 baseline/diagnostic。修订为：`conformance=v1 -> baseline|diagnostic`；`observationLevel=off` 仅允许 custom 且注入 Noop；custom 的 baseline/diagnostic 仍可注入 Recording Adapter。

### S2-EX-001：README 缺少显式门禁状态

EX-S01 语义已通过。只需在 README 增加 `PASS + CODE_ALLOWED`，并声明 Examples Agent 当前只执行 T01-T05；T06-T11 仍按各项目所有权和依赖推进。

## 5. 已通过项

1. 八项都没有引入 JS VNode Tree、Core 二次 Diff 或 Platform 权威业务树。
2. JS -> Core 仍是 typed Runtime ABI；Core -> Platform 仍是 typed Port；QuickJS External Function 只属于 Engine Provider。
3. 所有队列和嵌入式资源边界有容量、owner、背压与停止语义。
4. Toolkit 不解释 Runtime，Examples 不解释 Toolkit/Runtime，Benchmark 不修改公共 Trace。
5. Android/iOS Host 不直接调用 JS Hook；Core 仍拥有生命周期和路由状态。
6. 第二期 Skill/MCP、AI Feature、签名、完整统计与外部框架对比均未进入第一批实现范围。

## 6. 自动校验

- 八个目录均包含五份标准文档并带目录。
- 本地 Markdown 链接检查通过。
- 公共 Schema、联合消息分支、Composition/Page IR/Render/Event/Artifact 语义负例通过。
- 没有发现新增产品实现文件来自本轮分 Spec 设计。

## 7. 门禁

```text
CODE_ALLOWED:
  BM-S02, TK-S01, LV-S01, AND-S01, EX-S01(T01-T05 only)

CODE_BLOCKED:
  JS-S01, CORE-S01, IOS-S01
```

三项修订只做定向复核：确认对应问题关闭后即可单项转为 `PASS + CODE_ALLOWED`，不再进行全量总架构校审。
