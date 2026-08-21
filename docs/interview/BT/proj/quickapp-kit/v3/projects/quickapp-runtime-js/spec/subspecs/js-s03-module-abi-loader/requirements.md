# JS-S03 Module ABI 与 Loader：需求

## 目录

- [1. 结论](#1-结论)
- [2. 问题本质](#2-问题本质)
- [3. 输入与输出](#3-输入与输出)
- [4. 功能需求](#4-功能需求)
- [5. 质量需求](#5-质量需求)
- [6. 需求映射](#6-需求映射)
- [7. 非目标](#7-非目标)

## 1. 结论

Module Loader 必须把一次 verified load 处理成原子事务：**失败时不留下可见定义、实例、bootstrap、lease 或 bytes；成功时才一次提交可复用 Module Cache，并只完成原 RequestId 一次。**

## 2. 问题本质

S03 只解决三个问题：

1. 如何安全执行 Core 已验证的 immutable Bundle，而不接触包和平台。
2. 如何让 define/bootstrap/require 形成确定、可缓存、可失败的模块语义。
3. 如何验证 App/Page 动态导出与 Core 交付的静态期望一致，再把稳定定义交给 VM 层。

## 3. 输入与输出

| 方向 | 合同 |
|---|---|
| 输入 | JS-S02 typed `LoadVerifiedModule`；只读 bytes；expected bootstrap/ID 集合；JS-S01 Port/Executor |
| 输出 | typed `LoadVerifiedModuleResult`；ModuleDefinition/Bootstrap handle；资源与 Observation |
| 禁止 | 文件/RPK/Page IR 读取、可变 Core buffer、通用 module/method Bridge、VM/Hook 创建 |

## 4. 功能需求

| ID | 需求 |
|---|---|
| JS-S03-R01 | S03 只接受 JS-S02 投递的 `LoadVerifiedModule`；不得从 path、PackageSource、RPK、Runtime Metadata、Page IR 或源码目录自行读取模块。 |
| JS-S03-R02 | 进程内 Bundle 必须是 immutable byte storage 的共享所有权或一次所有权转移；执行前必须重验 `byteLength` 与 SHA-256，失败时不得进入 Engine。 |
| JS-S03-R03 | Bundle bytes 必须严格解码为 UTF-8 JavaScript，并以 verified logical path 仅作 source identity；path 不授予文件访问能力。 |
| JS-S03-R04 | Framework 必须在 Bundle 求值前安装 `$app_define$/$app_bootstrap$/$app_require$`；三者是 JS Framework Module ABI，不是 Runtime ABI Native Function Catalog，也不产生第二条 Bridge。 |
| JS-S03-R05 | `$app_define$(moduleId, dependencies, factory)` 对一个 load transaction 只允许调用一次，moduleId、ordered dependencies 与 request 必须精确一致，factory 必须 callable；额外、重复或 load 外 define 必须失败。 |
| JS-S03-R06 | App/Page Bundle 必须恰好调用一次 `$app_bootstrap$(moduleId, metadata)`，Shared 禁止 bootstrap；metadata 必须严格匹配 `expectedBootstrap` 的 kind/moduleId/templateId。Bootstrap 只登记描述，不创建 VM 或调用 Hook。 |
| JS-S03-R07 | `$app_require$` 只解析当前模块声明的 App/Shared dependency、当前 Framework 的 closed builtin specifier；未知、未声明、未 loaded 或 Surface 私有模块访问必须确定失败。 |
| JS-S03-R08 | Shared factory 在一个 AppRuntime 内最多成功执行一次；active evaluation stack 遇到 self/cycle 必须拒绝，不暴露 CommonJS partial exports，不留下半初始化实例。 |
| JS-S03-R09 | App/Shared cache key 必须包含 AppRuntime identity、packageId、moduleKind、moduleId 和 verified bundle identity；Page definition key 还包含 expected bootstrap/Binding/Handler contract fingerprint。 |
| JS-S03-R10 | 同一 Page definition 可被多个 Surface lease 复用；lease key 是 `SurfaceId + moduleId + definition generation`。Page definition/export 不得成为 Page VM，最后一个 lease 释放后才允许按策略回收定义。 |
| JS-S03-R11 | 同一 key 并发 load 必须共享一个 loading transaction 并分别完成各自 RequestId；同 moduleId 的冲突 identity 必须在执行新 bytes 前拒绝。 |
| JS-S03-R12 | cache entry 必须具有 `absent/loading/defined/evaluating/loaded/failed/releasing/released` 闭合状态；状态只在 JS Executor 上推进，不允许 loaded 与 failed 双终态。 |
| JS-S03-R13 | 任一失败都必须先回滚 staging。只有可由 immutable bytes、固定 expected contract 和固定 resolver 输入确定复现的内容失败（完整性、UTF-8/parse、Module ABI、依赖/cycle、Definition shape）才能进入 terminal failure cache；`OUT_OF_MEMORY`、`QUEUE_OVERFLOW`、scope closed 和 teardown cancellation 必须回滚到可重试状态，不污染 canonical identity。普通 JS exception 只有能证明属于该固定内容输入时才缓存，否则按 transient failure 处理。 |
| JS-S03-R14 | App export 必须严格是公共 Artifact Contract 冻结的 own data property Definition：`schemaVersion=1`、`kind="app"`、`createAppVm(appContext) -> AppVm`；Page 必须严格包含 `schemaVersion=1`、`kind="page"`、`createPageVm(surfaceContext) -> PageVm`、`bindingEvaluators` 和 `handlerMethods`，禁止 accessor/Proxy/未知字段，且两个十进制 key 集合分别与 expected ID 集合一一相等。 |
| JS-S03-R15 | evaluator 必须 callable；handler mapping value 必须是非空方法名；重复、0、非十进制、超 safe integer、缺失或额外 ID 均在 cache commit 前失败。S03 不执行 evaluator/method。 |
| JS-S03-R16 | `loaded` 只表示 Module ABI、bootstrap 和 export 已验证且 cache 已提交；不表示 VM initialized、Runtime Tree created、Mount 或 Present。 |
| JS-S03-R17 | 每个 accepted Core RequestId 最多发送一个 `LoadVerifiedModuleResult`；duplicate/late/cancelled request 不重执行 Bundle、不重建 entry、不复活已销毁 scope。 |
| JS-S03-R18 | Surface teardown 必须先关闭 Page load/lease admission，再取消 staging load、释放 lease 和 Surface pending completion；AppRuntime teardown 必须释放全部 Page/App/Shared entry、JsValueRef、bytes 和失败记录。 |
| JS-S03-R19 | Bundle bytes 只保留到 load terminal Result 被 S02 accepted 或 scope teardown；cache 不长期保存 bytes、源码字符串、Core 可变引用或 Page IR。 |
| JS-S03-R20 | cache entries、loading transactions、waiters、dependencies、evaluation depth、retained bytes 和 completion outbox 必须由 immutable config 限制；超限返回 `QUEUE_OVERFLOW`、`OUT_OF_MEMORY` 或 `MODULE_ABI_UNSUPPORTED`，不得隐式扩容。 |
| JS-S03-R21 | Module Observation 只记录公共 `module.load.*` 与资源计数事实，使用单调整数纳秒和结构化 ID；Noop/Recording 不得改变 cache、Result 或异常。 |
| JS-S03-R22 | Factory/exports/bootstrap handle 只能由所属 Context 和 JS Executor 访问；普通 JS 异常映射 `JS_EXCEPTION`，ABI/shape/cycle 映射 `MODULE_ABI_UNSUPPORTED`，必要分配失败映射 `OUT_OF_MEMORY`。 |

## 5. 质量需求

- 单一权威：S03 是 JS Module definition/instance cache 的唯一所有者。
- 失败原子：staging 不进入 committed cache；失败不泄漏可见 export。
- 有界：无无限依赖递归、无限 waiter、无限 deterministic failure entry 或长期 bytes 保留；transient failure 不进入 canonical cache。
- 平台无关：公共目标不引用 QuickJS、JNI、UIKit、LVGL、SDL 或文件 API。
- 可测试：Fake Engine 与 QuickJS 使用同一 Module ABI suite。
- 可观测：关闭 Observation 后 load 行为完全等价。

## 6. 需求映射

| 需求范围 | 设计章节 | 任务 | 验收 |
|---|---|---|---|
| R01-R04 | 3、4 | T01-T03 | A01-A07 |
| R05-R08 | 4、6 | T03-T05 | A08-A17 |
| R09-R13 | 5、7 | T04-T06 | A18-A28 |
| R14-R16 | 6 | T06 | A29-A35 |
| R17-R20 | 7、8 | T07-T08 | A36-A44 |
| R21-R22 | 9 | T08-T09 | A45-A50 |

## 7. 非目标

- 不兼容执行联盟原始 Bundle 或直接解析 `.ux`。
- 不创建 App/Page VM，不执行任何 lifecycle Hook。
- 不实现 Binding、Block、Handler 或 RenderTransaction。
- 不实现 typed Capability facade，只定义 `$app_require$` 到 resolver 的内部端口。
- 不维护 Core Surface/Navigation 状态，不读取 Platform 数据。
- 不实现热更新、跨 AppRuntime cache、磁盘 cache 或失败后自动换 Engine。
