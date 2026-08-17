# CORE-S02 需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. V1 资源上限](#4-v1-资源上限)
- [5. 质量需求](#5-质量需求)
- [6. 非目标](#6-非目标)
- [7. 需求追踪](#7-需求追踪)

## 1. 结论

Loader 的本质是信任边界：只有通过容器、Schema、关系、版本、长度和摘要全部校验的数据，才能被标记为 verified 并进入 Runtime。

## 2. 输入与输出

### 2.1 输入

- Host 注入的 `PackageSource`。
- 公共 Artifact、Package、Page IR、Module Load 和 Runtime Composition 合同。
- Composition Root 注入的运行时组合信息、时钟、TraceSink 和固定限制。

### 2.2 输出

- `VerifiedPackage`：包身份、Manifest/Metadata typed view、成员索引、页面和模块描述符、组合预检结果。
- `PageIrHandle`：被 cache pin 的 immutable verified Page IR。
- `VerifiedModule`：已完成路径、长度、摘要和依赖关系复核的 immutable Bundle bytes。
- typed error、结构化 TraceEvent 和确定释放的 Package Session。

## 3. 功能需求

| ID | 需求 |
|---|---|
| CORE-S02-R01 | `PackageSource` 必须只暴露 `size()`、异步 `readAt(offset,length,completion)` 和幂等 `close()`；不得暴露路径、文件描述符、平台流或可变共享缓冲区。 |
| CORE-S02-R02 | 每次读请求必须使用 `RequestId`，completion 恰好一次回到 Core ingress；越界、短读、关闭后读取和 late completion 必须得到确定结果。 |
| CORE-S02-R03 | Loader 必须先验证 ZIP 中央目录、成员路径、重复项、压缩方法和资源上限，再读取 Manifest、Runtime Metadata、Page IR 或 Bundle。 |
| CORE-S02-R04 | V1 只接受 `Store` 与 `Deflate`；拒绝加密、多卷、ZIP64、符号链接、绝对路径、反斜杠、`.`/`..` 段和规范化后重复路径。 |
| CORE-S02-R05 | 缺少 `quickapp-kit/runtime.json` 必须在 Bundle 执行前返回 `PACKAGE_FORMAT_UNSUPPORTED`；Core 不直接执行联盟产物。 |
| CORE-S02-R06 | 必须严格校验 `manifest.json`、Runtime Metadata 和每个 Page IR 的公共 Schema、固定版本及 UTF-8/JSON 结构；不得用字符串拼接解析结构化数据。 |
| CORE-S02-R07 | 必须校验 Manifest 与 Metadata 的 package、entry、route/page 一一对应，模块 ID 全包唯一，依赖存在且无非法自依赖，所有描述符路径/长度/SHA-256 与 ZIP 成员一致；除 Manifest、Runtime Metadata 和 `META-INF/**` 外，可读 ZIP 成员与 Artifact Descriptor 必须双向覆盖。 |
| CORE-S02-R08 | 必须校验 Page IR root、可达性、无环、单父、模板 ID 唯一、Block 引用次数、scope、binding/handler target 与 owner 关系。 |
| CORE-S02-R09 | 必须在任何 JS 执行前，聚合全部 Page IR 的 required components 与 Manifest features，并依据 Runtime Composition Contract 完成兼容性预检。 |
| CORE-S02-R10 | `VerifiedPackage` 必须不可变，只有状态达到 executable 后才能发布；失败状态不得发布部分索引或可执行对象。 |
| CORE-S02-R11 | `PageIrHandle` 必须持有 normalized immutable tables/indexes 和 cache pin；它是 S02 与 S05 的唯一页面定义连接，不包含运行时 Node、Block、Handler 或平台对象。 |
| CORE-S02-R12 | Page IR cache 必须有固定字节预算、确定的 LRU eviction 和 pin 语义；已 pin 页面不得驱逐，最后一个 handle 释放后才可驱逐。 |
| CORE-S02-R13 | 验证阶段必须遍历并校验全部 Page IR；完成预检后可以驱逐未 pin 的解析结果，但 `VerifiedPackage` 必须保留足以重新验证加载的 descriptor 和聚合需求。 |
| CORE-S02-R14 | `VerifiedModule` 必须按 Module Load Contract 交付 immutable bytes、模块身份、依赖、作用域和预期 ABI 字段；不得交付路径、fd 或平台句柄。 |
| CORE-S02-R15 | 每次模块读取都必须在交付前再次验证成员路径、解压长度、CRC 和 SHA-256；失败不得污染任何模块缓存。 |
| CORE-S02-R16 | `VerifiedModule` 必须为 app/shared 填写 AppRuntime cache scope，为 page 填写 Surface cache scope；S02 不拥有 JS Module Cache，Result 后释放 Core 在途 bytes。每个 AppRuntime 同时最多一个已交付未完成的 module load。 |
| CORE-S02-R17 | Loader、Page IR cache 和 module handoff 必须有明确所有权；Package Session 关闭后不得仍有在途 source read，销毁后计数和已占缓存字节归零。 |
| CORE-S02-R18 | Package open 与 module load 必须发出公共 Observation Contract 要求的 started/completed/failed 事件；Trace 失败不改变 Loader 结果。 |
| CORE-S02-R19 | 所有输入失败必须映射为公共 typed error；不得传播解析器、ZIP 库或分配器异常。 |
| CORE-S02-R20 | 必须提供 memory-backed Fake PackageSource、可控短读/延迟/重复 completion/OOM 注入及合法和恶意 RPK 夹具。 |

## 4. V1 资源上限

以下是 Runtime Core 的 V1 一致性固定上限。V1 Conformance 实现不得按平台改变；未来若需要更小 profile，必须以新合同显式声明，不能静默改变本表：

| 项目 | 上限 |
|---|---:|
| PackageSource 总字节 | 32 MiB |
| ZIP 成员数 | 2048 |
| 中央目录 | 2 MiB |
| 单个逻辑路径 UTF-8 长度 | 512 bytes |
| 单成员解压后大小 | 16 MiB |
| 全包声明解压后总大小 | 64 MiB |
| 单成员压缩比 | 200:1 |
| Manifest / Runtime Metadata | 各 1 MiB |
| 单个 Page IR | 4 MiB |
| 单个 Bundle | 16 MiB |
| 页面数 | 128 |
| 单页 nodes / bindings / blocks / handlers | 4096 / 8192 / 2048 / 8192 |
| JSON 最大嵌套深度 | 64 |
| Page IR parsed cache | 8 MiB |

计数和加法必须使用 checked `uint64`；在分配或解压前拒绝超限输入。单页 normalized Page IR 无法放入 cache 预算，或全部 cache entry 被 pin 且无空间时，返回 `OUT_OF_MEMORY`，不得绕过预算。

## 5. 质量需求

| 维度 | 要求 |
|---|---|
| 确定性 | 相同字节、组合配置和 source completion 顺序必须产生相同 verified 结果或同一 typed error。 |
| 内存 | 不预解压全包；读取和解析使用有界 scratch；cache 和在途模块字节必须计费。 |
| 线程 | Loader 状态、索引和 cache 只有 Core Runtime Thread 写；Source 可异步读，但 completion 只投递不可变结果。 |
| 安全 | 任何路径、长度、偏移和计数在使用前校验；不信任中央目录、local header 或 JSON 数值。 |
| 可移植 | 公共和 Core 头文件不出现具体平台或执行引擎类型。 |
| 可测试 | 不依赖真实文件系统、JS 或 UI 即可覆盖全部成功和失败路径。 |

## 6. 非目标

- 不实现数字签名、证书链、加密包和远程下载。
- 不把联盟 RPK/RPKS 转为 Runtime RPK；该职责属于 Toolkit/转换工具。
- 不执行 `$app_define$`、`$app_bootstrap$`、`$app_require$` 或页面模块。
- 不维护 Surface、运行时节点、动态 Block 或事件回调。
- 不承诺 Page IR cache 命中是业务语义；eviction 只影响性能。

## 7. 需求追踪

| 上级合同 | 本分 Spec |
|---|---|
| Artifact/Package Contract | R01-R07、R10、R17、V1 上限 |
| Page IR Contract | R08、R11-R13 |
| Runtime Composition Contract | R09 |
| Module Load Contract | R14-R16 |
| Error/Observation Contract | R18-R20 |
