# Step 6：Style Compiler

## 目录

- [目标](#目标)
- [Step 6.1：目标产物结构](#step-61目标产物结构)
- [Step 6.2：实现属性名转换](#step-62实现属性名转换)
- [Step 6.3：实现 CSS 解析](#step-63实现-css-解析)
- [Step 6.4：实现编译入口](#step-64实现编译入口)
- [Step 6.5：单元测试](#step-65单元测试)
- [Step 6.6：逐层验证](#step-66逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 `<style>` 的 CSS 编译为 JS 样式对象代码字符串。**

| 输入 | 输出 |
|---|---|
| `.wrapper { flex-direction: column }` | `{ ".wrapper": { flexDirection: "column" } }` |

**验收标准：**
- 选择器原样作为 key，包括后代选择器的空格
- 属性名 kebab-case 转 camelCase
- 属性值保留原始字符串（`40px` 不转数字）
- 厂商前缀属性保持原样并产生 warning
- `@media` 等 at-rule 跳过并产生 warning
- CSS 语法错误报错，附文件绝对行号

**本步不包含：**
- 选择器语义解析（优先级、后代关系匹配）—— 属于 Runtime 侧 StyleResolver
- Less/Sass 预处理（V1 不支持）
- 单位换算（`rem` → `px`）—— Runtime 侧处理
- 样式合并与去重

---

## Step 6.1：目标产物结构

示例项目 `pages/Demo/index.ux` 的样式：

```css
<style>
.wrapper {
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.wrapper .title {
  font-size: 40px;
  text-align: center;
  color: #000000;
}
.wrapper .btn {
  width: 450px;
  height: 80px;
  border-radius: 40px;
  background-color: #09ba07;
  color: #ffffff;
  font-size: 30px;
  margin-top: 80px;
}
</style>
```

官方 hap-toolkit 产物：

```javascript
{
  ".wrapper": {
    "flexDirection": "column",
    "justifyContent": "center",
    "alignItems": "center"
  },
  ".wrapper .title": {
    "fontSize": "40px",
    "textAlign": "center",
    "color": "#000000",
    "_meta": { "ruleDef": [...] }
  },
  ".wrapper .btn": {
    "width": "450px",
    "height": "80px",
    "borderRadius": "40px",
    "backgroundColor": "#09ba07",
    "color": "#ffffff",
    "fontSize": "30px",
    "marginTop": "80px",
    "_meta": { "ruleDef": [...] }
  }
}
```

三个观察点：

**选择器原样作为 key，包括空格。** `.wrapper .title` 保持完整字符串，不拆分、不规范化。Runtime 侧的 `StyleResolver` 负责匹配逻辑。

**属性名转 camelCase，属性值保留原始字符串。** `font-size: 40px` → `fontSize: "40px"`。值不转数字——Runtime 侧的 `parsePx` 负责解析单位。

**官方产物有 `_meta.ruleDef` 字段。** 这是官方工具链的内部元数据，用于选择器优先级计算。我们不生成它。理由见技术决策——当前 Runtime 侧的 `resolveStyles` 不读这个字段。

回顾 Runtime 侧的实现（`style_resolver.cpp`）：

```cpp
void resolveStyles(VNode* root, const StyleSheet& styleSheet) {
    for (const auto& cls : root->classList) {
        std::string selector = "." + cls;
        auto it = styleSheet.find(selector);
        if (it != styleSheet.end()) {
            for (const auto& [key, value] : it->second) {
                root->styles[key] = value;
            }
        }
    }
    for (auto& child : root->children) {
        resolveStyles(child.get(), styleSheet);
    }
}
```

当前 Runtime 只匹配单 class 选择器（`.wrapper`），后代选择器（`.wrapper .title`）会因为 key 不匹配而被忽略。这是 Runtime 侧的已知限制，不是 toolkit 的问题——toolkit 忠实产出所有选择器，Runtime 逐步补全匹配能力。

---

## Step 6.2：实现属性名转换

```text
@add quickapp-toolkit/src/compiler/css-property.ts（新建文件）
```

```typescript
/**
 * 匹配 kebab-case 中的连字符加后续字母。
 * 用于 font-size -> fontSize 转换。
 */
const KEBAB_SEGMENT = /-([a-z])/g;

/**
 * 厂商前缀属性：以连字符开头。
 *
 * 这类属性不做 camelCase 转换。原因：-webkit-mask 转换后是
 * WebkitMask（首字母大写），而 CSS-in-JS 的约定是 webkitMask
 * （首字母小写）。两种约定不一致，且快应用不支持厂商前缀属性，
 * 转换没有意义。保持原样并产生 warning 更清晰。
 */
const VENDOR_PREFIX = /^-/;

/**
 * CSS 自定义属性（CSS 变量）：以两个连字符开头。
 * 这类属性名必须保持原样，转换后无法被 CSS 引擎识别。
 */
const CSS_VARIABLE = /^--/;

/**
 * 判断属性名是否为厂商前缀或 CSS 变量。
 * @param prop CSS 属性名
 * @returns true 表示不应做 camelCase 转换
 */
export function isSpecialProperty(prop: string): boolean {
  return CSS_VARIABLE.test(prop) || VENDOR_PREFIX.test(prop);
}

/**
 * 把 kebab-case 属性名转为 camelCase。
 *
 * 厂商前缀和 CSS 变量原样返回 —— 调用方应先用 isSpecialProperty
 * 判断并产生 warning，本函数只保证不破坏这类属性名。
 *
 * @param prop CSS 属性名，如 "font-size"
 * @returns camelCase 属性名，如 "fontSize"
 */
export function toCamelCase(prop: string): string {
  if (isSpecialProperty(prop)) return prop;
  return prop.replace(KEBAB_SEGMENT, (_, ch: string) => ch.toUpperCase());
}
```

转换规则的边界情况：

```text
font-size          -> fontSize
flex-direction     -> flexDirection
border-top-width   -> borderTopWidth
color              -> color            （无连字符，原样）
-webkit-mask       -> -webkit-mask     （厂商前缀，原样 + warning）
--my-var           -> --my-var         （CSS 变量，原样）
font-Size          -> font-Size        （连字符后是大写，正则不匹配，原样）
```

最后一种情况是刻意的：`font-Size` 是错误写法，保持原样让它在 Runtime 侧表现为「属性名不识别」，而不是被静默「修正」成 `fontSize`。静默修正会掩盖开发者的拼写错误。

---

## Step 6.3：实现 CSS 解析

```text
@add quickapp-toolkit/src/compiler/style-compiler.ts（新建文件）
```

```typescript
import postcss, { type Root, type Rule, type Declaration, type AtRule } from 'postcss';
import type { Diagnostic } from '../types';
import { StyleCompileError } from '../diagnostics/errors';
import { toCamelCase, isSpecialProperty } from './css-property';

/**
 * 编译后的样式表。
 *
 * key   完整选择器字符串，如 ".wrapper" 或 ".wrapper .title"
 * value 属性名（camelCase）到属性值（原始字符串）的映射
 */
export type StyleSheet = Record<string, Record<string, string>>;

/**
 * 样式编译结果。
 *
 * 与模板编译不同，样式编译的非致命问题（厂商前缀、at-rule）
 * 不中断编译，而是收集为 warning 一起返回。
 */
export interface StyleCompileResult {
  sheet: StyleSheet;
  diagnostics: Diagnostic[];
}

/**
 * 把 postcss 节点的行号换算为文件绝对行号。
 *
 * postcss 的 source.start.line 是区块内相对行号（1-based），
 * 需要加上区块起始行号的偏移。
 *
 * @param node      postcss 节点
 * @param startLine 区块在文件中的起始行号
 * @returns 文件绝对行号；节点无位置信息时返回 startLine
 */
function nodeLine(node: { source?: { start?: { line: number } } }, startLine: number): number {
  const line = node.source?.start?.line;
  return line === undefined ? startLine : startLine + line - 1;
}

/**
 * 把 postcss 节点的列号取出。
 * @param node postcss 节点
 * @returns 列号（1-based）；无位置信息时返回 0
 */
function nodeColumn(node: { source?: { start?: { column: number } } }): number {
  return node.source?.start?.column ?? 0;
}

/**
 * 处理单条 CSS 声明，写入目标属性集合。
 *
 * @param decl        postcss Declaration 节点
 * @param target      目标属性集合，原地写入
 * @param filename    源文件绝对路径
 * @param startLine   区块起始行号
 * @param diagnostics 诊断收集数组
 */
function processDeclaration(
  decl: Declaration,
  target: Record<string, string>,
  filename: string,
  startLine: number,
  diagnostics: Diagnostic[]
): void {
  const prop = decl.prop;

  if (isSpecialProperty(prop)) {
    diagnostics.push({
      severity: 'warning',
      file: filename,
      line: nodeLine(decl, startLine),
      column: nodeColumn(decl),
      message: `属性 "${prop}" 是厂商前缀或 CSS 变量，快应用不支持，已原样透传`,
    });
  }

  // 值保留原始字符串，不做单位换算或颜色规范化。
  // Runtime 侧的 parsePx 和颜色解析负责这些转换 —— 编译期换算会
  // 导致同一逻辑在 toolkit 和三端 Runtime 重复实现，产生不一致风险
  target[toCamelCase(prop)] = decl.value.trim();
}

/**
 * 处理 at-rule（@media、@keyframes 等）。
 *
 * V1 不支持任何 at-rule：Runtime 侧的 StyleResolver 只做
 * 选择器到属性的平面映射，没有条件规则和动画的概念。
 *
 * @param atRule      postcss AtRule 节点
 * @param filename    源文件绝对路径
 * @param startLine   区块起始行号
 * @param diagnostics 诊断收集数组
 */
function processAtRule(
  atRule: AtRule,
  filename: string,
  startLine: number,
  diagnostics: Diagnostic[]
): void {
  diagnostics.push({
    severity: 'warning',
    file: filename,
    line: nodeLine(atRule, startLine),
    column: nodeColumn(atRule),
    message: `@${atRule.name} 规则 V1 不支持，已跳过其中的 ${atRule.nodes?.length ?? 0} 条规则`,
  });
}

/**
 * 处理单条样式规则。
 *
 * 一条规则可能有多个选择器（逗号分隔），每个选择器独立成为
 * 产物中的一个 key，属性集合相同。这与 CSS 语义一致。
 *
 * @param rule        postcss Rule 节点
 * @param sheet       目标样式表，原地写入
 * @param filename    源文件绝对路径
 * @param startLine   区块起始行号
 * @param diagnostics 诊断收集数组
 */
function processRule(
  rule: Rule,
  sheet: StyleSheet,
  filename: string,
  startLine: number,
  diagnostics: Diagnostic[]
): void {
  const declarations: Record<string, string> = {};

  for (const node of rule.nodes) {
    if (node.type === 'decl') {
      processDeclaration(node, declarations, filename, startLine, diagnostics);
    }
    // 嵌套规则（Less 语法）在此被忽略。
    // V1 不支持预处理器，SFCParser 已对 lang="less" 报错，
    // 但纯 CSS 里也可能出现嵌套（CSS Nesting 规范），一并跳过
    else if (node.type === 'rule') {
      diagnostics.push({
        severity: 'warning',
        file: filename,
        line: nodeLine(node, startLine),
        column: nodeColumn(node),
        message: `嵌套规则 "${node.selector}" V1 不支持，已跳过`,
      });
    }
  }

  if (Object.keys(declarations).length === 0) {
    // 空规则不写入产物，避免 Runtime 侧匹配到空属性集合
    return;
  }

  // 逗号分隔的多选择器：每个独立成为一个 key。
  // rule.selectors 是 postcss 提供的已拆分数组
  for (const selector of rule.selectors) {
    const key = selector.trim();
    if (key === '') continue;

    if (sheet[key] === undefined) {
      sheet[key] = { ...declarations };
    } else {
      // 同一选择器多次出现：后者覆盖前者的同名属性，
      // 保留前者的其他属性。这与 CSS 层叠语义一致
      Object.assign(sheet[key], declarations);
    }
  }
}
```

---

## Step 6.4：实现编译入口

```text
@add quickapp-toolkit/src/compiler/style-compiler.ts — 在 processRule 之后插入
```

```typescript
import { serialize } from './serializer';
import type { BuildMode } from '../types';

/**
 * 编译 <style> 区块为样式表对象。
 *
 * 非致命问题（厂商前缀、at-rule、嵌套规则）收集为 warning 返回，
 * 不中断编译。只有 CSS 语法错误才抛出。
 *
 * @param style     style 区块源码（不含 <style> 标签本身）
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号，用于错误行号换算
 * @param lang      lang 属性值；非 null 且非 "css" 时抛错
 * @returns 样式表对象和诊断列表
 * @throws StyleCompileError CSS 语法错误或不支持的 lang
 */
export function compileStyleToSheet(
  style: string,
  filename: string,
  startLine: number,
  lang: string | null = null
): StyleCompileResult {
  if (lang !== null && lang !== 'css') {
    throw new StyleCompileError(
      `<style lang="${lang}"> 暂不支持，V1 仅支持纯 CSS`,
      filename,
      startLine - 1
    );
  }

  const diagnostics: Diagnostic[] = [];

  // 空样式返回空表，不报错。纯展示组件可能没有样式
  if (style.trim() === '') {
    return { sheet: {}, diagnostics };
  }

  let root: Root;
  try {
    root = postcss.parse(style, { from: filename });
  } catch (e) {
    // postcss 的 CssSyntaxError 带 line 和 column，都是区块相对值
    const err = e as { line?: number; column?: number; reason?: string; message: string };
    throw new StyleCompileError(
      `CSS 语法错误：${err.reason ?? err.message}`,
      filename,
      err.line === undefined ? startLine : startLine + err.line - 1,
      err.column ?? 0
    );
  }

  const sheet: StyleSheet = {};

  for (const node of root.nodes) {
    if (node.type === 'rule') {
      processRule(node, sheet, filename, startLine, diagnostics);
    } else if (node.type === 'atrule') {
      processAtRule(node, filename, startLine, diagnostics);
    }
    // comment 类型忽略，不产生诊断
  }

  return { sheet, diagnostics };
}

/**
 * 编译 <style> 区块为 JS 对象字面量代码字符串。
 *
 * @param style     style 区块源码
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号
 * @param lang      lang 属性值
 * @param mode      构建模式；release 使用紧凑序列化
 * @returns 代码字符串和诊断列表
 * @throws StyleCompileError CSS 语法错误或不支持的 lang
 */
export function compileStyle(
  style: string,
  filename: string,
  startLine: number,
  lang: string | null = null,
  mode: BuildMode = 'debug'
): { code: string; diagnostics: Diagnostic[] } {
  const { sheet, diagnostics } = compileStyleToSheet(style, filename, startLine, lang);
  return {
    code: serialize(sheet, mode === 'release' ? -1 : 0),
    diagnostics,
  };
}
```

与 Template Compiler 的一个差异：样式编译返回 `diagnostics` 数组，模板编译直接抛错。

原因是两者的失败性质不同。模板结构错误（未闭合标签、未知组件）会导致产物结构错误，无法继续。样式里的厂商前缀属性只是「这条属性 Runtime 不认」，其余属性仍然有效——产出部分可用的样式表比中断整个页面编译更合理。

---

## Step 6.5：单元测试

```text
@add quickapp-toolkit/test/unit/style-compiler.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  compileStyleToSheet,
  compileStyle,
} = require('../../dist/compiler/style-compiler.js');
const { toCamelCase, isSpecialProperty } = require('../../dist/compiler/css-property.js');
const { StyleCompileError } = require('../../dist/diagnostics/errors.js');

const FILE = '/proj/src/pages/Demo/index.ux';

/** 编译辅助，默认 startLine=2 */
function sheet(css, startLine = 2) {
  return compileStyleToSheet(css, FILE, startLine).sheet;
}

/** 只取诊断 */
function diags(css, startLine = 2) {
  return compileStyleToSheet(css, FILE, startLine).diagnostics;
}

// ---------- 属性名转换 ----------

test('kebab 转 camel', () => {
  assert.strictEqual(toCamelCase('font-size'), 'fontSize');
  assert.strictEqual(toCamelCase('flex-direction'), 'flexDirection');
  assert.strictEqual(toCamelCase('border-top-width'), 'borderTopWidth');
  assert.strictEqual(toCamelCase('background-color'), 'backgroundColor');
});

test('无连字符属性名原样', () => {
  assert.strictEqual(toCamelCase('color'), 'color');
  assert.strictEqual(toCamelCase('width'), 'width');
});

test('厂商前缀原样', () => {
  assert.strictEqual(toCamelCase('-webkit-mask'), '-webkit-mask');
  assert.strictEqual(toCamelCase('-moz-appearance'), '-moz-appearance');
});

test('CSS 变量原样', () => {
  assert.strictEqual(toCamelCase('--my-var'), '--my-var');
});

test('连字符后大写字母不转换', () => {
  // font-Size 是错误写法，保持原样让 Runtime 侧暴露问题，
  // 而不是静默"修正"掩盖拼写错误
  assert.strictEqual(toCamelCase('font-Size'), 'font-Size');
});

test('isSpecialProperty 识别', () => {
  assert.strictEqual(isSpecialProperty('-webkit-mask'), true);
  assert.strictEqual(isSpecialProperty('--var'), true);
  assert.strictEqual(isSpecialProperty('font-size'), false);
});

// ---------- 基本编译 ----------

test('单个选择器单个属性', () => {
  assert.deepStrictEqual(sheet('.a { color: red }'), {
    '.a': { color: 'red' },
  });
});

test('单个选择器多个属性', () => {
  assert.deepStrictEqual(
    sheet('.a { color: red; font-size: 12px }'),
    { '.a': { color: 'red', fontSize: '12px' } }
  );
});

test('多个选择器', () => {
  assert.deepStrictEqual(
    sheet('.a { color: red } .b { width: 10px }'),
    { '.a': { color: 'red' }, '.b': { width: '10px' } }
  );
});

test('空样式返回空对象', () => {
  assert.deepStrictEqual(sheet(''), {});
  assert.deepStrictEqual(sheet('   \n  '), {});
});

test('空规则不写入产物', () => {
  assert.deepStrictEqual(sheet('.a { }'), {});
});

test('注释被忽略', () => {
  assert.deepStrictEqual(
    sheet('/* 注释 */ .a { color: red /* 行内注释 */ }'),
    { '.a': { color: 'red' } }
  );
});

// ---------- 选择器处理 ----------

test('后代选择器保持完整字符串', () => {
  assert.deepStrictEqual(
    sheet('.wrapper .title { font-size: 40px }'),
    { '.wrapper .title': { fontSize: '40px' } }
  );
});

test('多级后代选择器', () => {
  const s = sheet('.a .b .c { color: red }');
  assert.ok('.a .b .c' in s);
});

test('伪类选择器保持原样', () => {
  const s = sheet('.btn:active { background-color: #ccc }');
  assert.ok('.btn:active' in s);
});

test('标签选择器', () => {
  assert.deepStrictEqual(sheet('text { color: red }'), {
    text: { color: 'red' },
  });
});

test('逗号分隔的多选择器拆分为多个 key', () => {
  assert.deepStrictEqual(
    sheet('.a, .b { color: red }'),
    { '.a': { color: 'red' }, '.b': { color: 'red' } }
  );
});

test('逗号多选择器的属性集合互相独立', () => {
  const s = sheet('.a, .b { color: red }');
  s['.a'].color = 'blue';
  assert.strictEqual(s['.b'].color, 'red', '不应共享同一对象引用');
});

test('同一选择器出现两次时属性合并', () => {
  assert.deepStrictEqual(
    sheet('.a { color: red } .a { width: 10px }'),
    { '.a': { color: 'red', width: '10px' } }
  );
});

test('同一选择器同名属性后者覆盖', () => {
  assert.deepStrictEqual(
    sheet('.a { color: red } .a { color: blue }'),
    { '.a': { color: 'blue' } }
  );
});

// ---------- 属性值处理 ----------

test('带单位的值保留原始字符串', () => {
  const s = sheet('.a { width: 450px; height: 80px }');
  assert.strictEqual(s['.a'].width, '450px');
  assert.strictEqual(typeof s['.a'].width, 'string');
});

test('数值不转数字', () => {
  const s = sheet('.a { flex: 1 }');
  assert.strictEqual(s['.a'].flex, '1');
  assert.strictEqual(typeof s['.a'].flex, 'string');
});

test('颜色值原样保留', () => {
  const s = sheet('.a { color: #09ba07; background-color: rgb(1, 2, 3) }');
  assert.strictEqual(s['.a'].color, '#09ba07');
  assert.strictEqual(s['.a'].backgroundColor, 'rgb(1, 2, 3)');
});

test('属性值首尾空白被去除', () => {
  const s = sheet('.a { color:   red   }');
  assert.strictEqual(s['.a'].color, 'red');
});

test('复合值保留内部空格', () => {
  const s = sheet('.a { margin: 10px 20px }');
  assert.strictEqual(s['.a'].margin, '10px 20px');
});

// ---------- 诊断 ----------

test('厂商前缀产生 warning', () => {
  const d = diags('.a { -webkit-mask: none }');
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].severity, 'warning');
  assert.match(d[0].message, /-webkit-mask/);
});

test('厂商前缀属性仍然写入产物', () => {
  const s = sheet('.a { -webkit-mask: none; color: red }');
  assert.strictEqual(s['.a']['-webkit-mask'], 'none');
  assert.strictEqual(s['.a'].color, 'red');
});

test('at-rule 产生 warning 并被跳过', () => {
  const d = diags('@media (min-width: 100px) { .a { color: red } }');
  assert.strictEqual(d.length, 1);
  assert.match(d[0].message, /@media/);
});

test('at-rule 内的规则不进入产物', () => {
  const s = sheet('.a { color: red } @media screen { .b { color: blue } }');
  assert.ok('.a' in s);
  assert.ok(!('.b' in s));
});

test('嵌套规则产生 warning 并被跳过', () => {
  const d = diags('.a { color: red; .b { color: blue } }');
  assert.ok(d.some((x) => /嵌套规则/.test(x.message)));
});

test('warning 的行号是文件绝对行号', () => {
  // startLine=10，厂商前缀在区块第 2 行 -> 文件第 11 行
  const d = diags('.a {\n  -webkit-mask: none;\n}', 10);
  assert.strictEqual(d[0].line, 11);
});

test('正常 CSS 无诊断', () => {
  assert.strictEqual(diags('.a { color: red; font-size: 12px }').length, 0);
});

// ---------- 错误处理 ----------

test('CSS 语法错误抛出并附文件绝对行号', () => {
  // startLine=20，错误在区块第 2 行 -> 文件第 21 行
  assert.throws(
    () => sheet('.a {\n  color: red\n', 20),
    (err) => {
      assert.ok(err instanceof StyleCompileError);
      assert.strictEqual(err.file, FILE);
      assert.ok(err.line >= 20, `行号应 >= 20，实际 ${err.line}`);
      assert.match(err.message, /CSS 语法错误/);
      return true;
    }
  );
});

test('lang=less 抛错', () => {
  assert.throws(
    () => compileStyleToSheet('.a { color: red }', FILE, 2, 'less'),
    (err) => {
      assert.match(err.message, /lang="less"/);
      return true;
    }
  );
});

test('lang=css 正常编译', () => {
  const r = compileStyleToSheet('.a { color: red }', FILE, 2, 'css');
  assert.deepStrictEqual(r.sheet, { '.a': { color: 'red' } });
});

// ---------- 产物可执行性 ----------

test('产物 eval 后与 sheet 等价', () => {
  const css = '.wrapper { flex-direction: column } .wrapper .title { font-size: 40px }';
  const { code } = compileStyle(css, FILE, 2);
  const result = eval(`(${code})`);
  assert.deepStrictEqual(result, sheet(css));
});

test('release 模式产出紧凑代码', () => {
  const css = '.a { color: red }';
  const pretty = compileStyle(css, FILE, 2, null, 'debug').code;
  const compact = compileStyle(css, FILE, 2, null, 'release').code;
  assert.ok(pretty.includes('\n'));
  assert.ok(!compact.includes('\n'));
  assert.deepStrictEqual(eval(`(${pretty})`), eval(`(${compact})`));
});

// ---------- 示例项目对齐 ----------

test('示例 Demo 样式产物与官方一致', () => {
  const css = [
    '.wrapper {',
    '  flex-direction: column;',
    '  justify-content: center;',
    '  align-items: center;',
    '}',
    '.wrapper .title {',
    '  font-size: 40px;',
    '  text-align: center;',
    '  color: #000000;',
    '}',
    '.wrapper .btn {',
    '  width: 450px;',
    '  height: 80px;',
    '  border-radius: 40px;',
    '  background-color: #09ba07;',
    '  color: #ffffff;',
    '  font-size: 30px;',
    '  margin-top: 80px;',
    '}',
  ].join('\n');

  assert.deepStrictEqual(sheet(css), {
    '.wrapper': {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    '.wrapper .title': {
      fontSize: '40px',
      textAlign: 'center',
      color: '#000000',
    },
    '.wrapper .btn': {
      width: '450px',
      height: '80px',
      borderRadius: '40px',
      backgroundColor: '#09ba07',
      color: '#ffffff',
      fontSize: '30px',
      marginTop: '80px',
    },
  });
});
```

---

## Step 6.6：逐层验证

### 6.6.1：安装依赖与编译

```bash
cd quickapp-toolkit
npm install postcss@8.4.38
npm run build && npm test
```

**预期：** style-compiler 的 38 个用例全部通过，累计 140 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `Cannot find module 'postcss'` | 依赖未安装 | `npm install postcss@8.4.38` |
| `TS2339: Property 'selectors' does not exist` | Rule 类型导入 | 从 postcss 导入 `type Rule` |
| `rule.nodes` 可能 undefined | postcss 类型定义 | Rule.nodes 非可选，AtRule.nodes 可选 |
| 行号测试失败，差 1 | `startLine + line - 1` | postcss 的 line 是 1-based，需减 1 再加 |

### 6.6.2：属性名转换验证

```bash
node -e "
const { toCamelCase } = require('./dist/compiler/css-property.js');
const cases = [
  'font-size', 'flex-direction', 'border-top-width', 'background-color',
  'color', 'width', 'align-items', 'justify-content',
  '-webkit-mask', '--my-var', 'font-Size'
];
for (const c of cases) {
  console.log(c.padEnd(20), '->', toCamelCase(c));
}
"
```

**预期输出：**

```text
font-size            -> fontSize
flex-direction       -> flexDirection
border-top-width     -> borderTopWidth
background-color     -> backgroundColor
color                -> color
width                -> width
align-items          -> alignItems
justify-content      -> justifyContent
-webkit-mask         -> -webkit-mask
--my-var             -> --my-var
font-Size            -> font-Size
```

**验证点：** 前八项转换正确，后三项原样保留。

`font-Size` 保持原样是刻意行为：这是错误写法，静默修正成 `fontSize` 会掩盖开发者的拼写问题。

### 6.6.3：选择器 key 完整性验证

```bash
node -e "
const { compileStyleToSheet } = require('./dist/compiler/style-compiler.js');
const css = [
  '.wrapper { flex-direction: column }',
  '.wrapper .title { font-size: 40px }',
  '.btn:active { background-color: #ccc }',
  'text { color: red }',
  '.a, .b { width: 10px }'
].join('\n');
const { sheet } = compileStyleToSheet(css, '/x.ux', 2);
for (const key of Object.keys(sheet)) {
  console.log(JSON.stringify(key));
}
"
```

**预期输出：**

```text
".wrapper"
".wrapper .title"
".btn:active"
"text"
".a"
".b"
```

**验证点：**
- `.wrapper .title` 的空格保留，未被拆分或规范化
- `.btn:active` 的伪类保留
- `.a, .b` 拆分为两个独立 key

如果 `.wrapper .title` 变成 `.wrapper.title`（空格丢失），Runtime 侧的选择器匹配会完全错误——这两个选择器的 CSS 语义不同（后代 vs 同时具有两个 class）。

### 6.6.4：属性值类型验证

```bash
node -e "
const { compileStyleToSheet } = require('./dist/compiler/style-compiler.js');
const css = '.a { width: 450px; flex: 1; color: #09ba07; margin: 10px 20px; opacity: 0.5 }';
const { sheet } = compileStyleToSheet(css, '/x.ux', 2);
for (const [k, v] of Object.entries(sheet['.a'])) {
  console.log(k.padEnd(16), JSON.stringify(v), typeof v);
}
"
```

**预期输出：**

```text
width            \"450px\" string
flex             \"1\" string
color            \"#09ba07\" string
margin           \"10px 20px\" string
opacity          \"0.5\" string
```

**验证点：** 所有值都是 string 类型。

`flex: 1` 保持为 `"1"` 而非数字 `1` 是关键：Runtime 侧的 `parsePx` 用 `strtof` 解析字符串，如果产物里是数字，C++ 的 JSON 解析会得到 number 类型，`JS_ToCString` 转换后虽然也能用，但类型不一致会让 Runtime 侧的处理逻辑需要分支。统一为 string 让 Runtime 只有一条路径。

### 6.6.5：warning 行号验证

```bash
node -e "
const { compileStyleToSheet } = require('./dist/compiler/style-compiler.js');
// 模拟 <style> 在文件第 17 行，内容从第 18 行开始
const css = [
  '.a {',                    // 文件第 18 行
  '  color: red;',           // 文件第 19 行
  '  -webkit-mask: none;',   // 文件第 20 行 <- warning
  '}',                       // 文件第 21 行
  '@media screen {',         // 文件第 22 行 <- warning
  '  .b { color: blue }',
  '}'
].join('\n');
const { diagnostics } = compileStyleToSheet(css, '/x/index.ux', 18);
for (const d of diagnostics) {
  console.log('行', d.line, '-', d.message);
}
"
```

**预期输出：**

```text
行 20 - 属性 "-webkit-mask" 是厂商前缀或 CSS 变量，快应用不支持，已原样透传
行 22 - @media 规则 V1 不支持，已跳过其中的 1 条规则
```

**验证点：** 两条 warning 的行号分别是 20 和 22，对应文件绝对位置。

如果行号是 3 和 5（区块相对行号），开发者按行号去看会看到 `<template>` 的内容。

### 6.6.6：CSS 语法错误验证

```bash
node -e "
const { compileStyleToSheet } = require('./dist/compiler/style-compiler.js');
try {
  // 缺少闭合大括号
  compileStyleToSheet('.a {\n  color: red\n', '/x/index.ux', 18);
} catch (e) {
  console.log('类型:', e.constructor.name);
  console.log('行号:', e.line);
  console.log('消息:', e.message);
}
"
```

**预期输出：**

```text
类型: StyleCompileError
行号: 18
消息: CSS 语法错误：Unclosed block
```

行号可能是 18 或 19（取决于 postcss 报告的位置），关键是 `>= 18` 而非 1 或 2。

### 6.6.7：示例项目端到端

```bash
node -e "
const fs = require('fs');
const { parseSFC } = require('./dist/parser/sfc-parser.js');
const { compileStyle } = require('./dist/compiler/style-compiler.js');

for (const page of ['Demo', 'DemoDetail']) {
  const file = '../quickapp-examples/quickapp-code-test1/src/pages/' + page + '/index.ux';
  const src = fs.readFileSync(file, 'utf8');
  const d = parseSFC(src, file);
  if (!d.style) { console.log(page, '无样式区块'); continue; }
  const { code, diagnostics } = compileStyle(d.style.content, file, d.style.startLine, d.style.lang);
  console.log('=== ' + page + ' ===');
  console.log(code);
  if (diagnostics.length > 0) {
    console.log('诊断:', diagnostics.length, '条');
    for (const x of diagnostics) console.log('  行', x.line, x.message);
  }
  console.log();
}
"
```

**预期：** 两个页面都编译成功，产物与 6.5 最后一个测试用例的期望结构一致，诊断为 0 条。

### 6.6.8：与官方产物对照

```bash
cd ../quickapp-examples/quickapp-code-test1/dist
[ -d debug ] || unzip -q com.example.case1.debug.1.0.0.rpk -d debug
grep -A 25 'style-loader' debug/pages/Demo/index.js | head -35
```

**对照清单：**

| 维度 | 官方产物 | 本工具链 | 必须一致 |
|---|---|---|---|
| 选择器 key | `".wrapper"`、`".wrapper .title"` | 同 | 是 |
| 属性名 | `flexDirection`、`fontSize` | 同 | 是 |
| 属性值 | `"40px"`、`"#000000"`（字符串） | 同 | 是 |
| 属性顺序 | 源码顺序 | 源码顺序 | 建议一致 |
| `_meta.ruleDef` | 存在 | 不生成 | 否，见技术决策 |
| 缩进格式 | 单行 | 2 空格（debug） | 否 |

`_meta` 是唯一的结构差异。当前 Runtime 侧不读它，不生成不影响功能。

---

## 技术决策

### 1. 选择器原样作为 key，不做语义解析

编译器不解析后代关系、不计算优先级、不规范化空格。选择器匹配是 Runtime 侧 `StyleResolver` 的职责。

理由是避免同一逻辑在四处重复实现（toolkit + Android/iOS/LVGL 三端 Runtime）。如果编译期就把 `.wrapper .title` 解析成结构化的选择器描述，三端 Runtime 要么各自实现匹配算法（会不一致），要么共用 C++ Core 的实现——那还不如让 Core 直接处理原始字符串。

契约是明确的：**toolkit 保证 key 是原始选择器文本，Runtime 保证按 CSS 层叠规则匹配。**

### 2. 属性值保留原始字符串，不做单位换算

`40px` 保持为 `"40px"`，不转成数字 40。理由同上：单位解析（px/rem/%）和设备像素换算是 Runtime 侧的职责，且三端的换算规则不同（Android 用 dp，LVGL 用像素）。

编译期换算会把平台特定逻辑固化到产物里，同一个 RPK 无法跨平台复用。

### 3. 不生成 `_meta.ruleDef`

官方产物里有这个字段，用于选择器优先级计算。当前 Runtime 侧的 `resolveStyles` 不读它——它按 `classList` 顺序遍历并合并，隐式地用「后者覆盖前者」作为优先级规则。

不生成的收益是产物更小、编译更简单。代价是将来 Runtime 要实现完整 CSS 层叠时需要补上这个字段。

这是一个明确的技术债，记录在此。补上的时机是 Runtime 侧开始处理选择器优先级冲突时。

### 4. 厂商前缀属性透传而非丢弃

`-webkit-mask` 会被写入产物并产生 warning。

丢弃看起来更「干净」，但会让开发者困惑：写了样式却没生效，也没有任何提示（如果只 warning 不透传，产物里没有痕迹）。透传 + warning 让开发者知道「这条属性我保留了，但快应用不认」。

Runtime 侧遇到不识别的属性名会忽略，不会崩溃。

### 5. at-rule 跳过而非报错

`@media`、`@keyframes` 产生 warning 并跳过其内容，不中断编译。

报错会让「代码从 Web 项目迁移过来，带了几个 @media」这种常见情况完全无法编译。跳过 + warning 让开发者能先跑起来，再逐步清理。

代价是响应式样式静默失效。warning 消息里明确说了「已跳过其中的 N 条规则」，信息足够。

### 6. 逗号多选择器拆分为独立 key，属性对象不共享引用

`.a, .b { color: red }` 产出两个 key，各自持有独立的属性对象副本（`{ ...declarations }`）。

如果共享同一个对象引用，后续对 `.a` 的属性合并会意外影响 `.b`。这类 bug 在「同一选择器出现两次」的场景下会暴露，且现象是「改了 A 的样式 B 也变了」，排查方向容易跑偏。

拷贝的内存代价可忽略（属性对象通常几个键）。

### 7. 空规则不写入产物

`.a { }` 不产生 `{".a": {}}`。

理由是 Runtime 侧匹配到空属性集合后会进入合并循环但什么都不做，是无意义的开销。且空规则通常是开发者删属性后的残留，产物里保留它没有价值。

### 8. 样式编译返回 diagnostics，模板编译直接抛错

两者失败性质不同。模板结构错误（未闭合标签）导致产物结构错误，无法继续。样式里的厂商前缀只是「这条属性 Runtime 不认」，其余属性仍有效。

产出部分可用的样式表比中断整个页面编译更合理——页面还能渲染出来，只是某些样式不生效。

### 9. 嵌套规则跳过并 warning

CSS Nesting 是新规范，postcss 8 能解析。但 Runtime 侧的样式表是平面结构，没有嵌套概念。

跳过并 warning 而非报错，理由同 at-rule：容忍从其他项目迁移的代码，让开发者能先跑起来。

---

## QA

**Q：Runtime 侧只匹配单 class 选择器，那编译出的后代选择器有什么用？**

toolkit 忠实产出所有选择器，Runtime 逐步补全匹配能力。这个顺序不能反——如果 toolkit 只产出 Runtime 当前支持的选择器，Runtime 升级后老 RPK 无法利用新能力。

产物里的后代选择器当前被 Runtime 忽略（key 不匹配就跳过），没有副作用。等 Runtime 实现后代匹配后，同一份 RPK 直接受益。

**Q：`_meta.ruleDef` 不生成，将来补上会破坏兼容性吗？**

不会。这是新增字段，老 Runtime 不读它就忽略。新 Runtime 读到它就用完整优先级规则，读不到就退回当前的顺序合并逻辑。

**Q：属性值不做换算，那 `width: 450px` 在不同 DPI 设备上会不一致吗？**

会，但这是设计意图。快应用的 px 是设计稿单位（基准宽度 750px），Runtime 侧按屏幕宽度做等比缩放。这个换算必须在 Runtime 做——编译期不知道目标设备的屏幕宽度。

**Q：为什么不用 `postcss-selector-parser` 解析选择器？**

不需要。toolkit 只把选择器当字符串，不理解其结构。引入解析器意味着 toolkit 开始承担选择器语义，与决策 1 冲突。

**Q：`sheet[key]` 已存在时用 `Object.assign` 合并，这符合 CSS 语义吗？**

部分符合。CSS 的层叠规则是「相同优先级下后者覆盖前者」，`Object.assign` 实现了同名属性覆盖、异名属性保留，这与 CSS 一致。

不符合的部分是优先级：CSS 里 `.a.b` 比 `.a` 优先级高，即使 `.a` 写在后面也不会覆盖 `.a.b`。当前实现不处理优先级——这正是 `_meta.ruleDef` 要解决的问题。

**Q：如果 CSS 里有 `!important` 会怎样？**

postcss 会把 `important: true` 标记在 Declaration 上，但 `decl.value` 不含 `!important` 文本。当前实现忽略这个标记，产物里没有痕迹。

Runtime 侧也不支持 `!important`。这是已知限制，实际影响小——快应用的样式作用域是页面级，冲突场景少。

**Q：`compileStyleToSheet` 和 `compileStyle` 拆开的理由和 Step 5 一样吗？**

一样。前者返回对象供单测断言结构，后者返回代码字符串供 bundle 嵌入。测试直接断言对象比比对字符串稳定得多。

**Q：postcss 的 `from: filename` 选项有什么用？**

让 postcss 的错误消息里包含文件名。虽然我们自己也会构造 `StyleCompileError` 并带上 `filename`，但 postcss 内部的警告和 source map 生成会用到它。

传绝对路径而非相对路径：postcss 不做路径解析，原样使用。

---

## 下一步

Step 7 实现 Script Compiler：用 Babel 做 AST 转换，把 `require` 重写为 `$app_require$`，ES module 转 CommonJS，输出模块函数字符串。
