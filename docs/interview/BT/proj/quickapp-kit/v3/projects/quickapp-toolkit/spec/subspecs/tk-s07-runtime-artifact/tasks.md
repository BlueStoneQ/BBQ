# TK-S07 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 任务清单](#2-任务清单)
- [3. 任务依赖](#3-任务依赖)
- [4. 完成门禁](#4-完成门禁)

## 1. 结论

TK-S07 已完成 Alpha 实现。本文件把已执行的实现、测试和证据任务固化为可追溯清单；补齐分 Spec 不重新执行或改变已冻结 RPK。

## 2. 任务清单

| ID | 任务 | 状态 | 输出 |
|---|---|---|---|
| TK-S07-T01 | 读取并锁定公共 Artifact Contract、Runtime Metadata Schema、Page IR Schema、Core Loader 上限 | `DONE` | `design.md`、Handoff |
| TK-S07-T02 | 定义 S04/S05/S06/Manifest/资源输入不变量与关系闭包 | `DONE` | `requirements.md`、`design.md` |
| TK-S07-T03 | 实现 Runtime Metadata 类型和固定版本字段 | `DONE` | `src/compiler/artifact/types.ts` |
| TK-S07-T04 | 实现 App/Shared/Page Bundle、Page IR、资源和 Source Map 索引 | `DONE` | `runtime-artifact-builder.ts` |
| TK-S07-T05 | 实现 Artifact Descriptor、长度/SHA-256 和 member 一致性校验 | `DONE` | `runtime-artifact-builder.ts`、Case 001 test |
| TK-S07-T06 | 实现路径安全、重复路径拒绝、member/包/页面/Schema 预算 | `DONE` | `runtime-artifact-builder.ts`、negative tests |
| TK-S07-T07 | 实现确定性 Store ZIP 生成 | `DONE` | RPK、ZIP inspection |
| TK-S07-T08 | 实现输入深不可变、取消、Diagnostic 和失败无部分结果 | `DONE` | `runtime-artifact-builder.ts`、negative tests |
| TK-S07-T09 | 使用 Case 001 贯通 S04 -> S05/S06 -> S07 输入闭包 | `DONE` | `runtime-artifact.test.ts` |
| TK-S07-T10 | 验证公共 Manifest/Runtime Metadata Schema，并消费已由 S06 Schema 验证的 Page IR | `DONE` | Case 001 integration test |
| TK-S07-T11 | 验证重复构建 package bytes/SHA-256 一致 | `DONE` | Case 001 integration test、`tk-s07.json` |
| TK-S07-T12 | 运行 `unzip -t` 并检查 central directory/member 清单 | `DONE` | `tk-s07.json` |
| TK-S07-T13 | 用 Core `PackageLoader` 打开 RPK，加载 App/Page/Page IR | `DONE` | `tk-s07-core-loader.txt` |
| TK-S07-T14 | 生成 source manifest、源 Manifest 副本、RPK 和机器证据 | `DONE` | `evidence/tk-s07-*` |
| TK-S07-T15 | 运行 typecheck/lint/build/全量测试/CLI 测试 | `DONE` | Handoff：76/76、17/17 |
| TK-S07-T16 | 由总架构完成 Alpha 校审并标记 `ALPHA_ARTIFACT_VERIFIED` | `DONE` | Toolkit Handoff |

## 3. 任务依赖

```text
T01 -> T02 -> T03/T04/T05 -> T06/T07/T08
                         -> T09/T10/T11
                         -> T12/T13/T14/T15
                         -> T16
```

TK-S08、TK-S09 不属于该任务图。它们不得因 TK-S07 完成而自动启动。

## 4. 完成门禁

TK-S07 的完成门禁全部满足：

1. Public Schema 未修改。
2. Alpha 定向语义修正后，RPK bytes、成员 Descriptor 与 SHA-256 已重新冻结。
3. Case 001 RPK 有 19 个成员，包大小 22029 bytes，SHA-256 为 `95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`。
4. `unzip -t` 通过，成员路径和 Descriptor 完整性通过。
5. Core PackageLoader 成功 `open`、加载 App/Page Module 和 `/pages/Demo` Page IR。
6. 代码门禁：typecheck、lint、build、npm test 76/76、CLI 17/17 全部通过。
7. S08/S09、签名、Skill/MCP、inspect/run 未实现。
