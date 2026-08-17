# JS-S02 Runtime ABI Client

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 输入与输出](#3-输入与输出)
- [4. 依赖](#4-依赖)
- [5. 状态](#5-状态)
- [6. 阅读顺序](#6-阅读顺序)

## 1. 结论

JS-S02 的本质是：**把 JS Framework 与 C++ Core 之间的每次调用收敛为版本明确、字段封闭、可拒绝、可关联、可销毁的 typed message。**

JS-S02 不解释业务，不执行 Module、VM、Binding、Render、Handler 或平台逻辑；它只保证合法消息进入正确队列，合法 Result 回到正确 JS 所有者。

## 2. 范围

本分 Spec 唯一拥有：

- `quickapp-kit-runtime-v1` 与消息 `schemaVersion=1` 的兼容性门禁。
- `RuntimeAbiClient`：JS -> Core typed request/result-completion 的编码、字段校验和同步 `EnqueueResult`。
- `RuntimeAbiCallbacks`：Core -> JS typed callback 的字段校验、JS Executor admission 和分发。
- 基于 `JsEnginePort::bindNativeFunction` 的闭集 Native Function Catalog。
- 基于 immutable capability support snapshot 的同步只读 `supportsCapability` 查询。
- 校验 JS-origin `RequestId` 的 `req:j-<positive-decimal>` wire 分区，并负责纯 bridge correlation 容量和 late/duplicate Result 处理；每个 AppRuntime 由 JS Framework bootstrap 创建唯一的本地 `JsRequestIdAllocator`，所有请求发起模块在 JS Executor 上共享取号后再调用 S02。
- Surface/AppRuntime 关闭时的解绑、取消、晚到消息丢弃和资源归零。

本分 Spec不拥有：

- QuickJS External Function Adapter；它继续唯一归属 JS-S01 Provider。
- `JsRequestIdAllocator` 的创建、序列和生命周期；它属于 JS Framework bootstrap，不属于 S02，也不是 C++ 服务或 Native Function。
- Module Loader、`$app_define$/$app_bootstrap$/$app_require$`。
- VM、Lifecycle Hook、Reactive Binding、Block、Render 构造、Handler 执行和 typed Module Facade。
- Core 业务状态机、平台对象、Provider 或 Host 逻辑。

## 3. 输入与输出

### 3.1 输入

- 已验证的 JS-S01 `JsEngineService`、`JsEnginePort`、Native Function Binding、`RuntimeValue` 和 JS Executor。
- Composition Root 交付的 immutable Runtime ABI identity：`quickapp-kit-runtime-v1`。
- Core 在 App JS 执行前冻结的 capability support snapshot。
- Core Foundation 提供的异步 Core ingress Port 和 Core -> JS typed Port。
- 请求发起模块已从本 AppRuntime 唯一 `JsRequestIdAllocator` 取得并写入 typed message 的 JS-origin `RequestId`；Core-origin completion 携带需要原样回显的原 RequestId。
- 公共 Runtime ABI、Runtime Value、Error、ID、Lifecycle/Threading 合同及机器 Schema。

### 3.2 输出

- Engine-neutral `RuntimeAbiClient`、`RuntimeAbiCallbacks` 和 closed typed message unions 的实现合同。
- 每个 Native Function 的固定名字、参数个数、字段合同和返回类型。
- 只含 key、expected result kind、owner/generation 的 bridge correlation、typed callback 分发、关闭与资源清理规则。
- Fake Core Port、Fake callback consumer 和合同测试要求。

## 4. 依赖

直接依赖：

- [JS-S01 JS Engine Service](../js-s01-engine-service/README.md)
- [Runtime ABI Contract](../../../../../spec/contracts/runtime-abi.md)
- [Runtime Value Contract](../../../../../spec/contracts/runtime-value.md)
- [Error Contract](../../../../../spec/contracts/error-contract.md)
- [ID Contract](../../../../../spec/contracts/id-contract.md)
- [Lifecycle And Threading Contract](../../../../../spec/contracts/lifecycle-and-threading.md)

JS-S03..JS-S09 后续依赖 JS-S02，但不属于当前交付。

## 5. 状态

当前状态：`READY_FOR_REVIEW + CODE_BLOCKED`。

通过独立校审并由工作看板明确放行前，不得编码 JS-S02；不得启动 JS-S03。

## 6. 阅读顺序

1. [需求](./requirements.md)
2. [设计](./design.md)
3. [任务](./tasks.md)
4. [验收](./acceptance.md)
