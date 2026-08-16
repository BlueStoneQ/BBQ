# QuickApp Kit V1 执行计划

## 目录

- [1. 结论](#1-结论)
- [2. V1 里程碑](#2-v1-里程碑)
- [3. M1 验收合同](#3-m1-验收合同)
- [4. 分-Spec-与执行波次](#4-分-spec-与执行波次)
- [5. M1 执行波次](#5-m1-执行波次)
- [6. 校审与编码门禁](#6-校审与编码门禁)
- [7. 当前动作](#7-当前动作)

## 1. 结论

**V1 不再按全部分 Spec 串行推进，而是以同一个 Runtime RPK 在三个平台完成 Case 001 为主线，按端到端能力组织执行波次。**

72 个分 Spec 保留，继续定义模块归属、接口、任务和验收；它们是完整责任地图，不是 72 道串行启动门。每个分 Spec 仍须独立 `PASS` 后才能编码，但同一波次中先通过的项可以先实现，不等待整批结束。

平台闭环顺序固定为：

```text
M1 LVGL/SDL -> M2 Android -> M3 iOS -> M4 基础 Benchmark
```

Android 和 iOS 的 Foundation 可以提前并行，不阻塞 M1；后续高级能力不阻塞三个平台的 V1 主链路。

## 2. V1 里程碑

| 里程碑 | 结论性目标 | 退出条件 |
|---|---|---|
| F0 Foundation | 关闭首批基础模块和公共合同问题 | 当前首批分 Spec 实现或返修通过；无阻塞 M1 的公共合同冲突 |
| M1 LVGL/SDL | 联盟 DSL 经 Toolkit 构建后，由共享 JS/Core 在 LVGL/SDL 完整运行 | Case 001 S1-S5 全部通过，资源归零，具备结构化观测证据 |
| M2 Android | Android 复用同一 Artifact、JS Framework 和 C++ Core | 同一 Runtime RPK 完成 S1-S5；联盟语义差异有明确结论 |
| M3 iOS | iOS 复用同一 Artifact、JS Framework 和 C++ Core | 同一 Runtime RPK 完成 S1-S5；无平台私有业务语义 |
| M4 基础 Benchmark | 用统一 Observation Contract 给出三平台基础结果 | 启动、Bridge、Render、Mount、Event、Lifecycle 指标可复现 |

V1 完成的本质是：**同一份受约束 DSL 输入，经一条工具链生成同一 Runtime Artifact，由一套共享运行时语义驱动三个平台。**

## 3. M1 验收合同

M1 必须运行 `quickapp-examples` 的 Case 001 基线，不以手写 IR、手工拼包或绕过 Toolkit 的测试程序代替。

| 场景 | 操作 | 必须证明 |
|---|---|---|
| S1 | 启动根页面 | RPK 加载、App/Page 初始化、首笔 Render/Mount、根页面可见 |
| S2 | 点击“跳转到详情页” | Input -> Event -> JS Handler -> Core Navigation -> 新 Surface 可见 |
| S3 | 点击“欢迎使用” | Event -> Capability -> Platform Toast，typed request/result 闭环 |
| S4 | 执行平台返回 | Platform control -> Core 权威路由栈 -> 页面关闭与前页恢复 |
| S5 | 销毁 Runtime | Page/App/Surface/Handler/Node/Engine 等资源确定释放并归零 |

共同约束：

- 输入是 Toolkit 从冻结联盟 DSL Source 构建的 Runtime RPK。
- JS、Core、LVGL 不读取源码目录，也不各自解释 DSL。
- Core 维护唯一权威 Runtime Tree；Platform Host Tree 只是提交结果。
- 每个跨层操作使用冻结公共合同和关联 ID，不建立平台私有旁路。
- 观测关闭不改变行为；M1 只要求最小结构化证据，不要求完整分析系统。

## 4. 分 Spec 与执行波次

### 4.1 两种结构的职责

| 结构 | 回答的问题 |
|---|---|
| 分 Spec | 谁实现、输入输出是什么、状态和所有权如何成立、怎样独立验收 |
| 执行波次 | 为形成下一段端到端能力，本轮哪些分 Spec 同时推进 |

因此不删除、不合并现有分 Spec，也不要求按编号把一个项目全部做完后再进入下一个项目。

### 4.2 推进规则

1. 一个项目继续由一个长期 Agent 负责，保持内部设计连续性。
2. Agent 最多提前设计一个执行波次，避免远期设计脱离真实实现。
3. 当前分 Spec `PASS` 后立即允许编码，不等待同波次其他项目。
4. 项目内代码仍遵守 `subspec-index.md` 依赖；同波次只表示可并行设计，不取消实现依赖。
5. 波次末只做一次跨项目合同与端到端证据检查，不重复全面校审总架构。
6. 只有发现公共合同冲突时，受影响部分暂停并由总架构统一处理；其他部分继续。

## 5. M1 执行波次

| 波次 | Toolkit | JS Runtime | Runtime Core | LVGL Runtime | 形成的能力 |
|---|---|---|---|---|---|
| F0 | TK-S01 | JS-S01 | CORE-S01 | LV-S01 | CLI、Engine、Core Foundation、平台任务与 Backend 基础 |
| W1 | TK-S02、TK-S03 | JS-S02 | CORE-S02、CORE-S05 | LV-S02 | Module Graph、DSL 前端、Runtime ABI、包加载、Tree 与 Host Backend |
| W2 | TK-S04 | JS-S03、JS-S04 | CORE-S03、CORE-S04 | LV-S03、LV-S06 | Lowering、模块/VM、App/Page/Surface、字体度量 |
| W3 | TK-S05、TK-S06、TK-S07 | JS-S05、JS-S08、JS-S09 | CORE-S06、CORE-S09、CORE-S10 | LV-S04、LV-S05、LV-S07 | Bundle/IR/RPK、响应式/事件/API、Render/Event/Capability、Mount/Input |
| W4 | TK-S08 | JS-S06、JS-S07 | CORE-S07、CORE-S08 | LV-S08 | `inspect/run`、Block/Render Builder、Layout/Mount、SDL 完整运行 |
| W5 | TK-S09 | JS-S10 | CORE-S11 | LV-S09、LV-S10 | Case 001 S1-S5 验收、资源与观测证据 |

补充关系：

- Examples 的 EX-S01 是 M1 验收基线；EX-S02 是后续增量渲染、Block、Capability 和 Event 强化用例，不阻塞首次 Case 001 闭环。
- Benchmark 的 BM-S02 负责校验 Observation Contract；BM-S03 及以后不阻塞 M1。
- Android AND-S01、iOS IOS-S01 可在 F0 并行完成；后续平台分 Spec 分别在 M2、M3 波次推进。
- 同一单元格内的兄弟分 Spec 可并行设计；编码顺序仍以项目 `subspec-index.md` 为准。

## 6. 校审与编码门禁

```text
当前波次分 Spec 设计
  -> 项目 Agent 自检并写 READY_FOR_REVIEW
  -> 总架构按批次检查公共合同、依赖和端到端闭环
  -> 单项 PASS 后立即 CODE_ALLOWED
  -> Agent 实现、测试并提交证据
  -> 波次端到端检查
  -> 下一波次
```

每个分 Spec 都必须经过总架构校审；额外启动独立校审 Agent 的情况只有：

- 新增或改变公共 wire Schema、跨线程状态机、所有权或错误语义。
- 总架构与子项目对同一合同存在不同解释。
- 端到端证据与冻结合同冲突。

普通项目内部实现修正由总架构定向检查，不再启动全量架构复核。

## 7. 当前动作

### 7.1 总架构 Agent

1. `EX-S02-REQ-001` 已关闭，等待 Examples Agent 同步字段级断言。
2. Foundation 定向复核已完成：Benchmark、Toolkit、Core、LVGL、Android 通过。
3. Toolkit、Core、LVGL 先行设计 W1；JS 完成 S01 后加入 W1。W2 暂不发布。

### 7.2 项目 Agent

| Agent | 现在做什么 | 完成后 |
|---|---|---|
| Toolkit | 设计 TK-S02 与 TK-S03，不编码 | 两份分 Spec 一起提交校审 |
| Runtime Core | 设计 CORE-S02 与 CORE-S05，不编码 | 两份分 Spec 一起提交校审 |
| LVGL Runtime | 设计 LV-S02，不编码 | 提交校审 |
| JS Runtime | 完成 JS-S01 实现和验收 | 写 `READY_FOR_REVIEW`；不得启动 JS-S02 |
| Android Runtime | AND-S01 已完成，当前停止扩展 | M1 完成后进入 M2 |
| iOS Runtime | 只收尾已启动的 IOS-S01 Foundation | 写 `READY_FOR_REVIEW`；IOS-S02 必须等到 M3 |
| Benchmark | 当前阶段停止扩展 | 等待 M4 |
| Examples | 将 EX-S02 同步到已冻结的 Render `requestId` 合同 | 提交 EX-S02 校审，不写 Fixture 产品代码 |

### 7.3 用户操作

1. 继续使用现有八个长期 Agent 对话，不为每个分 Spec 新开对话。
2. 把 `2026-08-16-current-agent-prompts.md` 中的话术分别发给对应 Agent。
3. 任一 Agent 标记 `READY_FOR_REVIEW` 后，只通知总架构 Agent；不要让项目 Agent 自行修改公共合同。
4. 等总架构在工作看板写出 `PASS + CODE_ALLOWED` 后，再让该 Agent 进入编码或下一波次。
