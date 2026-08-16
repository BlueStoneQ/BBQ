# Toolkit Testing and Benchmark Contract

## 1. 结论

**Toolkit 的正确性由 Golden/Contract/端到端测试证明，性能由构建和产物指标证明。**

## 2. 测试层级

```text
Parser / Normalizer / Lowering 单元测试
-> IR Schema / Reference Contract
-> Case 001 Golden 输出
-> RPK inspect / validate
-> Runtime 首屏、更新、点击、路由闭环
-> Alliance semantic differential test
```

## 3. 必测行为

- 静态节点和文本 Binding；
- 多个 Binding 共享一个 StatePath；
- Binding 结果不变时无 Render Intent；
- `if` 插入/删除；
- keyed `for` 插入/删除/移动/复用；
- Handler 注册和事件目标；
- App/Shared/Page 模块缓存；
- 缺失资源、错误路由和版本不兼容；
- debug/release 包结构。

## 4. 指标

```text
build.total_ms
build.phase_ms.*
artifact.rpk_bytes
artifact.ir_bytes.*
artifact.bundle_bytes.*
artifact.duplicate_module_bytes
artifact.page_entry_count
```

所有性能阈值放入 Benchmark Spec，不在此处凭空设定。

