# TK-S02 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. 正例](#2-正例)
- [3. 负例](#3-负例)
- [4. 确定性与资源](#4-确定性与资源)
- [5. 需求覆盖](#5-需求覆盖)
- [6. 证据与通过条件](#6-证据与通过条件)

## 1. 结论

TK-S02 通过的本质是：从 Manifest 入口出发，每个可达源码、资源和 Capability 都能被唯一定位；未声明、歧义、越界和 V1 排除项都在 S04 前明确结束。

## 2. 正例

| Case | 必须结果 |
|---|---|
| `S02-P01` Case 001 Manifest | package 正确；entry `/pages/Demo`；2 Page；moduleId 与公共 fixture 一致 |
| `S02-P02` Case 001 closure | App/Page 入口经 Shared JS 引用闭包可达；所有 node/edge 有 source evidence |
| `S02-P03` Case 001 Capability | router/prompt required，fetch deferred，shortcut declaredOnly |
| `S02-P04` Case 001 asset | icon 定位到 `src/assets/images/logo.png`，bytes/hash 来自 SourceAccess |
| `S02-P05` Case 001 Widget | 恰有一个 `TK_WIDGET_EXCLUDED_V1` warning；CardDemo 不在图中 |
| `S02-P06` Case 001 context | `require.context('.', true, /\.js/)` 只枚举 helper/apis 下匹配 JS，排序确定，不含自身过滤语义推断 |
| `S02-P07` Case 002 | entry `/pages/Contract`；1 App、1 Page；无额外文件扫描 |
| `S02-P08` CAP-DEVICE-001 | Manifest declaration 与 `@system.device` 引用连接为 required relation |
| `S02-P09` Shared cycle fixture | SCC 被保留且每个模块只解析一次，不递归溢出 |
| `S02-P10` Fake S03 | S02 只消费 references，不读取或解释 AST payload |

## 3. 负例

| Case | 预期 |
|---|---|
| `S02-N01` 非法 JSON/重复 key | `TK_MANIFEST_INVALID_JSON` / `TK_MANIFEST_DUPLICATE_KEY` + range |
| `S02-N02` 公共 Manifest 字段缺失或类型错 | `TK_MANIFEST_SCHEMA_INVALID` |
| `S02-N03` entry 缺失、route 有 `/`/`..`/反斜线/空段 | `TK_ROUTE_ENTRY_NOT_FOUND` / `TK_ROUTE_INVALID`；S03 未调用 |
| `S02-N04` Page/App source 缺失 | source Diagnostic；无部分 graph |
| `S02-N05` local import 无 target/多 target/越界 | `TK_MODULE_NOT_FOUND` / `TK_MODULE_AMBIGUOUS` / Workspace path Diagnostic |
| `S02-N06` bare package 或 URL import | `TK_MODULE_DEPENDENCY_INVALID` |
| `S02-N07` Page 引用另一 Page 或 Shared 引用 App | `TK_MODULE_DEPENDENCY_INVALID` |
| `S02-N08` style import cycle | `TK_STYLE_IMPORT_CYCLE`，报告 cycle path |
| `S02-N09` context 非 literal | 由 S03 失败，S02 不尝试猜测 |
| `S02-N10` context/graph/edge/asset 超限 | `TK_CONTEXT_LIMIT_EXCEEDED` 或对应 graph limit Diagnostic，无无界读取 |
| `S02-N11` Capability 使用但未声明 | `TK_CAPABILITY_NOT_DECLARED` |
| `S02-N12` 声明并使用 V1 未支持 Capability | `TK_CAPABILITY_UNSUPPORTED_V1` |
| `S02-N13` moduleId/source target 冲突 | `TK_MODULE_ID_CONFLICT` |
| `S02-N14` 任一 error | 不返回 `ResolvedAppModel`，S04 不可调用 |
| `S02-N15` 不支持的 asset 类型 | `TK_ASSET_UNSUPPORTED`，不分配输出路径 |

## 4. 确定性与资源

1. 打乱 Manifest pages/features 字段顺序、Fake list 返回顺序后，规范模型 snapshot 不变。
2. 两次 clean graph build 的排序和序列化测试 snapshot 字节一致。
3. 取消发生后不再请求新 SourceUnit，late parser result 不进入已终止图。
4. 连续 100 次构建后 graph、position index、S03 handle 与队列回到基线。
5. graph 输出不保留 SourceUnit bytes、绝对路径、inode 或平台路径分隔符。

## 5. 需求覆盖

| 需求 | 证据 |
|---|---|
| R01-R03 | S02-P01/P07、S02-N01/N02 |
| R04-R07 | S02-P01/P07、S02-N03/N04/N13 |
| R08-R15 | S02-P02/P06/P09/P10、S02-N05..N10 |
| R16-R21 | S02-P03..P05/P08、S02-N11/N12 |
| R22-R24 | 确定性、取消、资源测试 |
| R25 | boundary scan、模型 snapshot |

## 6. 证据与通过条件

必须提交：

- Case 001/002 规范 Manifest 摘要、node/edge/capability/asset 数量与确定 hash。
- Widget、Capability、route、module、context、style cycle 结构化负例。
- Fake S03 隔离测试和真实 S03 联调结果。
- typecheck、lint、unit、integration、determinism、resource 与禁止范围扫描结果。

全部需求通过、无公共合同冲突并经总架构校审后，才可获得编码完成确认；TK-S04 仍由下一波次门禁控制。
