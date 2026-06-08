# 06 - Monaco Editor 内核

> 核心问题: 编辑器如何处理百万行文件？语法高亮怎么做到毫秒级？

## 目录

- [第一性原理](#第一性原理)
- [源码路径](#源码路径)
- [文本模型: Piece Tree](#文本模型-piece-tree)
  - [为什么不用字符串数组？](#为什么不用字符串数组)
  - [VSCode 的 Piece Tree](#vscode-的-piece-tree)
  - [关键优化](#关键优化)
- [虚拟渲染](#虚拟渲染-virtual-rendering)
- [视图模型](#视图模型-viewmodel)
- [语法高亮: Token化引擎](#语法高亮-token化引擎)
  - [TextMate 引擎](#textmate-引擎-主力)
  - [增量 Token 化](#增量-token-化)
  - [Semantic Tokens](#semantic-tokens-语义高亮)
- [输入处理](#输入处理)
- [Minimap](#minimap-缩略图)
- [编辑器贡献点](#编辑器贡献点-editor-contributions)
- [小结](#小结)

---

## 第一性原理

**文本编辑器的本质**：
- 输入: 用户按键事件序列
- 状态: 文本模型 (字符串 + 光标 + 选区)
- 输出: 像素级渲染

**核心挑战**：
1. 大文件 — 百万行文本不能全部渲染
2. 高频输入 — 每次按键都要更新模型 + 重绘
3. 语法高亮 — 实时着色不能卡
4. 多光标 — 同时编辑多个位置

## 源码路径

```
vs/editor/
├── common/              ← 编辑器核心模型 (无 DOM 依赖)
│   ├── model/           ← 文本模型 (PieceTree)
│   ├── cursor/          ← 光标逻辑
│   ├── commands/        ← 编辑命令
│   ├── languages/       ← 语言服务接口
│   ├── viewModel/       ← 视图模型 (模型→视图的映射)
│   └── tokens/          ← Token化引擎
├── browser/             ← DOM 渲染层
│   ├── view/            ← 视图层 (Canvas/DOM)
│   ├── widget/          ← UI 小部件 (IntelliSense, 参数提示)
│   └── controller/      ← 输入控制器
├── contrib/             ← 编辑器功能扩展
│   ├── find/            ← 查找替换
│   ├── folding/         ← 代码折叠
│   ├── hover/           ← 悬停提示
│   ├── suggest/         ← 自动补全
│   ├── wordHighlighter/ ← 相同词高亮
│   └── ...
└── standalone/          ← Monaco 独立版 (可脱离 VSCode 使用)
```

## 文本模型: Piece Tree

### 为什么不用字符串数组？

传统方案及其问题：
| 方案 | 插入复杂度 | 内存 | 问题 |
|------|-----------|------|------|
| 单字符串 | O(n) 复制 | 1x | 大文件插入慢 |
| 行数组 | O(n) 移位 | 2x+ | 行首插入要移动后续所有行 |
| Rope | O(log n) | 高碎片 | 实现复杂，缓存不友好 |

### VSCode 的 Piece Tree

灵感来自 Piece Table (微软 Word 早期使用)，结合红黑树优化：

```
概念:
┌──────────────────────────────────────────────┐
│ Original Buffer: "Hello World\nFoo Bar\n"    │  ← 原始文件内容 (只读)
├──────────────────────────────────────────────┤
│ Change Buffer: "INSERTED TEXT"               │  ← 所有插入的内容 (追加写)
├──────────────────────────────────────────────┤
│ Piece Table (红黑树):                         │
│   Piece 1: {buffer: original, start: 0, len: 5}    → "Hello"
│   Piece 2: {buffer: change, start: 0, len: 13}     → "INSERTED TEXT"
│   Piece 3: {buffer: original, start: 5, len: 13}   → " World\nFoo Bar\n"
└──────────────────────────────────────────────┘
```

### 性能特点

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| 插入 | O(log n) | 拆分 piece + 插入新 piece |
| 删除 | O(log n) | 缩短/拆分 piece |
| 查找行 | O(log n) | 红黑树节点存储行数信息 |
| 获取文本 | O(k) | k = 涉及的 piece 数 |
| 内存 | ~1x | 原始内容不复制，增量追加 |

### 关键优化

1. **行信息缓存** — 每个 tree node 记录该子树有多少行，按行定位 O(log n)
2. **不可变 Original Buffer** — 打开文件后原始内容只读，节省 GC 压力
3. **Change Buffer 追加写** — 所有编辑的新文本连续追加，缓存友好

## 虚拟渲染 (Virtual Rendering)

百万行文件不能全部创建 DOM。Monaco 只渲染**可见区域** + 上下缓冲区：

```
┌────────────────────────────┐
│  ↑ 缓冲区 (不可见，预渲染)   │  ~5 行
├────────────────────────────┤
│                            │
│  可见区域 (viewport)        │  ~40 行 (取决于窗口高度)
│                            │
├────────────────────────────┤
│  ↓ 缓冲区 (不可见，预渲染)   │  ~5 行
└────────────────────────────┘
│
│  ... 百万行文本只存在于 Model 中
│      不创建 DOM 元素
```

滚动时：
- 复用已有 DOM 行，更新内容
- 超出缓冲区的行被回收
- 滚动性能 = 常数时间 (与文件大小无关)

## 视图模型 (ViewModel)

Model ≠ 视觉呈现。ViewModel 负责映射：

```
TextModel (逻辑):      ViewModel (视觉):
Line 1                 Line 1
Line 2 (200字符)       Line 2a (自动换行前半)
                       Line 2b (自动换行后半)
Line 3 (折叠区域)      Line 3 [+] (折叠标记)
Line 4                 ← 被折叠，不显示
Line 5                 ← 被折叠，不显示
Line 6                 Line 4
```

映射关系：
- **Word Wrap** — 一行模型对应多行视觉行
- **Code Folding** — 多行模型对应一行视觉行
- **Minimap** — 所有行的缩略表示

## 语法高亮: Token化引擎

### 分层设计

```
┌─────────────────────────────┐
│ Language Extensions (插件)    │  ← Semantic Tokens (LSP)
├─────────────────────────────┤
│ TextMate Grammar             │  ← 正则匹配 (vscode-textmate)
├─────────────────────────────┤
│ Monarch (内置)               │  ← 简单语法 (JSON, Markdown)
├─────────────────────────────┤
│ Token 渲染引擎               │  ← 将 token 转为 CSS class
└─────────────────────────────┘
```

### TextMate 引擎 (主力)

```
源码: dependencies → vscode-textmate (npm包)
语法定义: .tmLanguage.json (正则规则)
```

工作流程：
1. 加载语言的 `.tmLanguage.json` (如 TypeScript.tmLanguage.json)
2. 逐行应用正则规则，生成 Token 数组
3. 每个 Token = (起始位置, 类型, 修饰符)
4. 渲染时将 Token 类型映射为 CSS class → 颜色

### Oniguruma — 正则引擎

TextMate 语法用的是 Ruby 风格正则 (Oniguruma)。VSCode 通过 WASM 运行：

```
vscode-oniguruma → onig.wasm → 在浏览器/Node中执行正则匹配
```

### 增量 Token 化

不是每次编辑都重新 token 化整个文件：

```
编辑第 100 行
  → 从第 100 行开始重新 token 化
  → 如果第 101 行的起始状态和之前一样 → 停止
  → 否则继续到状态收敛为止
```

通常只需重新 token 化 1-3 行。

### Semantic Tokens (语义高亮)

TextMate 是语法级别 (syntax)。LSP 提供语义级别：

```
// TextMate 只知道这是标识符
const foo = bar.baz();
      ^^^         ← identifier

// Semantic Tokens 知道类型
const foo = bar.baz();
      ^^^   ^^^  ^^^
      变量   对象  方法    ← 更精确的颜色
```

Semantic Tokens 由语言服务器 (LSP) 异步提供，覆盖 TextMate 的基础着色。

## 输入处理

```
[用户按键]
    │
    ▼
[浏览器 KeyboardEvent]
    │
    ▼
[KeybindingService] → 检查是否匹配快捷键
    │ (不是快捷键)
    ▼
[TextAreaHandler] → 通过隐藏 <textarea> 获取输入
    │              (处理 IME、粘贴、组合键)
    ▼
[Cursor Controller] → 计算新光标位置
    │
    ▼
[Edit Operation] → 修改 Piece Tree
    │
    ▼
[ViewEvent] → 通知视图层更新
    │
    ▼
[ViewLines] → 重绘受影响的行
```

### 为什么用隐藏 textarea？

- 获得浏览器原生 IME 支持 (中文输入法)
- 获得系统级剪贴板交互
- 获得 accessibility 支持 (屏幕阅读器)

## Minimap (缩略图)

Minimap 不是缩小的真实渲染，而是用 Canvas 绘制的**字符级像素图**：

```
每个字符 → 1-2 个像素
每行 → 一条细线
语法颜色保留
```

性能：用 `OffscreenCanvas` + `ImageData` 直接写像素，比 DOM 快几个数量级。

## 编辑器贡献点 (Editor Contributions)

Monaco 的功能也是插件化的：

```typescript
// vs/editor/contrib/suggest/browser/suggestController.ts
class SuggestController extends Disposable implements IEditorContribution {
  static readonly ID = 'editor.contrib.suggestController';
  
  constructor(editor: ICodeEditor, @ISuggestService suggestService: ISuggestService) {
    // 注册到编辑器
  }
}

// 注册
registerEditorContribution(SuggestController.ID, SuggestController, EditorContributionInstantiation.BeforeFirstInteraction);
```

内置的编辑器 contrib:
- `find` — 查找替换
- `suggest` — 自动补全
- `hover` — 悬停提示
- `folding` — 代码折叠
- `wordHighlighter` — 相同词高亮
- `bracketMatching` — 括号匹配
- `rename` — 重命名
- `goToDefinition` — 跳转定义
- `parameterHints` — 参数提示

## 小结

| 设计决策 | 第一性原理 |
|---------|-----------|
| Piece Tree | 只记录变更描述而非复制整个文本 — O(log n) 编辑 |
| 虚拟渲染 | 只画看得见的 — 文件大小与渲染性能解耦 |
| 增量 Token 化 | 只重算变化的行 — 编辑不触发全文着色 |
| ViewModel 映射 | 逻辑模型 vs 视觉模型分离 — 折叠/换行不改数据 |
| 隐藏 textarea | 复用浏览器原生能力 — IME/剪贴板/a11y 免费获得 |
| Editor Contribution | 编辑器本身也插件化 — 功能正交可独立开发 |
