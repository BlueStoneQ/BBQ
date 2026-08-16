# LV-S01 任务

## 目录
- [1. 结论](#1-结论)
- [2. 实现顺序](#2-实现顺序)
- [3. 合同测试](#3-合同测试)
- [4. 完成定义](#4-完成定义)

## 1. 结论

编码获批后按“值类型与状态 -> 调度 -> Backend Port -> Fake -> 合同测试”实施。每一步只建立 Foundation，不引入具体平台库。

## 2. 实现顺序

| ID | 任务 | 依赖 | 完成条件 |
|---|---|---|---|
| LV-S01-T01 | 建立独立 foundation target 和公开头文件边界 | 无 | 不链接 Core、LVGL、SDL、libuv、文件系统或线程框架。 |
| LV-S01-T02 | 定义 local result、limits、lifecycle、stop policy 和值类型 | T01 | 枚举封闭，非法字段可拒绝，无平台类型。 |
| LV-S01-T03 | 实现固定容量 `OwnerTaskQueue` 与单次 try-critical-section | T02 | FIFO、单 owner、producer-safe post、pump budget、full/stopping/busy 通过；无 spin。 |
| LV-S01-T04 | 定义 `BackendClock` 与 `WakeupPort` | T02 | 整数纳秒、resolution、虚假唤醒、unsupported、close 通过。 |
| LV-S01-T05 | 定义 `DisplayBackend` 与 frame 借用合同 | T02 | capabilities、dirty region、present 所有权可测试。 |
| LV-S01-T06 | 定义 `InputBackend` 与固定容量 raw input 缓冲 | T02 | drain 上限、move 合并、edge 和 overflow 通过。 |
| LV-S01-T07 | 实现 Backend lifecycle coordinator | T03-T06 | open/stop/close、drain/cancel、busy retry、幂等、错误注入通过。 |
| LV-S01-T08 | 实现五类 Fake | T03-T07 | 无隐藏线程、真实时间或 I/O；行为完全脚本化。 |
| LV-S01-T09 | 添加依赖与符号检查 | T01-T08 | 禁用头文件、库和平台符号均不存在。 |

## 3. 合同测试

| ID | 测试 |
|---|---|
| LV-S01-CT01 | 多 producer 投递后 owner 单次执行；错误线程 pump 被拒绝。 |
| LV-S01-CT02 | 容量 N 后第 N+1 个 post 返回 full，前 N 个 task 不变。 |
| LV-S01-CT03 | pump budget 下 task 自投递不会饿死下一阶段，depth 准确。 |
| LV-S01-CT04 | notify/deadline/spurious/stop/unsupported 协作模式可复现。 |
| LV-S01-CT05 | Clock 不倒退，tick 到纳秒换算不溢出并公开真实 resolution。 |
| LV-S01-CT06 | Display 状态机、frame 借用期和失败后无悬挂引用。 |
| LV-S01-CT07 | Input down/move/up、move 合并、overflow、drain 上限和顺序。 |
| LV-S01-CT08 | drain/cancel 停止；停止后拒绝 post/sample；close 幂等。 |
| LV-S01-CT09 | 各生命周期阶段故障后无 task、sample、frame 或 Backend 残留。 |
| LV-S01-CT10 | caller-owned 单线程、无 wait、静态存储配置通过同一套合同。 |
| LV-S01-CT11 | accepted task 的 capture 在 execute/cancel 时记录 owner token；队列析构只断言 closed/depth=0，不执行清理。 |
| LV-S01-CT12 | 人工占用 critical section 时 post/pump/stop/Input 返回 busy 且立即结束；释放后重试收敛。 |

## 4. 完成定义

1. T01-T09、CT01-CT12 全部通过。
2. sanitizer 或等价证据证明无 use-after-free、double free 和数据竞争。
3. 运行期无队列扩容；记录容量、峰值 depth、overflow 和销毁后 depth=0。
4. 依赖检查证明 Core 不依赖 Foundation，Foundation 不依赖具体 Backend。
5. 静态扫描拒绝无界 `test_and_set`/`while(true)` 自旋。
6. V1 证据明确不宣称 ISR-safe 或 lock-free。
