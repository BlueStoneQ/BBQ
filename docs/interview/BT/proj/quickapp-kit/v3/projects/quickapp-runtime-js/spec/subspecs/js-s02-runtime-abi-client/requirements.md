# JS-S02 Runtime ABI Client：需求

## 目录

- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)
- [6. 需求追踪](#6-需求追踪)

## 1. 结论

JS-S02 必须建立一条且只有一条 Runtime ABI：**JS 调用先转成公共 typed message，Core 回调先通过 typed admission，再进入 JS Executor。**

任何版本不兼容、未知字段、错误类型、错误关联或已销毁作用域都必须在进入业务模块前失败，且不得部分修改 pending 状态。

## 2. 输入与输出

### 2.1 输入

- Runtime ABI identity `quickapp-kit-runtime-v1` 和每条消息的 `schemaVersion=1`。
- JS-S01 的 `JsEnginePort::bindNativeFunction/unbindNativeFunction`、`RuntimeValue`、Value limits 与串行 JS Executor。
- Core ingress typed Port 的同步 `EnqueueResult`。
- Core -> JS immutable typed callback message。
- `LoadVerifiedModule` 在进程内携带共享不可变 byte storage；base64 仅属于 JSON fixture/Schema wire 边界。
- 请求发起模块在 JS Executor 上从本 AppRuntime 唯一 `JsRequestIdAllocator` 取得且已写入消息的 `req:j-<positive-decimal>`；Core-origin completion 只携带原 RequestId。
- AppRuntime/Surface 开启、关闭和销毁通知。

### 2.2 输出

- Engine-neutral Native Function Catalog 与 typed codec。
- JS -> Core closed `CoreInboundMessage` union 和 Core -> JS closed `JsInboundMessage` union。
- accepted/rejected 的同步 JS 返回值和异步 typed Result 关联。
- Surface/AppRuntime teardown 后确定的拒绝、取消、丢弃和资源归零行为。

## 3. 功能需求

| ID | 需求 |
|---|---|
| JS-S02-R01 | 启动时必须校验 Composition 的 `runtimeAbi` 精确等于 `quickapp-kit-runtime-v1`；不匹配返回 `ABI_UNSUPPORTED_VERSION`，不注册任何 Native Function。 |
| JS-S02-R02 | 每条跨层消息必须包含公共 Schema 定义的 `schemaVersion=1` 与固定 `kind`；未知版本、未知字段、缺失字段、错误类型或跨字段关系错误在入队前拒绝。 |
| JS-S02-R03 | JS -> Core 必须使用 closed C++ typed union；不得使用 `{kind,payload}`、`module/method/args` 或 JSON 文本作为通用 envelope。 |
| JS-S02-R04 | 每个 JS -> Core 操作必须注册独立 Native Function，参数和返回类型固定；同步 `supportsCapability` 只读取 App JS 执行前冻结的 immutable support snapshot，不入 Core 队列、不创建 correlation/Provider；JS-S02 只调用 `JsEnginePort` Native Function Binding，不引用 QuickJS 或实现 External Function Adapter。 |
| JS-S02-R05 | codec 必须使用 JS-S01 `RuntimeValue`/Value limits 做无副作用解码；禁止 JSON stringify/parse，禁止 getter/Proxy 副作用，禁止函数、Symbol、BigInt、循环、非有限数和 unsafe integer。 |
| JS-S02-R06 | 同步 `EnqueueResult(ok)` 只表示 immutable typed message 已被 Core 队列接受；失败返回完整 typed `RuntimeError`，不得创建成功假象或等待异步业务结果。 |
| JS-S02-R07 | JS 原生返回对象必须封闭为 `{ok:true}` 或 `{ok:false,error:RuntimeError}`；`RuntimeError` 只允许公共 code、message、retryable 与声明的关联 ID。 |
| JS-S02-R08 | 每个 AppRuntime 必须由 JS Framework bootstrap 创建且只创建一个本地 `JsRequestIdAllocator`；它只在 JS Executor 上运行，由所有请求发起模块共享。请求模块必须先取得 `req:j-<positive-decimal>`，再把完整 typed message 交给 S02。allocator 不是 C++ 服务，不通过 Native Function 暴露，也不归 RuntimeAbiService/S02 所有；S02 只校验来源分区，不分配或改写 ID。Core-origin completion 只回显原 RequestId。 |
| JS-S02-R09 | accepted 且需要终态 Result 的消息必须登记 bounded bridge correlation record；记录只能包含 key、expectedResultKind、Surface/AppRuntime owner 和 generation，不得持有 completionToken、Promise/callback、Render snapshot 或其他业务 completion 状态。拒绝入队时必须原子撤销该记录。 |
| JS-S02-R10 | request/result 使用 `RequestId`，Render 使用 `TransactionId`；Result 必须同时匹配 kind、关联 ID、Surface 和当前 generation，S02 才能删除 correlation record 并将完整 typed Result 投递到对应编译期固定 consumer slot。 |
| JS-S02-R11 | duplicate、unknown、mismatched 或销毁后 late Result 必须丢弃并记录结构化事实；不得重建 bridge correlation、调用旧 consumer 或复活 Surface。 |
| JS-S02-R12 | Core -> JS callback 必须先完成纯 typed admission，再以 move/copy immutable ownership 投递 JS-S01 有界 Executor；`ModuleBundle.bytes` 必须是 `shared_ptr<const vector<uint8_t>>` 或等价一次转移的只读 storage，进程内禁止 base64 string。Core Runtime Thread 不得同步调用 JS 或等待执行完成。 |
| JS-S02-R13 | callback consumer 必须是编译期封闭的 typed slot，不使用字符串反射表；匹配 Result 只投递 typed Result，不附带 S02 completion token。注册、替换、注销和调用只在 JS Executor，consumer registration token 先于 consumer 对象销毁。 |
| JS-S02-R14 | bridge correlation capacity 和 callback queue capacity 必须有界；满载返回 `QUEUE_OVERFLOW`，只拒绝当前消息，不丢弃已接受消息。 |
| JS-S02-R15 | Surface 关闭必须先关闭该 Surface 新 admission，再删除其 bridge correlation record；业务 pending 由 JS-S07/JS-S09 等所有者自行取消。AppRuntime 级 typed callback slot 保留到所属模块或 AppRuntime 注销。后续 Surface request 返回 `SURFACE_NOT_FOUND`，late callback/result 只释放消息。 |
| JS-S02-R16 | AppRuntime teardown 必须按“关闭双向 admission -> 解绑全部 Native Function -> 清空 bridge correlation/注销 consumer registration -> 关闭/release Port -> JS-S01 销毁 Context”的顺序执行；全部 Native entry、correlation、registration 和 callback task 归零。 |
| JS-S02-R17 | Core 发送的 context/dispatch/status 与 typed result 必须保持公共字段原样；JS-S02 不解释 Hook、Module、Event、Render、Capability 或页面业务语义。 |
| JS-S02-R18 | ABI request accepted/rejected、result delivered/dropped、queue overflow 和 teardown 可接入 JS-S01 ObservationEmitter；观测不形成第二条 Bridge，Noop/Recording 不改变返回、顺序或清理。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 单一边界 | 后续 JS 请求模块共享 AppRuntime 级 `JsRequestIdAllocator` 取得 JS-origin ID，并各自拥有业务 pending；它们只能依赖 JS-S02 typed client/callback 跨 Core，不得自行 bind Native Function 或直连 Core。 |
| 确定性 | 相同 typed 输入、队列结果和 callback 顺序产生相同 admission、bridge correlation 与分发序列。 |
| 线程 | Native callback、bridge correlation 修改和 consumer 调用属于 JS Executor；Core producer 只做纯校验与异步 post。 |
| 内存 | codec/bridge correlation/callback queue 有明确上限；S02 pending 不持有业务状态。Module bytes 在 accepted 后只读共享，rejected、terminal delivery、Surface/App teardown 后由 RAII 可测释放。 |
| 平台无关 | 公共目标不包含 QuickJS、JNI、Android、UIKit、LVGL、SDL 或 NativeHandle。 |
| 可恢复 | 单条非法消息只拒绝该消息；ABI identity 不兼容则整个 ABI Client 不启动。 |
| 可验证 | Fake Core 可注入 accepted、overflow、closed、乱序、重复、late 和错误 Result，无需 Module/VM/Render 实现。 |

## 5. 非目标

- 不加载或执行 Bundle，不注册 `$app_define$/$app_bootstrap$/$app_require$`。
- 不创建 App/Page VM，不执行 lifecycle Hook。
- 不生成 Binding、Block、RenderTransaction 或 HandlerId。
- 不实现 Router、Capability、Page API、Promise/callback 业务适配。
- 不实现 Core queue、Runtime Tree、平台 Adapter 或 Provider。
- 不增加通用 Bridge、运行时反射、JSON RPC、同步跨线程等待或第二个 EventLoop。

## 6. 需求追踪

| 上级需求 | 本分 Spec |
|---|---|
| JS-R16、合同唯一边界 | R01-R07、R12-R13 |
| JS-R17、生命周期清理 | R09-R11、R15-R16 |
| JS-R18、typed error | R02、R05-R07、R11 |
| JS-R19、Engine 可替换 | R04、平台无关质量要求 |
| JS-R20、最小观测 | R18 |
