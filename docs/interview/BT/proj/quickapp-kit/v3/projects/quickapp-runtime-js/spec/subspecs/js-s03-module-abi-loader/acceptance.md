# JS-S03 Module ABI 与 Loader：验收

## 目录

- [1. 结论](#1-结论)
- [2. 验收环境](#2-验收环境)
- [3. Verified input](#3-verified-input)
- [4. Module ABI](#4-module-abi)
- [5. Cache 与依赖](#5-cache-与依赖)
- [6. Export 与 Result](#6-export-与-result)
- [7. 销毁与资源](#7-销毁与资源)
- [8. 范围与证据](#8-范围与证据)

## 1. 结论

JS-S03 通过标准是：verified Bundle 成功时只产生一个合法 committed module entry，失败时不产生任何可见模块副作用；同一语义在 Fake Engine 与 QuickJS 完全一致。

## 2. 验收环境

- Fake Engine 与 QuickJS Provider 共用同一 Module ABI Contract Suite。
- Fake VerifiedModulePort、Fake FrameworkModuleResolverPort 和可编程 Core ingress。
- 可控制 Executor/Port 背压、OOM、异常、Surface/App teardown。
- 每例检查 Result、cache state、factory 次数、bytes/Value/lease/outbox 计数。

## 3. Verified input

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S03-A01 | 合法 immutable App bytes | length/SHA/UTF-8 通过后才进入 Engine |
| JS-S03-A02 | byteLength 不符 | `PACKAGE_INTEGRITY_FAILED`；Engine evaluate=0；cache=0 |
| JS-S03-A03 | SHA-256 不符 | 同 A02；不信任 verified 标签跳过检查 |
| JS-S03-A04 | 非 UTF-8 bytes | failed；无 source/Value/cache 泄漏 |
| JS-S03-A05 | logical path 指向真实文件 | 只作 source identity；无任何文件 open/read |
| JS-S03-A06 | packageId/cacheScope/surface 交叉错误 | Engine 前拒绝；正确 typed error |
| JS-S03-A07 | Page Surface generation 已关闭 | `SURFACE_NOT_FOUND`；不创建 transaction/lease |

## 4. Module ABI

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S03-A08 | 合法 App define/bootstrap | 各一次；只登记 definition/bootstrap，不创建 VM/Hook |
| JS-S03-A09 | 合法 Shared define | define 一次、bootstrap 零次；factory 尚未 require 时不执行 |
| JS-S03-A10 | 合法 Page define/bootstrap | moduleId/templateId 与 expected 完全一致 |
| JS-S03-A11 | 0/2 次 define 或额外 module define | transaction failed；staging 全清 |
| JS-S03-A12 | moduleId/dependency 顺序不符 | `MODULE_ABI_UNSUPPORTED`；factory 不执行 |
| JS-S03-A13 | factory 非 callable | commit 前失败 |
| JS-S03-A14 | App/Page 缺失或重复 bootstrap | commit 前失败；VM=0 |
| JS-S03-A15 | Shared 调用 bootstrap | commit 前失败 |
| JS-S03-A16 | load 外调用 Module ABI | 当前独立 JS operation 失败，不污染 cache |
| JS-S03-A17 | Runtime ABI Catalog 扫描 | 仍为 JS-S02 14 entry；无第二 Bridge/generic RPC |

## 5. Cache 与依赖

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S03-A18 | App/Shared 重复 load 同 key | Bundle/factory 成功次数最多一次；各 RequestId 正确完成 |
| JS-S03-A19 | 两 Surface load 同 Page key | definition/factory 一次、lease 两个、Page VM 零个 |
| JS-S03-A20 | 同 moduleId 不同 SHA/path/kind | 新 bytes 不执行；identity conflict failed |
| JS-S03-A21 | same-key loading join | 一个 transaction；waiter 有界；各自一个 Result |
| JS-S03-A22 | deterministic terminal failed cache hit | 完整性/ABI/shape/cycle 等确定性内容失败不重执行 Bundle；返回同类错误；新 RequestId 正确回显 |
| JS-S03-A23 | declared Shared dependency | 第一次 require 执行一次，后续返回同一 exports instance |
| JS-S03-A24 | diamond dependency | 共享底层 factory 只执行一次 |
| JS-S03-A25 | self cycle | 无 partial exports；active stack 恢复为空 |
| JS-S03-A26 | A -> B -> A | 顶层 load failed；参与 instance 不进入 loaded |
| JS-S03-A27 | undeclared/unresolved/Page dependency | 确定失败；不向 Core 发起隐式 load |
| JS-S03-A28 | cycle 后加载独立模块 | 独立模块成功，Engine/stack 未被污染 |

## 6. Export 与 Result

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S03-A29 | 合法 App export Definition | 仅有冻结的 own data property；`schemaVersion=1/kind=app/createAppVm` 精确成立；转为 typed view，不执行 onCreate |
| JS-S03-A30 | 合法 Page export Definition | `schemaVersion=1/kind=page/createPageVm/bindingEvaluators/handlerMethods` 精确成立；evaluator 的 `this/scope` 与 handler name 规则完整，且不创建 VM |
| JS-S03-A31 | Binding ID 缺失/额外/重复/0/非法十进制 | `MODULE_ABI_UNSUPPORTED`；cache 不提交 |
| JS-S03-A32 | Handler ID 缺失/额外/重复/超 safe integer | 同 A31 |
| JS-S03-A33 | evaluator 非 callable | commit 前失败 |
| JS-S03-A34 | handler method name 空/非 string/不存在 | commit 前失败 |
| JS-S03-A35 | `loaded` 时刻检查 | cache 已提交；VM/Runtime Tree/Mount/Present 仍为 0 |
| JS-S03-A36 | 正常 Result | 原 requestId/moduleKind/moduleId/surfaceId 恰好一次 |
| JS-S03-A37 | duplicate identical request | 不重跑、不重发 terminal Result，只记录 duplicate |
| JS-S03-A38 | 同 RequestId 不同 payload | ABI violation；不消费原 ledger/entry |
| JS-S03-A39 | Core queue 暂时 overflow | 同一 completion record 延后重投；Bundle/Hook 不重跑 |
| JS-S03-A40 | Core Port 在 teardown 关闭 | completion 释放；scope 不复活；资源归零 |

## 7. 销毁与资源

| ID | 场景 | 通过条件 |
|---|---|---|
| JS-S03-A41 | Surface close during Page load | generation 失效；staging/waiter/bytes/lease 清理；late load 不提交 |
| JS-S03-A42 | 关闭一个共享 Page Surface | 只释放其 lease；另一 Surface handle 仍有效 |
| JS-S03-A43 | AppRuntime teardown | Page/App/Shared Value、entry、failure、request、bytes、outbox 全为 0 |
| JS-S03-A44 | limits 全部打满 | 当前工作确定拒绝；已 committed entry/accepted load 不丢失；无隐式扩容；容量恢复后该请求可重试，不建立 failure identity |
| JS-S03-A45 | Engine/factory throw | 可证明由固定 content/resolver 输入产生时进入 deterministic failure cache；否则回滚到 absent；pending exception 清除，后续重试语义可观察 |
| JS-S03-A46 | OOM fault injection | `OUT_OF_MEMORY`；staging 原子回滚、不写 failure cache；资源恢复后同一 identity 可重试；最小 Trace 尽力发送 |

## 8. 范围与证据

| ID | 检查 | 通过条件 |
|---|---|---|
| JS-S03-A47 | dependency/boundary scan | 无 QuickJS public type、Platform、PackageSource、RPK/Page IR/file API、VM/Hook/Render 实现 |
| JS-S03-A48 | Require 边界 | builtin 只经 typed FrameworkModuleResolverPort；无 module/method/args 或 JSON Bridge |
| JS-S03-A49 | Observation 等价 | Noop/Recording 对 Result/cache/factory/error/teardown 完全等价；marker 通过公共 Schema |
| JS-S03-A50 | 完整证据 | Debug/Release/ASan/UBSan/TSan/API-only、资源归零、跨两个 Surface 的 Definition/lease 与独立 VM 隔离证据、源码摘要、R01-R22 与 A01-A50 映射齐全 |

`P0-JS-EXPORT-001` 已由公共 Artifact Contract 冻结；A29-A34 必须使用该精确 Definition shape，禁止临时测试替代。
