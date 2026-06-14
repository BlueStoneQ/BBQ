# QuickApp Compiler Toolchain — 从 .ux 到 .rpk 的编译全链路

> 本质：一个基于 webpack 的编译打包系统。输入是类 Vue 单文件组件（.ux），输出是一个带签名的 zip 包（.rpk），中间经历"解析 → 编译 → 打包 → 签名"四个阶段。

---

## 目录

- [1. 第一性原理：这件事的本质是什么](#1-第一性原理这件事的本质是什么)
- [2. Monorepo 结构](#2-monorepo-结构)
- [3. 一个例子驱动全流程](#3-一个例子驱动全流程)
- [4. 阶段一：解析（Parse）](#4-阶段一解析parse)
- [5. 阶段二：编译（Compile）](#5-阶段二编译compile)
- [6. 阶段三：打包（Pack）](#6-阶段三打包pack)
- [7. 阶段四：签名（Sign）](#7-阶段四签名sign)
- [8. Webpack 配置是怎么组装的](#8-webpack-配置是怎么组装的)
- [9. 关键依赖库](#9-关键依赖库)
- [10. 对自建动态渲染框架的启示](#10-对自建动态渲染框架的启示)

---

## 1. 第一性原理：这件事的本质是什么

跨端框架的编译器本质上在做一件事：

> **把人类可读的声明式 UI 描述，转换为运行时引擎可高效执行的数据结构。**

具体到快应用：
- 人类可读 = `.ux` 文件（template + style + script，类 Vue SFC）
- 引擎可执行 = JS Bundle（包含 JSON 化的模板树 + CSS JSON 对象 + 组件逻辑代码）
- 分发载体 = `.rpk`（zip 包 = JS Bundle + 静态资源 + manifest + 签名）

编译器不做"运行时渲染"，它的目标是：**让运行时少做事**。模板在编译期就转成了 JSON 树结构，运行时只需要遍历 JSON 创建 VDom 节点，不需要再解析 HTML。

---

## 2. Monorepo 结构

```
extra/hap-toolkit/                   ← 根项目（lerna + yarn workspaces）
├── packages/
│   ├── hap-toolkit/                 ← CLI 入口（hap build / hap release）
│   │   └── src/gen-webpack-conf/    ← 动态生成 webpack 配置
│   ├── hap-compiler/                ← 核心编译器（template/style/script 解析）
│   ├── hap-dsl-xvm/                 ← DSL 层 webpack loader 集合
│   ├── hap-packager/                ← 打包 + 签名 + 分包
│   ├── hap-server/                  ← 开发调试服务器
│   ├── hap-debugger/                ← 调试器
│   └── hap-shared-utils/            ← 公共工具
└── examples/sample/                 ← 示例项目
```

各包的关系：

```
hap-toolkit（CLI 入口）
  ├── 生成 webpack config
  ├── 注册 hap-dsl-xvm 的 loaders（ux-loader、template-loader、style-loader...）
  ├── 注册 hap-packager 的 plugins（ZipPlugin、签名、分包...）
  └── 调用 webpack 执行编译

hap-dsl-xvm（webpack loaders）
  └── 依赖 hap-compiler（纯函数解析器）

hap-packager（webpack plugins）
  └── webpack 编译完成后，将 build 产物打包为 .rpk
```

---

## 3. 一个例子驱动全流程

假设我们有一个最简单的页面 `src/home/index.ux`：

```html
<template>
  <div class="container">
    <text>Hello {{name}}</text>
    <input type="button" value="Click" onclick="handleClick" />
  </div>
</template>

<style>
.container {
  flex-direction: column;
  padding: 20px;
}
</style>

<script>
export default {
  data: { name: 'QuickApp' },
  handleClick() {
    this.name = 'World'
  }
}
</script>
```

**整体编译流程**：

```
┌─────────────────────────────────────────────────────────────────┐
│ 输入: src/home/index.ux (类 Vue SFC 文件)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
  ┌────────────────────────▼────────────────────────────────────┐
  │ 阶段一: Parse（parse5 解析 .ux → fragments）                 │
  │                                                              │
  │ .ux 源码 → parse5.parseFragment()                            │
  │ → frags = { template: [...], style: [...], script: [...] }   │
  └────────────────────────┬─────────────────────────────────────┘
                           │
  ┌────────────────────────▼─────────────────────────────────────┐
  │ 阶段二: Compile（各 fragment 分别编译）                       │
  │                                                              │
  │ template → parse5 → traverse → JSON Template Tree            │
  │ style    → css.parse() → JSON Style Object                   │
  │ script   → 原样保留（babel 转译 ES6+）                        │
  │                                                              │
  │ 三者组装为一个 JS Module（$app_define$ 格式）                  │
  └────────────────────────┬─────────────────────────────────────┘
                           │
  ┌────────────────────────▼─────────────────────────────────────┐
  │ 阶段三: Pack（webpack bundling）                              │
  │                                                              │
  │ webpack 将所有页面 JS Module → 各页面独立 chunk               │
  │ + app.js（应用入口）                                          │
  │ + manifest.json（应用清单）                                   │
  │ + 静态资源（图片/字体）                                       │
  │ 输出到 build/ 目录                                            │
  └────────────────────────┬─────────────────────────────────────┘
                           │
  ┌────────────────────────▼─────────────────────────────────────┐
  │ 阶段四: Sign & Zip（ZipPlugin）                               │
  │                                                              │
  │ build/ 目录下的文件 → JSZip 压缩 → RSA 签名 → .rpk 文件      │
  └────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ 输出: dist/org.hapjs.demo.sample.debug.rpk                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 阶段一：解析（Parse）

**入口**：`hap-compiler/src/index.js` → `parseFragmentsWithCache(source, filePath)`

**做了什么**：用 parse5 把 .ux 文件当作 HTML Fragment 解析，按顶层标签名分类。

```javascript
// parse5 解析后得到 childNodes
fragment.childNodes.forEach(node => {
  // node.nodeName = 'template' | 'style' | 'script' | 'import' | 'data'
  frags[node.nodeName].push(formatFragment(source, node))
})
```

**输出结构**：
```javascript
frags = {
  import: [],        // <import> 导入的自定义组件
  template: [{       // <template> 模板内容
    type: 'template',
    content: '<div class="container">...',
    attrs: {},
    location: { start, end, line, column }
  }],
  style: [{          // <style> 样式内容
    type: 'style',
    content: '.container { flex-direction: column; ... }',
    attrs: { lang: 'less' }   // 可选预处理器
  }],
  script: [{         // <script> 脚本内容
    type: 'script',
    content: 'export default { data: {...} }'
  }],
  data: []           // <data>（卡片专用）
}
```

---

## 5. 阶段二：编译（Compile）

### 5.1 Template 编译

**入口**：`hap-compiler/src/template/index.js` → `parse(source, options)`

**流程**：
1. 再次用 parse5 将 template 内容解析为 AST 树
2. `traverse()` 递归遍历每个节点
3. 验证标签名、属性、事件、指令（if/for/model/dir:）
4. 生成 JSON Template Tree

**输出示例**（对应上面的 .ux）：
```json
{
  "type": "div",
  "attr": {},
  "classList": ["container"],
  "children": [
    {
      "type": "text",
      "attr": {
        "value": "Hello {{name}}"    // 运行时解析 mustache 表达式
      }
    },
    {
      "type": "input",
      "attr": {
        "type": "button",
        "value": "Click"
      },
      "events": {
        "click": "handleClick"
      }
    }
  ]
}
```

**关键设计**：模板不是编译成"渲染函数"（像 Vue3 那样），而是编译成 JSON 数据。运行时 DSL 层的 `compiler.js` 再遍历这个 JSON 创建 VDom 节点。这是一种**数据驱动**的方式，好处是序列化友好、可缓存。

### 5.2 Style 编译

**入口**：`hap-compiler/src/style/index.js` → `parseStyle(source)`

**流程**：
1. 用 `css` 库解析 CSS 为 AST
2. 遍历规则，验证属性名/值的合法性（快应用只支持 CSS 子集）
3. 处理 @media 查询
4. 输出 JSON Style Object

**输出示例**：
```json
{
  ".container": {
    "flexDirection": "column",
    "padding": "20px"
  }
}
```

注意：属性名从 kebab-case 转为 camelCase，因为 Native 端用的是 Java 属性赋值。

### 5.3 Script 编译

script 部分基本原样保留，通过 `babel-loader` 做 ES6+ → ES5 转译。开发者的业务逻辑代码在运行时执行。

### 5.4 组装 — ux-loader

**入口**：`hap-dsl-xvm/src/loaders/ux-loader.js` → `assemble()`

ux-loader 把三个 fragment 的编译结果组装成一个完整的 JS Module：

```javascript
// 编译产物（简化）
var $app_script$ = require('./script-loader!./index.ux?script')

$app_define$('@app-component/home', [], function($app_require$, $app_exports$, $app_module$) {
  // script
  $app_script$($app_module$, $app_exports$, $app_require$)
  if ($app_exports$.__esModule && $app_exports$.default) {
    $app_module$.exports = $app_exports$.default
  }
  // template (JSON)
  $app_module$.exports.template = require('./template-loader!./index.ux?template')
  // style (JSON)
  $app_module$.exports.style = require('./style-loader!./index.ux?style')
})

$app_bootstrap$('@app-component/home', { packagerVersion: "2.0.6" })
```

**`$app_define$` 和 `$app_bootstrap$` 是运行时的全局函数**，由 JS Framework 提供。编译器只是生成调用代码。

---

## 6. 阶段三：打包（Pack）

**入口**：`hap-toolkit/src/gen-webpack-conf/index.js` → `genWebpackConf()`

这一步就是标准的 webpack 打包流程：

1. **读取 manifest.json** → 解析路由表，确定有哪些页面
2. **生成 entry**：每个页面对应一个 webpack entry
3. **Loader pipeline**：`.ux` → ux-loader → template-loader / style-loader / script-loader
4. **Plugin pipeline**：ZipPlugin、ResourcePlugin、SplitChunksPlugin...
5. **输出**：`build/` 目录，结构如下：

```
build/
├── manifest.json          ← 应用清单（路由、权限、Feature 声明）
├── app.js                 ← 应用入口（$app_define$ app 组件）
├── home/index.js          ← 首页 JS（$app_define$ + $app_bootstrap$）
├── component/basic/text/index.js
├── common/logo.png        ← 静态资源
└── ...
```

---

## 7. 阶段四：签名（Sign）

**入口**：`hap-packager/src/plugins/zip-plugin.js` → `ZipPlugin`

webpack 编译完成后（`compiler.hooks.done`），ZipPlugin 执行：

1. **遍历 build/ 目录**所有文件
2. **按优先级排序**（manifest.json 和 app.js 优先，支持流式加载）
3. **创建分包定义**（如果配置了 subpackages）
4. **分配文件到各个 package**
5. **JSZip 压缩**成 zip buffer
6. **RSA 签名**（jsrsasign 库，读取 sign/ 目录下的 PEM 证书）
7. **写入磁盘**：`dist/包名.签名模式.rpk`

**签名模式**：
- `debug`：使用内置或项目的 debug 证书
- `release`：使用开发者的 release 证书
- `null`：不签名

**rpk 内部结构**（本质就是 zip）：
```
sample.debug.rpk (zip)
├── manifest.json
├── app.js
├── home/index.js
├── common/logo.png
├── META-INF/
│   ├── CERT.SF       ← 签名摘要
│   └── CERT.RSA      ← 签名证书
└── ...
```

---

## 8. Webpack 配置是怎么组装的

`genWebpackConf()` 动态生成 webpack 配置，核心逻辑：

```
1. 读取 manifest.json → 解析 router.pages → 生成 entry 对象
2. 配置 module.rules:
   - .ux/.mix → ux-loader（入口 loader，分发到子 loader）
   - 图片/字体 → asset module
   - .sass/.less → 对应 loader
3. 配置 plugins:
   - DefinePlugin（注入环境变量）
   - ZipPlugin（打包签名）
   - ManifestWatchPlugin（监听 manifest 变更）
4. 调用各模块的 postHook 扩展配置:
   - packagerPostHook → 注册 ZipPlugin、ResourcePlugin
   - xvmPostHook → 注册 .ux 的 loader 规则
5. 返回完整的 webpack config
```

**Loader 调用链**（一个 .ux 文件经历的 loader）：

```
index.ux
  → ux-loader（解析 fragments，组装 JS module 代码）
     ├── template fragment → template-loader → hap-compiler.parseTemplate()
     ├── style fragment    → style-loader    → hap-compiler.parseStyle()
     └── script fragment   → script-loader   → babel-loader
```

---

## 9. 关键依赖库 — 落地选型参考

> 原则：**parser 不要自己写**。词法分析 + 语法分析的工程量和边界情况处理量巨大，没有必要重复造轮子。核心价值在 AST 之后的 transform 和 codegen 环节。

### 9.1 快应用实际使用的库

| 层级 | 库 | 版本 | 做什么 | 自己写了什么 |
|------|------|------|--------|-------------|
| HTML/模板解析 | **parse5** | ^3.0.3 | .ux 拆 fragment + template 生成 AST | traverse() 遍历 + validator 校验 + JSON 转换 |
| CSS 解析 | **css** (reworkcss) | ^2.2.4 | CSS 源码 → AST（rules/declarations） | 属性白名单校验 + kebab→camelCase + 输出 JSON |
| CSS 选择器解析 | **css-what** | ^2.1.3 | 解析选择器字符串 | 无 |
| JS 转译 | **@babel/core** + preset-env | ^7.9 | ES6+ → ES5，JSX 支持 | 无（标准 babel pipeline） |
| JS AST 操作 | **@babel/parser** + **@babel/traverse** + **@babel/types** | ^7.9 | 分析 JS 代码结构（packager 层用） | 按需遍历和改写 |
| 模块打包 | **webpack** | 5.72.0 | 依赖图、code splitting、loader/plugin 机制 | 自定义 loader + plugin |
| ZIP 压缩 | **jszip** | ^3.4.0 | 生成 zip buffer | 流式排序策略 |
| 签名 | **jsrsasign** | ^7.2.2 | RSA 签名 + 证书处理 | 签名协议实现 |
| CSS 预处理 | **less** / **sass** | 3.11 / 1.32 | less/scss → css | 无（标准 loader） |
| JS 压缩 | **terser** | via terser-webpack-plugin | 生产环境代码压缩 | 无 |
| 文件工具 | **fs-extra** | ^10.0 | 文件读写、目录操作 | 无 |
| 路径处理 | **@jayfate/path** | ^0.0.13 | 跨平台路径处理 | 无 |

### 9.2 如果自建动态渲染框架，选型建议

根据你的场景（大前端架构，做动态渲染），以下是按编译阶段的选型建议：

#### 模板解析（Template Parser）

| 选项 | 特点 | 适用场景 |
|------|------|---------|
| **parse5** | W3C HTML 规范完整实现，容错性好 | 兼容标准 HTML 语法 |
| **htmlparser2** | 更快、更轻量，SAX 模式 | 性能敏感、不需要完整 DOM 树 |
| **@vue/compiler-core** | Vue3 自带编译器，支持指令/slot/v-for | 如果 DSL 接近 Vue |
| **自定义 DSL → Chevrotain / nearley** | 通用 parser generator | 如果 DSL 和 HTML 差异大 |

**推荐**：如果 DSL 是类 HTML/Vue，直接用 **parse5** 或 **htmlparser2**；如果要设计全新 DSL 语法，用 **Chevrotain**（TS 友好，性能好，错误恢复强）。

#### CSS 解析

| 选项 | 特点 | 适用场景 |
|------|------|---------|
| **css** (reworkcss) | 简单直接，输出标准 AST | 只需要解析标准 CSS 子集 |
| **postcss** | 生态强大，插件丰富 | 需要做 CSS 转换（autoprefixer、tailwind） |
| **lightningcss** (Rust) | 极快，类型安全 | 性能要求高，可接受 native addon |
| **stylis** | 超轻量，CSS-in-JS 场景 | 运行时 CSS 解析 |

**推荐**：如果编译期用，选 **postcss**（生态 + 插件）；如果运行时需要解析 CSS 字符串，选 **stylis**（轻量）。

#### JS 处理

| 选项 | 特点 | 适用场景 |
|------|------|---------|
| **@babel/core** | 成熟生态，插件海量 | 需要做各种语法转换 |
| **swc** (Rust) | 比 babel 快 20x+ | 性能敏感，不需要太多自定义插件 |
| **esbuild** (Go) | 极快的打包 + 转译 | 简单转译场景，不需要细粒度 AST 操作 |

**推荐**：如果需要自定义 babel plugin 做代码注入/改写，用 **babel**；纯转译用 **swc** 或 **esbuild**。

#### 打包

| 选项 | 特点 | 适用场景 |
|------|------|---------|
| **webpack 5** | loader/plugin 机制成熟，处理自定义文件格式强 | 需要自定义 .ux 类文件 |
| **Rollup** | tree-shaking 优秀，输出干净 | 库打包、不需要复杂 loader |
| **esbuild** | 极快，适合简单场景 | 无需自定义文件格式处理 |
| **Vite (Rollup + esbuild)** | 开发体验好，HMR 快 | 如果有 dev server 需求 |

**推荐**：如果你的框架有自定义文件格式（类似 .ux / .vue SFC），**webpack** 的 loader 机制仍然是最灵活的；如果只是 JS/TS，用 **esbuild** 或 **Rollup**。

#### 签名 & 压缩

| 选项 | 特点 |
|------|------|
| **jszip** | 纯 JS，浏览器和 Node 都能用 |
| **archiver** | Node 专用，流式 API，适合大文件 |
| **node:crypto** | Node 内置，RSA/ECDSA 签名 |
| **jose** | JWT/JWE/JWS 标准实现 |

### 9.3 一个最小可行技术栈示例

如果从零开始搭一个类似的编译工具链：

```
自定义 SFC 文件 (.xyz)
  │
  ├─ 整体解析: parse5 或 htmlparser2 (拆 template/style/script)
  │
  ├─ template: parse5 → 自己写 traverse → 输出 JSON/IR
  ├─ style:    postcss → 自己写 plugin 做白名单 + 转 JSON
  ├─ script:   swc 转译 (快) 或 babel (灵活)
  │
  ├─ 打包: webpack 5 (自定义 loader 处理 .xyz 文件)
  │         或 Vite plugin (如果生态在浏览器侧)
  │
  └─ 产物: jszip 压缩 + node:crypto 签名 → .bundle 包
```

**工作量估算**：
- Parser 选型 + 集成：**0 人日**（直接 npm install）
- AST → JSON Transform（自己写）：**3-5 人日**
- Webpack loader/plugin：**3-5 人日**
- 签名打包：**2-3 人日**
- **总计约 2 周** 可以跑通一个最小编译链路

对比如果自己写 parser：仅 HTML parser 就需要处理自闭合标签、属性引号、注释、CDATA、错误恢复等上百种 edge case，保守估计 **2-3 个月**。完全没必要。

---

## 10. 对自建动态渲染框架的启示

从这套编译工具链中可以提取的设计模式：

### 10.1 SFC → Fragment → 独立编译

将单文件组件拆成独立 fragment 分别编译，每个 fragment 有自己的 loader pipeline。好处：
- 可以独立缓存（webpack cache）
- 可以并行处理
- 可以按需引入预处理器（less/sass 只对 style fragment 生效）

### 10.2 模板编译为 JSON 而非渲染函数

快应用选择了"模板 → JSON 树"而非"模板 → render function"。这是一个关键的设计取舍：
- **JSON 树**：序列化友好、可网络传输、可增量更新、运行时遍历简单
- **Render Function**：执行效率更高、可以做更多编译期优化（如 Vue3 的静态提升）

如果你的动态渲染框架需要**远程下发模板**（服务端驱动 UI），JSON 树是更好的选择。

### 10.3 $app_define$ / $app_bootstrap$ 协议

编译产物不是直接执行代码，而是调用运行时预定义的全局函数。这定义了**编译器和运行时之间的契约**：
- `$app_define$(name, deps, factory)` — 注册组件定义
- `$app_bootstrap$(name, options)` — 启动渲染

这种设计让编译器和运行时可以独立演进，只要契约不变。

### 10.4 流式加载友好的打包策略

ZipPlugin 按优先级排序文件（manifest → app.js → 页面 JS），支持运行时流式解压：引擎可以在 zip 还没完全下载时就开始解析 manifest 和执行 app.js。

### 10.5 Webpack 作为编译骨架

虽然 webpack 本身很重，但它提供了：
- 成熟的 loader/plugin 机制
- 依赖图分析
- splitChunks 代码分割
- 文件缓存
- HMR（开发时热更新）

如果自建框架，可以考虑用更轻量的方案（如 Rollup / esbuild），但 webpack 的 loader 机制确实适合处理"自定义文件格式"这种场景。
