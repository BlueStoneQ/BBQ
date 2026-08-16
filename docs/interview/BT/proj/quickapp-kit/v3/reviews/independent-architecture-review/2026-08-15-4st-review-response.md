# QuickApp Kit v3 四审整改对照

日期：2026-08-15

## 目录

- [1. 结论](#1-结论)
- [2. P0 整改](#2-p0-整改)
- [3. P1 整改](#3-p1-整改)
- [4. 验证](#4-验证)
- [5. 当前门禁](#5-当前门禁)

## 1. 结论

四审提出的 3 个 P0 和 7 个 P1 已逐项落入公共文档、Schema、项目入口和自动 Contract Test。当前状态是“具备五审输入”，不自行宣布总架构通过。

## 2. P0 整改

| 四审项 | 修订结果 | 权威入口 |
|---|---|---|
| Surface 结果/ABI 不一致 | Create、Destroy、Instantiate、Handler 全部使用各自 success/failure 判别联合；删除通用失败消息；新增 SurfaceContext 和 `onSurfaceContext` | `spec/contracts/surface-control.md`、`schemas/surface-control.schema.json`、`runtime-abi.md` |
| Feature/Router 边界冲突 | Navigation 归 Core Surface Controller；ShowToast/SetTitleBar/SetMeta 归 Platform Feature Adapter；全部改为强类型请求/结果 | `navigation-contract.md`、`feature-contract.md`、对应 Schema |
| 实施门禁过早 | 冻结为“总架构通过 -> 项目 Spec -> 全部项目 Spec 校审通过 -> 编码” | `AGENT-WORK-BOARD.md`、根 `README.md`、各项目 Handoff |

## 3. P1 整改

| 四审项 | 修订结果 |
|---|---|
| 终态 Mount failure | 首次失败 `rebuildSurface`；full retry 再失败 `recreateSurface`；普通更新最终返回 `presentationFailed` |
| ID 前缀 | 所有公共消息 Schema 强制 `srf/cmp/blk/hdl/node/txn/mnt/req` |
| RuntimeError 不一致 | Schema 统一 `surfaceId/requestId/transactionId/mountAttemptId` 可选关联字段 |
| Case 001/002 描述 | Case 001 只验证联盟页面闭环；Case 002 验证状态更新、if、keyed for |
| Widget 范围 | V1 排除 Case 001 CardDemo；必须报告 `TK_WIDGET_EXCLUDED_V1`，strict all-entry 下报错 |
| Host 默认值/约束 | Button 缺失 enabled 时 Toolkit 补 `true`；size 非负、margin 可负；UpdateProp 限定 text/enabled 并由 Core 校验目标类型 |
| Schema 离线解析 | 新增 `catalog.json` 和 Ajv strict Contract Test，预注册全部 `$id`，不访问 Schema URL |

## 4. 验证

```bash
cd spec/contracts/schemas/tests
npm test
```

当前结果：11 个公共 Schema 全部完成 Draft 2020-12 strict 编译；SurfaceContext、Navigation、Host Feature、终态 Mount 等正例通过；无前缀 ID、任意 UpdateProp、负 width 等反例被拒绝。

## 5. 当前门禁

五审通过前不启动任何项目 Spec。五审通过后，各项目可并行写 Spec；全部项目 Spec 校审通过后才进入编码。
