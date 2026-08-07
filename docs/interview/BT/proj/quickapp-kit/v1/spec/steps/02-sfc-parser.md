# Step 2：SFC Parser

## 目录

- [目标](#目标)
- [Step 2.1：为什么不用 XML 解析器](#step-21为什么不用-xml-解析器)
- [Step 2.2：实现区块扫描状态机](#step-22实现区块扫描状态机)
- [Step 2.3：接入 build 管线](#step-23接入-build-管线)
- [Step 2.4：单元测试](#step-24单元测试)
- [Step 2.5：逐层验证](#step-25逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 `.ux` 文件拆分为 template/style/script 三个带行号的区块。**

| 输入 | 输出 |
|---|---|
| `.ux` 文件完整文本 | `SFCDescriptor`（三个 `BlockDescriptor` 或 null） |

`BlockDescriptor` 携带 `startLine`，这是后续三个编译器能报出正确文件行号的唯一依据。

**验收标准：**
- 解析示例项目 `pages/Demo/index.ux`，三个区块内容与源码逐字符一致
- `startLine` 指向区块首行的真实文件行号
- 区块内出现 `</div>`、`<style>` 等字符串不被误判为标签
- 未闭合的顶级标签报错，附行号

**本步不包含：**
- XML / CSS / JS 的语义解析（Step 5/6/7）
- `lang="less"` 的实际预处理（V1 不支持 Less）
- `<import>` 标签处理（自定义组件，V1 不支持）

---

## Step 2.1：为什么不用 XML 解析器

`.ux` 文件形式上像 XML，但它不是合法 XML：

```html
<template>
  <div class="wrapper">
    <text>{{title}}</text>
  </div>
</template>

<style>
  .wrapper { flex-direction: column; }
</style>

<script>
  export default {
    private: { title: '演示' },
    render() {
      // 下面这行会让 XML 解析器崩溃
      return '<div>不是标签，是字符串</div>';
    }
  };
</script>
```

`<script>` 内的字符串、正则、注释里可以出现任意尖括号。用 XML 解析器整体解析会得到错误的树结构，甚至直接抛错。

同理，`<style>` 内的 CSS 也可能包含 `>` 子选择器。

**结论：** SFC 的顶层结构只有三个已知标签名，且互不嵌套。用逐行状态机匹配这三个标签的开闭，把区块内容当作不透明文本，是唯一可靠的做法。

三个编译器各自在自己的领域里用专门的解析器（htmlparser2 / postcss / Babel），那时输入已经是纯粹的 XML / CSS / JS。

**分层清晰：**

```text
SFCParser        只认三个顶级标签，区块内容不透明
    ↓
TemplateCompiler 输入是纯 XML  → htmlparser2
StyleCompiler    输入是纯 CSS  → postcss
ScriptCompiler   输入是纯 JS   → Babel
```

---

## Step 2.2：实现区块扫描状态机

```text
@add quickapp-toolkit/src/parser/sfc-parser.ts（新建文件）
```

```typescript
import type { SFCDescriptor, BlockDescriptor } from '../types';
import { SFCParseError } from '../diagnostics/errors';

/** 支持的顶级区块标签名 */
type BlockName = 'template' | 'style' | 'script';

const BLOCK_NAMES: readonly BlockName[] = ['template', 'style', 'script'] as const;

/**
 * 匹配区块开始标签，且必须位于行首（允许前导空白）。
 * 捕获组 1：标签名
 * 捕获组 2：属性串，如 ' lang="less"'；无属性时为 undefined
 *
 * 要求行首匹配是关键：区块内部的 "<style>" 字符串不在行首，
 * 或即使在行首也一定处于某个已打开的区块中，会被状态检查排除。
 */
const OPEN_TAG = /^\s*<(template|style|script)(\s[^>]*)?>\s*$/;

/** 匹配区块结束标签，同样要求独占一行 */
const CLOSE_TAG = /^\s*<\/(template|style|script)>\s*$/;

/** 从属性串中提取 lang 属性值 */
const LANG_ATTR = /\blang\s*=\s*["']([^"']*)["']/;

/**
 * 解析属性串中的 lang 值。
 * @param attrs 开始标签中的属性串，可能为 undefined
 * @returns lang 属性值；未声明时返回 null
 */
function parseLang(attrs: string | undefined): string | null {
  if (!attrs) return null;
  const m = LANG_ATTR.exec(attrs);
  return m ? m[1] : null;
}

/** 扫描过程中累积的单个区块状态 */
interface PendingBlock {
  name: BlockName;
  lang: string | null;
  /** 区块内容起始行号（1-based），即开始标签的下一行 */
  startLine: number;
  /** 已累积的内容行 */
  lines: string[];
  /** 开始标签所在行号，用于未闭合时报错定位 */
  openTagLine: number;
}

/**
 * 解析 .ux 单文件组件，拆分为 template / style / script 三个区块。
 *
 * 实现为逐行状态机：区块内容按原文累积，不做任何解析或转义。
 * 三个编译器各自处理自己的区块内容。
 *
 * @param source   .ux 文件的完整文本（UTF-8）
 * @param filename 源文件绝对路径，写入 descriptor.filename 并用于错误定位
 * @returns 三个区块的描述符；某区块不存在时该字段为 null
 * @throws SFCParseError 出现未闭合的顶级标签，或同一区块重复出现
 */
export function parseSFC(source: string, filename: string): SFCDescriptor {
  // 保留 \r\n 的行切分语义：split 后各行不含行尾符，
  // 后续用 '\n' 重新拼接，统一为 LF。区块内容的行内 \r 已被去除。
  const lines = source.split(/\r?\n/);

  const blocks = new Map<BlockName, BlockDescriptor>();
  let pending: PendingBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (pending === null) {
      const open = OPEN_TAG.exec(line);
      if (open) {
        const name = open[1] as BlockName;
        if (blocks.has(name)) {
          throw new SFCParseError(
            `重复的 <${name}> 区块，一个 .ux 文件中每种区块只能出现一次`,
            filename,
            lineNo
          );
        }
        pending = {
          name,
          lang: parseLang(open[2]),
          startLine: lineNo + 1,
          lines: [],
          openTagLine: lineNo,
        };
        continue;
      }
      // 区块之外的内容（空行、注释）忽略。
      // 不报错是为了容忍 .ux 文件顶部的版权注释等。
      continue;
    }

    // 已在某个区块内：只有匹配当前区块名的结束标签才算闭合
    const close = CLOSE_TAG.exec(line);
    if (close && close[1] === pending.name) {
      blocks.set(pending.name, {
        content: pending.lines.join('\n'),
        startLine: pending.startLine,
        lang: pending.lang,
      });
      pending = null;
      continue;
    }

    // 其他所有行原样累积，包括看起来像标签的内容
    pending.lines.push(line);
  }

  if (pending !== null) {
    throw new SFCParseError(
      `未闭合的 <${pending.name}> 区块，缺少 </${pending.name}>`,
      filename,
      pending.openTagLine
    );
  }

  return {
    filename,
    template: blocks.get('template') ?? null,
    style: blocks.get('style') ?? null,
    script: blocks.get('script') ?? null,
  };
}

/**
 * 校验 SFCDescriptor 是否满足页面组件的最低要求。
 *
 * 页面必须有 <template>（否则无内容可渲染）；
 * <script> 缺失时允许（纯展示页面），由 ScriptCompiler 生成空模块；
 * <style> 缺失时允许。
 *
 * @param descriptor 已解析的描述符
 * @throws SFCParseError 缺少 template 区块
 */
export function validatePageSFC(descriptor: SFCDescriptor): void {
  if (descriptor.template === null) {
    throw new SFCParseError(
      '缺少 <template> 区块，页面组件必须提供模板',
      descriptor.filename,
      0
    );
  }
  for (const name of BLOCK_NAMES) {
    const block = descriptor[name];
    if (block && block.lang !== null && block.lang !== 'css' && name === 'style') {
      throw new SFCParseError(
        `<style lang="${block.lang}"> 暂不支持，V1 仅支持纯 CSS`,
        descriptor.filename,
        block.startLine - 1
      );
    }
  }
}
```

两处实现细节值得说明。

**开始标签要求独占一行。** 正则用 `^\s*<template...>\s*$` 而非 `^\s*<template`。这排除了 `<template><div>x</div></template>` 这种单行写法，代价是格式约束更严，收益是标签识别绝对可靠——不需要处理「标签后面还有内容」的边界情况。快应用官方模板也都是多行格式，这个约束不影响实际使用。

**区块内容用 `'\n'` 重新拼接。** 输入可能是 CRLF，切分后各行不含行尾符，拼接时统一为 LF。这让产物在不同平台上字节一致，是 Property 6（增量编译结果一致）的前提之一。

---

## Step 2.3：接入 build 管线

把解析结果接进 `runBuild`，此时只打印区块信息，不做编译。

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 import 段
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BuildContext, BuildMode, SFCDescriptor } from '../types';
import { scanProject } from '../scanner/project-scanner';
import { parseSFC, validatePageSFC } from '../parser/sfc-parser';
import { CompileError } from '../diagnostics/errors';
import { fromError, reportDiagnostics } from '../diagnostics/diagnostic';
```

```text
@add quickapp-toolkit/src/cli/cmd-build.ts — 在 runBuild 函数之前插入
```

```typescript
/**
 * 读取并解析单个 .ux 文件。
 *
 * 解析失败时把错误记入 diagnostics 并返回 null，不抛出。
 * 这样单个页面出错不影响其他页面继续编译，一次 build 能报出全部问题。
 *
 * @param sourcePath .ux 文件绝对路径
 * @param ctx        构建上下文，失败时向其 diagnostics 追加
 * @returns 解析成功的描述符；失败时为 null
 */
function parsePageFile(sourcePath: string, ctx: BuildContext): SFCDescriptor | null {
  let source: string;
  try {
    source = fs.readFileSync(sourcePath, 'utf8');
  } catch (e) {
    ctx.diagnostics.push({
      severity: 'error',
      file: sourcePath,
      line: 0,
      column: 0,
      message: `无法读取文件：${(e as Error).message}`,
    });
    return null;
  }

  try {
    const descriptor = parseSFC(source, sourcePath);
    validatePageSFC(descriptor);
    return descriptor;
  } catch (e) {
    if (e instanceof CompileError) {
      ctx.diagnostics.push(fromError(e));
      return null;
    }
    throw e;
  }
}

/**
 * 打印区块摘要，用于 Step 2 阶段的人工验证。
 * @param label      展示用的文件标识
 * @param descriptor 已解析的描述符
 */
function printBlockSummary(label: string, descriptor: SFCDescriptor): void {
  const parts: string[] = [];
  for (const name of ['template', 'style', 'script'] as const) {
    const block = descriptor[name];
    if (block === null) {
      parts.push(`${name}=-`);
    } else {
      const lineCount = block.content === '' ? 0 : block.content.split('\n').length;
      const lang = block.lang ? `,lang=${block.lang}` : '';
      parts.push(`${name}@${block.startLine}(${lineCount}行${lang})`);
    }
  }
  console.log(`  ${label}  ${parts.join('  ')}`);
}
```

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换「待编译页面」输出段到函数结尾
```

```typescript
  console.log(`待编译页面（${tree.pages.length}）：`);
  for (const page of tree.pages) {
    console.log(`  ${page.routePath}  ->  ${page.outputPath}`);
  }
  console.log('');

  // ---- Step 2：SFC 解析 ----
  console.log('SFC 解析：');

  const parsed = new Map<string, SFCDescriptor>();

  if (tree.appPath !== null) {
    const appDescriptor = parsePageFile(tree.appPath, ctx);
    if (appDescriptor !== null) {
      parsed.set('app.ux', appDescriptor);
      printBlockSummary('app.ux', appDescriptor);
    }
  }

  for (const page of tree.pages) {
    const descriptor = parsePageFile(page.sourcePath, ctx);
    if (descriptor !== null) {
      parsed.set(page.routePath, descriptor);
      printBlockSummary(page.routePath, descriptor);
    }
  }
  console.log('');

  console.log(`静态资源（${tree.assets.length}）：`);
  for (const asset of tree.assets) {
    console.log(`  ${asset.outputPath}`);
  }
  console.log('');

  // Step 4 起在此接入三路编译
  console.log(`解析完成：${parsed.size} 个文件。编译器尚未接入（Step 4 起实现）。`);

  const hasError = reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
  return hasError ? 1 : 0;
```

注意 `app.ux` 也走 `validatePageSFC`。应用级文件通常没有 `<template>`，这里会报错——这是刻意的：Step 8 组装 app.js 时会用独立的校验路径。当前阶段先暴露这个不匹配，避免后面忘记处理。

如果示例项目的 `app.ux` 确实没有 template，验证时会看到一条 error。这是预期行为，Step 8 会修正。

---

## Step 2.4：单元测试

```text
@add quickapp-toolkit/test/unit/sfc-parser.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseSFC, validatePageSFC } = require('../../dist/parser/sfc-parser.js');
const { SFCParseError } = require('../../dist/diagnostics/errors.js');

const FILE = '/proj/src/pages/Demo/index.ux';

test('解析完整三段式', () => {
  const source = [
    '<template>',        // 1
    '  <div></div>',     // 2
    '</template>',       // 3
    '',                  // 4
    '<style>',           // 5
    '  .a { color: red }',// 6
    '</style>',          // 7
    '',                  // 8
    '<script>',          // 9
    '  export default {}',// 10
    '</script>',         // 11
  ].join('\n');

  const d = parseSFC(source, FILE);

  assert.strictEqual(d.filename, FILE);
  assert.strictEqual(d.template.content, '  <div></div>');
  assert.strictEqual(d.template.startLine, 2);
  assert.strictEqual(d.style.content, '  .a { color: red }');
  assert.strictEqual(d.style.startLine, 6);
  assert.strictEqual(d.script.content, '  export default {}');
  assert.strictEqual(d.script.startLine, 10);
});

test('缺失 style 区块时该字段为 null', () => {
  const source = '<template>\n  <div></div>\n</template>\n<script>\nx\n</script>';
  const d = parseSFC(source, FILE);
  assert.strictEqual(d.style, null);
  assert.notStrictEqual(d.template, null);
  assert.notStrictEqual(d.script, null);
});

test('缺失 script 区块时该字段为 null', () => {
  const source = '<template>\n  <div></div>\n</template>';
  const d = parseSFC(source, FILE);
  assert.strictEqual(d.script, null);
});

test('提取 lang 属性', () => {
  const source = '<template>\nx\n</template>\n<style lang="less">\ny\n</style>';
  const d = parseSFC(source, FILE);
  assert.strictEqual(d.style.lang, 'less');
  assert.strictEqual(d.template.lang, null);
});

test('script 内的闭合标签字符串不被误判', () => {
  const source = [
    '<template>',
    '  <div></div>',
    '</template>',
    '<script>',
    "  var a = '</div>';",
    "  var b = '<style>';",
    '  // </script> 出现在注释里也不能提前结束',
    '  var c = 1;',
    '</script>',
  ].join('\n');

  const d = parseSFC(source, FILE);
  const scriptLines = d.script.content.split('\n');
  assert.strictEqual(scriptLines.length, 4);
  assert.ok(d.script.content.includes("'</div>'"));
  assert.ok(d.script.content.includes('var c = 1;'));
});

test('区块内独占一行的其他区块标签不触发状态切换', () => {
  // <style> 独占一行出现在 script 区块内：
  // 因为 pending 非 null，OPEN_TAG 分支不会被执行
  const source = [
    '<script>',
    '<style>',
    '</script>',
  ].join('\n');

  const d = parseSFC(source, FILE);
  assert.strictEqual(d.script.content, '<style>');
  assert.strictEqual(d.style, null);
});

test('未闭合区块抛出 SFCParseError 并附开始标签行号', () => {
  const source = ['<template>', '  <div></div>'].join('\n');
  assert.throws(
    () => parseSFC(source, FILE),
    (err) => {
      assert.ok(err instanceof SFCParseError);
      assert.strictEqual(err.line, 1);
      assert.match(err.message, /未闭合的 <template>/);
      return true;
    }
  );
});

test('重复区块抛出 SFCParseError', () => {
  const source = [
    '<template>',
    'a',
    '</template>',
    '<template>',
    'b',
    '</template>',
  ].join('\n');
  assert.throws(() => parseSFC(source, FILE), SFCParseError);
});

test('CRLF 输入的区块内容统一为 LF', () => {
  const source = '<template>\r\n  <div></div>\r\n</template>';
  const d = parseSFC(source, FILE);
  assert.strictEqual(d.template.content, '  <div></div>');
  assert.ok(!d.template.content.includes('\r'));
});

test('区块之外的注释不报错', () => {
  const source = [
    '<!-- 版权声明 -->',
    '<template>',
    '  <div></div>',
    '</template>',
  ].join('\n');
  const d = parseSFC(source, FILE);
  assert.strictEqual(d.template.startLine, 3);
});

test('validatePageSFC 缺 template 时报错', () => {
  const d = parseSFC('<script>\nx\n</script>', FILE);
  assert.throws(() => validatePageSFC(d), SFCParseError);
});

test('validatePageSFC 拒绝 lang=less', () => {
  const source = '<template>\nx\n</template>\n<style lang="less">\ny\n</style>';
  const d = parseSFC(source, FILE);
  assert.throws(
    () => validatePageSFC(d),
    (err) => {
      assert.match(err.message, /lang="less"/);
      return true;
    }
  );
});
```

用 Node 内置 `node:test` 而非 Jest/Vitest：不引入额外依赖，Node 18+ 原生支持，启动更快。

---

## Step 2.5：逐层验证

### 2.5.1：编译验证

```bash
cd quickapp-toolkit
npm run build
```

**预期：** 无错误，生成 `dist/parser/sfc-parser.js` 和 `.d.ts`。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `TS2532: Object is possibly 'undefined'` | `blocks.get(name)` 在 strict 下返回 `T \| undefined` | 用 `?? null` 兜底（代码中已处理） |
| `TS2367: comparison appears unintentional` | `BlockName` 联合类型与字面量比较 | 确认 `close[1]` 已断言为 `BlockName` |

### 2.5.2：单元测试验证

```bash
npm test
```

**预期输出：**

```text
✔ 解析完整三段式
✔ 缺失 style 区块时该字段为 null
✔ 缺失 script 区块时该字段为 null
✔ 提取 lang 属性
✔ script 内的闭合标签字符串不被误判
✔ 区块内独占一行的其他区块标签不触发状态切换
✔ 未闭合区块抛出 SFCParseError 并附开始标签行号
✔ 重复区块抛出 SFCParseError
✔ CRLF 输入的区块内容统一为 LF
✔ 区块之外的注释不报错
✔ validatePageSFC 缺 template 时报错
✔ validatePageSFC 拒绝 lang=less
# pass 12
```

最关键的两个用例是「script 内的闭合标签字符串不被误判」和「区块内独占一行的其他区块标签不触发状态切换」。它们验证的是状态机的核心正确性：**已进入区块后，除了匹配的结束标签，其他一切都是内容。**

### 2.5.3：示例项目解析验证

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1
```

**预期输出（页面部分）：**

```text
SFC 解析：
  pages/Demo  template@2(12行)  style@17(24行)  script@43(18行)
  pages/DemoDetail  template@2(8行)  style@12(16行)  script@30(12行)
```

具体行数取决于示例项目内容，验证点在于：

- 每个页面都识别出三个区块
- `startLine` 递增且与源文件中标签位置对应
- 行数之和加上标签行数接近文件总行数

**手工核对 startLine：** 打开 `src/pages/Demo/index.ux`，确认 `<template>` 在第 1 行，则输出应为 `template@2`（内容从第 2 行开始）。

### 2.5.4：行号换算验证

这是本 Step 最重要的验证——`startLine` 的正确性直接决定后续三个编译器能否报出正确的文件行号。

构造测试文件：

```bash
mkdir -p /tmp/sfc-test/src/pages/T
cat > /tmp/sfc-test/src/manifest.json <<'EOF'
{
  "package": "com.test.sfc",
  "name": "sfc-test",
  "versionName": "1.0.0",
  "versionCode": 1,
  "router": {
    "entry": "pages/T",
    "pages": { "pages/T": { "component": "index" } }
  }
}
EOF
```

```bash
cat > /tmp/sfc-test/src/pages/T/index.ux <<'EOF'
<template>
  <div>
    <text>{{title}}</text>
  </div>
</template>

<style>
  .a { color: red }
</style>

<script>
  export default {
    private: { title: 'x' }
  };
</script>
EOF
```

```bash
quickapp build --root=/tmp/sfc-test
```

**预期输出：**

```text
  pages/T  template@2(4行)  style@8(1行)  script@12(4行)
```

**逐项核对：**

| 区块 | 开始标签行 | 期望 startLine | 内容行数 |
|---|---|---|---|
| template | 1 | 2 | 4（第 2-5 行） |
| style | 7 | 8 | 1（第 8 行） |
| script | 11 | 12 | 4（第 12-15 行） |

如果 `script@12` 显示为 `script@1` 或其他值，说明 `startLine` 计算有误。后果是：Step 7 里 `<script>` 第 3 行的语法错误会被报成文件第 3 行（实际是第 14 行），开发者按错误行号去找会看到 `<template>` 的内容。

### 2.5.5：未闭合标签验证

```bash
cat > /tmp/sfc-test/src/pages/T/index.ux <<'EOF'
<template>
  <div>
    <text>x</text>
  </div>
EOF
```

```bash
quickapp build --root=/tmp/sfc-test
```

**预期输出：**

```text
ERROR  src/pages/T/index.ux:1
  未闭合的 <template> 区块，缺少 </template>

  1 | <template>
  2 |   <div>
  3 |     <text>x</text>

编译失败：1 个错误，0 个警告
```

退出码 1。

验证点：错误行号指向 `<template>` 开始标签（第 1 行），而不是文件末尾。指向开始标签更有用——开发者需要知道是哪个区块没关。

### 2.5.6：多页面错误累积验证

把两个页面都改成有错，确认一次 build 报出全部错误：

```bash
# pages/Demo 未闭合 template，pages/DemoDetail 缺 template
quickapp build --root=<示例项目>
```

**预期：** 两条 ERROR 都输出，末尾 `编译失败：2 个错误`。

如果只报第一个就退出，说明 `parsePageFile` 的错误处理没有正确 catch，或 `runBuild` 提前 return 了。

---

## 技术决策

### 1. 逐行状态机，不用 XML 解析器

`.ux` 不是合法 XML。`<script>` 内的字符串、注释、正则都可以包含尖括号，`<style>` 内的 CSS 也有 `>` 子选择器。任何通用 XML 解析器处理整个文件都会得到错误结构或直接抛错。

顶层只有三个已知标签且互不嵌套，状态机约 60 行即可完全可靠。三个编译器各自在纯净输入上用专门解析器，分层清晰。

### 2. 开始/结束标签要求独占一行

正则用 `^\s*<template...>\s*$` 而非 `^\s*<template`。这排除了 `<template><div>x</div></template>` 单行写法。

代价是格式约束更严；收益是标签识别绝对可靠，不需要处理「标签同行还有内容」的切分逻辑。快应用官方模板都是多行格式，实际不受影响。

### 3. 已进入区块后不再匹配开始标签

`if (pending === null)` 是状态机的核心保护。进入区块后只检查匹配的结束标签，其他一切都是内容。

这让「`<script>` 区块内独占一行的 `<style>`」被正确当作 JS 内容，而不是误判为样式区块开始。测试用例专门覆盖了这一点。

### 4. 区块内容统一为 LF

输入可能是 CRLF（Windows 编辑器），切分后各行不含行尾符，用 `'\n'` 重新拼接统一为 LF。

这保证同一份源码在 Windows 和 macOS 上编译出的产物字节一致。否则 Property 6（增量编译结果一致）在跨平台协作时会失效，且这类差异在 diff 里表现为「整个文件都变了」，掩盖真实变更。

### 5. 未闭合标签的错误行号指向开始标签

不指向文件末尾。开发者需要知道「哪个区块没关」，开始标签的位置直接回答这个问题；文件末尾的行号没有信息量。

### 6. 区块之外的内容静默忽略

`.ux` 文件顶部可能有版权注释、编辑器指令。对这些内容报错会造成无谓的摩擦，而它们对编译没有任何影响。

代价是拼写错误的标签（如 `<templat>`）不会被识别为区块，最终表现为「缺少 template 区块」。这个错误信息虽然不够精确，但仍然指向了正确的问题方向。

### 7. 解析失败不中断其他页面

`parsePageFile` 把错误记入 diagnostics 并返回 null。单页面出错不影响其他页面继续解析，一次 build 报出全部问题。

例外是项目结构错误（Step 1 的 `scanProject`），那类错误让后续流程无法进行，必须立即中止。

### 8. lang 属性只解析不处理

`BlockDescriptor.lang` 记录声明值，`validatePageSFC` 对 `lang="less"` 直接报错。V1 不支持预处理器。

先记录再拒绝，而不是解析时忽略：这样将来接入 Less 时，`lang` 字段已经就位，只需在 `StyleCompiler` 里加分支，不用改解析器。

---

## QA

**Q：为什么 `validatePageSFC` 和 `parseSFC` 分成两个函数？**

`parseSFC` 只回答「文件的三个区块分别是什么」，这是纯粹的文本拆分，对 `app.ux` 和页面 `.ux` 一视同仁。

`validatePageSFC` 回答「这个描述符能否作为页面组件使用」，这是业务约束——页面必须有 template，`app.ux` 不需要。把约束分离出来，Step 8 组装 app.js 时可以用不同的校验函数，不用给 `parseSFC` 加参数或标志位。

**Q：`app.ux` 走 `validatePageSFC` 会报错，为什么不现在就修？**

Step 2 的验收目标是 SFC 解析本身。`app.ux` 的组装逻辑属于 Step 8（Bundle Assembler），那时会引入 `validateAppSFC`。

现在让它报错是刻意的：如果 Step 2 就静默跳过 `app.ux`，Step 8 可能忘记处理这个差异。一条可见的 error 是最好的待办提醒。

**Q：区块内容为空（如 `<style>` 紧跟 `</style>`）时会怎样？**

`content` 为空字符串 `''`，`lines` 数组为空，`join('\n')` 结果是 `''`。`printBlockSummary` 里对空内容特判为 0 行，避免 `''.split('\n')` 返回 `['']` 导致显示 1 行。

后续编译器收到空内容应产出空结果（空样式对象、空模块），不应报错。

**Q：`OPEN_TAG` 的属性捕获组为什么要求前导空白（`\s[^>]*`）？**

区分 `<template>` 和 `<templatex>`。如果写成 `([^>]*)`，`<templatex>` 会匹配成标签名 `template` 加属性 `x`。要求属性前必须有空白，`<templatex>` 就无法匹配整个正则。

**Q：如果一个文件同时有 `<template>` 和 `<import>`（自定义组件）会怎样？**

`<import>` 不在 `BLOCK_NAMES` 里，出现在区块之外时被静默忽略，出现在区块内时作为内容累积。

V1 不支持自定义组件。将来支持时，`<import>` 需要作为第四种顶级标签处理，且它可以多次出现——这与当前「每种区块只能出现一次」的约束冲突，需要单独的收集逻辑。

**Q：为什么用 `node:test` 而不是 Jest？**

Node 18+ 内置 `node:test` 和 `node:assert`，零依赖、启动快。这个项目的测试都是纯函数输入输出断言，不需要 mock、快照、覆盖率报告等高级功能。

Jest 会带来约 30MB 依赖和数秒的启动开销，对当前规模是净负担。

**Q：测试为什么 require `dist/` 而不是 `src/`？**

测试运行在 Node 上，需要编译后的 JS。这也顺带验证了 TypeScript 编译产物可用——如果 `tsconfig` 配置错误导致产物结构不对，测试会直接失败。

代价是每次改代码要先 `npm run build`。开发时用 `npm run dev`（tsc --watch）解决。

---

## 下一步

Step 3 实现 Manifest Processor：完整校验 manifest.json 的必填字段和页面存在性，按 mode 注入 `config.debug`。
