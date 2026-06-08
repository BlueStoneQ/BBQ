# Electron 项目结构与架构设计

## 目录

- [分层架构](#分层架构)
- [Monorepo 目录结构](#monorepo-目录结构)
- [构建工具链](#构建工具链)
  - [electron-vite 配置](#electron-vite-配置)
- [核心模块设计](#核心模块设计)
  - [窗口管理](#窗口管理)
  - [IPC 模块化注册](#ipc-模块化注册)
  - [Preload 类型安全](#preload-类型安全)
  - [渲染进程使用（React 组件）](#渲染进程使用react-组件)
- [打包分发](#打包分发)
  - [环境搭建（分平台）](#环境搭建分平台)
  - [签名与公证（生产发布必须）](#签名与公证生产发布必须)
  - [自动更新](#自动更新)
  - [打包配置与产物](#打包配置与产物)
- [和 RN 多 Bundle 方案的类比](#和-rn-多-bundle-方案的类比)

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层（Renderer Process）                                   │
│  React + Zustand + React Router                              │
│  职责：页面渲染、用户交互、状态管理                            │
├─────────────────────────────────────────────────────────────┤
│  桥接层（Preload）                                           │
│  contextBridge + ipcRenderer                                 │
│  职责：白名单暴露主进程能力给 UI 层（安全边界）               │
├─────────────────────────────────────────────────────────────┤
│  服务层（Main Process）                                      │
│  IPC Handlers + Services                                     │
│  职责：业务逻辑、系统调用、进程管理                           │
├─────────────────────────────────────────────────────────────┤
│  基础设施层（Main Process）                                  │
│  fs / child_process / net / sqlite / electron API            │
│  职责：文件IO、子进程、网络、数据库、窗口管理                 │
└─────────────────────────────────────────────────────────────┘
```

**本质**：和 Web 前后端分离一样——Renderer = 前端，Main = 后端，IPC = HTTP。只不过都在同一台机器上。

---

## Monorepo 目录结构

```
my-electron-app/
├── packages/
│   ├── main/                        ← 主进程（"后端"）
│   │   ├── src/
│   │   │   ├── index.ts             # 入口：创建窗口、注册 IPC
│   │   │   ├── windows/             # 窗口管理（创建/销毁/状态）
│   │   │   │   └── main-window.ts
│   │   │   ├── ipc/                 # IPC Handler（按模块拆分）
│   │   │   │   ├── file.ipc.ts      # 文件操作相关
│   │   │   │   ├── device.ipc.ts    # 设备通信相关
│   │   │   │   └── app.ipc.ts       # 应用生命周期相关
│   │   │   ├── services/            # 业务逻辑层
│   │   │   │   ├── file-service.ts
│   │   │   │   ├── device-service.ts
│   │   │   │   └── update-service.ts
│   │   │   └── utils/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── preload/                     ← 预加载脚本（"桥接层"）
│   │   ├── src/
│   │   │   └── index.ts             # contextBridge 暴露 API
│   │   └── package.json
│   │
│   ├── renderer/                    ← 渲染进程（"前端"，就是一个 React App）
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── pages/               # 页面
│   │   │   ├── components/          # 组件
│   │   │   ├── hooks/               # 自定义 Hooks
│   │   │   ├── stores/              # Zustand stores
│   │   │   └── types/               # 类型定义（含 window.api 类型）
│   │   ├── index.html
│   │   ├── vite.config.ts           # ← Vite 构建渲染进程
│   │   └── package.json
│   │
│   └── shared/                      ← 共享代码（类型定义、常量、工具函数）
│       ├── src/
│       │   ├── types.ts             # IPC 通道名 + 参数类型（两端共用）
│       │   └── constants.ts
│       └── package.json
│
├── electron-builder.yml             ← 打包配置（产出 .dmg/.exe）
├── electron.vite.config.ts          ← electron-vite 统一构建配置
├── package.json                     ← workspace root
└── pnpm-workspace.yaml
```

---

## 构建工具链

| 部分 | 工具 | 说明 |
|------|------|------|
| **渲染进程** | Vite | 和普通 React 项目一样，支持 HMR |
| **主进程** | tsup 或 electron-vite | TS → JS，target: node |
| **preload** | tsup 或 electron-vite | TS → JS，target: node |
| **统一管理** | **electron-vite**（推荐） | 一个配置管三个入口 |
| **打包分发** | electron-builder | 产出安装包（.dmg/.exe/.AppImage） |
| **Monorepo** | pnpm workspace | 多包管理 |

### electron-vite 配置

```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    // 主进程构建配置
    build: { outDir: 'dist/main' },
  },
  preload: {
    // preload 构建配置
    build: { outDir: 'dist/preload' },
  },
  renderer: {
    // 渲染进程 = 普通 Vite React 项目
    plugins: [react()],
    build: { outDir: 'dist/renderer' },
  },
});
```

```bash
# 开发
npx electron-vite dev    # 同时启动 main + preload + renderer（HMR）

# 构建
npx electron-vite build  # 三个入口同时构建

# 打包
npx electron-builder     # 基于构建产物打包成安装包
```

---

## 核心模块设计

### 窗口管理

```typescript
// packages/main/src/windows/main-window.ts
import { BrowserWindow } from 'electron';
import path from 'path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,    // 必须 true（安全）
      nodeIntegration: false,    // 必须 false（安全）
      sandbox: true,
    },
  });

  // 开发时加载 Vite dev server，生产时加载打包产物
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}
```

### IPC 模块化注册

```typescript
// packages/main/src/ipc/file.ipc.ts
import { ipcMain } from 'electron';
import { FileService } from '../services/file-service';

export function registerFileIPC() {
  const fileService = new FileService();

  ipcMain.handle('file:read', (_, path: string) => fileService.read(path));
  ipcMain.handle('file:write', (_, path: string, content: string) => fileService.write(path, content));
  ipcMain.handle('file:list', (_, dir: string) => fileService.list(dir));
}

// packages/main/src/index.ts（入口统一注册）
import { registerFileIPC } from './ipc/file.ipc';
import { registerDeviceIPC } from './ipc/device.ipc';

app.whenReady().then(() => {
  registerFileIPC();
  registerDeviceIPC();
  createMainWindow();
});
```

### Preload 类型安全

```typescript
// packages/shared/src/types.ts（两端共用类型）
export interface ElectronAPI {
  file: {
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    list: (dir: string) => Promise<string[]>;
  };
  device: {
    connect: (id: string) => Promise<boolean>;
    send: (cmd: string) => Promise<void>;
  };
}

// packages/preload/src/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@myapp/shared';

const api: ElectronAPI = {
  file: {
    read: (path) => ipcRenderer.invoke('file:read', path),
    write: (path, content) => ipcRenderer.invoke('file:write', path, content),
    list: (dir) => ipcRenderer.invoke('file:list', dir),
  },
  device: {
    connect: (id) => ipcRenderer.invoke('device:connect', id),
    send: (cmd) => ipcRenderer.invoke('device:send', cmd),
  },
};

contextBridge.exposeInMainWorld('api', api);

// packages/renderer/src/types/global.d.ts（渲染进程类型声明）
import type { ElectronAPI } from '@myapp/shared';
declare global {
  interface Window { api: ElectronAPI; }
}
```

### 渲染进程使用（React 组件）

```tsx
// packages/renderer/src/pages/Editor.tsx
function Editor() {
  const [content, setContent] = useState('');

  useEffect(() => {
    window.api.file.read('/path/to/file').then(setContent);
  }, []);

  const handleSave = async () => {
    await window.api.file.write('/path/to/file', content);
  };

  return (
    <div>
      <textarea value={content} onChange={e => setContent(e.target.value)} />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

---

## 打包分发

### 环境搭建（分平台）

```
初始化项目：
  # 推荐用 electron-vite 脚手架
  npm create @electron-vite/app my-app
  cd my-app && pnpm install

  # 或 electron-forge（官方）
  npx create-electron-app my-app --template=vite-typescript

依赖关键点：
  electron       → devDependencies（不打进 node_modules，由 electron-builder 处理）
  electron-builder → devDependencies（打包工具）

各平台特殊依赖：
  macOS：
    - Xcode Command Line Tools（codesign 签名）
    - Apple Developer 证书（发布到 App Store 或公证需要）
    - 配置 entitlements.plist（沙箱权限声明）

  Windows：
    - Windows SDK（可选，NSIS 安装器不需要）
    - EV 代码签名证书（消除 SmartScreen 警告）
    - 在 macOS/Linux 交叉编译需要 Wine

  Linux：
    - 无特殊依赖（AppImage 自包含）
    - deb/rpm 打包需要对应工具链
```

### 签名与公证（生产发布必须）

| 平台 | 签名方式 | 为什么必须 |
|------|---------|-----------|
| **macOS** | Apple Developer ID + notarize（苹果公证） | 不签名 → Gatekeeper 阻止运行 |
| **Windows** | EV Code Signing Certificate | 不签名 → SmartScreen "未知发布者" 警告 |
| **Linux** | 不强制 | AppImage 不需要签名 |

```yaml
# electron-builder.yml macOS 签名配置
mac:
  target: [dmg, zip]
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  notarize:
    teamId: "TEAM_ID"
  # 签名后上传到 Apple 公证服务，通过后才能被用户正常打开
```

### 自动更新

```
流程：
  App 启动 → 检查更新服务器（GitHub Releases / S3 / 自建）
  → 发现新版本 → 后台下载
  → 下载完成 → 提示用户重启
  → 重启时替换文件 → 完成

关键 API：
  electron-updater 的 autoUpdater
    autoUpdater.checkForUpdatesAndNotify()
    autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall())

macOS：用 Squirrel.Mac（自动 diff 更新，只下载变更部分）
Windows：用 NSIS 安装器覆盖安装 或 Squirrel.Windows
Linux：用户手动下载新 AppImage（或自建更新机制）
```

### 打包配置与产物

```yaml
# electron-builder.yml
appId: com.mycompany.myapp
productName: MyApp
directories:
  output: release

mac:
  target: [dmg, zip]
  icon: assets/icon.icns
  category: public.app-category.developer-tools

win:
  target: [nsis]
  icon: assets/icon.ico

linux:
  target: [AppImage, deb]
  icon: assets/icon.png

publish:
  provider: github  # 自动更新源（GitHub Releases）
```

```bash
# 打包命令
npx electron-builder --mac          # macOS
npx electron-builder --win          # Windows
npx electron-builder --linux        # Linux

# 产物
release/
├── MyApp-1.0.0.dmg                 # macOS
├── MyApp-1.0.0-setup.exe           # Windows
└── MyApp-1.0.0.AppImage            # Linux
```

---

## 和 RN 多 Bundle 方案的类比

| 概念 | Electron | RN 多 Bundle |
|------|----------|-------------|
| 容器 | BrowserWindow | RNContainerActivity |
| 实例管理 | 窗口池（复用/懒创建） | ReactInstancePool（LRU） |
| 通信 | IPC（ipcMain/ipcRenderer） | JSI / TurboModule |
| 路由 | React Router（HashRouter） | NativeRouter + React Navigation |
| 构建 | electron-vite（三入口） | Metro 分 Bundle |
| 打包 | electron-builder | Gradle/Xcode |
| 热更新 | electron-updater（替换整个 App） | JS Bundle 热更新（不重装） |


---

## Electron 生态库速查

| 分类 | 库 | 用途 |
|------|-----|------|
| **脚手架** | electron-vite | 统一构建 main/preload/renderer（推荐） |
| | electron-forge | 官方工具链（创建+开发+打包） |
| **打包** | electron-builder | 打包为安装包（.dmg/.exe/.AppImage） |
| **自动更新** | electron-updater | 检查更新 + 下载 + 安装（配合 electron-builder） |
| **存储** | electron-store | 简单 key-value 持久化（JSON 文件） |
| | better-sqlite3 | SQLite（本地数据库，同步 API） |
| **日志** | electron-log | 主进程 + 渲染进程统一日志（写文件） |
| **开发调试** | electron-devtools-installer | 安装 React/Vue DevTools 到 Electron |
| | electron-reload | 开发时主进程代码变更自动重启 |
| **系统集成** | electron-dl | 文件下载管理 |
| | electron-clipboard-ex | 剪贴板增强（图片/富文本） |
| | node-notifier | 跨平台系统通知 |
| **安全** | electron-is-dev | 判断开发/生产环境 |
| | electron-context-menu | 右键菜单 |
| **测试** | Playwright | E2E 测试（官方支持 Electron） |
| | Spectron（已废弃）| → 迁移到 Playwright |
| **跨平台 UI** | electron-titlebar | 自定义标题栏（macOS/Windows 统一） |

### 开发环境搭建（快速启动）

```bash
# 方式 1：electron-vite（推荐）
npm create @electron-vite/app my-app -- --template react-ts
cd my-app && pnpm install
pnpm dev          # 启动开发（main + preload + renderer 同时 HMR）
pnpm build        # 构建
pnpm build:mac    # 打包 macOS

# 方式 2：electron-forge
npx create-electron-app my-app --template=vite-typescript
cd my-app && npm start

# 方式 3：手动搭建（完全控制）
mkdir my-app && cd my-app
pnpm init
pnpm add -D electron electron-builder
pnpm add -D vite @vitejs/plugin-react typescript
# 手动配置 main/preload/renderer 三入口
```

### 开发流程

```
pnpm dev 做了什么：
  1. Vite 启动 renderer 的 dev server（http://localhost:5173）
  2. tsup/esbuild 编译 main + preload
  3. 启动 Electron 主进程，加载 renderer dev server URL
  4. 文件变更：
     - renderer 变更 → Vite HMR（毫秒级）
     - main/preload 变更 → 重新编译 + 重启 Electron 进程
```
