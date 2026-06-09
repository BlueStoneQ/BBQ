# Electron Q&A (2)

> 问题驱动，忠实记录学习过程中的追问和完整回答。
>
> ⚡ 面试前速查 → [quick-lookup.md](./quick-lookup.md)

---

## 目录

### 1. IDE + Doubao

- [1.1 IDE 本体做了哪四点核心改动？](#11-ide-本体做了哪四点核心改动)

### 2. VS Code

### 3. Electron

- [3.1 UtilityProcess（工具进程）是什么？](#31-utilityprocess工具进程是什么)
- [3.2 耗时任务用线程还是进程？Trade-off](#32-耗时任务用线程还是进程trade-off)

### 4. RN

- [4.1 RN 键盘遮挡问题](#41-rn-键盘遮挡问题)

### 5. React

### 6. Agent

- [6.1 文件上传方案（跨端对比）](#61-文件上传方案跨端对比)

### 7. 待分类-others

---

## 1. IDE + Doubao

### 1.1 IDE 本体做了哪四点核心改动？

**Q：快应用 IDE 基于 VS Code 二开，IDE 本体（源码层）核心改了什么？**

A：只改了 4 点（< 10 个文件），其余全部通过 Extension 实现。

→ 详见 [IDE 项目总览 · 二、IDE 本体核心改动（4 点）](./ide/overview.md#二ide-本体核心改动4-点)

| # | 改动 | 实现 |
|---|------|------|
| 1 | 元信息定制（名称/图标/数据目录/协议名） | product.json |
| 2 | 首次启动自动安装内置插件列表 | [详见](./ide/builtin-extension-install.md) |
| 3 | 暴露 VS Code 不支持的 API（Header WebView） | [详见](./ide/custom-api-header-webview.md) |
| 4 | 注册 IDE 自己的命令行（`quickapp-ide` 替代 `code`） | CLI 入口改名 + `setAsDefaultProtocolClient` |

---

## 2. VS Code
- 进程隔离(崩溃隔离) + 增加插件host进程

（待补充）

---

## 3. Electron

### 3.1 UtilityProcess（工具进程）是什么？

**Q：Electron 官方文档里的 Utility Process Modules 是什么？**

A：`UtilityProcess` = Electron 官方提供的**轻量子进程**方案（Electron 22+ 引入），用来替代 `child_process.fork()` 跑 CPU 密集任务。

**解决的问题**：之前要在 Main 进程外跑耗时任务，只能用 `child_process.fork()`。但它创建的是完整 Node.js 进程，开销大，且和 Electron 的 IPC 体系不互通。

**对比**：

| | child_process.fork() | UtilityProcess |
|---|---|---|
| 本质 | 完整的 Node.js 子进程 | Chromium Utility Process（轻量） |
| 通信 | Node IPC（`process.send`） | MessagePort（和 Renderer 通信方式一致） |
| 开销 | 大（完整 Node 运行时） | 小（共享 Chromium 基础设施） |
| 能用 Node API | ✅ | ✅ |
| 崩溃隔离 | ✅ | ✅ |
| 适合 | 跑独立脚本/CLI 工具 | CPU 密集计算、后台服务、Native addon |

**用法**：

```typescript
import { utilityProcess } from 'electron';

// Main 进程中创建工具进程
const child = utilityProcess.fork('heavy-task.js');

// 通信（MessagePort 风格，和 Web Worker 类似）
child.postMessage({ type: 'start', data: largeBuffer });
child.on('message', (msg) => { /* 收到结果 */ });

// 崩溃恢复
child.on('exit', (code) => { /* 检测退出码，可以重启 */ });
```

**VS Code 中的对应**：Extension Host / Language Server 本质上就是这种"隔离子进程"模式。UtilityProcess 是 Electron 对这种模式的官方标准化封装。

**一句话**：`UtilityProcess` = Electron 版的 Web Worker，独立进程 + MessagePort 通信 + 崩溃隔离。


---

### 3.2 耗时任务用线程还是进程？Trade-off

**Q：耗时任务用线程（Worker Threads）不行吗？为什么用进程这么重？**

A：线程可以用，但进程多了一个核心优势：**崩溃隔离**。

| | Worker Threads（线程） | UtilityProcess / child_process（进程） |
|---|---|---|
| 崩溃影响 | 线程崩 = 整个进程崩（所有线程都死） | 子进程崩 = 只死它自己，Main 不受影响 |
| 内存隔离 | 共享内存（SharedArrayBuffer） | 完全隔离 |
| 开销 | 轻（~几 MB） | 重（~30-50 MB） |
| 通信 | postMessage（快，可 transfer） | IPC / MessagePort（有序列化开销） |
| 适合 | 纯计算 + 自己写的可控代码 | 不信任的代码 / 可能崩的场景 |

**决策标准**：

- 纯计算 + 代码可控 → **Worker Threads**（轻，够用）。例：Markdown 渲染、数据处理
- 可能崩 / 第三方代码 / 长时间运行 → **进程**（安全）。例：Agent 任务执行、插件系统、Language Server

**为什么桌面应用偏向用进程**：

桌面应用"不能崩"是硬约束。线程崩 = 整个 Main 进程崩 = 应用闪退 = 用户数据丢失。进程崩 = 弹个提示"任务失败" + 自动重启子进程 = 用户无感知。

VS Code 的 Extension Host / Language Server 都是独立进程而不是线程，就是这个原因。

**一句话**：线程轻但不隔离崩溃，进程重但崩了不连坐。


---

## 4. RN

### 4.1 RN 键盘遮挡问题

**Q：RN 的 TextInput 弹出键盘时为什么会遮挡内容？必须手动处理吗？RN 没有自动处理？**

A：RN 不自动处理，必须手动用 `KeyboardAvoidingView`。

**为什么有这个问题**：
- iOS 原生 `UIScrollView` 会自动调整，但 RN 的 View 不是标准 UIScrollView
- Android 可以设 `windowSoftInputMode: adjustResize`，但 RN 布局不一定正确响应
- 结果：键盘弹起后遮住 TextInput 或底部按钮

**为什么 RN 不自动处理**：因为"什么内容该被顶上去"是业务决定的（可能只想顶输入框，不想整个页面动），RN 不敢自作主张。

**解决方案**：

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  {/* 页面内容 */}
  <TextInput placeholder="输入消息..." />
</KeyboardAvoidingView>
```

`behavior` 分平台：iOS 用 `'padding'`（底部加 padding），Android 用 `'height'`（缩小容器高度）。

**KeyboardAvoidingView 原理**：

监听键盘弹出事件 → 获取键盘高度 → 动态调整自身布局。本质 = "监听事件 + 改 style"的容器组件。

1. 监听系统键盘事件（iOS: `keyboardWillShow` / Android: `keyboardDidShow`）
2. 从事件中拿到键盘高度（如 300px）
3. 根据 `behavior` 属性调整自身容器：
   - `'padding'`：容器底部加 `paddingBottom = 键盘高度`（内容被顶上去）
   - `'height'`：容器高度缩小 = 原高度 - 键盘高度（容器变矮）
   - `'position'`：容器整体往上平移 `translateY = -键盘高度`
4. 键盘收起时恢复原状

**为什么分平台用不同 behavior**：
- iOS 用 `'padding'`：iOS 键盘弹出时窗口不会自动缩小，加 padding 最自然
- Android 用 `'height'`：Android 的 `adjustResize` 已经会缩小窗口，用 height 配合效果更好

---

## 5. React

（待补充）

---

## 6. Agent

### 6.1 文件上传方案（跨端对比）

**Q：文件上传一般怎么做？后端用什么接口/方法？前端怎么传？浏览器/Electron/RN 分别怎么做？**

A：

**后端**：`POST /upload`，`Content-Type: multipart/form-data`。Node 用 `multer` 中间件接收。

**各端实现对比**：

| 端 | 选择文件 | 构造请求体 | 发送 |
|---|---|---|---|
| 浏览器 | `<input type="file">` → `File` 对象 | `new FormData()` + `append('file', file)` | `fetch(url, { method: 'POST', body: formData })` |
| Electron | `dialog.showOpenDialog()` → 文件路径 | Main 进程 `fs.createReadStream` + `form-data` 库 | Main 进程 `fetch` / `axios`（不受 CORS） |
| RN | `react-native-document-picker` → `uri` | `new FormData()` + `append('file', { uri, type, name })` | `fetch(url, { method: 'POST', body: formData })` |

**关键区别**：

```
浏览器：
  File 对象 = 浏览器沙箱里的引用，不能拿到真实路径
  FormData + fetch 就行，浏览器自动设 Content-Type boundary

Electron：
  两种方式：
    ① Renderer 直接 <input type="file">（和浏览器一样）
    ② Main 进程 dialog.showOpenDialog() → 拿到完整路径 → fs.readFile → 构造请求
  走 Main 的好处：不受 CORS + 可以读文件内容做本地处理再上传

RN：
  不能用 <input type="file">（没有 DOM）
  用 document-picker / image-picker 获取文件 uri
  FormData 里传 { uri, type, name } 对象（RN 的 fetch 会自动读 uri 对应的文件）
```

**大文件优化**：分片上传（S3 MPU / 自研分片接口）—— 你的负载分析平台项目里 4.4G 文件就是这个方案。
