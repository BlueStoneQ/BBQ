# Runtime Core 总 Spec：分 Spec 索引

## 目录

- [1. 结论](#1-结论)
- [2. 分 Spec 清单](#2-分-spec-清单)
- [3. 依赖关系](#3-依赖关系)
- [4. 并行策略](#4-并行策略)
- [5. 启动门禁](#5-启动门禁)

## 1. 结论

Core 按“Package、运行控制、树与渲染、平台协调、事件与能力”分解；Runtime Tree 和 Surface 状态只允许一个实现归属，避免出现第二套权威状态。

## 2. 分 Spec 清单

| ID | 分 Spec | 责任 | 主要输出 | 依赖 |
|---|---|---|---|---|
| CORE-S01 | Core Foundation | typed value/error、ID、队列、Js/Surface/Mount/Measure Port、`MonotonicClock`、`TraceSink/NoopTraceSink`、`RuntimeCounters`、固定 Kernel 边界 | Core 基础合同与 Fake Ports | 无 |
| CORE-S02 | Package Loader | PackageSource、ZIP、Manifest/Metadata/Page IR 校验/缓存、Runtime Composition Manifest 兼容性预检、VerifiedModulePort 生产 | Verified Package/Module Load | CORE-S01 |
| CORE-S03 | AppRuntime 与 Lifecycle | AppContext、VmInitializationDispatch/Result、Host lifecycle control、LifecycleDispatch/Result | AppRuntime Controller | CORE-S01、CORE-S02 |
| CORE-S04 | Surface 与 Navigation | lifecycle/health、Revision/单在途、Root/Push/Close/teardown、页面栈 | Surface/Navigation Controller | CORE-S03 |
| CORE-S05 | Runtime Tree 与 Block | Node/LogicalRef、静态实例化、Block 生命周期、Handler ownership | RuntimeTreeStore | CORE-S01、CORE-S02 |
| CORE-S06 | Render Transaction | 通过 S04 读取 Revision 与在途状态，执行操作校验并产出不改变权威树的 staged change set | Render Processor | CORE-S04、CORE-S05 |
| CORE-S07 | Style、Yoga 与 Measure | 对 staged candidate 执行 Style resolve、Measure cache、Layout Rect；只消费 S01 Measure Port | Layout Engine | CORE-S01、CORE-S05、CORE-S06 |
| CORE-S08 | Commit、Mount 与恢复 | S06/S07 成功后唯一负责 Runtime Tree/Revision 原子提交、Mount 生成、Platform 协调和 degraded/full rebuild | Mount Coordinator | CORE-S04、CORE-S06、CORE-S07 |
| CORE-S09 | Event Router | Handler 注册、冒泡、Dispatch、Surface/Block 销毁清理 | Event Router | CORE-S04、CORE-S05 |
| CORE-S10 | Capability 与 Page Control | Registry/Invoker、router/prompt/device、Page Control；Guard 第二期 | Capability Subsystem | CORE-S03、CORE-S04 |
| CORE-S11 | Core Contract Verification | Fake JS/Platform、Kernel 反向依赖检查、Profile 不兼容负例、Noop/Recording Sink 行为等价、Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` Trace/Observation marker | Core 集成证据 | CORE-S02 至 CORE-S10、公共 Observation/Composition Contract |

## 3. 依赖关系

```text
CORE-S01 -> CORE-S02 -> CORE-S03 -> CORE-S04
CORE-S01 + CORE-S02 -> CORE-S05
CORE-S04 + CORE-S05 -> CORE-S06
CORE-S01 + CORE-S05 + CORE-S06 -> CORE-S07
CORE-S04 + CORE-S06 + CORE-S07 -> CORE-S08
CORE-S04 + CORE-S05 -> CORE-S09
CORE-S03 + CORE-S04 -> CORE-S10
CORE-S02..CORE-S10 + Public Observation Contract/Schema -> CORE-S11
```

## 4. 并行策略

- Package Loader、Runtime Tree 基础和 Port/Fake 可以在基础合同通过后并行。
- Render staging 与 Layout 合同可以并行设计；执行时 S07 消费 S06 candidate，只有 S08 能提交 Runtime Tree/Revision。
- Event 与 Capability 可并行，不得各自维护 Surface 生命周期。
- Android 只校准 Platform Port；不得成为任何 Core 分 Spec 的代码归属。

## 5. 启动门禁

总 Spec 通过后才编写这些分 Spec。分 Spec 必须明确状态机、线程、所有权、错误、观测和 Fake 验收，通过后才进入代码。
