# JS-S03 Module ABI 与 Loader：任务

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 任务清单](#3-任务清单)
- [4. 完成定义](#4-完成定义)

## 1. 结论

未来实现按“接口与限制 -> Module ABI capture -> cache/require -> export 校验 -> completion/teardown -> 证据”推进。当前文档阶段不执行任何任务代码。

## 2. 门禁

- JS-S01/JS-S02 保持 `VERIFIED`。
- 本分 Spec 独立校审 `PASS` 且工作看板显式 `CODE_ALLOWED`。
- 公共 Artifact Contract 的 `P0-JS-EXPORT-001` 已冻结；T06 必须直接消费其机器形态，不创建临时测试 Definition。
- 不修改公共合同、Schema 或 JS-S02 14-entry Catalog。

## 3. 任务清单

### JS-S03-T01：冻结公共 C++ 边界

1. 定义 `VerifiedModuleConsumer`、`ModuleDefinitionHandle`、`PageModuleLease`、`FrameworkModuleResolverPort`。
2. 定义 `ModuleLoaderLimits/ResourceSnapshot` 和 closed error/result。
3. 所有 public header 仅依赖 JS-S01/S02 与标准 C++ 类型。

**完成定义**：编译期边界扫描无 QuickJS、Platform、PackageSource、Page IR 和文件 API。

### JS-S03-T02：实现完整性与 transaction staging

1. typed scope/package/cache admission。
2. immutable bytes ownership、length/SHA-256、UTF-8 与 source identity。
3. 预留 transaction、bytes 和 completion slot。
4. 失败反向释放。

**完成定义**：任一失败在 Engine/cache 可见前结束，bytes 与 staging 归零。

### JS-S03-T03：实现 Module ABI Host

1. 安装 transaction-bound `$app_define$/$app_bootstrap$/$app_require$`。
2. 精确校验调用次数、参数、factory 与 metadata。
3. 证明三者不属于 Runtime ABI Catalog、不调用 Core。

**完成定义**：App/Page/Shared 正负 Bundle fixture 全覆盖，14-entry Catalog 不变。

### JS-S03-T04：实现 Module Cache 与 identity

1. definition/instance/failure/request ledger/Page lease。
2. 完整 key、generation 和状态机。
3. same-key join、identity conflict、deterministic failed cache hit；transient failure rollback 后可重试。

**完成定义**：cache 只有一个 owner；无半提交、双终态和跨 AppRuntime 命中。

### JS-S03-T05：实现 require 与依赖求值

1. declared dependency 与 closed builtin resolver。
2. Shared lazy single evaluation。
3. active stack cycle/self-cycle detection。
4. unresolved/undeclared/Page-private 访问拒绝。

**完成定义**：diamond dependency 共享 instance；cycle 无 partial exports；独立模块后续仍可加载。

### JS-S03-T06：实现 bootstrap/export 校验

1. 消费已冻结的 `P0-JS-EXPORT-001` typed shape：`createAppVm/createPageVm`、evaluator `this/scope`、`handlerMethods`。
2. App/Page VM Definition view 及 own-property/无 accessor/无未知字段校验。
3. Binding/Handler canonical ID 集合与 value 类型校验。
4. 不执行 evaluator/handler，不读取 Page IR。

**完成定义**：Definition shape、缺失/额外/重复/非法 key 和错误 value 均在 commit 前失败；OOM/overflow/closed/cancel 返到可重试状态且不进入 failure cache。

### JS-S03-T07：实现 completion 与重复消息

1. 原 RequestId terminal Result 恰好一次。
2. bounded Completion Outbox 与 overflow retry continuation。
3. duplicate/late/collision/cancelled generation。
4. waiter 各自 completion，不重复 evaluate。

**完成定义**：Core 暂时背压不重跑 Bundle；scope close 后不复活 entry。

### JS-S03-T08：实现 teardown、限制与观测

1. Surface lease 与 AppRuntime cache teardown。
2. limits、计数器、OOM/overflow fault injection。
3. module marker、Noop/Recording 等价。
4. Value/bytes/request/outbox 归零。

**完成定义**：正常/失败/竞争销毁均确定释放，sanitizer 无泄漏/UAF/race。

### JS-S03-T09：合同测试与证据

1. Fake Engine/QuickJS 共用 Module ABI suite。
2. Debug、Release、ASan/UBSan、TSan、API-only。
3. boundary scan、依赖清单、源码摘要和 A01-A50 映射。
4. Handoff `READY_FOR_REVIEW`。

**完成定义**：全部验收可复现，未实现 JS-S04/JS-S05 产品代码。

## 4. 完成定义

- R01-R22 全部映射到测试。
- A01-A50 全部通过。
- 同一 Bundle 在 Fake/QuickJS 的 cache、Result、错误和释放语义一致。
- 没有第二条 Bridge、VM/Hook、Page IR/RPK 读取或平台依赖。
