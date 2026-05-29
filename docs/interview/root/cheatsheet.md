# 速查手册（Quick Reference）

> 面试前 5 分钟快速扫一遍，巩固印象。

---

## RN 启动优化

| 手段 | 优化环节 |
|------|---------|
| Hermes 预编译（.hbc） | JS 解析 -50~70% |
| 分 Bundle（Common + Business） | 首屏只加载必要代码 |
| 容器池预热（Application.onCreate） | 引擎初始化提前 |
| Native 预请求（OkHttp 并行） | 网络不等 JS |
| DEX 布局优化（Baseline Profile） | 启动内存峰值降低 |
| Splash 三线程并行 | 引擎 + 预请求 + Bundle 下载同时跑 |
| 骨架屏 | 感知优化 |

## RN 流畅度优化

| 手段 | 解决什么 |
|------|---------|
| FlashList | 列表复用 Cell |
| memo + useCallback + selector | 减少重渲染 |
| Reanimated 3 | 动画跑 UI 线程 |
| InteractionManager | 动画期间延迟重任务 |
| useTransition | 大更新可中断 |
| 图片异步解码 + 降采样 | 大图不阻塞 |
| Native Driver | 简单动画 Native 执行 |
| 下沉 C++ | 重计算不占 JS 线程 |

## RN 内存优化

| 手段 | 层面 |
|------|------|
| DEX 布局优化 | Native（启动内存） |
| onTrimMemory 分级释放 | Native（系统压力） |
| 实例池 LRU | RN 框架（引擎数量） |
| WebView 不可见销毁 | RN 框架 |
| FlashList 虚拟列表 | React（DOM 数量） |
| 图片缓存上限 + 页面释放 | React/Native |
| useEffect return 清理 | React（防泄漏） |

## RN 包体优化

| 手段 | 效果 |
|------|------|
| ABI Split / AAB | SO -40~60% |
| Hermes .hbc | Bundle -30% |
| 分 Bundle | 首屏 -50% |
| R8（Shrink + Obfuscate + Optimize） | DEX -20~40% |
| WebP + CDN | 资源 -30~50% |
| strip debug symbols | SO -30~50% |
| App Thinning（iOS） | 自动按设备裁剪 |

## TurboModule 调用链

```
JS → JSI(C++ 函数指针直调) → JNI → Java 实现
                                    ↑ Codegen 自动生成，你不碰 JNI
```

## JSI vs 旧 Bridge

| | 旧 Bridge | JSI |
|--|----------|-----|
| 通信 | 跨线程异步队列 | 同进程 C++ 直调 |
| 参数 | JSON 序列化 | jsi::Value 类型转换 |
| 同步 | ❌ | ✅ |

## React 核心

| 概念 | 一句话 |
|------|--------|
| Fiber | 可中断的渲染单元（链表遍历，非递归） |
| Diff | 旧 Fiber 树 vs 新 JSX → 标记 flags → Commit 一次性更新 DOM |
| Hooks 链表 | 一个组件 = 一个 Fiber = 一条 Hooks 链表，按顺序读取 |
| memo | props 不变跳过渲染（需配合 useCallback） |
| useTransition | 低优先级更新，可被用户输入打断 |
| Zustand | 闭包 + 发布订阅 + selector 精准更新，不需要 Provider |

## Electron 核心

| 概念 | 一句话 |
|------|--------|
| 本质 | Chromium + Node.js 打包成桌面应用 |
| 主进程 | Node.js，管窗口和系统 API |
| 渲染进程 | Chromium Tab，渲染 React UI |
| IPC | 进程间通信（invoke/handle），和 RN Bridge 同类问题 |
| preload | 安全桥接，白名单暴露 API |

## Agent（Mako）核心

| 概念 | 一句话 |
|------|--------|
| ReAct 循环 | 思考 → 行动 → 观察 → 循环直到完成 |
| 5 层上下文 | L1 截断 → L2 去重 → L3 微压缩 → L4 AI 摘要 → L5 BM25 检索 |
| 为什么不用 LangChain | Agent 循环本身简单，真正难点（上下文管理）框架帮不了 |
| MCP | 标准协议连接外部工具，动态发现和使用 |

## 快应用框架

| 做了什么 | 数据 |
|---------|------|
| 包体优化 | 153MB → ~60MB |
| DEX 优化 | 44.4MB → 27MB（-39%） |
| 启动内存 | PSS MAX 41MB → 35.8MB |
| 自动化测试 | 三端覆盖，回归 2 人天 → 2 小时 |
| J2V8 同步 Bridge | 通信 ms 级 → μs 级 |

## 话术模板

**自我介绍（30s）**：
> "10 年前端，大前端架构 + AI Agent 方向。五端覆盖（Web/RN/小程序/桌面/跨端框架），最近在做 AI Coding Agent 框架和 MCP 全链路自动化。上一段在 XM 做快应用框架和 IDE。"

**性能优化怎么讲**：
> "我按三层讲：React 层（memo/虚拟列表/状态下沉）、RN 框架层（分 Bundle/容器预热/Reanimated）、Native 层（DEX 优化/预请求/ABI 裁剪）。每层有具体数据。"
