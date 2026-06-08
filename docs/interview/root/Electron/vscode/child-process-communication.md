# VS Code 子进程通信（adb / CDP）

> 解决什么问题：IDE 需要和外部工具/设备交互（编译器、调试器、真机），这些操作必须跑在独立子进程中——不能阻塞 Main 或 Renderer。
>
> 场景：快应用 IDE 的设备通信（adb 连真机）、Chrome DevTools Protocol 调试、构建编译。

---

## 目录

- [为什么用子进程](#为什么用子进程)
- [子进程创建方式](#子进程创建方式)
- [adb 通信（设备管理）](#adb-通信设备管理)
- [CDP 通信（调试协议）](#cdp-通信调试协议)
- [子进程管理（生命周期 / 错误处理）](#子进程管理)

---

## 为什么用子进程

```
Main 进程是单线程事件循环（Node.js）
如果在 Main 里直接跑：
  - 编译（CPU 密集）→ 阻塞 IPC → 所有窗口通信卡住
  - adb 操作（等待设备响应）→ 阻塞 → UI 无响应
  - 调试协议（持续双向通信）→ 事件循环被占

解法：fork/spawn 子进程，Main 只做"调度者"
  Main → spawn('adb', ['devices']) → 子进程跑 → 结果回传 → Main 转发给 Renderer
```

---

## 子进程创建方式

| 方式 | API | 适用 |
|------|-----|------|
| `spawn` | 流式输出（stdout/stderr pipe） | 长时间运行（adb logcat / 编译 watch） |
| `exec` | 缓冲输出（执行完一次性返回） | 短命令（adb devices / git status） |
| `fork` | Node.js 子进程 + IPC 通道 | 需要 JS 逻辑的独立进程（Language Server） |
| `Worker Thread` | 同进程多线程 | CPU 计算（不需要独立进程的场景） |

```typescript
import { spawn, exec, fork } from 'child_process';

// spawn：流式（适合持续输出）
const logcat = spawn('adb', ['logcat']);
logcat.stdout.on('data', (chunk) => { /* 实时处理日志流 */ });
logcat.on('close', (code) => { /* 进程结束 */ });

// exec：一次性（适合短命令）
exec('adb devices', (err, stdout) => {
  const devices = parseDeviceList(stdout);
});

// fork：Node 子进程 + IPC（适合复杂逻辑独立进程）
const worker = fork('./language-server.js');
worker.send({ type: 'analyze', file: 'app.ts' });
worker.on('message', (result) => { /* 收到分析结果 */ });
```

---

## adb 通信（设备管理）

```
快应用 IDE 需要：
  - 列出已连接设备（adb devices）
  - 推送文件到设备（adb push）
  - 安装 APK（adb install）
  - 实时日志（adb logcat）
  - 端口转发（adb forward）用于调试通道

实现方式：
  Main 进程 spawn adb 子进程
  → 解析 stdout 输出
  → 通过 IPC 推送设备列表到 Renderer
  → Renderer 展示设备面板

设备状态变化监听：
  spawn('adb', ['track-devices'])  // 持续监听设备连接/断开
  → 每当设备列表变化 → stdout 输出新数据
  → Main 解析 → IPC 通知 Renderer 更新 UI
```

---

## CDP 通信（调试协议）

```
Chrome DevTools Protocol（CDP）= 调试器和被调试页面之间的通信协议
  - JSON-RPC over WebSocket
  - 可以：设置断点 / 查看 DOM / 执行 JS / 获取性能数据

快应用 IDE 调试器实现：
  1. adb forward tcp:9222 → 把设备上的调试端口映射到本机
  2. Main 进程通过 WebSocket 连接 ws://localhost:9222
  3. 发送 CDP 命令（Page.reload / Debugger.setBreakpoint / Runtime.evaluate）
  4. 收到 CDP 事件（Debugger.paused / Console.messageAdded）
  5. 通过 IPC 推送到 Renderer 的调试面板展示

本质：
  设备上的 WebView → 暴露 CDP WebSocket 端口
  IDE（Electron Main）→ WebSocket 客户端连接
  → 双向 JSON-RPC 通信
  → 和 Chrome DevTools 调试网页是同一个协议
```

---

## 子进程管理

```
关键问题：子进程挂了怎么办？太多了怎么办？

管理策略：
  1. 注册表：Main 维护一个 Map<id, ChildProcess>，统一管理所有子进程
  2. 超时：命令执行超时 → 自动 kill
  3. 重启：关键子进程挂了 → 自动重启（带退避策略）
  4. 清理：App 退出时 kill 所有子进程（防僵尸进程）

// App 退出时清理
app.on('before-quit', () => {
  childProcesses.forEach(p => p.kill());
});

// 子进程崩溃重启
worker.on('exit', (code) => {
  if (code !== 0) {
    setTimeout(() => respawn(), 1000);  // 1s 后重启
  }
});
```
