# 桌面端doubao技术拆解

> 拆解doubao桌面端（AI 助手客户端）的技术实现方案。
> 结合 Electron 知识体系，从架构师视角分析"如果让我做，怎么做"。

---

## 目录

- [一、产品形态](#一产品形态)
- [二、技术栈判断](#二技术栈判断)
- [三、架构拆解](#三架构拆解)
- [四、核心模块实现方案](#四核心模块实现方案)
  - [对话流式渲染](#对话流式渲染)
  - [全局唤起（悬浮窗）](#全局唤起悬浮窗)
  - [截图 + OCR](#截图--ocr)
  - [文件分析](#文件分析)
  - [剪贴板监听](#剪贴板监听)
  - [常驻后台（Tray）](#常驻后台tray)
  - [多窗口管理](#多窗口管理)
  - [本地存储](#本地存储)
  - [自动更新](#自动更新)
  - [插件/技能系统](#插件技能系统)
- [五、桌面端独有价值（Web 版做不到的）](#五桌面端独有价值web-版做不到的)
- [六、与快应用 IDE 的共通点](#六与快应用-ide-的共通点)
- [Q&A](#qa)
  - [globalShortcut 怎么实现全局快捷键？](#globalshortcut-怎么实现全局快捷键)

---

## 一、产品形态

```
doubao桌面端 = 常驻桌面的 AI 助手
  - 主窗口：对话界面（类 ChatGPT）
  - 悬浮球/侧边栏：全局快捷键唤起，快速提问
  - 系统托盘：常驻后台，不占任务栏
  - 多模态输入：文本 / 图片 / 文件 / 截图 / 剪贴板内容
```

---

## 二、技术栈判断

```
大概率：Electron
依据：
  - 支持 Windows + macOS 双平台
  - 安装包 ~150MB 级别（Electron 特征）
  - 有 DevTools 痕迹（Chromium 内核）
  - 字节内部有成熟的 Electron 基建（飞书桌面端就是 Electron）

也可能：Tauri（但从功能复杂度和生态需求看，Electron 可能性更大）
```

---

## 三、架构拆解

```
┌─────────────────────────────────────────────────────────┐
│  Main 进程                                               │
│    - 窗口管理（主窗口 + 悬浮窗 + 设置窗口）               │
│    - 全局快捷键注册（globalShortcut）                      │
│    - 系统托盘（Tray）                                     │
│    - 截图服务（desktopCapturer / native 工具）            │
│    - 网络层（SSE 连接 LLM 后端 / WebSocket）              │
│    - 本地存储（SQLite / 文件系统）                         │
│    - 剪贴板监听                                          │
│    - 自动更新（autoUpdater）                              │
│    - 文件系统访问（拖拽文件读取/解析）                      │
├─────────────────────────────────────────────────────────┤
│  Renderer 进程（主窗口）                                  │
│    - 对话 UI（React/Vue）                                │
│    - Streaming Markdown 渲染                             │
│    - 代码块实时高亮                                       │
│    - 多模态输入组件（文本 / 图片预览 / 文件卡片）           │
│    - 插件/技能面板                                        │
├─────────────────────────────────────────────────────────┤
│  Renderer 进程（悬浮窗）                                  │
│    - 轻量输入框                                          │
│    - 快捷操作（翻译 / 总结 / 解释）                       │
│    - alwaysOnTop + 无边框 + 透明背景                      │
└─────────────────────────────────────────────────────────┘
```

---

## 四、核心模块实现方案

### 对话流式渲染

**问题**：LLM 响应是流式的（token by token），前端需要实时渲染 Markdown + 代码块。

**数据链路**：

后端 → SSE（Server-Sent Events）推流 → Main 进程接收 → IPC 转发给 Renderer

或者：Renderer 直接 fetch SSE（不经过 Main，减少一次 IPC 开销）。

**渲染难点**：

| 难点 | 说明 |
|------|------|
| 增量 Markdown 解析 | 不能每次收到 token 就全量 re-render，需要增量 patch |
| 代码块未闭合 | \`\`\` 还没出现结束标记时，要识别为"正在输入代码块" |
| LaTeX 公式 | 行内 `$...$` 和块级 `$$...$$` 实时渲染 |
| 思考过程 | 折叠/展开 UI（流式过程中动态切换） |
| 长对话性能 | 几百条消息时需要虚拟滚动 |

**技术选型**：

| 功能 | 方案 |
|------|------|
| Markdown 解析 | markdown-it / remark + 自定义插件 |
| 代码高亮 | shiki / Prism |
| 公式渲染 | KaTeX |
| 长列表性能 | 虚拟滚动（react-virtuoso / tanstack-virtual） |

### 全局唤起（悬浮窗）+全局快捷键

**问题**：用户在任何应用中按快捷键 → 弹出豆包输入框。

**实现**：

```typescript
// Main 进程
globalShortcut.register('Alt+Space', () => {
  if (floatWindow.isVisible()) {
    floatWindow.hide();
  } else {
    const { x, y } = screen.getCursorScreenPoint();
    floatWindow.setPosition(x - 200, y + 20);
    floatWindow.show();
    floatWindow.focus();
  }
});

// 悬浮窗配置
const floatWindow = new BrowserWindow({
  width: 400,
  height: 60,
  frame: false,          // 无边框
  transparent: true,     // 透明背景
  alwaysOnTop: true,     // 置顶
  skipTaskbar: true,     // 不显示在任务栏
  resizable: false,
  show: false,           // 初始隐藏
});
```

**难点**：

- 多显示器定位（用户可能在副屏操作）
- macOS 全屏应用中唤起
- 失去焦点自动隐藏：`floatWindow.on('blur', () => floatWindow.hide())`

### 截图 + OCR

**问题**：用户截屏 → 识别文字 → 作为上下文提问。

**方案对比**：

| 方案 | 实现 | 优缺点 |
|------|------|--------|
| desktopCapturer（Electron 内置） | 截取整个屏幕/窗口 | 不能区域选择 |
| native 截图工具 + child_process | macOS: `screencapture -i`，Windows: 系统截图 | 依赖平台工具 |
| 自研截图 UI（飞书方案） | 全屏透明窗口 + canvas 框选裁剪 | 最灵活，工作量大 |

**截图流程**（方案 2/3）：

用户点"截图" → Main 进程启动截图工具/透明窗口 → 用户框选区域 → 图片保存到临时目录 → 读取图片 → 发送给后端 OCR 或直接作为多模态输入发给 LLM。

### 文件分析

**问题**：用户拖拽文件到对话框 → AI 分析文件内容。

**实现链路**：

Renderer 监听 drop 事件 → 拿到文件路径 → IPC 发给 Main → Main 用 `fs` 读取文件内容 → 根据文件类型处理 → 上传给 LLM API。

**文件类型处理**：

| 类型 | 处理方式 |
|------|---------|
| 文本类（.txt/.md/.json/.code） | 直接读 UTF-8 |
| PDF | pdf-parse 提取文本 |
| 图片 | 直接作为多模态输入 |
| Office | libreoffice CLI 转文本 或 后端处理 |

### 剪贴板监听

**问题**：用户复制一段文字 → 豆包自动感知，提供"解释/翻译/总结"快捷操作。

**实现**：Electron 没有剪贴板变化事件，用轮询方案。

```typescript
// Main 进程轮询
let lastContent = '';
setInterval(() => {
  const current = clipboard.readText();
  if (current !== lastContent && current.length > 0) {
    lastContent = current;
    mainWindow.webContents.send('clipboard-changed', current);
  }
}, 1000);  // 1s 轮询，平衡性能和响应速度
```

**注意**：不能太频繁（CPU 开销），也不能太慢（体验差）。1s 是常见 trade-off。

### 常驻后台（Tray）

**什么是常驻后台**：用户关闭窗口后，应用不真正退出，而是隐藏到系统托盘（macOS 菜单栏 / Windows 任务栏右下角）。随时可以通过托盘图标或快捷键重新唤起。

**实现要点**：
1. 创建 `Tray`（Electron 的系统托盘 API，`import { Tray } from 'electron'`）→ 在系统托盘区域显示一个图标
2. 拦截窗口关闭事件 → 不退出，只隐藏窗口
3. 托盘图标右键菜单 → 提供"打开/退出"等操作

```typescript
import { app, Tray, Menu, BrowserWindow } from 'electron';

// 1. 创建系统托盘图标
const tray = new Tray('assets/tray-icon.png');  // 托盘小图标（16x16 或 22x22）

// 2. 设置右键菜单
tray.setContextMenu(Menu.buildFromTemplate([
  { label: '打开豆包', click: () => mainWindow.show() },
  { label: '截图提问', click: () => startScreenshot() },
  { label: '退出', click: () => app.quit() },
]));

// 3. 关闭窗口时不退出，只隐藏（核心）
mainWindow.on('close', (e) => {
  if (!forceQuit) {
    e.preventDefault();   // 阻止默认的关闭（= 销毁窗口）
    mainWindow.hide();    // 只是隐藏，进程还在
  }
});

// 4. 真正退出时放行
let forceQuit = false;
app.on('before-quit', () => { forceQuit = true; });
```

**效果**：用户点关闭按钮 → 窗口消失但应用还活着（托盘图标还在）→ 点托盘或按快捷键 → 窗口重新出现。和微信/QQ 桌面端同一个模式。

### 多窗口管理

**窗口类型**：

| 窗口 | 配置 | 用途 |
|------|------|------|
| 主窗口 | BrowserWindow，正常尺寸 | 对话界面 |
| 悬浮窗 | 小尺寸 + 无边框 + 置顶 | 快捷输入 |
| 设置窗口 | 模态窗口 | 配置页面 |
| 截图窗口 | 全屏透明 | 自研截图 UI（如果有）|

**窗口间通信**：

通过 Main 进程中转（`ipcMain` 接收 → `webContents.send` 转发），或 Main 进程持有共享状态，各窗口按需读取。

### 本地存储

| 数据类型 | 方案 | 说明 |
|---------|------|------|
| 对话历史 | SQLite（better-sqlite3） | 结构化查询、全文检索、大数据量性能好 |
| 用户配置 | electron-store（JSON 文件） | 快捷键、主题、语言、模型选择等 |
| 缓存 | 文件系统 | 图片缓存、下载文件等 |

表结构示例：`conversations(id, title, created_at)` + `messages(id, conv_id, role, content, timestamp)`

### 自动更新

electron-updater + 内部 CDN。启动时静默检查 → 后台下载 → 提示用户重启。和 IDE 的 autoUpdater 方案完全一样。

### 插件/技能系统

豆包有"技能"（翻译、写作、编程等），可能的实现方式：

- **后端配置驱动**：技能 = 一组 prompt template + 参数 schema，前端动态渲染技能面板
- 不需要本地执行代码（和 IDE 插件不同）
- 如果有第三方插件：WebView 隔离（iframe sandbox）执行，和 VS Code Extension 的安全模型类似

---

## 五、桌面端独有价值（Web 版做不到的）

| 能力 | 桌面端 | Web 版 | 依赖的 Electron API |
|------|:---:|:---:|------|
| 全局快捷键唤起 | ✅ | ❌ | `globalShortcut` |
| 屏幕截图 | ✅ | ❌ | `desktopCapturer` / `child_process` |
| 文件系统直接访问 | ✅ | 有限 | `fs` + `dialog` |
| 剪贴板监听 | ✅ | ❌ | `clipboard` |
| 系统通知 | ✅ | 有限 | `Notification` |
| 常驻后台 | ✅ | ❌ | `Tray` |
| 无边框悬浮窗 | ✅ | ❌ | `BrowserWindow` options |
| 开机自启 | ✅ | ❌ | `app.setLoginItemSettings` |

---

## 六、与快应用 IDE 的共通点

| | 豆包桌面端 | 快应用 IDE |
|---|---|---|
| 底座 | Electron | Electron (VS Code) |
| 多窗口 | 主窗口+悬浮窗 | 主窗口+调试窗口 |
| 后端长连接 | SSE (LLM API) | WebSocket (CDP) |
| 系统能力 | 截图/剪贴板/快捷键 | ADB/文件系统/终端 |
| 流式数据处理 | LLM token stream | 编译日志/调试事件流 |
| 自动更新 | ✅ | ✅ |
| 常驻后台 | ✅ Tray | ❌ |
| 本地存储 | SQLite | VS Code 内置存储 |

**面试类比**："我做过的 IDE 和豆包桌面端架构同构——都是 Electron 多窗口应用，都需要处理系统级能力调用、长连接数据流、本地持久化。区别只是业务场景不同（AI 对话 vs 开发工具链）。"


---

## Q&A

### globalShortcut 怎么实现全局快捷键？

**Q：globalShortcut 这个功能怎么实现的？**

A：Electron Main 进程 API，注册**系统级**全局快捷键——即使应用不在前台也能触发。

**底层原理**（分平台，Electron 封装了差异）：

| 平台 | 系统 API |
|------|---------|
| macOS | Carbon API → `RegisterEventHotKey` |
| Windows | Win32 API → `RegisterHotKey` |
| Linux | X11 → `XGrabKey` |

**和普通键盘事件的区别**：
- 普通 `keydown` → 只有窗口 focus 时才能监听（浏览器行为）
- `globalShortcut` → 系统级，任何时候都能触发（即使应用在后台/最小化/被其他应用覆盖）

```typescript
import { globalShortcut, app } from 'electron';

app.whenReady().then(() => {
  // 注册：返回 boolean 表示是否成功（可能和系统/其他应用冲突）
  const success = globalShortcut.register('Alt+Space', () => {
    // 任何时候按 Alt+Space 都会触发这里
    toggleFloatWindow();
  });

  if (!success) {
    console.warn('快捷键注册失败，可能被其他应用占用');
  }
});

// 必须：应用退出时注销（否则快捷键残留，被占用直到系统重启）
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

**注意事项**：

- 只能在 Main 进程使用（Renderer 不行）
- 快捷键冲突时 `register` 返回 `false`
- 应用退出必须 `unregisterAll`
- macOS 需要"辅助功能"权限才能注册部分快捷键
- 用户自定义快捷键 → 存配置 + 动态 unregister/register
