# TK-S07 Design

## 目录

- [1. 结论](#1-结论)
- [2. 架构位置](#2-架构位置)
- [3. 输入边界](#3-输入边界)
- [4. 关系与 Metadata](#4-关系与-metadata)
- [5. Member 与 ZIP](#5-member-与-zip)
- [6. 预算与失败](#6-预算与失败)
- [7. 可观测与禁止范围](#7-可观测与禁止范围)
- [8. 实现追溯](#8-实现追溯)

## 1. 结论

TK-S07 是一个纯 Artifact 后端：它不产生语义，只把已验证语义和已生成产物装进 Core 能读取的容器。唯一权威关系来自 Canonical Lowered Model 加 S05/S06 的对应产物；Runtime Metadata 是这个关系的可执行索引，不是第二套语义模型。

## 2. 架构位置

```text
S02 ResolvedManifest + asset snapshots
             |
S04 CanonicalLoweredAppModel
             |
     +-------+-------+
     |               |
 S05 Bundles     S06 Page IR
     |               |
     +-------+-------+
             v
       TK-S07 Artifact Builder
             |
             +--> Runtime Metadata
             +--> Artifact Descriptors
             +--> deterministic Runtime RPK
             v
       Core PackageLoader
```

TK-S07 的同步函数只在内存中生成局部中间值，成功时一次性冻结并发布 `RuntimeArtifact`；失败时只发布排序后的 Diagnostic。

## 3. 输入边界

### 3.1 唯一语义来源

`CanonicalLoweredAppModel` 提供：

- App、Shared、Page moduleId 和 moduleKind。
- Page route、manifestRoute、templateId。
- App、Shared、Page 的 package dependencies。
- App/Page 的 Canonical module 闭包。

TK-S07 必须透传这些身份和关系，不能用 Bundle 文件名、目录扫描结果或字符串猜测替代。

### 3.2 Artifact 辅助输入

`ResolvedManifest` 提供 `manifest.json` 的已验证 raw 快照、entry、pages、packageName 和 component 关系。资源输入必须携带已验证路径、mediaType 和 bytes。它们是 S02 输出的只读快照，不会被转化成另一个 App Model。

S05/S06 输入结果必须为 success；失败结果不能进入 S07。所有输入在进入 Builder 时执行递归冻结检查；Map/Set 等可变结构被拒绝。

## 4. 关系与 Metadata

### 4.1 固定版本

```text
schemaVersion = 1
packageFormat = quickapp-kit-rpk-v1
runtimeAbi = quickapp-kit-runtime-v1
irVersion = 1
jsModuleAbi = quickapp-kit-app-module-v1
```

### 4.2 Page 关系

对每个 Canonical Page：

```text
manifestRoute = pages/Demo
runtime route = /pages/Demo
Bundle path = pages/pages/Demo/index.js
Page IR path = quickapp-kit/pages/pages/Demo/index.ir.json
Page Bundle moduleId = page.moduleId
Page IR templateId = page.templateId
```

`pages/<manifestRoute>` 是公共 Artifact Contract 的路径公式，因此 manifestRoute 已带 `pages/` 时出现 `pages/pages/` 是合法且必须保留的结果；不得做“纠正”或归一化猜测。

### 4.3 Descriptor

```text
ArtifactDescriptor {
  path: logical relative path
  mediaType: public enum
  byteLength: UTF-8/binary bytes length
  sha256: lowercase SHA-256 over exact member bytes
}
```

Descriptor 从最终 bytes 计算。Runtime Metadata 中的 Descriptor 与实际 member 共用同一个 bytes 来源，避免序列化后再次漂移。

### 4.4 Metadata 索引

Runtime Metadata 包含：

```text
app: moduleId + dependencies + app bundle descriptor
sharedModules[]: moduleId + dependencies + bundle descriptor
pages[]: route + manifestRoute + component + moduleId
          + dependencies + templateId + bundle + pageIr
resources[]: descriptors
```

Manifest pages 与 Canonical pages 必须双向闭包；App/Shared/Page dependencies 逐项透传 S05 Bundle 的 Canonical package graph，并拒绝任何差异。Typed facade 不属于 Package graph。Widget 不写入 V1 Runtime Metadata。

## 5. Member 与 ZIP

固定 member：

```text
manifest.json
quickapp-kit/runtime.json
app.js
pages/<manifestRoute>/index.js
quickapp-kit/pages/<manifestRoute>/index.ir.json
assets/**
META-INF/quickapp-kit/source-maps/<bundle.path>.map
```

S05 的每个 Bundle 都有 Source Map；Source Map 放在 `META-INF/`，不作为 Core Runtime Metadata 的执行入口。所有 member path 先通过安全检查，再按 UTF-8 字节序排序；重复 path 直接失败。

V1 ZIP 使用 Store method、UTF-8 flag、无时间字段漂移、无 ZIP64、无 data descriptor、无 extra field。Local Header、Central Directory 和 EOCD 均由同一排序后的 member 列表生成。CRC32 用于 ZIP 完整性，Descriptor SHA-256 用于 Artifact 完整性。

## 6. 预算与失败

### 6.1 Core 对齐预算

| 预算 | 默认上限 |
|---|---:|
| Package bytes | 32 MiB |
| Expanded package bytes | 64 MiB |
| Member count | 2048 |
| Member bytes | 16 MiB |
| ZIP Central Directory | 2 MiB |
| Page count | 128 |
| Manifest bytes | 1 MiB |
| Runtime Metadata bytes | 1 MiB |
| Page IR bytes | 4 MiB |

任何预算在发布前超限都返回失败；不会保留此前生成的 members。

### 6.2 原子失败

```text
validate input
  -> build metadata
  -> build descriptors
  -> validate members and budgets
  -> serialize deterministic ZIP
  -> freeze and publish success
```

任一步骤失败、取消或 schema 不通过，结果只包含 Diagnostic。成功对象的 nested members、bytes、metadata 和 descriptors 均不可变。Builder 不写目标文件；文件发布由上层 Application/CLI 在后续产品流程中负责，避免 S07 在失败时留下半成品文件。

## 7. 可观测与禁止范围

S07 只提供构建结果和可供外层记录的结构化 facts：package bytes、package SHA-256、member descriptors、Case/Build identity。它不实现 Runtime TraceSink、平台 Collector、日志存储、签名或外部 Benchmark。

禁止依赖：Runtime Tree、JS Engine、Platform Adapter、LVGL、Android、iOS、S08 Inspect/Run 和 S09 Golden orchestrator。S07 不调用 Core，只通过公共 Artifact Contract 生成 Core 可读取输入；Core Loader 读取验证属于验收证据。

## 8. 实现追溯

| 设计部分 | 实现/证据 |
|---|---|
| 类型、版本、预算 | `src/compiler/artifact/types.ts` |
| Build、关系、Descriptor、ZIP | `src/compiler/artifact/runtime-artifact-builder.ts` |
| Diagnostic | `src/compiler/artifact/artifact-issue.ts`、`src/diagnostics/error-codes.ts` |
| Case 001、负例、确定性 | `test/integration/runtime-artifact.test.ts` |
| RPK 与成员 SHA-256 | `evidence/tk-s07.json`、`tk-s07-case001.rpk` |
| Core Loader | `evidence/tk-s07-core-loader.txt` |
| 源码清单 | `evidence/tk-s07-source-manifest.json` |
