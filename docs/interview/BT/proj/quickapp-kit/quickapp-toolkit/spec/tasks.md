# Tasks Document

## 目录

- [Overview](#overview)
- [开发原则](#开发原则)
- [Phase 1：管线骨架与 SFC 解析](#phase-1管线骨架与-sfc-解析)
  - [Task 1.1：CLI 骨架与项目扫描](#task-11cli-骨架与项目扫描)
  - [Task 1.2：SFC Parser](#task-12sfc-parser)
  - [Task 1.3：Manifest Processor](#task-13manifest-processor)
- [Phase 2：三路编译器](#phase-2三路编译器)
  - [Task 2.1：对象字面量序列化器](#task-21对象字面量序列化器)
  - [Task 2.2：Template Compiler](#task-22template-compiler)
  - [Task 2.3：Style Compiler](#task-23style-compiler)
  - [Task 2.4：Script Compiler](#task-24script-compiler)
- [Phase 3：Bundle 组装与打包](#phase-3bundle-组装与打包)
  - [Task 3.1：Bundle Assembler](#task-31bundle-assembler)
  - [Task 3.2：RPK Packager](#task-32rpk-packager)
  - [Task 3.3：Release 压缩](#task-33release-压缩)
- [Phase 4：契约验收与开发体验](#phase-4契约验收与开发体验)
  - [Task 4.1：与 Runtime 的契约验收](#task-41与-runtime-的契约验收)
  - [Task 4.2：Watch 模式与增量编译](#task-42watch-模式与增量编译)
  - [Task 4.3：quickapp init 模板](#task-43quickapp-init-模板)
  - [Task 4.4：诊断输出与错误定位](#task-44诊断输出与错误定位)
- [任务依赖关系](#任务依赖关系)
- [需求覆盖矩阵](#需求覆盖矩阵)

---

## Overview

本文档将 requirements.md 的 9 个需求分解为 4 个阶段。

实现顺序的核心逻辑：**先打通「一个最简页面能编译出可被 Runtime 加载的 RPK」这条最短链路，再逐步补全编译器的语法覆盖面。**

不是先把 Template Compiler 做到完美再做 Style Compiler，而是三个编译器都先做出最小可用版本，尽早拿到端到端产物，用 Runtime 做真实验收。

**第一阶段验收目标：**

```text
一个只含 <div><text>hello</text></div> 的 .ux 页面
    ↓ quickapp build
dist/com.example.demo.debug.1.0.0.rpk
    ↓ quickapp-runtime-android 加载
屏幕显示 "hello"
```

**工作量估算：**

| 模块 | 行数 |
|---|---|
| CLI + 项目扫描 | ~250 |
| SFC Parser | ~150 |
| Template Compiler | ~350 |
| Style Compiler | ~200 |
| Script Compiler | ~250 |
| 序列化器 | ~120 |
| Bundle Assembler | ~180 |
| Manifest Processor | ~200 |
| RPK Packager | ~250 |
| 诊断 + 错误类型 | ~150 |
| Watch | ~150 |
| 测试 | ~600 |
| 合计 | ~2850 |

预估工时：4-5 个工作日（32-40 小时）。

**不在范围内：** 签名生成与校验、TypeScript 编译、Less/Sass 预处理、npm 依赖打包、Widget/Card 编译、热更新协议、多语言资源。

---

## 开发原则

### 原则 1：契约优先，用 Runtime 做最终验收

toolkit 的正确性不由自身单测定义，而由「产物能否被 Runtime 正确执行」定义。因此：

- 每个 Phase 结束都要跑一次端到端 build + Runtime 加载
- 官方 hap-toolkit 的产物是回归基线，结构对齐但不要求字节一致
- 单测只保证组件内部行为，契约测试才是验收标准

### 原则 2：编译期做完所有静态转换

Runtime 不解析 `.ux`、不解析 CSS、不做 XML 解析。任何能在编译期确定的转换都必须在编译期完成。

这条原则决定了产物格式：模板是 JSON 树，样式是 JS 对象，事件是字符串映射。

### 原则 3：错误必须能定位到源码行号

编译器内部使用区块相对行号，输出前统一换算为文件绝对行号。任何丢失行号的错误路径都视为缺陷。

### 原则 4：最小依赖

只引入三个核心依赖：

```text
htmlparser2   XML 解析（模板）
postcss       CSS 解析（样式）
@babel/core   JS AST 转换（脚本）
```

ZIP 打包用 Node 内置 `zlib` + 手写 ZIP 写入器，不引入 `archiver`（避免其庞大依赖树）。

---

## Phase 1：管线骨架与 SFC 解析

### Task 1.1：CLI 骨架与项目扫描

**需求覆盖：** 需求 8

**目标：** 建立 CLI 命令注册、参数解析和项目结构扫描能力。此时编译器尚未实现，`build` 命令只输出扫描结果。

**产出：**
- `bin/quickapp.js`
- `src/cli/index.ts`：命令注册与 argv 解析
- `src/cli/cmd-build.ts`：build 命令骨架
- `src/scanner/project-scanner.ts`：项目结构扫描
- `src/types/index.ts`：`BuildContext`、`FileTree` 类型
- `src/diagnostics/diagnostic.ts`：诊断类型与终端格式化输出

**验收：**
- `quickapp build` 在示例项目下执行，输出待编译页面列表和资源列表
- `quickapp build --mode=release` 能正确解析 mode 参数
- 缺少 `src/` 目录时输出清晰错误并以退出码 1 退出

**工时：** 3 小时

**Step 文档：** `steps/01-cli-skeleton.md`

---

### Task 1.2：SFC Parser

**需求覆盖：** 需求 2

**目标：** 实现 `.ux` 三段式拆分，产出带行号的 `SFCDescriptor`。

**产出：**
- `src/parser/sfc-parser.ts`
- `src/diagnostics/errors.ts`：`SFCParseError`
- 单测覆盖：完整三段、缺 style、缺 script、区块内含同名字符串、未闭合标签

**核心实现要点：**

```text
行首匹配策略：只在行首识别 <template> / <style> / <script>
避免误判 <script> 内部的 "</div>" 字符串
记录每个区块的 startLine，供后续错误行号换算
```

**验收：** 解析示例项目的 `pages/Demo/index.ux`，三个区块内容与源码逐字符一致，`startLine` 正确。

**工时：** 2 小时

**Step 文档：** `steps/02-sfc-parser.md`

---

### Task 1.3：Manifest Processor

**需求覆盖：** 需求 6

**目标：** 读取、验证 manifest.json，按 mode 注入 config 字段。

**产出：**
- `src/manifest/schema.ts`：`Manifest` 类型与校验规则表
- `src/manifest/processor.ts`
- `src/diagnostics/errors.ts`：`ManifestError`

**验证清单：**

```text
必填字段：package、name、versionName、versionCode、router.entry、router.pages
router.entry ∈ keys(router.pages)
每个 router.pages[key].component 对应的 .ux 文件存在
features[].name 存在
```

**验收：**
- 示例项目 manifest 通过验证，`config.debug` 按 mode 正确注入
- 删除 `router.entry` 后报错信息明确指出缺失字段名
- `router.pages` 声明了不存在的页面时报错并给出期望路径

**工时：** 2.5 小时

**Step 文档：** `steps/03-manifest-processor.md`

---

## Phase 2：三路编译器

### Task 2.1：对象字面量序列化器

**需求覆盖：** 需求 3、需求 4

**目标：** 实现能序列化含 function 值的 JS 对象为代码字符串的工具。这是 Template Compiler 的前置依赖。

**为什么单独一个 Task：** 模板产物中的插值属性必须是真实 function 字面量，`JSON.stringify` 无法表达。序列化逻辑同时被 Template 和 Style 编译器使用，独立成模块避免重复。

**产出：**
- `src/compiler/serializer.ts`
- `FunctionExpression` 标记类型：包装原始函数代码文本
- 单测：嵌套对象、数组、function 值、字符串转义、混合场景

**接口：**

```typescript
/**
 * 标记一个值为「原始 JS 代码」，序列化时不加引号直接输出。
 * 用于表达模板中的函数属性。
 */
export class RawCode {
  constructor(public readonly code: string) {}
}

/**
 * 将对象序列化为 JS 对象字面量代码字符串。
 * @param value  待序列化的值；RawCode 实例会原样输出其 code
 * @param indent 缩进层级，用于生成可读产物（release 模式可传 -1 禁用换行）
 * @returns JS 代码字符串，可直接嵌入 bundle
 */
export function serialize(value: unknown, indent?: number): string;
```

**验收：**
- `serialize({ a: 1, b: new RawCode('function () { return this.x }') })` 输出 `{ a: 1, b: function () { return this.x } }`
- 字符串值中的引号、换行、Unicode 正确转义
- 嵌套 5 层对象输出可读缩进

**工时：** 2 小时

**Step 文档：** `steps/04-serializer.md`

---

### Task 2.2：Template Compiler

**需求覆盖：** 需求 3

**目标：** XML → JSON 模板树代码字符串。

**产出：**
- `src/compiler/template-compiler.ts`
- 插值表达式编译子模块
- 单测：单节点、多层嵌套、单/多段插值、`@click` 与 `onclick`、多 class、文本子节点

**属性分类实现：**

| 源码 | 目标字段 | 转换 |
|---|---|---|
| `class="a b"` | `classList` | 按空白拆分 |
| `@click` / `onclick` | `events` | 去前缀，值为方法名字符串 |
| `x="{{expr}}"` | `attr` | 包装为 `RawCode('function () { return this.expr }')` |
| `x="literal"` | `attr` | 原样字符串 |
| 文本子节点 | 父节点 `attr.value` | 同插值规则 |

**插值编译规则：**

```text
"{{title}}"        → function () { return this.title }
"{{a}}-{{b}}"      → function () { return this.a + "-" + this.b }
"前缀{{title}}"     → function () { return "前缀" + this.title }
"{{a}}{{b}}"       → function () { return this.a + this.b }
```

**验收：**
- 示例 Demo 页面模板编译产物与官方 hap-toolkit 产物结构一致
- 未闭合标签报错附正确的文件绝对行号
- 编译产物在 Node 中 eval 后，函数属性以 `{ title: 'x' }` 为 this 调用返回 `'x'`

**工时：** 5 小时

**Step 文档：** `steps/05-template-compiler.md`

---

### Task 2.3：Style Compiler

**需求覆盖：** 需求 4

**目标：** CSS → JS 样式对象代码字符串。

**产出：**
- `src/compiler/style-compiler.ts`
- kebab → camel 转换函数
- 单测：单选择器、后代选择器、属性名转换、带单位值、厂商前缀、`@media` 跳过

**实现要点：**

```text
postcss.parse → 遍历 root.nodes
  Rule       → selector 原样作为 key，遍历 Declaration
  AtRule     → 记录 warning，跳过（V1 不支持 @media）
  Comment    → 忽略
Declaration  → prop kebab→camel，value 原样字符串
```

**转换规则：**

```text
font-size       → fontSize
flex-direction  → flexDirection
-webkit-mask    → 保持原样 + warning（厂商前缀不转换）
```

**验收：**
- 示例 Demo 页面样式编译产物的 key 与 value 和官方产物一致
- `.wrapper .title` 后代选择器保持完整字符串
- `40px` 保留为 `"40px"` 字符串，不转数字

**工时：** 3 小时

**Step 文档：** `steps/06-style-compiler.md`

---

### Task 2.4：Script Compiler

**需求覆盖：** 需求 5

**目标：** JS 转换 + `require` 重写，输出 CommonJS 模块函数字符串。

**产出：**
- `src/compiler/script-compiler.ts`
- Babel plugin：`require` → `$app_require$`、ES module → CommonJS
- 单测：`export default`、`import`、`require`、字符串内含 require（不应被改写）、注释内含 import

**转换项：**

| 源码 | 产物 |
|---|---|
| `export default { ... }` | `exports.default = { ... }` |
| `import x from 'y'` | `var x = $app_require$('y')` |
| `require('@app-module/system.router')` | `$app_require$('@app-module/system.router')` |
| ES2020 语法 | 原样保留 |

**为什么用 Babel 而非正则：** 正则会改写字符串常量和注释中的 `require`，产生只在运行时暴露的 bug。

**验收：**
- 示例 Demo 页面 script 编译后，`_system.default.push` 调用链正确
- 字符串 `"require('x')"` 不被改写
- 箭头函数、模板字符串、可选链原样保留

**工时：** 4 小时

**Step 文档：** `steps/07-script-compiler.md`

---

## Phase 3：Bundle 组装与打包

### Task 3.1：Bundle Assembler

**需求覆盖：** 需求 5

**目标：** 将三路编译产物拼装为完整 bundle，产出符合 Runtime 接口约定 的 IIFE。

**产出：**
- `src/bundler/templates.ts`：bundle 骨架模板字符串
- `src/bundler/assembler.ts`
- app.js 专用组装路径（无 template/style）

**产出结构：** 见 design.md 的 [Bundle 产物格式](./design.md#bundle-产物格式)。

**验收：**
- 组装出的 bundle 在 Node 中 eval（mock `$app_define$` / `$app_bootstrap$`）后：
  - `$app_define$` 被调用一次，组件名为 `@app-component/index`
  - `$app_bootstrap$` 在其后被调用
  - `exports.template`、`exports.style`、`exports.private` 都存在且结构正确
- app.js 组装产物包含 `@app-application/app` 定义

**工时：** 3 小时

**Step 文档：** `steps/08-bundle-assembler.md`

---

### Task 3.2：RPK Packager

**需求覆盖：** 需求 7

**目标：** 将所有产物打包为标准 RPK（ZIP），生成 build.txt。

**产出：**
- `src/packager/rpk-packager.ts`：手写 ZIP 写入器（Local File Header + Central Directory + EOCD）
- `src/packager/build-info.ts`：build.txt 生成与 SHA256 计算
- 原子写入：临时文件 + rename

**为什么手写 ZIP 而非用 archiver：** Runtime 侧的 RPK 解析器也是手写的（见 Android 的 `rpk_loader.cpp`）。两侧都手写能保证对 ZIP 格式的理解一致，避免「archiver 生成的某个 flag 让 C++ 解析器失败」这类问题。ZIP 写入约 150 行，可控。

**压缩策略：**

```text
.js / .json         → DEFLATE（zlib.deflateRawSync）
.png / .jpg / 二进制 → STORE（compressionMethod = 0）
```

**验收：**
- 产物能被 `unzip -l` 正常列出
- 产物能被 Android 的 `RPKLoader` 正确解析并读出 manifest.json
- 条目路径无前导 `/`、无 `./`、使用正斜杠
- 编译中途 kill 进程后，`dist/` 下不存在损坏的 `.rpk`

**工时：** 4 小时

**Step 文档：** `steps/09-rpk-packager.md`

---

### Task 3.3：Release 压缩

**需求覆盖：** 需求 7、需求 8

**目标：** Release 模式下用 Terser 压缩 bundle。

**产出：**
- `src/minify/minifier.ts`：Terser 封装
- Terser 配置：保留 `$app_define$` / `$app_bootstrap$` / `$app_require$` 全局名不被改写

**关键配置约束：**

```text
mangle.reserved  = ['$app_define$', '$app_bootstrap$', '$app_require$']
compress.keep_fnames = false（函数属性可以被压缩，因为通过 this 求值）
format.comments  = false
```

**为什么必须 reserve 三个全局名：** 它们是 Runtime 注入的全局函数，被改名后 bundle 会调用到 undefined。

**验收：**
- Release 产物体积相比 debug 减少 80% 以上
- Release 产物在 Runtime 上的行为与 debug 完全一致（Property 5）
- `$app_define$` 等全局名在压缩产物中保持原样

**工时：** 2 小时

**Step 文档：** `steps/10-release-minify.md`

---

## Phase 4：契约验收与开发体验

### Task 4.1：与 Runtime 的契约验收

**需求覆盖：** 所有需求的联合验收

**目标：** 用本工具链编译 `quickapp-examples/quickapp-code-test1`，产物在 `quickapp-runtime-android` 上的行为与官方 hap-toolkit 产物一致。

**这是 toolkit 唯一的硬性验收标准。** 前面所有 Task 的单测都只是内部保证。

**验收清单：**

```text
[ ] quickapp build 成功产出 dist/com.example.case1.debug.1.0.0.rpk
[ ] Android Runtime 加载该 RPK，manifest 解析成功
[ ] app.js 执行成功，$app_define$('@app-application/app') 被调用
[ ] Demo 页面渲染出 TitleBar、文本、按钮
[ ] 文本内容为 "欢迎体验快应用开发"（函数属性求值正确）
[ ] 按钮文字为 "跳转到详情页"（静态属性正确）
[ ] 点击按钮进入 onDetailBtnClick（events 映射正确）
[ ] router.push 导航到 DemoDetail（require 重写正确）
[ ] 样式生效：.wrapper 的 flexDirection、.title 的 fontSize/color
[ ] release 模式产物行为与 debug 一致
```

**与官方产物的结构对齐验证：**

```text
解压两个 RPK，比对：
- 模板树 JSON 结构（节点层次、type、classList、events）
- 样式对象 key/value 集合
- $app_define$ / $app_bootstrap$ 调用序列
- manifest 字段集合

允许不同：变量名、模块 ID、文件体积、缩进
```

**工时：** 4 小时

**Step 文档：** `steps/11-runtime-contract-verify.md`

---

### Task 4.2：Watch 模式与增量编译

**需求覆盖：** 需求 9

**目标：** 文件变更后仅重编译受影响页面。

**产出：**
- `src/cli/cmd-watch.ts`
- 文件监听（Node `fs.watch` 或 `chokidar`）
- 增量编译调度：页面粒度

**增量边界：**

```text
pages/X/index.ux 变更  → 仅重编译该页面 bundle → 重新打包 RPK
app.ux 变更            → 重编译 app.js → 重新打包
manifest.json 变更     → 重新验证 manifest → 全量重建
assets/* 变更          → 仅重新打包（无需编译）
```

**为什么页面粒度是天然边界：** 页面之间无编译期依赖，模板/样式/脚本都是页面私有。不需要依赖图。

**验收：**
- 修改单个页面后，输出仅显示该页面重编译，耗时明显低于全量
- 增量产物与全量 build 的该页面产物字节一致（Property 6）
- 编译错误不终止 watch 进程
- 修改 manifest 触发全量重建

**工时：** 3 小时

**Step 文档：** `steps/12-watch-incremental.md`

---

### Task 4.3：quickapp init 模板

**需求覆盖：** 需求 1

**目标：** 提供可直接 build 的项目骨架模板。

**产出：**
- `templates/default/`：manifest.json、app.ux、pages/Demo/index.ux
- `src/cli/cmd-init.ts`
- 目录冲突检测与确认提示

**模板内容约束：** 生成的项目执行 `quickapp build` 必须一次成功，产物必须能在 Runtime 上渲染出可见内容。这是模板的验收标准，不能只是「文件齐全」。

**验收：**
- `quickapp init my-app && cd my-app && quickapp build` 一次成功
- 产物在 Android Runtime 上显示模板页面内容
- 目标目录已存在时提示冲突

**工时：** 2 小时

**Step 文档：** `steps/13-init-template.md`

---

### Task 4.4：诊断输出与错误定位

**需求覆盖：** 需求 8、以及各需求的错误处理条款

**目标：** 统一所有编译阶段的错误输出格式，保证行号可定位。

**产出：**
- `src/diagnostics/diagnostic.ts`：终端格式化（带颜色、源码片段、指示箭头）
- 各编译器的行号换算：区块相对行号 + `startLine - 1`
- 错误汇总：一次 build 收集所有页面的错误后统一输出，不在第一个错误处退出

**输出格式：**

```text
ERROR  src/pages/Demo/index.ux:12:5
  未闭合的标签 <div>，期望 </div>

  10 |   <div class="wrapper">
  11 |     <text class="title">{{title}}</text>
  12 |     <div class="btn">
     |     ^
  13 |   </div>

WARNING  src/pages/Demo/index.ux:28:3
  未识别的 CSS 属性 "box-shadow"，已透传给 Runtime

编译失败：1 个错误，1 个警告
```

**行号换算验证：** 在 `<script>` 区块（假设从第 20 行开始）第 3 行制造语法错误，输出必须是第 22 行，不是第 3 行。

**验收：**
- 模板、样式、脚本三类错误都输出正确的文件绝对行号
- 多页面同时出错时，全部错误一次性输出
- 退出码：有 error → 1，仅 warning → 0

**工时：** 3 小时

**Step 文档：** `steps/14-diagnostics.md`

---

## 任务依赖关系

```text
Phase 1：管线骨架

  Task 1.1 CLI 骨架 + 项目扫描 → Step 01
      ↓
  Task 1.2 SFC Parser → Step 02
      ↓
  Task 1.3 Manifest Processor → Step 03
      ↓
Phase 2：三路编译器

  Task 2.1 序列化器 → Step 04
      ↓
  Task 2.2 Template Compiler → Step 05
      ↓                    ↘
  Task 2.3 Style Compiler → Step 06   （2.3 / 2.4 不依赖 2.2，可并行）
      ↓                    ↘
  Task 2.4 Script Compiler → Step 07
      ↓
Phase 3：组装与打包

  Task 3.1 Bundle Assembler → Step 08
      ↓
  Task 3.2 RPK Packager → Step 09
      ↓
  Task 3.3 Release 压缩 → Step 10
      ↓
Phase 4：验收与体验

  Task 4.1 Runtime 契约验收 → Step 11    ← 硬性验收点
      ↓
  Task 4.2 Watch 增量 → Step 12
      ↓
  Task 4.3 init 模板 → Step 13
      ↓
  Task 4.4 诊断输出 → Step 14
```

**关键路径：** Task 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1。这条路径打通后即可拿到能被 Runtime 加载的产物；2.3、2.4 可与 2.2 并行开发。

**Task 2.1 必须先于 2.2：** Template Compiler 依赖序列化器输出含 function 的字面量。

**Task 4.1 是分水岭：** 在它通过之前，所有编译器的「正确」都只是单测意义上的正确。

---

## 需求覆盖矩阵

| 需求 | 任务 |
|---|---|
| 需求 1：项目初始化 | Task 4.3 |
| 需求 2：SFC 解析 | Task 1.2 |
| 需求 3：模板编译 | Task 2.1、Task 2.2 |
| 需求 4：样式编译 | Task 2.1、Task 2.3 |
| 需求 5：脚本编译与模块打包 | Task 2.4、Task 3.1 |
| 需求 6：Manifest 处理 | Task 1.3 |
| 需求 7：RPK 打包 | Task 3.2、Task 3.3 |
| 需求 8：CLI 命令接口 | Task 1.1、Task 3.3、Task 4.4 |
| 需求 9：Watch 模式与增量编译 | Task 4.2 |
| 全需求联合验收 | Task 4.1 |
| 签名生成（当前不实现） | 明确排除；Task 3.2 生成占位 build.txt，不生成 CERT |
