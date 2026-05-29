# Electron IPC 通信

## 本质

**IPC = 进程间通信**。和 RN 的 JSI/Bridge、Android 的 Binder 是同一类问题：两个隔离的运行环境需要交换数据。

```
渲染进程（Chromium 沙箱）←→ 主进程（Node.js）
  不能直接调用对方的函数/变量
  必须通过消息传递（序列化 → 传输 → 反序列化）
```

---

## 三种通信模式

### 1. 渲染 → 主（请求-响应，最常用）

```typescript
// preload.ts
contextBridge.exposeInMainWorld('api', {
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  //                          ↑ invoke = 发请求，等响应（返回 Promise）
});

// main.ts
ipcMain.handle('file:read', async (event, path: string) => {
  return await fs.readFile(path, 'utf-8');  // 返回值自动传回渲染进程
});

// renderer（React 组件）
const content = await window.api.readFile('/path');  // 像调本地函数一样
```

### 2. 渲染 → 主（单向通知，不需要响应）

```typescript
// preload.ts
contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window:minimize'),
  //              ↑ send = 发出去就不管了，不等响应
});

// main.ts
ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
```

### 3. 主 → 渲染（主动推送）

```typescript
// main.ts（主进程主动推送消息给渲染进程）
mainWindow.webContents.send('device:status', { connected: true, battery: 85 });

// preload.ts
contextBridge.exposeInMainWorld('api', {
  onDeviceStatus: (callback: (data: any) => void) => {
    ipcRenderer.on('device:status', (_, data) => callback(data));
  },
});

// renderer
useEffect(() => {
  window.api.onDeviceStatus((data) => {
    setDeviceStatus(data);  // 实时更新 UI
  });
}, []);
```

---

## 通信原理

```
ipcRenderer.invoke('channel', data)
  │
  ▼ 结构化克隆算法序列化 data（类似 JSON，但支持 ArrayBuffer/Date/Map 等）
  │
  ▼ 通过 Chromium IPC 管道（底层是操作系统的 pipe/socket）传输到主进程
  │
  ▼ ipcMain.handle 接收 → 反序列化 → 执行 handler → 返回结果
  │
  ▼ 结果序列化回传
  │
  ▼ invoke 的 Promise resolve
```

**性能**：单次 IPC 延迟 ~0.1ms（本机进程间通信，极快）。但大数据量（>1MB）会有序列化开销，可以用 SharedArrayBuffer 或 MessagePort 优化。

---

## 和 RN 通信的对比

| | Electron IPC | RN JSI/TurboModule |
|--|---|---|
| 通信方式 | 进程间消息（序列化） | 同进程 C++ 函数调用（无序列化） |
| 延迟 | ~0.1ms | ~0.001ms |
| 同步能力 | ❌ 只能异步（invoke 返回 Promise） | ✅ 可同步 |
| 安全模型 | contextBridge 白名单 | Codegen 类型约束 |
| 大数据 | SharedArrayBuffer / MessagePort | ArrayBuffer 零拷贝 |

**Electron IPC 比 RN Bridge 慢但比旧 RN Bridge 快**——因为是本机进程间通信（不跨网络），序列化用结构化克隆（比 JSON 快）。
