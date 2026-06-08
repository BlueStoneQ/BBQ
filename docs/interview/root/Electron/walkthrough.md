# Electron 开发实战：从一个例子理解全貌

> 通过一个最小完整例子（打开窗口 + 选择文件 + 读取内容 + 上传）串起 Electron 开发的所有核心概念。

---

## 目录

- [例子：选择文件并上传](#例子选择文件并上传)
- [三个文件各自的角色](#三个文件各自的角色)
- [完整代码](#完整代码)
- [数据流向](#数据流向)
- [为什么要绕这一圈](#为什么要绕这一圈)
- [视图类型](#视图类型)
- [IPC 底层机制](#ipc-底层机制)
- [扩展：传参给主进程](#扩展传参给主进程)

---

## 例子：选择文件并上传

```
功能需求：
  1. 用户点击应用图标 → 打开一个窗口
  2. 窗口里有个"选择文件"按钮
  3. 点击后弹出系统文件选择框
  4. 选完后读取文件内容
  5. 上传到服务器
```

---

## 三个文件各自的角色

```
main.ts（主进程）：
  - 创建窗口
  - 注册 IPC handler（处理渲染进程的请求）
  - 调用系统 API（dialog、fs）
  - 发起网络请求（上传文件到后端）
  = 类比：后端服务器

preload.ts（桥接层）：
  - 跑在渲染进程里，但有特权（能访问 ipcRenderer）
  - 用 contextBridge 白名单暴露方法给页面 JS
  - 不含业务逻辑，只做"转发"
  = 类比：JSBridge 协议定义

renderer（React 页面）：
  - 纯前端代码（React + HTML + CSS）
  - 通过 window.api.xxx 调用 preload 暴露的方法
  - 不能直接用 Node.js / Electron API
  = 类比：H5 页面
```

---

## 完整代码

```typescript
// ===== main.ts（主进程）=====
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';

let mainWindow: BrowserWindow;

app.whenReady().then(() => {
  // 1. 创建窗口
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 渲染进程和 preload 隔离
      nodeIntegration: false,   // 渲染进程不能用 Node
    },
  });
  mainWindow.loadFile('dist/index.html');

  // 2. 注册 IPC handler：选择文件 + 读取
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Text', extensions: ['txt', 'json', 'md'] }],
    });
    if (result.canceled) return null;

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { path: filePath, name: path.basename(filePath), content };
  });

  // 3. 注册 IPC handler：上传文件到后端
  ipcMain.handle('upload-file', async (_, data: { name: string; content: string }) => {
    // 主进程发网络请求（可以用 Node 的 fetch / axios）
    const response = await fetch('https://api.example.com/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  });
});
```

```typescript
// ===== preload.ts（桥接层）=====
import { contextBridge, ipcRenderer } from 'electron';

// 白名单暴露：渲染进程只能调这两个方法，调不到别的
contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  uploadFile: (data: { name: string; content: string }) => ipcRenderer.invoke('upload-file', data),
});
```

```tsx
// ===== renderer/App.tsx（React 页面）=====
function App() {
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [uploaded, setUploaded] = useState(false);

  // 选择文件
  const handleSelect = async () => {
    const result = await window.api.selectFile();
    if (result) setFile(result);
  };

  // 上传文件
  const handleUpload = async () => {
    if (!file) return;
    const ok = await window.api.uploadFile({ name: file.name, content: file.content });
    setUploaded(ok);
  };

  return (
    <div>
      <button onClick={handleSelect}>选择文件</button>
      {file && (
        <>
          <p>已选择：{file.name}</p>
          <button onClick={handleUpload}>上传</button>
          {uploaded && <p>上传成功 ✓</p>}
        </>
      )}
    </div>
  );
}
```

---

## 数据流向

```
选择文件：
  React 按钮点击
    → window.api.selectFile()
    → preload: ipcRenderer.invoke('select-file')
    → [IPC 跨进程] →
    → main: ipcMain.handle('select-file')
      → dialog.showOpenDialog()（系统弹框）
      → fs.readFile()（读文件）
      → return { name, content }
    → [IPC 返回] →
    → React: setFile(result) → 显示文件名

上传文件：
  React 上传按钮点击
    → window.api.uploadFile({ name, content })
    → preload: ipcRenderer.invoke('upload-file', data)
    → [IPC 跨进程] →
    → main: ipcMain.handle('upload-file')
      → fetch('https://api.example.com/upload', ...)（网络请求）
      → return response.ok
    → [IPC 返回] →
    → React: setUploaded(true)
```

---

## 为什么要绕这一圈

```
为什么渲染进程不能直接调 dialog / fs / fetch ？

  安全原因：
    渲染进程 = Chromium 页面 = 可能加载外部内容（OAuth 回调页、第三方嵌入）
    如果渲染进程有 Node 权限 → 恶意页面可以读写你的文件系统
    所以必须隔离：渲染进程只是 UI，系统操作全走 IPC 到主进程

  和跨端开发的对应关系：
    Electron 渲染进程 = H5 页面 = RN JS 线程
    Electron 主进程 = Native 宿主 = RN Native 侧
    Electron IPC = JSBridge = RN Bridge/JSI
    Electron preload = JSBridge 协议定义 = TurboModule Spec

  = 本质都是同一个模式："不信任的 UI 层通过受控通道访问系统能力"
```

---

## 视图类型

| 类型 | 说明 | 独立进程？ | 适用 |
|------|------|-----------|------|
| `BrowserWindow` | 独立窗口 | ✅ 独立渲染进程 | 99% 场景 |
| `WebContentsView` | 嵌入到窗口内的子视图 | ✅ 独立 webContents | 多视图拼接（如分栏编辑器） |
| `<webview>` 标签 | 渲染进程内嵌入页面（类似 iframe） | ✅ 独立进程 | 不推荐（安全问题） |
| 应用内 Tab | 同一窗口内 UI 切换 | ❌ 共享渲染进程 | VS Code 编辑器 Tab |

> 注：BrowserView 已废弃，被 WebContentsView 替代（Electron 30+）。

---

## IPC 底层机制

```
Electron IPC 底层用的是 Chromium 的 Mojo IPC（不是操作系统原始 IPC）

  Mojo 在各平台的底层传输：
    Linux: Unix Domain Socket
    Windows: Named Pipe
    macOS: Mach Port
  → 对 Electron 开发者完全透明，你只用 ipcMain/ipcRenderer

  序列化方式：
    Structured Clone Algorithm（不是 JSON.stringify）
    支持：ArrayBuffer / Map / Set / Date / RegExp / Error
    不支持：Function / DOM 节点 / Symbol

  和 JSI 的本质区别：
    JSI = 同进程 + 同步 + 零拷贝（共享内存）
    Electron IPC = 跨进程 + 异步 + 结构化克隆（有序列化开销）
    
  延迟：~0.1ms（本机进程间通信，不走网络）
```

---

## 扩展：传参给主进程

```typescript
// 渲染进程传参 → preload 转发 → 主进程接收

// preload
contextBridge.exposeInMainWorld('api', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  //                                                            ↑ 参数传过去
});

// main
ipcMain.handle('read-file', async (event, filePath: string) => {
  //                                      ↑ 第二个参数起就是渲染进程传的参数
  return fs.readFile(filePath, 'utf-8');
});

// renderer
const content = await window.api.readFile('/path/to/file');
```

**invoke 的参数传递规则**：
- 参数经过 Structured Clone 序列化（不能传函数、DOM 节点）
- 返回值也经过 Structured Clone（Promise resolve 的值传回渲染进程）
- 可以传多个参数：`invoke('channel', arg1, arg2, arg3)`
