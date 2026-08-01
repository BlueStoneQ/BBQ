# Step 5：Template Compiler

## 目录

- [目标](#目标)
- [Step 5.1：目标产物结构](#step-51目标产物结构)
- [Step 5.2：属性分类规则](#step-52属性分类规则)
- [Step 5.3：实现插值表达式编译](#step-53实现插值表达式编译)
- [Step 5.4：实现 XML 到节点树转换](#step-54实现-xml-到节点树转换)
- [Step 5.5：实现编译入口](#step-55实现编译入口)
- [Step 5.6：单元测试](#step-56单元测试)
- [Step 5.7：逐层验证](#step-57逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 `<template>` 的 XML 编译为 JSON 模板树代码字符串。**

| 输入 | 输出 |
|---|---|
| `<div class="wrapper"><text>{{title}}</text></div>` | 含 `type`/`attr`/`classList`/`events`/`children` 的对象字面量代码 |

这是整条管线中最复杂的一步。产物直接决定 Runtime 能否正确构建 VNode 树。

**验收标准：**
- 节点层次、兄弟顺序与源码 XML 完全一致（Property 2）
- `{{expr}}` 编译为 `function () { return this.expr }`，`this` 绑定 VM（Property 3）
- `@click` 和 `onclick` 两种写法都进入 `events`
- `class="a b"` 拆分为 `classList: ["a", "b"]`
- 未闭合标签报错，附文件绝对行号
- 产物与官方 hap-toolkit 产物结构一致

**本步不包含：**
- 自定义组件 `<import>`（V1 不支持）
- 指令 `for` / `if` / `show`（V1 不支持，见 QA）
- 样式和脚本编译（Step 6/7）

---

## Step 5.1：目标产物结构

先明确要产出什么。示例项目 `pages/Demo/index.ux` 的模板：

```html
<template>
  <div class="wrapper">
    <text class="title">{{title}}</text>
    <input class="btn" type="button" value="跳转到详情页" @click="onDetailBtnClick" />
  </div>
</template>
```

对应的官方 hap-toolkit 产物（从 RPK 解压得到）：

```javascript
{
  "type": "div",
  "attr": {},
  "classList": ["wrapper"],
  "children": [
    {
      "type": "text",
      "attr": {
        "value": function () { return this.title }
      },
      "classList": ["title"]
    },
    {
      "type": "input",
      "attr": { "type": "button", "value": "跳转到详情页" },
      "classList": ["btn"],
      "events": { "click": "onDetailBtnClick" }
    }
  ]
}
```

四个观察点决定了实现方式：

**`text` 的文本内容进了 `attr.value`，不是单独的文本节点。** 快应用的 `text` 组件通过 `value` 属性接收内容。这意味着编译器要把子文本节点提升为父节点的 `attr.value`。

**`attr` 始终存在，即使为空（`{}`）。** Runtime 侧直接读 `node.attr.xxx`，缺失时会得到 `undefined` 而非崩溃，但保持字段存在更稳妥。

**`events` 在无事件时不存在。** 与 `attr` 不同，`events` 是可选字段。Runtime 侧用 `node.events && node.events.click` 判断。

**`children` 在叶子节点上不存在。** 同样是可选字段。

第二和第三点看似不一致，但这是官方产物的实际行为，我们对齐它。理由见技术决策。

---

## Step 5.2：属性分类规则

模板元素上的每个属性要归入四类之一：

| 源码写法 | 目标字段 | 产物 |
|---|---|---|
| `class="a b"` | `classList` | `["a", "b"]` |
| `@click="fn"` | `events` | `{ click: "fn" }` |
| `onclick="fn"` | `events` | `{ click: "fn" }` |
| `value="{{title}}"` | `attr`（函数） | `function () { return this.title }` |
| `type="button"` | `attr`（静态） | `"button"` |
| 文本子节点 | 父 `attr.value` | 按插值规则处理 |

两种事件写法等价。`@click` 是简写，`onclick` 是完整形式。官方文档两种都支持，产物中统一为 `events.click`。

**事件名提取规则：**

```text
@click     -> click
onclick    -> click
@change    -> change
onchange   -> change
@longpress -> longpress
```

`on` 前缀形式要注意区分：`onclick` 的事件名是 `click`，但假设有个普通属性叫 `online`，它不应被当作事件 `line`。所以不能简单去掉 `on` 前缀——需要白名单。

V1 的事件白名单：

```text
click、change、longpress、touchstart、touchmove、touchend、touchcancel、
appear、disappear、swipe、focus、blur
```

不在白名单里的 `onXxx` 属性作为普通 attr 处理。这样 `online="true"` 不会被误判。

---

## Step 5.3：实现插值表达式编译

插值是本 Step 最容易出错的部分。四种情况：

```text
"{{title}}"           单段纯插值   -> function () { return this.title }
"{{a}}-{{b}}"         多段插值     -> function () { return this.a + "-" + this.b }
"前缀{{title}}"        混合文本     -> function () { return "前缀" + this.title }
"纯文本"              无插值       -> "纯文本"（保持字符串，不包函数）
```

关键约束：**无插值时必须保持静态字符串**，不能统一包成函数。原因是 Runtime 侧会检查 `typeof attr.value === 'function'` 来决定是否求值，静态值包成函数会增加不必要的调用开销，且与官方产物不一致。

```text
@add quickapp-toolkit/src/compiler/interpolation.ts（新建文件）
```

```typescript
import { RawCode, raw } from './serializer';

/**
 * 匹配 {{ expression }} 插值。
 *
 * 非贪婪匹配（[\s\S]*?）避免 "{{a}}{{b}}" 被当作一个插值。
 * 用 [\s\S] 而非 . 是为了让表达式可以跨行 —— 模板里偶尔会有
 * 换行的长表达式。
 */
const INTERPOLATION = /\{\{([\s\S]*?)\}\}/g;

/**
 * 判断字符串是否包含插值。
 * @param value 属性值或文本内容
 * @returns true 表示含至少一个 {{}} 插值
 */
export function hasInterpolation(value: string): boolean {
  // 每次调用重置 lastIndex：正则带 g 标志时 test 会推进 lastIndex，
  // 复用同一个正则对象会导致第二次调用结果错误
  INTERPOLATION.lastIndex = 0;
  return INTERPOLATION.test(value);
}

/**
 * 把插值表达式文本转为访问 VM 数据的代码。
 *
 * 表达式原样嵌入，只在前面加 this. —— 但仅当表达式是简单标识符
 * 或属性访问链时。复杂表达式（含运算符、函数调用）原样保留，
 * 由开发者自己写 this。
 *
 * 判断依据：官方产物里 {{title}} 编译为 this.title，而
 * {{a + b}} 编译为 this.a + this.b 需要 AST 分析。V1 采用
 * 保守策略：简单标识符加 this.，其余原样输出并要求开发者写全。
 *
 * @param expr 插值内的表达式文本，已去除首尾空白
 * @returns 可嵌入 return 语句的表达式代码
 */
function compileExpression(expr: string): string {
  const trimmed = expr.trim();
  if (trimmed === '') return '""';

  // 简单标识符或属性访问链：title、user.name、list[0]
  // 这类表达式加 this. 前缀
  if (/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*|\[[^\]]+\])*$/.test(trimmed)) {
    // $event、$item 等以 $ 开头的是框架注入变量，不加 this.
    if (trimmed.startsWith('$')) return trimmed;
    return `this.${trimmed}`;
  }

  // 复杂表达式原样输出。开发者需要自己写 this.xxx
  return trimmed;
}

/**
 * 编译含插值的属性值或文本内容。
 *
 * 无插值时返回原字符串（静态值）；含插值时返回 RawCode 包装的
 * 求值函数。Runtime 侧通过 typeof === 'function' 区分两者。
 *
 * 产出的函数必须是 function 表达式而非箭头函数：framework.js 用
 * fn.call(vm) 求值，箭头函数没有自己的 this，无法绑定 VM 实例。
 *
 * @param value 原始属性值或文本内容
 * @returns 静态字符串或 RawCode（求值函数）
 */
export function compileInterpolation(value: string): string | RawCode {
  if (!hasInterpolation(value)) {
    return value;
  }

  const parts: string[] = [];
  let lastIndex = 0;

  INTERPOLATION.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INTERPOLATION.exec(value)) !== null) {
    // 插值前的静态文本
    if (match.index > lastIndex) {
      const text = value.slice(lastIndex, match.index);
      parts.push(JSON.stringify(text));
    }
    parts.push(compileExpression(match[1]));
    lastIndex = match.index + match[0].length;
  }

  // 尾部静态文本
  if (lastIndex < value.length) {
    parts.push(JSON.stringify(value.slice(lastIndex)));
  }

  // 单段纯插值：直接 return 表达式
  // 多段：用 + 拼接。第一段若是表达式，需保证结果是字符串 ——
  // 但官方产物也是直接 +，保持一致
  const body = parts.length === 1 ? parts[0] : parts.join(' + ');

  return raw(`function () { return ${body} }`);
}
```

`compileExpression` 的策略需要解释。理想做法是用 Babel 解析表达式 AST，把所有自由标识符加上 `this.`。但这引入两个问题：

一是 `$event`、`$item` 这类框架注入变量不应加 `this.`，需要维护白名单。二是成员表达式 `user.name` 只应给 `user` 加前缀，AST 遍历要区分 `object` 和 `property` 位置。

V1 采用保守策略：**只有简单标识符和属性访问链自动加 `this.`**，复杂表达式原样输出。代价是开发者写 `{{a + b}}` 时需要写成 `{{this.a + this.b}}`。这个限制在 V1 可接受——示例项目和常见模板里的插值都是简单形式。

---

## Step 5.4：实现 XML 到节点树转换

```text
@add quickapp-toolkit/src/compiler/template-compiler.ts（新建文件）
```

```typescript
import { Parser } from 'htmlparser2';
import { RawCode } from './serializer';
import { compileInterpolation } from './interpolation';
import { TemplateCompileError } from '../diagnostics/errors';

/**
 * 编译后的模板树节点。
 *
 * 字段的可选性与官方 hap-toolkit 产物对齐：
 *   attr      始终存在，无属性时为 {}
 *   classList 始终存在，无 class 时为 []
 *   events    仅在有事件时存在
 *   children  仅在有子元素时存在
 */
export interface TemplateNode {
  type: string;
  attr: Record<string, string | RawCode>;
  classList: string[];
  events?: Record<string, string>;
  children?: TemplateNode[];
}

/**
 * V1 支持的事件白名单。
 *
 * 需要白名单而非「去掉 on 前缀」：属性 online="true" 不应被
 * 误判为事件 line。
 */
const EVENT_NAMES = new Set([
  'click',
  'change',
  'longpress',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'appear',
  'disappear',
  'swipe',
  'focus',
  'blur',
]);

/**
 * V1 支持的组件标签白名单。
 *
 * 遇到未知标签时报错而非透传：未知标签在 Runtime 侧的 ViewRenderer
 * 里没有对应分支，会被静默跳过，页面少一块内容但不报错。编译期拦住
 * 让问题立刻可见。
 */
const KNOWN_TAGS = new Set(['div', 'text', 'input', 'image']);

/**
 * 从属性名解析事件名。
 * @param attrName 属性名，如 "@click"、"onclick"、"type"
 * @returns 事件名；不是事件属性时返回 null
 */
function parseEventName(attrName: string): string | null {
  if (attrName.startsWith('@')) {
    const name = attrName.slice(1);
    return EVENT_NAMES.has(name) ? name : null;
  }
  if (attrName.startsWith('on')) {
    const name = attrName.slice(2);
    return EVENT_NAMES.has(name) ? name : null;
  }
  return null;
}

/** 构建过程中的节点，children 始终存在便于累积 */
interface BuildingNode {
  type: string;
  attr: Record<string, string | RawCode>;
  classList: string[];
  events: Record<string, string>;
  children: BuildingNode[];
  /** 累积的文本子内容，闭合时提升为 attr.value */
  text: string;
  /** 开始标签所在行号（区块相对，1-based），用于错误定位 */
  line: number;
}

/**
 * 把构建中节点转为最终节点，去掉空的可选字段。
 * @param node 构建中节点
 * @returns 最终节点
 */
function finalize(node: BuildingNode): TemplateNode {
  const result: TemplateNode = {
    type: node.type,
    attr: node.attr,
    classList: node.classList,
  };
  if (Object.keys(node.events).length > 0) {
    result.events = node.events;
  }
  if (node.children.length > 0) {
    result.children = node.children.map(finalize);
  }
  return result;
}

/**
 * 解析模板 XML 为节点树。
 *
 * 用 htmlparser2 的流式回调而非 DOM 模式：流式回调能拿到每个标签的
 * 起始偏移量，用于错误行号计算。DOM 模式虽然更简单，但位置信息需要
 * 额外开启 withStartIndices 选项并从节点对象读取，处理嵌套时更繁琐。
 *
 * @param template  template 区块源码
 * @param filename  源文件绝对路径，用于错误定位
 * @param startLine 区块在文件中的起始行号，用于行号换算
 * @returns 根节点
 * @throws TemplateCompileError 无根元素、多根元素、未闭合标签或未知标签
 */
function parseTemplate(
  template: string,
  filename: string,
  startLine: number
): BuildingNode {
  const roots: BuildingNode[] = [];
  const stack: BuildingNode[] = [];
  let currentOffset = 0;

  /**
   * 把区块内字符偏移换算为文件绝对行号。
   * @param offset 区块内字符偏移
   * @returns 文件绝对行号
   */
  const offsetToLine = (offset: number): number => {
    let line = 0;
    for (let i = 0; i < offset && i < template.length; i++) {
      if (template[i] === '\n') line++;
    }
    return startLine + line;
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (!KNOWN_TAGS.has(name)) {
          throw new TemplateCompileError(
            `未知组件 <${name}>，V1 支持的组件：${[...KNOWN_TAGS].join('、')}`,
            filename,
            offsetToLine(currentOffset)
          );
        }

        const node: BuildingNode = {
          type: name,
          attr: {},
          classList: [],
          events: {},
          children: [],
          text: '',
          line: offsetToLine(currentOffset),
        };

        for (const [key, value] of Object.entries(attribs)) {
          if (key === 'class') {
            // 按任意空白拆分，过滤空串（处理 class="  a   b  "）
            node.classList = value.split(/\s+/).filter((c) => c !== '');
            continue;
          }

          const eventName = parseEventName(key);
          if (eventName !== null) {
            // 事件值是方法名字符串，不做插值处理
            node.events[eventName] = value.trim();
            continue;
          }

          node.attr[key] = compileInterpolation(value);
        }

        if (stack.length === 0) {
          roots.push(node);
        } else {
          stack[stack.length - 1].children.push(node);
        }
        stack.push(node);
      },

      ontext(text) {
        // 文本累积到当前节点，闭合时统一处理。
        // 不立即处理是因为 htmlparser2 可能把一段文本分多次回调
        // （遇到实体引用时），累积后再编译保证插值不被切断。
        if (stack.length > 0) {
          stack[stack.length - 1].text += text;
        }
      },

      onclosetag(name) {
        const node = stack.pop();
        if (node === undefined) {
          throw new TemplateCompileError(
            `多余的结束标签 </${name}>`,
            filename,
            offsetToLine(currentOffset)
          );
        }

        // 文本子内容提升为 attr.value。
        // 仅当节点没有元素子节点且 attr.value 未显式设置时 ——
        // <text value="x">y</text> 这种情况以显式属性为准
        const trimmed = node.text.trim();
        if (trimmed !== '' && node.children.length === 0 && node.attr.value === undefined) {
          node.attr.value = compileInterpolation(trimmed);
        }
      },
    },
    {
      // XML 模式：不做 HTML 的隐式闭合和大小写转换。
      // .ux 模板要求显式闭合，且标签名大小写敏感
      xmlMode: true,
      // 保留原始属性大小写。快应用有 onClick 这类驼峰写法
      lowerCaseAttributeNames: false,
    }
  );

  // 逐字符 write 以维护 currentOffset。
  // htmlparser2 的 parser.startIndex 在某些回调中不可靠，
  // 自己维护偏移更可控
  for (let i = 0; i < template.length; i++) {
    currentOffset = i;
    parser.write(template[i]);
  }
  parser.end();

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new TemplateCompileError(
      `未闭合的标签 <${unclosed.type}>`,
      filename,
      unclosed.line
    );
  }

  if (roots.length === 0) {
    throw new TemplateCompileError(
      '模板为空，至少需要一个根元素',
      filename,
      startLine
    );
  }

  if (roots.length > 1) {
    throw new TemplateCompileError(
      `模板有 ${roots.length} 个根元素，只允许一个`,
      filename,
      roots[1].line
    );
  }

  return roots[0];
}
```

逐字符 `parser.write` 的性能需要说明。模板通常几十行、几 KB，逐字符调用的开销在毫秒级，可忽略。换来的是可靠的偏移追踪——`htmlparser2` 的 `parser.startIndex` 在 `onclosetag` 中指向的位置在不同版本间有差异，自己维护偏移不受这个影响。

如果模板体积增长到 MB 级（不会发生），可以改为按行 `write` 并在回调中用 `parser.startIndex` 做行内偏移。

---

## Step 5.5：实现编译入口

```text
@add quickapp-toolkit/src/compiler/template-compiler.ts — 在 parseTemplate 之后插入
```

```typescript
import { serialize } from './serializer';
import type { BuildMode } from '../types';

/**
 * 编译 <template> 区块为模板树对象。
 *
 * 与 compileTemplate 的区别：这个函数返回对象树，便于单测直接
 * 断言结构；compileTemplate 返回代码字符串，用于嵌入 bundle。
 *
 * @param template  template 区块源码（不含 <template> 标签本身）
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号，用于错误行号换算
 * @returns 模板树根节点
 * @throws TemplateCompileError 解析或转换失败
 */
export function compileTemplateToTree(
  template: string,
  filename: string,
  startLine: number
): TemplateNode {
  return finalize(parseTemplate(template, filename, startLine));
}

/**
 * 编译 <template> 区块为 JS 对象字面量代码字符串。
 *
 * @param template  template 区块源码
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号
 * @param mode      构建模式；release 使用紧凑序列化
 * @returns JS 代码字符串，可直接作为 module.exports 的右值
 * @throws TemplateCompileError 解析或转换失败
 */
export function compileTemplate(
  template: string,
  filename: string,
  startLine: number,
  mode: BuildMode = 'debug'
): string {
  const tree = compileTemplateToTree(template, filename, startLine);
  return serialize(tree, mode === 'release' ? -1 : 0);
}
```

拆成两个函数是为了可测性。`compileTemplateToTree` 返回对象，单测可以用 `deepStrictEqual` 直接断言结构；如果只有返回字符串的版本，测试要么比对字符串（脆弱，缩进变化就失败），要么先 eval（无法断言 `RawCode` 的存在，只能断言 eval 后的函数行为）。

---

## Step 5.6：单元测试

```text
@add quickapp-toolkit/test/unit/template-compiler.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  compileTemplateToTree,
  compileTemplate,
} = require('../../dist/compiler/template-compiler.js');
const { RawCode } = require('../../dist/compiler/serializer.js');
const {
  TemplateCompileError,
} = require('../../dist/diagnostics/errors.js');

const FILE = '/proj/src/pages/Demo/index.ux';

/** 编译辅助：默认 startLine=2（<template> 在第 1 行） */
function tree(template, startLine = 2) {
  return compileTemplateToTree(template, FILE, startLine);
}

// ---------- 基本结构 ----------

test('单个空 div', () => {
  const t = tree('<div></div>');
  assert.deepStrictEqual(t, { type: 'div', attr: {}, classList: [] });
});

test('无事件时 events 字段不存在', () => {
  const t = tree('<div></div>');
  assert.ok(!('events' in t));
});

test('无子元素时 children 字段不存在', () => {
  const t = tree('<div></div>');
  assert.ok(!('children' in t));
});

test('嵌套结构层次正确', () => {
  const t = tree('<div><text></text></div>');
  assert.strictEqual(t.type, 'div');
  assert.strictEqual(t.children.length, 1);
  assert.strictEqual(t.children[0].type, 'text');
});

test('兄弟节点顺序保持源码顺序', () => {
  const t = tree('<div><text></text><input /><image /></div>');
  assert.deepStrictEqual(
    t.children.map((c) => c.type),
    ['text', 'input', 'image']
  );
});

test('多层嵌套', () => {
  const t = tree('<div><div><div><text></text></div></div></div>');
  assert.strictEqual(t.children[0].children[0].children[0].type, 'text');
});

// ---------- classList ----------

test('单个 class', () => {
  const t = tree('<div class="wrapper"></div>');
  assert.deepStrictEqual(t.classList, ['wrapper']);
});

test('多个 class 按空白拆分', () => {
  const t = tree('<div class="a b c"></div>');
  assert.deepStrictEqual(t.classList, ['a', 'b', 'c']);
});

test('class 首尾和中间多余空白被过滤', () => {
  const t = tree('<div class="  a   b  "></div>');
  assert.deepStrictEqual(t.classList, ['a', 'b']);
});

test('无 class 时 classList 为空数组', () => {
  const t = tree('<div></div>');
  assert.deepStrictEqual(t.classList, []);
});

test('class 不进入 attr', () => {
  const t = tree('<div class="a"></div>');
  assert.ok(!('class' in t.attr));
});

// ---------- 事件 ----------

test('@click 进入 events', () => {
  const t = tree('<input @click="onTap" />');
  assert.deepStrictEqual(t.events, { click: 'onTap' });
});

test('onclick 进入 events', () => {
  const t = tree('<input onclick="onTap" />');
  assert.deepStrictEqual(t.events, { click: 'onTap' });
});

test('两种事件写法产物一致', () => {
  const a = tree('<input @click="fn" />');
  const b = tree('<input onclick="fn" />');
  assert.deepStrictEqual(a.events, b.events);
});

test('多个事件', () => {
  const t = tree('<input @click="a" @change="b" />');
  assert.deepStrictEqual(t.events, { click: 'a', change: 'b' });
});

test('事件值首尾空白被去除', () => {
  const t = tree('<input @click="  onTap  " />');
  assert.strictEqual(t.events.click, 'onTap');
});

test('非白名单 onXxx 属性作为普通 attr', () => {
  // online 不是事件，不应被解析为事件 line
  const t = tree('<input online="true" />');
  assert.strictEqual(t.attr.online, 'true');
  assert.ok(!('events' in t));
});

test('非白名单 @xxx 属性作为普通 attr', () => {
  const t = tree('<input @unknown="x" />');
  assert.strictEqual(t.attr['@unknown'], 'x');
});

// ---------- 静态属性 ----------

test('静态属性保持字符串', () => {
  const t = tree('<input type="button" value="确定" />');
  assert.strictEqual(t.attr.type, 'button');
  assert.strictEqual(t.attr.value, '确定');
  assert.strictEqual(typeof t.attr.value, 'string');
});

test('静态属性不被包装为函数', () => {
  const t = tree('<input value="确定" />');
  assert.ok(!(t.attr.value instanceof RawCode));
});

// ---------- 插值 ----------

test('单段纯插值编译为函数', () => {
  const t = tree('<text value="{{title}}" />');
  assert.ok(t.attr.value instanceof RawCode);
  assert.strictEqual(t.attr.value.code, 'function () { return this.title }');
});

test('属性访问链加 this 前缀', () => {
  const t = tree('<text value="{{user.name}}" />');
  assert.strictEqual(t.attr.value.code, 'function () { return this.user.name }');
});

test('索引访问加 this 前缀', () => {
  const t = tree('<text value="{{list[0]}}" />');
  assert.strictEqual(t.attr.value.code, 'function () { return this.list[0] }');
});

test('$ 开头的框架变量不加 this', () => {
  const t = tree('<text value="{{$item}}" />');
  assert.strictEqual(t.attr.value.code, 'function () { return $item }');
});

test('前缀混合插值', () => {
  const t = tree('<text value="前缀{{title}}" />');
  assert.strictEqual(
    t.attr.value.code,
    'function () { return "前缀" + this.title }'
  );
});

test('后缀混合插值', () => {
  const t = tree('<text value="{{title}}后缀" />');
  assert.strictEqual(
    t.attr.value.code,
    'function () { return this.title + "后缀" }'
  );
});

test('多段插值用 + 拼接', () => {
  const t = tree('<text value="{{a}}-{{b}}" />');
  assert.strictEqual(
    t.attr.value.code,
    'function () { return this.a + "-" + this.b }'
  );
});

test('相邻插值', () => {
  const t = tree('<text value="{{a}}{{b}}" />');
  assert.strictEqual(t.attr.value.code, 'function () { return this.a + this.b }');
});

test('复杂表达式原样输出', () => {
  const t = tree('<text value="{{this.a + this.b}}" />');
  assert.strictEqual(
    t.attr.value.code,
    'function () { return this.a + this.b }'
  );
});

test('插值内空白被去除', () => {
  const t = tree('<text value="{{  title  }}" />');
  assert.strictEqual(t.attr.value.code, 'function () { return this.title }');
});

// ---------- 文本子节点 ----------

test('文本子内容提升为 attr.value', () => {
  const t = tree('<text>hello</text>');
  assert.strictEqual(t.attr.value, 'hello');
});

test('文本插值提升为函数', () => {
  const t = tree('<text>{{title}}</text>');
  assert.ok(t.attr.value instanceof RawCode);
  assert.strictEqual(t.attr.value.code, 'function () { return this.title }');
});

test('文本首尾空白被去除', () => {
  const t = tree('<text>\n  hello\n</text>');
  assert.strictEqual(t.attr.value, 'hello');
});

test('有元素子节点时不提升文本', () => {
  const t = tree('<div>text<text></text></div>');
  assert.ok(!('value' in t.attr));
});

test('显式 value 属性优先于文本子节点', () => {
  const t = tree('<text value="attr">child</text>');
  assert.strictEqual(t.attr.value, 'attr');
});

test('纯空白文本不产生 attr.value', () => {
  const t = tree('<div>   </div>');
  assert.ok(!('value' in t.attr));
});

// ---------- 错误处理 ----------

test('未闭合标签报错并附文件绝对行号', () => {
  // startLine=10，标签在区块第 1 行 -> 文件第 10 行
  assert.throws(
    () => tree('<div>\n  <text>\n', 10),
    (err) => {
      assert.ok(err instanceof TemplateCompileError);
      assert.strictEqual(err.file, FILE);
      assert.strictEqual(err.line, 11, '应指向 <text> 所在的文件行号');
      assert.match(err.message, /未闭合的标签 <text>/);
      return true;
    }
  );
});

test('空模板报错', () => {
  assert.throws(() => tree(''), /模板为空/);
  assert.throws(() => tree('   \n  '), /模板为空/);
});

test('多根元素报错并指出数量', () => {
  assert.throws(
    () => tree('<div></div><div></div>'),
    (err) => {
      assert.match(err.message, /2 个根元素/);
      return true;
    }
  );
});

test('未知标签报错并列出支持列表', () => {
  assert.throws(
    () => tree('<span></span>'),
    (err) => {
      assert.ok(err instanceof TemplateCompileError);
      assert.match(err.message, /未知组件 <span>/);
      assert.match(err.message, /div/);
      return true;
    }
  );
});

test('行号换算：区块内第 3 行对应文件第 22 行', () => {
  // startLine=20，区块第 3 行 -> 文件第 22 行
  assert.throws(
    () => tree('<div>\n  <text></text>\n  <span></span>\n</div>', 20),
    (err) => {
      assert.strictEqual(err.line, 22);
      return true;
    }
  );
});

// ---------- 产物可执行性 ----------

test('产物 eval 后函数以 VM 为 this 求值', () => {
  const code = compileTemplate('<text>{{title}}</text>', FILE, 2);
  const node = eval(`(${code})`);
  assert.strictEqual(
    node.attr.value.call({ title: '欢迎体验快应用开发' }),
    '欢迎体验快应用开发'
  );
});

test('release 模式产出紧凑代码', () => {
  const pretty = compileTemplate('<div class="a"></div>', FILE, 2, 'debug');
  const compact = compileTemplate('<div class="a"></div>', FILE, 2, 'release');
  assert.ok(pretty.includes('\n'));
  assert.ok(!compact.includes('\n'));
  // 两种模式 eval 结果等价
  assert.deepStrictEqual(eval(`(${pretty})`), eval(`(${compact})`));
});

// ---------- 示例项目对齐 ----------

test('示例 Demo 模板产物结构与官方一致', () => {
  const template = [
    '<div class="wrapper">',
    '  <text class="title">{{title}}</text>',
    '  <input class="btn" type="button" value="跳转到详情页" @click="onDetailBtnClick" />',
    '</div>',
  ].join('\n');

  const t = tree(template);

  assert.strictEqual(t.type, 'div');
  assert.deepStrictEqual(t.attr, {});
  assert.deepStrictEqual(t.classList, ['wrapper']);
  assert.strictEqual(t.children.length, 2);

  const [textNode, inputNode] = t.children;

  assert.strictEqual(textNode.type, 'text');
  assert.deepStrictEqual(textNode.classList, ['title']);
  assert.ok(textNode.attr.value instanceof RawCode);
  assert.ok(!('events' in textNode));

  assert.strictEqual(inputNode.type, 'input');
  assert.deepStrictEqual(inputNode.classList, ['btn']);
  assert.strictEqual(inputNode.attr.type, 'button');
  assert.strictEqual(inputNode.attr.value, '跳转到详情页');
  assert.deepStrictEqual(inputNode.events, { click: 'onDetailBtnClick' });
});
```

---

## Step 5.7：逐层验证

### 5.7.1：安装依赖与编译

```bash
cd quickapp-toolkit
npm install htmlparser2@9.1.0
npm run build && npm test
```

**预期：** template-compiler 的 45 个用例全部通过，累计 102 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `Cannot find module 'htmlparser2'` | 依赖未安装 | `npm install htmlparser2@9.1.0` |
| `TS7016: Could not find a declaration file` | htmlparser2 类型声明 | 9.x 自带类型，确认版本正确 |
| `attribs` 类型报错 | `Record<string, string>` 断言 | htmlparser2 的 attribs 已是该类型，无需断言 |
| 行号测试失败，差 1 | `offsetToLine` 的 `startLine + line` | `line` 从 0 开始计数，`startLine` 已是 1-based |

### 5.7.2：行号换算验证

这是本 Step 最容易出错的地方，单独验证。

```bash
node -e "
const { compileTemplateToTree } = require('./dist/compiler/template-compiler.js');
// 模拟 <template> 在文件第 1 行，内容从第 2 行开始
const startLine = 2;
const tpl = [
  '<div>',           // 文件第 2 行
  '  <text></text>', // 文件第 3 行
  '  <span></span>', // 文件第 4 行 <- 这里出错
  '</div>'           // 文件第 5 行
].join('\n');
try {
  compileTemplateToTree(tpl, '/x/index.ux', startLine);
} catch (e) {
  console.log('报错行号:', e.line, '(期望 4)');
  console.log('消息:', e.message);
}
"
```

**预期输出：**

```text
报错行号: 4 (期望 4)
消息: 未知组件 <span>，V1 支持的组件：div、text、input、image
```

如果行号是 3 或 5，说明 `offsetToLine` 的换算有偏差。后果是开发者按错误行号去看会看到相邻的行——在长模板里这会导致找错方向。

再验证一个 `startLine` 较大的场景：

```bash
node -e "
const { compileTemplateToTree } = require('./dist/compiler/template-compiler.js');
// 假设 <template> 在文件第 30 行
try {
  compileTemplateToTree('<div>\n  <span></span>\n</div>', '/x/index.ux', 31);
} catch (e) {
  console.log('报错行号:', e.line, '(期望 32)');
}
"
```

**预期：** `报错行号: 32 (期望 32)`

### 5.7.3：插值编译对照验证

```bash
node -e "
const { compileTemplateToTree } = require('./dist/compiler/template-compiler.js');
const cases = [
  '<text value=\"{{title}}\" />',
  '<text value=\"{{user.name}}\" />',
  '<text value=\"前缀{{title}}\" />',
  '<text value=\"{{a}}-{{b}}\" />',
  '<text value=\"静态文本\" />',
  '<text>{{title}}</text>',
  '<text>纯文本</text>'
];
for (const c of cases) {
  const t = compileTemplateToTree(c, '/x.ux', 2);
  const v = t.attr.value;
  const desc = v && v.code ? v.code : JSON.stringify(v);
  console.log(c.padEnd(34), '->', desc);
}
"
```

**预期输出：**

```text
<text value="{{title}}" />         -> function () { return this.title }
<text value="{{user.name}}" />     -> function () { return this.user.name }
<text value="前缀{{title}}" />      -> function () { return "前缀" + this.title }
<text value="{{a}}-{{b}}" />       -> function () { return this.a + "-" + this.b }
<text value="静态文本" />           -> "静态文本"
<text>{{title}}</text>             -> function () { return this.title }
<text>纯文本</text>                 -> "纯文本"
```

**关键验证点：** 静态值保持字符串，不被包装成函数。如果所有值都变成函数，Runtime 侧每次渲染都要多一次函数调用，且与官方产物不一致。

### 5.7.4：函数求值行为验证

Property 3 的直接验证：产出的函数必须以 VM 为 `this`。

```bash
node -e "
const { compileTemplate } = require('./dist/compiler/template-compiler.js');
const code = compileTemplate('<text>{{title}}</text>', '/x.ux', 2);
const node = eval('(' + code + ')');

const vm = { title: '欢迎体验快应用开发' };
console.log('求值结果:', node.attr.value.call(vm));
console.log('类型正确:', typeof node.attr.value === 'function');

// 验证不是箭头函数：箭头函数的 call 无法改变 this
const vm2 = { title: '第二个 VM' };
console.log('可重新绑定:', node.attr.value.call(vm2) === '第二个 VM');
"
```

**预期输出：**

```text
求值结果: 欢迎体验快应用开发
类型正确: true
可重新绑定: true
```

`可重新绑定: true` 是箭头函数检测：如果产出的是箭头函数，`call` 无法改变 `this`，第二次调用会返回第一个 VM 的值或 undefined。

### 5.7.5：与官方产物结构对照

从示例项目的 RPK 解压出官方产物，比对结构：

```bash
cd ../quickapp-examples/quickapp-code-test1/dist
# 若已有解压目录 debug/ 则直接用，否则解压
[ -d debug ] || unzip -q com.example.case1.debug.1.0.0.rpk -d debug
# 提取官方产物中的 template 模块
grep -A 30 'template-loader' debug/pages/Demo/index.js | head -40
```

**对照清单：**

| 维度 | 官方产物 | 本工具链产物 | 必须一致 |
|---|---|---|---|
| 根节点 `type` | `"div"` | `"div"` | 是 |
| 根节点 `attr` | `{}` | `{}` | 是 |
| 根节点 `classList` | `["wrapper"]` | `["wrapper"]` | 是 |
| `children` 数量与顺序 | 2 个：text、input | 同 | 是 |
| text 的 `attr.value` | `function () { return this.title }` | 同 | 是 |
| input 的 `attr` | `{ type: "button", value: "跳转到详情页" }` | 同 | 是 |
| input 的 `events` | `{ click: "onDetailBtnClick" }` | 同 | 是 |
| 无事件节点是否有 `events` | 无该字段 | 无该字段 | 是 |
| 叶子节点是否有 `children` | 无该字段 | 无该字段 | 是 |
| 缩进格式 | webpack 风格 | 2 空格 | 否 |
| 属性顺序 | 源码顺序 | 源码顺序 | 建议一致 |

允许不一致的只有格式和体积。任何结构差异都要修正——Runtime 侧的 VNode 构建代码假定这个结构。

### 5.7.6：示例项目端到端

Step 5 尚未接入 bundle 组装，用脚本直接编译示例模板：

```bash
node -e "
const fs = require('fs');
const { parseSFC } = require('./dist/parser/sfc-parser.js');
const { compileTemplate } = require('./dist/compiler/template-compiler.js');

const file = '../quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux';
const src = fs.readFileSync(file, 'utf8');
const d = parseSFC(src, file);
const code = compileTemplate(d.template.content, file, d.template.startLine);
console.log(code);
"
```

**预期：** 输出完整的模板树代码，结构与 5.7.5 的对照清单一致。

同时对 `pages/DemoDetail/index.ux` 执行相同验证。两个页面都能编译成功，才说明编译器覆盖了示例项目的全部模板语法。

---

## 技术决策

### 1. 事件用白名单，不用「去掉 on 前缀」

`online="true"` 不应被解析为事件 `line`。属性名以 `on` 开头的普通属性存在（`online`、`once`），简单去前缀会误判。

白名单的代价是新增事件类型要改代码。收益是不会把普通属性错误地放进 `events`——那种错误会让 Runtime 侧注册一个不存在的方法名监听器，点击时报「方法未定义」，而根因在编译期。

### 2. 未知标签报错，不透传

Runtime 侧的 `ViewRenderer` 用 `switch (node.type)` 映射标签到平台组件，未知类型走 default 分支被静默跳过。结果是页面少一块内容但不报错。

编译期拦住让问题立刻可见，且错误信息能列出支持的组件列表。这比在 Runtime 加日志更有效——编译期的反馈循环短得多。

### 3. 静态值保持字符串，不统一包装成函数

统一包装看起来更简单（Runtime 只需一种处理路径），但有两个问题：

一是与官方产物不一致，回归比对时噪音大。二是 Runtime 每次渲染都要多一次函数调用——对首屏有几十个节点的页面，这是几十次无意义的调用。

Runtime 用 `typeof attr.value === 'function'` 区分两者，成本是一次类型检查。

### 4. 文本子内容提升为 attr.value

快应用的 `text` 组件通过 `value` 属性接收内容，不是通过子文本节点。`<text>hello</text>` 和 `<text value="hello" />` 在官方产物里是同一个结构。

提升的条件是「无元素子节点且 `attr.value` 未显式设置」。显式属性优先，因为那是更明确的表达。

### 5. `attr` 和 `classList` 始终存在，`events` 和 `children` 可选

这个不一致来自官方产物的实际行为，我们对齐它而不「修正」它。

对齐的理由：Runtime 侧的代码是按官方产物写的。如果我们让 `events` 也始终存在（`{}`），Runtime 侧 `if (node.events)` 的判断会一直为真，进入事件注册分支后遍历空对象——行为正确但多做了无用功。反之如果我们省略 `attr`，Runtime 侧 `node.attr.value` 会崩溃。

### 6. 逐字符 write 维护偏移

`htmlparser2` 的 `parser.startIndex` 在 `onclosetag` 回调中的语义在不同版本间有差异。自己维护 `currentOffset` 不受版本影响。

性能代价可忽略：模板通常几 KB，逐字符调用在毫秒级。

### 7. 插值只对简单标识符加 this. 前缀

理想做法是用 Babel 解析表达式 AST，给所有自由标识符加 `this.`。但要处理两个复杂情况：`$event`/`$item` 等框架变量不加前缀，成员表达式只给 `object` 位置加前缀。

V1 用正则识别「简单标识符或属性访问链」，其余原样输出。代价是 `{{a + b}}` 需要写成 `{{this.a + this.b}}`。示例项目和常见模板的插值都是简单形式，这个限制可接受。

V2 引入 AST 处理时，这个函数是唯一需要改的地方——接口不变。

### 8. 编译入口拆成 tree 和字符串两个函数

`compileTemplateToTree` 返回对象供单测断言结构，`compileTemplate` 返回字符串供 bundle 嵌入。

如果只有字符串版本，测试要么比对字符串（缩进变化就失败），要么先 eval（无法断言 `RawCode` 的存在，只能验证 eval 后的行为）。两种方式都比直接断言对象结构脆弱。

### 9. 文本在 ontext 中累积，闭合时统一编译

`htmlparser2` 可能把一段文本分多次 `ontext` 回调（遇到实体引用 `&amp;` 时会拆分）。如果每次回调都编译，`{{ti` 和 `tle}}` 会被当作两段不含插值的文本。

累积到 `onclosetag` 再编译保证插值不被切断。

---

## QA

**Q：为什么不支持 `for` / `if` 指令？**

这两个指令需要 Runtime 侧配合：`for` 要求 VNode 构建时展开列表并维护 key，`if` 要求条件求值和节点增删。当前 Runtime（Android）只实现了静态树的首次渲染，没有列表展开和条件分支逻辑。

编译期可以把 `for="{{list}}"` 编译成产物字段，但 Runtime 不消费它就没有意义。V1 的范围是「首屏静态渲染」，指令属于 V1.5 的响应式更新范畴。

真要支持，编译产物的形态是：

```javascript
{ type: 'text', repeat: { exp: function () { return this.list }, key: 'id' } }
```

Runtime 侧在 VNode 构建时识别 `repeat` 字段并展开。这需要 toolkit 和 Runtime 同步改动。

**Q：`KNOWN_TAGS` 只有四个标签，实际快应用组件远多于此，怎么扩展？**

白名单要与 Runtime 侧 `ViewRenderer` 的 `switch` 分支保持一致。当前 Android Runtime 只实现了 div/text/input，`image` 是预留。

扩展流程是：Runtime 侧先加渲染分支，toolkit 侧再加白名单。顺序不能反——反了会编译出 Runtime 无法渲染的产物。

理想做法是让白名单从共享配置文件读取，toolkit 和 Runtime 都消费它。V1 规模小，两处手动同步可接受；组件数量增长后应该做这个抽取。

**Q：`xmlMode: true` 有什么影响？**

关闭 HTML 的隐式闭合规则（`<p>` 遇到下一个 `<p>` 自动闭合）和标签名小写转换。

`.ux` 模板要求显式闭合所有标签，这与 XML 语义一致。如果用 HTML 模式，`<div><text></div>` 会被「修正」为合法结构而不报错——未闭合标签的错误被掩盖了。

**Q：`lowerCaseAttributeNames: false` 为什么必要？**

快应用支持 `onClick` 这种驼峰写法。如果转小写，`onClick` 变成 `onclick`——恰好还能匹配事件白名单，看起来没问题。

但普通属性会出问题：`<image srcSet="x" />` 转成 `srcset`，Runtime 侧按 `srcSet` 读取会得到 undefined。保留原始大小写避免这类静默失败。

**Q：多根元素为什么不允许？**

Runtime 侧的 VNode 树是单根结构，`__native_render__(vnode, style)` 接收单个根节点。多根需要包装成隐式容器，但那会改变布局结构（多一层 div 影响 Flex 计算）。

官方 hap-toolkit 同样要求单根。保持一致。

**Q：`compileExpression` 里 `$` 开头的变量为什么不加 `this.`？**

`$event`、`$item`、`$idx` 是框架在特定上下文注入的局部变量。`$event` 在事件处理中由 framework.js 传入，`$item`/`$idx` 在 `for` 指令的作用域内。它们不是 VM 的属性。

加 `this.` 会变成 `this.$event`，在 VM 上找不到。

**Q：如果模板里有 HTML 实体（`&amp;`、`&#123;`）怎么处理？**

`htmlparser2` 在 `xmlMode` 下会解码标准 XML 实体（`&amp;`、`&lt;`、`&gt;`、`&quot;`、`&apos;`）和数字引用，`ontext` 回调收到的是解码后的文本。

这是期望行为：产物里应该是实际字符。序列化器会正确转义它们。

**Q：属性值里的 `{{` 想表达字面量怎么办？**

当前无法表达。`INTERPOLATION` 正则会把它当插值开始，找不到 `}}` 时不匹配（正则要求成对），所以 `<text value="{{" />` 会作为静态字符串保留。但 `<text value="{{a}}" />` 无法表达字面的 `{{a}}`。

官方也没有转义机制。实际需求极少，不处理。

---

## 下一步

Step 6 实现 Style Compiler：用 postcss 解析 CSS，选择器原样作为 key，属性名转 camelCase，输出样式对象代码字符串。
