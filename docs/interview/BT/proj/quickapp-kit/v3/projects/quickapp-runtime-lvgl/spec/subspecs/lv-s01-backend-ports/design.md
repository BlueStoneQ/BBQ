# LV-S01 设计

## 目录
- [1. 结论](#1-结论)
- [2. 接口与线程](#2-接口与线程)
- [3. 数据与所有权](#3-数据与所有权)
- [4. 调度与唤醒](#4-调度与唤醒)
- [5. 生命周期](#5-生命周期)
- [6. 背压与失败](#6-背压与失败)
- [7. 无 OS 能力降级](#7-无-os-能力降级)
- [8. Fake 与后续边界](#8-fake-与后续边界)

## 1. 结论

Foundation 不实现一个“大 EventLoop”，而是提供四个可独立替换的 Port，由 LV-S02 组合：

```text
OwnerTaskQueue + BackendClock + WakeupPort
                           |
                     owner-thread pump
                       /           \\
             DisplayBackend     InputBackend
```

本质：**队列决定工作所有权，时钟决定 deadline，唤醒只打断等待，Display/Input 只连接设备边界。** 四者不互相持有，也不包含 Runtime 语义。

## 2. 接口与线程

以下冻结语义，不冻结 C++ 文件名或模板实现：

```text
BackendClock
  nowNs() noexcept -> uint64
  resolutionNs() noexcept -> uint64

OwnerTaskQueue
  bindOwnerCurrentThread() -> LocalResult
  post(OwnerTask&&) -> accepted | full | stopping | busy | invalid
  pump(maxCount) -> PumpResult
  beginStop(StopPolicy) -> LocalResult
  finishStop() -> LocalResult
  depth() -> size_t

WakeupPort
  notify() noexcept -> WakeResult
  waitUntil(deadlineNs) noexcept -> WaitResult
  close() noexcept

DisplayBackend
  open(DisplayConfig) -> LocalResult<DisplayCapabilities>
  present(DisplayFrameView) -> LocalResult
  close() noexcept -> LocalResult

InputBackend
  open(InputConfig) -> LocalResult<InputCapabilities>
  drain(RawInputSample* out, size_t capacity) -> DrainResult
  close() noexcept -> LocalResult
```

| 方法 | 线程归属 |
|---|---|
| `post`、`notify` | producer-safe，可跨线程 |
| `bind/pump/beginStop/finishStop` | owner thread |
| `nowNs` | 任意线程；同一实例属于同一 clock domain |
| Display/Input 的 open/present/drain/close | owner thread |
| 驱动写入 Input 缓冲 | Backend producer context；不得执行上层 callback |

## 3. 数据与所有权

### 3.1 OwnerTask

`OwnerTask` 是 move-only、不透明、不可变工作项。`post` 成功后队列独占所有权；`full/stopping/busy/invalid` 时所有权仍归调用方。accepted task 只能由 owner thread 执行一次，或在 owner stop/cancel 中销毁一次；队列析构不处理 task。

Foundation 不规定 task 的业务类型。后续 Host 可将 typed Platform command 包装为 task，但不得捕获跨线程借用的可变对象。

### 3.2 Display

```text
DisplayConfig {
  physicalWidthPx / physicalHeightPx
  preferredPixelFormat
  maxDirtyRegions
}

DisplayFrameView {
  pixels: borrowed immutable bytes
  byteLength / strideBytes
  widthPx / heightPx / pixelFormat
  dirtyRegions[0..maxDirtyRegions]
  frameSequence
}
```

`present` 是同步消费边界：返回前 Backend 必须完成复制或设备提交，返回后不得借用 `pixels`。需要零拷贝时，缓冲必须由具体 Backend 拥有，并由后续实现增加内部适配，不得延长本接口的借用期。

Display 不知道 logical-px、Surface、Runtime Node 或 LVGL object。

### 3.3 Input

```text
RawInputSample {
  deviceId / contactId
  action: down | move | up | cancel
  physicalX / physicalY
  pressure: optional bounded integer
  timestampNs / sampleSequence
}
```

样本是设备事实，不是标准事件。Input 独占有界缓冲；`drain` 最多复制/移动调用方容量个样本，不暴露设备对象或内部缓冲指针。

## 4. 调度与唤醒

LV-S02 驱动每轮顺序，但必须遵守：

```text
read now
-> pump at most maxTasksPerPump
-> service due platform timers (later)
-> drain at most maxInputSamplesPerPump
-> service display (later)
-> recompute next deadline
-> waitUntil(deadline) or return to external caller
```

1. `post` 使队列从空变为非空时调用 `notify`；多余 notify 可以合并。
2. notify 不携带业务数据，也不执行 task。
3. wait 允许虚假唤醒和被 stop 打断。
4. pump 中新投递 task 进入队尾，不突破本轮预算。
5. Foundation 不以 libuv loop、SDL loop 或 LVGL timer 作为权威模型；它们只能适配此语义。

## 5. 生命周期

```text
constructed
  -> open success -> running
  -> beginStop     -> stopping
  -> finishStop    -> closed
closed -> close -> closed
open failure -> closed
```

停止顺序：

1. owner 将任务队列置为 stopping；后续 post 返回 stopping。
2. Input 停止接受新样本，notify 打断等待。
3. `drain` 策略执行已接收 task；`cancel` 策略只销毁未执行 task。策略由 LV-S02 在 Host 创建时冻结。
4. 清空 Input 样本并保留 drop/overflow 计数，不生成标准事件。
5. owner 依次 close Input、Display、Wakeup。
6. `finishStop` 验证 task、sample 和借出资源为零后进入 closed。

析构不启动停止流程、不获取 critical section、不执行或销毁 task。调用方必须显式达到 `closed + depth=0`；析构只断言该不变量，违约属于调用方生命周期错误。

## 6. 背压与失败

```text
LocalError =
  invalid_argument | wrong_thread | invalid_state |
  capacity_exhausted | busy | unsupported | backend_failed

PostResult = accepted | full | stopping | busy | invalid
```

- critical section 只尝试一次；竞争时返回 `busy`，不 spin、不阻塞、不转移 task 所有权。
- task 满：拒绝当前 task，已接收 FIFO 不变。
- input 满：只可用新 move 替换同 contact 的最后一个未消费 move；其他样本拒绝并增加 overflow count。
- display 失败：返回 backend_failed；Foundation 不重试、不 full rebuild。
- wakeup 失败：错误可见；Host 可继续协作式 pump，但不能伪造 task 已执行。
- 内存不足：构造/open 失败；运行期不得扩容重试。

V1 的 producer-safe 只表示普通线程上下文可并发调用，不承诺 ISR-safe 或 lock-free。Host 在后续 pump 重试 `busy`；所有重试由外层调度，Foundation 内不建立等待循环。

公共 `QUEUE_OVERFLOW`、Marker 和 Runtime 状态转换由后续 Host/Adapter 在公共边界转换；LV-S01 不建立第二套公共错误或观测协议。

## 7. 无 OS 能力降级

| 缺失能力 | 降级 |
|---|---|
| 无线程 | Host 绑定调用者线程，外部主循环周期 pump。 |
| 无条件变量/中断唤醒 | wait 返回 unsupported；外部按 next deadline 调度，Port 内不忙等。 |
| 无文件系统 | 无影响，Foundation 无文件 I/O。 |
| 无动态分配 | 调用者提供固定 task/input/frame 存储，运行期不扩容。 |
| 无高精度时钟 | 将最佳单调 tick 换算为整数纳秒并报告真实 resolution，不伪造精度。 |
| 无显示或输入 | 对应 open 返回 unsupported；是否允许 headless 由 LV-S02 决定。 |

降级不能改变 FIFO、owner thread、停止和内存上限语义。

## 8. Fake 与后续边界

| Fake | 能力 |
|---|---|
| FakeClock | 测试显式 advance/set，拒绝倒退，不读真实时间。 |
| FakeWakeup | 记录 notify；脚本化 notified/deadline/spurious/unsupported/failed。 |
| FakeTask | 记录执行/销毁顺序，可注入 task 内 post。 |
| FakeDisplay | 固定 capabilities，复制 frame 摘要，注入各阶段失败。 |
| FakeInput | 测试压入样本，验证合并、edge、overflow 和 drain 上限。 |

Fake 不创建线程、timer、窗口或文件。后续责任：

- LV-S02：选择实现、冻结 limits/stop policy、驱动 pump。
- LV-S03/S04：在 owner task 中实现 Surface/Mount，并接入 LVGL 帧。
- LV-S05：RawInputSample 到 NodeId/标准输入消息的映射。
- LV-S08：SDL Backend。
- LV-S09：Collector、队列与对象观测证据。
