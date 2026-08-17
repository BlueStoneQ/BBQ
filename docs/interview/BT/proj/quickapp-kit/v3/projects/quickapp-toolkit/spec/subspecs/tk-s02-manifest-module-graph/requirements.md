# TK-S02 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 功能需求](#2-功能需求)
- [3. 质量需求](#3-质量需求)
- [4. 非目标](#4-非目标)
- [5. 上游映射](#5-上游映射)

## 1. 结论

TK-S02 必须让每个 App/Page/Shared/Asset/Capability 关系只有一个来源、一个规范身份和一条可追踪解析链；任何歧义都在 Lowering 前失败。

## 2. 功能需求

| ID | 需求 |
|---|---|
| TK-S02-R01 | Manifest 必须由保留源码位置的严格 JSON parser 解析；comment、尾逗号、重复 key、非法 UTF-8、非 object 根和未知必需字段类型必须失败。 |
| TK-S02-R02 | 必须校验公共 `manifest.schema.json` 的 V1 字段，并额外拒绝会导致关系歧义的未知 route/page 形态；不得修改或复制公共 Schema。 |
| TK-S02-R03 | package、versionName、versionCode、minPlatformVersion、router.entry、router.pages 和每页 component 必须形成不可变 `ResolvedManifest`。 |
| TK-S02-R04 | `manifestRoute` 必须是无前导 `/` 的规范相对 route，不含反斜线、空 segment、`.`、`..`、NUL 或尾 `/`；Runtime route 必须唯一规范化为 `/<manifestRoute>`。 |
| TK-S02-R05 | entry 必须在普通 pages 中存在；普通 page 的 source path 固定由 `<sourceRoot>/<manifestRoute>/<component>.ux` 得到并经 `SourceAccess` 校验。 |
| TK-S02-R06 | App source 固定为 `<sourceRoot>/app.ux`；缺失 App 或普通 Page source 必须在调用 S03 前产生稳定 Diagnostic。 |
| TK-S02-R07 | moduleId 必须确定且全局唯一：App 为 `@quickapp-kit/app`，Page 为 `@quickapp-kit/page/<manifestRoute>`，Shared 为 `@quickapp-kit/shared/<source-relative-path-without-.js>`。 |
| TK-S02-R08 | Module Graph 必须从 App 与普通 Page 入口出发，只通过 S03 的 `UnresolvedReference` 扩展可达闭包；不得扫描并打包未引用源码。 |
| TK-S02-R09 | S02 必须解析 local JS、style、asset 和 Capability 引用；不得自行解析 UX/JS/Less token 或 AST。 |
| TK-S02-R10 | local module resolution V1 只接受 Workspace 内相对 specifier；按 exact path、`.js`、目录 `/index.js` 的固定顺序解析，歧义或越界必须失败。 |
| TK-S02-R11 | style import 只接受 Workspace 内相对路径；按 exact path、`.less`、`.css` 固定顺序解析，循环与歧义必须诊断。 |
| TK-S02-R12 | asset 必须解析为 Workspace 内普通文件并保留 source logical path、byteLength、SHA-256 与引用位置；S02 不分配 Artifact 输出路径。 |
| TK-S02-R13 | Graph node/edge 必须保留 owner module、reference kind、原 specifier、resolved target 和 source range；相同边去重但不得丢失多处引用证据。 |
| TK-S02-R14 | Module Graph 必须检测未知 target、moduleId 冲突、非法 Page-to-Page import、非法 App/Page ownership、无界 `require.context` 和资源类型不支持。 |
| TK-S02-R15 | `require.context` 必须使用 S03 解析出的 literal directory/recursive/RegExp 事实，在受限目录内确定枚举并按 UTF-8 logical path 排序；结果数量受显式上限控制。 |
| TK-S02-R16 | Manifest `features[].name` 必须去重并保留声明位置；保留 namespace 的非法名称必须失败。 |
| TK-S02-R17 | `system.router/prompt/device` 引用必须映射为 typed Capability relation；`system.fetch` 必须映射为 `deferred` relation；不得生成通用 Bridge module。 |
| TK-S02-R18 | 源码引用的 `@system.*` 必须在 Manifest 声明；未声明、V1 未支持或非 literal Capability 引用必须失败。 |
| TK-S02-R19 | 已声明但未引用的非 V1 Capability 必须标记 `declaredOnly`，不得进入 Runtime required Capability 集合；Case 001 的 `system.shortcut` 因此不阻塞构建。 |
| TK-S02-R20 | Manifest Widget/Card 必须逐项产生 `TK_WIDGET_EXCLUDED_V1` warning，并从 entry、page、module、asset 和 Capability 可达图排除。 |
| TK-S02-R21 | Manifest icon 等已支持资源字段必须解析为 asset relation；permissions、display 与其他保留字段只保留原 Manifest 事实，不在 S02 发明 Runtime 权限或 UI 语义。 |
| TK-S02-R22 | 输出必须按 manifestRoute、moduleId、resolved path、edge kind 和 source position 确定排序；同一 SourceAccess 快照必须字节等价。 |
| TK-S02-R23 | 任一 error Diagnostic 使 S02 不返回可供 TK-S04 消费的 `ResolvedAppModel`；warning 不改变图语义。 |
| TK-S02-R24 | 所有读取必须通过 TK-S01 `SourceAccess`，并服从 page/module/edge/context/asset 数量与 byte 上限、取消和 session 生命周期。 |
| TK-S02-R25 | S02 输出不得包含 Template/Binding/Block/Handler/Runtime ID、Host Component、Page IR、Bundle、Artifact Descriptor、RPK path 或平台类型。 |

## 3. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 不依赖目录返回顺序、locale、绝对路径、inode 或对象遍历偶然顺序。 |
| 单一所有权 | 引用语法由 S03 解析；引用解析和关系图只由 S02 负责。 |
| 可诊断 | 每个关系错误包含 manifest/source logical path、range、稳定 code 和修复方向。 |
| 安全 | 不访问 Workspace 外路径，不解析网络/package-manager module，不允许无界 context 枚举。 |
| 内存 | 图只保留结构、hash 和 source range，不复制 SourceUnit bytes 或完整 AST。 |
| 可扩展 | 新 route/resource/capability 类型通过 typed resolver 增加，不引入通用字符串插件系统。 |

## 4. 非目标

- 解释 Template、JavaScript 或 Less 语法。
- 评估 Binding、mixin、JS expression 或 VM。
- 规范化 Host Style 或生成稳定 Template ID。
- 写出公共 Manifest、Runtime Metadata、Bundle、Page IR 或 RPK。
- 执行 Capability、权限、路由或平台 API。

## 5. 上游映射

| 上游 | 覆盖 |
|---|---|
| `TK-R02` | R01-R13、R21-R25 |
| `TK-R10` | R16-R19 |
| `TK-R15` | R20、Case 001/002 与 CAP-DEVICE-001 验收 |
| Artifact Contract §4 | route/page/moduleId/dependency 一致性前置事实 |
| TK-S01 | SourceAccess、SourceUnit、Diagnostic、取消与 Build Session |
