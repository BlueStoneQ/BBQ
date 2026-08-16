# Toolkit Implementation Steps

## 顺序

```text
T0 工程骨架
T1 Project Loader / Config
T2 Alliance Frontend Adapter
T3 Normalized IR
T4 Analyzer / IDs / Dependencies
T5 Template / Binding / Block / Handler / Style Lowering
T6 JS Bundle / Module Chunk
T7 Runtime Metadata / Validate
T8 RPK Package / Sign
T9 CLI Inspect / Trace
T10 Case 001 End-to-End
```

每一步都必须先通过对应 Spec 和 Contract Test，再进入下一步。

