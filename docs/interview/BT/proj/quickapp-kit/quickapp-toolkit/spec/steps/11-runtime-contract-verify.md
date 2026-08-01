# Step 11：Runtime 契约验收

## 目录

- [目标](#目标)
- [Step 11.1：契约清单](#step-111契约清单)
- [Step 11.2：搭建验收环境](#step-112搭建验收环境)
- [Step 11.3：风险 1 实测 —— interop 层数](#step-113风险-1-实测--interop-层数)
- [Step 11.4：Debug RPK 端到端验收](#step-114debug-rpk-端到端验收)
- [Step 11.5：Release RPK 验收](#step-115release-rpk-验收)
- [Step 11.6：与官方产物结构对照](#step-116与官方产物结构对照)
- [Step 11.7：风险 2 与风险 3 确认](#step-117风险-2-与风险-3-确认)
- [Step 11.8：验收清单与结论记录](#step-118验收清单与结论记录)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**用真实 Android Runtime 验证 toolkit 产物符合契约。**

前十步的编译器正确性都只经过单测验证，而单测里的三样东西都是我们自己假设的：

| 单测里的东西 | 真实情况 | 风险 |
|---|---|---|
| `$app_define$` 的 mock | framework.js 的真实实现 | factory 执行时机可能不同 |
| `$app_require$` 返回 `{ default: {...} }` | `native_app_require` 的实际返回 | interop 层数可能不匹配 |
| 样式表按选择器精确匹配 | `style_resolver.cpp` 的匹配逻辑 | 后代选择器可能不生效 |

**这一步是硬性验收点。** 在它通过之前，所有「正确」都只是单测意义上的正确。

**验收标准：**
- Debug RPK 在 Android 上完成 11 项功能验收
- Release RPK 行为与 Debug 一致
- 产物结构与官方 hap-toolkit 产物对齐（允许体积和变量名差异）
- 三个已知风险点得出明确结论并记录

**本步不包含：**
- iOS / LVGL 端验收（Runtime 尚未实现）
- 性能基准测试（属于 Runtime 侧的 Task 4.4）
- 新功能开发 —— 只做验证，发现问题记录并定位到该改哪一侧

---

## Step 11.1：契约清单

design.md 的「Bundle 产物格式」定义了六个硬约束。这里展开为可验证条目。

### 约束 1：IIFE 包裹，`window` 未定义时直接执行

**怎么验证：** 在 Android logcat 里确认 `$app_define$` 被调用。Runtime 环境没有 `window`，走 `return createPageHandler()` 分支。

**不满足时的现象：** bundle eval 后什么都不发生，logcat 里没有 `$app_define$` 日志，页面空白。这是最难排查的失败——没有任何错误信息。

### 约束 2：组件名固定

```text
页面：@app-component/index
应用：@app-application/app
```

**怎么验证：** logcat 里 `js_bridge.cpp` 的 `native_app_define` 打印了组件名（`LOGI("$app_define$: %s", name)`）。

**不满足时的现象：** framework.js 按名查找组件，找不到时抛 `Component xxx not found`。logcat 有明确异常。

### 约束 3：define 先于 bootstrap，同步顺序

**怎么验证：** logcat 里两条日志的先后顺序。

**不满足时的现象：** `$app_bootstrap$` 时组件未注册，抛 `Component not found`。如果两者都在但顺序反了，现象与约束 2 相同。

### 约束 4：`exports.template` 是 JSON 树对象

**怎么验证：** `__native_render__` 被调用，且 C++ 侧能读出根节点的 `type`。`js_bridge.cpp` 的 `native_render` 已有这个日志：

```cpp
JSValue typeVal = JS_GetPropertyStr(ctx, vnode, "type");
const char* type = JS_ToCString(ctx, typeVal);
LOGI("  root type: %s", type ? type : "null");
```

**不满足时的现象：** logcat 显示 `root type: null`，页面空白但无异常。

### 约束 5：`exports.style` 是选择器映射对象

**怎么验证：** 页面渲染后文本颜色、字号符合样式定义。

**不满足时的现象：** 元素位置和内容正确但无样式——全部默认黑色小字。

### 约束 6：`exports.__esModule` 存在

**怎么验证：** VM 上能读到 `private` 数据（文本显示为「欢迎体验快应用开发」而非空）。

**不满足时的现象：** `$app_module$.exports` 是整个 exports 对象而非 `exports.default`，VM 结构完全错误——`private`、`onInit` 都读不到，文本为空，点击无响应。

### 契约验证的依赖关系

```text
约束 1（bundle 执行）
    ↓ 不满足则后续全部无法验证
约束 2、3（注册与启动）
    ↓
约束 6（exports.default 提取）
    ↓ 不满足则 VM 错误，template/style 也读不到
约束 4、5（template / style 挂载）
```

验收时按这个顺序排查。约束 1 失败时不要去看样式问题——那是下游表现。

---

## Step 11.2：搭建验收环境

### 11.2.1：用 toolkit 编译示例项目

```bash
cd quickapp-toolkit
npm run build

quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=debug
quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=release

ls -l ../quickapp-examples/quickapp-code-test1/dist/*.rpk
```

**预期：** 两个 RPK 产出。

```text
com.example.case1.debug.1.0.0.rpk
com.example.case1.release.1.0.0.rpk
```

### 11.2.2：把 RPK 放进 Android 工程

Android Runtime 从 assets 读取 RPK（`platform/android/asset_reader.cpp`）。

```bash
ANDROID_ASSETS=../../quickapp-kit/quickapp-runtime-android/app/src/main/assets

cp ../quickapp-examples/quickapp-code-test1/dist/com.example.case1.debug.1.0.0.rpk \
   $ANDROID_ASSETS/

ls -l $ANDROID_ASSETS/
```

**预期：** assets 目录下同时有 `framework.js` 和 RPK 文件。

`framework.js` 来自 `quickapp-runtime-js` 项目——那个项目当前尚未实现，Android 侧用的是一份最小版本（见 Android design.md 的「JS Framework」章节）。这是本步验收的一个前提条件，见 QA。

### 11.2.3：编译安装

```bash
cd ../../quickapp-kit/quickapp-runtime-android
./gradlew clean :app:assembleDebug
```

**预期：** `BUILD SUCCESSFUL`，`.so` 打包进 APK。

```bash
# 确认模拟器或真机已连接
adb devices

adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 11.2.4：logcat 过滤

Runtime 的各模块用了不同的 LOG_TAG（见各 `.cpp` 文件的 `#define LOG_TAG`）：

```text
quickapp-bridge     js_bridge.cpp      $app_define$ / $app_require$ / __native_render__
quickapp-js         quickjs_engine.cpp JS 执行与异常，以及 console.log 输出
quickapp-thread     runtime_thread.cpp 线程启停
quickapp-rpk        rpk_loader.cpp     RPK 读取
quickapp-manifest   manifest_parser.cpp  manifest 解析
quickapp-style      style_resolver.cpp 样式合并
quickapp-layout     layout_engine.cpp  布局计算
quickapp-registry   module_registry.cpp  模块注册
```

一次性过滤全部：

```bash
adb logcat -c   # 清空旧日志

adb logcat -s \
  quickapp-bridge:V quickapp-js:V quickapp-thread:V \
  quickapp-rpk:V quickapp-manifest:V quickapp-style:V \
  quickapp-layout:V quickapp-registry:V
```

启动 App：

```bash
adb shell am start -n com.quickappkit.runtime/.MainActivity
```

**预期的启动日志序列：**

```text
quickapp-thread: Runtime thread started
quickapp-js:     QuickJS engine initialized
quickapp-thread: Runtime thread: EventLoop + JSEngine ready
quickapp-rpk:    RPK opened, size=8912 bytes, entries=6
quickapp-rpk:    Read entry: manifest.json (1234 bytes)
quickapp-manifest: Manifest parsed: package=com.example.case1, entry=pages/Demo, features=4
quickapp-registry: Module registered: @app-module/system.router
quickapp-registry: Module registered: @app-module/system.prompt
quickapp-bridge: JS Bridge installed
quickapp-rpk:    Read entry: app.js (392 bytes)
quickapp-bridge: $app_define$: @app-application/app
quickapp-bridge: $app_bootstrap$: @app-application/app
quickapp-rpk:    Read entry: pages/Demo/index.js (1105 bytes)
quickapp-bridge: $app_define$: @app-component/index
quickapp-bridge: $app_bootstrap$: @app-component/index
quickapp-bridge: __native_render__ called
quickapp-bridge:   root type: div
```

这个序列本身就验证了约束 1、2、3、4。

**常见启动失败：**

| logcat 现象 | 原因 | 处理 |
|---|---|---|
| `RPK data is null or too small` | assets 里没有 RPK，或文件名不匹配 | 核对 `QuickAppRuntime.kt` 里写的文件名 |
| `End of Central Directory not found` | RPK 损坏 | `unzip -t` 校验；重新 build |
| `Failed to parse manifest.json` | manifest 内容异常 | 解压后 `cat manifest.json` 检视 |
| 无 `$app_define$` 日志 | framework.js 未加载或 bundle 未执行 | 见约束 1 的排查 |
| `Entry not found: pages/Demo/index.js` | 产物路径与 manifest 的 router.pages 不一致 | `unzip -l` 核对路径 |

---

## Step 11.3：风险 1 实测 —— interop 层数

这是本步最重要的验证项。它决定 `router.push` 能否到达 C++。

### 11.3.1：问题的两端

**toolkit 侧产出什么。** Step 7 用 `@babel/plugin-transform-modules-commonjs` 做 ES module 转换。对于 `import router from '@app-module/system.router'`，Babel 生成：

```javascript
var _system = _interopRequireDefault($app_require$("@app-module/system.router"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

// 调用点
_system.default.push({ uri: '/pages/DemoDetail' });
```

`_interopRequireDefault` 的语义是：**如果模块已经是 ES module 形状（有 `__esModule` 标记），原样返回；否则包一层 `{ default: obj }`。**

**Runtime 侧返回什么。** `js_bridge.cpp` 的 `native_app_require`：

```cpp
JSValue obj = JS_NewObject(ctx);
for (auto& method : module->getMethods()) {
    JS_SetPropertyStr(ctx, obj, method.name,
        JS_NewCFunction(ctx, ..., method.name, method.argc));
}

// 快应用 bundle 中访问的是 _system.default.method()
JSValue wrapper = JS_NewObject(ctx);
JS_SetPropertyStr(ctx, wrapper, "default", obj);

return wrapper;
```

返回的是 `{ default: { push, back } }`，**没有 `__esModule` 标记**。

### 11.3.2：推导结果

```text
$app_require$ 返回：          { default: { push } }
                              ↓ obj.__esModule 为 undefined（falsy）
_interopRequireDefault 包一层：{ default: { default: { push } } }
                              ↓
_system.default 得到：        { default: { push } }
_system.default.push          undefined
```

**调用 `_system.default.push({...})` 会抛 `TypeError: not a function`。**

对照官方产物：`rpk.md` 里记录的官方 debug 产物是 `_system.default.push(...)`，**一层 default**。这说明官方工具链的配置与我们不同——它没有生成 interop 调用，或者配置了 `noInterop`。

### 11.3.3：诊断命令

先在 toolkit 侧确认 Babel 确实生成了 interop：

```bash
cd quickapp-toolkit
node -e "
const { compileScriptBody } = require('./dist/compiler/script-compiler.js');
const src = \"import router from '@app-module/system.router';\nrouter.push({uri:'/x'});\";
console.log(compileScriptBody(src, '/x.ux', 2));
"
```

**如果输出含 `_interopRequireDefault`，问题确认存在：**

```javascript
"use strict";
var _systemRouter = _interopRequireDefault($app_require$("@app-module/system.router"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
_systemRouter.default.push({ uri: '/x' });
```

再在真机上确认现象：

```bash
adb logcat -c
adb shell am start -n com.quickappkit.runtime/.MainActivity
# 点击「跳转到详情页」按钮
adb logcat -s quickapp-js:V quickapp-bridge:V
```

**问题存在时的预期日志：**

```text
quickapp-bridge: $app_require$: @app-module/system.router
quickapp-js: JS error in pages/Demo/index.js: TypeError: not a function
    at onDetailBtnClick (pages/Demo/index.js)
```

注意 `$app_require$` 被调用了（说明模块加载链路通），但方法调用失败——这个组合是 interop 层数问题的特征。如果 `$app_require$` 都没被调用，那是别的问题（Step 7 的 require 改写失效）。

### 11.3.4：两种解法

| 维度 | 解法 A：Runtime 侧加 `__esModule` | 解法 B：toolkit 侧 `noInterop: true` |
|---|---|---|
| 改动位置 | `js_bridge.cpp` 的 `native_app_require` | `script-compiler.ts` 的 Babel 配置 |
| 改动量 | 一行 | 一个配置项 |
| 语义 | `$app_require$` 声明「我返回 ES module 形状」 | 「我保证导入的模块已是 ES module 形状」 |
| 对 CommonJS 模块的兼容 | 保留 interop，将来若有真正的 CommonJS 模块仍能正确处理 | 关闭 interop，遇到无 `default` 的模块会拿到 undefined |
| 三端一致性 | 每个平台的 `native_app_require` 都要改 | 只改 toolkit 一处，三端不用动 |
| 与官方产物的一致性 | 产物仍含 interop，与官方不同 | 产物无 interop，与官方一致 |

**解法 A 的改动：**

```text
@update quickapp-runtime-android/app/src/main/cpp/core/src/js_bridge.cpp
        — 在 native_app_require 的 wrapper 构造处增加一行
```

```cpp
    // 快应用 bundle 中访问的是 _system.default.method()
    JSValue wrapper = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, wrapper, "default", obj);
    // 声明这是 ES module 形状，让 Babel 的 _interopRequireDefault
    // 直接返回而不再包一层。缺少这个标记会导致
    // _system.default.push 变成 _system.default.default.push
    JS_SetPropertyStr(ctx, wrapper, "__esModule", JS_TRUE);

    JS_FreeCString(ctx, moduleName);
    return wrapper;
```

**解法 B 的改动：**

```text
@update quickapp-toolkit/src/compiler/script-compiler.ts
        — 替换 commonjsPlugin 的配置对象
```

```typescript
      [
        commonjsPlugin,
        {
          strictMode: false,
          loose: false,
          // 不生成 _interopRequireDefault：$app_require$ 返回的对象
          // 已经是 { default: {...} } 形状，interop 会再包一层
          noInterop: true,
        },
      ],
```

### 11.3.5：推荐解法与理由

**推荐解法 A（改 Runtime 侧）。**

三个理由：

**一是语义更准确。** `native_app_require` 返回的确实是 ES module 形状（有 `default` 字段），加 `__esModule: true` 是把这个事实显式声明出来。解法 B 是让 toolkit 单方面假设「所有模块都已是正确形状」——这个假设在 `@app-module/*` 范围内成立，但一旦将来支持用户自定义模块或 npm 包，假设就破了。

**二是保留了 interop 的兼容能力。** V2 如果引入真正的 CommonJS 模块（`module.exports = {...}`，无 `default`），interop 会正确地包一层，而 `noInterop` 下会拿到 undefined。保留 interop 是保留了处理两种模块形状的能力。

**三是失败模式更好。** 解法 A 下如果某个模块忘了加 `__esModule`，interop 会包一层——多一层 `default` 的错误比拿到 undefined 更容易定位（前者报 `not a function`，后者可能一路传递到别处才报错）。

**解法 A 的代价：** 三端的 `native_app_require` 都要加这一行。但这个函数本身就是三端各自实现的（`js_bridge.cpp` 属于 Core，实际上三端共享——见 `quickapp-runtime-core` 的抽取计划），所以改一处即可。

**判断依据的边界：** 如果实测发现官方 framework.js 对 `$app_require$` 的返回值有额外约定（比如它自己就会处理 interop），结论可能反转。这是需要实测的部分。

### 11.3.6：实测结论

> **待填写。** 执行 11.3.3 的诊断命令后，把以下内容补齐：
>
> ```text
> 诊断命令输出中是否含 _interopRequireDefault：
> 真机上点击按钮的 logcat 输出：
> 采用的解法：A / B
> 采用理由（若与推荐不同，说明原因）：
> 改动的文件与行：
> 修改后的验证结果：
> ```
>
> **结论对其他文档的影响：**
>
> - 若采用解法 A：Step 10 单测的 `systemModule` mock 已返回 `{ __esModule: true, default: {...} }`，无需改动。Step 7 的 QA 需补上最终结论。
> - 若采用解法 B：Step 7 的 Babel 配置要加 `noInterop: true`，Step 10 单测的 mock 要去掉 `__esModule`，Step 8 单测的 `runBundle` 的 modules 映射也要同步。

---

## Step 11.4：Debug RPK 端到端验收

11 项验收，按依赖顺序排列。前一项失败时后续项没有验证意义。

### 验收 1：manifest 解析

**验证方法：**

```bash
adb logcat -s quickapp-manifest:V
```

**预期：**

```text
Manifest parsed: package=com.example.case1, entry=pages/Demo, features=4
```

**核对点：** `package`、`entry`、`features` 数量与源 manifest 一致。features 是 4 个（system.prompt / system.router / system.shortcut / system.fetch）。

**失败含义：** toolkit 的 `processManifest` 产出的 manifest 字段与 C++ `ManifestParser` 读取的路径不匹配。回到 Step 3 的「与 Runtime 的字段对齐验证」逐字段核对。

### 验收 2：app.js 执行

**预期日志：**

```text
quickapp-rpk:    Read entry: app.js (392 bytes)
quickapp-bridge: $app_define$: @app-application/app
quickapp-bridge: $app_bootstrap$: @app-application/app
```

**核对点：** 组件名是 `@app-application/app`，且 define 在 bootstrap 之前。

**失败含义：** 若无 `$app_define$` 日志，说明 app.js 的 IIFE 未执行（约束 1）或组装产出的代码有语法错误——后者在 logcat 的 `quickapp-js` 标签下会有 `JS error in app.js`。

### 验收 3：页面 bundle 执行

**预期日志：**

```text
quickapp-rpk:    Read entry: pages/Demo/index.js (1105 bytes)
quickapp-bridge: $app_define$: @app-component/index
quickapp-bridge: $app_bootstrap$: @app-component/index
```

**核对点：** 组件名是 `@app-component/index`（不是页面路径）。

**失败含义：** `Entry not found: pages/Demo/index.js` 表示 RPK 内路径与 manifest 的 `router.pages` key 拼接结果不一致。`unzip -l` 核对实际路径。

### 验收 4：`__native_render__` 被调用，template 可读

**预期日志：**

```text
quickapp-bridge: __native_render__ called
quickapp-bridge:   root type: div
```

**核对点：** `root type` 是 `div`，不是 `null`。

**失败含义：** `root type: null` 说明 `exports.template` 不存在或不是对象（约束 4）。可能原因是 Step 8 组装的 factory 里 template 挂载语句失效，或约束 6 未满足导致 `$app_module$.exports` 被换成了错误的对象。

### 验收 5：TitleBar 显示

**验证方法：** 截图或肉眼观察。

```bash
adb shell screencap -p /sdcard/s1.png && adb pull /sdcard/s1.png
```

**预期：** 顶部标题栏文字为「快应用示例模版」（来自 manifest 的 `display.pages["pages/Demo"].titleBarText`）。

**失败含义：** TitleBar 是 Runtime 侧从 manifest 读取并渲染的，与 bundle 无关。若文字为 manifest.name（`case1`），说明 `display.pages` 的 key 匹配失败——核对 toolkit 是否原样透传了 `display` 字段（Step 3 决定不校验 display，只透传）。

### 验收 6：文本内容正确 —— 函数属性求值

**这是最关键的一项。** 它验证模板插值编译（Step 5）+ 序列化（Step 4）+ framework.js 的 `.call(vm)` 求值三者的配合。

**预期：** 屏幕显示「欢迎体验快应用开发」。

**失败含义分三种：**

| 现象 | 原因 | 定位 |
|---|---|---|
| 文本为空 | 函数属性求值返回 undefined | VM 上没有 `title` —— 约束 6 失败，`private` 未挂载 |
| 显示 `function () { return this.title }` | 产物里 value 是字符串而非函数 | Step 4 的序列化把 RawCode 当普通值处理了 |
| 显示 `[object Function]` | framework.js 未对函数属性求值 | framework.js 侧问题，不是 toolkit |

第一种最常见。用 `console.log` 在 script 里打一行确认 VM 数据：临时在 `.ux` 的 `onInit` 里加 `console.log('title=', this.title)`，重新编译安装，看 `quickapp-js` 标签的输出。

### 验收 7：按钮文字正确 —— 静态属性

**预期：** 按钮上显示「跳转到详情页」。

**核对点：** 这是静态属性（`value="跳转到详情页"`），产物里应该是字符串而非函数。

**失败含义：** 若按钮无文字，可能是 Step 5 把静态值也包装成了函数（违反「静态值保持字符串」的决策），而 Runtime 侧 `setAttr` 收到函数对象转字符串失败。

### 验收 8：样式生效

**预期：** 文本居中、字号明显大于默认（40px）、颜色为黑色；按钮为绿色背景（#09ba07）、圆角、白色文字。

**核对点：** 逐项对照示例项目的 `.wrapper` / `.title` / `.btn` 样式定义。

**注意：** `.wrapper .title` 和 `.wrapper .btn` 是后代选择器，当前 Runtime 只匹配单 class（风险 2）。所以 `.title` 和 `.btn` 的样式**预期不生效**，只有 `.wrapper` 的 flexDirection 会生效。

这不是 toolkit 的缺陷。详见 11.7。

**失败含义（在风险 2 的前提下）：** 若连 `.wrapper` 的样式都不生效，说明 `exports.style` 不是选择器映射对象（约束 5），或 `style_resolver.cpp` 没被调用。

### 验收 9：点击事件进入 VM 方法 —— events 映射

**验证方法：** 点击按钮，看 logcat。

**预期：** 有 `dispatchClick` 相关日志，且进入 `onDetailBtnClick`。

在 `.ux` 的 `onDetailBtnClick` 里临时加 `console.log('clicked')` 可以直接确认：

```text
quickapp-js: [console] clicked
```

**失败含义：**

| 现象 | 原因 |
|---|---|
| 点击无任何日志 | `events.click` 未产出，或 PlatformEventSink 未接通（Runtime 侧） |
| 日志显示方法名但未执行 | framework.js 在 VM 上按名查找方法失败——方法名与 events 值不匹配 |

第二种情况要核对：Step 5 产出的 `events: { click: "onDetailBtnClick" }` 里的字符串，与 script 产出的 VM 上的方法名是否完全一致。Step 10 的 release 压缩若开启属性名压缩会破坏这个一致性（方法名被压，字符串不被压）。

### 验收 10：router.push 导航 —— require 重写

**预期：** 点击后页面切换到 DemoDetail，TitleBar 变为「详情页」。

**失败含义：** 这一项直接暴露风险 1（interop 层数）。若 logcat 显示 `TypeError: not a function`，执行 11.3 的解法。

若导航成功但 DemoDetail 页面空白，那是 DemoDetail 的 bundle 有问题——回到验收 3-8 对 DemoDetail 重复一遍。

### 验收 11：showToast

**验证方法：** DemoDetail 页面上有触发 Toast 的按钮（若示例项目有）。

**预期：** 屏幕底部弹出 Toast。

**失败含义：** 与验收 10 同源——都是 `$app_require$` 返回的模块方法调用。若 router.push 成功而 showToast 失败，检查 `prompt_module.cpp` 的方法注册。

---

## Step 11.5：Release RPK 验收

Debug 全部通过后再验 release。目标是确认 Step 10 的压缩没有破坏契约。

### 11.5.1：替换 RPK 并重新安装

```bash
ANDROID_ASSETS=quickapp-kit/quickapp-runtime-android/app/src/main/assets

# 移除 debug 包，放入 release 包
rm $ANDROID_ASSETS/com.example.case1.debug.1.0.0.rpk
cp quickapp-examples/quickapp-code-test1/dist/com.example.case1.release.1.0.0.rpk \
   $ANDROID_ASSETS/
```

`QuickAppRuntime.kt` 里写死了 RPK 文件名。两种做法：改成读 assets 目录下第一个 `.rpk`，或验收时临时改文件名常量。后者更简单，但要记得改回。

```bash
cd quickapp-kit/quickapp-runtime-android
./gradlew :app:assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 11.5.2：逐项复验

把 11.4 的 11 项重跑一遍。**预期全部与 debug 一致**——这是 Property 5（压缩语义等价）在真实环境的验证。

Step 10.5.4 已经在 Node 里做过 debug/release 输出 diff 对照，那一步验证的是「在标准 JS 引擎里行为一致」。这里验证的是「在 QuickJS 里行为一致」。两者的差异来源：

```text
QuickJS 与 V8 的实现差异（属性枚举顺序、错误消息格式）
framework.js 的真实行为（vs 单测 mock）
C++ 侧对 JSValue 的读取方式
```

### 11.5.3：release 特有的检查项

除了功能一致，还要确认压缩没有破坏三个注入函数名和属性名。

```bash
adb logcat -c
adb shell am start -n com.quickappkit.runtime/.MainActivity
adb logcat -s quickapp-bridge:V quickapp-js:V
```

**预期日志与 debug 完全相同：**

```text
quickapp-bridge: $app_define$: @app-application/app
quickapp-bridge: $app_define$: @app-component/index
quickapp-bridge: __native_render__ called
quickapp-bridge:   root type: div
```

**release 特有的失败模式：**

| logcat 现象 | 原因 | 定位 |
|---|---|---|
| `JS error: $app_define$ is not a function` | `mangle.reserved` 失效 | Step 10 的 `verifyMinified` 本应拦住，检查它为何没报 |
| `root type: null` | `template` 属性名被压缩 | `mangle.properties` 被开启 |
| 文本为空但 debug 正常 | `private` 属性名被压缩 | 同上 |
| 点击无响应但 debug 正常 | 方法名被压缩，与 events 字符串不匹配 | 同上 |

这四种现象都指向 Step 10 的配置问题，且 `verifyMinified` 应该在构建期就拦住。如果构建通过但设备上出现这些现象，说明 `verifyMinified` 的检查列表有遗漏——补上对应的检查项。

### 11.5.4：体积确认

```bash
ls -l quickapp-examples/quickapp-code-test1/dist/*.rpk
```

**核对：** release 明显小于 debug。与官方产物的对照见 11.6。

---

## Step 11.6：与官方产物结构对照

官方 hap-toolkit 的产物是回归基线。结构必须对齐，体积和变量名允许不同。

### 11.6.1：解压两份产物

```bash
cd quickapp-examples/quickapp-code-test1/dist

# 官方产物（示例项目自带）
[ -d official ] || unzip -q com.example.case1.debug.1.0.0.rpk.official -d official 2>/dev/null \
  || echo "无官方产物，见 QA"

# 本工具链产物
rm -rf ours && unzip -q com.example.case1.debug.1.0.0.rpk -d ours
```

如果示例项目里的官方 RPK 已经被我们的产物覆盖了，可以从 git 恢复，或参照 `rpk.md` 里记录的产物结构做对照——那份文档已经把官方产物的关键结构抄录下来了。

### 11.6.2：模板树结构对照

```bash
# 官方产物里提取 template 模块
grep -A 30 'template-loader' official/pages/Demo/index.js | head -40

# 我们的产物
grep -A 30 '"template"' ours/pages/Demo/index.js | head -40
```

**必须一致的维度：**

| 维度 | 期望 |
|---|---|
| 根节点 `type` | `"div"` |
| 根节点 `attr` | `{}`（存在且为空对象） |
| 根节点 `classList` | `["wrapper"]` |
| `children` 数量与顺序 | 2 个：text、input |
| text 的 `attr.value` | 函数，形如 `function () { return this.title }` |
| input 的 `attr` | `{ type: "button", value: "跳转到详情页" }` |
| input 的 `events` | `{ click: "onDetailBtnClick" }` |
| 无事件节点是否有 `events` 字段 | 无 |
| 叶子节点是否有 `children` 字段 | 无 |

最后两项是 Step 5 里刻意对齐官方行为的决策（`attr`/`classList` 始终存在，`events`/`children` 可选）。

**允许不一致：** 缩进格式、模块 ID（官方用 loader 路径，我们用 `"template"`）、属性顺序（建议一致但不强制）。

### 11.6.3：样式对象对照

```bash
grep -A 25 'style-loader' official/pages/Demo/index.js | head -35
grep -A 25 '"style"' ours/pages/Demo/index.js | head -35
```

**必须一致：** 选择器 key（`".wrapper"`、`".wrapper .title"`、`".wrapper .btn"`）、属性名（camelCase）、属性值（带单位的字符串）。

**允许不一致：** 官方有 `_meta.ruleDef` 字段，我们不生成。这是已记录的技术债（HANDOFF 的「不生成的内容」）——当前 Runtime 不读它，缺失不影响功能。

### 11.6.4：调用序列对照

```bash
for d in official ours; do
  echo "=== $d ==="
  grep -o '\$app_define\$([^,]*' $d/pages/Demo/index.js
  grep -o '\$app_bootstrap\$([^,]*' $d/pages/Demo/index.js
done
```

**预期两者都输出：**

```text
$app_define$('@app-component/index'
$app_bootstrap$('@app-component/index'
```

组件名必须完全一致——framework.js 按名查找。

### 11.6.5：manifest 字段对照

```bash
diff <(python3 -m json.tool official/manifest.json) \
     <(python3 -m json.tool ours/manifest.json)
```

**预期差异只在 `config` 字段**（我们按 mode 注入，官方按源文件）以及格式。

**必须一致：** `package`、`name`、`versionName`、`versionCode`、`router`、`display`、`features` 的内容。

若 `router.pages` 或 `display.pages` 的结构不同，Runtime 侧读取会失败——那是 Step 3 的 manifest 处理有问题。

### 11.6.6：体积对照

| 产物 | 官方 | 本工具链 | 差异来源 |
|---|---|---|---|
| debug RPK | 42 KB | 约 9 KB | 官方内联 sourcemap + CERT + sitemap.json |
| release RPK | 18 KB | 约 4 KB | 官方 release 仍带 `_meta.ruleDef` |
| debug 单页 bundle | 29 KB | 约 3.4 KB | sourcemap 占大头 |

**体积不是可比的质量指标**——我们更小是因为少产出了内容（不生成 sourcemap、CERT、sitemap.json、`_meta`），不是压缩更好。

有意义的比较是 release/debug 比例：官方约 43%，我们约 45%（去掉 sourcemap 影响后接近）。这个比例反映压缩效率，可以比。

---

## Step 11.7：风险 2 与风险 3 确认

### 11.7.1：风险 2 —— 后代选择器不匹配

**Runtime 侧的实现**（`style_resolver.cpp`）：

```cpp
void resolveStyles(VNode* root, const StyleSheet& styleSheet) {
    for (const auto& cls : root->classList) {
        std::string selector = "." + cls;      // 只拼单 class
        auto it = styleSheet.find(selector);   // 精确匹配
        if (it != styleSheet.end()) {
            for (const auto& [key, value] : it->second) {
                root->styles[key] = value;
            }
        }
    }
    for (auto& child : root->children) {
        resolveStyles(child.get(), styleSheet);
    }
}
```

对于 `classList: ["title"]` 的节点，它查找的 key 是 `".title"`。而 toolkit 产出的 key 是 `".wrapper .title"`（源码里就是后代选择器）——**查不到，样式静默不生效**。

**验证方法：** 在示例项目的样式里临时加一条单 class 规则，对照两者是否生效。

```text
@update quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux
        — 在 <style> 中追加（仅用于验证，验证后移除）
```

```css
.title {
  color: #ff0000;
}
```

重新编译安装后：

| 现象 | 结论 |
|---|---|
| 文字变红 | 单 class 选择器生效，后代选择器不生效 —— 风险 2 确认 |
| 文字未变红 | 样式链路整体有问题，不只是选择器匹配 —— 回到验收 8 |

**结论定位：这是 Runtime 侧的能力缺口，不是 toolkit 缺陷。**

理由在 Step 6 的技术决策里：toolkit 忠实产出所有选择器，选择器匹配是 Runtime 侧 `StyleResolver` 的职责。让 toolkit 在编译期解析后代关系会导致同一逻辑在 toolkit 和三端 Runtime 中重复实现，产生不一致风险。

**记录为待补能力：**

```text
项目：quickapp-runtime-core（或当前的 quickapp-runtime-android）
内容：StyleResolver 支持后代选择器匹配
      需要维护节点的祖先 class 链，对每条选择器规则做后缀匹配
优先级：中 —— 影响样式表达能力，但不影响首屏渲染打通
关联：Step 6 技术决策 1、_meta.ruleDef 技术债
```

`_meta.ruleDef` 的技术债与此相关：完整的选择器匹配需要优先级计算，而官方产物用 `_meta.ruleDef` 承载这个信息。补齐后代匹配时应同时决定是否生成该字段。

### 11.7.2：风险 3 —— factory 执行时机

**问题：** toolkit 的单测 mock 里，`$app_define$` 收到 factory 后立即执行：

```javascript
const $app_define$ = (name, deps, factory) => {
  const module = { exports: {} };
  factory($app_require$, module.exports, module);   // 立即执行
  componentExports = module.exports;
};
```

真实 framework.js 可能延迟到 `$app_bootstrap$` 时才执行 factory——那样更符合「define 是注册，bootstrap 是启动」的语义。

**验证方法：** 在 `.ux` 的 script 顶层加一行日志（不在任何方法内），它会在 factory 执行时输出。

```text
@update quickapp-examples/quickapp-code-test1/src/pages/Demo/index.ux
        — 在 <script> 顶部追加（仅用于验证，验证后移除）
```

```javascript
console.log('[factory] script module executing');
```

重新编译安装，观察这行日志相对于 `$app_define$` / `$app_bootstrap$` 的位置：

```bash
adb logcat -s quickapp-bridge:V quickapp-js:V
```

**两种可能的输出：**

```text
情况 A（define 时立即执行）：
  quickapp-bridge: $app_define$: @app-component/index
  quickapp-js:     [console] [factory] script module executing
  quickapp-bridge: $app_bootstrap$: @app-component/index

情况 B（bootstrap 时才执行）：
  quickapp-bridge: $app_define$: @app-component/index
  quickapp-bridge: $app_bootstrap$: @app-component/index
  quickapp-js:     [console] [factory] script module executing
```

**结论对 toolkit 的影响：**

无论哪种情况，**产物都不需要改**。factory 的执行时机由 framework.js 决定，bundle 只是把 factory 传过去。产物正确性不依赖时机——factory 无论何时执行，行为都一样（同步收集 exports）。

需要更新的是文档和单测注释：

| 情况 | 处理 |
|---|---|
| A | Step 8 单测的 mock 与真实行为一致，无需改动 |
| B | Step 8 单测的 mock 仍可保留（它验证的是产物结构，不是时序），但要在 QA 里注明真实时机是 bootstrap 时 |

**为什么这个风险仍值得验证：** 如果是情况 B，且 factory 里有副作用（比如 script 顶层的 `console.log` 或全局变量赋值），那么「define 但未 bootstrap 的组件」不会执行这些副作用。这影响的是 framework.js 的设计（`quickapp-runtime-js` 项目），需要在那边的文档中明确。

### 11.7.3：结论记录

> **风险 2 待实测填写：**
>
> ```text
> 单 class 选择器是否生效：
> 后代选择器是否生效：
> 结论：
> ```

**风险 3 已确认（通过阅读代码，无需实测）：情况 A —— factory 在 `$app_define$` 时立即执行。**

依据是 Android 侧当前 framework.js 的实现（`app/src/main/assets/framework.js`）：

```javascript
globalThis.$app_define$ = function(name, deps, factory) {
    var exports = {};
    var module = { exports: exports };
    factory($app_require$, exports, module);      // <- 立即执行
    if (exports.__esModule && exports.default) {
        module.exports = exports.default;
    }
    __components__[name] = module.exports;
};
```

`$app_bootstrap$` 只从 `__components__` 取已注册的组件，不再执行 factory。

**结论的影响：**

- toolkit 侧 Step 8 单测的 mock 与真实行为一致，无需改动
- `$app_require$` 在 factory 执行时被调用，所以 `$app_define$` 之前必须已注入它——当前 C++ 侧的注入顺序（`installJSBridge` 在 `eval(framework.js)` 之前）满足这个要求
- script 顶层的副作用（`console.log`、全局变量赋值）在 define 时发生，不是 bootstrap 时

**同时确认了 `__esModule` 契约成立：** framework.js 的 `if (exports.__esModule && exports.default)` 分支与 toolkit 产出的 Babel `__esModule` 标记匹配（design.md 的约束 6）。

---

## Step 11.8：验收清单与结论记录

### 11.8.1：完整验收清单

**环境搭建：**

```text
[ ] toolkit 编译 debug 和 release 两个 RPK 成功
[ ] RPK 放入 Android assets
[ ] ./gradlew :app:assembleDebug 成功
[ ] APK 安装到设备
[ ] logcat 过滤命令可用，能看到全部 8 个 LOG_TAG
```

**契约验证（六个硬约束）：**

```text
[ ] 约束 1：bundle 执行，$app_define$ 日志出现
[ ] 约束 2：组件名为 @app-component/index 和 @app-application/app
[ ] 约束 3：define 先于 bootstrap
[ ] 约束 4：__native_render__ 被调用，root type 为 div
[ ] 约束 5：样式生效（至少单 class 选择器）
[ ] 约束 6：VM 上能读到 private 数据
```

**Debug RPK 功能验收（11 项）：**

```text
[ ] 1  manifest 解析：package / entry / features 正确
[ ] 2  app.js 执行：@app-application/app 注册与启动
[ ] 3  页面 bundle 执行：@app-component/index 注册与启动
[ ] 4  __native_render__ 调用，template 可读
[ ] 5  TitleBar 显示「快应用示例模版」
[ ] 6  文本显示「欢迎体验快应用开发」（函数属性求值）
[ ] 7  按钮显示「跳转到详情页」（静态属性）
[ ] 8  样式生效（考虑风险 2 的限制）
[ ] 9  点击进入 onDetailBtnClick（events 映射）
[ ] 10 router.push 导航到 DemoDetail（require 重写）
[ ] 11 showToast 弹出
```

**Release RPK 验收：**

```text
[ ] 11 项功能验收全部与 debug 一致
[ ] 三个注入函数名未被改写
[ ] 属性名未被压缩（template / style / private / 方法名）
[ ] 体积明显小于 debug
```

**结构对照：**

```text
[ ] 模板树结构与官方一致（9 个维度）
[ ] 样式对象 key/value 与官方一致
[ ] $app_define$ / $app_bootstrap$ 调用序列一致
[ ] manifest 字段集合一致（config 除外）
```

**风险点结论：**

```text
[ ] 风险 1：interop 层数 —— 解法确定并实施，验证通过
[ ] 风险 2：后代选择器 —— 确认为 Runtime 能力缺口，已记录
[ ] 风险 3：factory 时机 —— 确认实际行为，已更新相关文档
```

### 11.8.2：实测结论表

> **待填写。** 验收执行后补齐：

| 项目 | 结论 | 备注 |
|---|---|---|
| 验收执行日期 | | |
| toolkit 版本 | | |
| Android Runtime commit | | |
| framework.js 来源与版本 | | |
| 设备/模拟器 | | Android API 级别、架构 |
| Debug 11 项通过数 | / 11 | 未通过项列出 |
| Release 11 项通过数 | / 11 | 未通过项列出 |
| 风险 1 解法 | A / B | 改动文件与行 |
| 风险 2 结论 | | |
| 风险 3 结论 | 情况 A / B | |
| 发现的 toolkit 缺陷 | | 影响哪些 Step，是否已修 |
| 发现的 Runtime 缺陷 | | 记录到哪个项目的待办 |

### 11.8.3：验收未通过时的处理原则

发现问题时，先判断该改哪一侧。判断依据：

| 问题类型 | 责任方 | 依据 |
|---|---|---|
| 产物结构与 design.md 的契约不符 | toolkit | 契约是 toolkit 的输出规范 |
| 产物符合契约但 Runtime 读不到 | Runtime | Runtime 应按契约读取 |
| 契约本身没定义这个情况 | 先补契约定义 | 两侧都改之前先在 design.md 里明确 |
| 官方产物有而我们没有的字段 | 看 Runtime 是否读 | 读则补，不读则记为技术债 |

**不要在验收阶段做设计变更。** 发现契约定义不足时，先记录，把它作为独立任务处理——在验收过程中改契约会让「验收通过」失去意义。

---

## 技术决策

### 1. 用真实 Android 环境验收，不用桌面模拟

**为什么：** 桌面能验证的只有「产物在标准 JS 引擎里行为正确」——Step 10.5.3 的 `run-bundle.js` 已经做了这件事。真实环境额外覆盖三类差异：

```text
QuickJS 与 V8 的实现差异（属性枚举顺序、错误消息格式、ES 特性支持边界）
framework.js 的真实行为（vs 单测 mock 的假设）
C++ 侧读取 JSValue 的方式（JS_GetPropertyStr 的行为、字符串编码）
```

风险 1 的 interop 层数问题就是典型：在 Node 里用我们自己写的 mock 测，永远发现不了——因为 mock 返回的形状是按我们的期望写的。

**代价：** 验收依赖 Android Runtime 可运行。当前 Android 侧的 Task 1.2 还在进行中，这构成前置依赖，见 QA。

### 2. 以官方产物为回归基线，但不要求字节一致

**为什么：** 官方 hap-toolkit 的产物是唯一可靠的「Runtime 能正确消费」的样本。它的结构就是事实上的契约。

但要求字节一致是不可行也无必要的：官方的模块 ID 用 webpack loader 路径（含绝对路径和 loader 参数），变量名由它的 Babel 配置决定，缩进由它的代码生成器决定。这些都不影响 Runtime 读取。

对照的粒度定在「结构」：节点层次、字段名、字段的存在性（`events` 可选而 `attr` 必须）、字符串值。这些是 Runtime 实际读取的东西。

**代价：** 结构对照需要人工比对，无法自动化断言。11.6 给出了逐维度的对照清单来降低遗漏风险。

### 3. 风险 1 倾向改 Runtime 侧而非 toolkit 侧

理由已在 11.3.5 展开，核心是三点：语义更准确（`native_app_require` 返回的确实是 ES module 形状）、保留 interop 对将来 CommonJS 模块的兼容能力、失败模式更好定位。

**这里补充一个反向考虑：** 解法 B（toolkit 侧 `noInterop`）有一个实际优势——产物与官方一致。官方产物里没有 interop 调用，说明官方走的就是 B 路线。

如果目标是「产物与官方尽可能一致」，B 更好。但我们的目标是「产物能被自己的 Runtime 正确消费」，且我们同时控制两侧。在能改 Runtime 的前提下，A 的语义更清晰。

**判断可能反转的条件：** 如果实测发现官方 framework.js 对 `$app_require$` 的返回值有额外约定（比如它自己处理 interop），那么改 Runtime 会与 framework.js 的假设冲突，此时必须选 B。这是 11.3.6 需要实测确认的部分。

### 4. 验收覆盖 debug 和 release 两种包

**为什么：** 两种包走的是同一条编译管线，只在 Terser 步骤和 `config.debug` 字段上分叉（Step 10 决策 1）。但分叉点恰好是最容易出问题的地方——压缩会改变标识符，而 Runtime 按名读取属性。

Step 10 的单测和 10.5.4 的 diff 对照已经在 Node 里验证过等价性。这里再验一遍的理由是：QuickJS 对某些语法的处理可能与 V8 不同，压缩后的代码形状变了，可能触发 QuickJS 特有的边界行为。

**代价：** 验收工作量翻倍。11.5 的做法是先让 debug 全绿再验 release，且 release 只复验功能项加三个压缩特有检查项，不重复结构对照。

### 5. 验收阶段不做设计变更

发现契约定义不足时记录，不当场改。

**为什么：** 验收的意义在于「用固定标准检验实现」。如果检验过程中修改标准，通过与否就失去了信息量——总能通过。

更实际的问题是：契约变更会影响已完成的十个 Step 的文档和单测。在验收中途改契约，会让「Step X 已完成」的状态变得不可信。

**代价：** 某些问题的修复被推迟。11.8.3 给了判断责任方的依据，让记录的问题有明确归属，不会变成悬空待办。

### 6. 验收清单按依赖顺序排列

11.4 的 11 项不是并列的，而是有依赖的。前一项失败时后续项没有验证意义。

**为什么：** 避免误导性排查。约束 6（`__esModule`）失败时，VM 上读不到 `private`，表现为「文本为空」——如果先看验收 6（文本内容），会往模板插值和函数属性求值的方向排查，而根因在两层之外。

11.1 末尾的依赖关系图和 11.4 的排序都是为了让排查从上游开始。

**代价：** 无法并行验证。但验收本身是人工操作，串行执行反而更清晰。

---

## QA

**Q：Android Runtime 的 Task 1.2 还在进行中，framework.js 也没实现，怎么做验收？**

这是本步最大的前置依赖。Android 侧的推进状态（见其 tasks.md）：Task 1.1 构建骨架已完成，Task 1.2 的 PlatformBridge/JNI 文档已写但代码待实现，Task 1.3 及以后待开始。

按依赖关系，完整验收需要 Android 侧至少完成到 Task 3.5（Router/Prompt/TitleBar）。在此之前可以做的是**分阶段部分验收**：

| Android 侧完成到 | 本步可验收的项 |
|---|---|
| Task 1.3（JSEngine + QuickJS） | 约束 1、2、3；验收 2、3（bundle 能 eval 并触发注册） |
| Task 2.1（RPKLoader + Manifest） | 验收 1 |
| Task 2.2（framework.js + VM） | 约束 6；验收 6（函数属性求值） |
| Task 3.1-3.3（VNode + 样式 + 渲染） | 约束 4、5；验收 4、5、7、8 |
| Task 3.4（事件通道） | 验收 9 |
| Task 3.5（Router + Prompt） | 验收 10、11；风险 1 实测 |

**风险 1 的实测不必等到 Task 3.5。** 它只需要 `$app_require$` 能被调用并返回对象——Task 1.5（JS Bridge 核心）完成后就能验。这一项优先做，因为它的结论会反向影响 toolkit 的 Step 7 和 Step 10。

`framework.js` 的问题：`quickapp-runtime-js` 项目当前未开始，Android 侧用的是 design.md 里那份约 40 行的最小版本。用它做验收的局限是：它可能没实现完整的函数属性求值和生命周期调度，导致验收 6 失败——但那是 framework.js 的缺失，不是 toolkit 的问题。

**处理办法：** 验收时明确记录 framework.js 的来源和版本（11.8.2 的表格有这一行）。用最小版本发现的问题，要区分「toolkit 产物错误」和「framework.js 未实现」。

**Q：验收失败时怎么判断是改 toolkit 还是改 Runtime？**

11.8.3 给了判断表，核心是**以 design.md 的契约为准**：

产物不符合契约 → 改 toolkit。产物符合契约但 Runtime 读不到 → 改 Runtime。

难的是第三种情况：契约没定义。比如「`attr` 的值可以是数字吗」——design.md 没写。这时不要凭直觉改任何一侧，先在 design.md 里补定义，然后两侧按新定义对齐。

判断契约是否覆盖某个情况，看官方产物：如果官方产物里有这种形式，Runtime 就应该支持；如果没有，我们也不该产出。官方产物是契约的事实来源。

**Q：能用 iOS 或 LVGL 端做验收吗？**

不能，那两端的 Runtime 还没实现（HANDOFF 的项目状态里 `quickapp-runtime-ios` 和 `quickapp-runtime-cpp` 都是空目录）。

即使实现了，Android 端仍应是主验收环境——它是第一个打通完整链路的平台，其他端的 PlatformBridge 实现是照它的语义做的。

三端都可运行后，本步的验收清单可以复用：约束 1-6 和验收 1-4、6、9、10 是平台无关的（属于 JS Bridge 和 Core 层），只有验收 5、7、8、11（TitleBar、按钮渲染、样式、Toast）需要按平台调整预期。

**Q：官方产物拿不到怎么办？**

三个来源，按可靠性排序：

一是示例项目的 `dist/` 目录。`quickapp-examples/quickapp-code-test1/dist/` 里原本有官方的 debug 和 release RPK。如果被我们的产物覆盖了，从 git 恢复。

二是 `rpk.md`。那份文档已经把官方产物的关键结构抄录下来了——模板树 JSON、样式对象、`$app_define$` 调用形式、manifest 字段。11.6 的对照清单就是按它整理的，没有原始 RPK 也能做结构对照。

三是用官方 IDE 重新编译示例项目。这是最可靠但也最麻烦的方式，需要装快应用 IDE。

**没有官方产物时的降级方案：** 跳过 11.6 的文件级 diff，只按 11.6.2 到 11.6.5 的对照清单逐项检查我们的产物是否满足。清单里的期望值都是从 `rpk.md` 提取的确定值（比如根节点 `attr` 必须是 `{}`），不依赖手边有官方文件。

**Q：验收通过后，后续改动 toolkit 需要重新验收吗？**

需要，但可以按影响范围裁剪。

改动影响产物结构（模板编译、样式编译、组装）→ 全量重跑 11.4 的 11 项。
改动只影响 CLI 或诊断输出（Step 1、14）→ 不需要重新验收。
改动 Terser 配置（Step 10）→ 只重跑 11.5。
改动 manifest 处理（Step 3）→ 只重跑验收 1、5。

理想做法是把 11.4 的部分项自动化——用 `adb logcat` 抓取关键日志行做断言。但截图类的验证项（TitleBar、样式、按钮文字）自动化成本高，V1 保持人工。

**Q：`console.log` 在验收中临时加到 `.ux` 里，会不会污染示例项目？**

会，所以 11.7 的两处都标注了「仅用于验证，验证后移除」。

更干净的做法是复制一份示例项目专用于验收（`quickapp-code-test1-verify`），在副本里加日志。但那样又要维护两份源码的同步。

当前规模下用 git 保证清理：验收前 `git status` 确认干净，验收后 `git checkout` 恢复。

**Q：`root type: div` 这个日志只验证了根节点，子节点结构错了怎么发现？**

`js_bridge.cpp` 当前的 `native_render` 只打印了根节点类型，这是它的简化实现（注释里写了「简化验证：创建一个测试元素」）。

完整的结构验证靠两个途径：一是屏幕上的实际渲染结果（验收 5-8），子节点错了会直接表现为内容缺失或位置错乱；二是 Android 侧 Task 3.4 完成后，`ViewRenderer` 会为每个 `createElement` 打日志，那时能看到完整的节点序列。

如果需要更早的结构验证，可以临时在 `native_render` 里加递归遍历打印。但那属于 Runtime 侧的调试增强，不是 toolkit 的验收内容。

---

## 下一步

Step 12：Watch 模式与增量编译（Task 4.2）。

本步是分水岭——契约验收通过后，编译管线的正确性有了真实环境的支撑。接下来三步是开发体验层面的完善：

```text
Step 12  watch 增量编译    页面粒度增量，缩短开发反馈循环
Step 13  init 项目模板      降低上手成本
Step 14  诊断输出与错误定位  统一格式，行号换算验证
```

这三步都不改变产物格式，所以不需要重新做契约验收。Step 12 有一项与本步相关的验收要求：**增量编译产出的 bundle 必须与全量 build 的该页面产物字节一致**（Property 6）。这保证了「开发时用增量、发布时用全量」不会产生行为差异。

如果本步的风险 1 采用了解法 B（toolkit 侧 `noInterop`），在进入 Step 12 之前先回头改 Step 7 的 Babel 配置和 Step 10 的单测 mock，并重跑单测。契约相关的改动不要积压。
