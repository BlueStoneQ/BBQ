# Step 14：诊断输出与错误定位

## 目录

- [目标](#目标)
- [Step 14.1：行号换算的全链路梳理](#step-141行号换算的全链路梳理)
- [Step 14.2：补齐列号信息](#step-142补齐列号信息)
- [Step 14.3：改进诊断输出格式](#step-143改进诊断输出格式)
- [Step 14.4：错误汇总与退出码](#step-144错误汇总与退出码)
- [Step 14.5：端到端行号验证工具](#step-145端到端行号验证工具)
- [Step 14.6：单元测试](#step-146单元测试)
- [Step 14.7：逐层验证](#step-147逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**保证错误信息能定位到 `.ux` 源码的正确行号，格式统一。**

前十三步各自实现了错误处理，但三件事没有端到端验证过：

| 问题 | 现状 | 风险 |
|---|---|---|
| 行号换算 | 三个编译器各自换算，各有单测 | 没有在真实 `.ux` 文件上验证过 |
| 输出格式 | Step 1 实现了 `formatDiagnostic` | 不确定所有阶段都走它 |
| 错误汇总 | 部分阶段累积、部分立即中止 | 边界不清晰 |

**验收标准：**
- 模板、样式、脚本三类错误都报出正确的文件绝对行号
- 列号可用时一并输出，指示箭头位置准确
- 多页面同时出错时全部错误一次输出
- 退出码：有 error → 1，仅 warning → 0

**本步不包含：**
- 错误码体系（`QA1001` 之类）—— 见技术决策
- 多语言错误信息
- 修复建议（`did you mean`）
- IDE 集成格式（LSP diagnostic）

---

## Step 14.1：行号换算的全链路梳理

### 换算发生在哪里

`.ux` 文件被拆成三个区块，每个区块交给独立的解析器。解析器报的行号是**区块内相对行号**，必须加上区块起始位置才是文件绝对行号。

```text
index.ux
  1  <template>              <- template 开始标签
  2    <div>                 <- 区块内容第 1 行，startLine = 2
  3      <span></span>       <- 区块内容第 2 行  ← htmlparser2 报「第 2 行」
  4    </div>
  5  </template>
  6
  7  <style>                 <- style 开始标签
  8    .a { color: red       <- 区块内容第 1 行，startLine = 8
  9  </style>                     ← postcss 报「第 1 行」
 10
 11  <script>                <- script 开始标签
 12    export default {      <- 区块内容第 1 行，startLine = 12
 13      x: ,                <- 区块内容第 2 行  ← Babel 报「第 2 行」
 14    };
 15  </script>
```

三处换算的目标：

```text
htmlparser2 第 2 行 -> 文件第 3 行   （startLine 2 + 相对 2 - 1）
postcss     第 1 行 -> 文件第 8 行   （startLine 8 + 相对 1 - 1）
Babel       第 2 行 -> 文件第 13 行  （startLine 12 + 相对 2 - 1）
```

统一公式：**文件绝对行号 = startLine + 相对行号 - 1**。

`- 1` 的来源：`startLine` 已经是区块内容第 1 行的绝对行号，而相对行号也从 1 开始，两者都算了第 1 行，要减去重复的那次。

### 各阶段的实现现状

| 阶段 | Step | 实现方式 | 行号基准 |
|---|---|---|---|
| SFC 解析 | 2 | 直接用文件行号，无需换算 | 1-based 绝对 |
| 模板编译 | 5 | `offsetToLine`：数换行符 + `startLine` | 自己算，0-based 累加后加 startLine |
| 样式编译 | 6 | `nodeLine`：`startLine + line - 1` | postcss 的 line 是 1-based |
| 脚本编译 | 7 | `toScriptError`：`startLine + relLine - 1` | Babel 的 loc.line 是 1-based |
| Manifest | 3 | `locateJsonError`：JSON.parse 错误提取 | 直接是 manifest.json 的行号 |

Step 5 的实现与另两个不同：

```typescript
const offsetToLine = (offset: number): number => {
  let line = 0;                          // 从 0 开始
  for (let i = 0; i < offset && i < template.length; i++) {
    if (template[i] === '\n') line++;
  }
  return startLine + line;               // 不减 1
};
```

它数的是「offset 之前有多少个换行符」，结果是 0-based 的相对行号，所以直接加 `startLine` 而不减 1。**两种写法都对，但不一致容易在维护时出错。**

统一的做法是让所有换算都走同一个函数。

### 抽取统一的换算函数

```text
@add quickapp-toolkit/src/diagnostics/location.ts（新建文件）
```

```typescript
/**
 * 把区块内相对行号换算为文件绝对行号。
 *
 * 公式：绝对行号 = startLine + 相对行号 - 1
 *
 * 减 1 的原因：startLine 已经是区块内容第一行的绝对行号，而相对
 * 行号也从 1 开始 —— 两者都计入了第一行，要减去重复的那次。
 *
 * @param relativeLine 区块内相对行号（1-based）；传 0 或负数时返回 startLine
 * @param startLine    区块内容第一行在文件中的行号（1-based）
 * @returns 文件绝对行号（1-based）
 */
export function toAbsoluteLine(relativeLine: number, startLine: number): number {
  if (relativeLine <= 0) return startLine;
  return startLine + relativeLine - 1;
}

/**
 * 把区块内字符偏移换算为文件绝对行号。
 *
 * 用于只能拿到字符偏移的解析器（htmlparser2 的流式回调）。
 *
 * @param offset    区块内字符偏移（0-based）
 * @param content   区块内容全文，用于数换行符
 * @param startLine 区块内容第一行在文件中的行号（1-based）
 * @returns 文件绝对行号（1-based）
 */
export function offsetToAbsoluteLine(
  offset: number,
  content: string,
  startLine: number
): number {
  let newlines = 0;
  const limit = Math.min(offset, content.length);
  for (let i = 0; i < limit; i++) {
    if (content[i] === '\n') newlines++;
  }
  // newlines 是 0-based 的相对行号，转 1-based 后走统一公式
  return toAbsoluteLine(newlines + 1, startLine);
}

/**
 * 把区块内字符偏移换算为行内列号。
 *
 * @param offset  区块内字符偏移（0-based）
 * @param content 区块内容全文
 * @returns 列号（1-based）
 */
export function offsetToColumn(offset: number, content: string): number {
  const limit = Math.min(offset, content.length);
  let lastNewline = -1;
  for (let i = 0; i < limit; i++) {
    if (content[i] === '\n') lastNewline = i;
  }
  return limit - lastNewline;
}
```

`offsetToAbsoluteLine` 内部转成 1-based 后调用 `toAbsoluteLine`，这样只有一处定义了换算公式。Step 5 的 `offsetToLine` 应该替换为这个函数。

```text
@update quickapp-toolkit/src/compiler/template-compiler.ts — 替换 parseTemplate 内的 offsetToLine
```

```typescript
  /**
   * 把区块内字符偏移换算为文件绝对行号。
   *
   * 委托给统一的换算函数，避免各编译器各自实现导致偏差。
   *
   * @param offset 区块内字符偏移
   * @returns 文件绝对行号
   */
  const offsetToLine = (offset: number): number =>
    offsetToAbsoluteLine(offset, template, startLine);
```

```text
@add quickapp-toolkit/src/compiler/template-compiler.ts — 在 import 段末尾追加
```

```typescript
import { offsetToAbsoluteLine, offsetToColumn } from '../diagnostics/location';
```

---

## Step 14.2：补齐列号信息

三个编译器里只有样式和脚本报了列号，模板编译没有。列号影响诊断输出的指示箭头位置。

### 模板编译补列号

```text
@update quickapp-toolkit/src/compiler/template-compiler.ts — 替换 onopentag 里的错误抛出
```

```typescript
      onopentag(name, attribs) {
        if (!KNOWN_TAGS.has(name)) {
          throw new TemplateCompileError(
            `未知组件 <${name}>，V1 支持的组件：${[...KNOWN_TAGS].join('、')}`,
            filename,
            offsetToLine(currentOffset),
            offsetToColumn(currentOffset, template)
          );
        }
```

同样处理未闭合标签和多根元素的错误。未闭合标签的位置是开始标签处，需要在 `BuildingNode` 里同时记录列号：

```text
@update quickapp-toolkit/src/compiler/template-compiler.ts — 替换 BuildingNode 接口
```

```typescript
/** 构建过程中的节点，children 始终存在便于累积 */
interface BuildingNode {
  type: string;
  attr: Record<string, string | RawCode>;
  classList: string[];
  events: Record<string, string>;
  children: BuildingNode[];
  /** 累积的文本子内容，闭合时提升为 attr.value */
  text: string;
  /** 开始标签所在的文件绝对行号，用于未闭合时定位 */
  line: number;
  /** 开始标签所在的列号，用于未闭合时定位 */
  column: number;
}
```

```text
@update quickapp-toolkit/src/compiler/template-compiler.ts — 替换 onopentag 里的节点构造
```

```typescript
        const node: BuildingNode = {
          type: name,
          attr: {},
          classList: [],
          events: {},
          children: [],
          text: '',
          line: offsetToLine(currentOffset),
          column: offsetToColumn(currentOffset, template),
        };
```

```text
@update quickapp-toolkit/src/compiler/template-compiler.ts — 替换未闭合标签的错误抛出
```

```typescript
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new TemplateCompileError(
      `未闭合的标签 <${unclosed.type}>`,
      filename,
      unclosed.line,
      unclosed.column
    );
  }
```

### 列号的 0/1 基准差异

三个来源的列号基准不同，容易搞错：

| 来源 | 基准 | 处理 |
|---|---|---|
| postcss 的 `column` | 1-based | 直接用（Step 6 已正确） |
| Babel 的 `loc.column` | 0-based | 加 1（Step 7 已正确） |
| 我们的 `offsetToColumn` | 1-based | 直接用 |

Step 7 的实现里已经处理了：

```typescript
const column = err.loc === undefined ? 0 : err.loc.column + 1;
```

这类基准差异是诊断输出偏移一格的常见原因。约定统一为 **`Diagnostic.column` 是 1-based，0 表示未知**，各适配层负责转换。

---

## Step 14.3：改进诊断输出格式

Step 1 的 `formatDiagnostic` 已实现基本格式。三处需要改进。

### 改进 1：错误与警告分组输出

当前实现按累积顺序输出，error 和 warning 混在一起。页面多时 warning 会把 error 埋掉。

```text
@update quickapp-toolkit/src/diagnostics/diagnostic.ts — 替换 reportDiagnostics
```

```typescript
/**
 * 输出全部诊断并返回是否存在 error。
 *
 * 分组输出：先全部 error，再全部 warning。理由是 error 阻止构建，
 * 必须优先看到；warning 混在中间会被 error 的代码片段淹没。
 *
 * 组内保持累积顺序 —— 那反映了编译顺序（按 manifest 页面声明顺序），
 * 与源码结构对应，便于逐个修复。
 *
 * @param diagnostics 累积的诊断列表
 * @param projectRoot 项目根目录，用于把绝对路径显示为相对路径
 * @returns true 表示存在 error 级别诊断，调用方应以非零码退出
 */
export function reportDiagnostics(
  diagnostics: Diagnostic[],
  projectRoot: string
): boolean {
  if (diagnostics.length === 0) return false;

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  for (const diag of [...errors, ...warnings]) {
    console.error(formatDiagnostic(diag, projectRoot));
    console.error('');
  }

  if (errors.length > 0) {
    console.error(
      `${RED}编译失败${RESET}：${errors.length} 个错误，${warnings.length} 个警告`
    );
    return true;
  }
  console.error(`${YELLOW}编译完成${RESET}：${warnings.length} 个警告`);
  return false;
}
```

### 改进 2：同一文件的诊断合并显示文件名

当前每条诊断都打完整文件路径。同一文件有多条时重复。

```text
@add quickapp-toolkit/src/diagnostics/diagnostic.ts — 在 reportDiagnostics 之后插入
```

```typescript
/**
 * 按文件分组输出诊断。
 *
 * 同一文件的多条诊断只打一次文件名，后续条目只显示行列号。
 * 适用于单文件有多个问题的场景（如一个页面里有三处样式警告）。
 *
 * 当前 reportDiagnostics 未使用这个函数 —— 它是为「诊断数量多时
 * 的紧凑输出」预留的。判断阈值和启用条件见 QA。
 *
 * @param diagnostics 诊断列表
 * @param projectRoot 项目根目录
 * @returns 格式化后的多行字符串
 */
export function formatGrouped(
  diagnostics: Diagnostic[],
  projectRoot: string
): string {
  const byFile = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = byFile.get(d.file);
    if (list === undefined) {
      byFile.set(d.file, [d]);
    } else {
      list.push(d);
    }
  }

  const blocks: string[] = [];
  for (const [file, list] of byFile) {
    const rel = path.relative(projectRoot, file) || file;
    const lines = [`${rel}`];
    for (const d of list) {
      const color = d.severity === 'error' ? RED : YELLOW;
      const loc =
        d.line > 0
          ? `${d.line}:${d.column > 0 ? d.column : 1}`
          : '-';
      lines.push(`  ${color}${d.severity}${RESET}  ${loc}  ${d.message}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}
```

### 改进 3：代码片段的行号对齐与 Tab 处理

当前 `readSnippet` 直接输出原始行内容。Tab 缩进会导致指示箭头位置错位——终端里 Tab 显示为多个空格，而 `' '.repeat(column - 1)` 按字符数算。

```text
@update quickapp-toolkit/src/diagnostics/diagnostic.ts — 替换 formatDiagnostic 的代码片段部分
```

```typescript
  const snippet = readSnippet(diag.file, diag.line);
  if (snippet.size === 0) {
    return `${head}\n${body}`;
  }

  // 行号右对齐宽度，保证代码片段竖线对齐
  const width = String(Math.max(...snippet.keys())).length;
  const snippetLines: string[] = [];

  for (const [num, text] of snippet) {
    // Tab 展开为 4 空格：终端里 Tab 宽度不定，不展开会让指示箭头
    // 与实际列错位。4 是常见默认值
    const expanded = text.replace(/\t/g, '    ');
    const gutter = String(num).padStart(width);
    snippetLines.push(`  ${GRAY}${gutter} |${RESET} ${expanded}`);

    if (num === diag.line && diag.column > 0) {
      // 指示箭头的偏移也要按展开后的宽度算：
      // 统计 column 之前有多少个 Tab，每个多占 3 个字符
      const before = text.slice(0, diag.column - 1);
      const tabCount = (before.match(/\t/g) ?? []).length;
      const visualCol = diag.column - 1 + tabCount * 3;

      const pad = ' '.repeat(width) + ' | ' + ' '.repeat(visualCol);
      snippetLines.push(`  ${pad}${color}^${RESET}`);
    }
  }

  return `${head}\n${body}\n\n${snippetLines.join('\n')}`;
```

Tab 处理是个小细节，但影响实际体验：如果用户用 Tab 缩进，箭头指错位置会让人怀疑行号也是错的。

---

## Step 14.4：错误汇总与退出码

### 哪些错误可以累积，哪些必须立即中止

前十三步的处理不完全一致，这里明确边界。

| 阶段 | 行为 | 理由 |
|---|---|---|
| 项目扫描（Step 1） | 立即中止 | 缺 `src/` 或 manifest 时无法确定编译目标 |
| Manifest 校验（Step 3） | 累积后中止 | 字段错误可以一次报全，但报完必须停——路由表不可用 |
| SFC 解析（Step 2） | 累积，继续下一页面 | 单页面解析失败不影响其他页面 |
| 三路编译（Step 5/6/7） | 累积，继续下一页面 | 同上 |
| Bundle 组装（Step 8） | 累积，继续下一页面 | 同上 |
| Release 压缩（Step 10） | 立即中止 | 压缩失败说明产出了非法 JS，是内部缺陷 |
| RPK 打包（Step 9） | 立即中止 | 打包是最后一步，失败即无产物 |

判断依据：**后续工作是否还有意义。**

manifest 不可用时，页面列表都拿不到，继续没意义。单个页面编译失败时，其他页面仍能编译，且开发者能一次看到所有页面的问题。

### 统一的中止判断

当前 `runBuild` 里散落着多处 `reportDiagnostics` + `return 1`。抽取为一个函数。

```text
@add quickapp-toolkit/src/diagnostics/diagnostic.ts — 在 formatGrouped 之后插入
```

```typescript
/**
 * 判断诊断列表中是否有 error 级别项。
 *
 * @param diagnostics 诊断列表
 * @returns true 表示存在 error
 */
export function hasError(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

/**
 * 输出诊断并返回进程退出码。
 *
 * 约定：有 error 返回 1，仅 warning 或无诊断返回 0。
 *
 * warning 不影响退出码的理由：warning 表示「编译完成但有需要注意的
 * 地方」，产物是可用的。如果 warning 也返回非零，CI 会因为一个厂商
 * 前缀属性而失败——那不是构建错误。
 *
 * @param diagnostics 诊断列表
 * @param projectRoot 项目根目录
 * @returns 退出码
 */
export function reportAndExitCode(
  diagnostics: Diagnostic[],
  projectRoot: string
): number {
  return reportDiagnostics(diagnostics, projectRoot) ? 1 : 0;
}
```

### 严格模式

CI 场景下可能希望 warning 也失败。加一个 `--strict` 参数。

```text
@update quickapp-toolkit/src/types/index.ts — 在 BuildContext 接口中增加字段
```

```typescript
export interface BuildContext {
  projectRoot: string;
  srcDir: string;
  distDir: string;
  mode: BuildMode;
  /**
   * true 时把 warning 视为 error：影响退出码和是否产出 RPK。
   *
   * 用于 CI —— 开发时 warning 不该阻塞，但合入主干前应清零。
   */
  strict: boolean;
  diagnostics: Diagnostic[];
}
```

```text
@add quickapp-toolkit/src/diagnostics/diagnostic.ts — 在 reportAndExitCode 之后插入
```

```typescript
/**
 * 在严格模式下把 warning 提升为 error。
 *
 * 原地修改传入的数组 —— 调用方在 report 之前调用一次，
 * 之后的 hasError 判断和输出都会按 error 处理。
 *
 * @param diagnostics 诊断列表，会被原地修改
 * @param strict      是否严格模式；false 时不做任何操作
 */
export function applyStrict(diagnostics: Diagnostic[], strict: boolean): void {
  if (!strict) return;
  for (const d of diagnostics) {
    if (d.severity === 'warning') {
      d.severity = 'error';
    }
  }
}
```

```text
@update quickapp-toolkit/src/cli/index.ts — 替换 USAGE 的选项段
```

```typescript
选项：
  --mode=<mode>      构建模式：debug（默认）| release
  --root=<path>      项目根目录，默认当前目录
  --strict           把 warning 视为 error（用于 CI）
  --force            init 时允许在非空目录中创建
  -h, --help         显示帮助
  -v, --version      显示版本
```

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 BuildOptions 与 ctx 构造
```

```typescript
export interface BuildOptions {
  /** 项目根目录，默认 process.cwd() */
  projectRoot: string;
  mode: BuildMode;
  /** true 时把 warning 视为 error */
  strict: boolean;
}
```

```typescript
  const ctx: BuildContext = {
    projectRoot,
    srcDir: path.join(projectRoot, 'src'),
    distDir: path.join(projectRoot, 'dist'),
    mode,
    strict: options.strict,
    diagnostics: [],
  };
```

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换打包前的 hasError 检查
```

```typescript
  applyStrict(ctx.diagnostics, ctx.strict);

  if (hasError(ctx.diagnostics)) {
    reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
    console.error('存在错误，未产出 RPK');
    return 1;
  }
```

`applyStrict` 在打包前调用，所以严格模式下的 warning 也会阻止产出 RPK——这符合「warning 视为 error」的语义。

watch 模式不应用严格模式：开发过程中因为一个 warning 就不产出 RPK 会打断调试。`runWatch` 构造 ctx 时传 `strict: false`。

---

## Step 14.5：端到端行号验证工具

行号换算在 Step 5/6/7 各有单测，但那些测试直接调用编译器并传入 `startLine`。真实场景是：`.ux` 文件 → SFC 解析得到 `startLine` → 编译器换算。**中间少了一环没被验证：`startLine` 本身是否正确。**

验证方法是构造带已知错误位置的 `.ux` 文件，跑完整编译，断言报出的行号等于错误的真实行号。

```text
@add quickapp-toolkit/test/manual/verify-lineno.js（新建文件）
```

```javascript
'use strict';

/**
 * 端到端验证行号换算。
 *
 * 构造在已知行号处含错误的 .ux 文件，跑完整编译管线，
 * 断言诊断报出的行号与真实行号一致。
 *
 * 这个验证覆盖了单测的盲区：单测直接给编译器传 startLine，
 * 而这里的 startLine 来自 SFCParser 的真实计算。
 *
 * 用法：node test/manual/verify-lineno.js
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseSFC, validatePageSFC } = require('../../dist/parser/sfc-parser.js');
const { compileTemplateToTree } = require('../../dist/compiler/template-compiler.js');
const { compileStyleToSheet } = require('../../dist/compiler/style-compiler.js');
const { compileScriptBody } = require('../../dist/compiler/script-compiler.js');

/**
 * 一个测试用例：源码 + 期望报错的行号。
 *
 * 源码用数组形式书写，索引 + 1 就是行号，便于标注期望位置。
 */
const CASES = [
  {
    name: '模板未知标签',
    lines: [
      '<template>',              // 1
      '  <div>',                 // 2
      '    <span></span>',       // 3  <- 错误
      '  </div>',                // 4
      '</template>',             // 5
    ],
    expectLine: 3,
    block: 'template',
  },
  {
    name: '模板未闭合标签',
    lines: [
      '<template>',              // 1
      '  <div>',                 // 2  <- 错误（未闭合的标签位置）
      '    <text></text>',       // 3
      '</template>',             // 4
    ],
    expectLine: 2,
    block: 'template',
  },
  {
    name: '模板错误在 style 之后',
    lines: [
      '<style>',                 // 1
      '  .a { color: red }',     // 2
      '</style>',                // 3
      '',                        // 4
      '<template>',              // 5
      '  <div>',                 // 6
      '    <span></span>',       // 7  <- 错误
      '  </div>',                // 8
      '</template>',             // 9
    ],
    expectLine: 7,
    block: 'template',
  },
  {
    name: '样式语法错误',
    lines: [
      '<template>',              // 1
      '  <div></div>',           // 2
      '</template>',             // 3
      '',                        // 4
      '<style>',                 // 5
      '  .a {',                  // 6
      '    color: red',          // 7
      '</style>',                // 8  <- postcss 报未闭合，位置在 6 附近
    ],
    expectLine: 6,
    expectLineTolerance: 2,
    block: 'style',
  },
  {
    name: '脚本语法错误',
    lines: [
      '<template>',              // 1
      '  <div></div>',           // 2
      '</template>',             // 3
      '',                        // 4
      '<style>',                 // 5
      '  .a { color: red }',     // 6
      '</style>',                // 7
      '',                        // 8
      '<script>',                // 9
      '  export default {',      // 10
      '    private: {},',        // 11
      '    x: ,',                // 12  <- 错误
      '  };',                    // 13
      '</script>',               // 14
    ],
    expectLine: 12,
    block: 'script',
  },
  {
    name: '脚本错误在长文件末尾',
    lines: [
      '<template>',              // 1
      '  <div>',                 // 2
      '    <text>a</text>',      // 3
      '    <text>b</text>',      // 4
      '    <text>c</text>',      // 5
      '  </div>',                // 6
      '</template>',             // 7
      '',                        // 8
      '<style>',                 // 9
      '  .a { color: red }',     // 10
      '  .b { color: blue }',    // 11
      '  .c { color: green }',   // 12
      '</style>',                // 13
      '',                        // 14
      '<script>',                // 15
      '  export default {',      // 16
      '    private: {},',        // 17
      '    onInit() {},',        // 18
      '    bad: ,',              // 19  <- 错误
      '  };',                    // 20
      '</script>',               // 21
    ],
    expectLine: 19,
    block: 'script',
  },
];
```

```javascript
/**
 * 对一个用例执行编译并取出报错行号。
 *
 * 按 block 类型只跑对应的编译器 —— 其他区块可能也有问题，
 * 但我们要验证的是特定编译器的行号换算。
 *
 * @param testCase 用例
 * @param file     临时文件路径，写入 descriptor.filename
 * @returns { line, message }；未报错时 line 为 null
 */
function runCase(testCase, file) {
  const source = testCase.lines.join('\n');
  fs.writeFileSync(file, source, 'utf8');

  let descriptor;
  try {
    descriptor = parseSFC(source, file);
  } catch (e) {
    return { line: e.line ?? null, message: e.message };
  }

  const block = descriptor[testCase.block];
  if (block === null) {
    return { line: null, message: `区块 ${testCase.block} 不存在` };
  }

  try {
    if (testCase.block === 'template') {
      compileTemplateToTree(block.content, file, block.startLine);
    } else if (testCase.block === 'style') {
      compileStyleToSheet(block.content, file, block.startLine, block.lang);
    } else {
      compileScriptBody(block.content, file, block.startLine);
    }
    return { line: null, message: '未报错（期望报错）' };
  } catch (e) {
    return { line: e.line ?? null, message: e.message };
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-lineno-'));
const file = path.join(tmpDir, 'index.ux');

let passed = 0;
let failed = 0;

for (const testCase of CASES) {
  const result = runCase(testCase, file);
  const tolerance = testCase.expectLineTolerance ?? 0;
  const ok =
    result.line !== null &&
    Math.abs(result.line - testCase.expectLine) <= tolerance;

  if (ok) {
    passed++;
    console.log(`PASS  ${testCase.name}`);
    console.log(`      行 ${result.line}（期望 ${testCase.expectLine}）`);
  } else {
    failed++;
    console.log(`FAIL  ${testCase.name}`);
    console.log(`      实际行 ${result.line}，期望 ${testCase.expectLine}`);
    console.log(`      消息：${result.message}`);
    // 打印源码帮助定位
    testCase.lines.forEach((l, i) => {
      const mark = i + 1 === testCase.expectLine ? ' <- 期望' : '';
      const actual = i + 1 === result.line ? ' <- 实际' : '';
      console.log(`      ${String(i + 1).padStart(3)} | ${l}${mark}${actual}`);
    });
  }
  console.log('');
}

console.log(`${passed} 通过，${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
```

**为什么样式用例有 `expectLineTolerance`：** postcss 报「未闭合块」时，位置指向块的起始处还是文件末尾，取决于它的实现细节。允许 ±2 行的容差，验证的是「行号在正确区块内」而非精确到某一行。

模板和脚本的行号是精确的——htmlparser2 和 Babel 都给出确切位置。

### 期望输出

```bash
cd quickapp-toolkit
node test/manual/verify-lineno.js
```

```text
PASS  模板未知标签
      行 3（期望 3）

PASS  模板未闭合标签
      行 2（期望 2）

PASS  模板错误在 style 之后
      行 7（期望 7）

PASS  样式语法错误
      行 6（期望 6）

PASS  脚本语法错误
      行 12（期望 12）

PASS  脚本错误在长文件末尾
      行 19（期望 19）

6 通过，0 失败
```

**「模板错误在 style 之后」和「脚本错误在长文件末尾」是最有价值的两个用例。** 它们的 `startLine` 不是 2——前者的 template 从第 6 行开始，后者的 script 从第 16 行开始。如果换算公式写错（比如漏了 `- 1` 或没加 `startLine`），这两个用例会失败，而 `startLine` 为 2 的简单用例可能碰巧通过。

失败时的输出会打印源码并标注「期望」和「实际」两个位置，偏差方向直接可见：

```text
FAIL  脚本错误在长文件末尾
      实际行 4，期望 19
      消息：JS 语法错误：Unexpected token
        1 | <template>
        ...
        4 |     <text>b</text> <- 实际
        ...
       19 |     bad: , <- 期望
```

实际行 4 而期望 19，差 15——正好是 `startLine - 1`（16 - 1），说明 `startLine` 没有被加上。这种偏差模式能直接指出问题所在。

---

## Step 14.6：单元测试

```text
@add quickapp-toolkit/test/unit/diagnostics.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  toAbsoluteLine,
  offsetToAbsoluteLine,
  offsetToColumn,
} = require('../../dist/diagnostics/location.js');
const {
  formatDiagnostic,
  reportDiagnostics,
  hasError,
  applyStrict,
  formatGrouped,
} = require('../../dist/diagnostics/diagnostic.js');

// ---------- 行号换算 ----------

test('区块第 1 行对应 startLine', () => {
  assert.strictEqual(toAbsoluteLine(1, 2), 2);
  assert.strictEqual(toAbsoluteLine(1, 20), 20);
});

test('区块第 N 行的换算', () => {
  // startLine=2 时，区块第 3 行是文件第 4 行
  assert.strictEqual(toAbsoluteLine(3, 2), 4);
  // startLine=16 时，区块第 4 行是文件第 19 行
  assert.strictEqual(toAbsoluteLine(4, 16), 19);
});

test('相对行号为 0 或负数时返回 startLine', () => {
  assert.strictEqual(toAbsoluteLine(0, 10), 10);
  assert.strictEqual(toAbsoluteLine(-1, 10), 10);
});

test('偏移换算行号：首行', () => {
  const content = 'line1\nline2\nline3';
  // 偏移 0 在第 1 行
  assert.strictEqual(offsetToAbsoluteLine(0, content, 5), 5);
  // 偏移 3 仍在第 1 行
  assert.strictEqual(offsetToAbsoluteLine(3, content, 5), 5);
});

test('偏移换算行号：跨行', () => {
  const content = 'line1\nline2\nline3';
  // 偏移 6 是 line2 的开头（第 2 行）
  assert.strictEqual(offsetToAbsoluteLine(6, content, 5), 6);
  // 偏移 12 是 line3 的开头（第 3 行）
  assert.strictEqual(offsetToAbsoluteLine(12, content, 5), 7);
});

test('偏移超出内容长度时按末尾算', () => {
  const content = 'a\nb';
  assert.strictEqual(offsetToAbsoluteLine(999, content, 1), 2);
});

test('列号计算：首行', () => {
  const content = 'abcdef';
  assert.strictEqual(offsetToColumn(0, content), 1);
  assert.strictEqual(offsetToColumn(3, content), 4);
});

test('列号计算：换行后重置', () => {
  const content = 'ab\ncdef';
  // 偏移 3 是第 2 行的第 1 个字符
  assert.strictEqual(offsetToColumn(3, content), 1);
  // 偏移 5 是第 2 行的第 3 个字符
  assert.strictEqual(offsetToColumn(5, content), 3);
});

test('换算公式的一致性：两种函数结果相同', () => {
  const content = 'a\nb\nc\nd';
  const startLine = 10;
  // 偏移 4 在第 3 行（a\nb\nc 中的 c）
  const viaOffset = offsetToAbsoluteLine(4, content, startLine);
  const viaLine = toAbsoluteLine(3, startLine);
  assert.strictEqual(viaOffset, viaLine);
});

// ---------- 诊断格式化 ----------

/** 创建含指定内容的临时文件 */
function tmpFile(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-diag-'));
  const file = path.join(dir, 'index.ux');
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

test('格式化含文件名和行列号', () => {
  const file = tmpFile(['line1', 'line2', 'line3']);
  const out = formatDiagnostic(
    {
      severity: 'error',
      file,
      line: 2,
      column: 3,
      message: '测试错误',
    },
    path.dirname(file)
  );

  assert.match(out, /ERROR/);
  assert.match(out, /index\.ux:2:3/);
  assert.match(out, /测试错误/);
});

test('格式化含代码片段', () => {
  const file = tmpFile(['aaa', 'bbb', 'ccc', 'ddd', 'eee']);
  const out = formatDiagnostic(
    { severity: 'error', file, line: 3, column: 1, message: 'x' },
    path.dirname(file)
  );

  // 上下各 2 行
  assert.match(out, /1 \| aaa/);
  assert.match(out, /3 \| ccc/);
  assert.match(out, /5 \| eee/);
});

test('指示箭头位置正确', () => {
  const file = tmpFile(['abcdef']);
  const out = formatDiagnostic(
    { severity: 'error', file, line: 1, column: 4, message: 'x' },
    path.dirname(file)
  );

  const lines = out.split('\n');
  const arrowLine = lines.find((l) => l.includes('^'));
  assert.ok(arrowLine !== undefined, '应有指示箭头');
  // 箭头前的空格数应对应 column - 1
  const codeLine = lines.find((l) => /1 \| abcdef/.test(l));
  const codeIdx = codeLine.indexOf('abcdef');
  const arrowIdx = arrowLine.indexOf('^');
  assert.strictEqual(arrowIdx - codeIdx, 3, '箭头应指向第 4 个字符');
});

test('Tab 缩进时箭头位置正确', () => {
  // 一个 Tab + "abc"，错误在 a（column 2）
  const file = tmpFile(['\tabc']);
  const out = formatDiagnostic(
    { severity: 'error', file, line: 1, column: 2, message: 'x' },
    path.dirname(file)
  );

  const lines = out.split('\n');
  const codeLine = lines.find((l) => l.includes('abc'));
  const arrowLine = lines.find((l) => l.includes('^'));
  // Tab 展开为 4 空格，a 的位置是第 5 列
  const codeIdx = codeLine.indexOf('abc');
  const arrowIdx = arrowLine.indexOf('^');
  assert.strictEqual(arrowIdx, codeIdx, 'Tab 展开后箭头应对齐 a');
});

test('行号为 0 时不输出代码片段', () => {
  const file = tmpFile(['aaa']);
  const out = formatDiagnostic(
    { severity: 'error', file, line: 0, column: 0, message: 'x' },
    path.dirname(file)
  );
  assert.ok(!out.includes('|'), '无行号时不应有代码片段');
});

test('文件不可读时不崩溃', () => {
  const out = formatDiagnostic(
    {
      severity: 'error',
      file: '/nonexistent/x.ux',
      line: 5,
      column: 1,
      message: 'x',
    },
    '/'
  );
  assert.match(out, /x/);
});

test('warning 用不同标签', () => {
  const file = tmpFile(['aaa']);
  const out = formatDiagnostic(
    { severity: 'warning', file, line: 1, column: 0, message: 'w' },
    path.dirname(file)
  );
  assert.match(out, /WARNING/);
});
```

```javascript
// ---------- 汇总与退出码 ----------

test('hasError 识别 error', () => {
  assert.strictEqual(
    hasError([{ severity: 'warning', file: 'a', line: 1, column: 1, message: 'w' }]),
    false
  );
  assert.strictEqual(
    hasError([
      { severity: 'warning', file: 'a', line: 1, column: 1, message: 'w' },
      { severity: 'error', file: 'b', line: 1, column: 1, message: 'e' },
    ]),
    true
  );
});

test('hasError 对空列表返回 false', () => {
  assert.strictEqual(hasError([]), false);
});

test('applyStrict 把 warning 提升为 error', () => {
  const diags = [
    { severity: 'warning', file: 'a', line: 1, column: 1, message: 'w' },
    { severity: 'error', file: 'b', line: 1, column: 1, message: 'e' },
  ];
  applyStrict(diags, true);
  assert.strictEqual(diags[0].severity, 'error');
  assert.strictEqual(diags[1].severity, 'error');
});

test('非严格模式下 applyStrict 无操作', () => {
  const diags = [
    { severity: 'warning', file: 'a', line: 1, column: 1, message: 'w' },
  ];
  applyStrict(diags, false);
  assert.strictEqual(diags[0].severity, 'warning');
});

test('reportDiagnostics 有 error 返回 true', () => {
  const file = tmpFile(['aaa']);
  const result = reportDiagnostics(
    [{ severity: 'error', file, line: 1, column: 1, message: 'e' }],
    path.dirname(file)
  );
  assert.strictEqual(result, true);
});

test('reportDiagnostics 仅 warning 返回 false', () => {
  const file = tmpFile(['aaa']);
  const result = reportDiagnostics(
    [{ severity: 'warning', file, line: 1, column: 1, message: 'w' }],
    path.dirname(file)
  );
  assert.strictEqual(result, false);
});

test('reportDiagnostics 空列表返回 false', () => {
  assert.strictEqual(reportDiagnostics([], '/'), false);
});

test('error 先于 warning 输出', () => {
  const file = tmpFile(['aaa']);
  const captured = [];
  const orig = console.error;
  console.error = (msg) => captured.push(String(msg));

  try {
    reportDiagnostics(
      [
        { severity: 'warning', file, line: 1, column: 1, message: 'WARN_MARK' },
        { severity: 'error', file, line: 1, column: 1, message: 'ERR_MARK' },
      ],
      path.dirname(file)
    );
  } finally {
    console.error = orig;
  }

  const all = captured.join('\n');
  assert.ok(
    all.indexOf('ERR_MARK') < all.indexOf('WARN_MARK'),
    'error 应先输出'
  );
});

// ---------- 分组输出 ----------

test('formatGrouped 同文件只打一次文件名', () => {
  const out = formatGrouped(
    [
      { severity: 'error', file: '/p/a.ux', line: 1, column: 1, message: 'e1' },
      { severity: 'error', file: '/p/a.ux', line: 5, column: 2, message: 'e2' },
    ],
    '/p'
  );

  const occurrences = (out.match(/a\.ux/g) ?? []).length;
  assert.strictEqual(occurrences, 1);
  assert.match(out, /1:1/);
  assert.match(out, /5:2/);
});

test('formatGrouped 多文件分块', () => {
  const out = formatGrouped(
    [
      { severity: 'error', file: '/p/a.ux', line: 1, column: 1, message: 'e' },
      { severity: 'error', file: '/p/b.ux', line: 1, column: 1, message: 'e' },
    ],
    '/p'
  );
  assert.match(out, /a\.ux/);
  assert.match(out, /b\.ux/);
  // 两块之间有空行
  assert.match(out, /\n\n/);
});
```

**用例统计：** 26 个。累计 358 个。

`error 先于 warning 输出` 这条用了 `console.error` 劫持。这不优雅，但 `reportDiagnostics` 的职责就是输出——要验证输出顺序只能捕获它。`finally` 里恢复原函数，避免影响后续测试。

---

## Step 14.7：逐层验证

### 14.7.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** 358 个用例通过（diagnostics 26 + 之前 332）。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `toAbsoluteLine` 结果差 1 | 公式漏了 `- 1` 或多减了 | 核对：`startLine + relativeLine - 1` |
| `偏移换算行号：跨行` 失败 | `offsetToAbsoluteLine` 的 `newlines + 1` 漏了 | 换行符计数是 0-based，要转 1-based |
| `Tab 缩进时箭头位置正确` 失败 | Tab 展开宽度或箭头偏移计算 | 展开为 4 空格，箭头偏移加 `tabCount * 3` |
| `error 先于 warning 输出` 失败 | `reportDiagnostics` 未分组 | 确认用了 `[...errors, ...warnings]` |
| `TS2339: Property 'strict' does not exist` | `BuildContext` 未加字段 | 按 14.4 更新 types |

### 14.7.2：端到端行号验证

这是本步最重要的验证。

```bash
node test/manual/verify-lineno.js
```

**预期：** `6 通过，0 失败`

**任何一条失败都要修。** 行号错误的后果是开发者按错误提示去看代码，看到的是无关内容——这比没有行号更糟，因为它会误导排查方向。

失败时输出会标注期望和实际位置。常见的偏差模式：

| 偏差 | 原因 |
|---|---|
| 实际 = 期望 - (startLine - 1) | 没加 `startLine`，报的是区块相对行号 |
| 实际 = 期望 + 1 | 公式漏了 `- 1` |
| 实际 = 期望 - 1 | 多减了 1，或 `startLine` 指向了开始标签而非内容首行 |
| 实际为 0 或 null | 解析器未提供位置信息，或异常类型不带 line 字段 |

最后一种情况要检查错误对象：`TemplateCompileError` 等继承自 `CompileError`，构造时第三个参数是行号。如果某处抛错时漏传，`err.line` 会是默认值 0。

### 14.7.3：真实项目的错误定位验证

用 Step 13 生成的模板项目，在已知位置注入错误。

```bash
cd /tmp
rm -rf diag-test && quickapp init diag-test && cd diag-test
```

先确认基线正常：

```bash
quickapp build && echo "基线正常"
```

**模板错误：** 在 Home 页面的 template 里加一个未知标签。

```bash
# 查看 template 区块位置
grep -n '<template>\|</template>\|<style>\|<script>' src/pages/Home/index.ux
```

**预期输出：**

```text
1:<template>
8:</template>
10:<style>
...
```

在第 4 行插入 `<span></span>`：

```bash
sed -i.bak '4i\
    <span></span>' src/pages/Home/index.ux
quickapp build
```

**预期输出：**

```text
ERROR  src/pages/Home/index.ux:4:5
  未知组件 <span>，V1 支持的组件：div、text、input、image

  2 |   <div class="wrapper">
  3 |     <text class="title">{{title}}</text>
  4 |     <span></span>
    |     ^
  5 |     <text class="subtitle">{{subtitle}}</text>

编译失败：1 个错误，0 个警告
存在错误，未产出 RPK
```

**核对点：**
- 行号 4 与 `sed` 插入的位置一致
- 代码片段显示的第 4 行内容正是插入的 `<span></span>`
- 箭头指向 `<span>` 的起始列

恢复：

```bash
mv src/pages/Home/index.ux.bak src/pages/Home/index.ux
```

**脚本错误：** script 区块在文件后半部分，这个用例最能暴露 `startLine` 问题。

```bash
grep -n '<script>' src/pages/Home/index.ux
```

假设输出是 `43:<script>`，在第 48 行注入语法错误：

```bash
sed -i.bak '48i\
    bad: ,' src/pages/Home/index.ux
quickapp build
```

**预期输出：**

```text
ERROR  src/pages/Home/index.ux:48:10
  JS 语法错误：Unexpected token

  46 |   export default {
  47 |     private: {
  48 |     bad: ,
     |          ^
  49 |       title: '{{NAME}}',

编译失败：1 个错误，0 个警告
```

**核对点：** 行号是 48（文件绝对行号），不是 5（script 区块内的相对行号）。

如果显示的是 5 或 6，说明 `startLine` 未被加上——这正是 14.5 的验证要拦住的问题。

**样式错误：**

```bash
mv src/pages/Home/index.ux.bak src/pages/Home/index.ux
grep -n '<style>' src/pages/Home/index.ux
# 假设是 10，在第 12 行制造未闭合
sed -i.bak '12s/}//' src/pages/Home/index.ux
quickapp build
```

**预期：** 行号在 10-14 范围内（postcss 的未闭合块位置有实现差异，见 14.5 的容差说明）。

### 14.7.4：多错误汇总验证

```bash
cd /tmp/diag-test
git checkout . 2>/dev/null || true

# 两个页面同时出错
sed -i.bak '4i\
    <span></span>' src/pages/Home/index.ux
sed -i.bak '4i\
    <unknown></unknown>' src/pages/About/index.ux

quickapp build
```

**预期输出：**

```text
ERROR  src/pages/Home/index.ux:4:5
  未知组件 <span>，...

  [代码片段]

ERROR  src/pages/About/index.ux:4:5
  未知组件 <unknown>，...

  [代码片段]

编译失败：2 个错误，0 个警告
存在错误，未产出 RPK
```

**核对点：**
- 两条错误都输出，不是报第一个就停
- 顺序与 manifest 的页面声明顺序一致（Home 在 About 之前）
- 末尾统计数字正确

### 14.7.5：error 与 warning 混合输出

制造一个 warning（厂商前缀属性）加一个 error：

```bash
cd /tmp/diag-test
git checkout . 2>/dev/null || true

# warning：Home 页面加厂商前缀属性
sed -i.bak 's/  \.title {/  .title {\n    -webkit-mask: none;/' src/pages/Home/index.ux
# error：About 页面加未知标签
sed -i.bak '4i\
    <span></span>' src/pages/About/index.ux

quickapp build
```

**预期输出顺序：**

```text
ERROR  src/pages/About/index.ux:4:5
  未知组件 <span>，...

WARNING  src/pages/Home/index.ux:NN:5
  属性 "-webkit-mask" 是厂商前缀或 CSS 变量，快应用不支持，已原样透传

编译失败：1 个错误，1 个警告
```

**核对点：** ERROR 在 WARNING 之前，尽管 Home 页面（warning）先被编译。这验证了 14.3 改进 1 的分组输出。

### 14.7.6：退出码与严格模式

只有 warning 时：

```bash
cd /tmp/diag-test
git checkout . 2>/dev/null || true
sed -i.bak 's/  \.title {/  .title {\n    -webkit-mask: none;/' src/pages/Home/index.ux

quickapp build; echo "退出码：$?"
```

**预期：**

```text
WARNING  src/pages/Home/index.ux:NN:5
  属性 "-webkit-mask" ...

编译完成：1 个警告

产物：
  dist/com.example.diagtest.debug.1.0.0.rpk
  ...
退出码：0
```

**核对点：** 退出码 0，且**产出了 RPK**。warning 不阻止构建。

严格模式：

```bash
quickapp build --strict; echo "退出码：$?"
```

**预期：**

```text
ERROR  src/pages/Home/index.ux:NN:5
  属性 "-webkit-mask" ...

编译失败：1 个错误，0 个警告
存在错误，未产出 RPK
退出码：1
```

**核对点：**
- 同一条诊断的级别从 WARNING 变成 ERROR
- 退出码 1
- 未产出 RPK

对照两次的 `dist/` 内容确认第二次没有覆盖：

```bash
ls -la dist/
```

**预期：** RPK 文件的 mtime 是第一次构建的时间。

### 14.7.7：watch 模式不受严格模式影响

```bash
cd /tmp/diag-test
quickapp watch --strict &
WATCH_PID=$!
sleep 2
kill $WATCH_PID
```

**预期：** watch 正常启动并产出 RPK，尽管有 warning 且加了 `--strict`。

`runWatch` 构造 ctx 时固定传 `strict: false`（14.4 的说明）。开发过程中因为一个 warning 就不产出 RPK 会打断调试。

如果这里也应用了严格模式，说明 `cmd-watch.ts` 里的 ctx 构造漏了这个字段——TypeScript 会报缺少 `strict` 属性，所以更可能是传了 `options.strict`。改为固定 `false`。

---

## 技术决策

### 1. 行号换算集中到一个函数

三个编译器原本各自实现换算，Step 5 用的是「数换行符 + startLine」（0-based 累加不减 1），Step 6/7 用的是「startLine + line - 1」。两种都对，但不一致。

**为什么要统一：** 公式只在一处定义，改动时不会漏。更实际的是——维护者看到两种写法会怀疑其中一种是 bug，然后花时间验证，最后发现两种都对。这个验证成本每次都要付。

**代价：** Step 5 的 `offsetToLine` 要改为委托调用，多一层间接。`offsetToAbsoluteLine` 内部把 0-based 的换行符计数转为 1-based 再调 `toAbsoluteLine`，转换本身也是一处可能出错的地方——但它只在一个函数里，有单测覆盖。

### 2. 列号统一为 1-based，0 表示未知

三个来源的基准不同：postcss 是 1-based，Babel 是 0-based，我们自己的 `offsetToColumn` 是 1-based。

**为什么选 1-based：** 与编辑器显示一致。开发者看到 `4:5` 会去找第 4 行第 5 列，编辑器的状态栏显示的也是 1-based。

**代价：** Babel 的适配层要 `+1`。这个转换在 Step 7 的 `toScriptError` 里，容易在重构时丢掉。单测里没有直接覆盖这一点——列号偏一格不影响功能，只影响箭头位置，测试成本高于收益。

### 3. Tab 展开为 4 空格

**为什么：** 终端里 Tab 的显示宽度不定（多数是 8，有的配置成 4 或 2）。指示箭头按字符数计算偏移，遇到 Tab 会错位。

展开为固定宽度让代码片段和箭头在同一基准上。选 4 而非 8：现代编辑器默认多是 4，且 8 会让深缩进的代码片段过宽。

**代价：** 如果用户的终端 Tab 宽度是 8，代码片段的缩进看起来比编辑器里窄。这不影响定位——行号和箭头位置都对。

### 4. 分组输出：error 先于 warning

**为什么：** error 阻止构建，必须优先看到。warning 混在中间会被 error 的代码片段淹没——一个页面有 5 处 warning，每处带 5 行代码片段，就是 25 行输出把 error 埋掉。

组内保持累积顺序（按 manifest 页面声明顺序），与源码结构对应，便于逐个修复。

**代价：** 同一文件的 error 和 warning 被分开显示，用户要在两处看同一个文件。`formatGrouped` 提供了按文件分组的备选格式，但当前未启用（见 QA）。

### 5. warning 不影响退出码

**为什么：** warning 表示「编译完成但有需要注意的地方」，产物是可用的。如果 warning 也返回非零，CI 会因为一个厂商前缀属性而失败——那不是构建错误。

**代价：** warning 容易被忽略，长期积累。`--strict` 是应对手段：开发时不阻塞，合入主干前用严格模式清零。

### 6. `--strict` 而非默认严格

**为什么：** 开发过程中 warning 是正常的中间状态。从别的项目迁移代码时会带一堆 `@media` 和厂商前缀，如果默认严格，用户第一次 build 就失败且不知道从哪开始改。

默认宽松 + CI 严格是常见的分层策略。

**代价：** 需要在 CI 配置里显式加 `--strict`，容易漏。文档和模板的 README 里应该提示这个用法——当前 Step 13 的模板 README 没写，是一个可以补的点。

### 7. `applyStrict` 原地修改数组

**为什么：** 严格模式需要影响三处判断——`hasError`、`reportDiagnostics` 的输出标签、是否产出 RPK。返回新数组的话，三处都要用新数组，容易漏一处。

原地修改让调用方只需在 report 之前调一次。

**代价：** 函数有副作用，不是纯函数。测试时要注意传入的数组会被改。单测里的 `applyStrict 把 warning 提升为 error` 直接断言传入数组的变化，明确了这个语义。

### 8. 不做错误码体系

**为什么：** 错误码（`QA1001: 未知组件`）的价值在于：搜索引擎友好、跨语言查文档、程序化处理特定错误。三者当前都不需要——toolkit 的用户量小，错误信息本身是中文且描述完整，没有程序化消费错误的场景。

维护成本是实在的：每个错误要分配码、维护码到文档的映射、保证码不重复不复用。

**代价：** 用户遇到错误时无法用码搜索。缓解方式是错误信息本身足够具体——「未知组件 `<span>`，V1 支持的组件：div、text、input、image」比「QA1001」信息量大得多。

如果将来用户量增长到需要错误码，可以在 `CompileError` 上加可选的 `code` 字段，逐步补充，不需要一次性设计完整体系。

### 9. `verify-lineno.js` 是手工工具而非单测

**为什么：** 它验证的是「跨模块的行号一致性」，涉及 SFCParser + 三个编译器。放进单测会让 `npm test` 依赖临时文件读写，且失败时的诊断输出（打印源码标注期望和实际）不适合测试框架的输出格式。

作为独立脚本，它的输出是为人阅读设计的——失败时直接指出偏差方向。

**代价：** 不会在 `npm test` 里自动跑，可能被遗忘。缓解方式是在 14.7.2 把它列为必做验证项，且 CI 可以单独调用它（`node test/manual/verify-lineno.js`，退出码非零即失败）。

---

## QA

**Q：`formatGrouped` 写了但没启用，是死代码吗？**

当前是。保留它的理由是它对应一个明确的场景：诊断数量多时（比如从 Web 项目迁移代码，几十条 `@media` warning），当前格式每条带 5 行代码片段，输出会有几百行。

启用条件应该是「诊断数超过某个阈值时切换到紧凑格式」，比如 10 条。但阈值定多少需要实际使用反馈，现在定了也是猜。

留着不启用比删掉好——它有单测覆盖，随时可以接上。如果一直不启用，下次清理时删掉，那时至少知道了「实际使用中诊断数没有多到需要紧凑格式」。

**Q：为什么样式的行号验证要加容差，模板和脚本不用？**

因为报错位置的语义不同。

htmlparser2 报「未知标签」时，位置是那个标签的起始处——精确且确定。Babel 报语法错误时，位置是解析失败的 token——同样精确。

postcss 报「未闭合块」时，位置指向块的起始处（`.a {` 那一行）还是解析到文件末尾才发现问题的位置，取决于它的实现。不同小版本可能不同。

容差 ±2 行验证的是「行号落在正确的区块内」，这是 `startLine` 换算正确的充分证据。要求精确到某一行会让测试绑定 postcss 的实现细节。

**Q：`readSnippet` 每次诊断都读一遍文件，多条诊断会重复读同一文件吗？**

会。10 条诊断在同一文件就读 10 次。

没优化的理由是规模：诊断数通常在个位数，文件几 KB，读取在微秒级。加缓存需要考虑失效（watch 模式下文件会变），复杂度高于收益。

如果诊断数增长到需要优化，做法是在 `reportDiagnostics` 里预读所有涉及的文件到 Map，传给 `formatDiagnostic`。那时 `formatDiagnostic` 的签名要加一个参数，是个小的破坏性改动。

**Q：Tab 展开为 4 空格，如果用户混用 Tab 和空格会怎样？**

箭头位置仍然正确。计算逻辑是：取 column 之前的原始文本，数其中的 Tab 数量，每个 Tab 让视觉偏移多 3（4 - 1）。空格不受影响。

混用缩进本身是代码风格问题，不是诊断输出该解决的。

**Q：`--strict` 会把 Step 8 的 `app.ux 含 template` warning 也变成 error，模板项目在严格模式下会失败吗？**

不会。Step 13 的模板刻意让 `app.ux` 只有 `<script>` 区块，不产生这个 warning。

13.6.3 的验收清单里有「无 WARNING 输出」这一项，正是为了保证模板在严格模式下也能通过。这两步的设计是配合的——如果模板带 warning，`quickapp init && quickapp build --strict` 会失败，而那是 CI 里的常见组合。

**Q：诊断走 `console.error`（stderr），`--strict` 下的 error 也是 stderr，那 stdout 有什么？**

产物信息：模式、页面列表、编译结果、产物路径和大小。

分离的意义是 `quickapp build > build.log` 时，日志文件里是构建信息，错误直接显示在终端。CI 里可以分别捕获：stdout 归档为构建记录，stderr 作为失败原因。

**Q：行号为 0 表示未知，但 `toAbsoluteLine(0, startLine)` 返回 `startLine` 而不是 0，会不会混淆？**

会有一点。`toAbsoluteLine` 的 0 输入表示「解析器没给出相对行号」，此时退化到区块起始位置——那至少指向了正确的区块，比 0（完全未知）有用。

`Diagnostic.line` 为 0 的语义是「无法定位到任何行」，只在文件级错误（如「无法读取文件」）时出现。两个 0 的含义不同，但它们在不同层：一个是换算函数的输入，一个是诊断结构的字段。

如果要更清晰，`toAbsoluteLine` 的参数类型可以是 `number | null`，null 表示未知。但那会让调用方都要处理 null，收益不大。

**Q：`error 先于 warning 输出` 的测试劫持了 `console.error`，有更好的做法吗？**

有两种，都有代价。

一是让 `reportDiagnostics` 接受一个输出函数参数（依赖注入），测试时传入收集器。这更可测，但生产代码多一个参数，且所有调用方都要传或依赖默认值。

二是把格式化和输出分离——`reportDiagnostics` 只返回字符串，由调用方打印。这样测试只需断言返回值。但 `reportDiagnostics` 现在还负责返回「是否有 error」，拆开后要么返回元组，要么调用方自己判断。

当前的劫持方案代码最少，且 `finally` 保证恢复。如果诊断输出的逻辑继续复杂化（比如加 JSON 输出格式），值得重构为方案二。

**Q：Step 14 完成后，toolkit 就算完成了吗？**

功能上是。14 个 Step 覆盖了 tasks.md 的全部 Task，requirements.md 的 9 个需求都有对应实现和验证。

但有三项遗留：

```text
Step 11 的三个待填结论    需要 Android Runtime 就绪后实测
_meta.ruleDef 技术债      等 Runtime 支持选择器优先级时补
模板 README 未提 --strict  Step 13 的模板可以补一句
```

前两项依赖 Runtime 进度，不是 toolkit 能单独完成的。第三项是一行文档修改，可以随时做。

---

## 下一步

toolkit 的 14 个 Step 到此完成。

下一个项目是 **quickapp-runtime-js**（framework.js）—— 运行在 QuickJS 内的 JS 框架层。它是当前 Android Runtime 实际缺失的部分：Android 侧用的是一份约 40 行的最小 framework.js，而 Step 11 的契约验收需要完整实现才能跑通。

toolkit 与 runtime-js 的接口是明确的：

```text
toolkit 产出 bundle，调用 $app_define$ / $app_bootstrap$
    ↓
framework.js 实现这两个函数，创建 VM，遍历 template，求值函数属性
    ↓
调用 __native_render__(vnodeTree, styleSheet) 交给 C++
```

toolkit 的 design.md「Bundle 产物格式」章节定义的六个硬约束，就是 framework.js 的输入契约。写 runtime-js 的文档时应该反向引用它——两侧对同一份契约的理解必须一致。

runtime-js 的需求划分和 12 个 steps 的建议已经写在 `HANDOFF-toolkit-js.md` 里。
