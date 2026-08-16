# IOS-S01 验收

## 目录

- [1. 结论](#1-结论)
- [2. 组成验收](#2-组成验收)
- [3. PackageSource 验收](#3-packagesource-验收)
- [4. 启动与生命周期验收](#4-启动与生命周期验收)
- [5. 观测与失败验收](#5-观测与失败验收)
- [6. 资源与线程验收](#6-资源与线程验收)
- [7. 证据与通过条件](#7-证据与通过条件)
- [8. 需求覆盖](#8-需求覆盖)

## 1. 结论

IOS-S01 通过的本质标准是：用 Fake Core 即可证明 iOS Host 正确完成**一次组成、一次启动、串行生命周期和确定销毁**，并且 PackageSource 字节在并发与关闭下仍具有明确所有权。

## 2. 组成验收

| 场景 | 期望 |
|---|---|
| V1 QuickJS profile | Manifest 合法；六个 Kernel、一次 JS Framework、一个 Engine；baseline/diagnostic |
| V1 + off | 组成失败，不创建 Core/Engine Session |
| custom + off | Manifest 合法且注入 Noop Sink |
| custom + baseline/diagnostic | Manifest 合法且注入 Recording Adapter |
| 没有或选择两个 Engine | 构建/装配失败，Core 未创建 |
| Engine ABI 不兼容 | `MODULE_ABI_UNSUPPORTED`，不回退 |
| Manifest 与 link map 不一致 | 构建失败 |
| 未选外围模块 | 不出现在 Manifest、link map 和 symbol inventory |
| describe | 返回启动使用的同一 immutable Manifest 事实 |

## 3. PackageSource 验收

必须对 file、Bundle resource 和 immutable Data 执行同一合同套件：

1. `size` 正确，头部/中部/尾部随机读取 bytes 精确相等。
2. `length=0` 合法；offset/length 溢出、越界、短读和 I/O 错误返回 `PACKAGE_IO_ERROR`。
3. 每个 read completion 恰好一次且只在 Core queue 观察到。
4. 调用方修改原可变 Data 后，Source 读取结果不变。
5. close 后新读取失败；close 前已完成 bytes 在 Core 最后引用释放前有效。
6. close 与在途读取竞态不崩溃、不重复 completion、不返回部分 bytes。
7. Core 可见对象中不存在 URL、fd、stream 或 Foundation 类型。

## 4. 启动与生命周期验收

### 4.1 启动

- 非 iOS target 或非法 Profile 在创建 PackageSource 前失败。
- Fake Core 依次返回 created、mounted 时 Host 仍未报告成功。
- 只有 Root `presented` 后 Host 完成一次成功并发布 Session。
- Package、JS 初始化、Mount 或 Present 失败均只完成一次 typed failure，并将已构造资源逆序清零。

### 4.2 Scene 分离

- raw active/background/disconnect 只映射为 `enterForeground/enterBackground/destroyAppRuntime`。
- Host 从不直接调用 App/Page Hook，不构造 Page lifecycle message。
- 连续重复 raw signal 在生成 RequestId 前去重；被去重信号不产生 RequestId、公共 control 或 typed Result。
- 一旦 Host 生成 `RuntimeLifecycleControl + RequestId`，该 accepted control 恰好一次进入 Core；相同 action 和后续 signal 均不得合并、替代或本地完成它。
- 两个并发 accepted control 都进入 Core；Fake Core 对其中一个返回 `LIFECYCLE_BUSY` 时，Host 以相同 RequestId/action 原样返回且不更新 committed state。
- 每个 accepted control 只完成一个 typed Result；重复/未知 Result 不二次完成调用方。
- Core 其他 lifecycle failure 同样不改变 Host committed state。
- 未发布或 destroying Session 的 Scene 信号不进入 Core。

### 4.3 销毁

- destroy 先拒绝新请求，再提交一次 `destroyAppRuntime`，最后逆序释放资源。
- Fake Core 返回 failed 或模拟 Hook failure 时仍完成强制释放，不重放 Hook。
- repeated destroy 不重复释放、不重复 completion。
- 销毁后的晚到 Scene/read/result 不访问已释放 owner。

## 5. 观测与失败验收

- `v1/baseline`、`v1/diagnostic` 均注入 Recording Adapter；`v1/off` 在组成阶段拒绝。
- `custom/off` 注入 Noop；`custom/baseline`、`custom/diagnostic` 均注入 Recording Adapter。
- 对合法 Profile 运行同一测试序列，Noop 与 Recording 除 Trace 记录外，Host 状态、公共结果、错误和 Core 调用序列完全相同。
- Recording Sink 丢样、关闭或 emit failure 不改变 Runtime 结果。
- Host 不产生私有同义 marker，不执行 Trace 文件 I/O 或文本格式化。
- 所有跨边界失败均为公共 `RuntimeError`；测试不依赖字符串匹配。

## 6. 资源与线程验收

- Host、Session、PackageSource、Engine、Sink 和 Fake Port 析构/释放计数最终归零。
- Thread checker 证明 Scene 信号立即离开 main thread，Host 状态只在 Host executor，read 只在 I/O executor，completion 只在 Core queue。
- Core queue 不同步等待 main thread；测试中不存在反向同步调用。
- Address/Thread Sanitizer 或等价工具覆盖 close/read、destroy/Scene 和 late result 竞态，无泄漏、数据竞争和 use-after-free。

## 7. 证据与通过条件

提交：

- 自动化测试报告与需求覆盖矩阵。
- Composition Manifest fixture、Schema 结果、link map/symbol inventory 摘要。
- PackageSource 三种输入的统一合同测试结果。
- Fake Core 调用时序和资源计数。
- Noop/Recording 等价性结果。
- sanitizer 与线程检查结果。

全部正例、负例和竞态用例通过，且没有 `[待决策]` 阻塞项时，IOS-S01 才可请求独立校审；校审通过后仍需工作看板显式放行产品代码。

## 8. 需求覆盖

| 需求 | 验收位置 |
|---|---|
| IOS-S01-R01 | 2：单 Engine 正负例 |
| IOS-S01-R02 | 2：Manifest、describe 与链接事实 |
| IOS-S01-R03 | 2、5：观测级别与 Sink 等价性 |
| IOS-S01-R04 | 4.1：Profile 前置拒绝 |
| IOS-S01-R05 | 2、4.1：组成与 Session 装配 |
| IOS-S01-R06 | 3：三种 Source 合同套件 |
| IOS-S01-R07 | 3：错误、一次 completion 与 close race |
| IOS-S01-R08 | 4.1：`presented` 唯一成功判据 |
| IOS-S01-R09 | 4.2：Scene 到公共 control 的唯一映射 |
| IOS-S01-R10 | 4.2：accepted 请求逐条投递、唯一 Result 与 `LIFECYCLE_BUSY` 透传 |
| IOS-S01-R11 | 4.3、6：销毁与资源归零 |
| IOS-S01-R12 | 5：Noop/Recording 行为等价 |
