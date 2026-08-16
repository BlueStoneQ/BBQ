# Toolkit Spec Tasks

## 目录

- [1. Spec 阶段](#1-spec-阶段)
- [2. 实现阶段](#2-实现阶段)
- [3. 验证阶段](#3-验证阶段)

## 1. Spec 阶段

- [x] 固定 Normalized IR Schema。
- [x] 固定 Template/Binding/Block/Handler/Style ID 规则。
- [x] 固定 Runtime Metadata 索引。
- [x] 固定 Page/Shared/App Bundle 依赖关系。
- [x] 固定错误码和诊断格式。
- [ ] 固定 Case 001 Golden 输出。

## 2. 实现阶段

- [x] 初始化 Node.js + TypeScript CLI。
- [ ] 接入联盟 `.ux` 前端 Adapter（对应 `features/frontend-adapter/`）。
- [x] 实现 Project Loader。
- [ ] 实现 Normalizer 和 ID 分配。
- [ ] 实现 IR Emitter。
- [ ] 实现 JS Bundle Emitter。
- [ ] 实现 RPK Packager。
- [ ] 实现 `inspect`、`build`、`validate` 命令（对应 `features/cli-validation/`）。

## 3. 验证阶段

- [ ] Case 001 构建差分。
- [ ] IR Schema Contract Test。
- [ ] 页面路由和懒加载测试。
- [ ] Shared Module 单例测试。
- [ ] Binding/Block/Handler Golden Test。
- [ ] 构建确定性测试。
- [ ] RPK Loader 联调。
- [ ] 构建耗时、产物大小和重复依赖 Benchmark。
