# Design Document

## 目录

- [Overview](#overview)
- [编译管线](#编译管线)
- [Components and Interfaces](#components-and-interfaces)
- [Data Models](#data-models)
- [Correctness Properties](#correctness-properties)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Module Design](#module-design)
  - [SFC Parser](#sfc-parser)
  - [Template Compiler](#template-compiler)
  - [Style Compiler](#style-compiler)
  - [Script Compiler](#script-compiler)
  - [Manifest Processor](#manifest-processor)
  - [RPK Packager](#rpk-packager)
- [Bundle 产物格式](#bundle-产物格式)
- [Directory Structure](#directory-structure)
- [Key Decisions](#key-decisions)

---

## Overview

QuickApp Toolkit 是一条单向编译管线：`.ux` 源码 → 中间表示 → JS Bundle → RPK。

核心特征：
- 编译期完成模板、样式的静态转换，Runtime 零解析成本
- 每个页面产出一个独立 webpack bundle，符合 `$app_define$` / `$app_bootstrap$` 协议
- Debug 和 Release 两种模式产出语义等价、体积不同的产物
- 编译器与 Runtime 通过「产物格式契约」解耦，双方各自演进

工具链不做的事：
- 不执行 JS，不管理 JS 引擎
- 不做渲染、布局计算
- 不做签名验证（V1 生成占位 CERT）

---

## 编译管线

```text
src/
├── manifest.json
├── app.ux
├── pages/
│   ├── Demo/index.ux
│   └── DemoDetail/index.ux
└── assets/images/logo.png

        ↓ Stage 1: 项目扫描

FileTree
├── manifest 路径
├── app 入口路径
├── 页面路径列表（从 manifest.router.pages 推导）
└── 资源路径列表

        ↓ Stage 2: SFC 解析（每个 .ux）

SFCDescriptor
├── template: string  （XML 源码）
├── style: string     （CSS 源码）
├── script: string    （JS 源码）
└── filename: string  （用于错误定位）

        ↓ Stage 3: 三路并行编译

Template Compiler        Style Compiler          Script Compiler
XML → JSON 模板树        CSS → JS 样式对象       JS → CommonJS 模块
                                                 require → $app_require$

        ↓ Stage 4: Bundle 组装

webpack 模块表
├── module "script"   → script 编译产物
├── module "style"    → style 编译产物
└── module "template" → template 编译产物
+ $app_define$ / $app_bootstrap$ 调用

        ↓ Stage 5: Manifest 处理

manifest.json 验证 + mode 注入（config.debug）

        ↓ Stage 6: Release 优化（可选）

Terser 压缩 JS bundle

        ↓ Stage 7: RPK 打包

dist/com.example.case1.debug.1.0.0.rpk
├── manifest.json
├── app.js
├── pages/Demo/index.js
├── pages/DemoDetail/index.js
├── assets/images/logo.png
└── META-INF/build.txt
```

管线的关键性质：Stage 3 的三路编译互不依赖，可并行；Stage 4 只是字符串拼装，不做语义分析。

---

## Components and Interfaces

| 组件 | 职责 | 输入 | 输出 |
|---|---|---|---|
| `ProjectScanner` | 扫描项目结构，推导待编译文件列表 | 项目根目录 | `FileTree` |
| `SFCParser` | 拆分 `.ux` 为三个区块 | `.ux` 文件内容 | `SFCDescriptor` |
| `TemplateCompiler` | XML → JSON 模板树 | template 源码 | JS 对象字面量字符串 |
| `StyleCompiler` | CSS → JS 样式对象 | style 源码 | JS 对象字面量字符串 |
| `ScriptCompiler` | JS 转换 + require 重写 | script 源码 | CommonJS 模块字符串 |
| `BundleAssembler` | 组装 webpack bundle | 三路编译产物 | 完整 bundle 字符串 |
| `ManifestProcessor` | 验证 + mode 注入 | manifest.json | 处理后的 manifest 对象 |
| `Minifier` | Release 模式 JS 压缩 | bundle 字符串 | 压缩后字符串 |
| `RPKPackager` | ZIP 打包 + build.txt 生成 | 所有产物 | `.rpk` 文件 |
| `CLI` | 命令解析与管线编排 | argv | 退出码 + 诊断输出 |

### 关键接口边界

```text
SFCParser        → 只做文本拆分，不理解 XML/CSS/JS 语义
TemplateCompiler → 只输出 JS 对象字面量，不知道 Runtime 如何消费
BundleAssembler  → 只做字符串拼装，不做语法校验
RPKPackager      → 只做文件系统与 ZIP 操作，不理解 JS
```

任何组件都不应跨越边界。例如 TemplateCompiler 不能读取 manifest；ScriptCompiler 不能修改样式。

---

## Data Models

### SFCDescriptor

```typescript
/**
 * 一个 .ux 文件解析后的中间表示。
 * 三个区块保持原始文本，交由各自的编译器处理。
 */
interface SFCDescriptor {
  /** 源文件绝对路径，用于错误定位 */
  filename: string;
  /** <template> 区块内容，不含标签本身；缺失时为 null */
  template: BlockDescriptor | null;
  /** <style> 区块内容；缺失时为 null */
  style: BlockDescriptor | null;
  /** <script> 区块内容；缺失时为 null */
  script: BlockDescriptor | null;
}

interface BlockDescriptor {
  /** 区块内的源码文本 */
  content: string;
  /** 区块在原文件中的起始行号（1-based），用于错误行号换算 */
  startLine: number;
  /** lang 属性值，如 "less"；无该属性时为 null */
  lang: string | null;
}
```

### TemplateNode

编译后的模板树节点，与 Runtime 的 VNode 构建输入一一对应：

```typescript
interface TemplateNode {
  /** 标签名："div" | "text" | "input" */
  type: string;
  /** 静态属性与函数属性混合；函数属性在产物中是真实 function 字面量 */
  attr: Record<string, string | FunctionExpression>;
  /** class 属性拆分后的数组 */
  classList: string[];
  /** 事件名 → VM 方法名映射，如 { click: "onDetailBtnClick" } */
  events: Record<string, string>;
  /** 子节点，深度优先顺序 */
  children: TemplateNode[];
}
```

### StyleSheet

```typescript
/**
 * 选择器 → 属性集合。
 * key 保留完整选择器字符串（含后代选择器的空格）。
 * value 的属性名已转为 camelCase，属性值保留原始单位字符串。
 */
type StyleSheet = Record<string, Record<string, string>>;
```

### BuildContext

贯穿整条管线的上下文，避免各组件重复读取配置：

```typescript
interface BuildContext {
  /** 项目根目录绝对路径 */
  projectRoot: string;
  /** 源码目录，默认 <projectRoot>/src */
  srcDir: string;
  /** 产物目录，默认 <projectRoot>/dist */
  distDir: string;
  /** 构建模式，决定是否压缩和 config.debug 取值 */
  mode: 'debug' | 'release';
  /** 已验证的 manifest 对象 */
  manifest: Manifest;
  /** 累积的诊断信息；非致命错误也记录在此 */
  diagnostics: Diagnostic[];
}

interface Diagnostic {
  severity: 'error' | 'warning';
  /** 出错文件的绝对路径 */
  file: string;
  /** 1-based 行号；无法定位时为 0 */
  line: number;
  message: string;
}
```

---

## Correctness Properties

### Property 1：产物格式契约稳定

编译产物必须满足 Runtime 的接口约定：bundle eval 后一定调用 `$app_define$`，随后调用 `$app_bootstrap$`；`$app_module$.exports` 上一定存在 `template` 和 `style` 字段。

**Validates: 需求 5.1, 5.2**

### Property 2：模板树与源码结构同构

编译后的 JSON 模板树的节点层次、兄弟顺序与 `<template>` 中 XML 的元素层次、顺序完全一致。

**Validates: 需求 3.1**

### Property 3：函数属性求值上下文正确

`{{expr}}` 编译出的函数必须以 `this` 访问 VM 数据，不能捕获编译期变量。

**Validates: 需求 3.2**

### Property 4：样式属性名转换可逆

kebab-case → camelCase 转换必须无歧义：`font-size` → `fontSize`，`-webkit-x` 等厂商前缀属性保持原样跳过。

**Validates: 需求 4.2**

### Property 5：Debug 与 Release 语义等价

同一份源码在两种模式下编译出的 bundle，其 `$app_define$` 调用、模板树结构、样式对象内容必须语义等价，仅变量名和体积不同。

**Validates: 需求 7.4, 8.2, 8.3**

### Property 6：增量编译结果一致

`watch` 模式下增量编译单个页面的产物，必须与全量 `build` 该页面的产物字节一致。

**Validates: 需求 9.2**

### Property 7：ZIP 条目路径规范

RPK 内所有条目路径使用正斜杠、无前导 `/`、无 `./`，与 manifest 中声明的路径一致。

**Validates: 需求 7.1**

### Property 8：编译失败不产出半成品

任一页面编译失败时，不能产出残缺的 `.rpk`；已有的旧产物不能被覆盖为损坏文件。

**Validates: 需求 7.6, 8.5**

---

## Error Handling

错误按管线阶段分类，全部携带文件路径和行号：

| 错误类别 | 示例 | 处理策略 |
|---|---|---|
| Project | src 目录不存在、manifest 缺失 | 立即中止，输出项目结构要求 |
| SFC | 缺少 `<template>`、标签未闭合 | 记录 diagnostic，跳过该页面，继续编译其他页面 |
| Template | 非法 XML、属性名含非法字符 | 记录 diagnostic 并附行号，中止该页面编译 |
| Style | CSS 语法错误、未知属性 | 语法错误跳过该规则并 warning；未知属性透传 |
| Script | 语法错误 | 记录 diagnostic 附行号，中止该页面编译 |
| Manifest | 必填字段缺失、页面文件不存在 | 立即中止整个构建 |
| Package | 磁盘写入失败、ZIP 创建失败 | 立即中止，清理临时文件 |

诊断输出格式：

```text
ERROR  src/pages/Demo/index.ux:12:5
  未闭合的标签 <div>，期望 </div>

WARNING  src/pages/Demo/index.ux:28:3
  未识别的 CSS 属性 "box-shadow"，已透传给 Runtime
```

行号换算规则：各编译器内部行号是区块相对行号，输出前需加上 `BlockDescriptor.startLine - 1` 换算为文件绝对行号。

---

## Testing Strategy

### 单元测试

- `SFCParser`：三段式完整、缺 style、缺 script、嵌套 `<template>` 字符串、`lang` 属性
- `TemplateCompiler`：单节点、多层嵌套、`{{}}` 插值、`@click` 与 `onclick` 两种事件写法、多 class
- `StyleCompiler`：单选择器、后代选择器、kebab→camel、带单位值、厂商前缀
- `ScriptCompiler`：`require` 重写、ES6 module → CommonJS、`export default`
- `ManifestProcessor`：必填校验、页面文件存在性、debug/release 字段注入
- `RPKPackager`：ZIP 条目路径、压缩方法选择、build.txt 内容

### 集成测试

```text
.ux 源码 → SFCParser → 三路编译 → BundleAssembler → 产物字符串
产物字符串 → 在 Node 中 eval（mock $app_define$/$app_bootstrap$）→ 断言 exports 结构
完整项目 → build → 解压 .rpk → 逐文件比对预期产物
```

### 契约测试（与 Runtime 的联合验收）

用 toolkit 编译 `quickapp-examples/quickapp-code-test1`，产出的 RPK 必须能被 `quickapp-runtime-android` 正常加载并渲染，行为与官方 hap-toolkit 产物一致。这是 toolkit 唯一的硬性验收标准。

### 回归基线

将官方 hap-toolkit 编译的 `com.example.case1.debug.1.0.0.rpk` 作为参考基线，本工具链产物在以下维度必须对齐：
- 模板树 JSON 结构
- 样式对象 key/value
- `$app_define$` / `$app_bootstrap$` 调用序列
- manifest 字段集合

体积和变量名允许不同。

---

## Module Design

### SFC Parser

**文件：** `src/parser/sfc-parser.ts`

**职责：** 用状态机扫描 `.ux` 文本，识别三个顶级区块的起止位置，提取内容和起始行号。

**为什么不用 XML 解析器：** `<script>` 内可能包含 `</div>` 这类字符串，完整 XML 解析会误判。只需要在顶层匹配三个已知标签，状态机足够且更快。

```typescript
/**
 * 解析 .ux 单文件组件。
 * @param source   .ux 文件的完整文本内容（UTF-8）
 * @param filename 源文件路径，仅用于错误信息和 descriptor.filename
 * @returns 三个区块的描述符；某区块不存在时该字段为 null
 * @throws SFCParseError 当出现未闭合的顶级标签时
 */
export function parseSFC(source: string, filename: string): SFCDescriptor;
```

**扫描策略：**

```text
1. 逐行扫描，维护 currentBlock 状态（null | template | style | script）
2. 遇到 /^<(template|style|script)(\s[^>]*)?>/ 且 currentBlock === null → 进入该区块
3. 遇到 /^<\/(template|style|script)>/ 且标签匹配 currentBlock → 结束该区块
4. 区块内的行原样累积，不做任何转义或裁剪
5. EOF 时 currentBlock !== null → 抛 SFCParseError
```

关键点：只在行首匹配标签，避免误判区块内的同名字符串。

---

### Template Compiler

**文件：** `src/compiler/template-compiler.ts`

**职责：** XML → `TemplateNode` 树 → JS 对象字面量字符串。

```typescript
/**
 * 编译 <template> 区块。
 * @param template  template 区块源码（不含 <template> 标签本身）
 * @param startLine 区块在原文件中的起始行号，用于错误行号换算
 * @returns JS 对象字面量字符串，可直接嵌入 bundle 的 module.exports
 * @throws TemplateCompileError 附带绝对行号
 */
export function compileTemplate(template: string, startLine: number): string;
```

**两阶段实现：**

```text
阶段 1：XML → AST
  用轻量 XML 解析器（如 htmlparser2）得到元素树
  只保留元素节点和非空白文本节点

阶段 2：AST → TemplateNode → 字面量字符串
  逐节点转换属性、class、事件
  递归处理 children
  序列化为 JS 代码（注意：函数属性不能用 JSON.stringify）
```

**属性分类规则：**

| 源码写法 | 归类 | 产物 |
|---|---|---|
| `class="a b"` | classList | `classList: ["a", "b"]` |
| `@click="fn"` / `onclick="fn"` | events | `events: { click: "fn" }` |
| `value="{{title}}"` | attr（函数） | `attr: { value: function () { return this.title } }` |
| `type="button"` | attr（静态） | `attr: { type: "button" }` |
| 文本子节点 `{{content}}` | attr.value（函数） | 同插值属性 |

**插值编译细节：**

```text
value="{{title}}"          → function () { return this.title }
value="{{a}}-{{b}}"        → function () { return this.a + "-" + this.b }
value="前缀{{title}}"       → function () { return "前缀" + this.title }
```

多段插值必须拼接为表达式，不能生成模板字符串（保持与官方产物一致）。

**序列化实现要点：** 因为产物中包含 function 字面量，不能用 `JSON.stringify`。需要自研序列化：对函数属性输出原始代码文本，对其他值走 `JSON.stringify`。

---

### Style Compiler

**文件：** `src/compiler/style-compiler.ts`

**职责：** CSS → `StyleSheet` 对象 → JS 对象字面量字符串。

```typescript
/**
 * 编译 <style> 区块。
 * @param style     style 区块源码
 * @param startLine 区块起始行号
 * @param lang      lang 属性值；V1 仅接受 null 或 "css"，"less" 时抛错
 * @returns JS 对象字面量字符串
 */
export function compileStyle(style: string, startLine: number, lang: string | null): string;
```

**实现：** 用 `postcss` 解析 AST，遍历 Rule 节点。

```text
postcss.parse(css)
  → 遍历 root.nodes
  → Rule 节点：selector 作为 key
      → 遍历 rule.nodes（Declaration）
      → prop 转 camelCase，value 原样保留
  → AtRule（@media 等）：V1 记录 warning 并跳过
  → Comment：忽略
```

**kebab → camel 转换规则：**

```text
font-size      → fontSize
flex-direction → flexDirection
-webkit-mask   → 保持原样（以 - 开头的厂商前缀不转换，warning）
```

**选择器处理：** 不做任何规范化，`.wrapper .title` 原样作为 key。Runtime 的 StyleResolver 负责匹配逻辑，编译器不解释选择器语义。

---

### Script Compiler

**文件：** `src/compiler/script-compiler.ts`

**职责：** JS 语法转换 + `require` 重写，输出 CommonJS 模块函数体。

```typescript
/**
 * 编译 <script> 区块。
 * @param script    script 区块源码
 * @param startLine 区块起始行号
 * @returns 形如 function (module, exports, $app_require$) { ... } 的模块函数字符串
 */
export function compileScript(script: string, startLine: number): string;
```

**转换项：**

| 源码 | 产物 |
|---|---|
| `export default { ... }` | `exports.default = { ... }` |
| `import x from 'y'` | `var x = $app_require$('y')` |
| `require('@app-module/system.router')` | `$app_require$('@app-module/system.router')` |
| 箭头函数、模板字符串、解构 | 原样保留（QuickJS 支持 ES2020） |

**实现选择：** 用 Babel（`@babel/core` + 自定义 plugin）做 AST 转换，而不是正则替换。正则无法正确处理字符串内的 `require`、注释中的 `import` 等情况。

**为什么不做降级：** 目标引擎是 QuickJS，支持 ES2020。降级到 ES5 只会增大体积并引入 polyfill 依赖。

---

### Manifest Processor

**文件：** `src/manifest/processor.ts`

```typescript
/**
 * 读取、验证并按 mode 处理 manifest.json。
 * @param srcDir 源码目录，manifest.json 应位于此目录下
 * @param mode   构建模式，决定 config.debug 取值
 * @returns 处理后的 manifest 对象，可直接序列化写入 RPK
 * @throws ManifestError 必填字段缺失或页面文件不存在
 */
export function processManifest(srcDir: string, mode: BuildMode): Manifest;
```

**验证清单：**

```text
必填：package、name、versionName、versionCode、router.entry、router.pages
router.entry 必须存在于 router.pages 的 key 集合中
router.pages 每个 key 对应的 <srcDir>/<key>/<component>.ux 必须存在
features 数组元素必须有 name 字段
```

**mode 注入：**

```text
debug   → config.debug = true,  config.logLevel = "debug"
release → config.debug = false, config.logLevel = "error"
```

---

### RPK Packager

**文件：** `src/packager/rpk-packager.ts`

```typescript
/**
 * 将编译产物打包为 RPK（ZIP）。
 * @param ctx      构建上下文，提供 distDir、mode、manifest
 * @param bundles  页面路径 → bundle 内容的映射，如 { "pages/Demo/index.js": "..." }
 * @param assets   资源相对路径 → 文件绝对路径的映射
 * @returns 生成的 .rpk 文件绝对路径
 */
export function packRPK(
  ctx: BuildContext,
  bundles: Map<string, string>,
  assets: Map<string, string>
): string;
```

**压缩策略：**

| 文件类型 | 方法 | 理由 |
|---|---|---|
| `.js` / `.json` | DEFLATE | 文本压缩比高 |
| `.png` / `.jpg` / 二进制 | STORE | 已压缩，二次压缩收益为负 |

**产物命名：**

```text
dist/<manifest.package>.<mode>.<manifest.versionName>.rpk

示例：
dist/com.example.case1.debug.1.0.0.rpk
dist/com.example.case1.release.1.0.0.rpk
```

**build.txt 内容：**

```text
originType=quickapp-toolkit
toolkit=<toolkit version>
timeStamp=<ISO 8601>
node=<process.version>
platform=<process.platform>
arch=<process.arch>
app:app=<app.js 的 SHA256>
page:pages/Demo=<Demo bundle 的 SHA256>
```

**原子写入：** 先写 `dist/.tmp/<name>.rpk`，全部条目写入成功后 rename 到最终路径。保证 Property 8。

---

## Bundle 产物格式

这是 toolkit 与 Runtime 之间的核心契约。产物必须与官方 hap-toolkit 的结构等价。

### 页面 Bundle 结构

```javascript
(function () {
  var createPageHandler = function () {
    return (() => {
      // ============ 模块表 ============
      var __webpack_modules__ = {

        // 模块 1：VM 定义（script 编译产物）
        "script": (module, exports, $app_require$) => {
          module.exports = function __scriptModule__(module, exports, $app_require$) {
            var _system = $app_require$("@app-module/system.router");
            exports.default = {
              private: { title: '欢迎体验快应用开发' },
              onInit() { /* ... */ },
              onDetailBtnClick() {
                _system.default.push({ uri: '/pages/DemoDetail' });
              }
            };
          };
        },

        // 模块 2：样式表（style 编译产物）
        "style": (module) => {
          module.exports = {
            ".wrapper": {
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center"
            },
            ".wrapper .title": {
              fontSize: "40px",
              textAlign: "center",
              color: "#000000"
            }
          };
        },

        // 模块 3：模板树（template 编译产物）
        "template": (module) => {
          module.exports = {
            type: "div",
            attr: {},
            classList: ["wrapper"],
            children: [
              {
                type: "text",
                attr: { value: function () { return this.title } },
                classList: ["title"]
              },
              {
                type: "input",
                attr: { type: "button", value: "跳转到详情页" },
                classList: ["btn"],
                events: { click: "onDetailBtnClick" }
              }
            ]
          };
        }
      };

      // ============ 最小 webpack runtime ============
      var __webpack_module_cache__ = {};
      function __webpack_require__(moduleId) {
        var cached = __webpack_module_cache__[moduleId];
        if (cached !== undefined) return cached.exports;
        var module = __webpack_module_cache__[moduleId] = { exports: {} };
        __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
        return module.exports;
      }

      // ============ 注册与启动 ============
      var $app_script$ = __webpack_require__("script");

      $app_define$('@app-component/index', [], function ($app_require$, $app_exports$, $app_module$) {
        $app_script$($app_module$, $app_exports$, $app_require$);
        if ($app_exports$.__esModule && $app_exports$.default) {
          $app_module$.exports = $app_exports$.default;
        }
        $app_module$.exports.template = __webpack_require__("template");
        $app_module$.exports.style = __webpack_require__("style");
      });

      $app_bootstrap$('@app-component/index', { packagerVersion: "1.0.0" });
    })();
  };

  if (typeof window === "undefined") {
    return createPageHandler();
  } else {
    window.createPageHandler = createPageHandler;
  }
})();
```

### 契约要点

| 要点 | 约束 | Runtime 依赖 |
|---|---|---|
| IIFE 包裹 | 不污染全局，`window` 未定义时直接执行 | Runtime eval 后立即生效 |
| `$app_define$` 组件名 | 页面固定为 `@app-component/index` | framework.js 按此名查找 |
| `$app_bootstrap$` 时机 | 必须在 `$app_define$` 之后同步调用 | 触发 VM 创建 |
| `exports.template` | 必须是 JSON 树对象 | VNode 构建输入 |
| `exports.style` | 必须是选择器 → 属性对象 | StyleResolver 输入 |
| `exports.private` | VM 初始数据 | VM data 初始化 |
| 函数属性 | `function () { return this.x }`，非箭头函数 | `this` 必须绑定 VM |

**函数属性为什么不能用箭头函数：** 箭头函数没有自己的 `this`，framework.js 用 `fn.call(vm)` 求值时无法绑定 VM 实例。

### app.js 结构

```javascript
(function () {
  $app_define$("@app-application/app", [], function ($app_require$, $app_exports$, $app_module$) {
    $app_module$.exports.manifest = { /* manifest 副本 */ };
    $app_module$.exports.onCreate = function () { /* ... */ };
  });
  $app_bootstrap$("@app-application/app", { packagerVersion: "1.0.0" });
})();
```

app.js 无 template/style，只有应用级生命周期和全局变量注入。

---

## Directory Structure

```text
quickapp-toolkit/
├── package.json
├── tsconfig.json
├── bin/
│   └── quickapp.js              ← CLI 入口（shebang）
├── src/
│   ├── cli/
│   │   ├── index.ts             ← 命令注册与 argv 解析
│   │   ├── cmd-init.ts          ← quickapp init
│   │   ├── cmd-build.ts         ← quickapp build
│   │   └── cmd-watch.ts         ← quickapp watch
│   ├── parser/
│   │   └── sfc-parser.ts        ← .ux → SFCDescriptor
│   ├── compiler/
│   │   ├── template-compiler.ts ← XML → JSON 树
│   │   ├── style-compiler.ts    ← CSS → JS 对象
│   │   ├── script-compiler.ts   ← JS 转换 + require 重写
│   │   └── serializer.ts        ← 含 function 的对象字面量序列化
│   ├── bundler/
│   │   ├── assembler.ts         ← 三路产物 → bundle 字符串
│   │   └── templates.ts         ← bundle 骨架模板字符串
│   ├── manifest/
│   │   ├── processor.ts         ← 验证 + mode 注入
│   │   └── schema.ts            ← Manifest 类型与校验规则
│   ├── packager/
│   │   ├── rpk-packager.ts      ← ZIP 打包
│   │   └── build-info.ts        ← build.txt 生成
│   ├── minify/
│   │   └── minifier.ts          ← Terser 封装
│   ├── scanner/
│   │   └── project-scanner.ts   ← 项目结构扫描
│   ├── diagnostics/
│   │   ├── diagnostic.ts        ← Diagnostic 类型与格式化输出
│   │   └── errors.ts            ← 各阶段错误类型定义
│   └── types/
│       └── index.ts             ← 共享类型（SFCDescriptor、BuildContext 等）
├── templates/                   ← quickapp init 用的项目模板
│   └── default/
│       ├── manifest.json
│       ├── app.ux
│       └── pages/Demo/index.ux
└── test/
    ├── fixtures/                ← 测试用 .ux 源码与预期产物
    ├── unit/
    └── integration/
```

---

## Key Decisions

### 1. 自研管线而非直接复用 webpack

**决策：** 不把 webpack 作为主编译器，只在产物中生成一个最小 webpack runtime（约 10 行）。

**理由：** 快应用的 bundle 格式固定且简单——三个模块 + 注册启动代码。引入完整 webpack 会带来配置复杂度、loader 生态依赖和构建速度损耗，而我们只需要它的模块表格式。自研拼装可控性和速度都更好。

**代价：** 无法直接复用 webpack 的 npm 依赖打包能力。V1 假设页面不依赖第三方 npm 包；V2 需要时再引入真实 bundler。

### 2. 模板编译输出字面量字符串而非 JSON

**决策：** `compileTemplate` 返回 JS 代码字符串，不返回可 `JSON.stringify` 的对象。

**理由：** 模板中的插值必须编译为真实 function。JSON 无法表达函数，任何序列化方案都要在最后一步做字符串替换，不如从一开始就按代码字符串处理。

**代价：** 需要自研序列化器，测试时不能直接用对象断言，要比对字符串或 eval 后断言。

### 3. Babel 处理 script 而非正则

**决策：** `require` 重写和 ES module 转换用 Babel AST plugin。

**理由：** 正则会误伤字符串常量和注释中的 `require`/`import`。这类 bug 在编译期不报错，只在运行时表现为模块找不到，排查成本高。

**代价：** 增加约 30MB 的 Babel 依赖和编译耗时。可接受，因为编译不在热路径上。

### 4. 不做 ES5 降级

**决策：** 保留 ES2020 语法，不引入 `@babel/preset-env`。

**理由：** 目标引擎是 QuickJS，完整支持 ES2020。降级只增大体积、引入 polyfill 并降低可读性。

**边界：** 如果未来要支持更老的 JS 引擎，降级作为可选 flag 加入，不改默认行为。

### 5. 样式选择器不做语义解析

**决策：** 编译器只把选择器字符串原样作为 key，不解析后代关系、不计算优先级。

**理由：** 选择器匹配是 Runtime StyleResolver 的职责。编译期解析会导致同一份逻辑在 toolkit 和三端 Runtime 中重复实现，产生不一致风险。

**契约：** 编译器保证 key 是原始选择器文本，Runtime 保证按 CSS 层叠规则匹配。

### 6. 原子写入 RPK

**决策：** 先写临时文件再 rename。

**理由：** 编译失败或进程被中断时，不能留下损坏的 `.rpk`。损坏包在 Runtime 侧表现为 ZIP 解析错误，排查方向会被误导到 Runtime。

### 7. Debug/Release 只差压缩

**决策：** 两种模式共用同一条编译管线，只在 Minifier 步骤和 manifest 的 `config.debug` 字段上分叉。

**理由：** 如果两种模式走不同代码路径，会出现「debug 能跑 release 崩」的问题。共用管线保证 Property 5。

### 8. 增量编译以页面为粒度

**决策：** `watch` 模式下单个 `.ux` 变更只重编译该页面 bundle。

**理由：** 页面之间没有编译期依赖（模板、样式、脚本都是页面私有）。页面粒度是天然的增量边界，无需依赖图分析。

**例外：** `manifest.json` 变更影响路由和全局配置，触发全量重建。
