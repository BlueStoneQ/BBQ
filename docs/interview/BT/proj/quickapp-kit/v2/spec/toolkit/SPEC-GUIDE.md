# QuickApp Toolkit Spec 编写与实施指导

> 用途：交给 Kiro 编写 quickapp-toolkit 的正式 Spec，并据此实施代码。  
> 文档性质：上游需求与架构约束，不替代最终 Spec。  
> 代码目录：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit`  
> Case 001：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test1`

## 目录

- [1. 结论](#1-结论)
- [2. 第一性目标](#2-第一性目标)
- [3. 已冻结架构](#3-已冻结架构)
- [4. 输入与输出](#4-输入与输出)
- [5. 编译管线](#5-编译管线)
- [6. IR 与 Runtime ABI](#6-ir-与-runtime-abi)
- [7. JS Bundle 与页面加载](#7-js-bundle-与页面加载)
- [8. RPK 与 Package Contract](#8-rpk-与-package-contract)
- [9. CLI 需求](#9-cli-需求)
- [10. 工程架构约束](#10-工程架构约束)
- [11. 正式 Spec 交付物](#11-正式-spec-交付物)
- [12. 实施顺序](#12-实施顺序)
- [13. V1 范围](#13-v1-范围)
- [14. 不做事项](#14-不做事项)
- [15. 验收标准](#15-验收标准)
- [16. 测试与可观测性](#16-测试与可观测性)
- [17. 关键决策与待确认项](#17-关键决策与待确认项)
- [18. Kiro 执行要求](#18-kiro-执行要求)
- [19. 必读资料](#19-必读资料)

## 1. 结论

**一句话本质：QuickApp Toolkit 是联盟 DSL 到 QuickApp Kit Runtime ABI 的编译器，负责把源码中的静态事实编译为 C++ 可消费的 IR，把必须依赖 JS 语义的逻辑编译为 JS Bundle，并封装为可验证的 RPK。**

V1 主链：

```text
联盟 DSL / JS / Style / Manifest / Assets
  -> Alliance Frontend Adapter
  -> Normalized IR
  -> Template / Binding / Block / Handler / Style IR
  -> App / Shared / Page JS Bundle
  -> Package Validate
  -> Sign / RPK
```

Toolkit 的成功标准不是“能生成文件”，而是：

> Case 001 经 QuickApp Toolkit 构建后，能够被 QuickApp Kit Runtime 加载，并跑通首屏、状态更新、页面跳转和点击事件闭环。

## 2. 第一性目标

Toolkit 必须同时满足：

1. **联盟源码语义兼容**：不重新发明 DSL、组件、生命周期和 Feature API。
2. **Runtime ABI 自主**：不继承 HAP 的 JS DOM Action、JSON Bridge 和 Android 专用内部结构。
3. **静态事实前移**：模板、Binding Target、Block、Handler 和 Style 尽量在构建期确定。
4. **完整 JS 语义保留**：复杂合法 Binding 仍在 JS 中求值，不能因优化限制应用写法。
5. **页面按需加载**：页面是加载与生命周期边界，模块是共享与缓存边界。
6. **产物可验证**：每个 IR、Bundle 和 Package 都有 Schema、版本、诊断和 Golden Test。
7. **性能可测量**：记录构建时间、产物体积、重复模块、IR 大小及解析成本。

## 3. 已冻结架构

### 3.1 Runtime 分工

```text
JS Framework
  State / Props / Binding / Block / Handler / Lifecycle
  -> RenderTransaction

C++ Runtime Core
  唯一权威 Runtime Tree / Style / Yoga / Commit
  -> MountTransaction

Platform Backend
  Host Objects / Mount / Input
  -> EventMessage
```

Toolkit 必须生成上述三层能够共同消费的静态合同，不能在产物中重新引入完整 JS VNode Tree。

### 3.2 树模型

```text
JS：无完整 VNode Tree
C++：唯一权威 Runtime Tree
Platform：Host Tree，仅为平台物化结果
```

### 3.3 更新模型

```text
this.xxx = value
  -> Reactive Setter
  -> Dirty Binding
  -> microtask 批量求值
  -> Binding 结果变化
  -> RenderTransaction
```

Toolkit 的职责是建立：

```text
StatePath -> Binding
Binding -> RenderTarget
Template/Block Definition -> Runtime 实例化入口
```

### 3.4 V1 不采用 C++ Binding VM

V1 的 Binding 在 JS 中求值。C++ Binding VM 仅是未来由 Benchmark 驱动的透明快路径，不得进入 V1 必选链路。

## 4. 输入与输出

### 4.1 输入

V1 输入：

```text
src/
├── manifest.json
├── app.ux
├── pages/**/*.ux
├── components/**/*.ux
├── **/*.js
├── **/*.less / *.css
└── assets/**
```

联盟 `.ux` 包含：

```text
template
script
style
```

### 4.2 输出

逻辑产物：

```text
manifest.json
app.js
shared.js                         # 存在公共模块时
pages/<route>/index.js
quickapp-kit/runtime-meta.json
quickapp-kit/pages/<route>/template.ir.json
quickapp-kit/pages/<route>/bindings.ir.json
quickapp-kit/pages/<route>/blocks.ir.json
quickapp-kit/pages/<route>/handlers.ir.json
quickapp-kit/pages/<route>/styles.ir.json
assets/**
META-INF/**
```

最终产物：

```text
<package>.debug.rpk
<package>.release.rpk
```

RPK 内部文件名属于 Package Contract，最终 Spec 可以调整，但必须保持职责和索引关系。

## 5. 编译管线

正式 Spec 必须定义以下阶段及每一阶段输入输出：

```text
1. Discover
   -> 读取配置、Manifest、入口和文件图

2. Parse
   -> 解析 .ux / JS / Style / Manifest

3. Normalize
   -> 联盟 AST 转换为平台无关 Normalized IR

4. Analyze
   -> 组件图、模块图、StatePath、Binding、Block、Handler、Style 依赖

5. Lower
   -> 生成 Runtime Template/Binding/Block/Handler/Style IR

6. Bundle
   -> 生成 App / Shared / Page JS Bundle

7. Link
   -> 分配 ID、解析跨文件引用、生成 Runtime Metadata 和索引

8. Validate
   -> Schema、引用完整性、路由、Feature、资源和版本校验

9. Package
   -> 写入目录、资源、Manifest 和构建元数据

10. Sign
   -> 生成 debug/release RPK
```

每个阶段必须：

- 输入输出有明确类型；
- 不直接依赖后续阶段内部结构；
- 产生可定位到源码的诊断；
- 可独立单测；
- 支持 Trace 构建耗时。

## 6. IR 与 Runtime ABI

### 6.1 Normalized IR

Normalized IR 是联盟前端与 QuickApp Kit 后端之间的隔离层：

```text
Alliance AST
  -> AllianceFrontendAdapter
  -> Normalized IR
  -> Runtime Lowering
```

要求：

1. 不把 `hap-compiler` AST 直接暴露给 Lowering。
2. 不包含 Android、iOS、LVGL 类型。
3. 保存 Source Location。
4. 能表达组件、属性、Binding、事件、条件、列表和 Style。

### 6.2 Template IR

最小语义：

```json
{
  "nodes": [
    {
      "templateNodeId": 1,
      "type": "div",
      "children": [2]
    },
    {
      "templateNodeId": 2,
      "type": "text",
      "props": {
        "value": { "bindingId": 1 }
      }
    }
  ]
}
```

Template IR 是不可变静态定义，不是运行时 VNode Tree。

### 6.3 Binding Metadata

最小语义：

```json
{
  "bindingId": 1,
  "dependencies": ["title"],
  "target": {
    "templateNodeId": 2,
    "kind": "prop",
    "name": "value"
  },
  "evaluator": {
    "module": "pages/Demo/index.js",
    "export": "binding_1"
  }
}
```

要求：

- Runtime 能从 StatePath 找到 Dirty Binding；
- JS 能调用对应 evaluator；
- evaluator 结果未变化时不生成 Intent；
- 不能把任意 JS 表达式强制翻译成 C++ 表达式。

### 6.4 Block Metadata

V1 至少支持：

```text
if Block
keyed for Block
```

必须区分：

```text
TemplateBlockId：编译期 Block 定义
BlockInstanceId：运行时 Block 实例
```

Block Contract 必须定义 Insert、Remove、Move、Key、生命周期和 NodeId 映射。

### 6.5 Handler Metadata

必须建立：

```text
TemplateNodeId + EventType
  -> TemplateHandlerId / Handler Definition
  -> 运行时 HandlerId
```

业务函数保存在 JS Framework；C++ 只保存 EventBinding；Platform 只安装本地监听器。

### 6.6 Style IR

要求：

- 保留联盟 Style 语义；
- 输出 Core Style Resolver 可消费的规范化属性；
- 区分静态 Style 与动态 Binding；
- 保留选择器、继承和单位转换所需信息；
- 不生成平台专用 View 属性。

### 6.7 Schema 与版本

所有 Runtime IR 必须包含：

```text
schemaVersion
producerVersion
source identity
stable ID/reference
optional debug source map
```

V1 先使用 JSON IR；结构稳定并完成 Benchmark 后再评估二进制格式。

## 7. JS Bundle 与页面加载

### 7.1 冻结原则

> 页面是加载与生命周期单位，模块是共享与缓存单位。

V1 保留每页独立入口：

```text
app.js
pages/<route>/index.js
```

页面跳转时，在同一个 App JS Runtime 中加载并执行目标页面入口，不为每个页面创建新的 JS Runtime。

### 7.2 公共依赖

不固定沿用联盟默认的页面依赖冗余模式。

V1 Module Graph 至少支持：

```text
App Chunk：应用启动依赖
Shared Chunk：多个页面共享依赖
Page Chunk：页面私有依赖
```

应用级 ModuleRegistry 保证公共模块在同一 App JS Runtime 中只执行一次。

### 7.3 加载索引

Runtime Metadata 必须能回答：

```text
Route -> Page Entry
Page Entry -> Required Chunks
Page Entry -> Required IR Files
ModuleId -> Chunk
```

具体 Shared Chunk 提取阈值由 Benchmark 决定，不在需求阶段硬编码。

## 8. RPK 与 Package Contract

V1 边界：

```text
联盟源码兼容
+ RPK 外层结构兼容
+ QuickApp Kit Runtime ABI 自有
```

必须保持：

- Manifest、路由、资源和签名容器的联盟语义；
- debug/release 构建模式；
- 可 inspect 的 ZIP/RPK 结构；
- Package 与 IR Schema 版本；
- 构建器版本和可复现元数据。

V1 不保证直接运行联盟已经构建完成的 Legacy RPK；联盟应用源码必须经 QuickApp Toolkit 重新构建。

## 9. CLI 需求

Toolkit 采用 CLI-first，CLI 是未来 VS Code 插件的稳定内核。

建议 V1 命令：

```text
quickapp build [project]
quickapp validate <project|rpk>
quickapp inspect <project|rpk>
quickapp run [project|rpk]
quickapp clean [project]
```

命令语义：

| 命令 | 职责 |
|---|---|
| `build` | 编译、校验、Bundle、Package 和签名 |
| `validate` | 校验源码配置、IR 引用和 Package Contract |
| `inspect` | 输出 Manifest、页面、Chunk、IR、Feature 和体积信息 |
| `run` | 构建后调用指定 Runtime/Simulator；运行能力由 Runtime 项目提供 |
| `clean` | 清理 Toolkit 自己管理的构建产物和缓存 |

CLI 必须支持：

```text
--mode debug|release
--target lvgl|android|ios
--output <path>
--json
--trace
--no-cache
```

最终参数名由 CLI Spec 固定。

## 10. 工程架构约束

V1 技术基线：

| 部件 | 选型 |
|---|---|
| 语言 | TypeScript / Node.js |
| CLI | 轻量命令框架，具体库由 Spec 评估 |
| `.ux` 前端 | 通过 Adapter 复用或提取 `hap-compiler` |
| JS AST | Babel Parser / Traverse / Generator |
| Bundle | esbuild |
| Style AST | PostCSS + 联盟样式规则 |
| Schema | JSON Schema 或等价的结构化校验方案 |
| 测试 | 单元、Golden、Contract、端到端、差分测试 |

推荐模块边界：

```text
src/
├── cli/
├── config/
├── frontend/alliance/
├── ir/normalized/
├── analyze/
├── lower/
│   ├── template/
│   ├── binding/
│   ├── block/
│   ├── handler/
│   └── style/
├── bundle/
├── link/
├── validate/
├── package/
├── sign/
├── inspect/
├── diagnostics/
└── trace/
```

约束：

1. 不直接修改联盟 Toolkit 源码。
2. `AllianceFrontendAdapter` 隔离联盟实现。
3. Lowering 只依赖 Normalized IR。
4. Package 不理解 AST。
5. CLI 不包含编译业务逻辑，只负责编排服务。
6. 所有文件写入通过统一 Output/FileSystem 抽象，支持测试和缓存。

## 11. 正式 Spec 交付物

Kiro 必须先产出以下文档，再进入对应代码阶段：

```text
spec/toolkit/
├── README.md
├── requirements.md
├── architecture.md
├── compilation-pipeline.md
├── normalized-ir.md
├── template-ir.md
├── binding-metadata.md
├── block-ir.md
├── handler-metadata.md
├── style-ir.md
├── js-bundle-contract.md
├── module-chunk-contract.md
├── package-contract.md
├── cli-contract.md
├── diagnostics.md
├── testing-benchmark.md
├── tasks.md
└── steps/
```

每篇 Spec 必须包含：

```text
结论
目录
目标与非目标
输入输出
数据结构或接口
生命周期/状态机
错误语义
关键决策与取舍
测试矩阵
验收标准
开放问题
```

## 12. 实施顺序

### Phase T0：工程与 Case 001

```text
初始化 TypeScript CLI
-> 配置、日志、诊断、文件系统
-> Case 001 fixture 与 Golden 目录
-> inspect 联盟源码/build/RPK
```

### Phase T1：Frontend 与 Normalized IR

```text
Manifest
-> .ux fragments
-> Template AST
-> Script AST
-> Style AST
-> Normalized IR
```

### Phase T2：最小静态页面

```text
Template IR
-> Style IR
-> Page JS Entry
-> Runtime Metadata
-> 未签名目录产物
```

验收：Case 001 首页静态树可被 C++ Core 构建。

### Phase T3：Binding 与更新

```text
StatePath analysis
-> Binding Metadata
-> JS evaluator
-> RenderTarget
-> RenderTransaction ABI
```

验收：`this.title = value` 只更新目标节点。

### Phase T4：事件

```text
Handler Metadata
-> Handler registration
-> EventBinding
-> EventMessage -> JS Handler
```

验收：点击 Case 001 按钮执行正确 Handler。

### Phase T5：Block

```text
if
-> keyed for
-> Insert / Remove / Move Subtree
```

### Phase T6：Bundle 与 Chunk

```text
App Entry
-> Shared Modules
-> Page Entry
-> Module Registry metadata
```

### Phase T7：Validate / Package / Sign

```text
Schema Validate
-> Reference Validate
-> Package
-> debug/release Sign
-> RPK Inspect
```

### Phase T8：端到端与 Benchmark

```text
Case 001 source
-> quickapp build
-> RPK
-> LVGL SDL Runtime
-> 首屏 / 更新 / 点击 / 路由
```

## 13. V1 范围

V1 必须支持：

- Manifest 与基础路由；
- `app.ux` 和页面 `.ux`；
- 静态 Template；
- 普通属性与文本 Binding；
- `Object.defineProperty + Observer/Watcher` 所需 Binding Metadata；
- `if`；
- 基础 keyed `for`；
- 事件 Handler；
- 基础 Style 与 Yoga 所需属性；
- App/Page 生命周期入口；
- App、Shared、Page Bundle；
- debug/release RPK；
- validate、inspect 和构建 Trace；
- Source Location 与可读诊断。

## 14. 不做事项

V1 不包含：

- 直接兼容联盟已构建 Legacy RPK ABI；
- C++ Binding VM；
- 完整 JS VNode Tree；
- 全量 Tree Diff；
- 全组件和全 Feature API；
- 全量联盟 Toolkit 重写；
- Rust 重写；
- 强制二进制 IR；
- 复杂 Chunk LRU；
- VS Code 插件；
- 云构建服务；
- 所有优化一次完成。

## 15. 验收标准

### 15.1 构建正确性

1. Case 001 可从源码生成目标目录和 RPK。
2. Manifest、页面、资源和入口完整。
3. 所有 IR 通过 Schema 和引用完整性校验。
4. 同一源码输入在固定环境下生成可复现语义产物。

### 15.2 Runtime 闭环

1. 首页能构建 Runtime Tree 和 LVGL Host Tree。
2. Binding 更新不构建完整 VNode Tree。
3. Binding 结果未变化时不产生 Render Intent。
4. 点击事件回到正确 JS Handler。
5. 页面跳转按需加载目标页面入口。
6. 公共模块在同一 App JS Runtime 中只执行一次。

### 15.3 性能基线

至少输出：

```text
总构建时间
各编译阶段耗时
RPK 总体积
App / Shared / Page Bundle 体积
各类 IR 体积
重复模块字节数
Case 001 页面加载文件数
```

性能阈值由 Benchmark Spec 决定，不在 Toolkit Spec 中伪造目标值。

## 16. 测试与可观测性

测试金字塔：

```text
Parser/Normalize/Lower 单元测试
-> IR Schema 与 Contract 测试
-> Golden 文件测试
-> Case 001 端到端构建
-> Runtime 联调
-> 联盟产物语义差分
```

每次构建必须可选输出 Trace：

```json
{
  "phase": "lower.binding",
  "durationMs": 1.2,
  "inputCount": 4,
  "outputCount": 4,
  "cacheHit": false
}
```

诊断必须包含：

```text
错误码
严重级别
文件
行列
源码片段
原因
可执行修复建议
```

## 17. 关键决策与待确认项

### 已冻结

1. Node.js + TypeScript。
2. Adapter 复用联盟 `.ux` 前端能力。
3. 自有 Normalized IR 与 Runtime ABI。
4. V1 JSON IR。
5. JS 求值 Binding，C++ 持有唯一 Runtime Tree。
6. typed RenderTransaction，不走 JSON String Bridge。
7. 页面独立入口，公共模块共享。
8. CLI-first，未来 VS Code 插件复用 CLI 内核。
9. Case 001 是首个 Golden Case。

### 由正式 Spec 决定并标记

1. Normalized IR 最终类型结构。
2. `TemplateBindingId`、`TemplateBlockId` 的正式命名和分配规则。
3. Runtime Metadata 与 Package 索引字段。
4. Shared Chunk 的提取算法和默认策略。
5. debug/release 签名配置来源。
6. CLI 参数、退出码和 JSON 输出格式。
7. 构建缓存 Key 与失效规则。

这些决策形成前，Kiro 必须给出：

```text
目标
-> 本质问题
-> 方案比较
-> 推荐决策
-> 成本与风险
-> 验证方法
```

## 18. Kiro 执行要求

1. 先读完第 19 节资料，不依据记忆重建联盟产物。
2. 先写 Spec，再按 Phase T0-T8 编码。
3. 不修改 `decisions/my-design.md`。
4. 不改变已冻结的 Runtime 分层、单权威 Runtime Tree 和事务边界。
5. 发现文档冲突时，以 `decision-v1.md` 和 `v1-core-architecture-frozen.md` 为准，并报告冲突。
6. 每个关键技术决策必须单独标记并通知项目负责人。
7. 每个阶段必须有可运行测试和可观察输出，不以空接口或目录作为完成。
8. 不一次实现全部联盟语义，围绕 Case 001 建立最小纵向闭环后逐步扩展。
9. 不删除或覆盖工作区内非本任务产生的修改。
10. 代码提交必须能从 Spec 条目追溯到测试和验收标准。

## 19. 必读资料

按顺序阅读：

1. `decisions/decision-v1.md`
2. `decisions/v1-core-architecture-frozen.md`
3. `ARCHITECTURE-HANDOFF-2026-08-14.md`
4. `research/alliance-toolkit-rpk-pipeline.md`
5. `research/alliance-android-runtime-toolkit.md`
6. `projects/quickapp-toolkit/requirements.md`
7. `projects/quickapp-toolkit/arch-design.md`
8. `/Users/qy/code/my-github/quickapp-kit-ai/source/upstream/hap-toolkit`
9. `/Users/qy/code/my-github/quickapp-kit-ai/source/upstream/hapjs`
10. `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test1`

最终输出必须反向引用本指导文档，并明确：

```text
哪些内容直接执行已冻结决策
哪些内容是正式 Spec 新增决策
哪些内容仍待验证
```
