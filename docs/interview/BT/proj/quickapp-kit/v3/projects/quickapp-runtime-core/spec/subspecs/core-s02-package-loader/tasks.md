# CORE-S02 实现任务

## 目录

- [1. 结论](#1-结论)
- [2. 前置门禁](#2-前置门禁)
- [3. 任务](#3-任务)
- [4. 完成定义](#4-完成定义)

## 1. 结论

实现必须按“Source -> ZIP index -> typed validation -> immutable outputs -> cache/module handoff -> teardown”推进；任何阶段未通过，都不能提前暴露 verified 对象。

## 2. 前置门禁

- 本分 Spec 独立校审为 PASS。
- 工作看板将 CORE-S02 标记为 CODE_ALLOWED。
- CORE-S01 继续保持 VERIFIED。
- 公共 Artifact/Page IR/Module 合同没有未关闭 P0 冲突。

## 3. 任务

| ID | 任务 | 依赖 | 主要证据 |
|---|---|---|---|
| CORE-S02-T01 | 建立 Loader 模块、依赖扫描和 Package limits 常量 | 门禁 | Core-only build/scan |
| CORE-S02-T02 | 实现 PackageSource Gateway、单在途 read、RequestId 和 late completion 防护 | T01 | Fake source 并发/关闭测试 |
| CORE-S02-T03 | 集成成熟 ZIP/DEFLATE 库并实现有界中央目录、路径和 local-header 校验 | T02 | zip attack matrix |
| CORE-S02-T04 | 实现 Manifest/Metadata typed parser、Schema 和跨文件关系验证 | T03 | schema/relationship tests |
| CORE-S02-T05 | 实现 Page IR parser、图/scope/ID 验证和 normalized immutable tables | T04 | Page IR negative matrix |
| CORE-S02-T06 | 实现全部页面 required component 聚合与 Runtime Composition 预检 | T05 | unsupported composition tests |
| CORE-S02-T07 | 实现 VerifiedPackage 原子发布、source lease 和失败回滚 | T06 | no-partial-publication tests |
| CORE-S02-T08 | 实现有界 PageIrCache、pin/unpin、LRU eviction 和 reload | T07 | budget/pin/evict/OOM tests |
| CORE-S02-T09 | 实现 VerifiedModuleService、cacheScope 填写、单在途门禁、摘要复核和 immutable bytes handoff | T07 | module load contract tests |
| CORE-S02-T10 | 接入 Package/Module Trace、Fake、OOM/短读/重复 completion 故障注入 | T08-T09 | Noop/Recording 等价 |
| CORE-S02-T11 | 完成 close、取消、late result、资源归零与 sanitizer 验证 | T10 | teardown + ASan/TSan |
| CORE-S02-T12 | 生成实现证据并更新 Handoff，等待实现复核 | T11 | evidence 文档 |

## 4. 完成定义

- [ ] 合法 Case 001 Runtime RPK 可得到 `VerifiedPackage`、`PageIrHandle` 和 `VerifiedModule`。
- [ ] 所有非法输入在 Bundle 执行前以公共 typed error 终止。
- [ ] 资源上限在分配/解压前生效，无全包解压和无界 cache。
- [ ] pinned Page IR 不被驱逐，unpin 后可确定驱逐并可重载为相同语义。
- [ ] S02 代码及公共头无 Runtime Tree、平台或具体执行引擎依赖。
- [ ] Release、ASan/UBSan、TSan、依赖扫描和资源归零全部通过。
