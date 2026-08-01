# 交接文档：quickapp-toolkit 与 quickapp-runtime-js 文档编写

本文档用于新会话接续编写 `quickapp-toolkit` 和 `quickapp-runtime-js` 的 spec 文档。

## 目录

- [当前进度](#当前进度)
- [密度标准](#密度标准)
- [已确定的技术决策](#已确定的技术决策)
- [待验证风险点](#待验证风险点)
- [剩余工作清单](#剩余工作清单)
- [新会话启动指令](#新会话启动指令)

---

## 当前进度

### quickapp-toolkit

```text
quickapp-toolkit/spec/
├── requirements.md   ✅ 187 行，9 个需求
├── design.md         ✅ 830 行
├── tasks.md          ✅ 647 行，4 Phase / 14 Task
└── steps/
    ├── 01-cli-skeleton.md          ✅ 1046 行
    ├── 02-sfc-parser.md            ✅  826 行
    ├── 03-manifest-processor.md    ✅ 1097 行
    ├── 04-serializer.md            ✅  800 行
    ├── 05-template-compiler.md     ✅ 1254 行
    ├── 06-style-compiler.md        ✅ 1151 行
    ├── 07-script-compiler.md       ✅ 1057 行
    ├── 08-bundle-assembler.md      ✅ 1367 行
    ├── 09-rpk-packager.md          ✅ 1836 行
    ├── 10-release-minify.md        ✅ 1538 行
    ├── 11-runtime-contract-verify.md  ✅ 1146 行
    ├── 12-watch-incremental.md        ✅ 2265 行
    ├── 13-init-template.md            ✅ 1624 行
    └── 14-diagnostics.md              ✅ 1686 行
```

**quickapp-toolkit 全部完成，共 20358 行。**

遗留两项（都依赖 Runtime 进度，不阻塞 runtime-js 文档编写）：

```text
1. Step 11 的三处待填结论 —— 需 Android Runtime 就绪后实测
   11.3.6 interop 层数、11.7.3 风险 2/3 结论、11.8.2 验收结论表
2. _meta.ruleDef 技术债 —— 等 Runtime 支持选择器优先级时补
```

已完成的收尾核验：
- 14 个 step 的章节完整性（目标/技术决策/QA/下一步）
- tasks.md 的 14 个 Task 与 steps 文件一一对应，无悬空引用
- 需求覆盖矩阵覆盖全部 9 个需求
- 禁用词清零（曾在 design.md / tasks.md / steps 07-09 残留 8 处「宿主」，已替换）
- Step 13 模板 README 补上 `--strict` 说明

**Step 11 留了两处待填占位**（验收执行时补齐）：
- 11.3.6 风险 1 实测结论
- 11.7.3 风险 2、3 验证结果
- 11.8.2 实测结论表

### quickapp-runtime-js

完全未开始。目录 `quickapp-runtime-js/` 存在但为空。

---

## 密度标准

以 `quickapp-runtime-android/spec/steps/02-platform-bridge-jni.md` 和已完成的
toolkit steps 为基准。每个 step 必须包含：

```text
1. 目录（锚点链接）
2. 目标：一句话结论 + 职责表格 + 验收标准 + 本步不包含
3. 分小节实操步骤（Step N.1、N.2...）
4. 完整可粘贴代码块，带 @add / @update 标注
5. 单元测试（完整测试文件）
6. 逐层验证（编译命令 + 预期输出 + 常见错误排查表）
7. 技术决策（每条说明"为什么这样做"和"代价是什么"）
8. QA（预判读者疑问，回答要有实质内容）
9. 下一步
```

单个 step 约 800-1800 行。

### 代码变更标注规范

```text
@add <路径>（新建文件）
@add <路径> — 在 <位置描述> 后插入
@update <路径> — 替换 <位置描述>
@update <路径>（整个替换）
```

### 注释要求

- 函数必须有 `@param` 说明每个参数含义、单位、取值范围；`@return` 说明返回值语义
- 类必须说明职责、线程所有权、生命周期、与其他类的协作
- 注释说明"为什么"，不重复"是什么"
- 关键决策点注释解释权衡

### 术语规范

- 用通用技术概念，不自创术语
- 不用「能力合同」「第一性」「宿主」等自定义词汇
- 容器 > 宿主；接口 > 能力；说明/解释 > 第一性解释
- 三条通道严格区分，不能混写：
  - JS Bridge：JS ↔ C++，QuickJS C API 直调
  - PlatformBridge：C++ → Platform，渲染命令
  - PlatformEventSink：Platform → C++，事件

---

## 已确定的技术决策

这些决策贯穿 toolkit 全部文档，后续 steps 必须与之一致。

### 依赖选型

```text
htmlparser2 9.1.0    模板 XML 解析（xmlMode: true, lowerCaseAttributeNames: false）
postcss 8.4.38       样式 CSS 解析
@babel/core 7.24.5   脚本 AST 转换
terser 5.31.0        release 压缩
zlib（Node 内置）     ZIP DEFLATE
```

版本全部固定，不用 `^`。ZIP 写入手写，不用 archiver。

### 编译管线核心决策

| 决策 | 内容 |
|---|---|
| 页面列表来源 | manifest.router.pages 驱动，不做目录遍历 |
| 模板产物 | JSON 树代码字符串，插值编译为 `function () { return this.x }`（非箭头函数） |
| 静态属性 | 保持字符串，不统一包装成函数 |
| 样式选择器 | 原样作为 key，不解析语义、不计算优先级 |
| 样式属性值 | 保留原始字符串（`"40px"` 不转数字） |
| 脚本转换 | Babel AST，不用正则；不做 ES5 降级 |
| require 改写 | 检查作用域绑定（`hasBinding('require', { noGlobals: true })`） |
| Bundle 格式 | 最小 webpack runtime（约 10 行），模块 ID 用字符串 |
| 组件名 | 页面 `@app-component/index`，应用 `@app-application/app` |
| ZIP 时间戳 | 固定 1980-01-01，保证可复现构建 |
| build.txt 时间 | `new Date(0)`，hash 行排序 |
| 原子写入 | 临时文件 + rename |
| 压缩约束 | **绝不开启 `mangle.properties`**；reserve 三个宿主函数名 |

### 不生成的内容

```text
META-INF/CERT     V1 不签名，Runtime 侧也跳过校验
sitemap.json      SEO 用，Runtime 不读
sourcemap         RPK 格式不含，内联会让体积翻倍
_meta.ruleDef     官方产物有，当前 Runtime 不读（已记录为技术债）
```

### V1 明确不支持

```text
自定义组件 <import>
指令 for / if / show
Less / Sass 预处理
@media 等 at-rule（跳过并 warning）
CSS Nesting（跳过并 warning）
npm 第三方依赖打包
TypeScript 编译
Widget / Card 编译
```

### 产物格式契约（与 Runtime 的接口）

页面 bundle 结构见 `quickapp-toolkit/spec/design.md` 的「Bundle 产物格式」章节。
六个硬约束：

```text
1. IIFE 包裹，window 未定义时直接执行
2. 组件名固定
3. $app_define$ 先于 $app_bootstrap$，同步顺序
4. exports.template 是 JSON 树对象
5. exports.style 是选择器映射对象
6. exports.__esModule 必须存在（工厂据此取 exports.default）
```

---

## 待验证风险点

### 风险 1：`_interopRequireDefault` 多包一层（高优先级）

**问题：** Babel 的 `modules-commonjs` 插件会为 `import x from 'm'` 生成
`_interopRequireDefault($app_require$('m'))`：

```javascript
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
```

Runtime 侧 `js_bridge.cpp` 的 `native_app_require` 返回的是：

```cpp
JSValue wrapper = JS_NewObject(ctx);
JS_SetPropertyStr(ctx, wrapper, "default", obj);
return wrapper;   // { default: {...} }，无 __esModule 标记
```

因为没有 `__esModule`，interop 会再包一层，导致
`router.push` 变成 `_m.default.default.push` —— 多一层，运行时报
「Cannot read property 'push' of undefined」。

**官方产物的对照：** 官方 debug 产物里是 `_system.default.push`（一层），
说明官方工具链配置了 `noInterop` 或用了不同策略。

**两种解法：**

```text
A. Runtime 侧：native_app_require 返回的 wrapper 加 __esModule: true
   改一行，且让 $app_require$ 的返回值语义明确（「我返回 ES module 形状」）
B. toolkit 侧：Babel 配置 noInterop: true
```

倾向 A。**Step 11 必须实测确认，并在文档中记录最终结论。**

诊断命令：

```bash
node -e "
const { compileScriptBody } = require('./dist/compiler/script-compiler.js');
console.log(compileScriptBody(\"import r from 'm';\nr.push();\", '/x.ux', 2));
"
```

输出里若是 `_m.default.default.push()` 则问题存在。

### 风险 2：Runtime 只匹配单 class 选择器

`style_resolver.cpp` 当前实现：

```cpp
for (const auto& cls : root->classList) {
    std::string selector = "." + cls;
    auto it = styleSheet.find(selector);   // 精确匹配单 class
    ...
}
```

后代选择器 `.wrapper .title` 的 key 不会被匹配到，样式静默不生效。

这是 Runtime 侧的已知限制，不是 toolkit 问题。toolkit 忠实产出所有选择器，
Runtime 逐步补全。Step 11 验证时如果发现 `.title` 的样式没生效，是这个原因。

### 风险 3：`$app_define$` 的 factory 执行时机

toolkit 的单测 mock 里是「define 时立即执行 factory」。真实 framework.js
可能延迟到 `$app_bootstrap$` 时才执行。

这个差异不影响产物正确性（无论何时执行行为都一样），但 Step 11 用真实
framework.js 验证时应确认实际时序，并在文档中记录。

---

## 剩余工作清单

### 已完成部分的补充说明

**Step 10 的两处注释已修正**（子代理产出后发现的不一致）：
- `keep_fnames: false` 的注释原先写「保留它让堆栈可读」，与取值矛盾，已改为说明压缩是安全的理由
- `unsafe_arrows` 的理由原先写「破坏模板函数属性的 this 绑定」，表述过宽（模板插值函数体内有 this，不受影响），已改为说明真实风险在空的生命周期钩子上

**术语「宿主」已从 Step 10 全部移除**（4 处），改用「注入的全局函数」。写新文档时注意不要引入。

**Step 11 依赖 Android Runtime 的推进进度。** 完整验收需要 Android 侧完成到 Task 3.5。在此之前可分阶段部分验收，对应表见 Step 11 的 QA 第一问。风险 1 的实测只需 Android Task 1.5 完成，应优先做——它的结论会反向影响 toolkit 的 Step 7 和 Step 10。

### toolkit Step 10 补完（已完成，保留供参考）

在 `10-release-minify.md` 末尾追加：

```text
Step 10.4：单元测试
  - reserved 标识符保留验证（$app_define$ / $app_bootstrap$ / $app_require$）
  - 属性名未被压缩验证（template / style / private / __esModule / type / attr /
    classList / events / children）
  - 压缩前后 exports 结构与行为等价（Property 5）
  - 模板函数属性压缩后仍能 .call(vm) 求值
  - 体积降幅 > 60%
  - verifyMinified 在缺少标识符时抛错
  - 非法 JS 输入时 Terser 报错并转为 PackageError

Step 10.5：逐层验证
  - npm install terser@5.31.0
  - 压缩产物人工检视（确认三个宿主函数名原样）
  - 在 Node 中执行压缩产物，模拟 Runtime 注入，验证行为
  - debug / release 产物 eval 结果对照
  - 体积对比表（与官方 18KB release 对照）
  - 故意开启 mangle.properties 验证 verifyMinified 能拦住

技术决策
  - 组装后压缩而非组装内压缩
  - 绝不开启属性名压缩（最重要）
  - reserve 三个宿主函数名
  - unsafe_arrows: false（会破坏函数属性的 this 绑定）
  - drop_console: false（Runtime 的 console 是注入的原生函数）
  - ascii_only: false（中文转义会让体积增大 3 倍）
  - passes: 2（收益递减点）
  - verifyMinified 防御性检查的价值

QA
  - 为什么 keep_fnames: false 是安全的
  - Terser 异步 API 与同步管线的接入方式
  - 压缩后调试困难怎么办
  - 为什么不做混淆
```

### toolkit Steps 11-14

| Step | 内容 | 对应 Task | 要点 |
|---|---|---|---|
| 11 | Runtime 契约验收 | Task 4.1 | **硬性验收点**；必须实测风险 1；与官方产物结构对照；11 项验收清单 |
| 12 | Watch 增量编译 | Task 4.2 | 页面粒度增量；manifest 变更触发全量；产物字节一致性（Property 6） |
| 13 | init 项目模板 | Task 4.3 | 模板必须一次 build 成功且能渲染；目录冲突检测 |
| 14 | 诊断输出与错误定位 | Task 4.4 | 统一格式；行号换算验证（区块相对 → 文件绝对）；错误汇总 |

Step 11 是分水岭：在它通过之前，所有编译器的「正确」都只是单测意义上的。

### quickapp-runtime-js 已独立交接

**runtime-js 的工作已移出本文档，见 `HANDOFF-runtime-js.md`。**

那份文档是自包含的——它把 framework.js 需要知道的 bundle 契约都摘录了出来，不需要读 toolkit 的任何文档。

runtime-js 当前进度：requirements.md 完成（312 行），design.md 写到 Testing Strategy（478 行），steps 未开始。

写 runtime-js 期间产生的一个结论已回填到本项目：Step 11 的风险 3（factory 执行时机）通过阅读 Android 侧真实的 framework.js 确认为「情况 A —— define 时立即执行」，无需实测。

### 以下为原 runtime-js 规划（已迁移，保留供参考）

这个项目负责 `framework.js` —— 运行在 QuickJS 内的 JS 框架层。

**职责边界：**

```text
输入：C++ 注入的 $app_define$ / $app_bootstrap$ / $app_require$ / console
      + RPK 中的 app.js 和页面 bundle
输出：调用 __native_render__(vnodeTree, styleSheet) 通知 C++ 渲染
      + 响应 C++ 的事件回调（dispatchClick -> VM 方法）
```

**核心内容（建议的 requirements 需求划分）：**

```text
需求 1：组件注册（$app_define$ 实现）
需求 2：组件启动（$app_bootstrap$ 实现）
需求 3：系统模块加载（$app_require$ 协作）
需求 4：VM 模型创建（private 数据 + methods 绑定）
需求 5：生命周期调度（onInit / onShow / onReady / onDestroy）
需求 6：模板树遍历与函数属性求值
需求 7：VNode 构建与 __native_render__ 调用
需求 8：事件分发（C++ dispatchClick -> VM 方法调用）
需求 9：页面栈与路由协作（Router 切换时的 VM 生命周期）
需求 10：错误处理与 debug 日志
```

**建议的 steps 划分：**

```text
01-framework-skeleton.md      framework.js 骨架 + 全局注册表 + 构建方式
02-app-define.md              $app_define$ 实现 + 组件注册表
03-app-bootstrap.md           $app_bootstrap$ 实现 + 启动序列
04-vm-model.md                VM 创建、private 数据、methods 绑定、this 语义
05-lifecycle.md               生命周期钩子调度与时机
06-template-traverse.md       模板树遍历 + 函数属性求值（.call(vm)）
07-vnode-build.md             VNode 构建 + __native_render__ 调用
08-event-dispatch.md          事件分发 + C++ 回调入口
09-system-modules.md          $app_require$ 与 system.router / system.prompt 协作
10-page-lifecycle-router.md   路由切换时的 VM 创建销毁
11-error-logging.md           错误捕获 + debug 日志分级
12-integration-verify.md      与 Android Runtime 的集成验收
```

**关键参考：**

- Android `design.md` 的「JS Framework」章节有 framework.js 的核心逻辑示例
- Android `js_bridge.cpp` 的 `installJSBridge` 定义了可用的注入函数
- `rpk.md` 的「页面 Bundle 结构」说明了 bundle 调用 framework 的方式
- toolkit 的 `design.md`「Bundle 产物格式」是 framework.js 的输入契约

**注意：** framework.js 是纯 JS，运行在 QuickJS 里，不能用 Node API、不能用
DOM API。可用语法为 ES2020。

---

## 新会话启动指令

```text
读取以下文件，然后继续编写文档：

1. #File BBQ/docs/interview/BT/proj/quickapp-kit/HANDOFF-toolkit-js.md
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-toolkit/spec/tasks.md
3. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-toolkit/spec/steps/09-rpk-packager.md
   （作为密度基准，不要读全部 steps 以节省上下文）

任务：按 HANDOFF 的「剩余工作清单」顺序推进。先补完 toolkit Step 10，
再写 Steps 11-14，然后是 quickapp-runtime-js 的 spec 三件套和 steps。

写入策略：新建文件时先写一个小的开头（目录 + 目标），再用 fs_append
分批追加，每批控制在 80-150 行。一次性写入大文件会导致生成被截断。

一个 step 写完后停下来等确认，不要连续写多个 step。
```

### 为什么要限制读取的文件数量

上一个会话在读了 Android 全部 C++ 源码（13 个头文件 + 13 个源文件）、
Android spec 三件套（design.md 有 1475 行）、rpk.md、dev-context.md
之后，又生成了 12500 行文档，导致上下文压力过大，生成频繁被截断。

新会话只需读 HANDOFF + tasks.md + 一个标杆 step。具体的 Runtime 侧实现细节
在需要时再针对性读取单个文件，不要一次性全读。

### 一致性检查清单

新写的文档要与已有文档保持一致，重点核对：

```text
[ ] 术语：不用「宿主」「能力合同」「第一性」
[ ] 三条通道不混写（JS Bridge / PlatformBridge / PlatformEventSink）
[ ] @add / @update 标注格式
[ ] 函数注释有 @param / @return
[ ] 技术决策说明「为什么」和「代价」
[ ] 组件名：@app-component/index 和 @app-application/app
[ ] 函数属性用 function 表达式，不用箭头函数
[ ] 依赖版本号与本文档「依赖选型」一致
[ ] Step 之间的「下一步」指向正确
```
