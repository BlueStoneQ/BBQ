# Toolkit v3 Tasks

## 目录

- [结论](#结论)
- [Spec](#spec)
- [Code](#code)

## 结论

第五次定向复核 `PASS`；Toolkit 当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 TK-S01。Skill/MCP、签名和完整 Benchmark 不参与 V1。

## Spec

- [x] Case 001/002 与联盟产物基线核对。
- [x] `requirements.md`。
- [x] `architecture.md`。
- [x] `subspec-index.md`，拆分 Compiler、Artifact、Package、CLI 和 Testing；Agent Adapter 后置。
- [x] `acceptance.md`，覆盖 Case 001/002、Widget 排除和可观测证据。
- [x] Toolkit 总 Spec 独立校审。
- [ ] 按 `subspec-index.md` 逐个设计、校审 V1 分 Spec。

## Code

- [ ] 对应分 Spec 校审通过后初始化工程。
- [ ] 按分 Spec 分阶段实现。
- [ ] Case 001/002 端到端验证。

后续 Release profile：Ed25519/PackageOpenPolicy 仅保留为总合同草案，不进入当前任务。
