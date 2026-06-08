# Electron 构建链路与配置文件

> 从源码到用户安装包，每一步用什么工具、读哪个配置文件、产出什么。

---

## 目录

- [构建全链路](#构建全链路)
- [配置文件清单](#配置文件清单)
- [各阶段详解 + 配置范例](#各阶段详解--配置范例)
  - [阶段 1：源码编译（electron-vite）](#阶段-1源码编译electron-vite)
  - [阶段 2：打包为安装包（electron-builder）](#阶段-2打包为安装包electron-builder)
  - [阶段 3：签名与公证（平台特定）](#阶段-3签名与公证平台特定)
  - [阶段 4：发布与自动更新](#阶段-4发布与自动更新)
- [辅助配置文件](#辅助配置文件)

---

## 构建全链路

```
源码（TS/React）
  │
  │ 阶段 1：electron-vite build
  │ 配置：electron.vite.config.ts
  │ 做什么：编译三个入口（main → Node JS, preload → Node JS, renderer → SPA HTML）
  ↓
dist/
├── main/index.js
├── preload/index.js
└── renderer/index.html + assets/
  │
  │ 阶段 2：electron-builder
  │ 配置：electron-builder.yml
  │ 做什么：把 dist/ + node_modules + Electron 二进制 打包成安装包
  ↓
release/
├── MyApp-1.0.0.dmg         (macOS)
├── MyApp-1.0.0-setup.exe   (Windows)
└── MyApp-1.0.0.AppImage    (Linux)
  │
  │ 阶段 3：签名 + 公证
  │ 配置：entitlements.mac.plist / electron-builder.yml 中的 mac.identity
  │ 做什么：macOS 签名 + Apple 公证 / Windows EV 签名
  ↓
已签名的安装包
  │
  │ 阶段 4：发布
  │ 配置：electron-builder.yml 的 publish 字段
  │ 做什么：上传到 GitHub Releases / S3 → electron-updater 自动检查更新
  ↓
用户下载安装 / 应用内自动更新
```

---

## 配置文件清单

| 配置文件 | 工具 | 作用 | 阶段 |
|---------|------|------|------|
| `electron.vite.config.ts` | electron-vite | 编译 main/preload/renderer 三入口 | 1 |
| `electron-builder.yml` | electron-builder | 打包、签名、发布配置 | 2/3/4 |
| `package.json` | npm/pnpm | 应用元信息 + scripts + 依赖声明 | 全部 |
| `tsconfig.json`（多份） | TypeScript | 各入口的编译选项 | 1 |
| `entitlements.mac.plist` | macOS 签名 | 声明 App 需要的系统权限（沙箱） | 3 |
| `pnpm-workspace.yaml` | pnpm | Monorepo 包声明 | 全部 |

---

## 各阶段详解 + 配置范例

### 阶段 1：源码编译（electron-vite）

**做什么**：把 TypeScript 源码编译为 JS，三个入口各自不同 target。

```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // ① main 入口：编译为 Node.js 可执行 JS
  main: {
    build: {
      outDir: 'dist/main',
      lib: {
        entry: path.resolve(__dirname, 'packages/main/src/index.ts'),
      },
      rollupOptions: {
        external: ['electron'],  // electron 不打进 bundle
      },
    },
  },

  // ② preload 入口：编译为 Node.js 可执行 JS（但跑在渲染进程的特殊上下文）
  preload: {
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: path.resolve(__dirname, 'packages/preload/src/index.ts'),
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
  },

  // ③ renderer 入口：编译为浏览器 SPA（和普通 Vite React 项目一样）
  renderer: {
    root: path.resolve(__dirname, 'packages/renderer'),
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, 'dist/renderer'),
    },
  },
});
```

```bash
# 执行
npx electron-vite build

# 产出
dist/
├── main/index.js            ← Node.js 代码（主进程入口）
├── preload/index.js         ← Node.js 代码（preload 脚本）
└── renderer/
    ├── index.html           ← SPA 入口 HTML
    └── assets/              ← JS/CSS/图片 bundle
```

---

### 阶段 2：打包为安装包（electron-builder）

**做什么**：把 dist/ 产物 + Electron 二进制 + node_modules 打包成各平台安装包。

```yaml
# electron-builder.yml
appId: com.mycompany.myapp
productName: MyApp
copyright: Copyright © 2026 MyCompany

# 源码目录（阶段 1 的产物）
directories:
  output: release           # 安装包输出目录
  buildResources: assets    # 图标等资源目录

# asar 归档（把源码打成一个文件，保护代码）
asar: true

# 主进程入口（相对于 app 根目录）
files:
  - dist/**/*
  - node_modules/**/*
  - package.json

# macOS 配置
mac:
  target: [dmg, zip]
  icon: assets/icon.icns
  category: public.app-category.developer-tools
  identity: "Developer ID Application: MyCompany (TEAM_ID)"
  notarize:
    teamId: "TEAM_ID"
  entitlements: entitlements.mac.plist
  entitlementsInherit: entitlements.mac.plist

# Windows 配置
win:
  target: [nsis]
  icon: assets/icon.ico

# NSIS 安装器选项
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true

# Linux 配置
linux:
  target: [AppImage, deb]
  icon: assets/icon.png
  category: Development

# 自动更新发布目标
publish:
  provider: github
  owner: mycompany
  repo: my-electron-app
```

```bash
# 执行
npx electron-builder --mac --win --linux

# 产出
release/
├── MyApp-1.0.0.dmg
├── MyApp-1.0.0-setup.exe
├── MyApp-1.0.0.AppImage
├── latest-mac.yml           ← macOS 更新元信息（electron-updater 用）
└── latest.yml               ← Windows 更新元信息
```

---

### 阶段 3：签名与公证（平台特定）

**macOS entitlements（权限声明）**：

```xml
<!-- entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <!-- 允许 JIT 编译（V8 需要） -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <!-- 允许加载未签名的动态库（node addon 需要） -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <!-- 网络访问 -->
  <key>com.apple.security.network.client</key>
  <true/>
  <!-- 文件读写 -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

**签名 + 公证流程**（electron-builder 自动处理）：

```
macOS：
  electron-builder 构建完 → 自动用 identity 签名 → 上传到 Apple 公证服务
  → Apple 验证通过 → staple 公证票据到 .dmg → 用户打开不会被 Gatekeeper 阻止

Windows：
  需要 EV 代码签名证书（.pfx 文件）
  electron-builder.yml 配置 certificateFile + certificatePassword
  → 构建时自动签名 .exe → 用户安装不会有 SmartScreen 警告
```

---

### 阶段 4：发布与自动更新

**发布**（electron-builder 内置）：

```bash
# 构建 + 上传到 GitHub Releases
npx electron-builder --publish always
# → 自动创建 Release + 上传安装包 + 上传 latest.yml
```

**应用内自动更新**（electron-updater）：

```typescript
// packages/main/src/updater.ts
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
  // 检查更新（读取 electron-builder.yml 中的 publish 配置）
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    // 通知渲染进程显示"有新版本"
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', () => {
    // 下载完成 → 重启安装
    autoUpdater.quitAndInstall();
  });
}
```

---

## 辅助配置文件

### package.json（根）

```json
{
  "name": "my-electron-app",
  "version": "1.0.0",
  "main": "dist/main/index.js",    // ← Electron 启动时加载的入口
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "electron-builder --dir",
    "release": "electron-builder --publish always"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "electron-updater": "^6.0.0"
  }
}
```

### tsconfig（main 入口示例）

```json
// packages/main/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "../../dist/main",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```
