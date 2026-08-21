# TK-S07 Runtime Artifact

## 目录

- [1. 结论](#1-结论)
- [2. 目标](#2-目标)
- [3. 边界](#3-边界)
- [4. 输入输出](#4-输入输出)
- [5. 交付物](#5-交付物)
- [6. 追溯关系](#6-追溯关系)
- [7. 状态](#7-状态)

## 1. 结论

TK-S07 的本质是：把已经由 TK-S05/TK-S06 生成的 Bundle、Source Map、Page IR，与已验证的 Manifest/资源快照，封装成一个满足公共 Artifact Contract、可由 Core `PackageLoader` 打开的确定性 Runtime RPK。

TK-S07 不重新解析 DSL、不重新 Lower、不重新分配 Template ID，也不解释 Runtime 语义。它只负责 Artifact 的关系闭包、描述符完整性、ZIP 发布和失败边界。

## 2. 目标

Case 001 是唯一 Alpha 验收基线：

```text
Case 001 Source
  -> TK-S02/TK-S03 Resolved/Parsed input
  -> TK-S04 Canonical Lowered Model
  -> TK-S05 App/Shared/Page Bundle + Source Map
  -> TK-S06 Page IR
  -> TK-S07 Runtime Metadata + Runtime RPK
  -> Core PackageLoader::open/load_module/load_page_ir
```

成功标准是 Core 可以打开 Toolkit 自己生成的 Runtime RPK，而不是直接复用联盟 RPK/RPKS。

## 3. 边界

### 3.1 拥有

- Runtime Metadata 生成。
- Artifact Descriptor 生成：`path`、`mediaType`、`byteLength`、小写 SHA-256。
- App/Shared/Page Bundle 与 Page IR 的关系索引。
- Manifest、资源和 Source Map 的成员发布。
- RPK 路径安全、预算、确定性和原子发布。
- TK-S07 诊断、取消和证据。

### 3.2 不拥有

- DSL 解析、Module Graph、Canonical Lowering。
- Bundle 内容生成、Page IR 生成或 Template ID 分配。
- Core Runtime Tree、JS 执行、Platform Render。
- 签名、RPKS、完整 `inspect`/`run`。
- TK-S08、TK-S09、Skill/MCP 和后续生态能力。

## 4. 输入输出

### 4.1 输入

输入必须是同一 Build Session 的只读结果：

| 输入 | 来源 | TK-S07 行为 |
|---|---|---|
| `CanonicalLoweredAppModel` | TK-S04 | 作为唯一模块、页面和 Template ID 语义来源 |
| App/Shared/Page Bundle + Source Map | TK-S05 | 只校验模块闭包并发布 |
| Page IR | TK-S06 | 只校验页面关系并发布 |
| `ResolvedManifest` | TK-S02 | 发布 `manifest.json` 并生成 Runtime Metadata |
| 已读取资源快照 | TK-S02/SourceAccess | 发布资源成员及 Descriptor |
| 公共 Artifact/Page IR Schema | v3 公共合同 | 验证输出 |

Manifest/资源是 Artifact 所需的已验证输入快照，不构成第二套语义模型。

### 4.2 输出

成功结果只包含：

- Runtime Metadata。
- 已索引的 RPK 成员及 Descriptor。
- 确定性的 Runtime RPK bytes。

失败结果只包含有界、可排序的 Diagnostic，不包含部分 Metadata、成员或 RPK bytes。

## 5. 交付物

| 文件 | 内容 |
|---|---|
| [`requirements.md`](./requirements.md) | TK-S07 必须满足的需求和禁止事项 |
| [`design.md`](./design.md) | 输入、关系、Metadata、ZIP、预算与失败设计 |
| [`tasks.md`](./tasks.md) | 实现、测试、证据和交接任务 |
| [`acceptance.md`](./acceptance.md) | Case 001、Core Loader、Schema、确定性和负例验收 |

实现对应：

- `quickapp-toolkit/src/compiler/artifact/types.ts`
- `quickapp-toolkit/src/compiler/artifact/runtime-artifact-builder.ts`
- `quickapp-toolkit/test/integration/runtime-artifact.test.ts`

## 6. 追溯关系

```text
TK-S04 model
  -> S05/S06 output relation
  -> Runtime Metadata relation index
  -> Descriptor-indexed RPK members
  -> Core PackageLoader verification
```

公共合同以 v3 `spec/contracts/artifact-contract.md`、相关 Schema 和 Core PackageLoader 合同为准；本分 Spec 不复制或修改公共 Schema。

## 7. 状态

| 项目 | 状态 |
|---|---|
| Alpha 实现 | `ALPHA_ARTIFACT_VERIFIED` |
| RPK 字节 | 已冻结，补件不得重建 |
| 详细分 Spec | 本次补齐 |
| TK-S08/TK-S09 | 未启动 |
