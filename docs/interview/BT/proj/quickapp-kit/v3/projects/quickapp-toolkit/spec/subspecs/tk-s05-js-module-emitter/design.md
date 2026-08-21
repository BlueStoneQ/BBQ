# TK-S05 Design

## 目录

- [1. 结论](#1-结论)
- [2. 发射管线](#2-发射管线)
- [3. Bundle 形态](#3-bundle-形态)
- [4. Module 与依赖](#4-module-与依赖)
- [5. Definition、Binding 与 Handler](#5-definitionbinding-与-handler)
- [6. Source Map](#6-source-map)
- [7. 错误、预算与原子性](#7-错误预算与原子性)
- [8. 联合一致性](#8-联合一致性)
- [9. 边界](#9-边界)

## 1. 结论

S05 是一个纯函数式后端：

```text
CanonicalLoweredAppModel + EmitterConfig
  -> validate input snapshot
  -> emit module bodies
  -> emit ABI wrapper and bootstrap
  -> emit Source Map v3
  -> validate Definition/export contracts
  -> immutable JsEmissionResult
```

它不拥有新的语义树。所有 Host/target/scope/ID 事实直接引用 S04 的 canonical definition，生成阶段只做代码投影。

## 2. 发射管线

### 2.1 阶段

1. 校验 model version、module identity、dependency closure、Page ID 集和深不可变输入。
2. 按 `app`、canonical moduleId UTF-8、Page manifestRoute UTF-8 的固定顺序建立 emission plan。
3. 为每个 module 生成内部 `ModuleTextBuilder`；所有 temporary state 绑定本次 Build Session。
4. 生成 source program、module reference 和 canonical expression 的 JS 文本。
5. 生成 App/Page Definition export；按 Page ID 生成 evaluator/handler index。
6. 外层写入 define 代码；仅 App/Page 写入 bootstrap 代码，并完成 ABI 校验。
7. 同步生成 Source Map v3、计算 descriptor 输入所需的 byteLength/hash，并冻结结果。

### 2.2 不允许的隐式行为

- 不从 AST 字符串再次 parse 或从 sourcePath 读取文件。
- 不依赖 Map 插入顺序、系统 locale、当前时间、绝对路径或对象地址。
- 不为缺失的 target、method、dependency 或 ID 猜测默认值。
- 不为了“尽量输出”吞掉 unsupported syntax；一次错误使整个 S05 结果失败。

## 3. Bundle 形态

### 3.1 公共 ABI wrapper

App/Page Bundle 使用明确的 ABI helper 注入，语义等价于：

```js
$app_define$("<moduleId>", ["<dependencyId>"], function ($app_require$, module, exports) {
  // deterministic generated module body
  module.exports = {
    schemaVersion: 1,
    kind: "app" | "page",
    createAppVm /* app only */,
    createPageVm /* page only */,
    bindingEvaluators /* page only */,
    handlerMethods /* page only */
  };
});
$app_bootstrap$("<moduleId>", {
  schemaVersion: 1,
  kind: "app" | "page",
  moduleId: "<moduleId>",
  templateId: "page:/..." // page only
});
```

Shared Bundle 的形态只有 define factory，不包含 bootstrap：

```js
$app_define$("<sharedModuleId>", ["<dependencyId>"], function ($app_require$, module, exports) {
  module.exports = /* ordinary shared module value */;
});
```

实际调用参数、全局注入方式和 runtime helper 名称由公共 Module ABI 解释；S05 不把 helper 实现打包进 Bundle。Bundle 中不生成第二套 require registry。

`$app_require$(moduleId)` 只返回已经执行并提交的该 module 的 `module.exports`：App/Page 返回公共 Definition，Shared 返回普通 shared export。它不触发 bootstrap、不创建 VM，也不在缺少已注册 definition 时猜测或回退。

App/Page `module.exports` 是公共 `P0-JS-EXPORT-001` 的 Definition；Definition 必须由对应 `$app_define$` factory 显式写入 `module.exports`，不能只作为 bootstrap 参数或全局变量存在：

```text
App:
  schemaVersion=1, kind="app", createAppVm

Page:
  schemaVersion=1, kind="page", createPageVm,
  bindingEvaluators[decimal TemplateBindingId],
  handlerMethods[decimal TemplateHandlerId]
```

字段使用 own data property；禁止 accessor、Proxy、未知字段和原型注入。Definition 交给 Runtime 前冻结。

### 3.2 路径计划

S05 只产生逻辑 Bundle path，不生成 RPK。V1 默认路径：

| module | path |
|---|---|
| App | `app.js` |
| Shared | `shared/<sha256(moduleId)>.js` |
| Page | `pages/<manifestRoute>/index.js` |

Shared path 使用 moduleId 的 UTF-8 SHA-256 小写值，避免 moduleId 字符导致路径碰撞；任何 path collision 都是错误。Shared Bundle 仍只 define，不 bootstrap。对应 `.map` 作为 JSON Artifact 候选交给后续 Artifact 阶段。

## 4. Module 与依赖

### 4.1 Module reference

S04 的 canonical reference 是唯一输入：

```text
module/context/capability reference
  -> fixed dependency target set
  -> $app_require$(target module id) or typed facade reference
```

普通 import/require 只允许引用 S04 已解析的 target。`$app_require$` 返回 target module 的 `module.exports`；静态 `require.context` 使用 S04 的有序 member table，在构建期展开为直接 `$app_require$(moduleId)`，Bundle 不包含 `$app_require$.context`。S05 不扫描目录、不重算 glob。

联盟 `@system.*` 统一发射为 `@app-module/system.*` typed Capability module reference。它由 Runtime facade resolver 提供，不是包内模块，因此不进入 `$app_define$` dependencies 或 Runtime Metadata dependencies。

### 4.2 ESM/CJS/global

- ESM import/export：转成 ABI module factory 内的 local binding 和 module export 语义，保留 S04 的 dependency order。
- CommonJS require/module.exports：转成 `$app_require$` 与 factory-local `module/exports`，不暴露 Node.js 环境对象。
- 联盟 global 注入：只从已验证 global reference 生成显式 factory parameter/lookup；未声明 global 诊断失败。
- import 与 require 指向同一 canonical target 时复用同一 module identity，不复制 definition。

生成器只实现 S03 feature matrix 覆盖的 AST 形态。语义不确定时返回 `TK_EMIT_JS_UNSUPPORTED`，不退回字符串拼接或运行期解释。

## 5. Definition、Binding 与 Handler

### 5.1 App/Page VM factory

`createAppVm` 和 `createPageVm` 的函数体由 S04 canonical Page/App program 投影，函数只接收对应 Context view，返回普通 VM object。Page `private` 静态字段投影为 VM 根状态；例如 `private.title` 生成根字段 `title`，其 evaluator 读取 `this.title`。VM state/method/lifecycle 只在 factory 调用时创建，不能在 Bundle definition 层共享。

### 5.2 Binding evaluator

每个 canonical Binding 生成一个 callable：

```text
bindingEvaluators["<TemplateBindingId>"] = function(scope) {
  // this = current PageVm; scope = frozen lexical aliases
  return <canonical evaluator expression with frozen coercion>
}
```

`concat`、`displayString`、boolean coercion 和 literal segment 都在编译期固定。S05 不生成 target/property，也不生成 dependency tracking；JS Framework 负责何时调用，Core 负责根据 Page IR 解析目标。

### 5.3 Handler method

`handlerMethods["<TemplateHandlerId>"] = "<methodName>"` 只保存 S04 已验证的 method name。method body 在 Page VM program 中发射一次；两个 Handler 可以指向同一 method name，但各自 ID key 仍独立。

## 6. Source Map

V1 Source Map 采用标准 Source Map v3 的确定性 JSON 投影，至少包含：

```text
version: 3
file: emitted bundle logical path
sources: sorted workspace-relative sourcePath[]
names: sorted emitted identifier names[]
mappings: generated-line segments
```

- `sources` 使用 `/`、UTF-8、workspace-relative path；不含绝对根和 `..`。
- 每个有源码意义的 generated statement/expression/Definition segment 映射到最窄 SourceSpan。
- 不强制嵌入 `sourcesContent`；V1 默认省略，避免重复和泄露。
- 空行、终止换行、segment 顺序、VLQ 编码固定；不存在“按生成器运行顺序随机追加”。
- Source Map 生成失败使 S05 原子失败，不回退成无 map 成功。

Source Map 是调试产物，不进入 Page IR，不改变 Runtime 语义。

## 7. 错误、预算与原子性

### 7.1 错误

稳定诊断至少包括：

| code | 语义 |
|---|---|
| `TK_EMIT_INPUT_INVALID` | Canonical model、版本、ID 或依赖不一致 |
| `TK_EMIT_JS_UNSUPPORTED` | 不在已验证 JS/Module feature matrix 的语义 |
| `TK_EMIT_ABI_INVALID` | Definition/bootstrap/export 不能满足公共 ABI |
| `TK_EMIT_SOURCE_MAP_FAILED` | Source Map 无法完成或位置非法 |
| `TK_EMIT_LIMIT_EXCEEDED` | 输出、表达式、Map 或依赖预算超限 |
| `TK_EMIT_CANCELLED` | 收到取消且未发布结果 |

### 7.2 资源与失败边界

统一累计限制覆盖 Bundle bytes、generated nodes、expression nodes、module dependencies、Source Map sources/segments、待处理 module queue 和 diagnostics。每个阶段检查取消。所有 Bundle/Map 先写 session-owned staging，全部成功并通过 ABI 验证后才发布 immutable result；失败只返回 Diagnostic，不返回部分 map/bundle。

## 8. 联合一致性

S05 单独不读取 S06，但必须输出足够事实供后续联合检查：

```text
page.moduleId == bootstrap.moduleId
page.templateId == bootstrap.templateId
bindingEvaluatorIds == canonical page binding IDs
handlerMethodIds == canonical page handler IDs
```

TK-S07 或联合测试比较 S05/S06 投影；S05 不自行复制 Page IR target 以“验证”这些事实。

## 9. 边界

S05 的输出是 JS Bundle/Map，不是最终 RPK。Runtime Metadata、Artifact Descriptor、ZIP layout、hash index、签名和 Loader admission 均属于 TK-S07/Core，不得提前实现。
