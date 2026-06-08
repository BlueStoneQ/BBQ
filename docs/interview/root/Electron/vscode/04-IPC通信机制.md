# 04 - IPC 通信机制

> 核心问题: 多进程间如何高效、类型安全地通信？RPC 协议怎么设计？

## 目录

- [第一性原理](#第一性原理)
- [架构分层](#架构分层)
- [Channel 模型](#channel-模型)
  - [核心接口](#核心接口)
  - [工作流程](#工作流程)
  - [消息协议格式](#消息协议格式)
- [IPC Server / Client 模式](#ipc-server--client-模式)
- [传输层实现](#传输层实现)
- [Extension Host 专用: RPC Protocol](#extension-host-专用-rpc-protocol)
  - [核心机制](#核心机制)
  - [命名约定](#命名约定)
- [通信模式总结](#通信模式总结)
- [性能考量](#性能考量)
- [小结](#小结)

---

## 第一性原理

**问题**：5+ 个进程需要互相调用方法、传递数据。如果每次都手写 `send/on`，会爆炸。

**本质需求**：
1. 像调用本地方法一样调用远程方法 (RPC 透明性)
2. 类型安全 — 编译期就知道远程方法签名
3. 支持多种传输层 — Electron IPC / MessagePort / Socket
4. 支持请求/响应 + 事件流

**VSCode 的答案**：双层 IPC 抽象
- **底层**: Channel 模型 (`vs/base/parts/ipc/`) — 通用的请求-响应 + 事件
- **上层**: RPC Protocol (`workbench/services/extensions/common/rpcProtocol.ts`) — Extension Host 专用

## 架构分层

```
┌────────────────────────────────────────────────┐
│         使用层: Service Proxy                    │
│   (调用方感知不到跨进程，就像调本地服务)             │
├────────────────────────────────────────────────┤
│         Channel 层                              │
│   IChannel / IServerChannel 抽象                │
│   请求(call) + 监听事件(listen)                  │
├────────────────────────────────────────────────┤
│         Connection 层                           │
│   管理连接、路由到正确的 Channel                   │
├────────────────────────────────────────────────┤
│         传输层                                   │
│   Electron IPC | MessagePort | Socket | Worker │
└────────────────────────────────────────────────┘
```

## 源码路径

```
vs/base/parts/ipc/
├── common/
│   └── ipc.ts              ← 核心抽象: IChannel, IServerChannel, IPCServer/Client
├── electron-main/
│   └── ipc.electron.ts     ← Electron ipcMain 传输实现
├── electron-browser/
│   └── ipc.electron.ts     ← Electron ipcRenderer 传输实现
├── node/
│   └── ipc.net.ts          ← Node Socket 传输实现
└── browser/
    └── ipc.mp.ts           ← MessagePort 传输实现
```

## Channel 模型

### 核心接口

```typescript
// 客户端侧: 发请求 + 监听事件
interface IChannel {
  call<T>(command: string, arg?: any): Promise<T>;
  listen<T>(event: string, arg?: any): Event<T>;
}

// 服务端侧: 处理请求 + 提供事件
interface IServerChannel<TContext = string> {
  call(ctx: TContext, command: string, arg?: any): Promise<any>;
  listen(ctx: TContext, event: string, arg?: any): Event<any>;
}
```

### 工作流程

```
[Renderer]                              [Main Process]
    │                                        │
    │  channel.call('readFile', uri)          │
    │  ──────────────────────────────────►    │
    │                                        │  serverChannel.call(ctx, 'readFile', uri)
    │                                        │  → fileService.readFile(uri)
    │  ◄──────────────────────────────────    │
    │  Promise<content>                      │
    │                                        │
    │  channel.listen('onFileChange')        │
    │  ──────────────────────────────────►    │
    │                                        │  serverChannel.listen(ctx, 'onFileChange')
    │  ◄── Event stream ──────────────────   │  → watcher.onDidChange
    │  onFileChange(event1)                  │
    │  onFileChange(event2)                  │
    │  ...                                   │
```

### 消息协议格式

```typescript
// 请求消息
interface IRawRequest {
  type: RequestType.Promise | RequestType.EventListen;
  id: number;          // 请求ID (用于匹配响应)
  channelName: string; // 目标 Channel
  name: string;        // 方法名/事件名
  arg?: any;           // 参数 (会被序列化)
}

// 响应消息
interface IRawResponse {
  type: ResponseType.Initialize | ResponseType.PromiseSuccess | ResponseType.PromiseError | ResponseType.EventFire;
  id: number;          // 对应请求ID
  data?: any;          // 结果数据
}
```

## IPC Server / Client 模式

### Main Process 作为 Server

```typescript
// Main Process (Server 侧)
class CodeApplication {
  startup() {
    const server = new IPCServer(electronIpcTransport);
    
    // 注册 Channel
    server.registerChannel('files', new FileChannel(fileService));
    server.registerChannel('window', new WindowChannel(windowService));
  }
}
```

### Renderer 作为 Client

```typescript
// Renderer Process (Client 侧)
class WorkbenchMain {
  startup() {
    const client = new IPCClient(electronIpcTransport);
    
    // 获取远程 Channel 的代理
    const fileChannel = client.getChannel('files');
    
    // 像调本地方法一样用
    const content = await fileChannel.call<Buffer>('readFile', uri);
  }
}
```

## 传输层实现

### Electron IPC (主进程 ↔ 渲染进程)

```typescript
// electron-main 侧
ipcMain.on('vscode:message', (event, msg) => { /* 处理 */ });
event.sender.send('vscode:message', response);

// electron-browser 侧 (通过 preload 暴露)
ipcRenderer.send('vscode:message', request);
ipcRenderer.on('vscode:message', (event, msg) => { /* 处理 */ });
```

### MessagePort (渲染进程 ↔ Worker / Utility Process)

```typescript
// 通过 MessageChannel 创建端口对
const { port1, port2 } = new MessageChannel();
// port1 给一侧，port2 给另一侧
port1.postMessage(data);
port2.onmessage = (e) => { /* 处理 */ };
```

### Node Socket (Remote 场景)

```typescript
// 用于 vscode-server (SSH Remote)
const socket = net.createConnection(port, host);
// 自定义协议头 + 消息体
```

## Extension Host 专用: RPC Protocol

插件宿主和 Renderer 之间的通信更复杂，使用专门的 RPC 协议：

```
源码: vs/workbench/services/extensions/common/rpcProtocol.ts
```

### 设计动机

Channel 模型是命令式的 (`call('method', arg)`)，不够类型安全。Extension Host 需要：
- 代理对象 — 自动将方法调用转为 RPC
- 双向通信 — 两侧都可以调对方
- 标识符注册 — 通过 ProxyIdentifier 路由

### 核心机制

```typescript
// 1. 定义代理标识符
const MainContext = {
  MainThreadCommands: createMainId<MainThreadCommandsShape>('MainThreadCommands'),
  MainThreadEditors: createMainId<MainThreadEditorsShape>('MainThreadEditors'),
  // ...
};

const ExtHostContext = {
  ExtHostCommands: createExtId<ExtHostCommandsShape>('ExtHostCommands'),
  ExtHostEditors: createExtId<ExtHostEditorsShape>('ExtHostEditors'),
  // ...
};

// 2. Extension Host 侧获取 Main 的代理
class ExtHostCommands {
  private _proxy: MainThreadCommandsShape;
  
  constructor(rpc: IRPCProtocol) {
    this._proxy = rpc.getProxy(MainContext.MainThreadCommands);
  }
  
  executeCommand(id: string, ...args: any[]) {
    // 实际通过 RPC 调用到 Renderer 进程的 MainThreadCommands
    return this._proxy.$executeCommand(id, args);
  }
}

// 3. Renderer 侧注册实现
class MainThreadCommands {
  $executeCommand(id: string, args: any[]) {
    return this.commandService.executeCommand(id, ...args);
  }
}
```

### 命名约定

- `$` 前缀 — 表示跨进程调用的方法 (如 `$executeCommand`)
- `MainThread*` — Renderer 侧的实现类
- `ExtHost*` — Extension Host 侧的实现类

### 序列化

跨进程传输需要序列化。VSCode 对特殊类型有专门处理：
- `URI` → 字符串
- `Range/Position` → 纯数字对象
- `CancellationToken` → 特殊标记 (保持可取消语义)
- 循环引用 → 抛错

## 通信模式总结

| 通信路径 | 机制 | 传输层 |
|---------|------|-------|
| Main ↔ Renderer | Channel + Electron IPC | ipcMain/ipcRenderer |
| Main ↔ Utility | Channel + MessagePort | Electron utilityProcess |
| Renderer ↔ Extension Host | RPC Protocol | MessagePort |
| Renderer ↔ Web Worker | Channel + MessagePort | Worker.postMessage |
| Local ↔ Remote Server | Channel + Socket | TCP/WebSocket |

## 性能考量

| 问题 | 解决方案 |
|------|---------|
| 序列化开销 | 使用 Structured Clone 而非 JSON (保留 ArrayBuffer 零拷贝) |
| 大数据传输 | 使用 Transferable 转移所有权 (不复制) |
| 高频事件 | 事件节流/防抖 在发送端做 |
| 请求排队 | 异步队列，避免 IPC 通道拥塞 |
| 超时处理 | CancellationToken 支持取消长时间请求 |

## 小结

| 设计决策 | 第一性原理 |
|---------|-----------|
| Channel 抽象 | 一套接口适配多种传输层 |
| Server/Client 模式 | 清晰的服务提供者/消费者角色 |
| RPC Proxy | 调用透明 — 使用者不感知跨进程 |
| `$` 方法命名 | 显式标记跨进程调用，code review 一目了然 |
| ProxyIdentifier | 编译期类型安全的远程方法签名 |
