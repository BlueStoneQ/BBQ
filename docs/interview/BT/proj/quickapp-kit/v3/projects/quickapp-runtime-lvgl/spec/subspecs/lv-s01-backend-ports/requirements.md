# LV-S01 需求

## 目录
- [1. 结论](#1-结论)
- [2. 输入与输出](#2-输入与输出)
- [3. 功能需求](#3-功能需求)
- [4. 质量需求](#4-质量需求)
- [5. 非目标](#5-非目标)

## 1. 结论

LV-S01 必须让桌面和受约束设备使用同一调度、显示与输入边界，同时保证所有资源有上限、所有调用有线程归属、所有停止路径能收敛。

## 2. 输入与输出

| Port | 输入 | 输出 |
|---|---|---|
| `BackendClock` | 无 | 当前单调整数纳秒 |
| `OwnerTaskQueue` | 不透明 owner-thread task | `accepted/full/stopping/invalid`；owner thread 泵取数量 |
| `WakeupPort` | notify 或绝对 deadline | `notified/deadline/stopping/unsupported/failed` |
| `DisplayBackend` | 配置与 immutable frame descriptor | open/present/close typed result |
| `InputBackend` | 启停与 owner-thread drain | 有界批次 immutable raw input sample 和丢弃统计 |

这些消息只在 LVGL Platform 项目内部传递，不是公共 Runtime ABI。

## 3. 功能需求

| ID | 需求 |
|---|---|
| LV-S01-R01 | owner thread 首次绑定后不可迁移；只有 owner thread 可以 pump、调用 Display/Input Backend 和执行销毁。 |
| LV-S01-R02 | 跨线程投递只转移 immutable task 所有权；同步结果只表示 `accepted/full/stopping/busy/invalid`，`busy` 时所有权不转移并由 Host 后续重试。 |
| LV-S01-R03 | 任务队列容量构造时固定且大于零；满载拒绝新任务并返回 `full`，不得覆盖已接收任务。 |
| LV-S01-R04 | 每轮最多执行冻结的 `maxTasksPerPump`，避免任务洪水饿死 timer、display 和 input。 |
| LV-S01-R05 | Clock 返回非递减 `uint64` 纳秒；不得使用 wall clock、浮点或文本时间。 |
| LV-S01-R06 | Wakeup notify 可从 producer thread 调用；虚假唤醒合法，调用方必须重查任务和 deadline。 |
| LV-S01-R07 | 无阻塞等待能力时返回 `unsupported`，Host 改用协作式 pump；Port 内不得隐藏忙等。 |
| LV-S01-R08 | Display 只描述能力并接收 frame/dirty regions；不接收 Surface、NodeId、Mount op 或 `lv_*` 对象。 |
| LV-S01-R09 | frame 像素由明确 owner 持有至 present 返回；返回后 Backend 不得保留借用指针。 |
| LV-S01-R10 | Input 只产生物理坐标、contact、raw action 和时间；click、NodeId 与 PlatformInputMessage 属于 LV-S05。 |
| LV-S01-R11 | Input 容量构造时固定；只可合并同 contact 连续 move，禁止合并 down/up/cancel；溢出必须计数。 |
| LV-S01-R12 | 生命周期为 `constructed -> opened/running -> stopping -> closed`；非法调用返回 typed local error。 |
| LV-S01-R13 | stop 先封闭入口并唤醒 owner；已接收任务按冻结的 drain/cancel 策略处理。竞争返回 `busy`，重复调用必须在固定容量内收敛。 |
| LV-S01-R14 | close 幂等；析构前必须显式达到 `closed + depth=0`。队列析构不得获取竞争锁、执行/销毁 task、启动 stop 或隐藏等待，并以断言暴露违约。 |
| LV-S01-R15 | Fake Clock/Wakeup/Display/Input/TaskQueue 支持确定性合同测试和故障注入。 |
| LV-S01-R16 | Port 不依赖文件系统、异常机制、SDL、libuv、OS 线程类型或 LVGL 头文件；V1 不承诺 ISR-safe 或 lock-free，但禁止无界 spin、无界阻塞和动态扩容。 |

## 4. 质量需求

| 维度 | 要求 |
|---|---|
| 内存 | 构造后队列容量固定；pump/present/drain 无无界增长；Frame/Input 批次有最大值。 |
| 线程 | owner-only API 返回 `wrong_thread`；producer-safe API 单独标注；accepted task 的 capture 只在 owner execute/cancel 中析构。 |
| 实时性 | critical section 只做一次有界尝试，竞争返回 `busy`；pump 有预算；Wakeup 不执行 task。 |
| 可移植 | 支持 caller-owned thread、无阻塞等待和调用者提供静态存储。 |
| 可测试 | Fake 不读取真实时间、不创建窗口、不启动隐藏线程。 |
| 可裁剪 | Display/Input/Wakeup 实现为独立模块，未选择实现不进入链接产物。 |

## 5. 非目标

- 不规定 SDL、libuv、LVGL timer/flush/indev 的 API 映射。
- 不定义 Surface、Mount、Event 或 Observation Marker。
- 不向共享 Core 提供 EventLoop Backend。
- 不冻结产品 Profile 的具体容量；LV-S02 提供限额，LV-S01 强制限额存在且可测试。
