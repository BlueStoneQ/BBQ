# 平台总 Spec 第二次复核意见闭环

## 目录

- [1. 结论](#1-结论)
- [2. P1 闭环](#2-p1-闭环)
- [3. P2 闭环](#3-p2-闭环)
- [4. 验证](#4-验证)
- [5. 当前授权](#5-当前授权)

## 1. 结论

第二次复核提出的 2 个 P1 和 2 个 P2 已按最小范围修正；未改变独立 C++ Core、唯一 Runtime Tree、无完整树 Diff、typed message、Core Navigation 所有权和平台闭环顺序。

## 2. P1 闭环

### P1-001 Observation 消费语义

1. Benchmark 删除本地规范性指标字典，只引用公共 Observation Contract 的 marker 对。
2. `logicalPayloadBytes` 明确使用公共合同的 RFC 8785 JCS UTF-8 字节定义。
3. CORE-S11 依赖图改为公共 Observation Contract/Schema，不再硬依赖 BM-S02。
4. BM-S02 仍只输出验证报告、Collector 消费合同和 Handoff 变更建议。

### P1-002 CAP-DEVICE-001 验收传播

1. JS/Core/LVGL/Android 的 Case 001 均移除 device/DeviceInfo。
2. JS/Core/LVGL/Android 增加独立 `CAP-DEVICE-001` success、failure、禁止设备唯一标识和销毁清理验收。
3. iOS 同步增加独立 `CAP-DEVICE-001` 验收，保持三平台对称。
4. Benchmark 增加独立 scenario identity、marker、typed Result、字段与失败样本报告要求。

## 3. P2 闭环

### P2-001 授权状态

任务状态与授权状态已经分离：

```text
设计任务：READY -> IN_PROGRESS -> READY_FOR_REVIEW -> PASS
设计授权：DESIGN_BLOCKED -> DESIGN_ALLOWED
编码授权：CODE_BLOCKED -> CODE_ALLOWED
实现任务：CODE_ALLOWED -> IMPLEMENTING -> VERIFIED
```

`READY` 和 `PASS` 都不自动产生授权。当前总状态为 `DESIGN_BLOCKED + CODE_BLOCKED`；定向复核 PASS 后，工作看板才可设置 `DESIGN_ALLOWED`。

### P2-002 Observation 条件机器规则

公共 Schema 已增加并测试：

1. 所有 `*.failed` marker 必须携带非空 `errorCode`。
2. 存在 `memoryBytes` 时必须同时携带 `metricKind` 与 `samplingPhase`。
3. `memory.sampled` 必须携带 `memoryBytes + metricKind + samplingPhase`。

## 4. 验证

```text
Validated 21 schemas, 81 union branches, 10 supplemental positives,
8 Page IR graph negatives, 10 InstantiateTemplate semantic negatives,
10 Render addressing negatives, 6 RegisterHandler addressing negatives,
8 Artifact relation negatives, and 10 signature cases.
```

残留扫描已确认：

- 无 Benchmark 本地 V1 指标字典。
- 无 CORE-S11 -> BM-S02 硬依赖。
- 四个被指出项目的 Case 001 均不再要求 device。
- 根入口和任务文件不再宣称当前 `DESIGN_ALLOWED`。

## 5. 当前授权

| 工作 | 状态 |
|---|---|
| 定向复核 | 待执行 |
| 项目分 Spec | `DESIGN_BLOCKED` |
| 产品代码 | `CODE_BLOCKED` |
| 复核通过后的动作 | 工作看板设置八项目 `DESIGN_ALLOWED` |
