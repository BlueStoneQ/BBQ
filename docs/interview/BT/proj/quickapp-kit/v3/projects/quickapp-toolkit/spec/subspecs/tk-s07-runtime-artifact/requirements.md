# TK-S07 Requirements

## 目录

- [1. 结论](#1-结论)
- [2. 输入不变量](#2-输入不变量)
- [3. Artifact 输出](#3-artifact-输出)
- [4. 安全与资源](#4-安全与资源)
- [5. 失败与确定性](#5-失败与确定性)
- [6. Case 与禁止范围](#6-case-与禁止范围)

## 1. 结论

TK-S07 的验收单位是一个“可验证、可重复、可被 Core 打开”的 Runtime RPK。任何输入关系不闭合、成员不安全、描述符不一致或资源超过边界的构建都必须失败且不得发布半成品。

## 2. 输入不变量

| ID | 需求 |
|---|---|
| TK-S07-R01 | 只接受 `CanonicalLoweredAppModel`、S05 成功 Bundle/Source Map、S06 成功 Page IR、已验证 Manifest/资源快照。 |
| TK-S07-R02 | 输入必须属于同一 Build Session 的成功结果；不得重新解析 DSL、重新 Lower 或重新分配任何 Template ID。 |
| TK-S07-R03 | Model、Manifest、Bundle、Page IR、资源 bytes 及嵌套集合必须在构建前可证明不可变；不得使用跨 Session 可变缓存。 |
| TK-S07-R04 | App、Shared、Page moduleId 全局唯一，Bundle 数量等于 Canonical Model 的模块闭包，Page IR 数量等于页面闭包。 |
| TK-S07-R05 | Manifest pages 与 Canonical pages 必须按 `manifestRoute` 双向一一对应；Widget 不进入 V1 Runtime Artifact。 |
| TK-S07-R06 | 每个 Page Bundle 和 Page IR 必须能通过同一 Page 的 `moduleId`、route、templateId 关系闭合。 |

## 3. Artifact 输出

| ID | 需求 |
|---|---|
| TK-S07-R07 | Runtime Metadata 必须使用公共固定版本：`quickapp-kit-rpk-v1`、`quickapp-kit-runtime-v1`、`quickapp-kit-app-module-v1`、`irVersion=1`。 |
| TK-S07-R08 | Runtime Metadata 必须包含 packageId、toolkit、buildMode、entryRoute、App、Shared、Page 和 resources 索引；App/Shared/Page 均携带与对应 Bundle define 完全一致的 `dependencies[]`。 |
| TK-S07-R09 | 每个 Artifact Descriptor 必须包含 `path`、`mediaType`、`byteLength` 和小写十六进制 SHA-256。 |
| TK-S07-R10 | `manifest.json`、`quickapp-kit/runtime.json`、`app.js`、已索引 Bundle、Page IR 和资源必须发布为对应 RPK member。 |
| TK-S07-R11 | Page Bundle 路径必须为 `pages/<manifestRoute>/index.js`；Page IR 路径必须为 `quickapp-kit/pages/<manifestRoute>/index.ir.json`。 |
| TK-S07-R12 | Source Map 必须以 `META-INF/quickapp-kit/source-maps/<bundle.path>.map` 发布，不参与 Runtime Metadata 的执行入口猜测。 |
| TK-S07-R13 | Runtime Metadata 中的 Bundle/Page IR/资源 Descriptor 必须与实际 member 的长度和 SHA-256 一致；Package dependencies 只能引用包内 App/Shared 模块，禁止自依赖、未知模块、Shared cycle、Page target 和 typed facade。 |
| TK-S07-R14 | RPK 必须是 Core 可接受的 ZIP；V1 使用无压缩、UTF-8、无时间漂移的确定性 Store ZIP。 |

## 4. 安全与资源

| ID | 需求 |
|---|---|
| TK-S07-R15 | member path 必须是相对路径，禁止空段、`.`、`..`、反斜线、NUL、绝对路径和超长 UTF-8 路径。 |
| TK-S07-R16 | 禁止重复 member path；成员必须按 UTF-8 字节序稳定排序。 |
| TK-S07-R17 | 必须限制总包 bytes、展开 bytes、member 数、member bytes、ZIP central directory bytes 和 Diagnostic 数量。 |
| TK-S07-R18 | 必须对齐 Core Loader 的页面数 128、Manifest 1 MiB、Runtime Metadata 1 MiB、Page IR 4 MiB 上限。 |
| TK-S07-R19 | Metadata 序列化和 Manifest 序列化必须是 UTF-8、无 BOM、固定换行；Schema 校验失败必须拒绝输出。 |
| TK-S07-R20 | 上游只能向 S07 提交已验证的资源快照；S07 以只读 bytes 消费，不在 Artifact 阶段重新发现 Workspace、读取路径或伪造来源证明。 |

## 5. 失败与确定性

| ID | 需求 |
|---|---|
| TK-S07-R21 | 取消必须返回稳定取消 Diagnostic；不得发布部分结果。 |
| TK-S07-R22 | 关系、路径、Schema、预算、ZIP 或输入不变量失败必须返回 TK-S07 Diagnostic；不得抛出裸异常或发布部分 RPK。 |
| TK-S07-R23 | 同一输入重复构建，Runtime Metadata、成员顺序、member bytes、RPK bytes 和 SHA-256 必须一致。 |
| TK-S07-R24 | 构建成功结果发布必须是单次原子结果；失败结果不得携带 members、metadata 或 packageBytes。 |
| TK-S07-R25 | 关闭观测或不提供外部采集器不得改变 Artifact 结果；TK-S07 只输出 Build 侧证据，不实现 Runtime TraceSink。 |

## 6. Case 与禁止范围

| ID | 需求 |
|---|---|
| TK-S07-R26 | Case 001 必须生成 App/Shared/Page Bundle、Page IR、Manifest、Runtime Metadata、资源和可被 Core 打开的 RPK。 |
| TK-S07-R27 | Case 001 必须验证 `PackageLoader::open`、App Module、Page Module 和入口 Page IR 加载。 |
| TK-S07-R28 | 必须提交 source manifest、RPK 解包检查、Core Loader 输出、Case 001 输入和确定性 SHA-256 evidence。 |
| TK-S07-R29 | 不得实现签名、RPKS、完整 inspect/run、TK-S08、TK-S09、Skill/MCP 或后续生态能力。 |
| TK-S07-R30 | 不得修改公共 Artifact Contract、Runtime Launch Profile、Page IR Schema、JS ABI 或 Core Loader 合同；缺口只能记录 `[待决策]`。 |
