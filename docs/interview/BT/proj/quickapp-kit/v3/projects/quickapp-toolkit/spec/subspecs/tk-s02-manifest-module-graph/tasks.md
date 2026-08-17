# TK-S02 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)

## 1. 结论

实现顺序固定为“Manifest 事实 -> module identity -> reference resolver -> graph closure -> 关系验收”。当前文档不授予编码权限。

## 2. 门禁

编码前必须同时满足：

1. TK-S02 分 Spec 总架构校审 `PASS`。
2. 工作看板对 TK-S02 写出 `CODE_ALLOWED`。
3. S03 `SourceFrontendPort` 输入输出形态已通过同批校审。

## 3. 实现任务

### TK-S02-T01 Manifest parser

- 引入保留 offset 的 strict JSON parser。
- 检测非法 JSON、重复 key、字段类型并映射 SourceRange。
- 直接调用公共 Manifest Schema validator，不复制 Schema。

完成定义：Case 001/002 正例与 JSON/schema 负例稳定通过。

### TK-S02-T02 Manifest resolver

- 实现 route/component/source path 规范化。
- 建立 App/Page seed、entry 和 moduleId。
- 处理 features、icon、permissions 保留事实和 Widget 排除 warning。

完成定义：Case 001 精确得到 1 App、2 Page、1 excluded Widget；Case 002 得到 1 App、1 Page。

### TK-S02-T03 Reference resolver

- 实现 local JS/style/asset/Capability 固定解析规则。
- 实现 module ownership、歧义、越界与类型限制。
- 实现 `require.context` 有界、确定枚举。

完成定义：每个 S03 reference 只有唯一 target 或稳定 Diagnostic。

### TK-S02-T04 Module Graph

- 实现迭代式可达闭包、node/edge 去重和多 evidence 保留。
- 支持 Shared JS SCC，不允许递归栈失控。
- 实现 style cycle、moduleId/sourcePath 冲突和非法 Page 依赖校验。

完成定义：相同 SourceAccess 快照得到字节等价 graph snapshot。

### TK-S02-T05 Capability 与 Asset relations

- 实现 declared/referenced/required/deferred/declaredOnly 状态。
- 固定 router/prompt/device/fetch 规则。
- 建立 AssetNode，不分配输出 Artifact 字段。

完成定义：Case 001 shortcut 为 declaredOnly、fetch 为 deferred；CAP-DEVICE-001 为 required。

### TK-S02-T06 集成与边界测试

- 使用 Fake S03 Port 验证 S02 不解析源码语法。
- 使用真实 S03 Port 跑 Case 001/002 图闭包。
- 增加限制、取消、并发确定性、资源释放和禁止范围扫描。

完成定义：满足 Acceptance，且产品目录中没有 Lowering/Emitter/Artifact 实现。

## 4. 依赖顺序

```text
T01 -> T02
T02 + S03 Port -> T03
T03 -> T04 + T05
T04 + T05 -> T06
```

T01/T02 可与 S03 parser 实现并行；完整图闭包必须等待通过校审的 S03 Port，不复制临时 parser。

## 5. 完成定义

1. `TK-S02-R01..R25` 全部有直接测试或静态证据。
2. Case 001/002 与 CAP-DEVICE-001 关系符合冻结结果。
3. 错误图不产生可供 S04 使用的模型。
4. 输出无 AST 内容、Template/Runtime ID 和 Artifact 私有字段。
5. typecheck、lint、unit、integration、determinism、boundary scan 全部通过。
6. 更新证据和 Handoff 后提交实现校审；不得自行启动 TK-S04。
