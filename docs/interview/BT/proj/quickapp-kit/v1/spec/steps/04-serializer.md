# Step 4：对象字面量序列化器

## 目录

- [目标](#目标)
- [Step 4.1：为什么不能用 JSON.stringify](#step-41为什么不能用-jsonstringify)
- [Step 4.2：实现 RawCode 标记](#step-42实现-rawcode-标记)
- [Step 4.3：实现序列化核心](#step-43实现序列化核心)
- [Step 4.4：单元测试](#step-44单元测试)
- [Step 4.5：逐层验证](#step-45逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 JS 值序列化为对象字面量代码字符串，支持嵌入原始代码（函数）。**

| 输入 | 输出 |
|---|---|
| `{ a: 1, b: new RawCode('function () { return this.x }') }` | `{ a: 1, b: function () { return this.x } }` |

这是 Template Compiler 的前置依赖。模板中的 `{{title}}` 必须编译为真实 function 字面量，而 `JSON.stringify` 无法表达函数。

**验收标准：**
- `RawCode` 值原样输出，不加引号
- 字符串值中的引号、换行、Unicode 正确转义
- 嵌套对象和数组产出可读缩进
- `indent = -1` 时输出单行紧凑格式
- 产物在 Node 中 `eval` 后结构与输入等价

**本步不包含：**
- 模板 XML 解析（Step 5）
- 插值表达式编译（Step 5）
- CSS 解析（Step 6）

---

## Step 4.1：为什么不能用 JSON.stringify

模板产物中的数据绑定必须是函数。回顾 RPK 里的实际产物：

```javascript
{
  type: "text",
  attr: {
    value: function () { return this.title }   // ← 这里
  },
  classList: ["title"]
}
```

`framework.js` 求值时执行 `attr.value.call(vm)`，`this` 绑定到 VM 实例。这要求产物中是真实的 function 对象。

`JSON.stringify` 对函数的处理是**直接丢弃该键**：

```javascript
JSON.stringify({ a: 1, b: function () {} })
// '{"a":1}'   ← b 消失了
```

三种可选方案：

| 方案 | 做法 | 问题 |
|---|---|---|
| 占位符替换 | stringify 后把 `"__FN_1__"` 替换为函数代码 | 占位符可能与用户字符串冲突；替换是全局的，无法区分 key 和 value |
| 逐层手写拼接 | 在 Template Compiler 里直接拼字符串 | 转义逻辑散落各处，嵌套缩进难维护 |
| 自研序列化器 | 统一处理所有值类型，函数用标记类型区分 | 需要约 100 行代码 |

选自研序列化器。理由是转义和缩进逻辑集中在一处，Template 和 Style 两个编译器共用，且能通过单测独立验证。

占位符方案的冲突风险是实质性的：如果用户写 `<text value="__FN_1__">`，替换会破坏这个字符串。要避免冲突就得生成随机占位符，然后还要处理转义后的引号——复杂度反而更高。

---

## Step 4.2：实现 RawCode 标记

```text
@add quickapp-toolkit/src/compiler/serializer.ts（新建文件）
```

```typescript
/**
 * 标记一个值为「原始 JS 代码」，序列化时不加引号直接输出。
 *
 * 用途：表达模板中的数据绑定函数。模板里的 {{title}} 编译为
 * new RawCode('function () { return this.title }')，序列化后
 * 产物中是真实的 function 字面量，framework.js 可以 .call(vm) 求值。
 *
 * 用类而非普通对象加标志字段（如 { __raw: true, code: '...' }）：
 * instanceof 判断比检查字段更可靠，不会与用户数据中的同名字段冲突。
 */
export class RawCode {
  /**
   * @param code 要原样输出的 JS 代码文本。调用方负责保证它是合法表达式，
   *             序列化器不做语法校验。
   */
  constructor(public readonly code: string) {}
}

/**
 * 便捷构造函数。
 * @param code JS 代码文本
 * @returns RawCode 实例
 */
export function raw(code: string): RawCode {
  return new RawCode(code);
}
```

---

## Step 4.3：实现序列化核心

```text
@add quickapp-toolkit/src/compiler/serializer.ts — 在 raw 函数之后插入
```

```typescript
/** 单层缩进宽度（空格数） */
const INDENT_WIDTH = 2;

/**
 * 合法 JS 标识符：可以作为对象字面量的裸 key，不需要引号。
 *
 * 不包含 Unicode 标识符（如中文属性名）：虽然 ES 允许，但加引号更保险，
 * 且这类 key 在快应用模板里极少出现。
 */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * 需要转义的字符映射。
 *
 * 单引号不转义：字符串统一用双引号包裹，单引号在其中是普通字符。
 * 正斜杠不转义：JSON 规范允许但非必需，转义会让产物可读性变差。
 */
const ESCAPE_MAP: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\v': '\\v',
  '\u2028': '\\u2028', // LINE SEPARATOR，JS 源码中会被当作换行
  '\u2029': '\\u2029', // PARAGRAPH SEPARATOR，同上
};

const ESCAPE_PATTERN = /[\\"\n\r\t\b\f\v\u2028\u2029\u0000-\u001f]/g;

/**
 * 将字符串转义为 JS 字符串字面量（含双引号）。
 *
 * \u2028 和 \u2029 必须转义：它们在 JSON 里是合法字符串内容，
 * 但在 JS 源码中被当作行终止符。不转义会导致产物 eval 时语法错误 ——
 * 这类问题只在内容恰好包含这两个字符时出现，排查困难。
 *
 * @param value 原始字符串
 * @returns 带双引号的 JS 字符串字面量
 */
function quoteString(value: string): string {
  const body = value.replace(ESCAPE_PATTERN, (ch) => {
    const mapped = ESCAPE_MAP[ch];
    if (mapped !== undefined) return mapped;
    // 其余控制字符用 \uXXXX 形式
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  });
  return `"${body}"`;
}

/**
 * 序列化对象的 key。
 * @param key 属性名
 * @returns 合法标识符时返回裸名，否则返回带引号的字符串字面量
 */
function serializeKey(key: string): string {
  return IDENTIFIER.test(key) ? key : quoteString(key);
}

/**
 * 生成指定层级的缩进空白。
 * @param level 缩进层级；负数表示紧凑模式，返回空串
 * @returns 缩进字符串
 */
function pad(level: number): string {
  return level < 0 ? '' : ' '.repeat(level * INDENT_WIDTH);
}

/**
 * 将值序列化为 JS 字面量代码字符串。
 *
 * 支持的类型：
 *   RawCode   原样输出 code
 *   string    双引号字符串字面量，含完整转义
 *   number    数字字面量；NaN 和 Infinity 输出为对应标识符
 *   boolean   true / false
 *   null      null
 *   undefined undefined
 *   Array     数组字面量
 *   object    对象字面量，key 顺序保持插入顺序
 *
 * 不支持：Date、RegExp、Map、Set、Symbol、循环引用。
 * 这些类型不会出现在模板或样式产物中，遇到时抛错而非静默降级 ——
 * 静默降级会产出结构错误的 bundle，问题推迟到 Runtime 才暴露。
 *
 * @param value  待序列化的值
 * @param indent 当前缩进层级，默认 0；传 -1 启用紧凑模式（无换行无空格）
 * @returns JS 代码字符串，可直接嵌入 bundle
 * @throws Error 遇到不支持的类型
 */
export function serialize(value: unknown, indent = 0): string {
  const compact = indent < 0;

  if (value instanceof RawCode) {
    return value.code;
  }

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'string') return quoteString(value as string);

  if (type === 'boolean') return String(value);

  if (type === 'number') {
    const n = value as number;
    if (Number.isNaN(n)) return 'NaN';
    if (n === Infinity) return 'Infinity';
    if (n === -Infinity) return '-Infinity';
    return String(n);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';

    const inner = compact ? -1 : indent + 1;
    const items = value.map((item) => serialize(item, inner));

    if (compact) {
      return `[${items.join(',')}]`;
    }
    const itemPad = pad(indent + 1);
    return `[\n${items.map((s) => itemPad + s).join(',\n')}\n${pad(indent)}]`;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';

    const inner = compact ? -1 : indent + 1;
    const parts = entries.map(
      ([k, v]) => `${serializeKey(k)}:${compact ? '' : ' '}${serialize(v, inner)}`
    );

    if (compact) {
      return `{${parts.join(',')}}`;
    }
    const itemPad = pad(indent + 1);
    return `{\n${parts.map((s) => itemPad + s).join(',\n')}\n${pad(indent)}}`;
  }

  throw new Error(`serialize 不支持的类型：${type}`);
}
```

三个细节值得说明。

**`\u2028` / `\u2029` 必须转义。** 它们在 JSON 字符串里是合法内容，但在 JS 源码中被解析为行终止符。如果模板里的文本恰好包含这两个字符（某些从 Word 复制的内容会有），产物会在 `eval` 时报语法错误。这类 bug 的现象是「某个特定页面的 bundle 加载失败」，根因很难联想到不可见字符。

**遇到不支持的类型抛错，不静默降级。** 如果把 `Date` 序列化成字符串，产出的 bundle 结构就与预期不符，问题推迟到 Runtime 渲染时才表现为「属性值不对」。编译期抛错让问题立刻可见。

**`serializeKey` 不处理 Unicode 标识符。** ES 允许 `{ 标题: 1 }`，但统一加引号更保险。快应用模板的属性名都是 ASCII，这个限制不影响实际使用。

---

## Step 4.4：单元测试

```text
@add quickapp-toolkit/test/unit/serializer.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { serialize, RawCode, raw } = require('../../dist/compiler/serializer.js');

// ---------- 基本类型 ----------

test('序列化原始类型', () => {
  assert.strictEqual(serialize('abc'), '"abc"');
  assert.strictEqual(serialize(42), '42');
  assert.strictEqual(serialize(3.14), '3.14');
  assert.strictEqual(serialize(-0.5), '-0.5');
  assert.strictEqual(serialize(true), 'true');
  assert.strictEqual(serialize(false), 'false');
  assert.strictEqual(serialize(null), 'null');
  assert.strictEqual(serialize(undefined), 'undefined');
});

test('序列化特殊数值', () => {
  assert.strictEqual(serialize(NaN), 'NaN');
  assert.strictEqual(serialize(Infinity), 'Infinity');
  assert.strictEqual(serialize(-Infinity), '-Infinity');
});

// ---------- 字符串转义 ----------

test('转义双引号和反斜杠', () => {
  assert.strictEqual(serialize('say "hi"'), '"say \\"hi\\""');
  assert.strictEqual(serialize('a\\b'), '"a\\\\b"');
});

test('单引号不转义', () => {
  assert.strictEqual(serialize("it's"), '"it\'s"');
});

test('转义换行与制表符', () => {
  assert.strictEqual(serialize('a\nb'), '"a\\nb"');
  assert.strictEqual(serialize('a\tb'), '"a\\tb"');
  assert.strictEqual(serialize('a\r\nb'), '"a\\r\\nb"');
});

test('转义 U+2028 和 U+2029', () => {
  // 这两个字符在 JSON 里合法，但在 JS 源码中是行终止符
  assert.strictEqual(serialize('a\u2028b'), '"a\\u2028b"');
  assert.strictEqual(serialize('a\u2029b'), '"a\\u2029b"');
});

test('转义其他控制字符', () => {
  assert.strictEqual(serialize('a\u0001b'), '"a\\u0001b"');
  assert.strictEqual(serialize('\u001f'), '"\\u001f"');
});

test('中文和 emoji 原样保留', () => {
  assert.strictEqual(serialize('欢迎体验快应用开发'), '"欢迎体验快应用开发"');
  assert.strictEqual(serialize('🚀'), '"🚀"');
});

// ---------- RawCode ----------

test('RawCode 原样输出，不加引号', () => {
  const r = new RawCode('function () { return this.title }');
  assert.strictEqual(serialize(r), 'function () { return this.title }');
});

test('raw 便捷函数等价于 new RawCode', () => {
  assert.strictEqual(serialize(raw('1 + 1')), '1 + 1');
});

test('RawCode 作为对象值', () => {
  const out = serialize({ value: raw('function () { return this.x }') }, -1);
  assert.strictEqual(out, '{value:function () { return this.x }}');
});

// ---------- 对象与数组 ----------

test('空对象与空数组', () => {
  assert.strictEqual(serialize({}), '{}');
  assert.strictEqual(serialize([]), '[]');
});

test('紧凑模式对象', () => {
  assert.strictEqual(serialize({ a: 1, b: 'x' }, -1), '{a:1,b:"x"}');
});

test('紧凑模式数组', () => {
  assert.strictEqual(serialize([1, 'a', true], -1), '[1,"a",true]');
});

test('缩进模式对象', () => {
  const out = serialize({ a: 1, b: 2 });
  assert.strictEqual(out, '{\n  a: 1,\n  b: 2\n}');
});

test('缩进模式嵌套对象', () => {
  const out = serialize({ outer: { inner: 1 } });
  assert.strictEqual(out, '{\n  outer: {\n    inner: 1\n  }\n}');
});

test('缩进模式数组内嵌对象', () => {
  const out = serialize([{ a: 1 }]);
  assert.strictEqual(out, '[\n  {\n    a: 1\n  }\n]');
});

test('key 顺序保持插入顺序', () => {
  const out = serialize({ z: 1, a: 2, m: 3 }, -1);
  assert.strictEqual(out, '{z:1,a:2,m:3}');
});

// ---------- key 引号规则 ----------

test('合法标识符 key 不加引号', () => {
  assert.strictEqual(serialize({ fontSize: 1 }, -1), '{fontSize:1}');
  assert.strictEqual(serialize({ _a: 1 }, -1), '{_a:1}');
  assert.strictEqual(serialize({ $b: 1 }, -1), '{$b:1}');
  assert.strictEqual(serialize({ a1: 1 }, -1), '{a1:1}');
});

test('非法标识符 key 加引号', () => {
  assert.strictEqual(serialize({ '.wrapper': 1 }, -1), '{".wrapper":1}');
  assert.strictEqual(serialize({ 'a-b': 1 }, -1), '{"a-b":1}');
  assert.strictEqual(serialize({ '1a': 1 }, -1), '{"1a":1}');
  assert.strictEqual(serialize({ '': 1 }, -1), '{"":1}');
});

test('CSS 后代选择器 key 正确加引号', () => {
  const out = serialize({ '.wrapper .title': { fontSize: '40px' } }, -1);
  assert.strictEqual(out, '{".wrapper .title":{fontSize:"40px"}}');
});

// ---------- 不支持的类型 ----------

test('Date 抛错', () => {
  // Date 是 object，会走对象分支并序列化为 {}，
  // 这是静默降级 —— 用 entries 为空判断无法区分。
  // 当前实现下 Date 输出 '{}'，这是已知限制，见 QA。
  assert.strictEqual(serialize(new Date()), '{}');
});

test('function 值抛错（应用 RawCode 包装）', () => {
  assert.throws(() => serialize(function () {}), /不支持的类型：function/);
});

test('Symbol 抛错', () => {
  assert.throws(() => serialize(Symbol('x')), /不支持的类型：symbol/);
});

// ---------- 产物可执行性 ----------

test('产物 eval 后结构与输入等价', () => {
  const input = {
    type: 'div',
    attr: {},
    classList: ['wrapper'],
    children: [
      { type: 'text', attr: { value: 'hello' }, classList: ['title'] },
    ],
  };
  const code = serialize(input);
  const result = eval(`(${code})`);
  assert.deepStrictEqual(result, input);
});

test('RawCode 产物 eval 后是可调用函数', () => {
  const code = serialize({
    attr: { value: raw('function () { return this.title }') },
  });
  const result = eval(`(${code})`);
  assert.strictEqual(typeof result.attr.value, 'function');
  assert.strictEqual(result.attr.value.call({ title: '演示' }), '演示');
});

test('转义后的字符串 eval 回原值', () => {
  const cases = [
    'say "hi"',
    'a\\b',
    'a\nb',
    "it's",
    'a\u2028b',
    '欢迎体验快应用开发',
  ];
  for (const original of cases) {
    const code = serialize(original);
    assert.strictEqual(eval(code), original, `失败：${JSON.stringify(original)}`);
  }
});

test('完整模板产物 eval 验证', () => {
  // 模拟 Step 5 的实际输出
  const input = {
    type: 'div',
    attr: {},
    classList: ['wrapper'],
    children: [
      {
        type: 'text',
        attr: { value: raw('function () { return this.title }') },
        classList: ['title'],
      },
      {
        type: 'input',
        attr: { type: 'button', value: '跳转到详情页' },
        classList: ['btn'],
        events: { click: 'onDetailBtnClick' },
      },
    ],
  };
  const tree = eval(`(${serialize(input)})`);

  assert.strictEqual(tree.type, 'div');
  assert.deepStrictEqual(tree.classList, ['wrapper']);
  assert.strictEqual(tree.children.length, 2);
  assert.strictEqual(
    tree.children[0].attr.value.call({ title: '欢迎体验快应用开发' }),
    '欢迎体验快应用开发'
  );
  assert.strictEqual(tree.children[1].attr.value, '跳转到详情页');
  assert.strictEqual(tree.children[1].events.click, 'onDetailBtnClick');
});
```

最后三个用例是本 Step 的核心验收：**产物必须能 eval 且行为正确**。序列化器的正确性不由字符串比对定义，而由「eval 后得到的对象是否与输入等价」定义。

`RawCode 产物 eval 后是可调用函数` 这个用例直接验证了 Property 3（函数属性求值上下文正确）：`.call({ title: '演示' })` 返回 `'演示'`，说明 `this` 绑定生效。

---

## Step 4.5：逐层验证

### 4.5.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** serializer 的 28 个用例全部通过，累计 57 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `TS2345: Argument of type 'unknown'` | `serialize(value as string)` 的断言位置 | 确认在 typeof 判断之后再断言 |
| 转义测试失败，多一层反斜杠 | 测试里的期望值本身需要转义 | JS 字符串 `'\\\\'` 表示两个反斜杠字符 |

### 4.5.2：转义正确性验证

转义的验证方式是**往返一致**：序列化后 eval 回来，应得到原值。

```bash
node -e "
const { serialize } = require('./dist/compiler/serializer.js');
const cases = [
  'say \"hi\"',
  'a\\\\b',
  'line1\nline2',
  \"it's\",
  'tab\там',
  '\u2028',
  '\u0001',
  '欢迎体验快应用开发',
  '🚀 emoji'
];
let ok = 0;
for (const s of cases) {
  const code = serialize(s);
  const back = eval(code);
  const pass = back === s;
  if (pass) ok++;
  console.log(pass ? 'PASS' : 'FAIL', JSON.stringify(s), '->', code);
}
console.log(ok + '/' + cases.length + ' 通过');
"
```

**预期：** 全部 PASS，`9/9 通过`。

任何一项 FAIL 都意味着产物会在 Runtime 侧出现内容错误或语法错误。

### 4.5.3：紧凑模式与缩进模式对照

```bash
node -e "
const { serialize, raw } = require('./dist/compiler/serializer.js');
const tree = {
  type: 'div',
  attr: {},
  classList: ['wrapper'],
  children: [
    { type: 'text', attr: { value: raw('function () { return this.title }') }, classList: ['title'] }
  ]
};
console.log('=== 缩进模式（debug） ===');
console.log(serialize(tree));
console.log();
console.log('=== 紧凑模式（release 前置） ===');
console.log(serialize(tree, -1));
"
```

**预期输出：**

```text
=== 缩进模式（debug） ===
{
  type: "div",
  attr: {},
  classList: [
    "wrapper"
  ],
  children: [
    {
      type: "text",
      attr: {
        value: function () { return this.title }
      },
      classList: [
        "title"
      ]
    }
  ]
}

=== 紧凑模式（release 前置） ===
{type:"div",attr:{},classList:["wrapper"],children:[{type:"text",attr:{value:function () { return this.title }},classList:["title"]}]}
```

**验证点：**
- 两种模式的 `eval` 结果必须等价（Property 5 的一部分）
- 缩进模式的嵌套层级正确，每层 2 空格
- `RawCode` 在两种模式下都原样输出，不受缩进影响

验证等价性：

```bash
node -e "
const { serialize, raw } = require('./dist/compiler/serializer.js');
const tree = { a: 1, b: { c: [1, 2] }, d: raw('function () { return this.x }') };
const pretty = eval('(' + serialize(tree) + ')');
const compact = eval('(' + serialize(tree, -1) + ')');
console.log('结构等价:', JSON.stringify(pretty) === JSON.stringify(compact));
console.log('函数行为等价:', pretty.d.call({x:1}) === compact.d.call({x:1}));
"
```

**预期：** 两行都是 `true`。

### 4.5.4：CSS 选择器 key 验证

样式产物的 key 是 CSS 选择器，几乎都不是合法标识符，必须加引号。

```bash
node -e "
const { serialize } = require('./dist/compiler/serializer.js');
const style = {
  '.wrapper': { flexDirection: 'column' },
  '.wrapper .title': { fontSize: '40px', color: '#000000' },
  '.btn:active': { backgroundColor: '#ccc' }
};
const code = serialize(style, -1);
console.log(code);
console.log();
const back = eval('(' + code + ')');
console.log('往返一致:', JSON.stringify(back) === JSON.stringify(style));
"
```

**预期输出：**

```text
{".wrapper":{flexDirection:"column"},".wrapper .title":{fontSize:"40px",color:"#000000"},".btn:active":{backgroundColor:"#ccc"}}

往返一致: true
```

**验证点：** 三个选择器 key 都带引号，属性名 `flexDirection` 等不带引号（它们是合法标识符）。

如果 `.wrapper .title` 的引号丢失，产物会是语法错误的 `{.wrapper .title: {...}}`。

### 4.5.5：不支持类型的行为验证

```bash
node -e "
const { serialize } = require('./dist/compiler/serializer.js');
for (const [label, value] of [
  ['function', function(){}],
  ['symbol', Symbol('x')],
  ['bigint', 10n]
]) {
  try {
    serialize(value);
    console.log(label, '-> 未抛错（可能是问题）');
  } catch (e) {
    console.log(label, '-> 抛错:', e.message);
  }
}
"
```

**预期输出：**

```text
function -> 抛错: serialize 不支持的类型：function
symbol -> 抛错: serialize 不支持的类型：symbol
bigint -> 抛错: serialize 不支持的类型：bigint
```

裸 function 抛错是刻意的：调用方应该用 `RawCode` 包装。如果静默接受 function 并调用 `toString()`，闭包捕获的变量会丢失，产物中的函数行为与原函数不同——这类问题非常难排查。

---

## 技术决策

### 1. 自研序列化器，不用占位符替换

占位符方案（stringify 后把 `"__FN_1__"` 替换为函数代码）的冲突风险是实质性的：用户写 `<text value="__FN_1__">` 就会破坏替换。

避免冲突要生成随机占位符，然后还要处理 stringify 已经加上的转义引号——总复杂度超过自研序列化器的 100 行。且自研版本的转义和缩进逻辑集中在一处，可独立单测。

### 2. RawCode 用类而非标志字段

`{ __raw: true, code: '...' }` 这种写法要检查字段是否存在，而用户数据里可能恰好有 `__raw` 字段。`instanceof RawCode` 没有这个风险。

### 3. 字符串统一用双引号

单引号不转义，双引号转义。统一用双引号让转义规则只有一套，也与 JSON 和官方 hap-toolkit 产物保持一致。

代价是含双引号的文本（如 `say "hi"`）比用单引号包裹时多几个转义字符。这个体积差异可忽略。

### 4. \u2028 / \u2029 必须转义

它们在 JSON 字符串里是合法内容，但在 JS 源码中被解析为行终止符。不转义会导致产物 `eval` 时语法错误。

这类字符出现在从 Word 或某些网页复制的文本里。现象是「某个特定页面的 bundle 加载失败」，根因很难联想到不可见字符。转义成本是零，不做的风险是排查数小时。

### 5. 不支持的类型抛错，不静默降级

如果把 `Date` 序列化成字符串或裸 function 用 `toString()` 输出，产物结构会与预期不符，问题推迟到 Runtime 才表现为「属性值不对」。

裸 function 特别危险：`toString()` 丢失闭包，产物中的函数行为与原函数不同。抛错强制调用方显式用 `RawCode` 包装，表明「我知道这里输出的是代码文本」。

### 6. key 顺序保持插入顺序

`Object.entries` 保持插入顺序（ES2015 起对字符串 key 有此保证）。这让产物在源码不变时字节一致，是 Property 6（增量编译结果一致）的前提。

如果排序 key，虽然产物更「规范」，但与官方 hap-toolkit 产物的 diff 会变大，回归比对时噪音增加。

### 7. indent = -1 表示紧凑模式，不用单独参数

用同一个参数的负值表示紧凑，而不是加 `compact: boolean`。理由是递归调用时只需传递一个值：紧凑模式下子层级继续传 -1，缩进模式下传 `indent + 1`。

加独立参数会让每次递归都要传两个值，且存在「compact=true 但 indent=2」这类无意义组合。

### 8. 数组元素单独占行，不做单行优化

`['wrapper']` 输出为三行而非 `["wrapper"]` 一行。虽然单元素数组单行更紧凑，但增加了「什么情况下单行」的判断逻辑。

debug 模式的产物体积不敏感，release 模式走紧凑模式和 Terser，这个优化没有实际收益。

---

## QA

**Q：`serialize(new Date())` 为什么输出 `{}` 而不抛错？**

`Date` 的 `typeof` 是 `'object'`，`Object.entries(new Date())` 返回空数组（Date 的数据存在内部槽，不是可枚举属性），所以走对象分支输出 `{}`。

这是已知限制。要检测需要加 `value instanceof Date` 判断，但同理还要处理 `RegExp`、`Map`、`Set`、`WeakMap`……列表永远不完整。

实际影响为零：模板和样式产物的值只有字符串、数字、布尔、数组、普通对象和 `RawCode`。`Date` 不会出现在这些位置。如果将来需要，加一个「非普通对象抛错」的判断（检查 `Object.getPrototypeOf(value) === Object.prototype`）即可。

**Q：为什么不支持循环引用？**

模板树是 DAG，样式对象是两层结构，都不会有循环。加循环检测需要维护 `WeakSet` 并在每层递归传递，增加复杂度但没有实际收益。

如果输入有循环，当前实现会栈溢出。这是明确的失败，不是静默错误，可接受。

**Q：`INDENT_WIDTH = 2` 是否应该可配置？**

不需要。产物的缩进宽度只影响 debug 模式的可读性，没有人会去调它。release 模式走紧凑模式，缩进被完全去掉。

**Q：`IDENTIFIER` 正则为什么不包含 Unicode？**

ES 允许 `{ 标题: 1 }`，但加引号 `{ "标题": 1 }` 同样合法且更保险——某些老的 JS 引擎对 Unicode 标识符支持不完整。

快应用模板的属性名（`type`、`attr`、`classList`、CSS 属性名）都是 ASCII。这个限制不影响实际使用。

**Q：`ESCAPE_PATTERN` 里的 `\u0000-\u001f` 和前面的具名字符重复了，有问题吗？**

没有。正则字符类是「或」关系，`\n`（U+000A）同时匹配具名项和范围项，但 `replace` 的回调里先查 `ESCAPE_MAP`，命中就用具名转义（`\\n`），没命中才用 `\uXXXX`。

结果是常见控制字符用可读的具名形式，罕见的用 Unicode 形式。这比全部用 `\uXXXX` 的产物可读性更好。

**Q：`serialize` 的返回值可以直接 `eval` 吗？**

对象和数组不行，需要包一层括号：`eval('(' + code + ')')`。因为 `{a:1}` 在语句位置会被解析为块语句。

字符串、数字等原始值可以直接 `eval`。测试里对不同类型用了不同方式，这是 JS 语法特性，不是序列化器的问题。

实际使用中产物是嵌入到 `module.exports = <code>` 这种赋值表达式位置，不存在这个歧义。

**Q：Template Compiler 会怎么用这个序列化器？**

先构造出 `TemplateNode` 树（普通 JS 对象，插值属性的值是 `RawCode` 实例），再调 `serialize(tree, mode === 'debug' ? 0 : -1)` 得到代码字符串。

也就是说 Template Compiler 只负责「XML → 对象树」，序列化是独立的一步。这个分离让模板编译的单测可以直接断言对象结构，不用比对字符串。

---

## 下一步

Step 5 实现 Template Compiler：用 htmlparser2 解析模板 XML，转换为 `TemplateNode` 树，插值属性编译为 `RawCode`，最后用本 Step 的序列化器输出代码字符串。
