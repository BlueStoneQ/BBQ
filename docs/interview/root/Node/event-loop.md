# Node.js 事件循环与异步模型

> 解决什么问题：Node 单线程怎么扛高并发？为什么不卡？
> 本质：单线程 JS + 多线程 IO（libuv 线程池）+ 事件循环调度。一句话：JS 只管调度，脏活交给系统/线程池。
> 和浏览器的区别：阶段更多、优先级不同、有 `process.nextTick`。

---

## 目录

- [第一性原理](#第一性原理)
- [Node 事件循环六个阶段](#node-事件循环六个阶段)
- [宏任务与微任务](#宏任务与微任务)
- [和浏览器 Event Loop 的区别](#和浏览器-event-loop-的区别)
- [libuv 与线程池](#libuv-与线程池)
- [为什么单线程能扛高并发](#为什么单线程能扛高并发)
- [常见面试题](#常见面试题)

---

## 第一性原理

```
问题：Web 服务器要同时处理几千个连接，每个连接可能要读文件/查数据库/发网络请求。

传统方案（Java/C++）：一个连接一个线程 → 线程多了内存爆 + 上下文切换贵
Node 方案：一个线程 + 事件驱动 + 异步 IO → 不等 IO 完成，注册回调，有结果了再处理

本质：
  不是"Node 快"（CPU 密集型反而慢）
  而是"Node 在 IO 密集型场景下资源利用率高"（单线程不切换，IO 不阻塞）
```

---

## Node 事件循环六个阶段

```
   ┌───────────────────────────┐
┌─>│        timers              │  ← setTimeout / setInterval 回调
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │     pending callbacks      │  ← 系统级回调（TCP 错误等）
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │       idle, prepare        │  ← 内部使用
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │         poll               │  ← IO 回调（fs.read/网络请求完成）
│  └──────────┬────────────────┘      ← 大部分回调在这里执行
│  ┌──────────┴────────────────┐
│  │         check              │  ← setImmediate 回调
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │     close callbacks        │  ← socket.on('close') 等
│  └──────────┬────────────────┘
└─────────────┘

每个阶段之间：清空微任务队列（Promise.then + process.nextTick）
```

### 关键阶段

| 阶段 | 执行什么 | 对应 API |
|------|---------|---------|
| timers | 到期的定时器回调 | `setTimeout` / `setInterval` |
| poll | IO 完成的回调 | `fs.readFile` / 网络响应 / DB 查询结果 |
| check | `setImmediate` 回调 | `setImmediate` |

---

## 宏任务与微任务

```
微任务（每个阶段切换时清空）：
  - process.nextTick（最高优先级，比 Promise 还高）
  - Promise.then / queueMicrotask

宏任务（按阶段执行）：
  - setTimeout / setInterval（timers 阶段）
  - IO 回调（poll 阶段）
  - setImmediate（check 阶段）

执行顺序：
  同步代码 → process.nextTick → Promise.then → 进入下一个阶段的宏任务
```

### 经典输出题

```js
console.log('1');                          // 同步

setTimeout(() => console.log('2'), 0);    // timers 阶段

setImmediate(() => console.log('3'));      // check 阶段

Promise.resolve().then(() => console.log('4'));  // 微任务

process.nextTick(() => console.log('5'));  // nextTick（比 Promise 先）

console.log('6');                          // 同步

// 输出：1 6 5 4 2 3（setTimeout 和 setImmediate 顺序在主模块中不确定）
```

---

## 和浏览器 Event Loop 的区别

| | 浏览器 | Node |
|---|---|---|
| 循环结构 | 简单（宏任务 → 微任务 → 渲染 → 下一个宏任务） | 六个阶段轮转 |
| 微任务时机 | 每个宏任务后清空 | 每个阶段切换时清空 |
| `process.nextTick` | 没有 | 有（比 Promise 优先级高） |
| `setImmediate` | 没有 | 有（check 阶段） |
| 渲染 | 每帧有渲染步骤（rAF/Paint） | 没有渲染（无 UI） |
| `requestAnimationFrame` | 有 | 没有 |
| `MessageChannel` | 有（React Scheduler 用） | 有但意义不同 |

---

## libuv 与线程池

```
Node 不是"纯单线程"：

主线程（V8）：执行 JS，单线程
libuv 线程池（默认 4 个线程）：执行阻塞 IO
  - 文件系统操作（fs.readFile）
  - DNS 查询
  - 部分加密操作

操作系统内核：非阻塞 IO
  - 网络 IO（TCP/UDP）→ epoll(Linux) / kqueue(macOS)
  - 不占线程，内核通知完成

流程：
  JS 调 fs.readFile() 
    → libuv 把任务扔给线程池 
    → 线程池里某个线程执行真正的磁盘读取
    → 读完了把结果放回事件队列
    → Event Loop 的 poll 阶段取出 → 执行 JS 回调
```

---

## 为什么单线程能扛高并发

```
传统模型（一连接一线程）：
  10000 连接 = 10000 线程 × 2MB 栈 = 20GB 内存 💀

Node 模型（事件驱动）：
  10000 连接 = 1 个 JS 线程 + 操作系统内核管 socket
  → 内存占用极小
  → 没有线程切换开销
  → IO 等待时 JS 线程去处理其他请求

但代价：
  - CPU 密集型任务阻塞 Event Loop → 所有请求都卡住
  - 解决：Worker Threads / 子进程 / 计算下沉到 C++ 插件
```

---

## 常见面试题

| 问题 | 一句话答案 |
|------|-----------|
| Node 是单线程吗？ | JS 执行单线程，IO 靠 libuv 线程池 + 内核异步 |
| 为什么单线程能高并发？ | IO 不阻塞 JS 线程，内核管 socket，回调驱动 |
| nextTick 和 Promise 谁先？ | nextTick 先（微任务中优先级最高） |
| setTimeout(0) 和 setImmediate 谁先？ | 不确定（主模块中）；IO 回调内 setImmediate 先 |
| Event Loop 和浏览器区别？ | Node 有六个阶段 + nextTick；浏览器有渲染步骤 + rAF |
| CPU 密集型怎么办？ | Worker Threads / child_process / 下沉 C++ addon |
