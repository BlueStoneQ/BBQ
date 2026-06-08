# Electron DDD + Monorepo 架构设计

> 解决什么问题：大型 Electron 应用，多个团队负责不同业务域（视图），如何做到各自独立开发、互不阻塞、崩溃隔离。
>
> 本质：把 Web 微前端的 DDD 治理思路搬到 Electron——每个视图是一个独立业务边界，通过 Main 进程（后端）统一协调，模块间不直接通信。

---

## 目录

- [架构全景](#架构全景)
- [目录结构（Monorepo）](#目录结构monorepo)
- [通信原则](#通信原则)
- [视图集成方式](#视图集成方式)
- [和 Web 微前端的对比](#和-web-微前端的对比)

---

## 架构全景

```
┌─────────────────────────────────────────────────────────┐
│  BaseWindow（壳，平台团队负责）                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  WebContentsView: 导航栏（平台团队）              │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │  WebContentsView │  │  WebContentsView          │    │
│  │  侧边栏          │  │  主内容区                  │    │
│  │  （团队 A）       │  │  （团队 B）                │    │
│  │                  │  │                          │    │
│  │  独立 package    │  │  独立 package              │    │
│  │  独立构建         │  │  独立构建                  │    │
│  │  独立渲染进程     │  │  独立渲染进程              │    │
│  └──────────────────┘  └──────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  WebContentsView: 底部面板（团队 C）              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

Main 进程（平台团队）：
  - 创建 BaseWindow + 布局各 WebContentsView
  - 统一数据源 / 状态持有
  - IPC 路由（所有视图只和 Main 通信）
  - 统一更新 / 发布 / 权限控制
```

---

## 目录结构（Monorepo）

```
packages/
├── shell/                    ← 壳应用（平台团队负责）
│   ├── main/                 ← 主进程：窗口创建、IPC 路由、数据管理
│   ├── preload/              ← 统一 preload（或每个视图各自一个）
│   └── package.json
│
├── features/                 ← 业务域（各团队各自负责）
│   ├── editor/               ← 团队 A：编辑器视图（独立 React SPA）
│   │   ├── src/
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── terminal/             ← 团队 B：终端视图
│   ├── file-manager/         ← 团队 C：文件管理视图
│   └── settings/             ← 团队 D：设置页
│
├── shared/                   ← 共享（平台团队维护）
│   ├── types/                ← IPC 通道定义 + 共享类型
│   ├── ui/                   ← 共享组件库
│   └── utils/                ← 工具函数
│
├── pnpm-workspace.yaml
└── electron-builder.yml      ← 统一打包配置
```

**每个 feature 包**：
- 是一个独立的 React/Vue SPA（有自己的 vite.config + package.json）
- 构建产物是 `dist/index.html`
- Main 进程用 WebContentsView 加载各 feature 的构建产物
- 各团队独立开发、独立构建、统一由 shell 打包发布

---

## 通信原则

```
核心原则：模块之间不直接通信，所有通信经过 Main（后端）

  ✅ 星型拓扑：
    视图 A ↔ Main（IPC）
    视图 B ↔ Main（IPC）
    视图 C ↔ Main（IPC）
    Main 是唯一的数据源和状态协调者

  ❌ 网状拓扑（不允许）：
    视图 A ↔ 视图 B（直接通信 = 耦合）

为什么：
  1. 解耦：A 不知道 B 的存在 → 换掉 B 不影响 A
  2. 数据一致性：Main 是单一数据源，不会出现多个视图状态不一致
  3. 可治理：所有通信链路经过 Main → 可以加日志/权限/校验
  4. 类比：后端微服务不直接互调，通过 API 网关或消息队列
```

```typescript
// 各 feature 视图只和 Main 通信
// feature/editor 的 preload：
contextBridge.exposeInMainWorld('api', {
  getFileContent: (path) => ipcRenderer.invoke('file:read', path),
  saveFile: (path, content) => ipcRenderer.invoke('file:write', path, content),
  onFileChanged: (cb) => ipcRenderer.on('file:changed', (_, data) => cb(data)),
});

// Main 进程统一管理，按需广播给其他视图：
ipcMain.handle('file:write', async (event, path, content) => {
  await fs.writeFile(path, content);
  // 通知其他关心此文件的视图
  fileManagerView.webContents.send('file:changed', { path });
});
```

---

## 视图集成方式

| 方式 | 隔离度 | 独立构建 | 复杂度 | 适用 |
|------|--------|---------|--------|------|
| **WebContentsView**（推荐） | ✅ 进程隔离 | ✅ 各自构建 | 中 | 多团队 DDD、需要崩溃隔离 |
| Module Federation / 动态 import | ❌ 同进程 | ✅ 各自构建 | 中 | 不需要进程隔离，只要代码解耦 |
| npm 包依赖 | ❌ 同进程 | ❌ 统一构建 | 低 | 同团队 / 小项目 |

**推荐 WebContentsView**：
- 各 feature 独立进程 → 崩溃隔离
- 各 feature 独立构建 → 团队解耦
- Main 统一加载和布局 → 平台管控

---

## 和 Web 微前端的对比

| | Web 微前端（qiankun） | Electron DDD |
|---|---|---|
| 容器 | DOM div（`#subapp-container`） | WebContentsView |
| 隔离 | JS 沙箱（Proxy 模拟） | OS 进程隔离（真隔离） |
| 通信 | GlobalState / CustomEvent | IPC 经过 Main 中转 |
| 子应用 | 独立 SPA（独立域名部署） | 独立 package（统一打包） |
| 路由 | URL 匹配加载子应用 | Main 创建 WebContentsView 加载 |
| 部署 | 各自独立部署 | 统一打包为一个安装包 |

**本质相同**：都是"一个壳 + N 个独立业务模块 + 统一通信协调"。区别在于隔离手段和部署方式。
