# LV-S02 验收

## 目录

- [1. 结论](#1-结论)
- [2. 组合与启动](#2-组合与启动)
- [3. PackageSource](#3-packagesource)
- [4. Backend 与生命周期](#4-backend-与生命周期)
- [5. 负例与故障](#5-负例与故障)
- [6. 裁剪、线程与资源](#6-裁剪线程与资源)
- [7. 需求追踪](#7-需求追踪)
- [8. 通过条件](#8-通过条件)

## 1. 结论

LV-S02 的通过标准是：**Fake Core 返回 root 结果时，Host 能用同一控制逻辑装配并驱动两套静态 Backend；所有失败都可收口，所有未选择模块都不进入目标。** 这不等于完整 LVGL Runtime 已可见或可点击。

## 2. 组合与启动

| Case | 输入 | 必须结果 |
|---|---|---|
| A01 simulator composition | 完整 simulator Fake inventory | Manifest target/profile/diagnostic/QuickJS/SDL/libuv/file 选择一致；单 Engine、单 JS Framework。 |
| A02 embedded composition | 完整 embedded Fake inventory | Manifest target/profile/baseline/QuickJS/builtin/device/memory 选择一致；不含 simulator module。 |
| A03 describe | compose 后多次 describe | 返回同一 immutable 事实，不运行时重算或改写。 |
| A04 strict launch | 合法 `target=lvgl` Profile | 参数原样进入 Core 创建请求；Build Profile 不由 launch 字段改变。 |
| A05 root success | Fake Core 最终返回 root `presented` | Host 恰好一次进入 running 并报告成功。 |
| A06 root failure | Package/JS/Mount/Present 任一 typed failure | Host 不发布 Session，原样返回错误并逆序清理。 |
| A07 single engine | QuickJS descriptor 与 Manifest 一致 | 一个 AppRuntime-scoped JS Service/Engine 被创建并确定销毁。 |
| A08 trace selection | V1 两 Profile 与 custom/off | V1 选 Adapter，custom/off 选 Noop；业务结果与调用顺序等价。 |

## 3. PackageSource

| Case | 输入 | 必须结果 |
|---|---|---|
| P01 file read | 合法 offset/length | 从 open 时固定 handle 异步返回精确 immutable bytes，completion 到 Core queue 一次。 |
| P02 file identity | open 后 path rename/replace | 后续读取仍属于原 handle；截断导致短读时返回 `PACKAGE_IO_ERROR`。 |
| P03 memory read | immutable package storage | 无文件系统调用；range 与 file source 语义一致。 |
| P04 zero read | 合法 offset、length=0 | 异步返回空 bytes 一次。 |
| P05 close race | accepted read 与 close 并发 | read 只完成 bytes 或 error 一次；close 后新 read 为 `PACKAGE_IO_ERROR`。 |
| P06 byte lifetime | Source close 后 Core 仍持有结果 | bytes 继续有效，最后一个只读 owner 释放后销毁。 |

## 4. Backend 与生命周期

| Case | 输入 | 必须结果 |
|---|---|---|
| B01 simulator turn | libuv wake + SDL event + test frame | 单 owner、budget 顺序稳定；frame/raw sample 只经过 LV-S01 Port。 |
| B02 embedded turn | caller 周期 pump、Wakeup unsupported | 不忙等、不创建隐藏线程；task/input/display 有同样顺序。 |
| B03 raw signal | resume -> suspend -> shutdown | 产生对应三种 typed control；每个 accepted request 同 ID/action 完成一次。 |
| B04 duplicate raw | admission 前连续相同 signal | 可以过滤且不分配 RequestId；accepted 后不得合并。 |
| B05 lifecycle busy | Fake Core 返回 `LIFECYCLE_BUSY` | Host 原样完成调用方，状态不猜测、不直接调用 Hook。 |
| B06 destroy | running Session 销毁 | admission 关闭，Core destroy 收口，Package/Backend/Engine/Sink 逆序释放。 |

## 5. 负例与故障

| Case | 注入 | 必须结果 |
|---|---|---|
| N01 bad profile | 未知字段、错误 target、非法 viewport/params | 创建 Package/Engine 前拒绝。 |
| N02 missing/duplicate engine | inventory 为 0 或 2 个 Engine | 组成失败，不 fallback。 |
| N03 engine mismatch | Provider descriptor 与 Manifest 不一致 | `MODULE_ABI_UNSUPPORTED`，不执行 Bundle。 |
| N04 incomplete v1 | 缺 View/Text/Button 或 router/prompt/device | 不生成最终 V1 Manifest。 |
| N05 crossed backend | embedded 含 SDL/libuv/file 或 simulator 含 device set | 组成失败。 |
| N06 source errors | overflow、越界、短读、I/O failed | `PACKAGE_IO_ERROR`，无部分 bytes 和重复 completion。 |
| N07 backend open failure | 第 K 个 Backend open 失败 | 已打开资源按逆序关闭，Session 不发布。 |
| N08 queue busy | Foundation critical section 竞争 | 当前栈立即返回；所有权不转移；后续 turn 有界重试，不 spin。 |
| N09 queue full | task 容量耗尽 | 明确 `QUEUE_OVERFLOW`/typed failure；已接受 FIFO 不变。 |
| N10 sink failure | emit drop/failed/closed | Runtime 状态、结果、错误和调用顺序不变。 |
| N11 destroy failure | Core destroy typed failure | Host 返回 failure 但仍完成本地最终释放。 |
| N12 late callback | Session destroy 后 read/control/result 到达 | callback 被失效且只释放自身，不复活 Host、不访问裸指针。 |

## 6. 裁剪、线程与资源

必须证明：

1. shared Core/JS target 的 include/link/symbol 扫描不含 SDL、libuv、LVGL 或设备类型。
2. embedded target 不链接 `backend.lvgl.libuv.loop`、`backend.lvgl.sdl.*`、`backend.lvgl.package.file` 或 diagnostic-only/fault module。
3. simulator target 不链接 embedded display/input/builtin loop。
4. S02 test target 中 `runtime.js-framework` 和选定 Engine 各一次；这只是隔离链接证据，最终产品证据由 LV-S09 提供。
5. 所有 SDL/libuv/设备 Backend 调用来自唯一 owner thread；Package completion 只到 Core queue。
6. task、input、read、retry、Trace endpoint 均有固定上限；没有无界 spin、阻塞、扩容或 retry queue。
7. stop 后 task/input/read/session/backend/engine/sink live count 为零。
8. 10,000 轮 compose/start(fake result)/destroy 在 Debug、Release、ASan/UBSan、TSan 下通过且资源不持续增长。
9. 源码扫描确认没有 Surface、Mount、`PlatformInputMessage`、Measure、Capability Provider 或 Collector 实现。
10. 两个 Profile 实际使用设计表冻结的容量、每轮预算、单次 retry 和 `drain` stop policy；边界值与超限值均有断言。

## 7. 需求追踪

| 需求 | 任务 | 验收 |
|---|---|---|
| R01-R04 | T01-T03 | A01-A03、N02-N05、资源 2-4 |
| R05-R06 | T03-T04 | A04-A06、N01 |
| R07-R08 | T05 | P01-P06、N06、N12 |
| R09-R10 | T04 | A05-A06、N01、N11 |
| R11 | T09 | B03-B05、N12 |
| R12-R14 | T06-T07 | B01-B02、N05、资源 1-3/5 |
| R15-R16 | T10 | B01-B02、N08-N09、资源 6-8 |
| R17 | T08 | A08、N10 |
| R18-R19 | T04、T10 | A06、B06、N07/N11/N12、资源 7-8 |
| R20 | T01-T10 | 资源 9 |

## 8. 通过条件

- 全部正例、负例、故障注入、线程和资源检查通过。
- 公共 Manifest/Launch/Lifecycle/Observation/PackageSource 语义无重定义。
- 双 Profile 的选择与裁剪规则成立，且明确区分 Fake/isolated 与最终产品证据。
- 没有 libuv 进入 Core，也没有 Surface/Mount/标准 Input 等后续能力越界。
- 独立校审 `PASS` 后才可编码；编码验收后仍等待总架构发布 LV-S03。
