# CI/CD 流水线全链路卡控

## 目录

- [一条典型的大前端 CI/CD 流水线](#一条典型的大前端-cicd-流水线)
- [卡控点设计](#卡控点设计)
- [全链路卡控](#全链路卡控)
- [经验映射](#经验映射)

---

## 一条典型的大前端 CI/CD 流水线

```
代码提交（git push）
    ↓ 触发 CI
Stage 1: 静态检查（秒级）
  ESLint / TypeScript 类型检查 / Commit Message 校验 / 敏感信息扫描
    ↓
Stage 2: 构建（分钟级）
  依赖安装（npm ci）→ 编译构建 → 产物归档
    ↓
Stage 3: 测试（分钟级）
  单元测试 → 集成测试 → 覆盖率检查
    ↓
Stage 4: 质量门禁（卡控点）
  包体积检查 / 性能基线对比 / 安全扫描 / Code Review 通过
    ↓
Stage 5: 部署/发布
  灰度发布（1%→10%→50%→100%）→ 监控告警 → 自动回滚
```

## 卡控点设计

| 卡控点 | 阶段 | 阻断/告警 | 说明 |
|--------|------|----------|------|
| ESLint 不通过 | 提交时（Git Hooks） | 阻断 | 本地拦住，不进 CI |
| Commit Message 格式错 | 提交时 | 阻断 | Conventional Commits |
| TypeScript 类型错误 | CI Stage 1 | 阻断 | 编译不过不让合 |
| 单测失败 | CI Stage 3 | 阻断 | 测试不过不让合 |
| 覆盖率低于阈值 | CI Stage 3 | 告警/阻断 | 新代码必须有测试 |
| 包体积超标 | CI Stage 4 | 告警 | 超过基线需审批 |
| 性能回归 | CI Stage 4 | 告警 | 启动耗时/帧率劣化 |
| 安全漏洞 | CI Stage 4 | 阻断（高危） | 依赖漏洞扫描 |
| Code Review 未通过 | CI Stage 4 | 阻断 | 至少 1 人 approve |
| 灰度期间崩溃率上升 | 发布后 | 自动回滚 | 监控联动 |

## 全链路卡控

```
编码时：IDE 插件实时提示（ESLint/Prettier）
    ↓
提交时（Git Hooks）：pre-commit lint-staged + commit-msg commitlint
    ↓
推送时（CI）：全量 lint + 类型检查 + 单测 + 覆盖率
    ↓
合并时：Code Review 人工审批 + 自动化检查全部通过
    ↓
发布时：灰度 + 监控 + 自动回滚
```

## 经验映射

| 做过的 | 对应阶段 |
|--------|---------|
| MT 脚手架 CLI | 项目初始化标准化 |
| MT CI/CD 流程建设 | Stage 2-5 全流程 |
| MT 发布插件（KeyPerson 审批） | Stage 4 人工审批卡控 |
| XT 全链路代码质量治理 | 编码时 → Git Hooks → CI 全链路 |
| XM 性能分析平台 CI/CD | Stage 5 一键部署 + 灰度 |
| XM 快应用 CI 构建修复 | Stage 2 构建环境维护 |
