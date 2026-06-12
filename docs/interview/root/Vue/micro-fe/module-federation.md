我来用第一性原理拆解模块联邦（Module Federation）的底层本质。

> **定位**：MF 本身只是一个"模块共享机制"，不是完整的微前端方案。它不管隔离、不管路由、不管生命周期。要用 MF 做微前端，需要配合规范约定（CSS Modules、禁止全局变量）+ 工具链卡控（Lint/CI）来补齐隔离能力。
>
> **本质**：MF + 团队规范 + 质量卡控 = 一个**弱约束**的微前端方案（靠约定而非机制保障隔离）。适合同构互信场景（同技术栈、同组织、代码质量可控）。需要强隔离时应选 qiankun。
>
> **核心差异化价值**：不是"独立部署"（qiankun 也能做），而是"跨应用模块级代码共享"——多个独立部署的应用运行时共用同一份组件/工具代码，改一处全局生效。

---

## 目录

- [第一性原理：我们在解决什么问题？](#第一性原理我们在解决什么问题)
- [拆解到原子层面：Webpack 构建只产出什么？](#拆解到原子层面webpack-构建只产出什么)
- [模块联邦的核心机制（第一性视角）](#模块联邦的核心机制第一性视角)
- [构建-部署-加载全流程](#构建-部署-加载全流程)
- [模块联邦的架构全景](#模块联邦的架构全景第一性总结)
- [模块联邦 vs 乾坤：第一性对比](#模块联邦-vs-乾坤第一性对比)
- [组合使用的架构](#组合使用的架构)
- [npm 包 vs 模块联邦](#第一性对比npm-包-vs-模块联邦)
- [MF 与 Monorepo 的关系](#mf-与-monorepo-的关系)
- [MF 在经典微前端场景中的用法](#mf-在经典微前端场景中的用法)
- [MF 2.0 现状（2026）](#mf-20-现状2026)
- [同构场景下 MF 比 qiankun 好在哪](#同构场景下-mf-比-qiankun-好在哪)
- [为什么要技术栈统一 + 没有隔离能力？](#为什么要技术栈统一--没有隔离能力)
- [业界现状与选型（2026）](#业界现状与选型2026)
- [MF 微前端最佳实践（2026）](#mf-微前端最佳实践2026)
- [Monorepo + MF（业界最佳实践）](#monorepo--mf业界最佳实践)

---

## 第一性原理：我们在解决什么问题？

模块联邦不是"另一种微前端方案"，而是解决一个更根本的问题：

> **多个独立构建的应用，如何在运行时共享代码，而不需要预先打包在一起？**

传统方案的矛盾：
- **npm 包共享**：更新需要重新构建 + 发布 + 升级 → 耦合发布节奏
- **动态导入（`import()`）**：只能加载自己的 chunk，无法加载其他构建产物的模块
- **UMD 全局变量**：污染全局、无 Tree Shaking、版本冲突

**模块联邦的本质 = 让 Webpack 构建的"边界"在运行时消失**

---

## 拆解到原子层面：Webpack 构建只产出什么？

Webpack 不认识"微前端"，它只产出两种原子产物：

1. **Chunk 文件**（JS/CSS/资源）
2. **Runtime 代码**（模块加载器 + 模块映射表）

```javascript
// Webpack 产物的原子结构
// 1. 模块映射表：id -> 代码块位置
var __webpack_modules__ = {
  0: () => { /* module A */ },
  1: () => { /* module B */ },
  // ...
};

// 2. 模块加载器：根据 id 加载并执行
function __webpack_require__(moduleId) {
  // 缓存检查 → 执行模块 → 返回 exports
}
```

**模块联邦的本质 = 扩展 Webpack 的模块加载器，让它能加载"远程构建产物"中的模块**

---

## 模块联邦的核心机制（第一性视角）

### 1. 构建时：不是"打包在一起"，是"约定远程地址"

```javascript
// 主应用（Host）的 webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'host_app',
      remotes: {
        // 关键：这里不打包 nav 的代码，只约定"去哪找"
        nav: 'nav_app@https://cdn.example.com/nav/remoteEntry.js'
      },
      shared: {
        // 共享依赖的"契约"
        react: { singleton: true, requiredVersion: '^18.0.0' }
      }
    })
  ]
};
```

```javascript
// 子应用（Remote）的 webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'nav_app',
      exposes: {
        // 暴露哪些模块给外部
        './Header': './src/Header',
        './UserMenu': './src/UserMenu'
      },
      shared: {
        react: { singleton: true }
      }
    })
  ]
};
```

**构建时本质**：Webpack 不解析远程模块内容，只在本地代码中**插入"占位符"**，并生成一份**模块清单（remoteEntry.js）**。

---

### 2. 运行时：`remoteEntry.js` 是什么？

这是模块联邦的核心产物，本质是一个**"自举的模块注册器"**：

```javascript
// remoteEntry.js 的简化本质
var nav_app = {
  // 1. 模块工厂：id -> 模块代码
  modules: {
    './Header': () => { /* Header 模块代码 */ },
    './UserMenu': () => { /* UserMenu 模块代码 */ }
  },
  
  // 2. 模块获取器：按名称返回模块
  get: function(moduleName) {
    return Promise.resolve(this.modules[moduleName]);
  },
  
  // 3. 初始化：与 Host 的共享依赖协调
  init: function(sharedScope) {
    // 将自己暴露的共享依赖注册到全局共享池
  }
};

// 注册到全局，让 Host 能找到
window.nav_app = nav_app;
```

**本质**：`remoteEntry.js` 不是"一个模块"，而是一个**"模块容器（Container）"**——一个知道如何按需暴露内部模块的微内核。

---

### 3. 加载机制：不是 `import()`，是"容器协议"

当你在 Host 中写：

```javascript
import('nav/Header')  // nav 是 remote 名，Header 是 exposed 模块
```

Webpack 将其编译为：

```javascript
// 编译后的伪代码
function loadRemoteModule(remoteName, moduleName) {
  // 1. 加载 remoteEntry.js（如果还没加载）
  return __webpack_require__.l('https://cdn.example.com/nav/remoteEntry.js')
    .then(() => {
      // 2. 从全局获取容器实例
      const container = window[remoteName];
      
      // 3. 初始化共享依赖（关键！）
      return container.init(__webpack_share_scopes__.default);
    })
    .then(() => {
      // 4. 从容器获取具体模块
      return container.get(moduleName);
    })
    .then(factory => {
      // 5. 执行模块工厂，得到 exports
      return factory();
    });
}
```

**本质**：模块联邦不是扩展了 ES Module 规范，而是**在 Webpack 的模块系统内部，增加了一层"远程容器"的寻址协议**。

**执行机制：不依赖浏览器原生 ESM**

```
整个加载链路：
  __webpack_require__.l(url)
    → document.createElement('script')
    → script.src = remoteEntry.js 的 CDN 地址
    → document.head.appendChild(script)
    → 等 onload
    → remoteEntry.js 执行后把容器挂到 window['remote_app']
    → Host 从全局变量拿到容器 → 调 get/init

= <script> 标签加载 + 全局变量传递 + Webpack runtime 调度
≠ 浏览器原生 ESM / import map / <script type="module">
```

**为什么不用原生 ESM？**
- MF 需要运行时版本协商（shared）— 原生 ESM 没有这层能力
- MF 需要"容器协议"（get/init）— 原生 ESM 没有这层抽象
- Webpack 模块系统本身自洽，不依赖浏览器模块规范

---

### 4. 共享依赖：不是"去重"，是"运行时版本协商"

这是模块联邦最精妙的设计：

```
┌─────────────────────────────────────────────┐
│           全局共享作用域（Share Scope）        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ react@17 │  │ react@18 │  │ lodash@4 │    │
│  │ (来自A)  │  │ (来自B)  │  │ (来自C)  │    │
│  └─────────┘  └─────────┘  └─────────┘     │
│                                             │
│  规则：singleton:true → 只加载一个版本        │
│       requiredVersion → 版本兼容性检查        │
└─────────────────────────────────────────────┘
```

```javascript
// 共享依赖的协商逻辑（简化）
function findValidVersion(sharedScope, packageName, versionRange) {
  const versions = sharedScope[packageName]; // { '17.0.2': factory, '18.0.0': factory }
  
  // 找满足 versionRange 的最高版本
  for (const [version, factory] of Object.entries(versions)) {
    if (satisfies(version, versionRange)) {
      return factory;
    }
  }
  
  // 找不到？从当前应用加载自己的版本
  return loadOwnVersion(packageName);
}
```

**本质**：模块联邦把 npm 的**依赖解析（Dependency Resolution）**从构建时推迟到了**运行时**，并在多个构建产物之间建立了**版本协商机制**。

---

## 模块联邦的架构全景（第一性总结）

```
构建时：
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Host App   │         │  Remote A   │         │  Remote B   │
│  (webpack)   │         │  (webpack)  │         │  (webpack)  │
│             │         │             │         │             │
│  remotes: { │         │  exposes: { │         │  exposes: { │
│    nav: 'url'│         │    './Btn': │         │    './Card':│
│  }          │         │  }          │         │  }          │
│             │         │             │         │             │
│  shared: {  │◄────────►│  shared: {  │◄───────►│  shared: {  │
│    react    │  约定    │    react    │  约定   │    react    │
│  }          │         │  }          │         │  }          │
└─────────────┘         └─────────────┘         └─────────────┘

运行时：
┌─────────────────────────────────────────────────────────────┐
│                        浏览器页面                              │
│  ┌─────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Host    │  │  Remote A       │  │  Remote B       │     │
│  │ Runtime │  │  remoteEntry.js │  │  remoteEntry.js │     │
│  │         │  │  ┌───────────┐  │  │  ┌───────────┐  │     │
│  │ import( │  │  │ ./Btn     │  │  │  │ ./Card    │  │     │
│  │  'nav/ │──┼──►│ factory() │  │  │  │ factory() │  │     │
│  │  Btn'  │  │  └───────────┘  │  │  └───────────┘  │     │
│  │ )      │  │                 │  │                 │     │
│  │         │  │  init(shared)   │  │  init(shared)   │     │
│  └────┬────┘  └─────────────────┘  └─────────────────┘     │
│       │                                                     │
│       └────────────────────────────────────────────────►    │
│                    全局 Share Scope                         │
│              { react: { '18.2.0': factory } }               │
└─────────────────────────────────────────────────────────────┘
```

---

## 模块联邦 vs 乾坤：第一性对比

| 维度 | 乾坤（qiankun） | 模块联邦（Module Federation） |
|------|----------------|---------------------------|
| **抽象层级** | 应用级（Application） | 模块级（Module） |
| **加载单位** | 整个 HTML/JS 应用 | 单个 JS 模块 |
| **隔离策略** | 强隔离（沙箱、样式前缀） | 弱隔离（共享依赖、无沙箱） |
| **耦合程度** | 低耦合（应用间不共享代码） | 高内聚（模块间共享依赖） |
| **运行时成本** | 高（JS 沙箱、DOM 隔离） | 低（纯模块加载） |
| **适用场景** | 异构技术栈、独立部署 | 同构技术栈、模块复用 |

**本质区别**：
- **乾坤** = "多个应用拼成一个页面"（像操作系统多窗口）
- **模块联邦** = "一个应用拆成多个构建"（像分布式链接器）

---

## 一句话总结

> **模块联邦的底层原理 = 扩展 Webpack 的模块加载器，在运行时通过"容器协议"加载远程构建产物中的模块，并用"共享作用域"实现跨构建产物的依赖去重与版本协商，从而把"构建时链接"推迟到"运行时链接"。**

它不是微前端的"替代方案"，而是微前端在**同构技术栈、高模块复用**场景下的**编译器级优化**。

完全正确。它们不是替代关系，而是**不同抽象层级的互补**。

---

## 组合使用的架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器页面                              │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              乾坤（应用级容器）                         │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│   │  │   子应用 A    │  │   子应用 B    │  │   子应用 C    │  │  │
│   │  │  (React 17)  │  │  (Vue 3)     │  │  (React 18)  │  │  │
│   │  │             │  │             │  │             │  │  │
│   │  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │  │
│   │  │  │ MF模块 │  │  │  │ MF模块 │  │  │  │ MF模块 │  │  │
│   │  │  │ 共享  │  │  │  │ 共享  │  │  │  │ 共享  │  │  │
│   │  │  │ Button│  │  │  │ Table │  │  │  │ Chart │  │  │
│   │  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │  │
│   │  │  模块联邦    │  │  模块联邦    │  │  模块联邦    │  │  │
│   │  │  (同构复用)   │  │  (同构复用)   │  │  (同构复用)   │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│   │                                                         │  │
│   │  职责：DOM 隔离、样式隔离、JS 沙箱、生命周期管理            │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   乾坤解决：异构技术栈的"应用拼合"                              │
│   模块联邦解决：同构技术栈的"模块共享"                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 各自负责的边界

| 问题 | 乾坤处理 | 模块联邦处理 |
|------|---------|-----------|
| Vue 和 React 应用共存 | ✅ 沙箱隔离 | ❌ 不适用 |
| 两个 React 应用共享组件库 | ❌ 各自打包 | ✅ 运行时共享 |
| 子应用独立部署、独立路由 | ✅ 生命周期管理 | ❌ 不解决 |
| 同构应用间共享工具函数 | ❌ 重复打包 | ✅ 远程加载 |
| CSS 污染防护 | ✅ 样式隔离 | ❌ 无此能力 |
| 依赖版本冲突 | ❌ 各自管理 | ✅ 版本协商 |

---

## 一句话

> **乾坤是"应用的容器运行时"，模块联邦是"模块的分布式链接器"。一个管边界隔离，一个管代码共享——层级不同，自然互补。**

好问题，直击本质。用 npm 包共享 vs 模块联邦，核心差别在**"发布-消费"的时间关系**。

---

## 第一性对比：npm 包 vs 模块联邦

```
npm 包共享（构建时链接）：
┌─────────┐    发布    ┌─────────┐    安装    ┌─────────┐    构建    ┌─────────┐
│  开发   │ ────────► │  npm    │ ────────► │  消费方  │ ────────► │  产物   │
│  组件库  │           │ Registry│           │ 安装版本  │           │  上线   │
└─────────┘           └─────────┘           └─────────┘           └─────────┘
     ↑                                                    ↓
     └──────────────── 升级需重新走全流程 ◄─────────────────┘

模块联邦（运行时链接）：
┌─────────┐    发布    ┌─────────┐         ┌─────────┐    构建    ┌─────────┐
│  开发   │ ────────► │  CDN    │         │  消费方  │ ────────► │  产物   │
│  组件库  │           │ 静态资源 │         │ 不安装   │           │  上线   │
└─────────┘           └─────────┘         └─────────┘           └─────────┘
                              ↑                                    ↓
                              └──── 运行时 import('remote/Btn') ───┘
```

---

## npm 包解决不了什么？

### 场景 1：独立部署，不重启消费方

```
问题：10 个业务应用共用 Button 组件，Button 改了个样式

npm 方案：
- 改 Button → 发 v1.1.0 → 10 个应用各自升级 package.json 
  → 各自构建 → 各自测试 → 各自发布 → 全部上线
- 耗时：天/周级别，且无法保证同时生效

模块联邦：
- 改 Button → 构建发布到 CDN → 10 个应用刷新即生效
- 耗时：分钟级别，即时全局生效
```

**本质**：npm 的"版本锁定"是优势也是枷锁——它保证了可复现性，但也固化了代码。

### 场景 2：巨石应用拆分，但保持代码共享

```
问题：一个 1000 页的后台系统，拆成 10 个微应用

纯 npm 方案：
- 每个微应用独立仓库
- 公共组件做成 npm 包
- 结果：改个通用逻辑，10 个仓库都要发版

模块联邦：
- 公共组件放在 Remote 容器
- 10 个微应用运行时加载
- 结果：改一处，全局生效
```

### 场景 3：版本灰度与动态选择

```javascript
// 模块联邦可以做到（npm 做不到）
const Chart = await import(
  user.isBeta 
    ? 'chart-v2/Chart'   // 新用户用新版
    : 'chart-v1/Chart'   // 老用户用旧版
);
```

**本质**：运行时链接 = 运行时决策。

---

## 什么场景必须用模块联邦？

| 场景 | 为什么 npm 不行 | 模块联邦的价值 |
|------|---------------|-------------|
| **低代码平台** | 组件由第三方开发，无法预装到 npm | 运行时注册、动态加载 |
| **插件化架构** | 插件在应用发布后产生 | 无需重新构建主应用 |
| **A/B 测试组件级** | 需要运行时切换组件实现 | 动态路由到不同 Remote |
| **大型组织多团队** | 各团队独立 CI/CD，无法协调发版 | 解耦发布节奏 |
| **边缘部署/SSR** | 不同地区需要不同组件实现 | 运行时按环境加载 |

---

## 什么场景 npm 就够了？

| 场景 | 为什么不需要模块联邦 |
|------|------------------|
| 小型项目，2-3 个应用 | 复杂度不划算 |
| 公共库极少变更 | 发版成本可接受 |
| 需要强版本锁定（金融核心） | 运行时加载 = 不可控 |
| 团队在同一仓库（Monorepo） | 构建时链接更简单 |

---

## 一句话总结

> **npm 包是"编译时契约"——稳定、可复现、但僵化；模块联邦是"运行时契约"——灵活、动态、但需治理。**
>
> **选 npm：你的共享代码变更频率低，且能接受协调发版。**
> **选模块联邦：你的共享代码需要独立迭代，且消费方不能为此重启。**


---

## MF 与 Monorepo 的关系

```
Monorepo：
  构建时共享依赖（pnpm workspace hoist）
  构建时引用其他 package（import from '@org/shared'）
  所有 package 在同一个仓库，统一构建

Module Federation：
  运行时共享依赖（Share Scope 协商版本）
  运行时引用其他应用的模块（import('remote/Button')）
  各应用可以在不同仓库，独立构建独立部署
```

**本质**：MF 就是"运行时的 Monorepo"——区别只在链接时机。

| | Monorepo | Module Federation |
|---|---|---|
| 链接时机 | 构建时（编译器解析） | 运行时（浏览器加载） |
| 部署耦合 | 共享代码改了要重新构建消费方 | 完全独立部署，改了即生效 |
| 版本管理 | 同一 commit 保证一致 | 运行时版本协商（可能不一致） |
| 适合 | 同一团队、统一发版节奏 | 多团队、独立发版节奏 |

**选型**：
- 同团队、同仓库、统一发版 → Monorepo 就够了，不需要 MF
- 多团队/多仓库、需要独立部署独立发版 → MF 的价值才体现

---

## MF 在经典微前端场景中的用法

> 经典场景：左侧菜单（主应用）+ 右侧 container（加载不同子应用）

```
qiankun 做法：
  主应用（Header + Sidebar + Container）
  路由 /activity → fetch activity-app 的 HTML → 沙箱执行 → mount 到 Container

MF 做法：
  主应用（Header + Sidebar + Container + React Router）
  路由 /activity → React.lazy(() => import('activityRemote/App')) → 渲染到 Container
```

| | qiankun | MF |
|---|---|---|
| 加载的是什么 | 整个 HTML（解析 → 沙箱 → mount） | 一个 JS 模块（React 组件） |
| 路由谁管 | qiankun 自己监听 URL | 主应用的 React Router |
| 子应用是什么 | 完整的独立 SPA | 一个导出的远程组件/页面 |
| 隔离 | 有（Proxy 沙箱 + CSS 前缀） | 没有（共享同一个 React 实例） |

MF 的本质是把"子应用"降级为"远程模块"——不再是独立 SPA，而是主应用 Router 下的一个懒加载路由组件，只是代码从远程 CDN 加载。

---

## MF Remote 的构建产物（不是 SPA）

```
SPA 的产物（qiankun 加载的）：
  dist/
  ├── index.html          ← 入口 HTML（浏览器直接访问）
  ├── app.js              ← 整个应用的 JS bundle
  └── app.css             ← 整个应用的 CSS

MF Remote 的产物：
  dist/
  ├── remoteEntry.js      ← 模块容器（核心！不是 HTML）
  ├── src_App_js.chunk.js      ← 按 expose 拆分的 chunk
  ├── src_Button_js.chunk.js
  └── index.html          ← 可选，用于独立运行/开发调试
```

**remoteEntry.js 的本质**：

```javascript
// 不是一个应用，是一个"模块注册表"
// 告诉 Host："我有这些模块，你要哪个我按需加载给你"
var activityRemote = {
  get(moduleName) {
    // './App' → 动态 import 对应的 chunk → 返回模块 factory
    return import(`./src_${moduleName}_js.chunk.js`);
  },
  init(sharedScope) { /* 和 Host 协商共享依赖 */ }
};
window.activityRemote = activityRemote;
```

| | SPA 产物 | MF Remote 产物 |
|---|---|---|
| 入口 | HTML 文件 | JS 文件（remoteEntry.js） |
| 包含什么 | 完整应用（路由+页面+状态+样式） | 模块工厂（按 expose 暴露的模块） |
| 谁加载它 | 浏览器直接访问 | Host 应用的 Webpack Runtime |
| 能独立运行吗 | 能 | 不能（需要 Host 消费） |
| 类比 | 一个完整的 App | 一个部署在 CDN 上的 npm 包 |

**一句话**：MF Remote 的产物更像"部署在 CDN 上、运行时按需加载的 npm 包"——不是应用，是模块集合。

---

## MF 2.0 现状（2026）

```
演进：
  MF 1.0（2020）→ Webpack 5 内置，只能 Webpack 用
  MF 2.0（2024-2025）→ 独立包 @module-federation/enhanced
                     → 支持 Webpack / Rspack / Vite
                     → 增加了类型共享、运行时插件、Chrome DevTools

MF 2.0 解决了 1.0 的主要痛点：
  只能 Webpack → 支持 Vite/Rspack
  没有类型提示 → 自动同步远程模块类型（@module-federation/typescript）
  调试困难 → Chrome DevTools 扩展
  版本冲突排查难 → 运行时 Dashboard
```

**依赖不要求完全一样**：

```javascript
// 应用 A：react@18.2.0
// 应用 B：react@18.3.0
// 应用 C：react@17.0.2

shared: {
  react: { singleton: true, requiredVersion: '^18.0.0' }
}

// 运行时协商：
//   A 和 B 共用 react@18.3.0（满足两者要求）
//   C 要求 17.x 不兼容 → fallback 加载自己的 react@17
```

不是"要求依赖一样"，而是"尽量共用，不兼容时各用各的"。

---

## 同构场景下 MF 比 qiankun 好在哪

> 前提：全 React 或全 Vue，同一团队/互相信任，不需要强隔离。

| 维度 | qiankun | MF | 为什么 MF 更优 |
|------|---------|-----|---------------|
| 运行时开销 | 高（Proxy 沙箱 + CSS 处理） | 几乎零（就是 `import()`） | 不需要隔离时沙箱是无用开销 |
| 依赖重复 | 各自打包 React | 运行时共享一份 | 包体更小、加载更快 |
| 共享粒度 | 应用级 | 模块级（一个组件/函数） | 更细粒度按需加载 |
| 开发体验 | 需导出生命周期、改构建配置 | `import('remote/Btn')` 和本地一样 | 接入成本更低 |
| 类型支持 | 无 | MF 2.0 自动同步类型 | DX 好 |

**但 qiankun 不可替代的场景**：
- 异构技术栈（Vue + React 混合）
- 子应用不可信/第三方
- 存量老项目接入（qiankun 不限构建器）

**一句话**：不需要隔离时，qiankun 的沙箱是纯开销，MF 更轻更快。需要隔离时，MF 做不到，qiankun 不可替代。

---

## 构建-部署-加载全流程

**Q：MF 的构建、部署、加载过程是怎样的？**

```
┌─ 构建阶段（各自独立 build）──────────────────────────────┐
│                                                           │
│  Remote（子应用 B）：                                      │
│    webpack build → 产出 remoteEntry.js（manifest）+ chunks │
│    remoteEntry.js = "我暴露了哪些模块 + 怎么加载它们"       │
│                                                           │
│  Host（主应用 A）：                                        │
│    webpack build → 只记录 remote 地址，不打包 Remote 代码   │
│                                                           │
└───────────────────────────────────────────────────────────┘

┌─ 部署阶段（各自独立部署）─────────────────────────────────┐
│                                                           │
│  Remote → CDN：https://cdn.example.com/appB/remoteEntry.js│
│  Host   → 自己的服务器                                     │
│                                                           │
│  互不阻塞。Remote 更新后 Host 不用重新构建。               │
│                                                           │
└───────────────────────────────────────────────────────────┘

┌─ 加载阶段（运行时按需）──────────────────────────────────┐
│                                                           │
│  1. 用户访问 Host 页面                                    │
│  2. Host 代码执行到 import('appB/Page')                   │
│  3. 浏览器请求 remoteEntry.js（manifest）                 │
│  4. 从 manifest 查到 './Page' 对应哪个 chunk              │
│  5. 动态加载那个 chunk（<script> 标签）                   │
│  6. chunk 执行后注册到 shared scope                       │
│  7. Host 拿到模块 → 渲染成组件                            │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**remoteEntry.js 的角色**：就是一个"目录" — 告诉 Host "我有什么模块、在哪个 URL"。Host 不需要提前知道 Remote 的代码内容，运行时按需拉取。

**和普通 CDN 加载的区别**：普通 CDN 是全量下载一个文件。MF 是先拿目录，再按 import 路径只加载需要的那一个模块。shared 机制保证 React 等大库只加载一份。

---

## 为什么要技术栈统一 + 没有隔离能力？

**Q：MF 为什么要求技术栈统一？确实没有隔离能力吗？**

**确实没有隔离**：远程模块加载后和宿主跑在同一个 window、同一个 React 实例里。没有沙箱，没有样式隔离。

**为什么要技术栈统一**：MF 的核心价值是 `shared`（共享依赖）。

```js
shared: { react: { singleton: true } }
// 含义：宿主和远程模块共享同一个 React 实例
```

如果一个用 React，一个用 Vue — 没法 shared，各自加载完整框架 → 体积翻倍 → 还可能全局冲突。

**心智模型对比**：

| | qiankun | MF |
|--|---------|-----|
| 类比 | 多租户公寓（各自隔离） | 一栋别墅的多个房间（共享水电） |
| 信任级别 | 不信任子应用 | 信任远程模块（同团队/同框架） |
| 适合 | 接入不可控的第三方 | 同公司同框架互信的多团队 |

---

## 业界现状与选型（2026）

### 微前端方案格局

```
国内：
  qiankun — 存量最大（阿里/美团/滴滴后台），但 2023 后基本停止维护
  Wujie — 腾讯，iframe 级隔离，新项目强隔离首选
  Garfish — 字节，内部生态绑定
  MF 2.0 — 新项目同构场景主流

海外：
  Module Federation — 主流（Shopify/Spotify 等大量采用）
  single-spa — 热度下降
  import maps + ESM — 简单场景兴起

趋势：
  qiankun 像 jQuery — 存量巨大，新项目不选，也不急着迁
  MF 2.0 是新项目首选（同构场景）
  需要强隔离 → Wujie
```

### 选型结论

| 场景 | 推荐 | 原因 |
|------|------|------|
| 存量 qiankun 项目 | 继续 qiankun | 迁移成本高，能跑就行 |
| 新项目 + 同构技术栈 | **MF 2.0** | 最轻、性能最好、生态活跃 |
| 新项目 + 异构/强隔离 | Wujie | iframe 级隔离、接入简单 |
| 字节系 | Garfish | 内部生态 |

---

## MF 微前端最佳实践（2026）

> MF 没有隔离能力，怎么在生产中用它做微前端？答案：**约定 + 工具链卡控 + 架构规范**替代机制隔离。

### 核心原则

```
MF 微前端 = MF（模块共享） + 团队规范（隔离约定） + CI 卡控（保障约定落地）
```

### 隔离问题怎么解决

| qiankun 靠机制解决的 | MF 靠什么替代 |
|---------------------|-------------|
| JS 沙箱（Proxy） | 不需要 — 同构信任场景，靠规范 + CI 卡控替代运行时隔离 |

> **如果 Remote 写了 `window.xxx = ...` 怎么办？**
>
> MF 不提供运行时沙箱，靠约定 + 工具链防御：
> - ESLint：`no-restricted-globals` / `no-global-assign` → CI 阻断
> - Code Review：合入时检查全局副作用
> - 团队约定：Remote 只用 React 数据流，不碰 window/document
> - 第三方库（GA/Sentry 等需要 window 的）：由 Host 统一接入，Remote 不自己装
>
> **本质取舍**：qiankun 不信任 → Proxy 隔离（有开销有逃逸）；MF 信任 → 约定卡控（零开销靠纪律）。不信任就别用 MF，用 qiankun/Wujie。

**ESLint 约束清单（MF 场景的唯一硬卡控）**：

```js
// .eslintrc.cjs — Monorepo 根目录统一配置
module.exports = {
  rules: {
    // 1. 禁止写全局变量（防 JS 污染）
    'no-restricted-globals': ['error', 'event', 'name', 'length'],
    'no-global-assign': 'error',
    // 自定义规则：禁止 window.xxx = 赋值
    'no-restricted-syntax': ['error', {
      selector: "AssignmentExpression[left.object.name='window']",
      message: 'Remote 禁止写 window 全局变量'
    }],

    // 2. 禁止直接操作 document.body（防 DOM 逃逸）
    'no-restricted-properties': ['error', {
      object: 'document', property: 'body', message: '用框架 Portal 代替'
    }],

    // 3. 禁止 eval（防不可控代码注入）
    'no-eval': 'error',
    'no-implied-eval': 'error',
  }
}

// 配合 Stylelint / 构建检查：
// 4. 禁止全局 CSS — 只允许 .module.css / .module.scss / Tailwind
//    构建时检查：发现非模块化 CSS 文件 → 阻断
```
| 样式隔离（前缀/Shadow DOM） | **CSS Modules / Tailwind** — 类名 hash 唯一，天然不冲突 |
| 生命周期管理（mount/unmount） | **React Router 懒加载** — React.lazy(() => import('remote/Page')) |
| 子应用通信 | **共享状态库**（Zustand/Redux 同一个 store 实例） |

### 样式隔离：约定替代机制

```
为什么 MF 不需要 Proxy/Shadow DOM 级别的样式隔离？
  → 前提：同构技术栈（全 React），团队互信
  → CSS Modules：每个组件的类名编译后带 hash（.btn_a3f2x），全局唯一
  → Tailwind：utility class 本身不会冲突
  → 结果：不用框架级隔离，开发规范就解决了

CI 卡控：
  - ESLint 禁止全局 CSS（no-global-styles 规则）
  - 构建时检查是否有非 Modules 的 .css 文件
  - MR 门禁：新增全局样式必须 approve
```

### 路由与页面级集成

```tsx
// 主应用（Host）— 路由配置
const routes = [
  { path: '/', element: <Layout /> },
  { path: '/dashboard/*', element: lazy(() => import('dashboardRemote/App')) },
  { path: '/activity/*', element: lazy(() => import('activityRemote/App')) },
  { path: '/settings/*', element: lazy(() => import('settingsRemote/App')) },
]

// 每个 Remote 暴露一个 App 组件（带自己的子路由）
// Host 只管一级路由分发，Remote 内部自己管二级路由
```

**本质**：MF 微前端 = 主应用是路由壳 + 每个"子应用"就是一个远程懒加载的路由模块。

### 依赖共享

```js
// Host 和所有 Remote 统一配置
shared: {
  react: { singleton: true, requiredVersion: '^18.0.0' },
  'react-dom': { singleton: true },
  'react-router-dom': { singleton: true },
  zustand: { singleton: true },  // 状态库也共享 → 同一个 store 实例
}
```

**Host 和 Remote 都要配这个字段。**

**不是远程动态加载公共依赖，而是各自都打包了，运行时协商只用一份**：

```
构建时：
  Host 打包了 React → vendors-react.chunk.js（Host CDN）
  Remote A 也打包了 React → vendors-react.chunk.js（Remote A CDN）
  Remote B 也打包了 React → vendors-react.chunk.js（Remote B CDN）
  
  每份产物都有 React，但被包装成"懒加载工厂"（不是立即执行）

运行时：
  Host 先加载 → 把自己的 React 18.2.0 注册到 share scope
  Remote A 加载 → 协商：scope 里有满足 ^18.0.0 的 React？→ 有 → 用 Host 的
  Remote B 加载 → 同上 → 也用 Host 的

  结果：Remote A/B 的 vendors-react.chunk.js 永远不会被请求下载
```

**协商的底层机制**：

```js
// 每个应用启动时，把自己的 shared 依赖注册到全局 share scope
__webpack_share_scopes__.default = {
  'react': {
    '18.2.0': { get: () => import('./vendors-react.chunk.js'), from: 'host' },
    '18.3.0': { get: () => import('./vendors-react.chunk.js'), from: 'remoteA' },
  }
}

// Remote 需要 React 时的协商逻辑（简化）：
function resolveShared(packageName, requiredVersion) {
  const versions = __webpack_share_scopes__.default[packageName]
  
  // 1. singleton: true → 全局只能有一个实例
  //    找 scope 里已经被加载的那个版本 → 直接用（不管版本号）
  //    如果没加载过 → 找满足 requiredVersion 的最高版本
  
  // 2. 找到满足 semver 范围的版本
  for (const [version, entry] of Object.entries(versions)) {
    if (semver.satisfies(version, requiredVersion)) {
      return entry.get()  // 加载那份（可能是 Host 的 chunk URL）
    }
  }
  
  // 3. 都不满足 → fallback 加载自己打包的那份
  return import('./my-own-vendors-react.chunk.js')
}
```

**协商规则速记**：

| 配置 | 含义 |
|------|------|
| `singleton: true` | 全局只允许一个实例（先到先得，后来的复用已有的） |
| `requiredVersion: '^18.0.0'` | 版本约束（scope 里的版本必须满足这个范围才用） |
| `eager: true` | 不懒加载，打进主 bundle（少用，会失去按需加载优势） |
| `strictVersion: true` | 版本不满足直接报错（而不是 fallback 用自己的） |

**vs externals + CDN**：

| | externals + CDN | MF shared |
|--|--|--|
| 决策时机 | 编译时写死 | 运行时协商 |
| 版本灵活性 | 全局锁死一个版本 | 版本不兼容时可 fallback 自己的 |
| 独立运行 | CDN 挂了就完了 | 没有 Host 时用自己打包的（自愈） |

**效果**：所有 Remote 共用一份 React + Router + 状态库 → 包体极小（Remote 只含业务代码）。

### 通信方案

```
MF 场景下不需要 EventBus / postMessage：
  → 所有 Remote 共享同一个 React 实例 + 同一个状态库实例
  → 通信 = 正常的 React 数据流（Context / Zustand / Props）
  → 就像同一个应用内的组件通信，零额外成本
```

| 通信需求 | 做法 |
|---------|------|
| 全局状态（用户信息/主题） | Zustand store（shared singleton） |
| 路由跳转 | 共享的 react-router 实例 navigate() |
| 事件通知 | Zustand subscribe / React Context |

### 独立开发与部署

**一次构建，双模式运行（底层原理）**：

```
webpack build（配了 MF 插件）一次构建产出：

dist/
├── index.html            ← 独立运行入口
├── main.js               ← 应用自身 bundle（含 React 等依赖的 chunk）
├── remoteEntry.js        ← MF 容器入口（暴露模块 + shared 协商逻辑）
├── src_App_js.chunk.js   ← 按 expose 拆分的业务 chunk
└── vendors-react.chunk.js ← React 依赖（独立 chunk）

独立运行时（浏览器访问 index.html）：
  → 加载 main.js → 需要 React → shared 协商：有没有外部提供？
  → 没有（没人 init 过 share scope）→ 加载自己的 vendors-react.chunk.js
  → 正常 SPA 运行

被 Host 消费时（Host import('remote/App')）：
  → Host 加载 remoteEntry.js → 调 container.init(hostShareScope)
  → Remote 的 shared 协商：Host 已经提供了 React 18？满足我的 requiredVersion？
  → 满足 → 跳过自己的 vendors-react.chunk.js，用 Host 的
  → 只加载业务 chunk（src_App_js.chunk.js）
```

**shared 协商的底层实现**：

```js
// 简化版：每个 shared 依赖都被包装成一个"懒加载工厂"
__webpack_modules__['react'] = async () => {
  // 1. 先看 share scope 里有没有别人提供的 React
  const provided = __webpack_share_scopes__.default['react'];
  if (provided && satisfies(provided.version, '^18.0.0')) {
    return provided.get();  // 用别人的（Host 提供的）
  }
  // 2. 没有 → 加载自己打包的那份
  return import('./vendors-react.chunk.js');
}

// 效果：同一份代码，运行时根据环境自动决定用谁的依赖
// 独立运行 → 没人 init share scope → 永远走 fallback（自己的）
// 被 Host 消费 → Host init 了 share scope → 优先用 Host 的
```

**一句话**：不是构建两份，是一次构建把依赖包装成"有则复用、无则自带"的懒加载工厂。运行时 shared 协商决定加载谁的。

```
开发时：
  每个 Remote 独立 dev server（可独立运行完整页面）
  Host 的 remotes 配置指向各 Remote 的 dev server

部署时：
  每个 Remote 独立 CI/CD → 产物推 CDN
  Host 的 remotes 配置指向 CDN 地址
  Remote 更新 → Host 不用重新构建（运行时加载最新 remoteEntry.js）

版本管理：
  remoteEntry.js 不带 hash（永远最新）
  chunk 文件带 hash（长缓存）
  = Remote 发布后用户刷新页面即生效
```

### 错误隔离（降级）

```tsx
// 每个远程模块用 ErrorBoundary + Suspense 包裹
// ErrorBoundary 是 React 概念，需自己实现（class 组件）或用 react-error-boundary 库
// 目前 Hooks 没有对应 API，这是少数还必须用 class 的场景
function RemoteWrapper({ children }) {
  return (
    <ErrorBoundary fallback={<FallbackUI />}>
      <Suspense fallback={<Skeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

// 路由里
{ path: '/dashboard/*', element: <RemoteWrapper><DashboardApp /></RemoteWrapper> }

// 效果：某个 Remote CDN 挂了 → 只有那个模块降级，其他正常
```

### 完整架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Host（主应用）                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Layout（Header + Sidebar + Container）             │ │
│  │                                                     │ │
│  │  React Router:                                      │ │
│  │    /dashboard/* → lazy(import('dashboardRemote'))   │ │
│  │    /activity/*  → lazy(import('activityRemote'))    │ │
│  │    /settings/*  → lazy(import('settingsRemote'))    │ │
│  │                                                     │ │
│  │  Shared: React + Router + Zustand（singleton）      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  各 Remote 独立部署在 CDN：                              │
│    dashboardRemote → cdn.example.com/dashboard/          │
│    activityRemote  → cdn.example.com/activity/           │
│    settingsRemote  → cdn.example.com/settings/           │
└─────────────────────────────────────────────────────────┘

隔离保障：
  JS：不需要（同一个 React 实例，无全局变量冲突）
  CSS：CSS Modules（hash 类名） + CI 禁止全局样式
  错误：ErrorBoundary per Remote（局部降级）
  部署：各自独立 CI/CD，互不阻塞
```

### 面试一句话

> "MF 做微前端不靠沙箱隔离，靠的是同构信任 + 约定卡控。CSS Modules 解决样式冲突，shared singleton 解决依赖共享，ErrorBoundary 解决错误隔离，React Router 管路由分发。本质是把'多个独立部署的应用'在运行时合并成'一个 React 应用的多个懒加载路由'。"

---

## Monorepo + MF（业界最佳实践）

> Monorepo 管开发时统一治理，MF 管运行时独立部署 + 模块共享。

### 为什么这个组合好

```
Monorepo 解决：
  - 统一 Lint/TS/构建配置 → ESLint 规则一处配所有 Remote 共享（硬卡控统一）
  - 共享代码直接 import（types/utils/components）→ 不用发 npm 包
  - 原子提交（改 shared 组件 + 改消费方 → 一个 PR）
  - 统一 CI pipeline → 所有 Remote 必须过同一套门禁

MF 解决：
  - 独立部署（各 app 各自构建/各自推 CDN）
  - 运行时共享依赖（不重复打包 React）
  - Remote 更新不需要重新构建 Host
```

### vs 多 Repo + MF

| | Monorepo + MF | 多 Repo + MF |
|--|--|--|
| Lint 规则统一 | ✅ 一处配置所有 app 共享 | ❌ 各 repo 各配，容易漂移 |
| 类型共享 | ✅ 直接 `import type` from workspace | ❌ 需发 @types 包或 MF 2.0 类型同步 |
| CI 门禁 | ✅ 统一 pipeline | ❌ 各 repo 各自维护 |
| 代码复用 | ✅ packages/shared 直接引 | ❌ 发 npm 包，升级痛苦 |
| 独立部署 | ✅ 各 app 各自 build + deploy | ✅ 同 |

### 项目结构

```
monorepo/
├── packages/
│   ├── host/          # 主应用（路由壳 + Layout）
│   ├── dashboard/     # Remote：数据大盘
│   ├── activity/      # Remote：活动管理
│   └── settings/      # Remote：系统设置
├── shared/
│   ├── ui/            # 共享组件（Button/Table/Modal）
│   ├── utils/         # 工具函数
│   └── types/         # TS 类型定义
├── .eslintrc.cjs      # 统一 Lint（全 repo 共享 = 唯一硬卡控）
├── pnpm-workspace.yaml
└── turbo.json         # Turborepo 构建编排
```

### 为什么 Monorepo 是 MF 隔离问题的答案

```
MF 唯一的硬检查 = ESLint 静态分析
Monorepo 保证 = 所有 Remote 共享同一份 ESLint 配置

多 Repo 的风险：
  Remote A 配了 no-restricted-globals ✅
  Remote B 忘了配 / 关了规则 ❌ → 全局变量污染
  
Monorepo 没有这个风险：
  根目录 .eslintrc.cjs 一份配置 → 所有 apps/* 强制继承 → 不可能漂移
```

### 面试一句话

> "Monorepo + MF = 开发时统一治理（Lint/Types/CI 一份配置），运行时独立部署（各 Remote 各自 CDN）。Monorepo 保证规范不漂移，MF 保证部署不耦合。"

### MF 使用快速指南（Host + Remote 怎么配）

**1. Remote（子应用）— 暴露模块**

```js
// apps/dashboard/webpack.config.js
new ModuleFederationPlugin({
  name: 'dashboard',                    // 容器名（全局唯一）
  filename: 'remoteEntry.js',           // 产出的 MF 入口文件名
  exposes: {
    './App': './src/App',               // 暴露给 Host 的模块
    './Chart': './src/components/Chart',
  },
  shared: {
    react: { singleton: true, requiredVersion: '^18.0.0' },
    'react-dom': { singleton: true },
  },
})
```

**构建产物（一次 build 产出）**：

```
dist/
├── index.html              ← 独立运行入口（浏览器直接访问用）
├── main.[hash].js          ← 应用启动代码（路由/挂载 #app）
├── remoteEntry.js          ← MF 入口（给 Host 用，无 hash，永远最新）
├── src_App.[hash].js       ← 业务 chunk（按 exposes 拆分）
├── src_Chart.[hash].js     ← 业务 chunk
├── vendors-react.[hash].js ← 依赖 chunk（shared fallback）
└── assets/                 ← 静态资源

两种模式用不同入口，同一份产物：
  独立运行：index.html → main.js → 加载所有 chunk（含 vendors）
  被 Host 消费：remoteEntry.js → shared 协商 → 只加载业务 chunk（依赖用 Host 的）
```

```
部署到：https://cdn.example.com/dashboard/
```

**2. Host（主应用）— 声明远程地址**

```js
// apps/host/webpack.config.js
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    dashboard: 'dashboard@https://cdn.example.com/dashboard/remoteEntry.js',
    activity: 'activity@https://cdn.example.com/activity/remoteEntry.js',
  },
  shared: {
    react: { singleton: true, requiredVersion: '^18.0.0' },
    'react-dom': { singleton: true },
  },
})
```

**3. Host 代码使用 — 和本地 import 一样**

```tsx
// apps/host/src/routes.tsx
// MF 本身和框架无关，只是让 import() 能加载远程模块
// 下面用 React 举例，Vue 用 defineAsyncComponent 同理
const DashboardApp = lazy(() => import('dashboard/App'))

<ErrorBoundary fallback={<Fallback />}>
  <Suspense fallback={<Skeleton />}>
    <DashboardApp />
  </Suspense>
</ErrorBoundary>

// 本质：import('dashboard/App') 返回 Promise<模块>
// MF 负责让这个 import 路由到远程 CDN 的 chunk
// 拿到模块后怎么渲染 = 框架的事（React.lazy / Vue defineAsyncComponent / 原生 await）
```

**4. 开发 / 部署**

```bash
# 开发：Remote 独立跑 dev server，Host 的 remotes 指向 localhost
# 部署：各自 build + 推 CDN，互不阻塞
# Remote 更新：Host 不用重新构建，用户刷新即加载最新版
```

**总结**：Remote 配 `exposes`（暴露什么），Host 配 `remotes`（从哪加载），两边都配 `shared`（共享什么）。代码里 `import('remote/Module')` 和本地懒加载无区别。

---
