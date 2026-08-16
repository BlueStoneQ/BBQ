# RPK Package Tasks

## 目录

- [1. 任务](#1-任务)
- [2. 追踪](#2-追踪)

## 1. 任务

- [ ] T8.1 定义 Package Index 和 Runtime Metadata Schema（R1/R2）。
- [ ] T8.2 实现版本和 ABI 门禁（R3）。
- [ ] T8.3 实现逻辑路径白名单和路径安全校验（R4）。
- [ ] T8.4 实现稳定成员排序和摘要（R5）。
- [ ] T8.5 实现 RPK 写入、读取和 Loader Contract Test。
- [ ] T8.6 对 Case 001 debug/release 产物做 Golden 验证。

## 2. 追踪

| 任务 | 需求 | 验证 |
|---|---|---|
| T8.1 | R1/R2 | Metadata Schema |
| T8.2 | R3 | Version Gate Test |
| T8.3 | R4 | Path Security Test |
| T8.4/T8.6 | R5 | Deterministic Package Test |
| T8.5 | R1-R4 | Loader Contract Test |
