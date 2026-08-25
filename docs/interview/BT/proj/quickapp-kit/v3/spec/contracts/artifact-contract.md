# Runtime Artifact Contract

## 目录

- [1. 结论](#1-结论)
- [2. V1 输入边界](#2-v1-输入边界)
- [3. RPK 布局](#3-rpk-布局)
- [4. Manifest 与 Runtime Metadata](#4-manifest-与-runtime-metadata)
- [5. Page IR](#5-page-ir)
- [6. JS Module ABI](#6-js-module-abi)
- [7. Verified Module Handoff](#7-verified-module-handoff)
- [8. PackageSource 与 Loader](#8-packagesource-与-loader)
- [9. 后续 Release 签名草案](#9-后续-release-签名草案)
- [10. 版本](#10-版本)
- [11. 跨项目所有权](#11-跨项目所有权)

## 1. 结论

Runtime Artifact 是 Toolkit、C++ Core 和 JS Runtime 的共同输入合同：Toolkit 生产，Core 校验并加载 Manifest/Metadata/Page IR，JS Runtime 执行被索引的 JS Bundle。

## 2. V1 输入边界

V1 区分两种 RPK：

| 类型 | 作用 | Core 是否直接执行 |
|---|---|---|
| 联盟 Toolkit RPK/RPKS | Case 001 兼容性、行为与产物基线 | 否 |
| QuickApp Kit Runtime RPK | 由本 Toolkit 从联盟 DSL 构建的正式 Runtime 输入 | 是 |

联盟包已验证包含 `manifest.json`、`app.js`、页面 `index.js`、资源和签名，但 Template/Style/VM 嵌在 JS 中，不包含 C++ Runtime Tree 所需的 Page IR。V1 不在 Core 内重建联盟 JS DOM/模板解释器；缺少 `quickapp-kit/runtime.json` 时在执行任何 Bundle 前返回 `PACKAGE_FORMAT_UNSUPPORTED`。

联盟 DSL 是源码兼容边界；联盟现成 RPK 是研究和 inspect 输入，不与 QuickApp Kit Runtime ABI 混称为同一种可执行包。V1 Runtime 不直接执行 RPKS。

## 3. RPK 布局

```text
app.rpk                         # ZIP container
├── manifest.json              # alliance-compatible application manifest
├── app.js                     # app module bundle
├── pages/<route>/index.js     # page module bundle
├── quickapp-kit/
│   ├── runtime.json           # fixed package index and version gate
│   └── pages/<route>/index.ir.json
├── assets/**
└── META-INF/**                # optional build metadata; Release signature is post-V1
```

只有 `manifest.json` 和 `quickapp-kit/runtime.json` 是固定发现路径。其他 Bundle、IR 和资源路径全部由 Runtime Metadata 显式索引；Loader 不根据目录猜页面入口。

每个非目录成员必须满足：相对路径、无反斜线、无 `..` 路径段、无重复 ZIP member。除 `META-INF/**`、Manifest 和 Runtime Metadata 外，所有可读成员都必须出现在 Metadata 的 Artifact Descriptor 中。

## 4. Manifest 与 Runtime Metadata

Manifest 提供应用语义：包名、版本、最低平台版本、声明能力和 route/page/component 关系。Runtime Metadata 提供执行索引：Bundle、Page IR、依赖、哈希和 ABI 版本。

页面关系必须同时成立：

```text
manifest.router.pages[manifestRoute].component == component
normalize('/' + manifestRoute) == route
runtime.pages[route] -> moduleId + bundle + templateId + pageIr
pageIr.templateId == runtime.pages[route].templateId
JS page bootstrap.moduleId/templateId == runtime.pages[route].moduleId/templateId
```

`manifest.router.entry` 必须存在于 pages；Runtime Metadata 的 `entryRoute` 必须等于其规范化 route。Widget 不进入 V1 Runtime Metadata。

Manifest 普通 pages 与 Runtime Metadata pages 必须按 `manifestRoute` 双向一一对应，不允许任一侧存在未映射页面。App、Shared 和 Page 的 `moduleId` 在整个 Package 内全局唯一；每个模块描述符都必须携带 `dependencies[]`，其顺序和值与同模块 `$app_define$` 完全一致。

`dependencies[]` 只描述 Package 内模块图：App 只能依赖 Shared；Shared 只能依赖其他 Shared；Page 只能依赖 App 或 Shared。模块不得依赖自身，Shared 图必须无环，不得引用其他 Page 或未知 module。`@app-module/system.*` 是 JS Framework 静态 typed facade，不进入 Package dependency graph。App Bundle 的 app bootstrap 必须与 Metadata app module 一致。

Metadata 中的 Artifact Descriptor 固定包含 `path`、`mediaType`、`byteLength` 和小写十六进制 SHA-256。全部 Descriptor 的 path、page route、全局 moduleId 和 page templateId 在各自命名空间内唯一；Page IR/Bootstrap 集合不得包含 Metadata 未索引的额外入口。

## 5. Page IR

Page IR 是一页的不可变静态定义，不是运行时树。它的语义模型是一棵有根、有序的静态模板树；Artifact 使用按 ID 寻址的归一化表编码，Core 加载后可建立不可变 ID 索引，不需要复制成第二棵长期驻留对象树：

```text
PageIr
  templateId
  rootTemplateNodeId
  nodes[]       TemplateNodeId + canonical Host component + child slots
  bindings[]    TemplateBindingId + scope -> target prop
  blocks[]      TemplateBlockId + kind + parent/root
  handlers[]    TemplateHandlerId + scope + target node + event type
```

Core 在创建 Surface 时加载并校验 Page IR。Node 与 Block 共同形成一棵以 `rootTemplateNodeId` 为根的静态模板树，必须满足：

1. Root 入度为 `0`；其余每个 Node 和 Block 的结构入度恰好为 `1`，并且全部可从 Root 到达。
2. `node.children(node)`、`node.children(block)` 和 `block.templateRootNodeId` 是全部结构边；该有向图不得成环。
3. 每个 Block 必须恰好被其 `parentTemplateNodeId` 的一个 Block child slot 引用；Block Root 不得同时被静态树、其他 Block 或普通 Node child 引用。
4. Block Root 及其子树归属于最近的祖先 Block；嵌套 Block 的 Root 归属于内层 Block。其余 Node 属于 Page scope。
5. 每个 Binding/Handler 的显式 `scope` 必须等于其目标 Node 的派生 scope；Block scope 引用必须存在。
6. TemplateNodeId、TemplateBlockId、TemplateBindingId、TemplateHandlerId 在各自命名空间内唯一。

这些约束保证同一个 Page IR 加同一合法 Block instance plan 只能确定性地产生一种 Runtime Tree，不允许多父、共享子树或递归 Block；不同动态状态可以产生不同合法 Block 实例结构。Page IR 在该页面仍有 Surface 时保持可用，最后一个 Surface 销毁后可从缓存释放。

Page IR 不包含 JS 函数、依赖路径、Runtime `NodeId`、`HandlerId`、`NativeHandle` 或平台类型。

## 6. JS Module ABI

JS Runtime 在执行 Bundle 前注入：

```text
$app_define$(moduleId, dependencies, factory)
$app_bootstrap$(moduleId, bootstrapMetadata)
$app_require$(moduleId)
```

规则：

1. Bundle 只能 define Metadata 声明的 `moduleId`，并且 app/page Bundle 必须恰好 bootstrap 一次同一 moduleId。
2. App Bundle 导出 App VM；Page Bundle 导出 Page VM、`bindingEvaluators` 和 `handlerMethods`。
3. `bindingEvaluators` 的十进制 key 必须与 Page IR 的 `TemplateBindingId` 一一对应，求值结果必须属于 Runtime Value。
4. `handlerMethods` 的十进制 key 必须与 Page IR 的 `TemplateHandlerId` 一一对应，value 是 Page VM 方法名。
5. Page bootstrap 必须携带并匹配 `templateId`；Page VM 每个 Surface 独立，Shared Module 在 App JS Runtime 内只执行一次。
6. `$app_require$("@app-module/system.router")`、`$app_require$("@app-module/system.prompt")`、`$app_require$("@app-module/system.device")`、`$app_require$("@app-module/system.openUrl")`、`$app_require$("@app-module/system.webview")` 映射到 typed Capability；`@app-module/system.fetch` 只按 Capability Module Contract 解析为 V1 deferred facade；`$page` API 映射到 typed Page Host Control，不产生通用 module/method Bridge。Toolkit 必须把联盟源码中的 capability import 规范化为该 ID；typed facade 不写入 `$app_define$` 或 Metadata 的 Package `dependencies[]`。
7. V1 Bundle 不暴露 `$app_require$.context`；Toolkit 必须在构建期把静态 `require.context` 闭包展开为确定性的直接模块依赖和 `$app_require$(moduleId)` 调用。
8. Bundle 不导出或维护完整 VNode Tree；Template/Style 静态事实只来自 Page IR。
9. Bundle 不复制 Binding/Handler target descriptor；JS 只按 TemplateBindingId/TemplateHandlerId 执行 evaluator/method，Core 从 Page IR 解析 target。

`[已冻结] P0-JS-EXPORT-001`：App/Page Bundle 的 `module.exports` 是不可变 VM Definition，不是 VM 实例。精确机器形态固定为：

```text
AppModuleDefinition
  schemaVersion: 1
  kind: "app"
  createAppVm(appContext) -> AppVm

PageModuleDefinition
  schemaVersion: 1
  kind: "page"
  createPageVm(surfaceContext) -> PageVm
  bindingEvaluators: { "<TemplateBindingId>": evaluator }
  handlerMethods: { "<TemplateHandlerId>": methodName }
```

Definition 及其 `bindingEvaluators/handlerMethods` 只能包含上述 own data property；禁止 accessor、Proxy、原型继承注入和未知字段，提交 Module Cache 前必须冻结。`createAppVm` 每个 AppRuntime 恰好调用一次；`createPageVm` 每个 Surface 恰好调用一次，并必须返回彼此隔离的普通 VM object。

Binding evaluator 必须是 callable，以对应 Page VM 作为 `this`，唯一参数是当前 Block lexical aliases 的只读 `scope` object；Page scope 使用空 object。Handler export 只保存非空 `methodName`，JS Event Runtime 后续以 Page VM 为 `this` 调用该方法。VM object 上的 lifecycle/method/state 属于实例，不进入 Definition cache，也不得在不同 Surface 之间共享。

Shared Module 的 `module.exports` 不使用上述 Definition shape；它仍按声明依赖在一个 AppRuntime 内求值并缓存一次。Toolkit TK-S05 只生产该形态，JS-S03 只校验并缓存 Definition，JS-S04 只调用 create 并拥有 VM 实例。

## 7. Verified Module Handoff

Loader 进入 `verified` 后，Core 才能通过绑定当前 AppRuntime 的 `VerifiedModulePort` 向 JS Executor 交付模块：

```text
LoadVerifiedModule
  requestId / packageId
  moduleKind: app | shared | page
  moduleId / dependencies[]
  cacheScope: appRuntime | surface
  surfaceId                         # 仅 page
  bundle: path + byteLength + sha256 + immutable bytes
  expectedBootstrap                # app/page
  expectedBindingIds[]             # 仅 page，来自已校验 Page IR
  expectedHandlerIds[]             # 仅 page，来自已校验 Page IR

LoadVerifiedModuleResult
  loaded | failed(RuntimeError)
```

V1 固定传递 immutable Bundle bytes，不传文件路径权限、`PackageSource`、文件描述符或平台 handle。JSON Schema 使用 base64 表示合同 fixture；进程内 C++ Port 使用只读 byte storage 的共享所有权或一次所有权转移，不要求二次 base64 编解码。JS Executor 在加载完成前持有 bytes，返回 Result 后释放；不得保存可变 Core buffer 引用。

线程通信固定为 `Core queue -> onLoadVerifiedModule -> JS Executor queue -> completeVerifiedModuleLoad -> Core queue`。Core Runtime Thread 不同步进入 QuickJS、不等待模块执行；同一 requestId 只完成一次，Surface/AppRuntime 销毁后的 late Result 按 ID tombstone 丢弃。

App/Shared Module cache 绑定一个 AppRuntime；Page Module 定义可以按 bundle identity 缓存，但 Page VM 和 bootstrap 执行绑定 `SurfaceId`。Shared 不执行 bootstrap；App/Page 必须与 `expectedBootstrap` 一致。Page 的 evaluator/handler export 必须与 expected ID 集合一一对应。

`loaded` 只表示 bytes 已执行到 Module ABI、define/bootstrap 约束与 expected export 已验证、模块定义已提交缓存；它不表示 VM 初始化或 Page 已 Mount/Present。Core 必须先发送 `AppContext` 再交付 App Module，先发送 `SurfaceContext` 再交付对应 Page Module。Module loaded 后，Core 另行发出 `VmInitializationDispatch`；JS VM Controller 执行 App `onCreate` 或 Page `onInit/initialEvaluation/onReady` 并返回 typed Result。

只有 Core Loader 可产生该请求。Bundle path、byteLength、SHA-256、实际 bytes、moduleId、dependencies、bootstrap 任一不一致都在提交 Module Cache 前失败；失败不得留下 Module Cache、App VM 或 Page VM。

机器合同：[module-load.schema.json](./schemas/module-load.schema.json)。

## 8. PackageSource 与 Loader

```text
PackageSource
  size() -> uint64
  readAt(offset, length, completion) -> immutable bytes | PackageReadError
  close()
```

Runtime Host 提供 PackageSource，Core 不接收文件路径、文件描述符或平台流对象。`readAt` 可以由 mmap、文件、内存或异步存储实现，但 completion 必须回到 Core 队列；同一 read 只完成一次，close 后读取返回 `PACKAGE_IO_ERROR`。

Loader 状态机：

```text
closed -> opened -> indexed -> verified -> executable -> closed
                         \-> failed
```

V1 development 顺序固定为：读取 ZIP central directory -> 重复成员/路径/大小门禁 -> 读取 Manifest/Metadata -> Schema/关系/版本与 Artifact SHA-256 校验 -> 才允许读取和执行 Bundle。任一步失败进入 failed，禁止部分启动。

启用后续 Release profile 时，PackageOpenPolicy 与签名验证必须发生在执行 Bundle 前；它不改变 V1 Artifact 的路径、版本和 SHA-256 完整性合同。

## 9. 后续 Release 签名草案

**本节是非 V1 门禁的安全草案。** 在确认联盟容器、签名与分发兼容边界前，Toolkit、Core 和 Platform V1 Spec 均不得把本节实现作为纵向闭环前置条件。`package-open-policy.schema.json` 与现有 Golden 只保留作架构试验，不代表当前发行标准已经冻结。

签名成员固定为：

```text
META-INF/QUICKAPP-KIT.SIG
```

草案签名文件是严格二进制格式，多余或缺少字节都返回 `PACKAGE_SIGNATURE_INVALID`：

```text
8 bytes   ASCII "QAKSIGV1"
1 byte    formatVersion = 1
1 byte    algorithm = 1              # Ed25519
2 bytes   keyIdLength                 # uint16 big-endian, 1..64
N bytes   keyId UTF-8                 # [A-Za-z0-9._-]+
64 bytes  Ed25519 signature
EOF
```

Ed25519 签名输入按以下二进制规则唯一构造：

```text
ASCII "QAK-RPK-SIGNED-CONTENT-V1\0"
uint16-be keyIdLength
bytes     keyId
uint32-be memberCount
for each member:
  uint32-be pathByteLength
  bytes     UTF-8 path
  uint64-be uncompressedByteLength
  32 bytes  SHA-256(uncompressed member bytes)
```

成员集合是 ZIP 中除目录项和签名成员自身外的全部成员，包含 `manifest.json`、`quickapp-kit/runtime.json`、全部 Artifact 和其他 `META-INF/**`。成员按原始 UTF-8 path bytes 升序排列；签名前必须先拒绝重复 member、非法 UTF-8、绝对路径、反斜线和 `..` 段。压缩方式、ZIP 时间戳和 central-directory 顺序不进入签名，因此合法重打包不改变签名语义；新增、删除、改名或修改任意成员都会使签名失效。

该草案不使用包内证书或 X.509 链。Runtime Host 在 `openPackage(PackageSource, PackageOpenPolicy)` 时提供包外信任：`keyId -> 32-byte raw Ed25519 public key`。公钥在 Schema 中使用无 padding 的 base64url；同一 Policy 内 keyId 必须唯一。

`PackageOpenPolicy` 规则：

1. `verificationMode=release` 固定 `allowUnsigned=false`，必须存在签名且 keyId 受信。
2. `verificationMode=development` 只有在 `allowUnsigned=true` 时才允许无签名包。
3. 只要包内存在签名，就必须完整验证；无效签名或未知 keyId 不得被 development 模式忽略。
4. Runtime Metadata 的 `buildMode` 只用于诊断，不参与安全决策；包内不得声明或降低签名策略。
5. 签名通过后仍必须验证 Metadata 中每个 Artifact Descriptor 的 SHA-256；二者失败都发生在执行 JS 之前。

Toolkit 的签名输入是包外 `keyId + Ed25519 private key`；私钥、公钥和信任策略不得写入 Runtime Metadata。公共合同测试使用固定 key/member Golden，同时覆盖篡改成员、添加成员、重复成员、未知 key、无签名 release 和允许无签名 development。

机器合同：[package-open-policy.schema.json](./schemas/package-open-policy.schema.json)。

## 10. 版本

V1 固定：

```text
packageFormat = quickapp-kit-rpk-v1
runtimeAbi = quickapp-kit-runtime-v1
irVersion = 1
jsModuleAbi = quickapp-kit-app-module-v1
```

ZIP 单成员和总展开大小上限由 Core 项目总 Spec 分配给对应分 Spec 细化，但不得改变公共路径、关系校验与“完整性通过前不执行 JS”的顺序。

## 11. 跨项目所有权

| 生产/消费方 | 必须实现 |
|---|---|
| Toolkit | V1 从联盟 DSL 生成 Manifest、Runtime Metadata、JS Bundle、Page IR、资源、哈希和 RPK；Release profile 后续才实现签名 |
| C++ Core | V1 实现 PackageSource、ZIP/完整性门禁、Manifest/Metadata/Page IR 校验与按 route 加载；只在 verified 后通过 VerifiedModulePort 交付 bytes；PackageOpenPolicy/签名属于后续 Release profile |
| JS Runtime | 只从 VerifiedModulePort 接收 immutable bytes；实现 `$app_define$/$app_bootstrap$/$app_require$`、Module Loader/Cache、VM/evaluator/handler export 校验；Capability ModuleRegistry 仍属于 Core |
| Platform Runtime Host | V1 提供 PackageSource；后续 Release profile 提供包外 PackageOpenPolicy；不得解释 Bundle 或 Page IR |

机器合同：`manifest.schema.json`、`runtime-metadata.schema.json`、`page-ir.schema.json`、`js-bootstrap.schema.json`、`module-load.schema.json`、`package-open-policy.schema.json`。
