# TK-S02 Manifest 与 Module Graph

## 目录

- [1. 结论](#1-结论)
- [2. 本质](#2-本质)
- [3. 范围](#3-范围)
- [4. 输入与输出](#4-输入与输出)
- [5. 与 TK-S03 的边界](#5-与-tk-s03-的边界)
- [6. 已验证事实与决策](#6-已验证事实与决策)
- [7. 交付物](#7-交付物)
- [8. 状态](#8-状态)

## 1. 结论

TK-S02 的唯一职责是：**把 Manifest 声明和 S03 发现的源码引用解析为唯一、确定、可诊断的应用关系图。**

```text
Manifest SourceUnit
  -> ResolvedManifest
  -> App/Page 初始入口
  -> S03 ParsedSource + UnresolvedReference
  -> 路径、模块、资源、Capability 解析
  -> ResolvedAppModel + ModuleGraph
```

它回答“应用由什么组成、入口在哪里、每条引用指向谁”，不回答“UX/JS/Less 语法是什么意思”，也不生成 Runtime Artifact。

## 2. 本质

Manifest 是应用组成的权威声明；Module Graph 是从该声明出发、经源码引用闭包得到的可达关系。

因此 V1 不扫描目录猜页面，不把未引用文件自动打包，也不允许页面、资源或 Capability 关系在后续 Emitter 中再次推断。

## 3. 范围

### 3.1 负责

- 严格解析联盟 Manifest V1 字段并保留 JSON Pointer 与源码位置。
- 规范化 package、entry route、page route、component 和 page source path。
- 冻结 App/Page/Shared module identity 与唯一性。
- 解析 S03 输出的相对模块、style、asset 和 `@system.*` 引用。
- 建立有向 Module Graph、检测缺失、越界、重复身份和非法依赖。
- 对 Capability 声明、引用、V1 支持状态和 deferred 状态建立关系。
- 对 Case 001 Widget 输出 `TK_WIDGET_EXCLUDED_V1`，且不让 Widget 进入 V1 图。
- 输出确定排序、不可变、仅供后续编译阶段使用的 `ResolvedAppModel`。

### 3.2 不负责

- UX fragment、Template、JavaScript、CSS/Less 语法解析。
- Host Component、Style、Binding、Block、Event Lowering。
- Template ID、Page IR、JS Bundle、Runtime Metadata、Artifact Descriptor 或 RPK。
- Runtime Capability 可用性、权限执行、Platform Provider 或 Composition 选择。
- Widget/Card Runtime、签名、动态插件或目录全量自动打包。

## 4. 输入与输出

### 4.1 输入

- TK-S01 `WorkspaceContext`、`SourceAccess`、不可变 `SourceUnit`。
- `src/manifest.json`。
- TK-S03 对可达源码返回的 `ParsedSource` 与 `UnresolvedReference`。
- 显式构建限制：最大页面、模块、边和资源数量。

### 4.2 输出

- `ResolvedManifest`：应用身份、入口、页面、声明能力和 V1 排除项。
- `ResolvedAppModel`：App/Page/Shared module、资源与 Capability 关系。
- `ModuleGraph`：规范 node/edge、确定顺序和源码证据。
- 稳定 Diagnostic。

这些都是 Toolkit Build Session 内部模型，不是公共 Artifact Schema，不得直接序列化进 RPK。

## 5. 与 TK-S03 的边界

| 问题 | 唯一所有者 |
|---|---|
| `import`、`require`、Less `@import`、模板资源引用在哪里 | TK-S03 解析为 `UnresolvedReference` |
| 引用最终指向哪个 Workspace 逻辑路径或 Capability | TK-S02 |
| 某文件的 JS/UX/Less 语法是否合法 | TK-S03 |
| 某节点是否从 App/Page 入口可达、是否重复或成环 | TK-S02 |
| 联盟标签如何映射 Host Component | TK-S04 |

S02 通过 S03 的窄 `SourceFrontendPort` 请求解析，不访问 S03 AST 内部实现；S03 不自行解析相对路径或决定模块身份。

## 6. 已验证事实与决策

### 6.1 已验证事实

- Case 001/002 的入口均来自 `manifest.router.entry`，页面源码由 route 与 component 定位。
- Case 001 有两个普通页面、一个 Widget、一个图标资源和 `prompt/router/shortcut/fetch` 声明。
- Case 001 的 App 源码通过 CommonJS/ESM/`require.context` 形成 Shared JS 引用闭包。
- 公共 Artifact 合同已使用 `@quickapp-kit/app` 与 `@quickapp-kit/page/<manifestRoute>` moduleId。

### 6.2 冻结决策

- V1 moduleId：App 固定为 `@quickapp-kit/app`；Page 固定为 `@quickapp-kit/page/<manifestRoute>`；Shared 固定为 `@quickapp-kit/shared/<source-relative-path-without-.js>`。
- Manifest route 保持无前导 `/`；规范 Runtime route 仅做 `/<manifestRoute>`，不做大小写或 Unicode 改写。
- `system.router/prompt/device` 是 V1 typed Capability；`system.fetch` 是 load-only deferred Capability。
- 已声明但未引用的其他 Capability 可被保留为 `declaredOnly`，不得被视为 Runtime 要求；一旦源码引用 V1 未支持 Capability，构建失败。
- Widget 只产生明确 warning 并从 V1 图排除，不解析其源码、不静默打包。

## 7. 交付物

1. [Requirements](./requirements.md)
2. [Design](./design.md)
3. [Tasks](./tasks.md)
4. [Acceptance](./acceptance.md)

## 8. 状态

`READY_FOR_REVIEW`：只完成分 Spec；产品代码仍为 `CODE_BLOCKED`，TK-S04 未启动。
