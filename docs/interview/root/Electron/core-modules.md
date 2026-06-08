# Electron 核心大件

## 目录

- [路由](#路由)
- [网络](#网络)
- [存储](#存储)
- [自动更新](#自动更新)
- [子进程（重计算/外部工具）](#子进程重计算外部工具)
- [系统集成](#系统集成)

## 路由

**本质**：Electron 没有自己的路由。渲染进程就是一个 React App，直接用 React Router。

```tsx
// 必须用 HashRouter（file:// 协议不支持 history API）
import { HashRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}
```

**多窗口路由**：每个窗口加载不同的 hash 路由：
```typescript
// 主进程
settingsWindow.loadFile('dist/index.html', { hash: '/settings' });
```

---

## 网络

| 场景 | 方案 | 说明 |
|------|------|------|
| 渲染进程请求 API | `fetch` / `axios` | 和浏览器一样，受 CORS 限制 |
| 主进程请求（绕过 CORS） | `electron.net` 或 Node.js `http` | 不受 CORS 限制（不是浏览器环境） |
| WebSocket | 渲染进程直接用 `new WebSocket()` | 实时通信 |
| 下载文件 | 主进程 `electron.net` + `fs.writeFile` | 大文件下载 |

```typescript
// 主进程绕过 CORS（渲染进程请求被 CORS 拦截时，走主进程代理）
ipcMain.handle('fetch-no-cors', async (_, url: string) => {
  const response = await fetch(url);  // Node.js fetch，无 CORS
  return await response.json();
});
```

---

## 存储

| 方案 | 适用 | 本质 |
|------|------|------|
| **electron-store** | 配置/设置（KV） | JSON 文件存在用户目录 |
| **better-sqlite3** | 结构化数据 | SQLite 文件（主进程操作） |
| **IndexedDB** | 渲染进程缓存 | Chromium 内置（和浏览器一样） |
| **fs** | 文件读写 | Node.js 文件系统 |

```typescript
// electron-store（最常用）
import Store from 'electron-store';
const store = new Store();
store.set('user.name', 'test');
store.get('user.name');  // 'test'
// 数据存在：~/Library/Application Support/MyApp/config.json（macOS）
```

---

## 自动更新

```typescript
// 主进程
import { autoUpdater } from 'electron-updater';

// 检查更新（启动时 + 定时）
autoUpdater.checkForUpdatesAndNotify();

// 监听事件
autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update:available', info.version);
});

autoUpdater.on('update-downloaded', () => {
  // 下载完成，提示用户重启
  mainWindow.webContents.send('update:ready');
});

// 用户确认后重启安装
ipcMain.on('update:install', () => {
  autoUpdater.quitAndInstall();
});
```

**更新源**：GitHub Releases / S3 / 自建服务器。`electron-builder.yml` 中配置 `publish` 字段。

---

## 子进程（重计算/外部工具）

```typescript
// 主进程中启动子进程（构建/编译/adb 等）
import { spawn } from 'child_process';

function runBuild(projectPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build'], { cwd: projectPath });
    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      mainWindow.webContents.send('build:log', data.toString());  // 实时推送日志给 UI
    });

    child.on('close', (code) => {
      code === 0 ? resolve(output) : reject(new Error(`Exit code: ${code}`));
    });
  });
}
```

---

## 系统集成

| 能力 | API | 说明 |
|------|-----|------|
| 系统通知 | `new Notification({ title, body })` | 渲染进程直接用 Web API |
| 系统托盘 | `new Tray(icon)` | 主进程，最小化到托盘 |
| 菜单栏 | `Menu.buildFromTemplate([...])` | 主进程，自定义菜单 |
| 文件对话框 | `dialog.showOpenDialog()` | 主进程，选择文件/保存文件 |
| 快捷键 | `globalShortcut.register('Ctrl+Shift+I', fn)` | 全局快捷键 |
| 深度链接 | `app.setAsDefaultProtocolClient('myapp')` | `myapp://open?file=xxx` |
| 开机自启 | `app.setLoginItemSettings({ openAtLogin: true })` | 系统登录时自动启动 |
