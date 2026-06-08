# 快应用构建打包方案

## 一、构建结果

### 产物格式

快应用构建的最终产物是 `.rpk`（单包）或 `.rpks`（分包）文件，本质上是一个 **ZIP 压缩包 + 数字签名**。

### rpk 包内部结构

```
my-app.rpk (ZIP 格式)
├── manifest.json          # 应用清单（路由、权限、配置）
├── app.js                 # 应用入口（编译后的 JS）
├── pages/
│   ├── index/
│   │   ├── index.js       # 页面逻辑（编译后）
│   │   └── index.css.json # 页面样式（编译后的 JSON 格式）
│   └── detail/
│       ├── detail.js
│       └── detail.css.json
├── common/                # 公共资源（图片等）
├── i18n/                  # 国际化文件
└── META-INF/              # 签名信息
    ├── CERT.SF
    └── CERT.RSA
```

### 卡片 rpks 包内部结构

```
my-card.rpks (ZIP 格式)
├── manifest.json
├── widgets/
│   └── card4x2/
│       ├── index.js       # 卡片逻辑
│       └── index.css.json # 卡片样式
├── common/
└── META-INF/
```

### 关键特征

- `.ux` 文件被编译为 `.js`（逻辑）+ `.css.json`（样式）
- 模板（template）被编译为 JS 中的虚拟 DOM 创建函数
- 样式不是标准 CSS，而是 JSON 格式（供快应用运行时解析）
- 签名使用 RSA + SHA-256

---

## 二、构建工具链

### 核心工具：hap-toolkit

- **仓库**：https://github.com/hapjs-platform/hap-toolkit
- **本地路径**：`/home/mi/disk/qiaoyang/code/quick-app-aliance/hap-toolkit/`
- **CLI 命令**：`hap build` / `hap release` / `hap server`
- **架构**：monorepo（lerna），包含多个子包

### 子包职责

| 子包 | 职责 |
|------|------|
| `@hap-toolkit/compiler` | UX 文件编译器：解析 template/script/style 三段式 |
| `@hap-toolkit/dsl-xvm` | DSL 层：将 UX 模板编译为 JS 渲染函数 |
| `@hap-toolkit/packager` | 打包器：webpack 配置、rpk/rpks 生成、签名 |
| `@hap-toolkit/server` | 开发服务器：热更新、WebSocket 推送 |
| `@hap-toolkit/debugger` | 调试器：与手机端调试器通信 |
| `hap-toolkit` | CLI 入口：commander 命令注册 |

### 技术栈

| 层面 | 技术 |
|------|------|
| 模块打包 | Webpack 4/5 |
| JS 编译 | Babel（@babel/core + preset-env） |
| 模板编译 | 自研 template compiler（类 Vue 编译器） |
| 样式编译 | 自研 style compiler（CSS → JSON） |
| 签名 | Node.js crypto（RSA + SHA-256） |
| CLI | Commander.js |
| 开发服务器 | Express + WebSocket |

---

## 三、构建流程详解

### 整体流程

```
源码 (.ux 文件)
       │
       ▼
┌─────────────────────────────────────┐
│  1. UX 文件解析（hap-compiler）       │
│     拆分为 template / script / style │
└──────────────────┬──────────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ template │ │  script  │ │  style   │
│ compiler │ │  babel   │ │ compiler │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     ▼            ▼            ▼
  渲染函数JS    业务逻辑JS    样式JSON
       │           │           │
       └───────────┼───────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Webpack 打包（hap-packager）      │
│     合并 JS + 资源 → bundle          │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. RPK 生成                         │
│     ZIP 压缩 + 数字签名              │
└──────────────────┬──────────────────┘
                   │
                   ▼
              my-app.rpk
```

### 阶段 1：UX 文件编译

UX 文件是类 Vue 的单文件组件格式：

```html
<template>
  <div><text>{{ msg }}</text></div>
</template>
<script>
  export default { data: { msg: 'hello' } }
</script>
<style>
  .container { width: 100%; }
</style>
```

编译器将其拆分为三部分分别处理：

**template → JS 渲染函数**：
```javascript
// 编译后
function render() {
  return createElement('div', {}, [
    createElement('text', {}, [this.msg])
  ])
}
```

**script → Babel 转译**：
```javascript
// ES6+ → ES5，兼容快应用运行时的 V8 版本
export default { data: { msg: 'hello' } }
```

**style → CSS JSON**：
```json
{
  ".container": { "width": "100%" }
}
```

### 阶段 2：Webpack 打包

hap-packager 配置 Webpack：
- **entry**：每个页面/卡片一个入口
- **output**：每个页面生成独立的 JS bundle
- **loaders**：自定义 loader 处理 .ux 文件
- **plugins**：资源收集、manifest 处理、分包

关键 Webpack loader 链：

```
.ux 文件 → ux-loader（拆分三段）
         → template-loader（模板编译）
         → script-loader（Babel 转译）
         → style-loader（样式编译为 JSON）
```

### 阶段 3：RPK 打包与签名

1. 将 Webpack 输出的 bundle + 资源文件组织为目录结构
2. ZIP 压缩为 .rpk 文件
3. 使用开发者证书对 rpk 进行 RSA 签名
4. 签名信息写入 META-INF/ 目录

签名流程：
```
遍历 rpk 中所有文件
       │
       ▼
计算每个文件的 SHA-256 摘要 → MANIFEST.MF
       │
       ▼
对 MANIFEST.MF 签名 → CERT.SF
       │
       ▼
RSA 私钥加密 → CERT.RSA
```

---

## 四、build vs release 的区别

| 对比项 | `hap build` | `hap release` |
|--------|-------------|---------------|
| 用途 | 开发调试 | 正式发布 |
| 代码压缩 | 不压缩 | UglifyJS 压缩 |
| Source Map | 生成 | 不生成 |
| 签名 | 开发证书（自动生成） | 正式证书（需手动配置） |
| 产物目录 | `build/` | `dist/` |

---

## 五、开发模式（hap server）

```bash
hap server --watch
```

启动开发服务器后：
1. 启动 Webpack watch 模式，监听文件变更
2. 启动 Express HTTP 服务，提供编译产物
3. 启动 WebSocket 服务，推送热更新通知
4. 手机端调试器连接 WebSocket，接收更新后重新加载页面

---

## 六、面试向总结

### Q：快应用的构建产物是什么？

rpk/rpks 文件，本质是 ZIP 包 + 数字签名。内部包含编译后的 JS bundle（每个页面一个）、样式 JSON、资源文件和 manifest。

### Q：UX 文件是怎么编译的？

类似 Vue SFC 的编译流程：先解析为 template/script/style 三段，template 编译为 JS 渲染函数，script 通过 Babel 转译，style 编译为 JSON 格式（不是标准 CSS，因为快应用运行时用自己的样式引擎）。

### Q：用了哪些工具？

Webpack 做模块打包，Babel 做 JS 转译，自研的 template compiler 和 style compiler 处理快应用特有的模板和样式语法，Node.js crypto 做 RSA 签名。

### Q：和 Web 前端构建的区别？

1. 样式不是 CSS 而是 JSON（运行时不是浏览器，没有 CSS 引擎）
2. 模板编译为虚拟 DOM 函数（类似 Vue，但目标是快应用运行时而非浏览器 DOM）
3. 产物不是 HTML+JS+CSS，而是 ZIP 包（rpk）
4. 需要数字签名（类似 Android APK 签名）
5. 每个页面独立打包（不是 SPA，是多页面架构）

### Q：卡片和快应用的构建有什么区别？

卡片是快应用的子集：
- 轻卡没有 `<script>`，只有 `<template>` + `<style>` + `<data>`（声明式）
- 标准卡有完整的 JS 能力
- 卡片的产物更小，运行在受限的沙箱环境中
- 卡片支持的组件和 API 是快应用的子集
