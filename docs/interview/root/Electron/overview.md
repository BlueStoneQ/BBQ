# Electron 总览

> 解决什么问题：用 Web 技术（HTML/CSS/JS）开发桌面应用（Windows/macOS/Linux），一套代码三端跑。
>
> 本质：Electron = Chromium（渲染 UI）+ Node.js（访问系统 API）+ 原生窗口壳。把浏览器和 Node 打包成一个桌面应用。

## 目录

- [第一性原理](#第一性原理)
- [一句话速查](#一句话速查)
- [你的经验](#你的经验)
- [能力分阶模型](#能力分阶模型)

---

## 第一性原理

**问题**：Web 技术只能在浏览器沙箱里跑，不能访问文件系统、进程、硬件。

**解决**：把浏览器（Chromium）和系统运行时（Node.js）打包在一起，变成一个桌面应用。

```
浏览器 Web App：  Chromium 渲染 UI → 沙箱隔离 → 不能访问系统
Electron App：   Chromium 渲染 UI + Node.js 访问系统 → 打包成桌面应用
```

---

## 一句话速查

| 概念 | 本质 |
|------|------|
| 主进程 | 一个 Node.js 进程，管窗口和系统 API |
| 渲染进程 | 一个 BrowserWindow = 一个独立的 Chromium 渲染进程（OS 级进程隔离） |
| preload | 安全桥接层，白名单暴露 Node 能力给渲染进程 |
| IPC | 进程间通信（和 RN 的 Bridge / Android 的 Binder 同一类问题） |
| BrowserWindow | 一个窗口实例（= Android Activity） |
| electron-builder | 打包工具，产出 .dmg/.exe/.AppImage |

> **注意区分 Window vs Tab**：BrowserWindow（窗口）级别才是独立进程。应用内部的 Tab（如 VS Code 的编辑器标签页）不是独立进程——同一窗口内所有 Tab 共享同一个渲染进程，Tab 切换只是同一进程内的 UI/数据切换。和 Chrome 浏览器不同（Chrome 每个 Tab 一个进程）。

---

## 你的经验

快应用 IDE = 基于 VS Code（Electron）二次开发：
- 主进程：构建编译（child_process）、设备通信（adb/CDP）、依赖分析引擎
- 渲染进程：Monaco Editor、UI 面板
- 插件系统：Extension Host（独立 Node.js 进程）


---

## 能力分阶模型

```
初阶（能用）：
  ✓ 创建窗口 + 加载 React 页面
  ✓ 基本 IPC（invoke/handle）
  ✓ preload 暴露 API
  ✓ electron-builder 打包
  ✓ 调用几个系统 API（dialog/clipboard/notification）

中阶（能做好）：
  ✓ 安全模型（contextIsolation + sandbox + preload 白名单设计）
  ✓ 自动更新流程
  ✓ 多窗口管理 + 窗口间通信
  ✓ 主进程服务化（IPC 模块化、错误处理）
  ✓ 构建优化（包体瘦身、启动速度、node_modules 裁剪）
  ✓ 跨平台差异处理（签名/公证/路径/权限）

高阶（能设计架构）：
  ✓ 多进程架构设计（VS Code 模式：Extension Host / Language Server / 子进程隔离）
  ✓ 插件系统设计（怎么让第三方代码安全运行）
  ✓ DDD + Monorepo（多团队多视图解耦）
  ✓ 性能诊断（heapdump / CPU profile / getAppMetrics）
  ✓ Native addon / Node C++ 绑定
  ✓ 自定义协议 / 深度链接 / 进程守护 / 崩溃恢复
  ✓ 底层原理（Mojo IPC / Chromium 多进程模型 / V8 堆管理）
```

**最关心的方面（按优先级）**：

| 优先级 | 关注点 | 为什么重要 |
|--------|--------|-----------|
| 1 | 安全 | 渲染进程可能加载外部内容，权限泄漏 = 用户文件被读 |
| 2 | 稳定性 | 桌面应用不能崩，Main 挂了全完 |
| 3 | 架构解耦 | 大应用多人协作，不解耦就变巨石 |
| 4 | 跨平台一致性 | 三端打包/签名/权限/路径全不一样 |
| 5 | 启动速度 | 用户双击后 2s 还白屏就觉得卡 |
| 6 | 包体/内存 | 可接受范围内控制，不是核心瓶颈 |
