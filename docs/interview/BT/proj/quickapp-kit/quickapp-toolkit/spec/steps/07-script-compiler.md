# Step 7：Script Compiler

## 目录

- [目标](#目标)
- [Step 7.1：目标产物结构](#step-71目标产物结构)
- [Step 7.2：为什么必须用 AST 而非正则](#step-72为什么必须用-ast-而非正则)
- [Step 7.3：实现 Babel 转换插件](#step-73实现-babel-转换插件)
- [Step 7.4：实现编译入口](#step-74实现编译入口)
- [Step 7.5：单元测试](#step-75单元测试)
- [Step 7.6：逐层验证](#step-76逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 `<script>` 编译为 CommonJS 模块函数，`require` 重写为 `$app_require$`。**

| 输入 | 输出 |
|---|---|
| `import router from '@app-module/system.router'; export default { ... }` | `function (module, exports, $app_require$) { var router = $app_require$(...); exports.default = { ... } }` |

**验收标准：**
- `export default {...}` 转为 `exports.default = {...}`
- `import x from 'y'` 转为 `var x = $app_require$('y')`
- `require('y')` 转为 `$app_require$('y')`
- 字符串常量和注释中的 `require`/`import` 不被改写
- ES2020 语法（箭头函数、模板字符串、可选链）原样保留
- 语法错误报错，附文件绝对行号

**本步不包含：**
- ES5 降级（QuickJS 支持 ES2020）
- npm 依赖打包（V1 假设页面不依赖第三方包）
- Tree shaking、死代码消除
- Bundle 组装（Step 8）

---

## Step 7.1：目标产物结构

示例项目 `pages/Demo/index.ux` 的脚本：

```javascript
<script>
import router from '@app-module/system.router';

export default {
  private: {
    title: '欢迎体验快应用开发'
  },
  onInit() {
    this.$page.setTitleBar({ text: '欢迎体验快应用开发' });
  },
  onDetailBtnClick() {
    router.push({ uri: '/pages/DemoDetail' });
  }
};
</script>
```

官方 hap-toolkit 产物（从 RPK 解压，debug 版）：

```javascript
module.exports = function __scriptModule__(module, exports, $app_require$) {
  var _system = $app_require$("@app-module/system.router");
  exports.default = {
    private: {
      title: '欢迎体验快应用开发'
    },
    onInit() {
      this.$page.setTitleBar({ text: '欢迎体验快应用开发' });
    },
    onDetailBtnClick() {
      _system.default.push({ uri: '/pages/DemoDetail' });
    }
  };
}
```

三个观察点：

**产物是一个接收 `(module, exports, $app_require$)` 的函数。** 不是立即执行的代码，而是模块工厂函数。Bundle 组装时会把它作为 webpack 模块表的一项。

**`import router from 'x'` 变成 `var _system = $app_require$('x')`，且调用点变成 `_system.default.push`。** 这是 Babel 的 ES module 转 CommonJS 标准行为：导入的默认值通过 `.default` 访问。变量名 `_system` 是 Babel 根据模块路径生成的。

**`export default {...}` 变成 `exports.default = {...}`。** 同时 Babel 通常会加 `exports.__esModule = true` 标记——Bundle 组装时的 `$app_define$` 工厂会检查这个标记：

```javascript
if ($app_exports$.__esModule && $app_exports$.default) {
  $app_module$.exports = $app_exports$.default;
}
```

这三点决定了 Babel 配置：用 `@babel/plugin-transform-modules-commonjs` 做模块转换，再用自定义插件把 `require` 改名为 `$app_require$`。

---

## Step 7.2：为什么必须用 AST 而非正则

正则替换 `require` → `$app_require$` 看起来只需一行：

```javascript
code.replace(/\brequire\(/g, '$app_require$(')
```

四种情况会出错：

```javascript
// 1. 字符串常量
const tip = "请使用 require() 加载模块";
// 正则会改成 "请使用 $app_require$() 加载模块" —— 用户看到的提示文案被改了

// 2. 注释
// TODO: 用 require 替换 import
// 正则会改注释，无害但产物 diff 变脏

// 3. 属性名
const config = { require: true };
obj.require();
// 正则的 \b 边界匹配 .require( —— 会改成 obj.$app_require$()，运行时报错

// 4. 变量名包含 require
function myRequire(x) { return require(x); }
// 需要只改后者，正则无法区分
```

第一和第三种是实质性问题：**编译期不报错，运行时才暴露，且现象与根因距离很远。**

第三种尤其危险。假设开发者写了：

```javascript
export default {
  onInit() {
    this.$app.require('some-feature');
  }
};
```

正则改成 `this.$app.$app_require$('some-feature')`，运行时报「`$app_require$` is not a function」。开发者看到这个错误会去查 `$app_require$` 的注入，而根因是编译器改错了一个属性名。

AST 转换不会有这个问题：Babel 只会改 `CallExpression` 的 `callee` 是 `Identifier` 且 `name === 'require'` 的节点，属性访问 `obj.require` 是 `MemberExpression`，不匹配。

代价是引入 `@babel/core`（约 30MB 依赖，编译耗时增加几十毫秒）。编译不在热路径上，这个代价可接受。

---

## Step 7.3：实现 Babel 转换插件

```text
@add quickapp-toolkit/src/compiler/babel-plugin-app-require.ts（新建文件）
```

```typescript
import type { PluginObj, NodePath } from '@babel/core';
import type * as t from '@babel/types';

/**
 * 把 require(...) 调用重写为 $app_require$(...)。
 *
 * 只处理满足全部条件的节点：
 *   - CallExpression（函数调用）
 *   - callee 是 Identifier（裸标识符，不是 obj.require 这种成员访问）
 *   - name === 'require'
 *   - 该标识符在作用域中未被绑定（不是局部变量或参数）
 *
 * 最后一条是关键：如果代码里有 function f(require) { require(x) }，
 * 参数 require 是局部绑定，不应被改写 —— 那是用户自己的变量。
 *
 * 这个插件在 modules-commonjs 转换之后运行：ES module 的 import
 * 已被转成 require 调用，此时统一改名。
 */
export function appRequirePlugin(): PluginObj {
  return {
    name: 'app-require',
    visitor: {
      CallExpression(path: NodePath<t.CallExpression>) {
        const callee = path.node.callee;

        if (callee.type !== 'Identifier' || callee.name !== 'require') {
          return;
        }

        // hasBinding 检查该名字是否在当前作用域链中被声明。
        // Babel 的 modules-commonjs 生成的 require 调用是自由标识符
        // （无绑定），而用户代码里的 function (require) {...} 参数有绑定
        if (path.scope.hasBinding('require', { noGlobals: true })) {
          return;
        }

        callee.name = '$app_require$';
      },
    },
  };
}
```

`noGlobals: true` 需要解释。默认情况下 `hasBinding('require')` 会把 `require` 当作 Node 的全局变量而返回 true，导致所有调用都被跳过。`noGlobals: true` 只检查真实的词法绑定，忽略预定义全局名。

---

## Step 7.4：实现编译入口

```text
@add quickapp-toolkit/src/compiler/script-compiler.ts（新建文件）
```

```typescript
import { transformSync, type TransformOptions } from '@babel/core';
import commonjsPlugin from '@babel/plugin-transform-modules-commonjs';
import { ScriptCompileError } from '../diagnostics/errors';
import { appRequirePlugin } from './babel-plugin-app-require';
import type { BuildMode } from '../types';

/**
 * 模块工厂函数的参数名。
 *
 * 与 Bundle 组装时的调用方一致：webpack 模块表的每一项被调用时
 * 传入 (module, exports, __webpack_require__)，而 $app_define$
 * 的工厂再传入 $app_require$。这里的第三个参数名必须是
 * $app_require$，因为转换后的代码直接引用这个名字。
 */
const MODULE_PARAMS = 'module, exports, $app_require$';

/**
 * Babel 转换配置。
 *
 * 不用 preset-env：目标引擎是 QuickJS，完整支持 ES2020。降级只会
 * 增大体积、引入 polyfill 依赖并降低可读性。
 *
 * sourceType: 'module' 让 Babel 按 ES module 解析（支持 import/export），
 * modules-commonjs 插件负责转成 CommonJS。
 */
function babelOptions(filename: string, mode: BuildMode): TransformOptions {
  return {
    filename,
    // 禁用项目根目录的 babel 配置文件查找：
    // 用户项目里可能有 .babelrc，那是给他们自己的构建用的，
    // 不应影响 toolkit 的编译行为
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    // 保留原始代码格式便于 debug 产物阅读；release 由 Terser 压缩
    compact: false,
    // 不生成 sourcemap：RPK 格式不含 sourcemap 文件，
    // 内联 sourcemap 会让 bundle 体积翻倍
    sourceMaps: false,
    plugins: [
      // 顺序重要：先把 import/export 转成 require/exports，
      // 再把 require 改名为 $app_require$
      [
        commonjsPlugin,
        {
          // 不生成 "use strict"：QuickJS 的模块作用域已是严格模式，
          // 且官方产物中没有这个指令
          strictMode: false,
          // 保留 exports.__esModule 标记：$app_define$ 工厂依赖它
          // 判断是否取 exports.default
          loose: false,
        },
      ],
      appRequirePlugin,
    ],
    // 关闭代码生成时的注释保留（release）或保留（debug）
    comments: mode === 'debug',
  };
}

/**
 * 编译 <script> 区块为 CommonJS 模块函数体代码。
 *
 * 返回的是函数体内的语句，不含函数包裹。调用方（Bundle Assembler）
 * 负责包成 function (module, exports, $app_require$) { ... }。
 *
 * 拆分职责的理由：app.js 和页面 bundle 的包裹方式不同，
 * 让组装层决定包裹形式更灵活。
 *
 * @param script    script 区块源码（不含 <script> 标签本身）
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号，用于错误行号换算
 * @param mode      构建模式，影响注释保留
 * @returns 转换后的语句代码
 * @throws ScriptCompileError JS 语法错误或转换失败
 */
export function compileScriptBody(
  script: string,
  filename: string,
  startLine: number,
  mode: BuildMode = 'debug'
): string {
  // 空脚本返回空模块。纯展示页面可以没有 <script>
  if (script.trim() === '') {
    return '';
  }

  let result;
  try {
    result = transformSync(script, babelOptions(filename, mode));
  } catch (e) {
    throw toScriptError(e, filename, startLine);
  }

  if (result === null || result.code === null || result.code === undefined) {
    throw new ScriptCompileError('Babel 转换返回空结果', filename, startLine);
  }

  return result.code;
}

/**
 * 编译 <script> 区块为完整的模块工厂函数代码。
 *
 * @param script    script 区块源码
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号
 * @param mode      构建模式
 * @returns 形如 function (module, exports, $app_require$) { ... } 的代码
 * @throws ScriptCompileError JS 语法错误或转换失败
 */
export function compileScript(
  script: string,
  filename: string,
  startLine: number,
  mode: BuildMode = 'debug'
): string {
  const body = compileScriptBody(script, filename, startLine, mode);
  return `function (${MODULE_PARAMS}) {\n${body}\n}`;
}

/**
 * 把 Babel 错误转为 ScriptCompileError，换算行号。
 *
 * Babel 的语法错误消息形如：
 *   "unknown: Unexpected token (3:10)"
 * 其中 (3:10) 是区块内相对位置。同时 err.loc 也带 line/column。
 *
 * @param e         Babel 抛出的错误
 * @param filename  源文件绝对路径
 * @param startLine 区块起始行号
 * @returns ScriptCompileError
 */
function toScriptError(
  e: unknown,
  filename: string,
  startLine: number
): ScriptCompileError {
  const err = e as {
    loc?: { line: number; column: number };
    message: string;
  };

  const relLine = err.loc?.line;
  const absLine = relLine === undefined ? startLine : startLine + relLine - 1;
  // Babel 的 column 是 0-based，Diagnostic 约定 1-based
  const column = err.loc === undefined ? 0 : err.loc.column + 1;

  // 清理 Babel 消息中的 "unknown: " 前缀和位置后缀 ——
  // 位置信息已经在 line/column 字段里，重复出现会让输出冗长
  const message = err.message
    .replace(/^unknown:\s*/, '')
    .replace(/\s*\(\d+:\d+\)\s*$/, '');

  return new ScriptCompileError(
    `JS 语法错误：${message}`,
    filename,
    absLine,
    column
  );
}
```

`compileScriptBody` 和 `compileScript` 拆开的理由：`app.js` 的包裹形式与页面不同（Step 8 会看到），让组装层决定包裹方式更灵活。

---

## Step 7.5：单元测试

```text
@add quickapp-toolkit/test/unit/script-compiler.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  compileScriptBody,
  compileScript,
} = require('../../dist/compiler/script-compiler.js');
const { ScriptCompileError } = require('../../dist/diagnostics/errors.js');

const FILE = '/proj/src/pages/Demo/index.ux';

/** 编译辅助，默认 startLine=2 */
function body(script, startLine = 2) {
  return compileScriptBody(script, FILE, startLine);
}

// ---------- export 转换 ----------

test('export default 对象转为 exports.default', () => {
  const out = body('export default { a: 1 };');
  assert.match(out, /exports\.default\s*=/);
});

test('export default 后带 __esModule 标记', () => {
  const out = body('export default { a: 1 };');
  assert.match(out, /__esModule/);
});

test('具名 export 转为 exports.x', () => {
  const out = body('export const foo = 1;');
  assert.match(out, /exports\.foo/);
});

// ---------- import 转换 ----------

test('import 默认导入转为 $app_require$', () => {
  const out = body("import router from '@app-module/system.router';");
  assert.match(out, /\$app_require\$\(/);
  assert.match(out, /@app-module\/system\.router/);
});

test('import 后不残留 import 关键字', () => {
  const out = body("import x from 'y';\nexport default { x };");
  assert.ok(!/^\s*import\s/m.test(out), '不应残留 import 语句');
});

test('具名 import 转换', () => {
  const out = body("import { a, b } from 'mod';");
  assert.match(out, /\$app_require\$\("mod"\)/);
});

test('import 的默认值通过 .default 访问', () => {
  const out = body("import router from 'mod';\nrouter.push();");
  // Babel 生成 _mod.default.push()
  assert.match(out, /\.default\.push/);
});

// ---------- require 改名 ----------

test('裸 require 调用改名为 $app_require$', () => {
  const out = body("const x = require('mod');");
  assert.match(out, /\$app_require\$\("mod"\)/);
  assert.ok(!/[^_$]require\(/.test(out), '不应残留未改名的 require(');
});

test('多个 require 全部改名', () => {
  const out = body("const a = require('m1');\nconst b = require('m2');");
  const count = (out.match(/\$app_require\$\(/g) ?? []).length;
  assert.strictEqual(count, 2);
});

// ---------- 不应被改写的情况 ----------

test('字符串常量中的 require 不被改写', () => {
  const out = body('const tip = "请使用 require() 加载模块";');
  assert.match(out, /"请使用 require\(\) 加载模块"/);
  assert.ok(!out.includes('$app_require$'), '字符串内容不应被改写');
});

test('模板字符串中的 require 不被改写', () => {
  const out = body('const tip = `call require() here`;');
  assert.match(out, /require\(\) here/);
  assert.ok(!out.includes('$app_require$'));
});

test('成员访问 obj.require 不被改写', () => {
  const out = body('obj.require("x");');
  assert.match(out, /obj\.require\(/);
  assert.ok(!out.includes('$app_require$'));
});

test('属性名 require 不被改写', () => {
  const out = body('const config = { require: true };');
  assert.match(out, /require:\s*true/);
  assert.ok(!out.includes('$app_require$'));
});

test('局部绑定的 require 参数不被改写', () => {
  const out = body('function f(require) { return require("x"); }');
  // 参数名和调用都应保持 require
  assert.match(out, /function f\(require\)/);
  assert.ok(!out.includes('$app_require$'), '局部变量不应被改写');
});

test('变量名含 require 的不被误改', () => {
  const out = body('const myRequire = 1; const x = myRequire;');
  assert.match(out, /myRequire/);
  assert.ok(!out.includes('$app_require$'));
});

test('debug 模式保留注释，注释中的 require 不影响代码', () => {
  const out = body('// TODO: 用 require 替换\nconst a = 1;');
  // 注释保留，但不影响代码语义
  assert.match(out, /const a = 1/);
});

// ---------- ES2020 语法保留 ----------

test('箭头函数原样保留', () => {
  const out = body('const f = (x) => x * 2;');
  assert.match(out, /=>/);
});

test('模板字符串原样保留', () => {
  const out = body('const s = `hello ${name}`;');
  assert.match(out, /`hello \$\{name\}`/);
});

test('解构原样保留', () => {
  const out = body('const { a, b } = obj;');
  assert.match(out, /const\s*\{\s*a,\s*b\s*\}/);
});

test('可选链原样保留', () => {
  const out = body('const x = a?.b?.c;');
  assert.match(out, /\?\./);
});

test('空值合并原样保留', () => {
  const out = body('const x = a ?? b;');
  assert.match(out, /\?\?/);
});

test('对象方法简写原样保留', () => {
  const out = body('export default { onInit() { return 1; } };');
  assert.match(out, /onInit\(\)/);
});

test('async/await 原样保留', () => {
  const out = body('async function f() { await g(); }');
  assert.match(out, /async function/);
  assert.match(out, /await/);
});

test('class 原样保留', () => {
  const out = body('class A { m() {} }');
  assert.match(out, /class A/);
});

// ---------- 空脚本 ----------

test('空脚本返回空字符串', () => {
  assert.strictEqual(body(''), '');
  assert.strictEqual(body('   \n  '), '');
});

// ---------- 错误处理 ----------

test('语法错误抛出并附文件绝对行号', () => {
  // startLine=30，错误在区块第 2 行 -> 文件第 31 行
  assert.throws(
    () => body('const a = 1;\nconst = 2;', 30),
    (err) => {
      assert.ok(err instanceof ScriptCompileError);
      assert.strictEqual(err.file, FILE);
      assert.strictEqual(err.line, 31, `期望 31，实际 ${err.line}`);
      assert.match(err.message, /JS 语法错误/);
      return true;
    }
  );
});

test('错误消息不含 unknown 前缀和位置后缀', () => {
  assert.throws(
    () => body('const = 1;'),
    (err) => {
      assert.ok(!err.message.includes('unknown:'), '应清理 unknown: 前缀');
      assert.ok(!/\(\d+:\d+\)/.test(err.message), '应清理位置后缀');
      return true;
    }
  );
});

test('未闭合括号报错', () => {
  assert.throws(() => body('function f( {'), ScriptCompileError);
});

// ---------- 完整函数包裹 ----------

test('compileScript 产出完整函数', () => {
  const out = compileScript('export default { a: 1 };', FILE, 2);
  assert.match(out, /^function \(module, exports, \$app_require\$\) \{/);
  assert.match(out, /\}$/);
});

test('产出的函数可执行且 exports 正确', () => {
  const code = compileScript(
    "export default { private: { title: 'x' }, onInit() { return 1; } };",
    FILE,
    2
  );
  const factory = eval(`(${code})`);

  const module = { exports: {} };
  const exports = module.exports;
  const appRequire = () => ({});

  factory(module, exports, appRequire);

  assert.strictEqual(exports.__esModule, true);
  assert.deepStrictEqual(exports.default.private, { title: 'x' });
  assert.strictEqual(typeof exports.default.onInit, 'function');
});

test('产出的函数中 $app_require$ 被正确调用', () => {
  const code = compileScript(
    "import router from '@app-module/system.router';\nexport default { m() { router.push({ uri: '/x' }); } };",
    FILE,
    2
  );
  const factory = eval(`(${code})`);

  const calls = [];
  const pushCalls = [];
  const appRequire = (name) => {
    calls.push(name);
    return { default: { push: (opts) => pushCalls.push(opts) } };
  };

  const module = { exports: {} };
  factory(module, module.exports, appRequire);

  assert.deepStrictEqual(calls, ['@app-module/system.router']);

  // 调用 VM 方法，验证 router.push 链路
  module.exports.default.m();
  assert.deepStrictEqual(pushCalls, [{ uri: '/x' }]);
});

// ---------- 示例项目对齐 ----------

test('示例 Demo 脚本编译产物结构正确', () => {
  const script = [
    "import router from '@app-module/system.router';",
    '',
    'export default {',
    '  private: {',
    "    title: '欢迎体验快应用开发'",
    '  },',
    '  onInit() {',
    "    this.$page.setTitleBar({ text: '欢迎体验快应用开发' });",
    '  },',
    '  onDetailBtnClick() {',
    "    router.push({ uri: '/pages/DemoDetail' });",
    '  }',
    '};',
  ].join('\n');

  const code = compileScript(script, FILE, 2);
  const factory = eval(`(${code})`);

  const pushCalls = [];
  const appRequire = () => ({ default: { push: (o) => pushCalls.push(o) } });
  const module = { exports: {} };
  factory(module, module.exports, appRequire);

  const vm = module.exports.default;
  assert.strictEqual(vm.private.title, '欢迎体验快应用开发');
  assert.strictEqual(typeof vm.onInit, 'function');
  assert.strictEqual(typeof vm.onDetailBtnClick, 'function');

  // 验证 onDetailBtnClick 能正确调用 router.push
  vm.onDetailBtnClick();
  assert.deepStrictEqual(pushCalls, [{ uri: '/pages/DemoDetail' }]);
});
```

最后三个用例是本 Step 的核心验收：**产出的函数必须可执行，且 `$app_require$` 调用链正确**。

`产出的函数中 $app_require$ 被正确调用` 这个用例完整模拟了 Runtime 的行为：注入一个 mock `$app_require$`，执行工厂函数，然后调用 VM 方法验证 `router.push` 能到达。这比检查代码字符串包含某个模式可靠得多。

---

## Step 7.6：逐层验证

### 7.6.1：安装依赖与编译

```bash
cd quickapp-toolkit
npm install @babel/core@7.24.5 @babel/plugin-transform-modules-commonjs@7.24.1
npm install --save-dev @types/babel__core@7.20.5
npm run build && npm test
```

**预期：** script-compiler 的 33 个用例全部通过，累计 173 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `Cannot find module '@babel/plugin-transform-modules-commonjs'` | 插件未安装 | 按上面命令安装 |
| `TS7016: Could not find a declaration file for '@babel/core'` | 类型声明缺失 | 安装 `@types/babel__core` |
| `TS2345: PluginObj 类型不匹配` | visitor 签名 | 用 `NodePath<t.CallExpression>` 显式标注 |
| 所有 require 都没改名 | `noGlobals` 未设置 | 确认 `hasBinding('require', { noGlobals: true })` |
| 局部 require 也被改名 | `hasBinding` 检查缺失 | 确认插件里有作用域检查 |

`noGlobals: true` 漏掉是最容易犯的错误：默认情况下 Babel 认为 `require` 是 Node 全局变量，`hasBinding` 返回 true，插件直接 return，所有调用都不改名。测试里「裸 require 调用改名」会失败。

### 7.6.2：转换正确性对照

```bash
node -e "
const { compileScriptBody } = require('./dist/compiler/script-compiler.js');
const cases = [
  [\"import x from 'm';\", 'import 默认导入'],
  [\"const x = require('m');\", '裸 require'],
  ['export default { a: 1 };', 'export default'],
  ['const s = \"call require()\";', '字符串内 require'],
  ['obj.require(\"x\");', '成员访问 require'],
  ['function f(require) { return require(1); }', '局部绑定 require']
];
for (const [src, label] of cases) {
  console.log('--- ' + label + ' ---');
  console.log('输入:', src);
  console.log('输出:', compileScriptBody(src, '/x.ux', 2).replace(/\n/g, ' '));
  console.log();
}
"
```

**预期输出要点：**

```text
--- import 默认导入 ---
输出: ... var _m = _interopRequireDefault($app_require$("m")); ...

--- 裸 require ---
输出: const x = $app_require$("m");

--- export default ---
输出: ... exports.default = { a: 1 }; ... __esModule ...

--- 字符串内 require ---
输出: const s = "call require()";        ← 未被改写

--- 成员访问 require ---
输出: obj.require("x");                  ← 未被改写

--- 局部绑定 require ---
输出: function f(require) { return require(1); }   ← 未被改写
```

后三项是核心验证点。任何一项被误改都意味着正则方案的问题在 AST 方案里重现了——说明 `hasBinding` 检查或 `callee.type` 判断有问题。

### 7.6.3：行号换算验证

```bash
node -e "
const { compileScriptBody } = require('./dist/compiler/script-compiler.js');
// 模拟 <script> 在文件第 42 行，内容从第 43 行开始
const script = [
  'export default {',      // 文件第 43 行
  '  private: {},',        // 文件第 44 行
  '  onInit() {',          // 文件第 45 行
  '    const = 1;',        // 文件第 46 行 <- 语法错误
  '  }',
  '};'
].join('\n');
try {
  compileScriptBody(script, '/x/index.ux', 43);
} catch (e) {
  console.log('报错行号:', e.line, '(期望 46)');
  console.log('列号:', e.column);
  console.log('消息:', e.message);
}
"
```

**预期输出：**

```text
报错行号: 46 (期望 46)
列号: 11
消息: JS 语法错误：Unexpected token
```

如果行号是 4（区块相对行号），开发者按行号去看会看到 `<template>` 区块的内容。这是三个编译器共同的风险点，都要单独验证。

### 7.6.4：产物可执行性验证

这是最重要的验证：产出的模块函数必须能在 Runtime 环境中正确执行。

```bash
node -e "
const { compileScript } = require('./dist/compiler/script-compiler.js');

const script = [
  \"import router from '@app-module/system.router';\",
  \"import prompt from '@app-module/system.prompt';\",
  'export default {',
  \"  private: { title: '欢迎体验快应用开发' },\",
  '  onInit() { this.initialized = true; },',
  \"  onDetailBtnClick() { router.push({ uri: '/pages/DemoDetail' }); },\",
  \"  onToast() { prompt.showToast({ message: 'hi' }); }\",
  '};'
].join('\n');

const code = compileScript(script, '/x.ux', 2);
const factory = eval('(' + code + ')');

// 模拟 Runtime 的 \$app_require\$
const log = [];
const modules = {
  '@app-module/system.router': { default: { push: (o) => log.push(['push', o]) } },
  '@app-module/system.prompt': { default: { showToast: (o) => log.push(['toast', o]) } }
};
const appRequire = (name) => { log.push(['require', name]); return modules[name]; };

const module = { exports: {} };
factory(module, module.exports, appRequire);

const vm = module.exports.default;
console.log('__esModule:', module.exports.__esModule);
console.log('private.title:', vm.private.title);

// 模拟 framework.js 调用生命周期和事件
vm.onInit.call(vm);
console.log('onInit 生效:', vm.initialized === true);

vm.onDetailBtnClick();
vm.onToast();

console.log();
console.log('调用序列:');
for (const entry of log) console.log(' ', JSON.stringify(entry));
"
```

**预期输出：**

```text
__esModule: true
private.title: 欢迎体验快应用开发
onInit 生效: true

调用序列:
  ["require","@app-module/system.router"]
  ["require","@app-module/system.prompt"]
  ["push",{"uri":"/pages/DemoDetail"}]
  ["toast",{"message":"hi"}]
```

**验证点：**
- `__esModule` 为 true，Bundle 组装的工厂能识别并取 `exports.default`
- 两个模块在工厂执行时立即 require（不是懒加载）
- `router.push` 和 `prompt.showToast` 的参数完整传递
- 生命周期方法能以 VM 为 `this` 调用

### 7.6.5：示例项目端到端

```bash
node -e "
const fs = require('fs');
const { parseSFC } = require('./dist/parser/sfc-parser.js');
const { compileScript } = require('./dist/compiler/script-compiler.js');

for (const page of ['Demo', 'DemoDetail']) {
  const file = '../quickapp-examples/quickapp-code-test1/src/pages/' + page + '/index.ux';
  const src = fs.readFileSync(file, 'utf8');
  const d = parseSFC(src, file);
  if (!d.script) { console.log(page, '无脚本区块'); continue; }
  const code = compileScript(d.script.content, file, d.script.startLine);
  console.log('=== ' + page + ' ===');
  console.log(code);
  console.log();
}
"
```

**预期：** 两个页面都编译成功，产物是完整的 `function (module, exports, $app_require$) { ... }`。

同时执行产物验证其行为：

```bash
node -e "
const fs = require('fs');
const { parseSFC } = require('./dist/parser/sfc-parser.js');
const { compileScript } = require('./dist/compiler/script-compiler.js');

const file = '../quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux';
const d = parseSFC(fs.readFileSync(file, 'utf8'), file);
const factory = eval('(' + compileScript(d.script.content, file, d.script.startLine) + ')');

const m = { exports: {} };
factory(m, m.exports, (name) => ({ default: { push: () => {}, showToast: () => {} } }));
const vm = m.exports.default;
console.log('VM 字段:', Object.keys(vm));
console.log('private:', JSON.stringify(vm.private));
"
```

**预期：** 输出 VM 的字段列表和 `private` 数据，与源码一致。

### 7.6.6：与官方产物对照

```bash
cd ../quickapp-examples/quickapp-code-test1/dist
[ -d debug ] || unzip -q com.example.case1.debug.1.0.0.rpk -d debug
grep -A 25 'script-loader' debug/pages/Demo/index.js | head -35
```

**对照清单：**

| 维度 | 官方产物 | 本工具链 | 必须一致 |
|---|---|---|---|
| 模块函数签名 | `(module, exports, $app_require$)` | 同 | 是 |
| `exports.default` 赋值 | 存在 | 存在 | 是 |
| `exports.__esModule` | true | true | 是 |
| `$app_require$` 调用 | 存在，参数为模块名 | 同 | 是 |
| 默认导入的 `.default` 访问 | `_system.default.push` | 同（变量名可能不同） | 语义一致 |
| `private` 字段内容 | 与源码一致 | 同 | 是 |
| 生命周期方法 | 与源码一致 | 同 | 是 |
| 生成的临时变量名 | `_system` | `_systemRouter` 等 | 否 |
| 是否有 `"use strict"` | 无 | 无 | 是 |

变量名不同是可接受的：Babel 的命名策略与官方工具链的实现细节有关，不影响语义。关键是 `.default` 访问链存在——这决定了 `router.push` 能否到达。

---

## 技术决策

### 1. Babel AST 转换，不用正则替换

正则会改写字符串常量、注释、属性名和局部变量。前两者产生错误的产物内容，后两者产生运行时错误。

最危险的是属性名：`this.$app.require('x')` 被改成 `this.$app.$app_require$('x')`，运行时报「`$app_require$` is not a function」。开发者会去查全局函数注入，而根因是编译器改错了成员表达式。

AST 只匹配 `callee.type === 'Identifier' && name === 'require'`，成员访问是 `MemberExpression` 不匹配。代价是 30MB 依赖和几十毫秒编译耗时，编译不在热路径上，可接受。

### 2. 检查作用域绑定，跳过局部 require

`function f(require) { require(x) }` 里的 `require` 是用户的参数，不应改写。`path.scope.hasBinding('require', { noGlobals: true })` 区分自由标识符和词法绑定。

`noGlobals: true` 必须加：默认情况下 Babel 把 `require` 当 Node 全局变量，`hasBinding` 恒为 true，插件永远不生效。

### 3. 不做 ES5 降级

目标引擎是 QuickJS，完整支持 ES2020。引入 `preset-env` 降级会增大体积、引入 polyfill 依赖、降低产物可读性，且没有收益。

如果将来要支持更老的 JS 引擎，降级作为可选 flag 加入，不改默认行为。

### 4. 禁用用户项目的 babel 配置

`babelrc: false` + `configFile: false`。用户项目里可能有 `.babelrc` 或 `babel.config.js`，那是给他们自己的构建（如单测）用的。

如果不禁用，用户的配置会影响 toolkit 的编译行为——比如他们配了 `preset-env` targets 到 IE11，产物会被降级成 ES5，体积暴增且引入 polyfill 引用（而 RPK 里没有 polyfill 模块）。

### 5. 不生成 sourcemap

RPK 格式不含 sourcemap 文件。内联 sourcemap（base64 data URL）会让 bundle 体积翻倍。

官方 debug 产物里有内联 sourcemap，但那是 42KB vs 18KB 的主要差异来源之一。我们不生成，debug 产物的可读性靠保留原始格式和变量名保证。

代价是设备上的 JS 异常堆栈行号对应编译后代码，不对应 `.ux` 源码。V2 可以考虑生成独立的 `.map` 文件并由 Runtime 在 debug 模式加载。

### 6. `strictMode: false`

不生成 `"use strict"` 指令。QuickJS 的模块作用域已是严格模式，且官方产物中没有这个指令。

保持一致降低产物 diff 噪音。

### 7. 保留 `exports.__esModule` 标记

`loose: false` 让 Babel 生成这个标记。Bundle 组装的 `$app_define$` 工厂依赖它：

```javascript
if ($app_exports$.__esModule && $app_exports$.default) {
  $app_module$.exports = $app_exports$.default;
}
```

如果用 `loose: true`，标记不生成，工厂无法识别 ES module 导出，`$app_module$.exports` 会是整个 exports 对象而非 `exports.default`——VM 结构完全错误。

### 8. `compileScriptBody` 和 `compileScript` 拆开

前者返回函数体语句，后者返回完整函数。`app.js` 的包裹形式与页面不同（Step 8 会看到），让组装层决定包裹方式更灵活。

### 9. 清理 Babel 错误消息的前缀和位置后缀

Babel 消息形如 `unknown: Unexpected token (3:10)`。`unknown:` 是文件名占位（我们传了 filename 但 Babel 某些错误路径不用它），`(3:10)` 是区块相对位置。

位置信息已经在 `line`/`column` 字段里，重复出现会让诊断输出冗长，且区块相对位置会误导开发者。

---

## QA

**Q：`_interopRequireDefault` 是什么，为什么产物里有它？**

Babel 为 ES module 到 CommonJS 的互操作生成的辅助函数。它处理「导入的模块可能是 CommonJS（无 `__esModule` 标记）」的情况：

```javascript
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
```

对于 `@app-module/system.router`，Runtime 侧的 `$app_require$` 返回的是 `{ default: {...} }` 结构（见 `js_bridge.cpp` 的 `native_app_require`），已经有 `default` 字段但没有 `__esModule` 标记。

这意味着 `_interopRequireDefault` 会把它再包一层：`{ default: { default: {...} } }`，导致 `router.push` 变成 `_m.default.default.push`——多一层。

**这是一个需要验证的风险点。** Step 11（Runtime 契约验收）必须实测这条链路。如果确实多包了一层，两种解法：

一是 Runtime 侧在 `native_app_require` 返回的对象上加 `__esModule: true`；二是 toolkit 侧配置 Babel 不生成 interop（`noInterop: true`）。

倾向第一种：改 Runtime 一行，且让 `$app_require$` 的返回值语义更明确（「我返回的是 ES module 形状」）。

**Q：为什么官方产物里是 `_system.default.push` 而不是 `_system.push`？**

因为 `import router from 'x'` 的语义是「取模块的默认导出」，CommonJS 里对应 `require('x').default`。

官方产物里没有 `_interopRequireDefault` 调用，说明官方工具链配置了 `noInterop` 或用了不同的转换策略。这印证了上一个 QA 提到的风险——我们的配置可能与官方不一致。

**Q：如果用户写 `const router = require('@app-module/system.router')` 而不是 import 呢？**

产物是 `const router = $app_require$('@app-module/system.router')`，然后用 `router.default.push()` 访问。

这与 import 写法的最终形式一致（都要走 `.default`），因为 Runtime 侧返回的就是 `{ default: {...} }` 结构。

**Q：`comments: mode === 'debug'` 有什么实际影响？**

debug 产物保留注释便于阅读，release 去掉减小体积。

但 release 模式还会走 Terser（Step 10），Terser 默认也去注释。这里的配置是双重保险，且让 Babel 阶段的产物就已经精简——如果 Terser 因某种原因被跳过，release 产物也不会带注释。

**Q：npm 依赖打包为什么不支持？**

V1 假设页面只依赖 `@app-module/*` 系统模块，不引入第三方 npm 包。

支持 npm 打包需要完整的模块解析（`node_modules` 查找、`package.json` 的 `main`/`exports` 字段处理）和依赖图遍历——那就是 webpack 的核心功能。V1 的 Bundle Assembler 只做字符串拼装（Step 8），不具备这个能力。

如果用户 `import lodash from 'lodash'`，产物里会是 `$app_require$('lodash')`，Runtime 侧找不到这个模块，返回 undefined，运行时报错。

这是明确的 V1 限制。V2 需要时应该引入真实 bundler（webpack 或 rollup）替换 Bundle Assembler，而不是自己实现模块解析。

**Q：`transformSync` 是同步的，会不会成为性能瓶颈？**

单个页面的 script 通常几十行，Babel 转换在 10ms 量级。示例项目两个页面共 20ms。

如果页面数量增长到几十个，可以改用 `transformAsync` 并行处理。但 Phase 2 的三路编译本身是可并行的（tasks.md 里 2.2/2.3/2.4 标注了可并行），先做那一层并行收益更大。

**Q：语法错误的 `column` 为什么要 +1？**

Babel 的 `loc.column` 是 0-based，`Diagnostic` 约定 1-based（与编辑器显示一致）。不转换会导致诊断输出的指示箭头偏左一格。

postcss 的 column 是 1-based，所以 Step 6 里没有这个转换。两个库的约定不同，这类差异要在各自的适配层处理掉。

---

## 下一步

Step 8 实现 Bundle Assembler：把模板、样式、脚本三路产物组装为符合 Runtime 接口约定 的 webpack bundle，产出 `$app_define$` + `$app_bootstrap$` 调用。
