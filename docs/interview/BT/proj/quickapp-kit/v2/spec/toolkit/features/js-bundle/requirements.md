# JS Bundle Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 需求](#2-需求)
- [3. 验收](#3-验收)

## 1. 结论

**JS Bundle 只承载动态逻辑；App、Shared、Page 是不同生命周期和缓存边界。**

## 2. 需求

### R1 入口

**WHEN** Runtime 加载一个 Bundle
**THE SYSTEM SHALL** 通过稳定模块 ID 注册模块，并提供 App、Shared 或 Page 的明确入口。

### R2 共享模块

**WHEN** 同一 App Runtime 的多个页面引用 Shared Module
**THE SYSTEM SHALL** 只执行一次并复用同一模块实例。

### R3 页面隔离

**WHEN** Runtime 创建两个页面实例
**THE SYSTEM SHALL** 为每个页面建立独立 State、Binding Evaluator 和 Handler 上下文。

### R4 ABI

**WHEN** Bundle 需要更新状态、提交 RenderTransaction 或调用能力
**THE SYSTEM SHALL** 只调用 QuickApp Kit Runtime ABI，不直接调用平台 API。

### R5 兼容

**WHEN** Bundle ABI 与 Runtime ABI 不兼容
**THE SYSTEM SHALL** 在执行前失败并返回明确诊断。

## 3. 验收

Case 001 能加载 app、Shared 和两个 Page 入口；Shared 单例测试通过；页面状态互不污染；Bundle 不包含完整 VNode Tree。
