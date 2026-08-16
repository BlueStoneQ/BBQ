# EX-S01 设计

## 目录

- [1. 结论](#1-结论)
- [2. 三层基线](#2-三层基线)
- [3. 基线身份模型](#3-基线身份模型)
- [4. 已验证源码事实](#4-已验证源码事实)
- [5. 已验证参考产物](#5-已验证参考产物)
- [6. DSL 与模块矩阵](#6-dsl-与模块矩阵)
- [7. 场景与断言模型](#7-场景与断言模型)
- [8. 跨平台一致性](#8-跨平台一致性)
- [9. 变更治理](#9-变更治理)
- [10. 待验证项](#10-待验证项)

## 1. 结论

Case 001 的权威内容是“冻结源码身份 + 固定操作 + 公共合同结果”。联盟 build/RPK 证明原样例怎样被联盟 Toolkit 表达，但不约束 QuickApp Kit 复制其内部 JS 结构。

## 2. 三层基线

| 层 | 权威内容 | 作用 | 不代表 |
|---|---|---|---|
| Source Fact | 冻结源码文件与 digest | Toolkit 输入身份 | Runtime Artifact |
| Reference Fact | 联盟 build、RPK、RPKS 字节与结构 | 研究、inspect、语义对照 | QuickApp Kit ABI |
| Runtime Expectation | 操作、可见结果、Lifecycle/Trace | 三平台一致性判定 | 平台实现方式 |

三层独立版本化。Reference Fact 更新不能静默修改 Source Fact 或 Runtime Expectation。

## 3. 基线身份模型

### 3.1 Source snapshot

`CASE-001@1` 的 Source snapshot 文件集合固定为：

```text
package-lock.json
package.json
src/CardDemo/index.ux
src/app.ux
src/assets/images/logo.png
src/assets/styles/mixins.less
src/assets/styles/style.less
src/assets/styles/variables.less
src/helper/ajax.js
src/helper/apis/example.js
src/helper/apis/index.js
src/helper/utils.js
src/manifest.json
src/pages/Demo/index.ux
src/pages/DemoDetail/index.ux
src/sitemap.json
```

计算规则：按上述 UTF-8 相对路径字典序排列；对每个原始文件字节计算小写 SHA-256，形成 `<digest><two spaces><relative-path>\n`；再对完整 UTF-8 清单计算 SHA-256。当前结果为：

```text
aa99ea04873aa3fa22a006b37dada4608b06d903fed90370b117074a3834e78a
```

`node_modules/**`、`build/**`、`dist/**`、`sign/**`、`.ide/**`、格式化/生成辅助脚本和本机预览配置不进入 Source snapshot。它们不是当前 Case 业务与 Toolkit 正式输入；若未来构建实际读取其中任一文件，必须先更新集合并提升 Case version。

### 3.2 Reference identities

| Reference | bytes | SHA-256 |
|---|---:|---|
| debug RPK | 42445 | `889496f65db92262e391b16628d4f29871f40a25aa5f15deaf7b6cb7d7d9ce80` |
| debug RPKS | 50264 | `06e7659f13514d533761128b615b4dfe6a641abcb45b0ad813c09e74f7fc845e` |
| release-development RPK | 17992 | `0923f82af7ceeedc1852e4b06550263a0f8df53e347c2faf789e33979cf585df` |
| release-development RPKS | 45406 | `1e5aa10694b691fcfb5ee929c31beb6c4a1674d952ddc35d200b1937f97694e3` |

Reference identity 是现存字节快照，不承诺重新运行联盟 Toolkit 得到相同容器字节，因为其 metadata 含时间戳和签名差异。

### 3.3 Runtime execution identity

每次正式验收必须记录：

```text
caseId = CASE-001
caseVersion = 1
sourceSnapshotSha256
quickAppKitArtifactSha256
toolkitVersion / sourceRevision
runtimeCompositionProfileId
platform / device / buildMode
runId
```

三平台对比必须使用同一个 `quickAppKitArtifactSha256`。

## 4. 已验证源码事实

### 4.1 Manifest 与路由

- `[已验证事实]` package 为 `com.example.case1`，版本为 `1.0.0/1`，最低平台版本为 `1070`。
- `[已验证事实]` entry 是 `pages/Demo`；普通页面只有 Demo 和 DemoDetail。
- `[已验证事实]` 声明 `system.prompt`、`system.router`、`system.shortcut`、`system.fetch`。
- `[已验证事实]` Manifest 还声明 CardDemo Widget；Widget/Card Runtime 不属于 V1 Case 001。

### 4.2 App 与页面行为

- `[已验证事实]` `app.ux` 把 `$utils`、`$apis` 注入 global，并定义空 `onCreate`。
- `[已验证事实]` Demo 的 `onInit` 调用 `setTitleBar`，并在方法存在时调用 `setMeta`。
- `[已验证事实]` Demo 显示 `欢迎体验快应用开发` 和按钮 `跳转到详情页`；click 执行 `router.push('/pages/DemoDetail')`。
- `[已验证事实]` DemoDetail 显示标题 `快应用是什么？`、两段说明和按钮 `欢迎使用`；click 通过 `$utils` 调用 `prompt.showToast`，消息为 `快应用：复杂生活的简单答案，让生活更顺畅`。
- `[已验证事实]` 源码未声明页面 `onReady/onShow/onHide/onDestroy`；Framework 仍必须按公共生命周期合同建立和推进这些阶段，缺少用户 Hook 时按成功 no-op 处理。

## 5. 已验证参考产物

### 5.1 联盟 build JS

- `[已验证事实]` `build/app.js` 使用 `$app_define$("@app-application/app", ...)` 和 `$app_bootstrap$`；它内联 App VM、Manifest、全局 style，并通过 `$app_require$` 引用 `system.prompt` 与 `system.fetch`。
- `[已验证事实]` 每个页面 `index.js` 是独立 Bundle，使用 `$app_define$("@app-component/index", ...)` 和 `$app_bootstrap$`；Bundle 同时携带 VM、template object 和 style object。
- `[已验证事实]` Demo template 是 `div -> text + input`，动态 text 以函数读取 `this.title`，input click 指向 `onDetailBtnClick`。
- `[已验证事实]` DemoDetail template 是 `div -> text + text + text + input`，动态标题读取 `this.text`，input click 指向 `onWelcomeBtnClick`。

联盟两个页面在各自 Bundle 中使用相同模块名，是联盟独立页面加载上下文的参考事实。QuickApp Kit 必须遵守自己的 Artifact Contract 全局 moduleId、Page IR 和 JS Module ABI，不复制这一内部命名策略。

### 5.2 RPK/RPKS

- `[已验证事实]` 两个 RPK 都是 ZIP，含 Manifest、`app.js`、两个页面 Bundle、CardDemo、logo、sitemap、`META-INF/CERT` 和 build metadata；不含 QuickApp Kit Page IR/Runtime Metadata。
- `[已验证事实]` debug RPK 的 JS 未压缩且 Manifest `config.debug=true`；release-development RPK 的 JS 压缩且 `config.debug=false`。
- `[已验证事实]` build metadata 记录联盟 Toolkit `2.1.0`、Node `v22.17.0`、darwin/arm64 与构建时间。
- `[已验证事实]` RPKS 是分包 ZIP：debug 含 base srpk 与 CardDemo rpk；release-development 另含完整 app rpk。
- `[验收断言]` 联盟 RPK/RPKS 不由 Core 直接执行；缺少 `quickapp-kit/runtime.json` 时按 Artifact Contract 在执行 JS 前拒绝。

## 6. DSL 与模块矩阵

| 类别 | Case 001 实际使用 | 验收范围 |
|---|---|---|
| DSL | `.ux` 的 template/script/style，单根 template，Less import/mixin/变量 | 必须编译 |
| Host Component | `div`、`text`、`input[type=button]` | 必须显示和点击 |
| Binding | `text.value <- title/text` | 只验证初始值，不验证更新 |
| Event | `onclick` -> 两个页面方法 | 只验证 click，一次输入对应一次 Handler |
| Style/Layout | flex column/center、width/height、margin、font size、color、background、radius、text align | 逻辑语义一致；不要求像素一致 |
| Router | `system.router.push` | Demo -> DemoDetail |
| Prompt | `system.prompt.showToast` | Detail 按钮消息一致 |
| Page Control | `setTitleBar`、可选源码调用 `setMeta` | typed control；支持时结果一致，不支持须按冻结合同返回明确结果 |
| Fetch | App import 链加载 `system.fetch`，业务不调用 | deferred facade 可解析，禁止网络请求 |
| Shortcut | 仅 Manifest 声明 | 不构成调用覆盖 |
| Widget | CardDemo 声明与源码 | V1 排除，不运行 |

## 7. 场景与断言模型

### 7.1 固定场景

| Step | 操作 | 可见结果 |
|---|---|---|
| S1 | 启动 Case 001 root | Demo 可见；标题与跳转按钮文本正确；title bar 更新 |
| S2 | 点击 `跳转到详情页` 一次 | DemoDetail 可见；标题、两段说明、欢迎按钮正确；Demo 隐藏 |
| S3 | 点击 `欢迎使用` 一次 | 产生一次内容完全匹配的 Toast；页面不跳转 |
| S4 | 发出平台 back 一次 | Detail 关闭并销毁；Demo 恢复可见 |
| S5 | 销毁 AppRuntime | Demo、App VM、Handler、Runtime Node、Host object 和映射释放 |

操作以语义目标定位，不以平台坐标或实现对象定位。S1 失败时不得执行后续步骤；每步必须等待上一状态的合同终点。

### 7.2 Lifecycle 断言

正常路径固定为：

```text
App onCreate
-> Demo onInit -> initial evaluation -> onReady
-> Demo Present -> App onShow -> Demo onShow
-> Detail onInit -> initial evaluation -> onReady -> Present
-> Demo onHide -> Detail onShow
-> Detail onHide -> Detail onDestroy -> Demo onShow
-> Demo onHide -> App onHide
-> Demo onDestroy -> App onDestroy
```

缺失用户 Hook 不删除 Lifecycle 阶段。每个初始化/销毁 Hook 每个 VM 恰好一次；页面显示 Hook 只在 Core/Platform 可见状态提交后发生。

### 7.3 Trace 断言

只使用 Observation Contract 已冻结 marker：

- S1：`package.open.started -> package.verified`；App/Page `module.load.started/completed`；对应 `lifecycle.hook.started/completed`；`surface.create.accepted`；首屏 `render.transaction.submitted`、`mount.transaction.submitted/completed`、`platform.present.requested/completed`、`surface.create.presented`。
- S2：一个输入 `requestId` 关联 `event.input.captured`、对应 `event.handler.started/completed` 以及同步更新 Trace；一个 `capability.requested/completed` 表示 router typed call；`navigation.push.accepted/presented`；新 Surface 的 module/lifecycle/render/mount/present marker；source hide 与 target show 的 lifecycle marker 顺序符合合同。
- S3：一个 input 关联一个 Handler；一个 `capability.requested/completed` 表示 prompt；不产生 navigation marker。
- S4：使用 NavigationClose 的 typed 结果和 lifecycle/surface destroy marker 验证关闭；公共 Observation Catalog 当前没有 close 专用 navigation marker，不得私造同义 marker。
- S5：`surface.destroy.started/completed`；App/Page destroy lifecycle marker；稳定边界的 `runtime.counter.sampled` 证明 `runtime.node.live`、`handler.live`、`surface.live` 回落到运行前对应基线。

所有 marker 必须带公共 Schema 必需字段，并在事实存在时用 `artifactSha256/appRuntimeId/surfaceId/requestId/transactionId/mountAttemptId/nodeId/handlerId/revision` 关联。Trace 缺失、重复成功边界、时钟逆序或 ID 无法关联时，本次运行无效。

## 8. 跨平台一致性

### 8.1 必须一致

- Source snapshot 与 Runtime Artifact SHA-256。
- route、页面栈结果、文本、按钮语义、事件次数、Toast 内容。
- App/Page Lifecycle 偏序、Surface 数量变化、Handler 路由和资源回落。
- typed error 分类和公共 marker 名称。

### 8.2 允许差异

- 字体字形、抗锯齿、系统 title bar/Toast 外观和精确像素。
- 设备 viewport 导致的数值布局结果。
- 不同 clock domain 的绝对时间与性能数值。

允许差异必须记录为平台证据，不能改变逻辑操作或源码。

## 9. 变更治理

任何 Source snapshot 文件变化都必须：

1. 说明变化是联盟来源同步还是新增合同覆盖，且证明不是迁就当前实现。
2. 提升 Case version，保留旧 digest 与证据。
3. 更新 Source inventory、DSL/模块矩阵和受影响预期。
4. 由总架构确认公共合同影响。
5. 重新生成 Toolkit Golden，并用同一新 Artifact 重跑三平台与 Benchmark。

只更新联盟参考 build/RPK 时，不提升 Source version，但必须记录新 Reference identity、工具环境和差异；不得自动改 Runtime Expectation。

## 10. 待验证项

- `[待验证]` 样例最初上游仓库 URL、commit/tag、许可证和获取时间。
- `[待验证]` 当前 `build/**` 与四个归档是否由同一未修改 Source snapshot 直接生成；现有字节和 metadata 可验证，但目录缺少可追溯构建记录。
- `[待验证]` 三平台真实运行证据；本分 Spec 阶段只冻结断言，不声称已经运行通过。
