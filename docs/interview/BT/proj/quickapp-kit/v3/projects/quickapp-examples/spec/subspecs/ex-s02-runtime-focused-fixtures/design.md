# EX-S02 设计

## 目录

- [1. 结论](#1-结论)
- [2. 事实与输入状态](#2-事实与输入状态)
- [3. 通用 Fixture 模型](#3-通用-fixture-模型)
- [4. CASE-002](#4-case-002)
- [5. BLOCK-001](#5-block-001)
- [6. CAP-DEVICE-001](#6-cap-device-001)
- [7. EVENT-REQUEST-001](#7-event-request-001)
- [8. 跨平台与证据](#8-跨平台与证据)
- [9. 变更治理](#9-变更治理)
- [10. 待验证项](#10-待验证项)

## 1. 结论

EX-S02 不设计运行时；它把“某个输入发生后，哪些公共身份必须保持、创建或释放”冻结成可执行事实。四个 Fixture 分工独立：CASE-002 证明更新与移动，BLOCK-001 证明增删和清理，CAP-DEVICE-001 证明 typed device 调用，EVENT-REQUEST-001 证明事件因果。

## 2. 事实与输入状态

| Fixture | 当前状态 | provenance |
|---|---|---|
| CASE-002 | `[已验证事实]` 本地源码存在 | QuickApp Kit 自有 Runtime contract fixture；上游来源不适用 |
| BLOCK-001 | `[待验证]` 源码尚未创建 | EX-S02 通过并放行后由 Examples 创建 |
| CAP-DEVICE-001 | `[待验证]` 源码尚未创建 | EX-S02 通过并放行后由 Examples 创建 |
| EVENT-REQUEST-001 | `[待验证]` 源码尚未创建 | EX-S02 通过并放行后由 Examples 创建 |

CASE-002 当前 identity：

| 字段 | 值 |
|---|---|
| package | `com.quickappkit.contract.case2` |
| entry | `/pages/Contract` |
| Source files | `src/app.ux`、`src/manifest.json`、`src/pages/Contract/index.ux` |
| Source snapshot SHA-256 | `221cd9ee3f642b98f3102248d7ff89dfb94b420c4b2f169043ed5497e29f0410` |

snapshot 算法与 CASE-001 相同：按 UTF-8 相对路径字节序排列 `<sha256>  <path>\n` 后，对完整清单计算 SHA-256。其他三个 Fixture 的 digest 在源码创建后冻结，Spec 阶段不得预填伪 identity。

## 3. 通用 Fixture 模型

每个 Fixture 必须独立提供：

```text
Identity + provenance
-> alliance DSL source + Manifest
-> semantic operation script
-> visible expectation
-> Runtime identity/transaction expectation
-> cleanup expectation
```

共同规则：

1. 一页、一个明确入口、只使用目标机制所需组件和能力。
2. 驱动定位使用 route、button 文本、item key；运行时 ID 只用于断言，不能作为操作输入。
3. 每个正常操作等待对应 `RenderTransactionResult(presented)` 或 typed Capability Result 后进入下一步。
4. 同一 Fixture Artifact 在三平台运行；平台可提供不同 Provider/失败注入，但源码不变。
5. Fixture 不携带 Toolkit Golden、平台截图或采集实现；这些是消费方证据。

## 4. CASE-002

### 4.1 已验证源码事实

初始 state：

```text
count = 0
visible = true
items = [{id:a,label:A}, {id:b,label:B}]
```

页面显示 count、`更新状态` button、conditional `条件节点` 和 keyed `[A,B]`。`onUpdate` 同步执行：

```text
count += 1
visible = !visible
items = [items[1], items[0]]
```

### 4.2 一次点击期望

```text
click RequestId R1
-> onUpdate once
-> three synchronous state writes
-> one microtask dirty flush
-> one RenderTransaction(revision=committed+1, transactionId=T1)
-> one incremental MountTransaction
-> presented
```

R1 必须关联该次 state、flush、Render 与 Trace；T1 关联 Render/Mount。公共 Event Contract 要求 `RenderTransaction` 携带 R1，但当前 Render Schema 不允许 `requestId` 字段，精确字段落点见 `[待决策] EX-S02-REQ-001`。EX-S02 不新增私有字段规避冲突。

RenderTransaction 的语义操作集合必须是：

- 一个 count `UpdateBinding`，最终显示 `1`。
- 一个 conditional `RemoveBlock`，`条件节点` 消失。
- 一个 keyed `MoveBlock`，A/B BlockInstance 均复用；允许移动 A 到最终 index 1 或移动 B 到最终 index 0。
- 不得为 A/B 产生 `RemoveBlock + InstantiateBlock`，不得重新 InstantiateTemplate。

Mount 必须产生对应 prop 更新、conditional Block root 的递归 `RemoveHost` 和一个 `MoveHost`。A/B 的 BlockInstanceId、NodeId、NativeHandle 保持；最终顺序为 `[B,A]`。截图证明内容，Render/Mount/ID Trace 证明增量语义。

## 5. BLOCK-001

### 5.1 待创建输入

单页初始 keyed list 为 `[A,B]`。每个 item 显示稳定 key/label，并包含 item-scope click Handler，使删除能验证 EventBinding 清理。页面提供三个确定控制：`添加 C`、`删除 B`、`重新添加 B`。

### 5.2 操作与身份

| Step | 操作 | 必须结果 |
|---|---|---|
| B1 | launch | A/B 各有 BlockInstanceId、HandlerId、NodeId、NativeHandle |
| B2 | click `添加 C` | 一个 C `InstantiateBlock`；C 身份新建，A/B 身份保持；顺序 `[A,B,C]` |
| B3 | click `删除 B` | 一个 B `RemoveBlock`；顺序 `[A,C]`；A/C 身份保持 |
| B4 | 释放一个删除前已为 B 捕获、删除后才到达分发点的在途输入 | 不调用旧 Handler，不改变 state |
| B5 | click `重新添加 B` | 新 B `InstantiateBlock`；新 B 的四类身份均不同于旧 B |

删除提交顺序遵循公共合同：

```text
JS Handler live -> retiring
-> Core atomically removes B EventBinding
-> Core recursively removes B Runtime subtree
-> Platform RemoveHost(B root) recursively releases Host subtree/mappings
-> presented/presentationFailed: Handler released
```

若事务在 Core 提交前 `rejected/cancelled`，旧 B 仍存在且 Handler `retiring -> live`；不能提交“页面看似删除”作为成功证据。

## 6. CAP-DEVICE-001

### 6.1 待创建输入

独立 Manifest 显式声明 `system.device`。单页提供 `获取设备信息` button、状态文本和 required fields 的确定展示区域；源码调用 `$app_require$` 对应 facade 的 `getInfo`，不读取平台对象，不修改 Case 001。

### 6.2 Success

Provider success 后必须得到：

```text
osType / platformVersionName / platformVersionCode
screenDensity
screenWidth / screenHeight
windowWidth / windowHeight
deviceType
```

全部 required string 非空，code 与尺寸为正，`screenWidth >= windowWidth`、`screenHeight >= windowHeight`。`windowWidth / screenDensity` 与启动 Surface 的 logical viewport width、height 同理，在平台声明的像素取整容差内一致。optional fields 可有可无；结果不得包含设备唯一标识或 Schema 外字段。

### 6.3 Failure 与 cleanup

同一源码在受控 Composition/Provider 下分别执行：

| 场景 | 预期 |
|---|---|
| module 预检通过，但 `getInfo` method 未注册 | `CAPABILITY_UNSUPPORTED` |
| Provider 构造或执行失败 | `CAPABILITY_FAILED` |
| 执行前 Surface 已销毁 | `SURFACE_NOT_FOUND` |
| AppRuntime 销毁且调用在途 | 调用取消，Provider 逆注册顺序销毁，late result 不执行 JS continuation、不更新 UI |

每次 request/result 使用同一 requestId/surfaceId。success 用 `capability.requested/completed`，失败用 `capability.requested/failed + errorCode`；错误文本不是判定合同。

Composition 整体缺少 `system.device` 时必须在执行 JS 前返回 `RUNTIME_PROFILE_INCOMPATIBLE`，该负例属于 EX-S03，不得在 CAP-DEVICE-001 中改写成调用期 unsupported。

## 7. EVENT-REQUEST-001

### 7.1 待创建输入

单页包含：

- parent click Handler 包裹 child button click Handler，用于 target/bubble。
- `同步更新` 控制，用于事件到 Render 的因果继承。
- `开始异步` 与 `完成异步` 控制：前者创建带 continuation 的 deferred Promise，后者在另一次 Handler 中 resolve；continuation 更新可见文本。

### 7.2 连续输入与冒泡

向 child 连续捕获两次 click，得到 R1、R2：

```text
R1 != R2
R1: target Handler(child,H1) -> bubble Handler(parent,H2)
R2: target Handler(child,H1) -> bubble Handler(parent,H2)
```

每条链内 input 与两个 dispatch 的 RequestId 相同；H1/H2 不同。`target` 始终是 child LogicalNodeRef；`currentTarget` 随 child/parent 改变；phase 分别是 target/bubble。此操作不写 state，因此不得产生 state/render marker。

### 7.3 同步与异步因果

- 单击 `同步更新` 得到 R3；Handler 内同步 state write 以及随后 flush/Render Trace 都携带 R3。
- 单击 `开始异步` 得到 R4，创建 deferred；单击 `完成异步` 得到 R5 并 resolve。
- Promise continuation 在 Handler 返回后更新 UI；该 state/flush/Render 不得自动携带 R4 或 R5。它拥有自己的 transactionId，但没有输入 RequestId，除非未来公共合同显式增加 typed handoff；EX-S02 不定义该扩展。

## 8. 跨平台与证据

三平台必须一致：Fixture Source/Artifact identity、操作序列、最终文本/顺序、operation kind、ID 保持/释放关系、typed Result/error 和 RequestId 因果。允许字体、系统 UI、NativeHandle 表示和值、具体 NodeId 数值、时间和性能不同。

最小证据：

- Source/Artifact identity 与操作记录。
- Render/Mount transaction 及前后 identity snapshot。
- Event input/dispatch/Handler/Render Trace。
- Capability request/result、Provider lifecycle 和 late result 证据。
- 删除/销毁前后的 Runtime Node、Handler、Host object 与映射计数。

## 9. 变更治理

源码变化必须说明新增合同覆盖、提升 Fixture version、重算 snapshot，并经总架构确认后重跑 Toolkit 与三平台证据。实现失败不能成为删除操作、错误分支或清理断言的理由。

## 10. 待验证项

- `[待验证]` CASE-002 当前源码的 Toolkit 编译结果与三平台 Runtime 结果。
- `[待验证]` BLOCK-001、CAP-DEVICE-001、EVENT-REQUEST-001 源码尚未创建，其 provenance 和 Source snapshot 等待 `CODE_ALLOWED` 后冻结。
- `[待验证]` focused Fixture 创建后的 Artifact identity、跨平台 operation/ID/cleanup 证据。
- `[待决策] EX-S02-REQ-001`：Event Contract 要求同步事件产生的 `RenderTransaction` 携带输入 `requestId`，但 Render Contract 的机器 Schema 未声明且禁止该字段；总架构需统一公共合同后，EX-S02 才冻结消息字段级断言。
