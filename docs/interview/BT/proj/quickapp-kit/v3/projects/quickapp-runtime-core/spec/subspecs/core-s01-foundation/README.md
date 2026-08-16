# CORE-S01 Core Foundation

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 依赖](#3-依赖)
- [4. 交付物](#4-交付物)
- [5. 状态](#5-状态)

## 1. 结论

CORE-S01 冻结所有后续 Core 模块共用的最小基础：**不可变 typed data、不可混用的 ID、有界单消费者消息队列、JS/Surface/Mount/Measure Port、固定 Kernel 依赖方向，以及不改变业务行为的最小观测机制。**

它不拥有任何业务状态机。Loader、Runtime Tree、Render、Layout、Mount、Event、Navigation 和 Capability 只使用这里定义的基础设施，分别由后续分 Spec 定义。

## 2. 范围

本分 Spec 包含：

- `RuntimeValue`、`RuntimeError` 与无异常结果类型。
- 公共 ID 的强类型包装、校验与不复用分配器基础；包含 Host 级 `AppRuntimeFactory/AppRuntimeIdAllocator` 所有权和 AppRuntime 级 `RequestId` 多 producer 唯一性策略。
- `BoundedMailbox<T>`、背压、关闭、销毁和故障注入。
- `CoreIngressPort`、`JsRuntimePort`、`PlatformSurfacePort`、`PlatformMountPort`、`PlatformMeasurePort` 基础合同与 Fake。
- `MonotonicClock`、`TraceSink`、`NoopTraceSink`、`RuntimeCounters`。
- 固定 Kernel 与外围实现的编译依赖边界。

本分 Spec不包含：

- Artifact 读取、校验或缓存。
- App、Surface、Tree、Transaction、Layout、Mount、Event、Navigation 或 Capability 业务逻辑。
- JS Engine、QuickJS、JNI、UIKit、LVGL、SDL 或任何平台对象。
- Collector、日志、文件输出、统计、报告或可视化。

## 3. 依赖

CORE-S01 无其他 Core 分 Spec 依赖，只依赖 v3 公共合同：

- `runtime-value.md`、`error-contract.md`、`id-contract.md`
- `runtime-abi.md`、`lifecycle-and-threading.md`
- `platform-surface-contract.md`、`render-contract.md`、`measure-adapter-contract.md`
- `observation-contract.md`、`runtime-composition-contract.md`
- 对应 `schemas/**`

公共合同优先于本分 Spec；冲突必须升级，不在本目录内另造协议。

## 4. 交付物

| 文件 | 作用 |
|---|---|
| [requirements.md](./requirements.md) | 冻结范围、功能与质量需求 |
| [design.md](./design.md) | 可直接编码的接口、线程、所有权、错误和销毁设计 |
| [tasks.md](./tasks.md) | 有序实现任务与完成定义 |
| [acceptance.md](./acceptance.md) | 正例、负例、故障注入和证据 |

## 5. 状态

`READY_FOR_REVIEW + CODE_BLOCKED`。已按 `P0-ID-001/S1-CORE-001` 完成定向修订，等待复核；工作看板显式放行前禁止实现。
