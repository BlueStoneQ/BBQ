# B1 Input + Switch 公共实现交接（2026-08-25）

## 结论

已完成公共 Core/Page IR/Toolkit 的最小向后兼容扩展，并生成真实 `controls-001.rpk`。已有 ABI 的 `bool` BindingValue 与结构化事件 payload 足以承载 Switch，不新增通用 JSON Bridge。平台 Native Switch 映射尚未在本 Agent 范围内实现。

## 修改文件

- `quickapp-runtime-core/include/quickapp/core/package/page_ir.h`
- `quickapp-runtime-core/src/page_ir.cpp`
- `quickapp-runtime-core/src/page_ir_model.cpp`
- `quickapp-runtime-core/src/runtime_tree.cpp`
- `quickapp-toolkit/src/compiler/frontend/ux-parser.ts`
- `quickapp-toolkit/src/compiler/frontend/feature-matrix.ts`
- `quickapp-toolkit/src/compiler/lowering/types.ts`
- `quickapp-toolkit/src/compiler/lowering/canonical-lowerer.ts`
- `quickapp-toolkit/src/compiler/emitter/page-ir-emitter.ts`
- `v3/spec/contracts/schemas/host-component.schema.json`
- `quickapp-examples/showcases/controls-001/`

公共语义：`Switch` props 为 `checked:boolean`、`enabled:boolean`，事件为 `change`；Input 复用已有 `value/enabled` 和 `input/change/focus` 合同。C++ Runtime Tree 仍是唯一权威树。

## 构建产物

- 命令：`node quickapp-examples/showcases/controls-001/scripts/build-controls.mjs`
- RPK：`quickapp-examples/showcases/controls-001/dist/controls-001.rpk`
- 大小：`16773` bytes
- 两次构建 SHA-256：`1e25a27daf59e5ae2f6b0bd046a7e9c4fe2876cfcd4dcebea2a2e26a7ed7f829`
- 路由：`/pages/Home`
- 能力：`system.router`
- 资源：1 张 32x32 本地图，`1720` bytes

RPK 由 Toolkit 从联盟 DSL 生成，未手写 Page IR、RenderTransaction 或 MountTransaction。

## 测试

- Core CMake build：通过
- Core CTest：`17/17` 通过
- Toolkit：`84 passed, 0 failed`

## 剩余问题

1. 本轮未修改 Android/iOS/LVGL；三端需要各自把 `Switch` 映射为平台控件并验收 `change({checked})`、enabled、teardown。
2. 当前 Toolkit 已支持静态 `checked="true|false"`；动态 `checked`/`enabled` 受控表达式回写仍需沿现有 Binding evaluator 扩展后再验收，不应伪造为已完成。
3. `Switch` 公共类型加入后，平台组件注册表和平台 Host 映射必须补充 `Switch`，否则对应平台构建应明确报告 unsupported。

# B1 Composition Root 集成交接（2026-08-25）

## 结论

已修复 B1 唯一集成阻塞：Examples Composition Root 注册 `HostComponentType::kSwitch`，并将 LVGL Switch 的 typed `bool checked` 回调转换为标准 `PlatformInputMessage` 的 `change` 事件 payload `{ checked: boolean }`。未修改 Core、JS、Toolkit、公共 Contract、Android 或 iOS；未创建第二棵树、第二套路由或旁路 Bridge。

## 修改

- `quickapp-examples/composition/case001_lvgl.cpp`
  - Runtime Composition component inventory 增加 `Switch`。
  - 新增 `LvglSwitchToCore`，通过现有 `EventRouter::dispatch` 发送 `EventType::kChange`。
  - controls-001 按真实 handler 绑定 Input、Switch、Button：`hdl:1/2/3`、`hdl:4`、`hdl:5`。
  - 交互 Simulator 保持持续 SDL event loop，controls-001 不走通用 Showcase 点击绑定器。

## 真实 RPK 验收

- RPK：`quickapp-examples/showcases/controls-001/dist/controls-001.rpk`
- 大小：`16773` bytes
- SHA-256：`1e25a27daf59e5ae2f6b0bd046a7e9c4fe2876cfcd4dcebea2a2e26a7ed7f829`
- 加载命令：`SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/controls-001/dist/controls-001.rpk`
- Simulator 命令：`SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/controls-001/dist/controls-001.rpk`
- RPK 加载、Home 挂载和 9 个 Runtime/Platform 节点创建：通过。
- Input：`focus`、`input`、`change` 均通过 Core Event Router 到达对应 JS Handler。
- Switch：`node:7` 点击/值变化产生 `change`，payload 为 `checked=false`，路由到 `hdl:4/onSwitch`，状态写入验证通过。
- teardown：Runtime nodes、handlers、LVGL objects、JS resources、Feature resources 和 queue depth 均归零。
- Simulator 关闭：持续运行入口收到 Ctrl-C 后完成 teardown，退出码为 0。

## 回归

- `quickapp_case001_lvgl --case-002`：退出码 0，RenderTransaction、removeBlock、moveBlock 和 keyed 顺序通过。
- `quickapp_case001_lvgl --binding-001`：退出码 0，增量绑定与 LVGL 文本更新通过。
- 默认 `quickapp_case001_lvgl`：退出码 0，真实按钮、路由、Feature、teardown 通过。

## 剩余问题

- 本轮不开始 B2；Android/iOS 的 Switch 映射仍由各自平台任务负责。

# Examples Composition Root 组件清单交接（2026-08-25）

## 结论

已在 Examples Composition Root 统一当前 LVGL 已实现的 10 个 Host Component：`View`、`Text`、`Button`、`Image`、`Input`、`Switch`、`Slider`、`Picker`、`List`、`Scroll`。自动验收入口和 LVGL Simulator 都编译同一份 `case001_lvgl.cpp`，并通过同一个 `runtime_composition.h` 生成组件清单，避免入口漂移。

本轮未修改 Core、JS、Toolkit、公共 Contract 或 LVGL 平台实现；capabilities 仍保持原有 `system.prompt`、`system.router`、`system.fetch`、`system.device`、`system.shortcut` 校验，不为未实现 Feature 增加注册。

## 修改文件

- `quickapp-examples/composition/runtime_composition.h`
  - 唯一组件清单来源：10 个已实现 Host Component。
  - 唯一 Examples RuntimeComposition 工厂，同时保留现有 capabilities。
- `quickapp-examples/composition/case001_lvgl.cpp`
  - 使用共享 Composition 工厂。
  - 为 controls-002/list-001 增加仅加载、真实 Mount、teardown 的验收分支，不伪造控件事件或路由结果。
  - 补齐 Examples 侧 `qcf::Request` 聚合初始化的新增尾字段，使 `-Werror` 干净重编译可执行。

## 构建

目标：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 --target quickapp_case001_lvgl quickapp_lvgl_simulator -j 4
```

该命令在外部 Core 文件发生语法破坏前已成功完成，两个目标均成功链接。随后工作区中的 `quickapp-runtime-core/src/page_ir.cpp` 出现未闭合的事件类型嵌套表达式，最新重编译在 Core 阶段被 `-Werror` 之前的语法错误阻塞；本轮没有修改该 Core 文件。

## 真实 RPK 结果

### controls-001

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/controls-001/dist/controls-001.rpk
```

通过：Loader、真实 LVGL Mount、Input/Switch 事件和 teardown；退出码 `0`，`resources_released=true`。

### controls-002

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/controls-002/dist/controls-002.rpk
```

Loader 通过，但真实 LVGL Mount 失败：`PLATFORM_REJECTED: mount commit failed`。RPK 包含 Slider 的 `enabled` 属性，而当前 LVGL Mount 实现的 `enabled` 分支只接受 Button/Input/Switch，未接受 Slider/Picker；该问题属于 LVGL 平台实现，按本任务约束未修改。故 controls-002 的真实 Mount 不宣称通过。

### list-001

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/list-001/dist/list-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/list-001/dist/list-001.rpk
```

通过：Loader、真实 `Scroll -> List -> keyed for` Mount、25 个 Runtime/Platform nodes 创建、Simulator 启动和关闭；自动入口与 Simulator 均 `resources.before_cleanup ... nodes=0 ... handlers=0 ... mount_objects=0`，并报告 `resources_released=true`。

## 回归

- 默认 Case 001：退出码 `0`，真实 Mount、路由、Feature、teardown 通过。
- CASE-002：退出码 `0`，增量 RenderTransaction、removeBlock、moveBlock、keyed 顺序和 teardown 通过。
- BLOCK-001：退出码 `0`，增删重建、旧 Handler 拒绝、资源释放和 teardown 通过。

## 未解决问题

1. `controls-002.rpk` 已不再被 `Runtime component unavailable` 阻塞，但仍被 LVGL Mount 的 Slider `enabled` 属性处理阻塞；需要单独的 LVGL 平台修复，不能在 Composition Root 伪造解决。
2. 最新全量重编译还受外部 `quickapp-runtime-core/src/page_ir.cpp` 未闭合表达式阻塞；本轮不修改 Core。
3. 本轮只验证 controls-002/list-001 的加载、Mount 和 teardown，不扩展它们的事件、路由或业务验收。

状态：`PARTIAL_READY_EXTERNAL_BLOCKER`
# B4 JS/Core 公共链路修复（2026-08-25）

## 结论

已解除 B4 File/Fetch 在 JS ABI 入口被 `ABI_INVALID_ARGUMENT` 拒绝的阻塞。QuickJS 纯数据转换现在把普通对象中值为 JavaScript `undefined` 的自有属性按“字段未提供”处理；`RuntimeValue` 不增加 `undefined` 类型。必填字段缺失、`null`、错误类型和非法结构仍由公共 ABI schema 拒绝，未引入 JSON Bridge 或平台旁路。

`quickapp-runtime-core/src/page_ir.cpp` 当前已可重建；本次未对该文件做额外改动，Core clean/incremental build 和 18 个测试全部通过。

## 修改文件

- `quickapp-runtime-js/providers/quickjs/src/quickjs_provider.cpp`
  - 普通对象属性值为 `undefined` 时跳过该属性。
  - 数组 hole/undefined、访问器、Proxy、函数、Symbol、BigInt 等既有严格拒绝语义保持不变。
- `quickapp-runtime-js/tests/js_s02_contract_tests.cpp`
  - 增加真实 QuickJS -> typed ABI -> Fake Core Port 测试：File/Fetch 可选字段为 `undefined`、合法字段、必填字段缺失、`null` 和错误类型。
- `quickapp-runtime-android/evidence/platform-001-android-b4-fixed-actions.log`
- `quickapp-runtime-android/evidence/platform-001-android-b4-fixed-actions.png`
  - 保存本次 Android 模拟器真实点击证据；未修改 Android Provider 业务代码。

## ABI 语义验收

| 场景 | 结果 |
|---|---|
| Fetch 可选 `httpMethod/headers/body/timeoutMs/responseType: undefined` | 字段省略，进入 Core，成功入队 |
| File 可选 `data: undefined` | 字段省略，进入 Core，成功入队 |
| 合法 Fetch 字段 | 成功编码并进入 Core |
| 必填 `requestId: undefined` | 缺失后被 ABI 拒绝 |
| `body: null` | ABI 拒绝 |
| `timeoutMs: "1000"` | ABI 拒绝 |

## 构建与测试

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core
cmake --build build-s04 -j 4
ctest --test-dir build-s04 --output-on-failure
```

结果：Core 构建通过，`18/18` 通过；包括 `page_ir.cpp` 所在 Core 目标。

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js
cmake --build build-s04 -j 4
ctest --test-dir build-s04 --output-on-failure -R '^js_s02_contract_tests$'
```

结果：JS 构建通过，`js_s02_contract_tests` 通过。全量 JS CTest 为 `10/11` 通过；唯一失败是既有 `js_s04_vm_lifecycle_tests` 的 `messages.size() == 5` 断言，不在本次改动路径。

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
npm run build
```

结果：Toolkit `86 passed, 0 failed`，TypeScript 构建通过。

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android
cmake --build build-host --target and_b04_feature_provider_tests -j 4
ctest --test-dir build-host --output-on-failure -R 'and_(s01|b04)'
./gradlew :app:assembleDebug --no-daemon
```

结果：Android host `2/2` 通过，Debug APK 构建成功；未修改 Android Provider 业务逻辑。

## Android 真实 RPK 链路

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/platform-001/dist/platform-001.rpk`
- 大小：`17171` bytes
- SHA-256：`79ace8e7a28eeef67c31ae3cb519af7c7e3a85c8556c8ecb4811456f3a49035d`
- 启动：`adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk platform-001.rpk`
- Prompt：既有真实日志 `platform-001-android.log` 显示 `module=0 method=2 status=completed`。
- File：本次真实点击日志显示 `module=4 method=6 status=completed`。
- Fetch：本次真实点击日志显示 `module=3 method=4 status=completed`。
- 最终 APK Prompt 日志：`quickapp-runtime-android/evidence/platform-001-android-b4-fixed-prompt.log`，同样显示 `module=0 method=2 status=completed`。

链路已验证为：

```text
JS Facade -> QuickJS RuntimeValue conversion -> typed ABI codec
-> Core ModuleRegistry/Invoker -> Android Provider -> FeatureResult
```

本次未修改 Android Provider、Core Bridge、Render Pipeline、Event Router、Navigation、LVGL、iOS 或已有 RPK。

## 剩余问题

1. `js_s04_vm_lifecycle_tests` 的既有消息数量断言仍需单独处理，不阻塞 B4 Feature 链路。
2. Android Provider 的业务状态矩阵仍沿用既有 host tests；本次补充的是 File/Fetch 从真实 JS ABI 到 Android Provider 的端到端证据。

# B6 URL 公共合同与 Toolkit 交接（2026-08-25）

## 结论

B6 已完成 `a` lowering、`system.openUrl` 和 `system.webview` 的公共 typed 合同，以及真实 `url-001.rpk`。应用内 `/...` 链接进入 Core Router；`external` 和 `webview` 链接进入对应 Platform Feature。`a` 复用既有 `Button` Host，不新增 WebView Host Component、第二棵 Tree 或旁路 Bridge。

## 修改范围

- Core Feature Registry：增加 `kSystemOpenUrl`、`kSystemWebview`、`kOpenUrl`、`kWebviewOpen`；未注册 Provider 时返回 `CAPABILITY_UNSUPPORTED`。
- JS ABI：增加 `openUrl/open`、`webview/open` 的严格编码和解码；URL 必须是非空 `http(s)` URL。
- JS Framework Facade：增加 `@app-module/system.openUrl` 和 `@app-module/system.webview` typed facade。
- Toolkit Frontend/Lowering：支持联盟 DSL `<a href="..." open-mode="external|webview">`；静态 `/...` 生成 `system.router.push`，外链生成 `system.openUrl.open`，WebView 链接生成 `system.webview.open`。
- Contract 文档/Schema：更新 Feature、Capability、Artifact 和 Schema 目录说明。
- Showcase：新增 `quickapp-examples/showcases/url-001/`，包含 Home/Detail 两页和三种 URL 语义。

未修改 Core Tree、Router 主链、Bridge/Render/Event 三大系统、Android、iOS、LVGL 或已有 RPK。未实现 Cookie、UA、网页 JS 双向通信、内嵌 WebView Host Component 或 WebView 内部路由。

## 真实 RPK

- 构建命令：`cd quickapp-examples/showcases/url-001 && node scripts/build-url.mjs`
- RPK：`quickapp-examples/showcases/url-001/dist/url-001.rpk`
- 大小：`24663` bytes
- 图片：`0` 张，`0` bytes
- 两次构建 SHA-256：`15f3827f0fd267633b11c0112e434b0c0bebcdd42cfa6cf41d92a4fb91666077`
- 入口：`/pages/Home`
- 路由：`/pages/Home`、`/pages/Detail`
- Manifest capabilities：`system.router`、`system.openUrl`、`system.webview`

产物由 Toolkit 从真实联盟 DSL 生成，未手写 Page IR、RenderTransaction 或 MountTransaction。Home Page JS 已核对：三个链接分别调用 Router、OpenUrl、Webview typed facade。

## 验证

- Toolkit：`npm test`，`88/88` 通过；包含 `TK-S15 url-001 lowers internal, external and webview links` 和 B6 RPK 确定性测试。
- Toolkit：`npm run build`，通过。
- Core：CMake build，通过；CTest `18/18` 通过，含新 URL 模块未注册时的 typed unsupported 测试。
- JS：CMake build，通过；`js_s02_contract_tests` `1/1` 通过，含 openUrl/webview ABI 编码、模块、方法和 URL 断言。
- 公共 Schema：`22 schemas / 91 union branches` 等合同校验全部通过。
- RPK：两次构建输出字节和 SHA-256 一致。

## 后续平台工作

Android、iOS、LVGL 需要各自注册 `system.openUrl` 和 `system.webview` Provider，并把结果接到平台浏览器/WebView；未注册时必须保持 `unsupported`，不能把 URL 模块错误映射为 File 或其他 Feature。该平台接入不属于本 B6 公共实现。

# B3.5 Tabs 公共实现交接（2026-08-25）

## 结论

B3.5 已完成受控 `Tabs` 的公共链路：联盟 DSL `<tabs>` 经 Toolkit lowering 为 `Tabs` Host Component，`selected` 通过既有 Page IR binding 更新，`change` 复用既有 Event Router。Tabs 是可裁剪 UI Component，不进入固定内核；本次没有新增 Bridge、Runtime Tree、Router、线程或平台实现。

## 修改范围

- Toolkit Frontend/Feature Matrix：识别 `tabs`、`items`、`selected` 和 `onchange`。
- Toolkit Canonical Lowering/Emitter：生成 `Tabs { items, selected }`，支持受控 `selected` number binding 和 `change` Handler。
- Core Page IR：增加 `HostComponentType::kTabs`、`Tabs` props 校验和 wire name；复用既有 `BindingProperty::kSelected` 与 `EventType::kChange`。
- Public Contract Schema：增加 `Tabs` host union 分支，并允许 Page IR binding target `selected`。
- Core/JS/Toolkit 定向测试：覆盖 Tabs props、selected binding、change payload 编解码、Emitter 和 RPK 确定性。
- Showcase：新增 `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/tabs-001/`，使用真实联盟 DSL 和受控状态展示三个 Tab。

未修改 Android、iOS、LVGL、已有 RPK、Router 主链、Render Pipeline、Event Router 语义或公共 Bridge。Toolkit 仍是唯一 RPK 生成入口，未手写 Page IR、RenderTransaction 或 MountTransaction。

## Tabs 合同

```text
Host: Tabs
Props: items: string (本地 | 分隔), selected: non-negative integer
Event: change({ index: integer, value: string })
Binding: selected <- number
```

平台若未声明或未实现 Tabs，应按既有可裁剪组件能力边界返回不支持；不得在平台侧创建第二棵树或第二套路由。

## 真实 RPK

- 构建命令：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/tabs-001 && node scripts/build-tabs.mjs`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/tabs-001/dist/tabs-001.rpk`
- 大小：`14878` bytes
- 图片：`0` 张，`0` bytes
- 两次构建：`deterministicBuild=true`
- SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`
- 入口：`/pages/Home`
- 页面：`pages/Home`
- Capability：`system.router`

## 验证

- Toolkit：`npm test`，`90/90` 通过；`npm run build` 通过。
- Core：CMake build 通过；CTest `18/18` 通过。
- JS：`js_s02_contract_tests` `1/1` 通过，覆盖 Tabs change event codec。
- Public Schema：`22 schemas / 92 union branches` 校验通过。
- RPK：两次构建字节和 SHA-256 一致。

## 剩余问题

Tabs 的公共语义和 RPK 已完成；Android、iOS、LVGL 的原生 Tabs 视觉和交互映射属于后续平台工作。本次未声称三端已渲染 Tabs，也未扩展虚拟化、复杂动画或多级路由能力。
