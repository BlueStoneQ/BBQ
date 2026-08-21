# JS-S03 Module ABI 与 Loader

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖](#4-依赖)
- [5. 交付物](#5-交付物)
- [6. 状态](#6-状态)
- [7. 阅读顺序](#7-阅读顺序)

## 1. 结论

JS-S03 冻结 verified Bundle 到可复用模块定义的唯一通路：**只消费 Core 通过 `VerifiedModulePort` 交付的 immutable bytes，在 JS Executor 上执行 `$app_define$/$app_bootstrap$/$app_require$`，全部校验通过后原子提交 Module Cache。**

`$app_define$` 登记模块定义，`$app_bootstrap$` 登记 App/Page 启动描述，`$app_require$` 按声明依赖解析并至多执行一次 factory。App/Page export 的 Definition shape 已由公共 Artifact Contract 冻结：`createAppVm(appContext)`、`createPageVm(surfaceContext)`、`bindingEvaluators` 和 `handlerMethods` 的 own data property 与 callable/键集合规则在本分 Spec 内直接校验。`$app_bootstrap$` 不创建 App/Page VM、不执行 Hook；这些唯一属于 JS-S04。

App/Shared 定义和实例绑定一个 AppRuntime；Page 定义可在同一 AppRuntime 内按 verified identity 复用，但每个 Surface 只持有独立 lease，Page VM 仍由 JS-S04 按 Surface 独立创建。

## 2. 范围

### 2.1 本分 Spec 拥有

- `VerifiedModulePort` 的 JS 侧 typed consumer 与 load transaction。
- Framework Module ABI：`$app_define$/$app_bootstrap$/$app_require$`。
- App/Shared/Page definition cache、instance cache、Surface lease、失败缓存和状态机。
- immutable bytes 长度/SHA-256 二次一致性检查、UTF-8/source evaluation 和诊断 source identity。
- moduleId、dependencies、module kind、cache scope、bootstrap 和 expected export 校验。
- Shared factory 的单次求值、循环依赖检测和失败传播。
- Bundle bytes、Factory/Exports `JsValueRef`、load request 和 cache entry 的所有权与释放。
- 固定资源上限、失败原子性、late/duplicate load 和最小 Module Observation。

### 2.2 本分 Spec 不拥有

- RPK、PackageSource、文件路径、Runtime Metadata 或 Page IR 读取。
- App/Page VM、Context、Hook 和 Lifecycle：JS-S04。
- Binding/Block/Handler/Render：JS-S05..S08。
- typed Capability/Page API 的具体 facade：JS-S09。
- Runtime ABI codec、Core ingress、callback queue 或第二条 Bridge：继续属于 JS-S02。
- Core AppRuntime、Surface、Navigation 栈或 Platform 对象。

## 3. 输入与输出

### 3.1 输入

- JS-S02 已校验并投递的 `LoadVerifiedModule` concrete message。
- `moduleKind/moduleId/dependencies/cacheScope/surfaceId?`。
- verified `path/byteLength/sha256/immutable bytes`。
- App/Page `expectedBootstrap`，Page `expectedBindingIds/expectedHandlerIds`。
- JS-S01 `JsEnginePort`、唯一 Context、JS Executor 和资源限制。
- JS-S09 后续实现的 typed Framework Module Resolver Port；S03 合同测试使用 Fake Resolver。

### 3.2 输出

- `LoadVerifiedModuleResult(loaded|failed)`，原样回显 Core RequestId。
- App/Shared/Page immutable `ModuleDefinitionHandle`。
- App/Shared 单实例 export 与 Page definition export。
- 供 JS-S04 使用的 App/Page bootstrap descriptor 和 Surface-scoped Page lease。
- module load/evaluation/failure/release 的结构化 Observation 与资源计数。

## 4. 依赖

- [JS Runtime 总 Spec](../../README.md)
- [JS-S01 Engine Service](../js-s01-engine-service/README.md)
- [JS-S02 Runtime ABI Client](../js-s02-runtime-abi-client/README.md)
- [Artifact Contract](../../../../../spec/contracts/artifact-contract.md)
- [Runtime ABI Contract](../../../../../spec/contracts/runtime-abi.md)
- [Runtime Value Contract](../../../../../spec/contracts/runtime-value.md)
- [Error Contract](../../../../../spec/contracts/error-contract.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)
- [Observation Contract](../../../../../spec/contracts/observation-contract.md)
- [公共 Schema 索引](../../../../../spec/contracts/schemas/README.md)

## 5. 交付物

- [需求](./requirements.md)
- [设计](./design.md)
- [任务](./tasks.md)
- [验收](./acceptance.md)

## 6. 状态

`IMPLEMENTATION_CORRECTION_REQUIRED`。设计本身保持通过；当前实现必须先修复 source manifest 并重新提交证据，复核通过后才可标记 `VERIFIED`；不得启动 JS-S05。

独立校审与工作看板显式 `CODE_ALLOWED` 前不得实现 JS-S03；JS-S04 可以在本设计完成后继续设计，但不得编码。

## 7. 阅读顺序

1. 本文件确认边界。
2. [需求](./requirements.md)确认必须成立的行为。
3. [设计](./design.md)确认 Module ABI、cache、状态机和所有权。
4. [任务](./tasks.md)确认未来编码顺序。
5. [验收](./acceptance.md)确认正负例、资源和范围门禁。
