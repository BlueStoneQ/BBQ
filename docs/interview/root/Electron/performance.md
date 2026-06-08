# Electron 性能优化

> Electron 的三大性能痛点：包体大（100MB+）、内存高（每窗口 50MB+）、启动慢（冷启动 2-3s）。逐个击破。

---

## 目录

- [包体优化](#包体优化)
- [启动速度优化](#启动速度优化)
- [内存优化](#内存优化)
- [渲染性能](#渲染性能)
- [性能检测工具](#性能检测工具)
- [替代方案（Tauri）](#替代方案tauri)

---

## 包体优化

```
Electron 包体为什么大：
  Chromium 二进制 ≈ 80-100MB（不可压缩，每个应用自带一份）
  Node.js 运行时 ≈ 10-15MB
  你的代码 + node_modules ≈ 几 MB ~ 几十 MB
  = 总计 100-150MB

Chromium 这部分你改不了——这是 Electron 的"底价"。能优化的是你自己的部分。
```

**优化手段**：

| 手段 | 效果 | 做法 |
|------|------|------|
| **asar 打包** | 加速文件读取 + 轻微减体积 | electron-builder 默认开启 |
| **排除无用 node_modules** | 减几 MB ~ 几十 MB | `files` 配置精确控制打进包的文件 |
| **Tree Shaking** | 减 JS bundle 体积 | renderer 用 Vite 构建自动做 |
| **本地化按需加载** | 减少语言包 | 只打包用到的 locale |
| **native addon 平台裁剪** | 只保留当前平台的 .node 文件 | electron-builder 自动处理 |
| **增量更新** | 用户不下载完整包 | electron-updater 差分更新（只下载变更部分） |

```yaml
# electron-builder.yml 精确控制打包范围
files:
  - dist/**/*
  - "!node_modules/**/*.md"      # 排除文档
  - "!node_modules/**/*.ts"      # 排除 TS 源码
  - "!node_modules/**/test/**"   # 排除测试
  - "!node_modules/**/docs/**"   # 排除文档
```

```
不可优化的部分（Electron 的"底价"）：
  Chromium ≈ 80MB（除非换 Tauri 用系统 WebView）
  
可优化到的极限：
  你的代码 + node_modules 控制在 10-20MB
  总包体 ≈ 100-120MB（已经是 Electron 应用的正常水平）
```

---

## 启动速度优化

```
Electron 启动链路：
  双击图标
  → 加载 Electron 二进制（OS 级，不可优化）
  → 初始化 Chromium + Node.js（不可优化）
  → 执行 main/index.js（你的代码）
  → 创建 BrowserWindow
  → 加载 renderer HTML
  → 解析 + 执行 JS
  → 首屏渲染
  → 窗口可见

可优化的部分：main/index.js 执行 → 窗口可见
```

| 手段 | 原理 | 做法 |
|------|------|------|
| **延迟加载非核心模块** | main 启动时只加载必须的代码 | 非关键 require 放到用到时再 import |
| **先显示窗口再加载内容** | 用户感知快 | `show: false` → 加载 → `ready-to-show` → show |
| **splash screen** | 启动时先展示轻量启动页 | 先创建小窗口显示 logo，内容加载完切换 |
| **减少 main 启动时同步操作** | 不阻塞事件循环 | 把 fs.readFileSync / JSON.parse 大文件改异步 |
| **preload 精简** | preload 执行时间影响页面首帧 | preload 只做 contextBridge，不做业务逻辑 |
| **renderer 首屏优化** | 和 Web 首屏优化一样 | Code Splitting / 懒加载路由 / 骨架屏 |

```typescript
// 避免白闪：先隐藏，ready-to-show 后再显示
const win = new BrowserWindow({ show: false, ... });
win.once('ready-to-show', () => win.show());

// 延迟加载：main 启动时不 require 所有模块
// 不要：
import { heavyModule } from './heavy';  // 启动就加载

// 要：
let heavyModule: typeof import('./heavy') | null = null;
async function getHeavy() {
  if (!heavyModule) heavyModule = await import('./heavy');
  return heavyModule;
}
```

---

## 内存优化

```
Electron 内存为什么高：
  每个 BrowserWindow = 一个 Chromium 渲染进程 ≈ 30-80MB
  Main 进程 ≈ 50-100MB（Chromium Browser + Node.js）
  开 3 个窗口 ≈ 200-400MB

= 多进程架构的代价（和 Chrome 浏览器一样）
```

| 手段 | 原理 | 做法 |
|------|------|------|
| **控制窗口数量** | 少一个窗口 = 少一个进程 | 能用 Tab 切换的不开新窗口 |
| **不用的窗口 destroy** | hide 仍占内存，destroy 释放 | 设置窗口关闭后 `win = null` |
| **WebContentsView 复用** | 减少进程创建/销毁 | 复用 View 实例切换内容 |
| **renderer 内存治理** | 和 Web 一样 | 虚拟列表 / 懒加载 / 释放不用的大对象 |
| **Node.js 侧内存治理** | 防 Main 进程内存泄漏 | 缓存加 TTL / 定期 GC / heapdump 分析 |
| **限制 V8 堆大小** | 防止无限增长 | `--max-old-space-size=512` 启动参数 |

```typescript
// 窗口关闭后释放引用
win.on('closed', () => { win = null; });

// Node 缓存加上限
import LRU from 'lru-cache';
const cache = new LRU({ max: 100, ttl: 1000 * 60 * 5 });  // 最多 100 条，5min 过期

// 检测内存使用
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) {  // 超 500MB
    logger.warn('Memory high', usage);
    global.gc?.();  // 手动触发 GC（需要 --expose-gc 启动参数）
  }
}, 30000);
```

---

## 渲染性能

```
渲染进程 = Chromium 页面，性能优化和 Web 完全一样：
  - React memo / useMemo / 虚拟列表
  - 减少 DOM 节点数
  - CSS 动画代替 JS 动画
  - requestAnimationFrame 批量更新
  - Web Worker 做 CPU 密集计算

Electron 特有的渲染注意点：
  - IPC 不要高频调用（每次跨进程有 ~0.1ms 开销）
  - 大数据传输走 SharedArrayBuffer / MessagePort，不走普通 IPC
  - 主进程 CPU 密集操作会影响所有窗口（事件循环阻塞）→ 用 Worker Thread
```

---

## 性能检测工具

| 工具 | 检测什么 | 怎么用 |
|------|---------|--------|
| **Chrome DevTools** | 渲染进程性能（和 Web 一样） | `win.webContents.openDevTools()` |
| **--inspect 调试 Main** | 主进程性能（CPU/内存） | `electron --inspect=5858 .` → Chrome devtools://inspect |
| **process.memoryUsage()** | 主进程内存 | 定时记录 heapUsed |
| **app.getAppMetrics()** | 所有进程的 CPU/内存 | 返回每个进程的详细指标 |
| **heapdump** | 内存泄漏分析 | `v8.writeHeapSnapshot()` → Chrome DevTools Memory |
| **electron-log** | 记录性能数据 | 启动时间/IPC 耗时/模块加载时间 |

```typescript
// 检测所有进程的资源占用
const metrics = app.getAppMetrics();
metrics.forEach(m => {
  console.log(`PID ${m.pid} (${m.type}): CPU ${m.cpu.percentCPUUsage}%, Mem ${m.memory.workingSetSize}KB`);
});
// type: 'Browser'(Main) / 'Tab'(Renderer) / 'GPU' / ...
```

---

## 替代方案（Tauri）

```
如果包体 100MB+ 不可接受，考虑 Tauri：

  Electron：自带 Chromium + Node.js → 包体 100MB+
  Tauri：用系统 WebView + Rust 后端 → 包体 5-10MB
```

**收益**：

| 维度 | Electron | Tauri |
|------|----------|-------|
| 包体 | 100-150MB | 5-10MB |
| 内存占用 | 200-400MB（多窗口） | 50-100MB（共用系统 WebView） |
| 启动速度 | 慢（加载 Chromium） | 快（系统 WebView 已预热） |
| 安全性 | 需要自己做 preload 白名单 | Rust 后端天然安全（内存安全语言） |
| 后端性能 | Node.js（单线程 I/O） | Rust（多线程高性能） |

**代价**：

| 维度 | Electron | Tauri |
|------|----------|-------|
| 跨平台一致性 | ✅ 自带 Chromium，所有平台行为一致 | ❌ 各平台 WebView 不同（Windows WebView2 / macOS WKWebView / Linux WebKitGTK） |
| Node.js 生态 | ✅ 直接用 npm 所有包 | ❌ 后端是 Rust，不能用 Node 包 |
| 开发门槛 | 低（前端就能写） | 高（需要 Rust 基础写后端） |
| 社区成熟度 | ✅ 10 年历史，VS Code/Slack/Notion 验证 | ⚠️ 2022 年 1.0，生态在快速发展但仍小 |
| 调试体验 | ✅ Chrome DevTools 完整 | ⚠️ 各平台 WebView 调试工具不同 |
| Native addon | ✅ node-gyp / napi | ✅ Rust FFI（更安全） |

**生态差异（关键）**：

```
Electron 能直接 require 的：
  better-sqlite3 / sharp / ffmpeg / puppeteer / node-hid / serialport
  → 所有 Node.js C++ addon 都能用

Tauri 不能用这些：
  后端是 Rust → 要用 Rust 的对应库（rusqlite / image / serde）
  或者自己写 Rust 绑定调 C 库
  → 如果你的应用重度依赖 Node 生态库（如 IDE、文件处理、设备通信），Tauri 不合适
```

**Tauri 看起来优势巨大？为什么大家还用 Electron？**

```
核心原因：WebView 不统一带来的"隐形成本"

  问题 1：CSS/JS 渲染差异
    Windows WebView2（Chromium）和 macOS WKWebView（WebKit）是不同引擎
    → 某些 CSS 边界行为不一致（flex/grid 细节差异）
    → 某些新 JS API macOS 晚半年才支持
    → 需要多平台测试 + polyfill = 额外开发成本

  问题 2：Linux WebKitGTK 版本碎片化
    Linux 没有统一 WebView 版本（取决于发行版）
    → Ubuntu 22.04 的 WebKitGTK 可能是 2 年前的版本
    → 新 CSS/JS 特性用不了 = 功能受限

  问题 3：调试体验割裂
    Windows：完整 Chrome DevTools ✓
    macOS：Safari Web Inspector（功能弱）
    Linux：基本没有好的调试工具
    → 排查跨平台问题效率低

  实际影响有多大？
    简单应用（文本/表单/列表）：几乎无影响
    复杂 UI（Canvas/WebGL/复杂动画/Monaco Editor）：可能在某平台出 bug
    = 应用越复杂，WebView 不统一的风险越大

所以 Tauri 的"优势巨大"要打折扣：
  包体小 ✓（确定收益）
  内存低 ✓（确定收益）
  启动快 ✓（确定收益）
  但：多平台兼容性测试成本 ↑ + Rust 学习成本 ↑ + Node 生态丢失 ↑
  = 净收益取决于你的应用复杂度和团队能力
```

**选型建议**：

```
选 Electron：
  - 复杂应用（IDE / 协作工具 / 数据处理）
  - 团队以前端为主（会 Node，不会 Rust）
  - 需要跨平台一致性（同一份代码三端表现一样）
  - 需要大量 Node 生态包
  - 包体 100MB 可接受（2026 年大部分用户不在乎）

选 Tauri：
  - 轻量工具（笔记 / 剪贴板管理 / 系统工具 / 启动器）
  - 团队有 Rust 能力
  - 对包体极度敏感（需要 < 20MB）
  - 不依赖 Node 生态
  - 追求极致性能（Rust 后端比 Node 快 10x+）

2026 年现状：
  大多数新项目仍然选 Electron（生态 + 团队能力 + 成熟度）
  Tauri 在轻量工具类应用中增长快
  两者不是替代关系，是不同场景的选择
```
