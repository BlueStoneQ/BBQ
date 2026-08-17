# CORE-S03 验收

## 目录

- [1. 结论](#1-结论)
- [2. 创建与初始化](#2-创建与初始化)
- [3. Lifecycle Control](#3-lifecycle-control)
- [4. Request 与失败](#4-request-与失败)
- [5. Teardown 与资源](#5-teardown-与资源)
- [6. 边界扫描](#6-边界扫描)
- [7. 证据](#7-证据)

## 1. 结论

验收通过的含义是：任何时刻都能从唯一 AppRuntime state、一个 control slot 和 bounded correlations 精确解释系统正在做什么；没有超时猜测、重复 Hook 或残留资源。

## 2. 创建与初始化

| ID | 场景 | 预期 |
|---|---|---|
| S03-A01 | 创建 AppRuntime | ID 只由 Factory 生成；一个 Controller；状态 creating |
| S03-A02 | 正常 app 初始化 | AppContext -> verified Module -> loaded -> VM init -> ready，`onCreate` 一次 |
| S03-A03 | AppContext enqueue 失败 | 不交付 Module，创建失败并资源归零 |
| S03-A04 | app Module failed | 不发 VM init，不进入 ready，执行 teardown |
| S03-A05 | app VM init failed(onCreate) | 不创建可用 AppRuntime，立即 teardown |
| S03-A06 | shared dependency 重复请求 | AppRuntime cache 复用定义，不创建第二 App VM |
| S03-A07 | Page module/init 正常 | 每个 Surface 独立 correlation；completion 只回给 S04 |
| S03-A08 | Page init failed | 仅目标 Surface 收到失败；AppRuntime 保持可用 |

## 3. Lifecycle Control

| ID | 场景 | 预期 |
|---|---|---|
| S03-L01 | ready -> enterForeground，无 Surface | commit foreground -> App onShow -> Host completed |
| S03-L01B | ready -> enterBackground | commit background，无 Platform/Page/App Hide Hook -> Host completed |
| S03-L02 | background -> enterForeground，有 top | Host visible -> Core commit -> App onShow -> Page onShow -> completed |
| S03-L03 | foreground -> enterBackground | Host hidden -> Core commit -> Page onHide -> App onHide -> completed |
| S03-L04 | visibility failed | App/Surface 状态不变，无 Hook，Host failed |
| S03-L05 | show/hide Hook failed | 状态不回滚；其余 Hook 继续；Host completed；记录 `JS_EXCEPTION` |
| S03-L06 | control 在途时第二个 control | `LIFECYCLE_BUSY`，不创建第二 operation |
| S03-L07 | 非法目标状态 | `ABI_INVALID_ARGUMENT`，状态与 Hook 次数不变 |
| S03-L08 | destroy 正常 | 停止新工作 -> Surface top-to-root -> App onDestroy -> destroyed |
| S03-L09 | destroy Hook/Host cleanup failed | 仍完成 destroyed，错误可观测，资源归零 |

## 4. Request 与失败

1. Host `req:p-*` 原样出现在 Host Result；每个 Core child 使用唯一 `req:<n>`，内部映射可追踪 parent。
2. 同一 Result 重复两次、错误 kind/scope/SurfaceId/sequence、旧 epoch Result 均不能二次推进状态。
3. OOM/queue overflow 在 accept 前不创建 correlation；accept 后每项最终由 Result 或 teardown 清除。
4. Fake Port 永不完成时，Runtime 保持 awaiting；测试不靠 sleep 判定 timeout。触发 teardown 后 correlation 归零，后续 completion 为 late。
5. Result 乱序只允许在独立 operation 间发生；同一状态机不因乱序越过前置阶段。
6. Noop/Recording TraceSink 的状态序列、Hook 次数、Result 和 error 完全一致。

## 5. Teardown 与资源

- teardown 后 `pendingCorrelations=0`、`activeLifecycleControl=0`、`livePageOperations=0`、全部 AppRuntime mailbox depth=0。
- App/shared/page immutable byte pins、AppContext、Package pin、JS Port callback token 和 collaborator 引用全部释放。
- AppRuntime RequestId allocator 释放；Host 级 AppRuntimeId allocator 在其他 AppRuntime 存活时继续存在且不回退。
- `onDestroy` 最多一次；teardown 后的 Module/VM/Hook/Platform Result 不创建对象、不发送业务回调。
- Release、ASan/UBSan、TSan 下重复创建/前后台/销毁无 UAF、race、deadlock 或 leak。

## 6. 边界扫描

- S03 生产代码不读取 ZIP/JSON/Bundle path，不接受未经 S02 验证的 Module。
- 不包含 Surface 状态表、Navigation 栈、Runtime Tree、Revision、Render、Layout、Mount、Event 或 Capability 实现。
- 不包含具体平台、具体 JS Engine或原生对象类型。
- 不存在同步等待 JS/Platform 的锁、条件变量或 future.get 路径。
- 不存在业务 timeout error、wall-clock watchdog 或 sleep 驱动状态转换。

## 7. 证据

实现复核必须提交：

- AppRuntime/VM/control 状态转换表与 requirement-test 对照。
- Module/init/hook 的 typed message 顺序和 correlation snapshot。
- visibility、Hook、OOM、overflow、duplicate/late Result 故障注入结果。
- destroy 各阶段和最终资源计数。
- Release、ASan/UBSan、TSan、依赖扫描及 Noop/Recording 等价结果。
