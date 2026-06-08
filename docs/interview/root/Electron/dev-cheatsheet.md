# Electron 开发速查

> 按"开发时实际用到什么"组织：API 对象 + 常用命令 + 关键配置。不是 API 文档，是"知道有什么、干什么、怎么用"。

---

## 目录

- [核心 API 对象（按进程分）](#核心-api-对象按进程分)
  - [主进程 API](#主进程-api)
  - [渲染进程 API](#渲染进程-api)
  - [两端共用](#两端共用)
- [常用开发命令](#常用开发命令)
- [关键配置项](#关键配置项)
- [生命周期事件](#生命周期事件)
- [常见模式速查](#常见模式速查)

---

## 核心 API 对象（按进程分）

### 主进程 API

> 只能在主进程（main）中使用。

| 对象/模块 | 做什么 | 关键方法 |
|-----------|--------|---------|
| `app` | 应用生命周期 | `app.whenReady()` / `app.quit()` / `app.on('activate')` |
| `BrowserWindow` | 创建/管理窗口（自带 webContents） | `new BrowserWindow(options)` / `win.loadURL()` / `win.close()` |
| `BaseWindow` | 创建空窗口（不带 webContents，Electron 30+） | 配合 WebContentsView 使用，多视图拼接场景 |
| `WebContentsView` | 嵌入窗口的子视图（替代已废弃的 BrowserView） | `win.contentView.addChildView(view)` / `view.setBounds()` |
| `ipcMain` | 接收渲染进程消息 | `ipcMain.handle(channel, handler)` / `ipcMain.on(channel, listener)` |
| `Menu` | 系统菜单 | `Menu.buildFromTemplate(template)` / `Menu.setApplicationMenu(menu)` |
| `Tray` | 系统托盘图标 | `new Tray(icon)` / `tray.setContextMenu(menu)` |
| `dialog` | 原生对话框 | `dialog.showOpenDialog()` / `dialog.showSaveDialog()` / `dialog.showMessageBox()` |
| `globalShortcut` | 全局快捷键 | `globalShortcut.register('CmdOrCtrl+Shift+I', callback)` |
| `Notification` | 系统通知 | `new Notification({ title, body }).show()` |
| `autoUpdater` | 自动更新 | `autoUpdater.checkForUpdates()` / `autoUpdater.quitAndInstall()` |
| `session` | 网络/Cookie/缓存 | `session.defaultSession.cookies` / `session.setProxy()` |
| `protocol` | 自定义协议 | `protocol.registerFileProtocol('myapp', handler)` |
| `nativeTheme` | 系统主题（暗/亮） | `nativeTheme.shouldUseDarkColors` / `nativeTheme.on('updated')` |
| `screen` | 屏幕信息 | `screen.getPrimaryDisplay()` / `screen.getAllDisplays()` |
| `shell` | 系统操作 | `shell.openExternal(url)` / `shell.openPath(path)` |
| `clipboard` | 剪贴板 | `clipboard.readText()` / `clipboard.writeText(text)` |
| `powerMonitor` | 电源状态 | `powerMonitor.on('suspend')` / `powerMonitor.on('resume')` |

### 渲染进程 API

> 通过 preload 暴露给渲染进程的 Electron API。

| 对象/模块 | 做什么 | 关键方法 |
|-----------|--------|---------|
| `ipcRenderer` | 向主进程发消息 | `ipcRenderer.invoke(channel, ...args)` / `ipcRenderer.send()` / `ipcRenderer.on()` |
| `contextBridge` | 安全暴露 API | `contextBridge.exposeInMainWorld(key, api)` |
| `webFrame` | 当前页面控制 | `webFrame.setZoomFactor(1.5)` / `webFrame.insertCSS(css)` |

### 两端共用

| 对象/模块 | 做什么 | 关键方法 |
|-----------|--------|---------|
| `process` | 进程信息 | `process.platform` / `process.versions.electron` / `process.type`（'browser'/'renderer'） |
| `nativeImage` | 图片处理 | `nativeImage.createFromPath(path)` / `.resize()` / `.toPNG()` |

---

## 常用开发命令

```bash
# ====== electron-vite 项目 ======
pnpm dev                      # 启动开发（main+preload+renderer 同时 HMR）
pnpm build                    # 构建三个入口
pnpm preview                  # 预览构建产物（不打包成安装包）

# ====== 打包（electron-builder）======
npx electron-builder --mac    # 打 macOS 包（.dmg）
npx electron-builder --win    # 打 Windows 包（.exe）
npx electron-builder --linux  # 打 Linux 包（.AppImage）
npx electron-builder --dir    # 只打目录（不打安装包，快速验证）

# ====== 调试 ======
# 主进程调试：在 package.json 的 scripts 里加 --inspect
"dev": "electron-vite dev -- --inspect=5858"
# 然后 Chrome 打开 chrome://inspect 连接

# 渲染进程调试：自带 DevTools
win.webContents.openDevTools()

# ====== 发布 ======
npx electron-builder --publish always    # 构建 + 上传到 GitHub Releases
```

---

## 关键配置项

### BrowserWindow 创建选项

```typescript
new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  frame: true,               // false = 无边框窗口（自定义标题栏）
  titleBarStyle: 'hiddenInset',  // macOS 红绿灯位置
  transparent: false,        // 透明窗口
  resizable: true,
  show: false,               // 先隐藏，ready-to-show 后再显示（避免白闪）
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,  // 必须 true（安全）
    nodeIntegration: false,  // 必须 false（安全）
    sandbox: true,           // 渲染进程沙箱
    webSecurity: true,       // 同源策略
  },
});

// 避免白闪：先 hide，内容渲染好后再 show
win.on('ready-to-show', () => win.show());
```

### electron-builder.yml 关键配置

```yaml
appId: com.company.app          # 应用唯一标识
productName: MyApp              # 显示名称
asar: true                      # 打包为 asar 归档（保护源码）
directories:
  output: release               # 输出目录

mac:
  target: [dmg, zip]
  category: public.app-category.developer-tools
  entitlements: entitlements.mac.plist     # macOS 沙箱权限
  entitlementsInherit: entitlements.mac.plist

win:
  target: [nsis]
  certificateFile: ./cert.pfx             # Windows 签名证书
  certificatePassword: ${WIN_CSC_KEY_PASSWORD}

nsis:
  oneClick: false               # 非一键安装（可选安装目录）
  allowToChangeInstallationDirectory: true

publish:
  provider: github              # 自动更新源
```

---

## 生命周期事件

```
App 启动 → 'will-finish-launching' → 'ready' → 创建窗口
窗口关闭 → 'window-all-closed' → macOS 不退出 / 其他退出
App 退出 → 'before-quit' → 'will-quit' → 'quit'
macOS 点 Dock → 'activate'（重新创建窗口）
```

```typescript
// 标准生命周期模板
app.whenReady().then(() => {
  createMainWindow();

  // macOS：点 Dock 图标时如果没有窗口则重新创建
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// 非 macOS：所有窗口关闭后退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

## 常见模式速查

### 单实例（防止重复打开）

```typescript
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();  // 已有实例运行，退出
} else {
  app.on('second-instance', () => {
    // 用户尝试打开第二个实例 → 聚焦已有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

### 无边框窗口 + 自定义拖拽区域

```typescript
// 主进程
new BrowserWindow({ frame: false, titleBarStyle: 'hidden' });

// 渲染进程 CSS
.titlebar {
  -webkit-app-region: drag;    /* 可拖拽区域 */
}
.titlebar button {
  -webkit-app-region: no-drag; /* 按钮可点击 */
}
```

### 深度链接（自定义协议）

```typescript
// 注册协议：myapp://path
app.setAsDefaultProtocolClient('myapp');

// 处理协议打开（macOS）
app.on('open-url', (event, url) => {
  handleDeepLink(url);  // url = 'myapp://settings/account'
});

// Windows/Linux 通过 second-instance 事件拿到 argv
app.on('second-instance', (event, argv) => {
  const url = argv.find(arg => arg.startsWith('myapp://'));
  if (url) handleDeepLink(url);
});
```

### 文件拖拽

```typescript
// 渲染进程：监听拖拽
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  files.forEach(file => {
    window.api.openFile(file.path);  // 通过 preload 暴露的 API 处理
  });
});
document.addEventListener('dragover', (e) => e.preventDefault());
```
