# Vite

> 解决什么问题：Webpack 开发体验差（冷启动慢、HMR 慢），Vite 利用浏览器原生 ESM 实现秒启动 + 毫秒级 HMR。
>
> 本质：开发时不打包（浏览器直接加载 ESM，Vite 按需编译）；生产时用 Rollup 打包。两套引擎，各取所长。
>
> 场景：2026 年新项目标配，Vue/React 官方脚手架默认使用。

---

## 目录

- [为什么 Vite 快](#为什么-vite-快)
- [核心原理](#核心原理)
  - [开发模式（Dev）](#开发模式dev)
  - [生产构建（Build）](#生产构建build)
  - [依赖预构建](#依赖预构建)
  - [HMR 原理](#hmr-原理)
- [Dev / Prod 不一致问题](#dev--prod-不一致问题)
- [插件系统](#插件系统)
- [和 Webpack 的本质区别](#和-webpack-的本质区别)
- [Vite 生态现状（2026）](#vite-生态现状2026)
- [Q&A](#qa)

---

## 为什么 Vite 快

```
Webpack 的慢：
  启动时：扫描所有文件 → 构建完整依赖图 → 打包成 bundle → 才能访问
  改代码：重新构建受影响的 chunk → 推送到浏览器
  = 项目越大越慢（几千模块 = 启动 30s+）

Vite 的快：
  启动时：不打包，直接启动 HTTP 服务器 → 浏览器请求哪个文件才编译哪个
  改代码：只编译改动的那一个模块 → 浏览器重新请求这一个文件
  = 项目大小和启动速度无关（永远秒启动）
```

---

## 核心原理

### 开发模式（Dev）

```
浏览器请求 main.tsx
  → Vite Dev Server 收到请求
  → 实时编译 main.tsx（esbuild，TS→JS，几毫秒）
  → 返回编译后的 JS（里面的 import 路径保持原样）
  → 浏览器解析 import → 再发请求加载依赖模块
  → 按需加载，用到才编译

关键点：
  - 不构建依赖图（浏览器自己按 import 发请求 = 浏览器就是模块加载器）
  - 编译用 esbuild（Go 写的，比 Babel 快 10-100x）
  - 只编译请求到的文件（未访问的页面/组件不编译）
```

### 生产构建（Build）

```
为什么生产不能也用 Dev 模式？
  - 大量小文件 HTTP 请求 → 线上性能差（即使 HTTP/2 也有请求数上限）
  - 需要 Tree Shaking / Code Splitting / 压缩 / hash 命名
  - 需要兼容性处理（babel polyfill）

所以生产构建用 Rollup：
  vite build → Rollup 全量打包 → 产出优化后的 bundle
  
= 开发用 esbuild（快），生产用 Rollup（优化好）
= 两套引擎，这也是 Dev/Prod 不一致问题的根源
```

### 依赖预构建

```
问题：node_modules 里的包很多是 CommonJS 格式（非 ESM），浏览器不认。
      且一个包可能有几百个内部模块（lodash-es 有 600+ 文件），每个发一次请求太慢。

Vite 的解法：启动时用 esbuild 对 node_modules 做一次预构建
  1. CommonJS → ESM 转换（让浏览器能加载）
  2. 多个内部文件合并为一个文件（减少请求数）
  3. 结果缓存到 node_modules/.vite/（下次启动直接用）

= 只对 node_modules 做一次"轻量打包"
= 你自己的源码不打包（按需编译）
```

### HMR 原理

```
Webpack HMR：
  文件变更 → 重新编译受影响的 chunk → WebSocket 推送新 chunk → 浏览器替换

Vite HMR：
  文件变更 → 只编译这一个模块（esbuild，毫秒级）
  → WebSocket 通知浏览器"这个模块变了"
  → 浏览器重新 import 这个模块（URL 加时间戳使缓存失效）
  → 模块自身的 import.meta.hot.accept() 处理热更新

为什么 Vite HMR 快：
  - 不需要重新构建 chunk（没有 chunk 的概念）
  - 只处理一个文件（不追溯依赖图）
  - 编译用 esbuild（毫秒级）
```

---

## Dev / Prod 不一致问题

> 这是 Vite 的核心痛点：Dev 用 esbuild + ESM，Prod 用 Rollup 打包，两套引擎可能行为不同。

| 问题 | 原因 | 表现 |
|------|------|------|
| CSS 顺序不一致 | Dev 按请求顺序，Prod 按 Rollup chunk 合并顺序 | 样式覆盖关系变化 |
| 模块解析差异 | esbuild 和 Rollup 的解析规则不完全相同 | Dev 能跑的 import 写法 Prod 报错 |
| 环境变量差异 | 某些库在 Dev/Prod 模式行为不同 | 功能异常 |
| Polyfill 缺失 | Dev 浏览器原生支持，Prod 目标浏览器不支持 | 低版本白屏 |

**解决 / 规避**：

```
1. CI 必跑 vite build → 不能只跑 dev 就部署
2. 本地 vite build + vite preview 验证
3. 用 vitest 做测试（和 Vite 共享配置，减少环境差异）
4. 未来方向：Rolldown（Rust 重写 Rollup）统一 Dev/Prod 引擎 → 彻底解决
```

---

## 插件系统

```
Vite 插件 = Rollup 插件的超集

  Rollup 插件 API（构建时）：
    resolveId → 自定义模块解析
    load → 自定义加载（虚拟模块）
    transform → 代码转换

  Vite 扩展的 Hook（开发时）：
    configureServer → 给 Dev Server 加中间件
    transformIndexHtml → 修改 HTML
    handleHotUpdate → 自定义 HMR 行为

= 大部分 Rollup 插件可以直接在 Vite 中使用
= Vite 特有的 Hook 只在 Dev Server 生效
```

```typescript
// 一个简单的 Vite 插件
function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    // Rollup 通用 hook：编译时转换代码
    transform(code, id) {
      if (id.endsWith('.md')) {
        return `export default ${JSON.stringify(marked(code))}`;
      }
    },
    // Vite 特有 hook：Dev Server 中间件
    configureServer(server) {
      server.middlewares.use('/api', myApiHandler);
    },
  };
}
```

---

## 和 Webpack 的本质区别

| | Webpack | Vite |
|---|---|---|
| **思维模型** | 打包器（所有文件→bundle） | 原生模块服务器（按需编译） |
| **Dev 启动** | 全量构建后才能访问 | 直接启动，请求时才编译 |
| **HMR** | 重新构建 chunk | 重新编译单个模块 |
| **编译器** | Babel（JS，慢） | esbuild（Go，快 100x） |
| **生产构建** | Webpack 自身 | Rollup（另一个工具） |
| **配置** | 复杂（loader/plugin 链） | 简洁（约定优于配置） |
| **Module Federation** | 原生支持 | 需要插件 / MF 2.0 |
| **生态成熟度** | 最大（历史最长） | 快速追赶，主流场景已覆盖 |

**一句话**：Webpack 是"编译时做所有事"，Vite 是"能推迟的都推迟到运行时/请求时"。

---

## Vite 生态现状（2026）

| 方向 | 现状 |
|------|------|
| **框架支持** | Vue/React/Svelte/Solid 官方默认 |
| **SSR** | Nuxt 3 / Next.js（实验性）/ Astro 基于 Vite |
| **测试** | Vitest（和 Vite 配置复用，替代 Jest） |
| **Module Federation** | MF 2.0 的 `@module-federation/vite` 插件支持 |
| **替代品** | Rspack（Webpack 兼容 + Rust 速度）、Turbopack（Vercel，Next.js 专用） |
| **未来** | Rolldown（Rust 重写 Rollup，统一 Vite 的 Dev/Prod 引擎） |

---

## Q&A

**Q：Vite 为什么开发时不打包也能跑？**

A：因为现代浏览器原生支持 ES Module（`<script type="module">`）。浏览器自己解析 import 语句并发请求加载模块，不需要 Webpack 预先打成 bundle。Vite 只做"请求到了实时编译"这一件事。

**Q：依赖预构建是什么？为什么需要？**

A：node_modules 里的包很多是 CommonJS（浏览器不认），且内部模块太多（一个包几百个文件 = 几百个请求）。Vite 启动时用 esbuild 把 node_modules 预处理一次：CJS→ESM + 合并文件 + 缓存。只做一次，后续用缓存。

**Q：Vite 和 Webpack 能共存吗？**

A：可以。常见场景：存量项目主体 Webpack，新模块/子项目用 Vite。或者通过 Module Federation 让 Vite 构建的 Remote 和 Webpack 构建的 Host 互通。

**Q：什么时候不该用 Vite？**

A：
- 项目强依赖 Webpack 特性（Module Federation 1.0、特定 loader）
- 团队 Webpack 配置已经调好且稳定（迁移有风险无明显收益）
- 需要极致的构建产物控制（Webpack 的细粒度配置更多）

**Q：Rolldown 是什么？什么时候能用？**

A：Vite 团队用 Rust 重写 Rollup，目标是统一 Dev/Prod 引擎（消除不一致问题）+ 构建速度提升 10x。2026 年处于积极开发中，预计集成到 Vite 6.x。届时 Vite 将不再有 Dev/Prod 两套引擎的问题。

// ? vite打包结果啥样? 还是用ESM吗 
