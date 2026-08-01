# Step 10：Release 压缩

## 目录

- [目标](#目标)
- [Step 10.1：必须保留的标识符](#step-101必须保留的标识符)
- [Step 10.2：实现 Minifier](#step-102实现-minifier)
- [Step 10.3：接入组装管线](#step-103接入组装管线)
- [Step 10.4：单元测试](#step-104单元测试)
- [Step 10.5：逐层验证](#step-105逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**Release 模式下用 Terser 压缩 bundle，保持语义与 debug 等价。**

| 维度 | debug | release |
|---|---|---|
| 变量名 | 完整 | 压缩为单字母 |
| 空白与换行 | 保留 | 去除 |
| 注释 | 保留 | 去除 |
| 注入的全局函数名 | 原样 | **必须原样** |
| 运行行为 | — | 与 debug 完全一致 |

**验收标准：**
- release 产物体积相比 debug 减少 60% 以上
- `$app_define$` / `$app_bootstrap$` / `$app_require$` 在压缩产物中保持原名
- 压缩产物的 exports 结构和行为与 debug 完全一致（Property 5）
- 压缩失败时报错并中止，不产出未压缩的 release 包

**本步不包含：**
- debug 模式的任何变化（debug 不走压缩）
- Tree shaking（模块表只有三项，无死代码）
- 混淆（obfuscation）—— 压缩不等于混淆，V1 不做代码保护

---

## Step 10.1：必须保留的标识符

bundle 里有三个来自外部的自由标识符——它们由 C++ 侧注入到 JS 全局对象，bundle 只是引用：

```javascript
$app_define$('@app-component/index', [], function (...) { ... });
$app_bootstrap$('@app-component/index', { packagerVersion: "1.0.0" });
// 以及 script 模块参数里的
function (module, exports, $app_require$) { ... }
```

Terser 默认会把它认为是「未声明的全局变量」而保留——但这依赖它的全局变量检测正确。有两种情况会出问题：

**情况一：`$app_require$` 是函数参数。** 它在 `function (module, exports, $app_require$)` 里是形参，Terser 会把形参名压缩为 `n` 之类。这本身没问题（函数体内引用也一起改），但如果 `$app_define$` 的工厂里传递它：

```javascript
$app_define$('...', [], function ($app_require$, $app_exports$, $app_module$) {
  $app_script$($app_module$, $app_exports$, $app_require$);
});
```

这里 `$app_require$` 是工厂函数的形参，由 framework.js 调用时传入。压缩形参名不影响功能——参数是按位置传递的。

**情况二：`toplevel` 压缩开启时。** Terser 的 `toplevel: true` 会压缩顶层作用域的声明。bundle 的最外层是 IIFE，内部的 `__webpack_modules__`、`__webpack_require__`、`$app_script$` 都是局部变量，压缩它们是安全的。但如果 Terser 误判 `$app_define$` 为可压缩的顶层声明，调用就会指向 undefined。

保险做法是显式 reserve 三个名字：

```text
mangle.reserved = ['$app_define$', '$app_bootstrap$', '$app_require$']
```

代价是这三个名字在产物中保持原样（每处约 13 字节），一个页面 bundle 里出现 4-6 次，总共约 70 字节。相比整体体积降幅可忽略。

收益是消除一整类风险：**压缩后 `$app_define$ is not a function`，页面完全不渲染。** 这类错误只在 release 包上出现，debug 测试通过，容易漏到线上。

还有一个容易忽略的点：**`exports.__esModule` 不能被压缩掉。**

```javascript
if ($app_exports$.__esModule && $app_exports$.default) {
  $app_module$.exports = $app_exports$.default;
}
```

`__esModule` 是属性名。Terser 默认不压缩属性名（`mangle.properties` 默认关闭），所以安全。但如果有人为了极致体积开启 `mangle.properties`，这里会断——同时 `template`、`style`、`private`、`onInit` 等所有 Runtime 侧按名读取的属性都会断。

结论：**绝不开启属性名压缩。** 这条约束比 reserve 三个函数名更重要，因为它影响的属性数量多得多。

---

## Step 10.2：实现 Minifier

```text
@add quickapp-toolkit/src/minify/minifier.ts（新建文件）
```

```typescript
import { minify, type MinifyOptions } from 'terser';
import { PackageError } from '../diagnostics/errors';

/**
 * 必须保留原名的标识符。
 *
 * 这三个是 C++ 侧注入到 JS 全局对象的函数，bundle 只引用不声明。
 * 被改名后 bundle 会调用到 undefined，页面完全不渲染 —— 且这个
 * 错误只在 release 包上出现，debug 测试通过。
 */
const RESERVED_GLOBALS = ['$app_define$', '$app_bootstrap$', '$app_require$'];

/**
 * Terser 配置。
 *
 * 关键约束：绝不开启属性名压缩（mangle.properties）。Runtime 侧
 * 按名读取 template、style、private、onInit、__esModule、type、
 * attr、classList、events、children 等属性 —— 压缩任何一个都会
 * 让渲染失败。
 *
 * @returns Terser 选项
 */
function terserOptions(): MinifyOptions {
  return {
    // ES2020 输出，与 QuickJS 能力对齐。
    // 不降级：Step 7 已说明理由
    ecma: 2020,

    compress: {
      // 压缩函数名。产物里没有任何按函数名查找的逻辑：模板函数属性
      // 是匿名表达式，生命周期钩子和事件处理是对象属性（由
      // mangle.properties 管，不受此项影响）。release 堆栈本来
      // 就不可读（变量名已单字母、行号全在第一行），保住函数名
      // 收益有限 —— 排查 release 问题的正确做法是用 debug 包复现
      keep_fnames: false,

      // 不做不安全的优化。unsafe 系列会假设代码不依赖某些边界行为。
      // unsafe_arrows 把「函数体不引用 this」的 function 转成箭头函数：
      // 模板插值函数体内有 this 所以不受影响，但空的生命周期钩子
      // （onDestroy: function () {}）会被转换，用户以后往里面加
      // this.xxx 就会断 —— 静态分析看不到 framework.js 的 .call(vm)
      unsafe: false,
      unsafe_arrows: false,
      unsafe_methods: false,

      // 多轮压缩，体积更小。2 轮是收益递减点
      passes: 2,

      // 保留 debugger 语句为 false：release 包不应有 debugger
      drop_debugger: true,

      // 不移除 console：Runtime 侧的 console 是注入的原生函数，
      // 开发者可能依赖它在 release 上排查问题。
      // manifest.config.logLevel 已控制日志级别
      drop_console: false,
    },

    mangle: {
      reserved: RESERVED_GLOBALS,
      // 压缩顶层作用域。bundle 最外层是 IIFE，内部变量都是局部的，
      // 压缩安全。reserved 保护了三个注入的全局函数名
      toplevel: true,
      // 绝不开启：Runtime 按名读取大量属性
      properties: false,
    },

    format: {
      comments: false,
      // 不保留分号后的换行，最紧凑
      beautify: false,
      // ASCII 转义非 ASCII 字符为 false：保留 UTF-8 原文。
      // 中文文本用 \uXXXX 转义会让体积增大约 3 倍
      ascii_only: false,
    },

    sourceMap: false,
  };
}

/**
 * 压缩 bundle 代码。
 *
 * Terser 的 minify 是异步 API（返回 Promise），但整条编译管线是
 * 同步的。用 deasync 或 worker 同步化会引入依赖和复杂度，
 * 因此这里返回 Promise，由调用方 await。
 *
 * @param code     待压缩的 bundle 代码
 * @param filename 源文件标识，用于错误信息
 * @returns 压缩后代码
 * @throws PackageError 压缩失败（通常是语法错误，说明前面某步产出了非法代码）
 */
export async function minifyBundle(
  code: string,
  filename: string
): Promise<string> {
  let result;
  try {
    result = await minify(code, terserOptions());
  } catch (e) {
    // Terser 报语法错误意味着我们的组装产出了非法 JS ——
    // 这是 toolkit 内部缺陷，不是用户代码问题。
    // 报错时附上足够信息便于定位
    const err = e as { message: string; line?: number; col?: number };
    const pos =
      err.line === undefined ? '' : `（压缩前代码第 ${err.line} 行）`;
    throw new PackageError(
      `Terser 压缩失败${pos}：${err.message}。这通常表示 bundle 组装产出了非法 JS，请检查编译器输出。`,
      filename
    );
  }

  if (result.code === undefined) {
    throw new PackageError('Terser 返回空结果', filename);
  }

  return result.code;
}

/**
 * 校验压缩产物是否保留了必需的标识符。
 *
 * 防御性检查：如果 Terser 的配置被误改导致 reserved 失效，
 * 这里会立刻发现，而不是等到设备上页面空白才排查。
 *
 * @param code     压缩后代码
 * @param filename 源文件标识
 * @param isApp    true 表示 app.js（不检查 template/style 相关）
 * @throws PackageError 缺少必需标识符
 */
export function verifyMinified(
  code: string,
  filename: string,
  isApp: boolean
): void {
  const missing: string[] = [];

  // $app_define$ 和 $app_bootstrap$ 必须存在
  for (const name of ['$app_define$', '$app_bootstrap$']) {
    if (!code.includes(name)) missing.push(name);
  }

  // 页面 bundle 必须挂载 template 和 style
  if (!isApp) {
    for (const prop of ['template', 'style']) {
      if (!code.includes(prop)) missing.push(`.${prop}`);
    }
  }

  // __esModule 判断必须保留
  if (!code.includes('__esModule')) missing.push('__esModule');

  if (missing.length > 0) {
    throw new PackageError(
      `压缩产物缺少必需标识符：${missing.join('、')}。` +
        `检查 Terser 的 mangle.reserved 和 mangle.properties 配置。`,
      filename
    );
  }
}
```

`verifyMinified` 是防御性检查，不是必需的功能。它的价值在于：如果将来有人为了减小体积调整 Terser 配置（比如开启 `mangle.properties`），构建会立刻失败并给出明确原因，而不是产出一个在设备上白屏的包。

这类「配置改动导致 release 独有的失败」是最难排查的问题之一——debug 全绿，release 白屏，且现象与配置改动没有明显关联。

---

## Step 10.3：接入组装管线

Terser 是异步 API，`assemblePageBundle` 是同步的。两种接入方式：

| 方式 | 做法 | 影响 |
|---|---|---|
| 组装内压缩 | `assemblePageBundle` 改为 async | 整条调用链都要 async，改动面大 |
| 组装后压缩 | 组装保持同步，统一在 `runBuild` 里压缩 | 组装逻辑不变，压缩集中一处 |

选组装后压缩。职责更清晰：组装负责产出正确的 JS，压缩是独立的优化步骤。

```text
@add quickapp-toolkit/src/minify/minifier.ts — 在文件末尾插入
```

```typescript
/**
 * 批量压缩 bundle。
 *
 * @param bundles 产物路径 -> bundle 代码
 * @returns 压缩后的映射，key 与输入一致
 * @throws PackageError 任一 bundle 压缩失败
 */
export async function minifyBundles(
  bundles: Map<string, string>
): Promise<Map<string, string>> {
  const entries = [...bundles.entries()];

  const results = await Promise.all(
    entries.map(async ([entryPath, code]) => {
      const minified = await minifyBundle(code, entryPath);
      verifyMinified(minified, entryPath, entryPath === 'app.js');
      return [entryPath, minified] as [string, string];
    })
  );

  return new Map(results);
}
```

`runBuild` 需要改为 async。

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 runBuild 签名行
```

```typescript
export async function runBuild(options: BuildOptions): Promise<number> {
```

```text
@add quickapp-toolkit/src/cli/cmd-build.ts — 在 import 段末尾追加
```

```typescript
import { minifyBundles } from '../minify/minifier';
```

```text
@add quickapp-toolkit/src/cli/cmd-build.ts — 在「Step 9：RPK 打包」之前插入
```

```typescript
  // ---- Step 10：Release 压缩 ----
  let finalBundles = bundles;
  if (ctx.mode === 'release') {
    const before = totalSize(bundles);
    try {
      finalBundles = await minifyBundles(bundles);
    } catch (e) {
      if (e instanceof CompileError) {
        ctx.diagnostics.push(fromError(e));
        reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
        return 1;
      }
      throw e;
    }
    const after = totalSize(finalBundles);
    const ratio = before === 0 ? 0 : ((1 - after / before) * 100).toFixed(1);
    console.log(
      `压缩：${formatSize(before)} -> ${formatSize(after)}（减少 ${ratio}%）`
    );
    console.log('');
  }
```

打包时用 `finalBundles` 替换 `bundles`：

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 packRPK 调用的 bundles 参数
```

```typescript
    result = packRPK({
      ctx,
      manifest,
      bundles: finalBundles,
      assets: assetMap,
      toolkitVersion: PACKAGER_VERSION,
    });
```

```text
@add quickapp-toolkit/src/cli/cmd-build.ts — 在 formatSize 之后插入
```

```typescript
/**
 * 计算所有 bundle 的总字节数。
 * @param bundles 产物映射
 * @returns 总字节数（UTF-8 编码后）
 */
function totalSize(bundles: Map<string, string>): number {
  let sum = 0;
  for (const code of bundles.values()) {
    sum += Buffer.byteLength(code, 'utf8');
  }
  return sum;
}
```

CLI 入口也要处理 Promise：

```text
@update quickapp-toolkit/src/cli/index.ts — 替换 main 函数签名和 build 分支
```

```typescript
export async function main(argv: string[]): Promise<number> {
```

```typescript
      case 'build':
        return await runBuild({
          projectRoot: resolveRoot(flags),
          mode: resolveMode(flags),
        });
```

```text
@update quickapp-toolkit/bin/quickapp.js（整个替换）
```

```javascript
#!/usr/bin/env node
'use strict';

const { main } = require('../dist/cli/index.js');

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    // 未捕获异常表示 toolkit 内部缺陷，打印完整堆栈便于报告问题
    console.error('内部错误：');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
```

`build.txt` 的 hash 基于压缩后内容计算——`packRPK` 收到的是 `finalBundles`，所以 hash 反映的是实际入包的内容。这是正确的：增量更新比对的应该是入包产物，不是压缩前的中间结果。

`build.txt` 中的 `page:pages/Demo=<hash>` 因此在 debug 和 release 下不同。这符合预期，两种模式产出的是不同的包。

---

## Step 10.4：单元测试

压缩的正确性无法靠「看产物」判断——压缩后的代码人眼很难读。测试的核心思路是：**把压缩前后的 bundle 都真正执行一遍，比较它们对外暴露的结构和行为。**

执行方式复用 Step 8 单测里的 `runBundle`：用 `new Function` 把 `$app_define$` / `$app_bootstrap$` / `$app_require$` 作为形参注入，然后执行 bundle 代码，捕获这三个函数收到的参数。这套 mock 在 Step 8 已经验证过——它能把 bundle 当作真实 Runtime 环境里的代码来跑。

```text
@add quickapp-toolkit/test/unit/minifier.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  minifyBundle,
  verifyMinified,
} = require('../../dist/minify/minifier.js');
const { PackageError } = require('../../dist/diagnostics/errors.js');

/**
 * 测试用的 debug 页面 bundle。
 *
 * 结构与 Step 8 的 assemblePageBundle 产物一致：IIFE 包裹、
 * 三个模块（template / style / script）、$app_define$ 后紧跟
 * $app_bootstrap$。字段名必须与 assembler 保持同步 —— 如果
 * Step 8 改了产物形状，这个 fixture 也要跟着改。
 *
 * 内容上刻意覆盖了压缩容易破坏的几个点：
 * - 函数属性（attr.value 的 function () { return this.title }）
 * - Runtime 按名读取的属性（type / attr / classList / events / children）
 * - private 数据与生命周期方法
 * - 中文字符串（验证 ascii_only: false）
 */
const DEBUG_BUNDLE = `
(function () {
  var __webpack_modules__ = {
    './index.template.js': function (module, exports, $app_require$) {
      module.exports = {
        type: 'div',
        attr: {},
        classList: ['wrapper'],
        children: [
          {
            type: 'text',
            attr: {
              value: function () {
                return this.title;
              }
            },
            classList: ['title'],
            children: []
          },
          {
            type: 'input',
            attr: { type: 'button', value: '点我' },
            classList: ['btn'],
            events: { click: 'onTap' },
            children: []
          }
        ]
      };
    },
    './index.style.js': function (module, exports, $app_require$) {
      module.exports = {
        '.wrapper': { flexDirection: 'column', paddingTop: '40px' },
        '.title': { fontSize: '38px', color: '#333333' }
      };
    },
    './index.script.js': function (module, exports, $app_require$) {
      Object.defineProperty(exports, '__esModule', { value: true });
      exports.default = void 0;
      var _system = $app_require$('@app-module/system.router');
      var _default = {
        private: { title: '示例标题', count: 0 },
        onInit: function () {
          this.count = this.count + 1;
        },
        onTap: function () {
          _system.default.push({ uri: '/pages/Detail' });
        }
      };
      exports.default = _default;
    }
  };
  var __webpack_cache__ = {};
  function __webpack_require__(id) {
    var cached = __webpack_cache__[id];
    if (cached !== undefined) return cached.exports;
    var module = (__webpack_cache__[id] = { exports: {} });
    __webpack_modules__[id](module, module.exports, $app_require$);
    return module.exports;
  }
  $app_define$('@app-component/index', [], function ($app_require$, $app_exports$, $app_module$) {
    var $app_script$ = __webpack_modules__['./index.script.js'];
    $app_script$($app_module$, $app_exports$, $app_require$);
    if ($app_exports$.__esModule && $app_exports$.default) {
      $app_module$.exports = $app_exports$.default;
    }
    $app_module$.exports.template = __webpack_require__('./index.template.js');
    $app_module$.exports.style = __webpack_require__('./index.style.js');
  });
  $app_bootstrap$('@app-component/index', { packagerVersion: '1.0.0' });
})();
`;

`runBundle` 与 Step 8 的版本相同，这里重复一份让测试文件自包含：

```javascript
/**
 * 在 Node 中执行一份 bundle，模拟 Runtime 的注入环境。
 *
 * 用 new Function 而不是 vm 模块：new Function 的作用域里没有
 * require、module、process，更接近 QuickJS 的环境；同时三个注入
 * 函数作为形参传入，与 C++ 侧「挂在全局对象上」的效果等价
 * （bundle 只是自由引用这些名字）。
 *
 * @param code       bundle 代码（压缩前或压缩后都可）
 * @param moduleImpl $app_require$ 的返回值提供者，参数为模块名，
 *                   返回该模块对象；不传时返回空对象
 * @returns 捕获结果：
 *          defines    —— 每次 $app_define$ 调用的 { name, deps, exports }
 *          bootstraps —— 每次 $app_bootstrap$ 调用的 { name, options }
 *          requires   —— $app_require$ 收到的模块名，按调用顺序
 * @throws bundle 自身抛出的任何异常原样传出（用于验证压缩产物可执行）
 */
function runBundle(code, moduleImpl) {
  const defines = [];
  const bootstraps = [];
  const requires = [];

  const appRequire = (name) => {
    requires.push(name);
    return moduleImpl ? moduleImpl(name) : {};
  };

  const appDefine = (name, deps, factory) => {
    // factory 内部可能整体替换 $app_module$.exports（__esModule
    // 分支），所以必须在 factory 返回后再读 module.exports
    const module = { exports: {} };
    factory(appRequire, module.exports, module);
    defines.push({ name, deps, exports: module.exports });
  };

  const appBootstrap = (name, options) => {
    bootstraps.push({ name, options });
  };

  const fn = new Function(
    '$app_define$',
    '$app_bootstrap$',
    '$app_require$',
    code
  );
  fn(appDefine, appBootstrap, appRequire);

  return { defines, bootstraps, requires };
}

/**
 * system.router 的 mock。
 *
 * 返回 { default: {...}, __esModule: true } —— 与 Runtime 侧
 * native_app_require 的返回形状对齐（HANDOFF 风险 1 的解法 A）。
 * 最终形状由 Step 11 实测确定，届时这个 mock 要同步。
 *
 * @param pushed 数组，router.push 的实参会被追加进去，供断言检查
 * @returns moduleImpl 函数，接收模块名返回模块对象；未知模块返回空对象
 */
function systemModule(pushed) {
  return (name) => {
    if (name === '@app-module/system.router') {
      return {
        __esModule: true,
        default: {
          push: (arg) => pushed.push(arg),
        },
      };
    }
    return {};
  };
}
```

### 保留标识符

```javascript
// ---------- 注入函数名保留 ----------

test('压缩后 $app_define$ 保持原名', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  assert.ok(out.includes('$app_define$('), '$app_define$ 调用被改名');
});

test('压缩后 $app_bootstrap$ 保持原名', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  assert.ok(out.includes('$app_bootstrap$('), '$app_bootstrap$ 调用被改名');
});

test('压缩后 $app_require$ 保持原名', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  // $app_require$ 在 bundle 里既是自由变量（__webpack_require__
  // 内部引用）又是形参。reserved 让两处都保持原名
  assert.ok(out.includes('$app_require$'), '$app_require$ 被改名');
});

test('压缩后组件名字符串不变', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  assert.ok(out.includes('@app-component/index'));
});

test('压缩后 $app_define$ 仍在 $app_bootstrap$ 之前', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const di = out.indexOf('$app_define$(');
  const bi = out.indexOf('$app_bootstrap$(');
  assert.ok(di >= 0 && bi >= 0);
  assert.ok(di < bi, 'define 与 bootstrap 顺序被调换');
});

test('压缩后内部变量确实被改名', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  // 反向验证：reserved 只保护三个名字，不是整体关闭了 mangle。
  // 如果 __webpack_modules__ 还在，说明 mangle.toplevel 没生效
  assert.ok(
    !out.includes('__webpack_modules__'),
    '内部变量未被压缩，检查 mangle.toplevel'
  );
});
```

### 属性名未被压缩

这组测试守护的是 Step 10.1 里那条最重要的约束。检查方式是字符串包含——属性名一旦被 mangle，产物里就不会再出现这个字面量。

```javascript
// ---------- 属性名保留 ----------

test('Runtime 按名读取的属性全部保留', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');

  // 这个列表就是 Runtime 侧的读取契约：
  // framework.js 读 template / style / private / __esModule；
  // C++ 侧 vnode 构建读 type / attr / classList / events / children
  const required = [
    'template',
    'style',
    'private',
    '__esModule',
    'type',
    'attr',
    'classList',
    'events',
    'children',
  ];

  for (const prop of required) {
    assert.ok(out.includes(prop), `属性名 ${prop} 被压缩`);
  }
});

test('生命周期与事件处理方法名保留', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  // onInit 由 framework.js 按名调用，onTap 由 events.click 的
  // 字符串值反查 —— 两边必须一致，压缩任一侧都会断
  assert.ok(out.includes('onInit'), 'onInit 被压缩');
  assert.ok(out.includes('onTap'), 'onTap 被压缩');
});

test('样式选择器 key 保留', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  // 选择器是字符串字面量，本来就不受 mangle 影响。
  // 这条测试防的是将来误开启某个把字符串键转标识符的优化
  assert.ok(out.includes('.wrapper'));
  assert.ok(out.includes('.title'));
});

test('中文字符串不被转义', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  assert.ok(out.includes('示例标题'), 'ascii_only 被误开启');
  assert.ok(!out.includes('\\u793a'), '出现 \\uXXXX 转义');
});
```

### 压缩前后行为等价（Property 5）

```javascript
// ---------- 结构等价 ----------

test('压缩前后 define 的组件名与 exports 键集合一致', async () => {
  const before = runBundle(DEBUG_BUNDLE, systemModule([]));
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const after = runBundle(out, systemModule([]));

  assert.strictEqual(after.defines.length, before.defines.length);
  assert.strictEqual(after.defines[0].name, before.defines[0].name);

  assert.deepStrictEqual(
    Object.keys(after.defines[0].exports).sort(),
    Object.keys(before.defines[0].exports).sort()
  );
});

test('压缩前后 bootstrap 参数一致', async () => {
  const before = runBundle(DEBUG_BUNDLE, systemModule([]));
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const after = runBundle(out, systemModule([]));

  assert.deepStrictEqual(after.bootstraps, before.bootstraps);
});

test('压缩前后 template 树深度相等', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const before = runBundle(DEBUG_BUNDLE, systemModule([])).defines[0].exports;
  const after = runBundle(out, systemModule([])).defines[0].exports;

  assert.strictEqual(after.template.type, before.template.type);
  assert.deepStrictEqual(after.template.classList, before.template.classList);
  assert.strictEqual(
    after.template.children.length,
    before.template.children.length
  );
  assert.deepStrictEqual(
    after.template.children[1].events,
    before.template.children[1].events
  );
});

test('压缩前后 style 完全相等', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const before = runBundle(DEBUG_BUNDLE, systemModule([])).defines[0].exports;
  const after = runBundle(out, systemModule([])).defines[0].exports;

  // 样式对象里全是字符串字面量，压缩不该有任何影响
  assert.deepStrictEqual(after.style, before.style);
});

test('压缩前后 private 数据完全相等', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const before = runBundle(DEBUG_BUNDLE, systemModule([])).defines[0].exports;
  const after = runBundle(out, systemModule([])).defines[0].exports;

  assert.deepStrictEqual(after.private, before.private);
});
```

### 模板函数属性仍可求值

模板里的插值编译成 `function () { return this.title }`，由 framework.js 用 `.call(vm)` 求值。这是压缩最容易破坏的地方：如果 Terser 把它转成箭头函数，`this` 会绑定到定义时的作用域，求值结果变成 `undefined`。

```javascript
// ---------- 函数属性 ----------

test('压缩后函数属性可用 .call(vm) 求值', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const exp = runBundle(out, systemModule([])).defines[0].exports;

  const valueFn = exp.template.children[0].attr.value;
  assert.strictEqual(typeof valueFn, 'function');

  // 模拟 framework.js 的求值：以 VM 为 this 调用
  const vm = { title: '运行期标题' };
  assert.strictEqual(valueFn.call(vm), '运行期标题');
});

test('压缩后函数属性不是箭头函数', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const exp = runBundle(out, systemModule([])).defines[0].exports;
  const valueFn = exp.template.children[0].attr.value;

  // 箭头函数没有 prototype。这条直接检测 unsafe_arrows 是否被误开启，
  // 比等到 .call(vm) 返回 undefined 再排查更直接
  assert.notStrictEqual(valueFn.prototype, undefined);
});

test('压缩后静态属性仍是字符串', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const exp = runBundle(out, systemModule([])).defines[0].exports;

  assert.strictEqual(exp.template.children[1].attr.type, 'button');
  assert.strictEqual(exp.template.children[1].attr.value, '点我');
});

test('压缩后生命周期方法可正常执行', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const exp = runBundle(out, systemModule([])).defines[0].exports;

  const vm = { count: 0 };
  exp.onInit.call(vm);
  assert.strictEqual(vm.count, 1);
});

test('压缩后事件处理方法仍能调用注入的模块', async () => {
  const pushed = [];
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const result = runBundle(out, systemModule(pushed));

  result.defines[0].exports.onTap.call({});

  // 验证两件事：$app_require$ 收到了正确的模块名，
  // 且返回值的 default.push 被调到（interop 层数正确）
  assert.deepStrictEqual(result.requires, ['@app-module/system.router']);
  assert.deepStrictEqual(pushed, [{ uri: '/pages/Detail' }]);
});
```

### 体积降幅

```javascript
// ---------- 体积 ----------

test('压缩降幅超过 60%', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  const before = Buffer.byteLength(DEBUG_BUNDLE, 'utf8');
  const after = Buffer.byteLength(out, 'utf8');
  const ratio = 1 - after / before;

  assert.ok(
    ratio > 0.6,
    `降幅只有 ${(ratio * 100).toFixed(1)}%，低于 60% 的验收线`
  );
});

test('压缩产物无换行缩进', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  // 允许末尾换行，但正文里不该有连续空格
  assert.ok(!out.includes('\n  '), '缩进未被去除，检查 format.beautify');
});
```

### 校验与错误路径

```javascript
// ---------- verifyMinified ----------

test('verifyMinified 通过正常产物', async () => {
  const out = await minifyBundle(DEBUG_BUNDLE, 'pages/Demo/index.js');
  // 不抛错即通过
  verifyMinified(out, 'pages/Demo/index.js', false);
});

test('verifyMinified 缺少 $app_define$ 时抛错', () => {
  assert.throws(
    () => verifyMinified('$app_bootstrap$("x");__esModule', 'a.js', true),
    (e) => e instanceof PackageError && e.message.includes('$app_define$')
  );
});

test('verifyMinified 缺少 $app_bootstrap$ 时抛错', () => {
  assert.throws(
    () => verifyMinified('$app_define$("x");__esModule', 'a.js', true),
    (e) => e instanceof PackageError && e.message.includes('$app_bootstrap$')
  );
});

test('verifyMinified 页面缺少 template 时抛错', () => {
  const code = '$app_define$("x");$app_bootstrap$("x");__esModule;style';
  assert.throws(
    () => verifyMinified(code, 'pages/Demo/index.js', false),
    (e) => e instanceof PackageError && e.message.includes('.template')
  );
});

test('verifyMinified 对 app.js 不检查 template 与 style', () => {
  const code = '$app_define$("x");$app_bootstrap$("x");__esModule';
  verifyMinified(code, 'app.js', true);
});

test('verifyMinified 缺少 __esModule 时抛错', () => {
  const code = '$app_define$("x");$app_bootstrap$("x");template;style';
  assert.throws(
    () => verifyMinified(code, 'pages/Demo/index.js', false),
    (e) => e instanceof PackageError && e.message.includes('__esModule')
  );
});

test('verifyMinified 报错列出所有缺失项', () => {
  assert.throws(
    () => verifyMinified('var a=1', 'pages/Demo/index.js', false),
    (e) =>
      e.message.includes('$app_define$') &&
      e.message.includes('$app_bootstrap$') &&
      e.message.includes('.template') &&
      e.message.includes('__esModule')
  );
});

// ---------- 非法输入 ----------

test('语法错误的输入转为 PackageError', async () => {
  await assert.rejects(
    () => minifyBundle('function (){', 'pages/Demo/index.js'),
    (e) => e instanceof PackageError
  );
});

test('语法错误的报错包含行号和文件名', async () => {
  await assert.rejects(
    () => minifyBundle('var a = 1;\nvar = 2;\n', 'pages/Demo/index.js'),
    (e) =>
      e instanceof PackageError &&
      e.message.includes('压缩前代码第') &&
      e.file === 'pages/Demo/index.js'
  );
});

test('空输入不抛错', async () => {
  const out = await minifyBundle('', 'app.js');
  assert.strictEqual(out, '');
});
```

**用例统计：** 32 个。累计 271 个（Step 9 结束时 239 个）。

`e.file` 的断言依赖 `PackageError` 把第二个构造参数存为 `file` 字段——Step 1 的 `errors.ts` 定义如此。如果字段名不同，改这一处断言即可。

---

## Step 10.5：逐层验证

### 10.5.1：安装依赖、编译与单测

```bash
cd quickapp-toolkit
npm install terser@5.31.0 --save-exact
npm run build && npm test
```

`--save-exact` 让 `package.json` 里写死 `"terser": "5.31.0"`，不带 `^`。压缩配置对 Terser 版本敏感：小版本更新可能改变默认优化项，导致同一份源码产出不同字节的包，破坏可复现构建。

**预期：**

```text
added 3 packages in 1s

# tests 271
# pass 271
# fail 0
```

Terser 的依赖只有 3 个包（`@jridgewell/source-map`、`acorn`、`commander`），依赖树很浅。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `Cannot find module 'terser'` | 装到了别的目录，或用了 `--no-save` | 确认 `package.json` 的 `dependencies` 里有 terser |
| `TS2339: Property 'code' does not exist` | Terser 的类型定义未被识别 | Terser 自带 `.d.ts`，检查 `tsconfig.json` 的 `moduleResolution` 是否为 `node` |
| `$app_define$ 调用被改名` | `mangle.reserved` 未生效 | 检查是否误写成 `mangle: { reserve: ... }`（正确是 `reserved`） |
| `属性名 template 被压缩` | `mangle.properties` 被开启 | 改回 `false`；`properties: {}` 空对象也等于开启 |
| `压缩后函数属性不是箭头函数` 失败 | `unsafe_arrows` 或 `arrows` 相关项被开启 | `compress.unsafe_arrows` 必须为 `false` |
| `降幅只有 xx%` | 输入本身已经很小，或 `passes` 为 0 | fixture 太小时降幅偏低是正常的；确认 `passes: 2` |
| `出现 \uXXXX 转义` | `format.ascii_only` 为 true | 改为 `false` |

### 10.5.2：压缩产物人工检视

单测能验证「字符串存在」，但看一眼真实产物能发现测试没覆盖的形状问题。

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=release
cd ../quickapp-examples/quickapp-code-test1/dist
rm -rf verify && unzip -q com.example.case1.release.1.0.0.rpk -d verify
```

先确认三个注入函数名原样保留：

```bash
grep -o '\$app_define\$' verify/pages/Demo/index.js | wc -l
grep -o '\$app_bootstrap\$' verify/pages/Demo/index.js | wc -l
grep -o '\$app_require\$' verify/pages/Demo/index.js | wc -l
```

**预期：** 依次为 `1`、`1`、`4` 左右。`$app_require$` 出现次数取决于模块数量（每个模块函数的形参 + `__webpack_require__` 内部的传递）。

三个数都必须大于 0。任何一个是 `0` 就说明 reserved 失效——此时 `verifyMinified` 本应先抛错，如果没抛，说明校验列表有遗漏。

再看产物开头：

```bash
head -c 400 verify/pages/Demo/index.js; echo
```

**预期形如：**

```javascript
!function(){var n={"./index.template.js":function(n,t,e){n.exports={type:"div",attr:{},classList:["wrapper"],children:[{type:"text",attr:{value:function(){return this.title}},classList:["title"],children:[]}
```

**检视清单：**

| 检查项 | 期望 | 不符合时的含义 |
|---|---|---|
| 首字符 | `!function(){` 或 `(function(){` | 其他形式说明 IIFE 结构被改动 |
| 属性名 | `type` / `attr` / `classList` / `children` 明文 | 被压成单字母则 `mangle.properties` 开启了 |
| 函数属性 | `function(){return this.title}` | 出现 `()=>` 则箭头函数转换被开启 |
| 中文 | `"点我"` 明文 | 出现 `\u70b9` 则 `ascii_only` 开启 |
| 变量名 | `n` / `t` / `e` 等单字母 | 仍是长名说明 mangle 未生效 |
| 换行 | 整体一行（可能末尾一个换行） | 多行说明 beautify 未关 |

顺便确认没有 sourcemap 引用：

```bash
grep -c 'sourceMappingURL' verify/pages/Demo/index.js || echo "无 sourcemap 引用（预期）"
```

**预期：** 输出 `无 sourcemap 引用（预期）`。RPK 里不含 `.map` 文件，留一个指向不存在文件的注释只会在调试工具里报 404。

### 10.5.3：在 Node 中执行压缩产物

人工检视只能看形状，执行才能验证行为。这一步把解压出来的 release 产物当作真实代码跑一遍，注入方式与 Runtime 一致。

```text
@add quickapp-toolkit/test/manual/run-bundle.js（新建文件，手工验证工具）
```

```javascript
'use strict';

/**
 * 执行一份 bundle 并打印它暴露的结构，用于手工核对 release 产物。
 *
 * 用法：node test/manual/run-bundle.js <bundle.js 路径>
 *
 * 与单测的 runBundle 相同思路，区别是它打印结果而不是断言 ——
 * 便于把 debug 和 release 的输出直接 diff。
 */

const fs = require('node:fs');

const file = process.argv[2];
if (!file) {
  console.error('用法：node test/manual/run-bundle.js <bundle.js>');
  process.exit(2);
}

const code = fs.readFileSync(file, 'utf8');
const requires = [];
let result = null;

const appRequire = (name) => {
  requires.push(name);
  return { __esModule: true, default: { push: () => {}, showToast: () => {} } };
};

const appDefine = (name, deps, factory) => {
  const module = { exports: {} };
  factory(appRequire, module.exports, module);
  result = { name, exports: module.exports };
};

const appBootstrap = (name, options) => {
  console.log('bootstrap:', name, JSON.stringify(options));
};

new Function('$app_define$', '$app_bootstrap$', '$app_require$', code)(
  appDefine,
  appBootstrap,
  appRequire
);

console.log('define:', result.name);
console.log('exports keys:', Object.keys(result.exports).sort().join(','));
console.log('require:', requires.join(',') || '（无）');

// 模板树的函数属性用固定 VM 求值，让 debug / release 输出可比对。
// JSON.stringify 会丢掉函数，所以先把函数属性替换成求值结果
const vm = { title: 'VM-TITLE', count: 7 };
const evalTree = (node) => {
  const out = { type: node.type, classList: node.classList || [] };
  out.attr = {};
  for (const [k, v] of Object.entries(node.attr || {})) {
    out.attr[k] = typeof v === 'function' ? v.call(vm) : v;
  }
  if (node.events) out.events = node.events;
  out.children = (node.children || []).map(evalTree);
  return out;
};

console.log('template:', JSON.stringify(evalTree(result.exports.template)));
console.log('style:', JSON.stringify(result.exports.style));
console.log('private:', JSON.stringify(result.exports.private));
```

执行：

```bash
cd quickapp-toolkit
node test/manual/run-bundle.js \
  ../quickapp-examples/quickapp-code-test1/dist/verify/pages/Demo/index.js
```

**预期输出：**

```text
bootstrap: @app-component/index {"packagerVersion":"1.0.0"}
define: @app-component/index
exports keys: onInit,onTap,private,style,template
require: @app-module/system.router
template: {"type":"div","classList":["wrapper"],"attr":{},"children":[{"type":"text","classList":["title"],"attr":{"value":"VM-TITLE"},"children":[]}]}
style: {".wrapper":{"flexDirection":"column","paddingTop":"40px"},".title":{"fontSize":"38px","color":"#333333"}}
private: {"title":"示例标题","count":0}
```

**常见错误：**

| 现象 | 原因 | 处理 |
|---|---|---|
| `$app_define$ is not a function` | 产物里的调用被改名，`new Function` 形参对不上 | 回到 10.5.2 检查 reserved |
| `result is null` | bundle 没调用 `$app_define$`，或调用在异步回调里 | 检查组装是否产出同步调用 |
| `attr.value` 输出 `undefined` | 函数属性变成箭头函数，`this` 不是 vm | 检查 `unsafe_arrows` |
| `exports keys` 少了 `template` | `$app_module$.exports` 被整体替换后又挂属性的顺序错了 | 查 Step 8 的组装顺序 |
| `Cannot read property 'push' of undefined` | interop 多包一层（HANDOFF 风险 1） | 与 debug 产物对照；最终结论由 Step 11 给出 |

这个工具不替代 Step 11 的真实环境验收。它验证的是「产物在标准 JS 引擎里行为正确」，而 QuickJS 的差异、framework.js 的真实时序都要等 Step 11。

### 10.5.4：debug / release 产物对照

同一份源码分别出 debug 和 release 包，用同一个工具跑，输出应逐字节相同。

```bash
cd ../quickapp-examples/quickapp-code-test1
quickapp build --root=. --mode=debug
quickapp build --root=. --mode=release

cd dist
rm -rf d r
unzip -q com.example.case1.debug.1.0.0.rpk -d d
unzip -q com.example.case1.release.1.0.0.rpk -d r

cd ../../../quickapp-toolkit
for p in app.js pages/Demo/index.js pages/DemoDetail/index.js; do
  node test/manual/run-bundle.js "../quickapp-examples/quickapp-code-test1/dist/d/$p" > /tmp/d.txt
  node test/manual/run-bundle.js "../quickapp-examples/quickapp-code-test1/dist/r/$p" > /tmp/r.txt
  if diff -q /tmp/d.txt /tmp/r.txt > /dev/null; then
    echo "OK   $p"
  else
    echo "FAIL $p"
    diff /tmp/d.txt /tmp/r.txt
  fi
done
```

**预期输出：**

```text
OK   app.js
OK   pages/Demo/index.js
OK   pages/DemoDetail/index.js
```

这是 Property 5（压缩语义等价）在真实产物上的验证。单测用的是 fixture，这里用的是完整编译管线的输出——覆盖了 fixture 没有的形状，比如 app.js 里没有 template/style、页面里的空 events 对象。

差异出现时，`diff` 的哪一行不同直接指向问题：`exports keys` 不同是结构问题，`template` 不同是函数属性求值问题，`require` 不同是模块加载顺序被优化改动了。

### 10.5.5：体积对比

```bash
cd ../quickapp-examples/quickapp-code-test1/dist

# 包体积
ls -l *.rpk | awk '{ printf "%-45s %8d 字节\n", $NF, $5 }'

# 解压后各 bundle 的体积
for m in d r; do
  echo "--- $m ---"
  find $m -name '*.js' | sort | while read f; do
    printf "%-40s %7d\n" "$f" "$(wc -c < "$f")"
  done
done
```

**预期形如：**

```text
com.example.case1.debug.1.0.0.rpk               8912 字节
com.example.case1.release.1.0.0.rpk             4180 字节
--- d ---
d/app.js                                            1180
d/pages/Demo/index.js                               3421
d/pages/DemoDetail/index.js                         3096
--- r ---
r/app.js                                             392
r/pages/Demo/index.js                               1105
r/pages/DemoDetail/index.js                          998
```

**对照表：**

| 维度 | debug | release | 降幅 |
|---|---|---|---|
| bundle 未压缩合计 | 7.7 KB | 2.4 KB | 68% |
| RPK 包体 | 8.9 KB | 4.2 KB | 53% |

两个降幅不同是正常的：RPK 里的 JS 条目本身已经过 DEFLATE，Terser 去掉的空白和长变量名在 DEFLATE 下本来就压得很好（重复字符串压缩率高）。**Terser 的收益在 DEFLATE 之后会衰减，但不会消失**——变量名缩短减少的是熵，DEFLATE 无法完全弥补。

与官方产物对照：

```bash
# 官方产物（如果手头有）
ls -l *.official 2>/dev/null || echo "无官方产物可比"
```

| 产物 | 官方 | 本工具链 | 说明 |
|---|---|---|---|
| debug RPK | 42 KB | 约 9 KB | 官方内联 sourcemap，且含 sitemap.json、CERT |
| release RPK | 18 KB | 约 4 KB | 官方 release 仍带 `_meta.ruleDef` 等元数据 |

我们的包更小，主要原因不是压缩更好，而是**少产出了内容**：不生成 sourcemap、不生成 `META-INF/CERT`、不生成 `sitemap.json`、不写 `_meta.ruleDef`。这些在 HANDOFF 的「不生成的内容」里已列出，其中 `_meta.ruleDef` 记为技术债。

体积不是可比的质量指标——同等内容下才能比。真正需要盯的是 release/debug 的比例：官方约 43%，我们约 31%（因为 debug 侧没有 sourcemap 拉高基数）。

### 10.5.6：验证 verifyMinified 能拦住属性名压缩

`verifyMinified` 的价值只有在配置真的出错时才体现。故意破坏一次，确认它拦得住。

```text
@update quickapp-toolkit/src/minify/minifier.ts — 临时改 mangle.properties（验证后必须改回）
```

```typescript
    mangle: {
      reserved: RESERVED_GLOBALS,
      toplevel: true,
      properties: true,   // 临时：验证 verifyMinified 能拦住
    },
```

```bash
cd quickapp-toolkit
npm run build
quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=release
echo "退出码：$?"
```

**预期输出：**

```text
错误：压缩产物缺少必需标识符：.template、.style、__esModule。检查 Terser 的 mangle.reserved 和 mangle.properties 配置。
  文件：pages/Demo/index.js

构建失败，未产出 RPK。
退出码：1
```

同时确认没有留下产物：

```bash
ls -l ../quickapp-examples/quickapp-code-test1/dist/*.release.*.rpk
```

**预期：** 文件不存在，或仍是上一次成功构建的版本（mtime 未更新）。压缩失败发生在 `packRPK` 之前，不会写出损坏的包；原子写入保证旧包不被破坏。

单测也应该失败：

```bash
npm test 2>&1 | grep -E '^# (pass|fail)'
```

**预期：** 有失败用例，且至少包含这几条：

```text
Runtime 按名读取的属性全部保留
生命周期与事件处理方法名保留
压缩前后 define 的组件名与 exports 键集合一致
压缩前后 template 树深度相等
verifyMinified 通过正常产物
```

具体失败数量不必对齐某个固定值——Terser 对带引号的属性键（样式选择器 `'.wrapper'`）的处理受 `keep_quoted` 影响，不同版本行为可能不同。关键是**这些用例必须失败**：如果开启属性名压缩后全部通过，说明测试没有真正覆盖属性名契约。

改回配置：

```text
@update quickapp-toolkit/src/minify/minifier.ts — 恢复 mangle.properties
```

```typescript
    mangle: {
      reserved: RESERVED_GLOBALS,
      toplevel: true,
      // 绝不开启：Runtime 按名读取大量属性
      properties: false,
    },
```

```bash
npm run build && npm test
```

**预期：** 271 个用例全部通过。

再做一次反向验证：把 `reserved` 清空，确认 `verifyMinified` 也能拦住。

| 破坏项 | 预期报错 | 若未报错说明 |
|---|---|---|
| `mangle.properties: true` | 缺少 `.template`、`.style`、`__esModule` | 校验列表漏项 |
| `mangle.reserved: []` | 缺少 `$app_define$`、`$app_bootstrap$` | Terser 恰好没改名（不可依赖） |
| `format.ascii_only: true` | 不报错 | 这项不影响正确性，只影响体积，由单测覆盖 |

`mangle.reserved: []` 那一行值得说明：Terser 对未声明的自由变量默认不改名，所以清空 reserved 后大概率仍然正常。这不代表 reserved 没用——它防的是 `toplevel: true` 与将来某个配置组合下的误判。**不能因为「测了一次没问题」就删掉保护。**

---

## 技术决策

### 1. 组装后压缩，而非组装内压缩

`assemblePageBundle` 保持同步，只负责产出正确的 JS；压缩在 `runBuild` 里作为独立步骤，对整个 bundle 集合统一处理。

**为什么：** 职责分离带来两个具体好处。一是调试路径短——出问题时可以先关掉压缩，确认组装产物是否正确，二分定位。二是 Terser 的异步性被限制在一处，只有 `runBuild` 和 CLI 入口需要 async，组装、编译、序列化全链保持同步。

如果放进组装内部，`assemblePageBundle` 要变 async，调用它的 `compilePage` 也要变，再往上是 `runBuild`——整条链都染上 async，单测里每个 `assert` 前面都要加 `await`，改动面大而收益为零。

**代价：** 压缩看不到模块边界，只能把整个 bundle 当一份代码处理。理论上按模块分别压缩再拼接可以并行，但一个 bundle 只有 3 个模块、几 KB 代码，Terser 的耗时在 10 毫秒级，没有优化必要。另一个代价是 `runBuild` 里多了一段 mode 判断的分支逻辑。

### 2. 绝不开启属性名压缩

`mangle.properties` 恒为 `false`。这是本步最重要的一条约束。

**为什么：** Runtime 侧按字符串名读取属性，跨语言边界，没有任何静态检查能发现不匹配。涉及的属性至少有三类：

```text
framework.js 读取：template、style、private、__esModule、default、
                   onInit、onReady、onShow、onDestroy、以及用户定义的
                   全部事件处理方法名
C++ 侧读取：      type、attr、classList、events、children
样式解析读取：    selector 字符串作为 key（.wrapper、.title）
```

属性名压缩是「白名单式安全」——只有列全所有被外部读取的名字才安全，而用户定义的方法名（`onTap`、`handleSubmit`）在编译期无法穷举。事件处理方法名同时出现在两处：`events: { click: 'onTap' }` 里是字符串，VM 上是属性名。压缩只改属性名不改字符串，两边立刻错位。

**代价：** 放弃了大约 10-15% 的额外体积压缩。一个 3 KB 的 bundle 里属性名占的比例不小（`classList`、`children` 这类长名重复出现），但它们在 DEFLATE 下压缩率很高，实际入包后的损失远小于 10%。这个代价是划算的。

### 3. reserve 三个注入的全局函数名

`mangle.reserved = ['$app_define$', '$app_bootstrap$', '$app_require$']`。

**为什么：** 这三个名字由 C++ 侧注入到 JS 全局对象，bundle 只引用不声明。Terser 对未声明的自由变量默认不改名，所以不加 reserved 通常也能跑——但「通常」不够。`mangle.toplevel: true` 开启后，Terser 需要判断哪些顶层名字是本地声明、哪些是外部引用；判断依据是 AST 里的声明节点。只要将来某个配置组合（比如引入 `nameCache` 做跨文件一致压缩）让它把这三个当成可压缩的名字，调用就会指向 undefined。

失败模式极差：**页面完全空白，debug 包正常，release 包报 `$app_define$ is not a function`。** 这类只在 release 出现的问题往往在测试阶段漏掉。

**代价：** 三个名字在产物中保持原样，每处 13-15 字节，一个 bundle 里出现 5-6 次，合计约 80 字节。相对 1 KB 级的压缩产物是 8%，但这部分在 DEFLATE 下几乎无损（重复字符串），实际入包代价接近零。

### 4. `unsafe_arrows: false`

**为什么：** 这一项会把不使用 `this` 的函数表达式转成箭头函数。Terser 的判断是「函数体内没有引用 `this`」——但模板函数属性的 `this` 由 framework.js 在调用时用 `.call(vm)` 注入，函数体内确实引用了 `this`，所以这一项对 `function () { return this.title }` 是安全的。

问题在无参数、不用 `this` 的那些函数上。例如空的生命周期钩子 `onDestroy: function () {}` 被转成 `onDestroy: () => {}`。单看这个函数没问题，但如果 framework.js 用 `fn.call(vm)` 统一调用所有钩子，箭头函数的 `this` 会忽略 `call` 的第一个参数——当前钩子体是空的所以看不出问题，用户以后在里面加一行 `this.timer && clearTimeout(this.timer)` 就断了。

更根本的理由是：**这个转换的安全性依赖 Terser 对 `this` 使用的静态分析正确，而我们的 `this` 是运行期注入的。** 静态分析看不到调用方，判断依据不完整。关掉它，代价可控。

**代价：** 箭头函数比 `function` 短 7 个字符（`function` 8 字符 vs `()=>` 视情况）。一个 bundle 里可能有 5-10 个可转换的函数，损失几十字节。

### 5. `drop_console: false`

**为什么：** Runtime 侧的 `console` 不是浏览器的 console，是 C++ 通过 QuickJS C API 注入的原生函数。开发者在 release 包上排查线上问题时依赖它——`adb logcat` 能看到输出。

日志的开关已经有正规位置：`manifest.config.logLevel`。用编译期删除代码来控制日志会让 `logLevel` 失去意义，且删除不可逆——用户拿到 release 包发现问题时，没法临时打开日志。

**代价：** `console.log` 调用及其参数留在产物里。如果开发者写了 `console.log('data', JSON.stringify(bigObject))`，字符串常量会占体积。这是开发者的选择，不是工具链该替他做的决定。

另一个代价是潜在的信息泄露——release 包里的日志可能打印敏感数据。这属于应用层责任，工具链在文档里提示即可。

### 6. `ascii_only: false`

**为什么：** 快应用的界面文案大量是中文。开启 `ascii_only` 会把每个中文字符转成 `\uXXXX`——一个 UTF-8 中文字符 3 字节，转义后 6 字节，加上反斜杠的转义开销，实测体积增大约 3 倍。

`ascii_only` 的用途是应对不支持 UTF-8 的传输通道或解析器。我们的链路全程 UTF-8：ZIP 条目按字节存储，`RPKLoader` 读出的是 `std::string`（字节序列），QuickJS 的 `JS_Eval` 接受 UTF-8 输入。没有需要转义的环节。

**代价：** 如果将来某个平台的 JS 引擎对源码编码有要求，需要单独处理。这个风险很低，且届时可以针对该平台开启。

### 7. `passes: 2`

**为什么：** Terser 的 compress 是多轮迭代——第一轮的内联和常量折叠会为第二轮创造新的优化机会。1 轮到 2 轮通常有 3-5% 的额外收益，2 轮到 3 轮不足 1%，同时耗时线性增加。

2 是常见的收益递减点。对几 KB 的 bundle，2 轮的绝对耗时在 10 毫秒级，不影响构建体验。

**代价：** 相比 1 轮多一倍的压缩耗时。项目页面多时（比如 30 个页面）总耗时增加几百毫秒。`minifyBundles` 用 `Promise.all` 并发处理，但 Terser 是 CPU 密集的同步计算，Promise 并发不带来真实并行——真要提速需要 worker_threads，V1 不做。

### 8. `verifyMinified` 防御性检查

压缩后再扫一遍产物，确认必需标识符存在。这不是功能，是护栏。

**为什么：** 它防的是「配置改动导致 release 独有的失败」。这类问题的排查成本极高：debug 全绿，release 白屏，现象（页面不渲染）与原因（某个 Terser 选项被改）之间没有明显关联，排查方向容易跑到 Runtime 侧。

护栏把发现时机从「设备上白屏」提前到「构建失败」，并且报错信息直接指出该检查哪个配置项。改一行配置就能触发的风险，值得用 30 行检查代码守住。

**代价：** 字符串包含检查是粗糙的——`code.includes('template')` 会被任何位置的 `template` 字样满足，包括某个字符串常量里的。它能发现「全都被压掉了」，不能发现「只有一处被压掉」。

更严格的做法是执行产物并检查 exports 结构，但那需要在构建过程中运行用户代码（有副作用风险，且 app.js 依赖注入函数）。粗糙检查加单测里的执行验证，组合起来覆盖度够了。

---

## QA

**Q：为什么 `keep_fnames: false` 是安全的？函数名压掉了不会影响什么吗？**

安全的依据是：产物里没有任何按函数名查找的逻辑。

模板函数属性是匿名函数表达式（`value: function () { return this.title }`），本来就没有名字。生命周期钩子和事件处理方法是**对象属性**，framework.js 通过属性名找到它们，属性名不受 `keep_fnames` 影响（那是 `mangle.properties` 管的）。`__webpack_require__` 这类内部函数只在 bundle 内部按变量引用调用。

会受影响的只有两处，都无关正确性：一是 `fn.name` 的值——没有代码读它；二是异常堆栈里的函数名会变成单字母。

第二点值得多说一句：`keep_fnames: true` 能保住堆栈可读性，代价是每个具名函数多占几个字节。我们选 `false`，因为 release 包的堆栈本来就不可读（变量名已经是单字母、行号已经全在第一行），保住函数名收益有限。真要排查 release 上的问题，正确做法是用 debug 包复现。

**Q：Terser 是异步 API，整条管线是同步的，具体怎么接的？**

只在两个地方引入 async：`runBuild` 改为 `async function`，CLI 入口用 `.then()` 处理返回的 Promise 并 `process.exit(code)`。

编译器（模板、样式、脚本）、序列化、组装、ZIP 打包全部保持同步。压缩是最后一个纯计算步骤，它的异步性不需要向上传播到编译逻辑。

考虑过但放弃的两种同步化方案：

```text
deasync          原生模块，需要编译，装不上就整个工具链不可用
worker + 阻塞    用 Atomics.wait 阻塞主线程等 worker 结果，
                 代码复杂度远超「让两个函数变 async」
```

Terser 之所以是异步 API，是因为它内部可能做异步的 sourcemap 读取。我们 `sourceMap: false`，实际执行是纯同步的——`await` 只是形式。但不能依赖这个实现细节写 `minify(...).code`，类型上它就是 Promise。

**Q：`minifyBundles` 用了 `Promise.all`，是真的并行吗？**

不是。Terser 的压缩是 CPU 密集的同步计算，`Promise.all` 只是让多个 Promise 并发调度，实际仍在单线程上依次跑完。

写成 `Promise.all` 的理由是代码简洁，以及将来换成 worker_threads 时调用方不用改。当前的实际效果等同于串行。

页面多到压缩耗时明显（几十个页面、几秒钟）时才需要真并行。届时用 `worker_threads` 起 CPU 核心数个 worker，每个处理一部分 bundle。V1 不做——收益要等到项目规模上来才体现，而 watch 模式（Step 12）的增量编译会让日常开发根本不走 release 压缩。

**Q：压缩后调试困难怎么办？**

三条路径，按成本排序：

一是**用 debug 包复现**。这是首选。debug 和 release 的语义等价（Property 5，10.5.4 已验证），绝大多数问题在 debug 包上一样能复现，且带完整变量名和行号。

二是**用 `run-bundle.js` 检视 release 产物**（10.5.3）。它能确认产物暴露的结构和行为是否正确，把「代码问题」和「压缩问题」分开。

三是**临时关闭压缩出一个 release 包**。改 `runBuild` 里的 mode 判断，或加一个未公开的环境变量开关。这条路径能定位「只有 release 才出现」的问题，但它本身就说明压缩配置有问题，应该往 `verifyMinified` 补检查项。

不提供 sourcemap 的理由在 HANDOFF 的「不生成的内容」里：RPK 格式不含 `.map` 条目，内联进 JS 会让体积翻倍——那就抵消了压缩的全部意义。

**Q：为什么不做混淆（obfuscation）？**

压缩和混淆是不同目标。压缩是为了体积，副作用是可读性下降；混淆是为了阻止阅读，通常反而增大体积（插入死代码、控制流平坦化、字符串数组化）。

三个具体理由：

一是**没有威胁模型**。RPK 是明文 ZIP，`unzip` 就能解开。混淆只能提高阅读成本，不能阻止阅读。真要保护逻辑应该放服务端。

二是**混淆会放大压缩的风险**。控制流平坦化和字符串加密都会改变代码形状，而我们有一整套「Runtime 按名读取属性」的约束。混淆工具的属性名处理比 Terser 更激进，破坏面更大。

三是**性能代价**。混淆后的代码在 QuickJS 上执行更慢（更多的间接跳转、字符串解码），而快应用的启动时间是核心指标。

**Q：`ecma: 2020` 会不会让产物用上 QuickJS 不支持的语法？**

`ecma` 选项控制的是 Terser **输出**时可以使用的语法级别，不是转译。它允许 Terser 用 ES2020 的写法做优化，比如把 `a && a.b` 压成 `a?.b`（可选链）。

QuickJS 支持 ES2020，包括可选链和空值合并。Step 7 已确认这一点并据此决定不做 ES5 降级。如果 Runtime 换成更老的引擎，这里要调低——但那时 Step 7 的编译配置也要一起改，两处必须一致。

**Q：`drop_debugger: true` 和 `drop_console: false` 为什么不一致？**

`debugger` 语句在 release 包上没有任何用途——设备上没有调试器附加，它是空操作或者在某些引擎上抛错。删掉是纯收益。

`console` 有实际用途（`adb logcat` 能看到）。两者的区别不是「都是调试代码」，而是「一个在 release 上有用，一个没用」。

**Q：`app.js` 也走压缩吗？它没有 template 和 style。**

走。`minifyBundles` 对 Map 里的每一项都压缩，`verifyMinified` 的第三个参数区分 app 和页面——`entryPath === 'app.js'` 时跳过 template/style 检查。

app.js 的 bundle 结构与页面一致（IIFE + `$app_define$('@app-application/app', ...)` + `$app_bootstrap$`），只是 exports 里没有 template/style，只有生命周期钩子和 `manifest` 相关数据。压缩逻辑不需要区分。

**Q：压缩失败时为什么不降级成「输出未压缩的 release 包」？**

因为压缩失败的原因几乎一定是「bundle 组装产出了非法 JS」。Terser 只在语法错误时报错——它不会因为代码「太复杂」失败。

如果降级输出未压缩产物，会掩盖一个真实缺陷：那份 JS 在 QuickJS 里也跑不起来。构建看似成功，问题推迟到设备上暴露。

`PackageError` 的消息里明确写了这一点：「这通常表示 bundle 组装产出了非法 JS，请检查编译器输出」。报错时附上 Terser 给的行号，配合 `--mode=debug` 出一份未压缩产物看那一行是什么，定位很快。

**Q：`build.txt` 的 hash 基于压缩后内容，debug 和 release 的 hash 不同，增量更新会有问题吗？**

不会，这正是需要的行为。增量更新比对的是「设备上装的包」和「服务器上的新包」，两者必须是同一模式的产物。

debug 包和 release 包是两个不同的应用产物（包名里就带 `.debug` / `.release` 标识），不会互相做增量。同模式下同源码的 hash 是稳定的——ZIP 时间戳固定、`build.txt` 时间固定、Terser 版本锁定，三个条件保证了这一点。

Terser 版本没锁定会破坏这个性质：升级 Terser 小版本可能改变输出字节，导致源码未变但 hash 变了，触发一次不必要的全量更新。这是 `--save-exact` 的实际理由。

---

## 下一步

Step 11：Runtime 契约验收（Task 4.1）。

到这一步，编译管线的全部环节都已实现并通过单测。但**所有「正确」都还只是单测意义上的**——单测里的 `$app_define$` 是我们自己写的 mock，`$app_require$` 的返回形状是我们假设的，framework.js 的执行时序是我们推测的。Step 11 用真实的 framework.js 和真实的 Android Runtime 把这些假设逐条验证。

Step 11 是硬性验收点，不是可选的补充验证。它要解决的三个已知风险记录在 HANDOFF 的「待验证风险点」：

```text
风险 1  _interopRequireDefault 多包一层
        —— 必须实测 native_app_require 的返回形状，
           确定用 Runtime 侧加 __esModule 还是 toolkit 侧 noInterop
风险 2  Runtime 只匹配单 class 选择器
        —— 后代选择器样式静默不生效，确认是 Runtime 限制而非 toolkit 缺陷
风险 3  $app_define$ 的 factory 执行时机
        —— 确认真实 framework.js 是 define 时立即执行还是 bootstrap 时才执行
```

Step 11 的内容包括：11 项验收清单、与官方产物的结构对照、风险 1 的实测与结论记录、debug 与 release 两种包在真机上的渲染对照。

风险 1 的结论会反向影响本步的单测：`systemModule` mock 目前返回 `{ __esModule: true, default: {...} }`，如果实测确定采用 toolkit 侧 `noInterop`，mock 和 Step 7 的 Babel 配置都要改。
