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

# B3.5 Tabs JS 初始绑定修复交接（2026-08-26）

## 结论

已修复 JS 初始绑定阶段拒绝 number 的阻塞。`AlphaInitialBindingStage` 现在接受并原样传递 `string`、`boolean`、`double`；非法对象等类型仍返回 `MODULE_ABI_UNSUPPORTED`。number 不转换为 string。

## 修改文件

- `quickapp-runtime-js/src/binding/alpha_initial_binding_stage.cpp`
- `quickapp-runtime-js/tests/js_s04_vm_lifecycle_tests.cpp`

未修改 Core Contract、Tabs Contract、Toolkit、RPK、Android、iOS 或 LVGL。

## 类型链路

```text
RPK Page IR selected:number
-> JS binding evaluator
-> AlphaInitialBindingStage: std::variant<std::string, bool, double>
-> AlphaInitialTransactionBuilder
-> InstantiateTemplate.initialBindings
-> Core/Platform 后续消费
```

## 验证

- JS 初始绑定测试覆盖 string、boolean、number；
- 非法 object 初始绑定仍失败，错误为：
  `Initial binding result must be string, boolean, or number`；
- `js_s01_contract_tests`：通过；
- `js_s02_contract_tests`：通过，Tabs event codec 通过；
- `js_s03_module_loader_tests`：通过；
- `js_s04_vm_lifecycle_tests`：通过；
- `tabs-001.rpk` Page IR 已确认 `Tabs.selected=0` 和 selected binding 存在；
- RPK SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`。

## 平台边界

现有 Examples Loader/Composition Root 使用 `tabs-001.rpk` 时会报告 `unsupported host component`，因为 Tabs 尚未接入平台 Host 映射。该问题不属于本次 JS 修复，也未在 JS 层绕过；后续由 Android、iOS、LVGL 平台 Agent 使用同一 RPK 完成 Tabs Host Mount 和交互验收。

状态：`READY_FOR_PLATFORM_TABS_VALIDATION`

# B3.5 Tabs 共享 JS ABI 增量 number 修复交接（2026-08-26）

## 结论

已修复共享 JS ABI 对增量 `updateBinding.value` 的类型校验缺口。现在 `updateBinding.value` 接受 `string | boolean | number`，number 保持为 `double`，不会转换为 string；数组、对象等非法类型仍返回 typed ABI failure。

本次只修改 `quickapp-runtime-js` 的 ABI 校验和 JS-S02 合同测试。没有修改 Core Contract、Toolkit、RPK、Android、iOS、LVGL、Router、Render Pipeline、Event Router 或任何平台类型转换。

## 修改文件

- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/src/abi/runtime_abi_codec.cpp`
  - `validRenderOperation(updateBinding)` 增加 `std::holds_alternative<double>`。
- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/tests/js_s02_contract_tests.cpp`
  - 增加 string、boolean、number 三种 updateBinding 解码断言。
  - 增加非法数组类型失败断言。

已有 `BindingValue = std::variant<std::string, bool, double>` 和既有 number 解码分支未改动；本次只修正入口白名单，保持现有 typed ABI 设计。

## 类型合同

```text
updateBinding.value:
  string  -> BindingValue::string
  boolean -> BindingValue::bool
  number  -> BindingValue::double
  array/object/null -> ABI_INVALID_ARGUMENT
```

Tabs 的目标链路现在可以通过 JS ABI 合同边界：

```text
Tabs change({index:number, value:string})
-> JS Handler writes selected
-> updateBinding(selected:number)
-> validRenderOperation
-> decodeCoreMessage
-> UpdateBindingOperation.value = double
```

本次未在平台侧增加 number 转换，也未创建旁路 ABI、第二套路由或第二棵 Tree。

## 验证

- JS CMake build：通过。
- JS 定向及相关全量 CTest：`9/9` 通过，包含 `js_s01_contract_tests`、`js_s02_contract_tests`、`js_s03_module_loader_tests`、`js_s04_vm_lifecycle_tests` 和边界扫描。
- JS-S02：string、boolean、number updateBinding 均保持原生类型；非法数组返回失败。
- 真实 RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/tabs-001/dist/tabs-001.rpk`。
- RPK SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`。
- RPK `unzip -t`：通过，未重新生成 RPK。

## 真实入口回归边界

已重建既有 LVGL Simulator 并使用上述真实 RPK 启动；当前结果为：

```text
case001_lvgl_error=RPK open failed: Runtime component unavailable
```

该错误发生在现有 Examples Composition Root/运行装配入口，不是本次 JS ABI 校验结果；本任务明确禁止修改 `quickapp-examples`、LVGL 或平台代码，因此不能据此报告完整平台链路通过。后续由平台 Agent 修复或验证 Runtime Composition 后，再重跑 Tabs 点击、状态回写、MountTransaction 和 teardown。

状态：`READY_FOR_PLATFORM_TABS_REVALIDATION`

# Commerce-001 主展示案例升级交接（2026-08-26）

## 结论

`commerce-001` 已升级为主展示案例：一个 Home 页面内使用受控 Tabs 展示首页、分类、购物车、我的四个状态内容；首页保留商品 Image/Text/Button、状态切换、`if`、keyed `for` 和商品详情 `router.push/back`。四个 Tab 没有被实现为四个并行页面或四套路由。

## 修改文件

- `quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
  - 接入真实 `<tabs items="首页|分类|购物车|我的" selected="{{ selectedTab }}" onchange="onTabChange">`。
  - `onTabChange` 使用 `{ index, value }` 更新 `selectedTab`、`selectedValue`。
  - Tab 内容通过 `selectedTab === 0/1/2/3` 的 `if` Block 状态驱动渲染。
  - 首页保留三项商品 keyed `for`、Image、Text、Button、加载状态 `if`、确定性状态刷新和详情入口。
  - 商品详情继续通过 `router.push({ uri: '/pages/ProductDetail' })` 进入。
- `quickapp-examples/showcases/commerce-001/src/manifest.json`
  - 路由收敛为 `/pages/Home` 和 `/pages/ProductDetail`。
  - 保留 `system.router`、`system.prompt`。
- `quickapp-examples/showcases/commerce-001/README.md`
  - 更新案例能力和路由说明。
- 未修改 Core、JS、Platform Runtime、公共 Contract、`quickapp-code-test1`、`controls-001` 或 `wallet-001`。

## 真实 RPK

- 构建命令：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001
node scripts/build-commerce.mjs
```

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`49563` bytes
- SHA-256：`ca41387ecd21513a81cf98c256ae44b18517ba5a3885e69f5358c49955bb5f20`
- 第二次构建：SHA-256 相同，`deterministicBuild=true`
- 入口：`/pages/Home`
- 路由：`/pages/Home`、`/pages/ProductDetail`
- capabilities：`system.router`、`system.prompt`
- 图片：3 张本地 PNG，均为 32x32；总计 `5717` bytes，单张不超过 4 KiB。

## RPK 结构验收

- Home Host：包含 `Tabs`、`Image`、`Text`、`Button`。
- Tabs props：`items="首页|分类|购物车|我的"`、`selected=0`。
- Home bindings：包含 Tabs `selected` binding、状态文本 binding 和商品 block binding。
- Home blocks：包含四个 Tab 条件 Block、loading 条件 Block、稳定状态条件 Block、keyed `for` 商品 Block，共 7 个 Block。
- Home handlers：Tabs `change`、商品详情 `click`、刷新 `click`。
- ProductDetail：包含 Image/Text/Button 和返回 `click` Handler。
- manifest、Page IR、JS bundle、三张图片资源均进入 RPK。

## Toolkit 验证

- `npm test`：`90/90` 通过。
- `node scripts/build-commerce.mjs`：通过。
- RPK 构建两次字节和 SHA-256 一致。

## 平台边界

本交接只确认 Toolkit 生成的真实 RPK 和 Page IR 结构。Android、iOS、LVGL 尚未在本任务中验证 Tabs 的原生 Mount、视觉布局、点击 `change({index,value})`、selected 回写以及商品详情 push/back；后续平台 Agent 使用该 RPK 验收，不在案例中补造 Tabs、Bridge、Runtime Tree 或 Navigation。

状态：`READY_FOR_PLATFORM_SHOWCASE`

# Tabs 内容不切换：共享 JS ABI 与 RenderTransaction 回归交接（2026-08-26）

## 结论

已确认并修复 Tabs 内容不切换的共享 JS ABI 阻塞：增量 `updateBinding.value` 的校验此前拒绝 number，导致 JS Handler 生成的 RenderTransaction 在 ABI 入口失败。现在 number 原样保持为 `BindingValue::double`，RenderTransaction 可以进入 Core ingress。

本次只修改 JS Runtime 及 JS 测试；没有修改 Core、Toolkit、RPK、Android、iOS、LVGL、平台状态、Bridge 架构、Runtime Tree 或 Router。

## 修改

- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/src/abi/runtime_abi_codec.cpp`
  - `updateBinding.value` 合法类型从 `string | boolean` 修复为 `string | boolean | number`。
- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/tests/js_s02_contract_tests.cpp`
  - 保留三种类型解码测试和非法类型失败测试。
  - 增加 QuickJS Handler 回归：Handler 调用 `$quickapp_runtime_v1_submitRenderTransaction$`，`selectedTab=2` 作为 number 进入 Core，Core 收到一个 `SubmitRenderTransaction`，其 `UpdateBindingOperation.value` 仍为 `double(2.0)`。

## JS 公共链路证据

```text
Tabs change({index: 2, value: "我的"})
-> JS Handler: selectedTab = event.index
-> JS microtask flush
-> updateBinding(templateBindingId=1, value=2)
-> Runtime ABI validator accepts number
-> decodeCoreMessage
-> CoreIngressPort receives SubmitRenderTransaction
-> UpdateBindingOperation.value == double(2.0)
```

生成式页面代码中的 `flush` 同时会把受 `selectedTab` 依赖的 `if` Block 操作合并进同一个 RenderTransaction；本次 JS 测试验证的是公共入口和 number 类型，不在 JS 层复制 Core Tree 或平台 Mount。

## 验证

- JS CMake build：通过。
- JS 全量 CTest：`11/11` 通过。
- JS-S02：string、boolean、number、非法数组类型均通过；QuickJS Handler -> native ABI -> Core RenderTransaction 回归通过。
- `tabs-001.rpk` SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`。
- `commerce-001.rpk` SHA-256：`97905939e1c0d9cd77bf642bde1d95c69279f34cfdac3f6a9d498a3328c724e1`。
- 两个真实 RPK 均通过 `unzip -t`；本次未重新生成或修改 RPK。

## 真实 RPK 入口边界

使用现有 Examples JS Composition Root 分别启动上述两个真实 RPK，当前均返回：

```text
RPK open failed: Runtime component unavailable
```

因此本次能够确认 JS 公共 RenderTransaction 已产生并可被 ABI 接收，但不能在 JS-only 任务中伪造“平台页面内容已切换”或“平台 teardown 已归零”。真实页面内容变化和 teardown 必须由 Android/iOS/LVGL 平台 Agent 在其 Runtime Composition Root 修复/接入后继续验收。

状态：`READY_FOR_PLATFORM_CONTENT_REVALIDATION`

# V1 最终验收 Showcase RPK 交接（2026-08-26）

## 结论

已生成三份真实联盟 DSL RPK：能力总览 `capability-gallery-001`、移动端展示 `commerce-001`、嵌入式展示 `wearable-001`。三包均由现有 Toolkit 生成，未手写 Page IR、RenderTransaction、MountTransaction、第二套路由或平台旁路。

## 交付物

### capability-gallery-001

- 源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/capability-gallery-001/`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/capability-gallery-001/dist/capability-gallery-001.rpk`
- 大小：`236469` bytes
- SHA-256：`46ab31154fe53a3ea99692f802d9e030ec71f554bcd7979ce236dddc2db38f2a`
- 路由：Home、View、Text、Button、Image、Input、Switch、Slider、Picker、List、Scroll、Tabs、Prompt、Fetch、File、Device、Navigation、NavigationDetail
- Host 覆盖：View、Text、Button、Image、Input、Switch、Slider、Picker、List、Scroll、Tabs
- Feature 覆盖：`system.router`、`system.prompt`、`system.device`、`system.fetch`、`system.file`
- 首页按能力分组分页，每次只挂载 4 个条目；每个条目进入独立能力页并经 Core Router 返回。
- 资源：1 张 32x32 PNG，`1720` bytes。

### commerce-001

- 源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`46122` bytes
- SHA-256：`0eaeb9a71f11c2119c86119f253af122511867eb5b388fa682b14719456a9a4f`
- 路由：Home、ProductDetail
- 能力：受控 Tabs、Image/Text/Button、keyed `for`、状态 `if`、确定性刷新、商品 push/back。
- 资源：3 张 32x32 PNG，总计 `5717` bytes。

### wearable-001

- 源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001/`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001/dist/wearable-001.rpk`
- 大小：`37243` bytes
- SHA-256：`ba62accc70a63ba73b3154db85bf2e613eea3153b936d49e988cfaef97fdba38`
- 路由：Home、Detail
- 能力：220x220 安全区域、Scroll -> List、keyed `for`、Image/Text/Button、状态刷新、push/back。
- 资源：2 张 32x32 PNG，总计 `3716` bytes。

## 构建与验证

三个案例分别执行：

```text
node scripts/build-capability-gallery.mjs
node scripts/build-commerce.mjs
node scripts/build-wearable.mjs
```

每个案例连续构建两次，产物 SHA-256 一致；Toolkit `npm test`：`90/90` 通过。Examples Composition Root 已统一注册 11 个 Host Component，并为三份最终 Showcase 的自动入口提供真实 Loader/Mount/teardown 路径。

LVGL 自动验收命令：

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/capability-gallery-001/dist/capability-gallery-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/commerce-001/dist/commerce-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/wearable-001/dist/wearable-001.rpk
```

结果：三包均 `rpk.loader=true`、`rpk.lvgl_mount=true`、`resources_released=true`、退出码 `0`。既有 Case 001、CASE-002、BLOCK-001 回归均退出码 `0`。

## 平台边界

- 本轮未修改 Core、JS Runtime、Android、iOS 或 LVGL Runtime 实现。
- Android/iOS 尚未使用三份最终 Showcase 做真实设备/模拟器视觉与交互验收。
- `system.device` 在不提供该能力的平台上应展示真实 `unsupported/failed`，不由案例伪造结果；`system.fetch/file/prompt` 使用当前已定义 typed ABI。
- `system.openUrl`、`system.webview` 未放入三包最终 capability manifest，因为它们当前不是三端共同可加载能力；对应 Toolkit Fixture 保持独立。

状态：`READY_FOR_ANDROID_IOS_SHOWCASE_VALIDATION`

# Examples Composition Root 公共入口修复（2026-08-26）

## 结论

LVGL Simulator 与自动验收入口现在共用同一份 Examples Composition Root
组件/能力清单。11 个已实现 Host Component 均已纳入：View、Text、Button、
Image、Input、Switch、Slider、Picker、List、Scroll、Tabs。真实 Feature
入口纳入 system.prompt、system.fetch、system.file，并保留 system.router、
system.device、system.shortcut 以兼容既有联盟基线；移除了当前 Provider 不支持
的 system.openUrl、system.webview 注册。

旧的 `Feature::Request` 位置聚合初始化已改为按当前字段名初始化，避免结构扩展
后继续产生编译错误。

## 修改文件

- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/composition/runtime_composition.h`
- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/composition/case001_lvgl.cpp`

未修改 Core、JS ABI、Toolkit、LVGL、Android、iOS 或任何 RPK。

## 构建

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 --target quickapp_case001_lvgl quickapp_lvgl_simulator -j 4
```

结果：两个入口均构建通过。

## 五个真实 RPK

命令统一为：

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/<case>/dist/<case>.rpk
```

| RPK | Loader | LVGL Mount | teardown | 结果 |
|---|---:|---:|---:|---|
| controls-001.rpk | PASS | PASS | PASS | exit 0；Input/Switch/change 真实回归通过 |
| controls-002.rpk | PASS | BLOCKED | PASS（资源归零） | LVGL Mount 拒绝 Slider 的 `enabled` 属性；非入口注册问题 |
| list-001.rpk | PASS | PASS | PASS | exit 0；List/Scroll/资源归零 |
| tabs-001.rpk | PASS | PASS | PASS | exit 0；Tabs/if/状态绑定/资源归零 |
| platform-001.rpk | PASS | PASS | PASS | exit 0；prompt/fetch/file 页面真实 Mount，资源归零 |

`controls-002` 的 RPK 已不再出现 `Runtime component unavailable`；入口现在会将
Mount 失败转为明确的 `rpk.lvgl_mount=false` 结果并完成资源清理。失败发生在
LVGL Mount 属性执行阶段。其 `Slider` 初始 Page IR 含 Toolkit 自动补出的
`enabled=true`，当前 LVGL MountHost 只接受 Button/Input/Switch 的 enabled 属性。
修复该平台属性合同需要修改 `quickapp-runtime-lvgl`，本任务明确禁止，因此不在
Examples Composition Root 中伪造、过滤或重写 Render/Mount Transaction。

## 既有回归

- Case 001：PASS，exit 0，真实路由/事件/Prompt/teardown 通过。
- CASE-002：PASS，exit 0，增量更新、removeBlock、moveBlock 通过。
- BLOCK-001：PASS，exit 0，keyed 身份、删除/重建和资源归零通过。

## 状态

`READY_FOR_PLATFORM_FIX_CONTROLS_002`：公共入口阻塞已修复；剩余唯一问题是
controls-002 对应的 LVGL `Slider.enabled` 属性兼容性，属于平台 Mount 实现范围。

# 公共入口复核（2026-08-26）

本轮按前置条件重新复核，未新增代码范围；当前入口实现已满足组件、Feature
注册和显式 `Request` 初始化要求。

## 复核结果

- 构建 `quickapp_case001_lvgl`：PASS。
- 构建 `quickapp_lvgl_simulator`：PASS。
- `controls-001.rpk`：Loader PASS，真实 Mount PASS，teardown PASS，exit 0。
- `controls-002.rpk`：Loader PASS；Mount 仍因 LVGL `Slider enabled=true` 属性拒绝而 BLOCKED；入口明确输出 `rpk.lvgl_mount=false`，资源清理 PASS，exit 0。
- `list-001.rpk`：Loader PASS，真实 Mount PASS，teardown PASS，exit 0。
- `tabs-001.rpk`：Loader PASS，真实 Mount PASS，teardown PASS，exit 0。
- `platform-001.rpk`：Loader PASS，真实 Mount/Feature Provider 入口 PASS，teardown PASS，exit 0。

五个 RPK 均未出现 `Runtime component unavailable` 或 `Runtime capability unavailable`。

## 旧案例回归

- Case 001：PASS，exit 0，资源归零。
- CASE-002：PASS，exit 0，资源归零。
- BLOCK-001：PASS，exit 0，资源归零。

当前唯一剩余问题仍是 `controls-002` 的 LVGL 平台 Mount 属性兼容性；本任务禁止
修改 LVGL，因此不在 Examples Composition Root 中伪造通过。

# Toolkit Agent Skill 文档（2026-08-26）

## 结论

已新增 Toolkit Agent Skill：

`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit/skills/quickapp-toolkit/SKILL.md`

文档按当前实现区分了真实 CLI 合同、已实现的编译器/RPK Builder 能力和
尚未安装的 `build`、`inspect`、`run` Use Case，没有修改 CLI 行为。

## 实际 CLI

- 入口：`dist/cli/bin.js`；`package.json` 的 `quickapp` binary 指向同一入口。
- 已注册命令：`build`、`inspect`、`run`。
- 通用参数：`--config <path>`、`--format human|json`、`--no-color`、`--help`。
- 顶层参数：`--help`、`--version`。
- 默认 standalone Composition Root 中没有安装 Build/Inspect/Run Use Case；`build`
  进入操作阶段后返回 `TK_OPERATION_UNAVAILABLE`，`inspect` 和 `run` 同样如此。
- 退出码合同：成功 `0`；用法错误 `2`；Workspace 错误 `3`；配置错误 `4`；
  操作失败或非信号取消 `10`；内部错误 `70`；SIGINT `130`；SIGTERM `143`。

## 验证

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm run build
npm test
node dist/cli/bin.js --help
node dist/cli/bin.js --version
node dist/cli/bin.js inspect sample.rpk --format json
node dist/cli/bin.js unknown --format json
node ../quickapp-examples/showcases/gallery-001/scripts/build-gallery.mjs
unzip -t ../quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk
```

结果：TypeScript 构建通过；Toolkit 测试 `90/90` 通过；Gallery-001 使用真实
Toolkit Compiler、Page IR/JS Emitters 和 RuntimeArtifactBuilder 构建成功，生成
`gallery-001.rpk`，报告 `status=PASS`，RPK 为 `39154` bytes，`unzip -t` 通过。
Gallery-001 包含 `manifest.json`、`app.js`、两个页面 JS、两个 Page IR、runtime
metadata、source maps 和三张本地图片资源。

CLI 探针结果：`--help` 和 `--version` 为 `0`；保留的 `inspect` 为 `10` 并返回
`TK_OPERATION_UNAVAILABLE`；未知命令为 `2` 并返回 `TK_CLI_UNKNOWN_COMMAND`。
直接执行默认 `build` 也不会伪造成功：无 Workspace 时返回 `3`，在真实 Workspace
路径下因 Build Use Case 未安装返回 `10`。

## 已覆盖与未覆盖

已在 Skill 中记录：Workspace/manifest 输入、`.ux` template/style/script 解析、
module graph、Host/style/binding/handler/if/for lowering、Page IR、JS module
emission、runtime metadata、资源打包、schema/relation/ABI/determinism/diagnostic
校验和真实 RPK 完整性检查。

未覆盖或待后续实现：standalone CLI 的真实 Build Use Case、CLI `inspect` 业务逻辑、
CLI `run` 业务逻辑、Toolkit 内置独立 RPK inspect 命令、Toolkit 内置 MCP/Skill
执行器、Runtime Loader 验收和 Benchmark 报告。这些未在本次文档任务中补实现。

# Wearable-001 LVGL 嵌入式平台验收交接（2026-08-26）

## 输入与构建

- 实际输入：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001/dist/wearable-001.rpk`
- SHA-256：`ba62accc70a63ba73b3154db85bf2e613eea3153b936d49e988cfaef97fdba38`
- RPK 大小：`37243` bytes。
- LVGL 构建：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl && cmake --build build -j 4`，通过。
- 自动验收：`SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/wearable-001/dist/wearable-001.rpk`，退出码 `0`。

## 已验证

- 真实 RPK Loader、两个本地 Image 资源、220x220 小屏 Page IR 和 LVGL Mount 通过。
- 真实 Page IR 包含 Image/Text/Button/Scroll/List、keyed `for` 和 `if`；初始 Mount 为 `25` 个 nodes、`6` 个 handlers。
- Initial Mount：`revision=0`、`surface=srf:1`、`mounted=1`。
- teardown 前：`surfaces=1 nodes=25 handlers=6 mount_objects=25 roots=1`。
- teardown 后：`surfaces=0 nodes=0 handlers=0 mount_objects=0 roots=0`；JS handlers、module entries、VM surfaces、ABI entries、queue depth 均为 `0`。

## 未完成与边界

当前自动入口对最终 Showcase 使用 `mount_only` 模式，未真实执行点击、state/if/keyed for 可见刷新、Home -> Detail、Detail -> Home 和重复进入详情；这些不能标记为通过。持续 SDL Simulator 命令为：

`./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/wearable-001/dist/wearable-001.rpk --zoom 1.0`

当前环境返回 `case001_lvgl_error=SDL display creation failed`，无可用真实 GUI，因此没有合法 Simulator 截图。LVGL 平台 evidence：`quickapp-runtime-lvgl/evidence/wearable-001-embedded-acceptance.md`。

状态：`PARTIAL_ACCEPTANCE_GUI_INTERACTION_PENDING`。

## Android commerce-001 传统能力验收（2026-08-26）

结论：Android 使用真实 `commerce-001.rpk` 完成了 RPK 加载、Home 首屏、
Image/Text/Button、字符串/布尔状态刷新、keyed 商品 block、商品详情
`push/back` 和重复进入详情。Tabs 原生点击事件已到达 JS，但 numeric 受控
绑定和最终 teardown 资源归零证据仍未闭环。

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- SHA-256：`0eaeb9a71f11c2119c86119f253af122511867eb5b388fa682b14719456a9a4f`
- 构建：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android && ./gradlew :app:assembleDebug --no-daemon`
- 安装：`adb install -r app/build/outputs/apk/debug/app-debug.apk`
- 启动：`adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk commerce-001.rpk`
- 首屏证据：`quickapp-runtime-android/evidence/commerce-001-android-home.png`；真实日志包含 `rpk.verified`、`page.vm.ready`、`operations=179`、`mount.result ok=true`。
- Tabs：`分类` 原生选中样式变化，`input.tabs.change -> Event Router -> JS Handler` 通过；但 `selectedValue` 与 `if` 内容仍为首页，因为共享 `quickapp-runtime-js/src/abi/runtime_abi_codec.cpp` 的 `updateBinding` 仍拒绝 numeric value。Android 未使用平台状态绕过。
- 状态/keyed for：点击推荐状态产生 `revision=1`、`operations=11`、`mount.result ok=true`；商品 block handler 正常绑定。
- 路由：`srf:1 -> srf:2 -> srf:1` 通过；再次 `srf:1 -> srf:3 -> srf:1` 通过，日志含 `navigation.push`、`navigation.close`、`close.result`。
- 截图和日志：见 `quickapp-runtime-android/evidence/commerce-001-android.md` 及同目录 `commerce-001-android-*.png/.log`。
- Teardown：Activity 退出记录 `android.runtime.destroy.begin surfaces=3 nodes=49`，进程随后结束，未收到最终 `runtime.stopped surfaces=0 nodes=0` 回调；无 `AndroidRuntime` 崩溃，因此只能标记 `INCOMPLETE_EVIDENCE`，不能声称资源归零。
- 边界：本次只使用 `quickapp-runtime-android`；未修改 Core、JS、Toolkit、公共 Contract、Examples 或其他平台。

## Android commerce-001 更新 RPK 复验（2026-08-26）

更新后的真实 RPK 已重新同步、构建、安装并加载到 `emulator-5554`。

- 新 RPK SHA-256：`fb0420bf561224518c2278dcf468701aa889ba15e60aa75fa68ba95ae0377b8f`。
- 首屏、Image/Text/Button、keyed 商品 block、普通按钮状态刷新和商品详情两次
  `push/back` 均通过。
- 普通状态刷新已产生：`android.render.submit ... revision=1 ok=1`，说明 Core
  增量事务和 Android Mount 链路正常。
- Tabs 点击已产生 `input.tabs.change`、`event.change.dispatched=1` 和
  `handler_execute`；平台选中样式变化，但事件后没有 `android.render.submit`，
  `selectedTab` 驱动的 `if` 内容没有切换。最新公共 numeric ABI 已包含在构建中，
  因此当前应继续由 JS Framework/生成 RPK 的响应式提交路径定位，Android 不增加旁路状态。
- Teardown 记录 `android.runtime.destroy.begin surfaces=3 nodes=55`，进程随后退出，
  未收到 `runtime.stopped surfaces=0 nodes=0`；无崩溃，只能记为资源归零证据不完整。
- 详细证据：`quickapp-runtime-android/evidence/commerce-001-android-rpk-refresh.md`。

## iOS commerce-001 传统能力验收（2026-08-26）

结论：iOS 使用真实 `commerce-001.rpk` 完成首屏、UIKit Image/Text/Button、Tabs 原生切换、状态刷新、keyed 商品列表、商品详情两次 push/back、点击事件和最终平台资源清理。证据为 `PASS_WITH_PUBLIC_TAB_BINDING_NOTE`。

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- SHA-256：源文件与 iOS Bundle 内 RPK 均为 `0eaeb9a71f11c2119c86119f253af122511867eb5b388fa682b14719456a9a4f`。
- 构建：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios && cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4`。
- 运行：使用 `SIMCTL_CHILD_QUICKAPP_RPK=commerce-001`、`SIMCTL_CHILD_QUICKAPP_IOS_COMMERCE_ACTIONS=1`、`SIMCTL_CHILD_QUICKAPP_IOS_COMMERCE_TEARDOWN=1` 启动真实 iOS Simulator。
- 交互：Tabs index 1 重复切换、state button、商品 `node:20` 两次进入详情；详情 `node:8` 两次通过 Core Navigation 返回 Home。
- 资源：最终 `ios.runtime.platform.resources surfaces=0 nodes=0`，`ios.commerce.probe.teardown.completed=1`。
- 截图：`quickapp-runtime-ios/evidence/screenshots/ios-commerce-001-home-2026-08-26.png`、`ios-commerce-001-detail-2026-08-26.png`、`ios-commerce-001-home-final-2026-08-26.png`。
- 公共问题：Tabs 原生选中态和 `change` 事件通过，但选择“分类”后页面绑定文案仍为“首页”，且未产生后续 RenderTransaction；iOS 未绕过修复。`NSLog` 中文乱码仅影响日志显示，截图正常。
- 详细 evidence：`quickapp-runtime-ios/evidence/ios-commerce-001-2026-08-26.md`。

### commerce-001 更新后 reload（2026-08-26）

- Examples 更新后的 RPK SHA-256：`fb0420bf561224518c2278dcf468701aa889ba15e60aa75fa68ba95ae0377b8f`。
- iOS 已重新构建、安装并以 `SIMCTL_CHILD_QUICKAPP_RPK=commerce-001` 手动启动，Bundle 已包含新 RPK。
- 新版首屏截图：`quickapp-runtime-ios/evidence/screenshots/ios-commerce-001-home-reloaded-2026-08-26.png`。
- 已确认新版 Tabs 位于底部，商品卡片和文案更新已在 iOS Simulator 渲染。

### commerce-001 最新 reload（2026-08-26）

- 最新 RPK SHA-256：`97905939e1c0d9cd77bf642bde1d95c69279f34cfdac3f6a9d498a3328c724e1`，源文件与 iOS Bundle 一致。
- 已重新构建、安装并手动启动，进程：`79439`。
- 最新截图：`quickapp-runtime-ios/evidence/screenshots/ios-commerce-001-home-reloaded-latest2-2026-08-26.png`。
- 已确认最新商品卡片的大图、完整商品名/分类/价格和“查看详情”按钮均已渲染。

## iOS Tabs 增量状态更新验收（2026-08-26）

- 最新 RPK SHA-256：`d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`，源文件与 iOS Bundle 一致。
- iOS 已重新构建并链接当前工作区 JS Runtime；未修改 Core、JS、Toolkit、RPK 或公共 Contract。
- Tabs 实际 NodeId 为 `node:8`。自动执行 `index=1 -> index=2 -> index=3`，三次均经过 `ios.tabs.control -> ios.input.change -> Core Event Router -> ios.js.event.executed`。
- 原生 Tabs 选中态正确切换到“我的”，但三次事件后均没有 `ios.render.submit`，页面 `if` 内容未切换；证据截图：`quickapp-runtime-ios/evidence/screenshots/ios-commerce-001-tabs-index3-2026-08-26.png`。
- 同一版本状态按钮 `node:10` 可产生 `revision=1 operations=3` 的 RenderTransaction，说明 iOS 渲染和 boolean `if` 增量路径正常。
- 商品详情两次 push/back、重复进入和 teardown 通过；最终 `ios.runtime.platform.resources surfaces=0 nodes=0`。
- 边界：RPK Page IR 已包含 `Tabs.selected` binding，生成 JS 已执行 `this.selectedTab = event.index`，iOS 已发送 numeric `index`，JS ABI 已接受 `double`；剩余问题位于 JS Handler 执行之后、RenderTransaction 之前，需公共 JS/Core 侧继续定位，iOS 未绕过修复。
- 详细 evidence：`quickapp-runtime-ios/evidence/ios-commerce-001-2026-08-26.md`。

## commerce-001 Tabs 内容切换修复（2026-08-26）

结论：已修复。`selectedTab` 是 Tab 的唯一状态源；四个 Tab 各自拥有独立的
条件内容区，离开首页时商品 keyed `for` 数据清空，返回首页时恢复确定性商品集合，
因此不会再由首页商品内容持续遮挡其他 Tab。

### 修改

- 源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
- `onTabChange({ index, value })` 只写入 `selectedTab` 并根据其值切换首页商品数据；未新增
  `selectedValue`、`selectedContent` 或平台分支。
- `selectedTab === 0/1/2/3` 分别控制首页、分类、购物车、我的内容块。
- 首页保留 `if` 状态、keyed `for` 商品列表、商品详情 `router.push` 和详情返回逻辑。

### 构建与 RPK

- 构建命令：
  `cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001 && node scripts/build-commerce.mjs`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`53962` bytes。
- SHA-256：`eda6e8989359226ceb085885d5fcc83a0b700635fd0b1407b117329de9f67090`。
- 连续两次构建字节完全一致；RPK `unzip -t` 通过。
- 包内包含两个路由、三张本地图片、四个 `selectedTab` 条件分支、商品 keyed `for`，
  生成 JS 保留 `updateBinding`、`removeBlock`、`moveBlock`、`navigationPush` 和
  `navigationClose` 操作。

### 验证

- Toolkit：`npm test`，`90/90` 通过。
- LVGL：真实 RPK Loader、三张图片资源和首屏 Mount 通过，日志为
  `platform.mount.complete ... mounted=1`、`core.initial.complete ... completed=1`。
- 自动入口随后进入面向旧 Showcase 的通用点击探针并以 `exit=134` 结束；该入口没有
  commerce-001 的四 Tab 专用驱动，因此本次不把该退出码解释为四 Tab 交互通过，也不把
  teardown 标记为通过。
- 结构化 Tab 验收：四个 `selectedTab` 条件区均进入 Page IR；`onTabChange` 更新
  `selectedTab` 后会触发条件块重算，离开首页产生商品 block 移除，返回首页产生 keyed
  商品 block 重建。
- 当前 `quickapp_case001_lvgl` 对 commerce 使用首屏/资源/teardown 入口，没有四 Tab
  自动点击脚本；当前环境的 SDL GUI 入口返回 `SDL display creation failed`，因此四个 Tab
  的实际视觉点击仍需在可用 Android、iOS 或 SDL GUI 环境完成，不标记为 GUI 点击通过。

状态：`READY_FOR_PLATFORM_TAB_INTERACTION`。

## commerce-001 移动端页面布局修复（2026-08-26）

结论：已完成。Home 和 ProductDetail 不再依赖 `300px x 560px` 根页面尺寸；Home
使用可伸缩根节点、顶部 Header、中间 Scroll 内容区和底部 Tabs，商品列表位于 Scroll
内容中，不会覆盖底部 Tabs。

### 修改

- Home：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
  - 根节点改为 `width: 100%; height: 100%`，使用纵向布局和 `justify-content: space-between`。
  - 新增 Header 容器；Tabs 从顶部移动到根节点最后，保持 `width: 100%; height: 48px`。
  - 新增 Scroll 内容区，使用 `width: 100%; height: 70%`，商品列表和四个 Tab 内容均位于其内容壳内。
  - 商品卡片改为 `width: 100%`，文本和操作按钮使用稳定的响应式子布局。
- ProductDetail：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/ProductDetail/index.ux`
  - 根节点改为 `width: 100%; height: 100%`，保留原有详情和 `router.back()`。
- 未修改 Core、JS Runtime、Android、iOS、LVGL、公共 Contract 或旧案例。

### 构建与验证

- 构建命令：
  `cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001 && node scripts/build-commerce.mjs`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`54574` bytes。
- SHA-256：`fb0420bf561224518c2278dcf468701aa889ba15e60aa75fa68ba95ae0377b8f`。
- 连续两次构建字节完全一致；`unzip -t` 通过；Toolkit `90/90` 通过。
- Page IR 已确认：活动路由的根节点 `100% x 100%`，Scroll 内容区 `100% x 70%`，Tabs
  `100% x 48px`；Home/ProductDetail 的活动源码和生成 IR 不再包含 `300px` 或 `560px`
  根页面尺寸。`Live/Agent/Me` 是 manifest 未引用的历史源码，本次未纳入活动 RPK。
- 真实 LVGL Loader、图片资源和首屏 Mount 通过：`mounted=1`、`core.initial.complete=1`。

### 截图边界

- 当前环境 SDL GUI 返回 `SDL display creation failed`，无法生成本次新 RPK 的 Simulator 截图。
- Android/iOS 现有 commerce 截图对应旧 SHA-256 `0eaeb9...` 的 RPK，本次不复用、不标记为
  新布局截图；需要把新 RPK 部署到各平台后重新截取 Home、Tab、列表滚动和 Detail/back。
- 依据 Page IR 几何合同，常见 320x568 viewport 的垂直占用上界为
  `Header 82 + Content 70% + Tabs 48 + page padding 22 = 549.6px`，Tabs 保持在底部且
  内容区与 Tabs 不重叠；更高手机 viewport 保留更大间隔。

状态：`READY_FOR_ANDROID_IOS_LAYOUT_SCREENSHOT`。

## commerce-001 Tabs 商品列表条件切换复核（2026-08-26）

结论：已验证当前 V1 DSL 的可行实现。商品列表仍保持 keyed `for`，并由
`onTabChange` 以 `selectedTab` 为触发源将非首页 `products` 置空、回首页恢复确定性
商品集合；因此四个 Tab 的可见内容不会再被商品列表持续占用。

### 关键边界

曾按要求尝试同一元素：

`<div if="{{ selectedTab === 0 }}" class="product" for="{{ (index, item) in products }}" tid="id">`

当前 Toolkit 明确拒绝同一元素同时使用 `if` 和 `for`，构建错误为：
`One element cannot contain both if and for`。在不修改 Toolkit、Core、JS ABI 或公共
Contract 的约束下，不能提交该不可构建形式；最终源码保留现有可构建的 keyed `for`，并
使用 `selectedTab -> products=[]/恢复` 完成等价增量控制。

### 最终实现与验证

- 源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`54574` bytes。
- SHA-256：`fb0420bf561224518c2278dcf468701aa889ba15e60aa75fa68ba95ae0377b8f`。
- 两次构建 SHA-256 一致，字节完全一致；RPK `unzip -t` 通过。
- Toolkit：`90/90` 通过。
- Page IR：四个 `selectedTab === 0/1/2/3` 条件块、商品 keyed `for`、Tabs 的
  `selected` number binding 均存在；生成 JS 包含 `updateBinding` 和 `removeBlock`。
- 真实 LVGL：Loader、三张图片资源、首屏 Mount 通过，日志包含
  `platform.mount.complete ... mounted=1` 和 `core.initial.complete ... completed=1`。
- 当前 LVGL 自动入口没有 commerce 的四 Tab 专用点击驱动，通用点击探针执行到旧 Showcase
  路径后以 `exit=139` 结束；SDL GUI 入口在当前环境无法创建窗口。因此四 Tab 的平台点击、
  截图和四次可见内容切换不标记为已通过。

状态：`PARTIAL_TAB_RUNTIME_ACCEPTANCE_PENDING_PLATFORM_DRIVER`。

## commerce-001 20 条长列表展示（2026-08-26）

结论：已完成 20 条商品长列表展示。列表位于现有 Scroll 内容区，超过 viewport 后可
继续向下查看；四 Tab、首页条件区、刷新状态和详情入口仍保留。

### 实现边界

- 20 条商品行使用本地确定性文本，重复内容不影响长列表展示目标。
- 20 条行放在一个 `selectedTab === 0` 条件区内，避免创建 20 个动态 `for` block。
- 这是因为当前 LVGL 首次 Mount 事务对 20 个动态 block 实例会触发
  `QUEUE_OVERFLOW: Core Mount transaction exceeds LVGL bound`；本轮不修改 Core 或
  公共事务上限。
- 首页状态仍使用 `products.length`（20）、`selectedTab` 和 `refreshState`；刷新会轮换
  数据状态但不会把列表缩回 3 条；详情按钮继续走 `onProduct -> router.push`。
- 当前长列表展示案例不承担 keyed `for` 验收；keyed `for` 保留在其他 V1 基线案例中。

### 构建与验证

- 源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`66932` bytes。
- SHA-256：`91c33ac1b017c0b473d5798319e0049cc85c8dcbc4de3c16cab26790ed8e55b5`。
- 源码确认 `class="product"` 行数为 `20`。
- RPK 连续两次构建字节完全一致；`unzip -t` 通过。
- Toolkit：`90/90` 通过。
- LVGL 真实 RPK：Loader、资源加载和首屏 Mount 通过，日志包含
  `platform.mount.complete ... mounted=1`、`core.initial.complete ... completed=1`。
- 当前 `quickapp_case001_lvgl` 后续进入通用 Showcase 点击探针并以 `exit=139` 结束；
  当前 SDL GUI 无法创建窗口，因此本次没有合法的滚动截图或手动滚动日志。

状态：`READY_FOR_GUI_LONG_LIST_SCROLL_CHECK`。

## commerce-001 Android 最新 RPK 重新加载（2026-08-26）

结论：最新案例 RPK 已重新构建、复制进 Android APK、安装并在
`emulator-5554` 启动成功。Home 首屏、Image/Text/Button、20 条商品列表、ScrollView
和底部 Tabs 均已真实挂载。点击“分类”后，Android 原生 Tabs 选中态变化，事件也经过
Core Event Router 到达 JS `onTabChange`；但没有后续 `RenderTransaction`，页面仍显示
`当前栏目：首页`。因此案例产物已更新，但 Tabs 的 JS 状态到增量渲染仍为阻塞项。

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- RPK SHA-256：`91c33ac1b017c0b473d5798319e0049cc85c8dcbc4de3c16cab26790ed8e55b5`
- Android 资产 SHA-256：`91c33ac1b017c0b473d5798319e0049cc85c8dcbc4de3c16cab26790ed8e55b5`
- APK SHA-256：`7cf9e8fffd486a80006d054f82175390849ce87649728cddf9e2cda9090c1a78`
- 构建：`./gradlew :app:assembleDebug --no-daemon`
- 安装：`adb install -r app/build/outputs/apk/debug/app-debug.apk`
- 启动：`adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk commerce-001.rpk`
- 证据：`quickapp-runtime-android/evidence/commerce-001-android-rpk-reload-v3.md`
- 截图：`quickapp-runtime-android/evidence/commerce-001-android-category-v3.png`
- 日志：`quickapp-runtime-android/evidence/commerce-001-android-category-v3.log`

关键日志：

```text
android.input.tabs.change surface=srf:1 node=node:7 index=1 value=分类
android.event.change.received surface=srf:1 node=node:7
android.event.js_callback posted=1 error=
android.event.change.dispatched=1
android.event.handler_execute surface=srf:1 handler=hdl:3 dispatched=1
```

没有出现后续 `android.render.submit`。本次未修改 Core、JS、Toolkit、公共 Contract、
案例源码或其他平台；问题边界是“平台事件已送达，但 JS handler 未形成可见的增量渲染提交”。

## commerce-001 Android 最新 RPK 重新加载 v4（2026-08-26）

最新案例产物已重新构建并安装到模拟器，视觉布局更新已生效：Home 显示新的商品卡片、
图片、详情按钮、Scroll 内容和底部 Tabs。

- RPK SHA-256：`97905939e1c0d9cd77bf642bde1d95c69279f34cfdac3f6a9d498a3328c724e1`
- Android 资产 SHA-256：`97905939e1c0d9cd77bf642bde1d95c69279f34cfdac3f6a9d498a3328c724e1`
- APK SHA-256：`27968cc5fa67ff081ae89a95abc311d007cdf0f11569568eac6a29666de2bc63`
- 构建：`./gradlew :app:assembleDebug --no-daemon`
- 安装：`adb install -r app/build/outputs/apk/debug/app-debug.apk`
- 启动：`adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk commerce-001.rpk`
- 证据：`quickapp-runtime-android/evidence/commerce-001-android-rpk-reload-v4.md`

点击“分类”后的结果仍为部分通过：Android 原生 Tabs 选中态变化，事件到达 JS
`onTabChange`，但没有后续 `RenderTransaction`，页面仍显示“当前栏目：首页”。本次未修改
Core、JS、Toolkit、公共 Contract、案例源码或其他平台。

## commerce-001 Android 最新 JS ABI 验收（2026-08-26）

Android 已重新链接当前工作区的 JS ABI，使用最新真实 RPK 完成验证：

- RPK SHA-256：`d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`
- Android 资产 SHA-256：`d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`
- APK SHA-256：`9e2600be195367259984be86525de659251355fb8ebbabf669550218acfb1fc9`
- 构建：`./gradlew :app:assembleDebug --no-daemon`
- 安装：`adb install -r app/build/outputs/apk/debug/app-debug.apk`
- 启动：`adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk commerce-001.rpk`
- 证据：`quickapp-runtime-android/evidence/commerce-001-android-jsabi-validation.md`

结论：普通“切换推荐状态”已经证明 `updateBinding.value` 的 number 路径可用，日志为
`android.render.submit ... revision=1 ok=1` 和 `mounted=1`。Tabs 的“分类/购物车/我的/首页”
四次切换均完成 `Android Input -> Core Event Router -> JS Handler`，但没有后续
`RenderTransaction`，条件内容仍停留在 Home。该阻塞不在 Android 输入、RPK 加载或公共
数字 ABI 校验，而在 Tabs handler 触发后的 JS 增量提交路径。

页面内详情返回回归通过两次：`srf:1 -> srf:2 -> srf:1`，再
`srf:1 -> srf:3 -> srf:1`。teardown 后进程已停止且无崩溃；Android 强制停止不会回传
Runtime 最终零资源回调，因此不宣称 `surfaces=0`。

## LVGL Mount Batch 收口（2026-08-26）

结论：已完成首次 Mount 的分批提交能力验证；单批操作预算仍为 256，超过预算的完整
Runtime Tree 会按依赖顺序拆成多个 Batch，全部成功后才显示。

- 修改项目：`quickapp-runtime-core`、`quickapp-runtime-lvgl`、`quickapp-examples`。
- 协议：每个 Batch 携带 `transactionId`、`batchIndex`、`batchCount`、`isFinal`。
- 顺序：CreateHost -> props/styles -> layout -> InsertHostChild。
- 失败语义：任一 Batch 失败，释放本次 Surface 创建的全部 LVGL 对象并返回一次失败；旧
  Runtime 状态不提交。
- 真实 Fixture：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/long-list-001/dist/long-list-001.rpk`。
- RPK SHA-256：`b0b6e2ea980a46b8a478f3c7d00f554ef62bfa8b528159f9c060848ad88f82e2`。
- 真实运行：Loader、资源加载、两批 Mount、最终 Core commit 和 root visible 均通过。
- 测试：`lv_s07_batched_mount_tests` 的成功、首批失败、中间批失败、末批失败均通过；
  旧 LVGL S03/S04/B35 回归通过；Examples 和 LVGL 构建通过。
- 退出说明：dummy SDL 运行使用 `alarm 3` 仅用于终止持续 Simulator，退出码 134 是人工
  SIGALRM，不是 Mount 或 Runtime 崩溃；GUI 运行应不加 alarm，直到用户关闭窗口。
- 资源：失败回滚和 teardown 后 Surface、Runtime Node、Handler、Mount Object 归零。
- 公共架构：未新增 Tree、Router 或 Bridge；Render Contract 仅增加向后兼容的 Batch 元数据。
- 状态：`READY_FOR_ARCH_REVIEW`。

## commerce-001 商品卡与详情增强（2026-08-26）

结论：移动端 commerce-001 已从窄文本行收敛为可展示的商品卡；每条卡片包含本地商品图、标题、分类/状态、价格和详情入口，点击后通过现有 JS Handler 与 `router.push` 进入 ProductDetail，返回仍使用 `router.back`。

- 修改源码：
  - `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
  - `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/ProductDetail/index.ux`
- 商品卡：`112px` 高；本地 `32x32` PNG 以 `64x64` Host Image 布局展示；价格使用 `item.price`；列表保留 keyed `for` 和现有 Scroll 内容区。
- 详情：20 个商品 ID 均有稳定的标题、分类/状态和价格；详情入口保持 `/pages/ProductDetail`，返回保持 `router.back()`；未新增路由、Tree、Bridge 或平台逻辑。
- 构建命令：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001 && node scripts/build-commerce.mjs`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`61815` bytes。
- SHA-256：`97905939e1c0d9cd77bf642bde1d95c69279f34cfdac3f6a9d498a3328c724e1`；连续两次构建一致。
- 资源：三张本地 `32x32` PNG，总字节 `5717`，未引入网络资源。
- Toolkit：`90/90` 通过。
- 语法约束：页面 VM 不支持 `ForStatement`，商品选择采用现有静态 Handler 后缀匹配；未修改 Runtime 或公共 Contract。
- 平台状态：源码和 RPK 已完成；当前 LVGL Simulator 对 20 条富卡片仍需单独处理已有 Mount 批处理后的平台对象创建失败，不能将其误记为商品点击或 Toolkit 失败。

状态：`READY_FOR_ANDROID_IOS_SHOWCASE_RELOAD`。

## commerce-001 冗余栏目文本清理（2026-08-26）

移除 Home 顶部重复显示的“当前栏目：首页/分类/购物车/我的”。Tabs 本身已经表达当前栏目，该文字不承载状态、渲染或验收语义，保留会增加移动端首屏噪音。

- 修改：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`59160` bytes。
- SHA-256：`d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`；构建脚本报告连续构建一致。
- 商品图片、价格、详情 `router.push/back`、20 条列表和四个 Tabs 内容未改变。

## commerce-001 商品详情页增强（2026-08-26）

结论：ProductDetail 已升级为标准电商详情结构，仍完全基于现有联盟 DSL 和既有 Runtime 能力。

- 详情页增加商品主图、商品标题、分类/状态、价格、销量、标签、配送与服务、规格、商品说明。
- 增加“加入购物车”和“立即购买”两个确定性本地状态操作，分别通过 `if` 显示操作结果；不接支付、网络或存储。
- 保留顶部返回和底部返回首页，均通过现有 `router.back()`；详情页内容放入 `Scroll`，适配移动端较长信息布局。
- 修改源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/src/pages/ProductDetail/index.ux`
- 构建命令：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001 && node scripts/build-commerce.mjs`
- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`67390` bytes。
- SHA-256：`6ee994ef0fa8e38e561ef1373b9f60beeda58b4afa0c033690a199e8ac75827f`；构建脚本报告连续构建一致。
- Toolkit：`91/91` 通过。
- 兼容修复：样式 `align-items: baseline` 不属于当前 Toolkit 合法枚举，已改为 `center`。

状态：`READY_FOR_ANDROID_IOS_DETAIL_SHOWCASE`。

## 长列表能力收口（2026-08-26）

### 阶段一：MountBatch + 队列背压

状态：`READY_FOR_ARCH_REVIEW`。

- 单批操作上限仍为 `256`，没有通过扩大上限规避问题。
- Core Mount 操作保持依赖顺序：CreateHost -> props/styles -> layout -> InsertHostChild。
- LVGL Batch 继续携带 `batchIndex`、`batchCount`、`isFinal`；同一逻辑事务全部成功后才 Present。
- CoreMountBridge 增加有限的保留批次内存预算和待处理 Batch 深度；预算不足返回
  `kOutOfMemory`，队列满返回可重试的 `kQueueOverflow`，两者都不崩溃、不静默丢事务。
- MountHost 增加单批内存预算和队列深度；批次转换后按实际操作数收缩 vector，256 仍是
  操作预算而不是无限内存分配。
- 任一 Batch 失败仍释放本次 Surface 创建的全部 LVGL 对象，旧状态不提交。
- 真实 RPK：
  `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/long-list-001/dist/long-list-001.rpk`
- RPK SHA-256：`b0b6e2ea980a46b8a478f3c7d00f554ef62bfa8b528159f9c060848ad88f82e2`。
- 真实运行：Loader、20 条长列表首屏、分批 Mount、最终 commit 和 root visible 通过。
- 回滚测试：首 Batch、中间 Batch、末 Batch 失败均通过，资源归零。

### 阶段二：VirtualList 最小物理窗口

状态：`PHYSICAL_WINDOW_READY_FOR_RUNTIME_CONTRACT_INTEGRATION`。

- 新增 LVGL `VirtualListWindow` 和 `VirtualListHost`：固定行高、纵向窗口、scrollOffset、
  keyed item 到物理 slot 的稳定复用、点击命中、对象创建上限和 teardown。
- 直接测试覆盖 1000 条逻辑 item、8 个物理槽位、滚动边界、同 key 槽位保持、重复 key
  拒绝和 LVGL object 释放。
- 测试：`lv_s08_virtual_list_tests` 通过；物理对象峰值不超过 8，初始 1000 条逻辑数据
  只创建 6 个可见窗口对象。
- 当前尚未把标准 RPK 的 `List` 自动接入 `VirtualListHost`。原因是现有 MountTransaction
  只有逐节点操作，没有携带逻辑列表项、key、可见范围和物理复用描述；在 Examples 或
  LVGL Composition Root 中旁路创建会违反 Core 唯一 Runtime Tree 和事件权威。
- 因此 `long-list-001` 已验证 MountBatch 长列表，但不标记为“真实 RPK VirtualList 滚动
  已完成”。下一步应先增加向后兼容的 VirtualList Mount Contract，再由 Core 生成逻辑项
  映射，LVGL Host 接管可见窗口；不应在当前阶段继续旁路扩展。

### 回归

- Toolkit：`npm test`，`90/90` 通过。
- Examples：`cmake --build build-m1-s2 -j 4`，通过。
- LVGL：`lv_s01`、`lv_s03`、`lv_s04`、`lv_s07`、`lv_s08`、`lv_b35` 相关 CTest 全部通过。
- SDL dummy 运行使用 `alarm 3` 终止持续 Simulator 时退出码为人工 `SIGALRM` 的 `134`；
  Mount 日志已显示成功，不是 Runtime 崩溃。

修改范围：`quickapp-runtime-core` Mount 元数据/阶段顺序、`quickapp-runtime-lvgl` Batch
背压/预算/VirtualList Host、`quickapp-examples` long-list-001 Fixture；未修改 Android、
iOS、Toolkit、Timer、第二棵 Tree、第二套路由或旁路 Bridge。

## LVGL commerce-001 Tabs 增量验证（2026-08-26）

状态：`BLOCKED_BEFORE_TABS_EVENT`

本轮重新构建并加载真实 `commerce-001.rpk`。Composition Root 已包含 `Tabs`，共享 JS ABI
已支持 `updateBinding.value` 为 number，RPK 未被修改。

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- SHA-256：`d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`
- 构建：`cmake --build /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/build-m1-s2 --target quickapp_lvgl_simulator -j 4`，通过。
- Toolkit：`npm test`，`90/90` 通过。
- JS ABI：`cmake --build /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-js/build-m1-s2 --target js_s02_contract_tests -j 4` 和对应 CTest，通过。
- LVGL Tabs：`lv_b35_tabs_mount_tests`、`lv_s04_mount_contract_tests`，`2/2` 通过。
- commerce 真实加载：RPK 打开、三张图片资源加载、JS app/page 初始化均通过；首次 Mount 返回
  `PLATFORM_REJECTED: host object creation failed`，因此未进入 Tabs click/change、JS
  `selected:number`、RenderTransaction 或 if 内容切换。
- Tabs 对照：真实 `tabs-001.rpk` 完成 Loader、Tabs Mount、首屏可见和 teardown，资源归零。
- 截图：本次未生成；当前执行环境无法创建 SDL GUI 窗口，dummy 模式只能验证结构化运行结果。
- 资源：`tabs-001` teardown 输出 `surfaces=0 nodes=0 handlers=0 mount_objects=0`，并报告
  `resources_released=true`；commerce 因首次 Mount 失败未进入完整交互验收。
- 修改范围：仅构建和运行验证，无 Core、JS、LVGL、Toolkit、RPK 或公共 Contract 修改。

结论：Tabs 平台 Host 和 number ABI 已由专项测试验证；commerce-001 当前阻塞在富页面首次
LVGL Host 创建，不能宣称 Tabs 增量链路已完成，也不能归因于 RPK 或 Tabs change 逻辑。

## commerce-001 条件 Binding 最小复现与公共链路定位（2026-08-26）

结论：Toolkit 和 JS Framework 的条件 Binding 增量链路已通过最小复现；当前 commerce-001
四 Tab 不切换的根因不在 JS/Toolkit，而在 Android/iOS 的 `JsCoreIngress::post()` 丢弃了
Core Event payload。本任务禁止修改 Android/iOS，因此本轮不伪造修复结果。

### 已验证链路

- `commerce-001` Home Page IR 为 `selectedTab === 0/1/2/3` 生成四个 Tab 面板条件，且每个
  条件的依赖集合都包含 `selectedTab`。
- 生成 JS 另有首页 summary、refresh、state、featured 条件，共七个 `selectedTab` 条件块；
  商品 keyed `for` 保持独立的 `products` 依赖，`loading` 条件保持独立依赖。
- 最小运行验证执行 `onTabChange(1/2/3/0)`：每次 State 写入都命中 Proxy 依赖，microtask
  flush 生成 RenderTransaction；事务分别包含目标条件块 `instantiateBlock` 和旧条件块
  `removeBlock`，回到 `0` 时商品 keyed block 重新创建。
- `===`、number 状态和条件重新求值均正常；没有修改 Example 逻辑绕过。

### 根因证据

Android 和 iOS 的 `JsCoreIngress::post()` 都从 Core Event 构造 JS `JsEventDispatch` 时传入
空 payload：

- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/src/runtime_spine.cpp`
- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/src/runtime_spine.cpp`

Core 事件本身已经携带 `index`，但适配器没有把 `event.payload` 复制到
`typed.payload`。因此 JS Handler 实际收到的 `event.index` 为 `undefined`，
`Number.isInteger(event.index)` 为 false，`this.selectedTab = event.index` 不执行，后续
自然没有 RenderTransaction。LVGL Composition Root 已有 payload 转换逻辑，边界差异与该结论
一致。

### 修改与验证

- Toolkit 新增 `TK-S17`：断言 commerce-001 的七个 `selectedTab` 条件块均保留依赖，并保留
  `loading`、keyed `for` 的独立依赖。
- 未修改 Android、iOS、LVGL、Core、JS 公共运行时代码、Tabs Contract 或 commerce 源码。
- Toolkit：`npm test`，`91/91` 通过。
- JS：`ctest --test-dir quickapp-runtime-js/build-m1-s2`，`11/11` 通过。
- commerce RPK 连续构建两次一致：`59160` bytes，SHA-256
  `d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`；`unzip -t` 通过。

### 未完成项

真实 Android/iOS 四 Tab 视觉切换不能在当前约束下宣称完成。合规修复需要平台适配器把
Core Event payload 逐项复制到 JS typed payload；该修改必须由 Android/iOS agent 在其边界
内完成并重新验证 `Tabs -> Handler -> selectedTab -> RenderTransaction`。禁止在 JS 层接受
缺失的 `index`、改写 Example、增加旁路状态或静态路由。

状态：`BLOCKED_BY_PLATFORM_EVENT_PAYLOAD_ADAPTER`。

## Android Event Payload 修复（2026-08-26）

结论：Android 平台适配器已修复 Core Event payload 丢失；typed payload 已到达 JS ABI。
未修改 Core、JS、Toolkit、RPK、公共 Contract 或 Examples DSL。

- 修改：`quickapp-runtime-android/src/runtime_spine.cpp` 增加 Core RuntimeValue 到 JS
  RuntimeValue 的递归转换，并将转换结果写入 `JsEventDispatch.typed.payload`。
- 构建：`./gradlew :app:assembleDebug --no-daemon`，`BUILD SUCCESSFUL`；随后使用
  `adb install -r app/build/outputs/apk/debug/app-debug.apk` 安装。
- commerce RPK SHA-256：
  `d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`。
- APK SHA-256：
  `50b0571367615b8ccc64ecc0c57b2d7d06c66671ef050e1815484f317d21a71e`。
- Tabs：`0 -> 1 -> 2 -> 3 -> 0` 全部产生 `index=number`、`value=string`、JS Handler、
  RenderTransaction 和内容切换；revision `1 -> 2 -> 3 -> 4` 均 `ok=1`。
- 其他 payload：Input `value=string`；Switch `checked=boolean`；Slider
  `value=number/isFromUser=boolean`；Picker `selected=number/value=string`；Scroll
  `scrollOffset=number`；Click `keys=0`。详见
  `quickapp-runtime-android/evidence/android-event-payload-validation.md`。
- 路由：真实 commerce RPK 完成两次 `Home -> Detail -> Home`，Core Navigation push/back
  和 Detail Surface 关闭均通过。
- teardown：Activity 退出触发 `destroy.begin surfaces=3 nodes=172`，进程退出；本次未观测
  `destroy.end`/零资源终态，不能将完整资源归零标记为已验证通过。
- 独立边界：高频 Scroll payload 正确，但连续 RenderTransaction 在第 8 次后出现已有的
  `LIFECYCLE_BUSY/ABI_INVALID_ARGUMENT`；本任务不修改 Core，后续单独处理。

状态：`ANDROID_EVENT_PAYLOAD_FIXED`；Tabs 和各类 payload 回归通过，teardown 零资源终态
观测与高频 Scroll 事务节流仍待独立任务。

## iOS Event Payload Adapter Fix（2026-08-26）

结论：iOS Event Payload 丢失问题已修复并通过真实 RPK 回归。根因在
`quickapp-runtime-ios/src/runtime_spine.cpp`：Core Event 转发到 JS ABI 时使用了空
`typed.payload`。修复仅发生在 iOS Platform Adapter，未修改 Core、JS、Toolkit、RPK、公共
Contract 或 Examples。

- RPK：`quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 源码与 Bundle SHA-256：
  `d0317e888354356a965c1eb7e8b07aa17fbe9aad99c447223b348607c5b780d4`
- 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4`，通过。
- 部署：`xcrun simctl install booted build-ios-ninja/quickapp_ios_simulator.app`，通过。
- Tabs：真实 `0 -> 1 -> 2 -> 3 -> 0` 全部经过 UIKit Input、Core Event Router、JS Handler，
  产生 RenderTransaction revision `1 -> 2 -> 3 -> 4`，并完成 if 内容切换。
- Tabs payload：`index=number`、`value=string`。
- 其他 payload：Input `value=string`；Switch `checked=boolean`；Slider
  `value=number/isFromUser=boolean`；Picker `selected=number/value=string`；Scroll
  `scrollOffset/contentSize/viewportSize=number`；Click 保持空 payload。
- 路由：真实商品按钮 `Home -> Detail`，真实 UIKit 返回按钮通过 Core Navigation
  `Detail -> Home`；独立回归重复进入并返回通过。
- Teardown：`ios.runtime.platform.resources surfaces=0 nodes=0`。
- 截图：
  `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-commerce-001-tabs-payload-index0-2026-08-26.png`
  `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-commerce-001-detail-back-regression-2026-08-26.png`
- 详细证据：
  `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/ios-commerce-001-2026-08-26.md`

状态：`IOS_EVENT_PAYLOAD_FIXED`。本次未触碰公共架构；无阻塞。

## Commerce 主展示案例增强（2026-08-26）

结论：`commerce-001` 已升级为可展示的移动端电商主案例；商品图、种草内容、购物车和我的设置均使用真实联盟 DSL、Core 唯一状态和现有 Runtime 能力。未修改 Runtime、公共 Contract 或其他案例。

- 商品图片：替换为 3 张本地 48x48 PNG，分别为台灯、背包、保温杯；总字节 `8123`，单张均小于 `4 KiB`。
- Home：商品列表保持 keyed `for`，商品卡展示图片、标题、分类、状态、价格和详情入口；非 Home Tab 不渲染商品列表。
- 种草：分类 Tab 更名为种草，使用本地商品内容卡片；视频播放仍由独立 `media-001` 覆盖，本案例未伪造本地 MP4 能力。
- 购物车：初始 2 条本地商品；商品详情点击加入购物车后，通过共享页面状态回到购物车新增条目并重新计算合计；条目可进入详情；结算按钮只更新本地演示状态，不调用支付。
- 我的：增加消息通知、收货地址、售后服务 3 个 keyed 设置项，点击后更新本地状态并调用 `system.prompt`。
- 详情：保留 `router.push` / `router.back`，保留加入购物车、立即购买和本地状态反馈。
- 修改文件：`quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`、`ProductDetail/index.ux`、`README.md`、3 张 PNG 资源；重新生成 `dist/commerce-001.rpk` 和元数据。
- 构建：`cd quickapp-examples/showcases/commerce-001 && node scripts/build-commerce.mjs`。
- RPK：`80774` bytes，SHA-256 `6178ac548bac4a2236d1221703db065d3506e8fc359953bbd9de4f4b0f92ead8`；连续两次构建一致；`unzip -t` 通过。
- Toolkit：`npm test`，`91/91` 通过。
- 平台约束：当前 Toolkit Image 只允许静态 `assets/...` 路径，因此列表图片使用静态主图；当前构建器只收集图片资源，MP4 播放暂不并入此 RPK。

状态：`READY_FOR_MOBILE_SHOWCASE`。

## Commerce 白屏修复（2026-08-26）

结论：白屏已修复。根因是 `commerce-001` 页面把动态 `if/for` 嵌套在动态块中，当前 V1 初始化路径拒绝该结构并返回 `block owner scope mismatch`；iOS 同时使用了未包含最新 Core 构建结果的旧静态库。问题不在 Core 主架构、RPK Loader 或 Bridge 合同。

- 修改：`quickapp-examples/showcases/commerce-001/src/pages/Home/index.ux`；将动态块展平为同级结构，并用条件数据源控制非当前 Tab 的 `for` 列表为空，保留 `selectedTab`、商品 keyed `for`、详情 `push/back` 和四个 Tab。
- 测试基线同步：`quickapp-toolkit/test/integration/canonical-lowering.test.ts` 将该案例的动态块期望更新为 `16`；Toolkit 测试 `91 passed, 0 failed`。
- RPK：`quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`，`81600` bytes，SHA-256 `dbc2b56fe12b1b5fedd4dba461a5467b5b741628da8c99766778049ec65c38a5`。
- Android：重新执行 `./gradlew :app:assembleDebug --no-daemon` 并安装；真实 RPK 挂载成功，`operations=843`、`prepared=1`，已确认首屏可见。
- iOS：执行 `cmake --build build-ios-ninja --target quickapp_ios_simulator --clean-first -j 4` 后重新安装；真实 RPK 挂载成功，`operations=843`、`mounted=1`、`prepared=1`，已确认首屏可见。
- 截图：Android `/tmp/commerce-001-fixed-android.png`；iOS `/tmp/commerce-001-fixed-ios.png`。

状态：`COMMERCE_BLANK_SCREEN_FIXED`。当前 V1 约束：动态块不得嵌套动态块；后续案例应遵守该约束，不应为此修改公共 Runtime。

## Commerce 静态媒体与内容布局（2026-08-26）

结论：`commerce-001` 已将商品图片、种草卡片、本地视频和购物车内容收敛到真实联盟 DSL；本次没有改变 Core、Bridge、Render、Event、Navigation 或公共 Contract。Android 已重新构建并安装最终 RPK，购物车与种草视频均已取得真实运行证据。

- 商品列表按台灯、背包、保温杯分组使用 3 张静态本地 PNG，继续保持 Image/Text/Button、keyed `for`、`if` 和详情 `push/back`。
- 删除首页“切换推荐状态”和刷新依赖，首页摘要改为确定性本地文本。
- 种草 Tab 改为两列卡片流，并加入现有 Video Host 的本地 `assets/videos/seed-demo.mp4`；不是运行时下载，不是截图资源。
- 购物车使用一个受 `selectedTab` 控制的静态商品列表，展示对应图片、商品标题、价格、详情入口、合计和本地结算演示状态；避免当前增量挂载路径对多个并列动态列表的布局兼容问题。
- Toolkit 为支持静态媒体重新生成 RPK：`quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`。
- RPK 大小：`1454625` bytes；SHA-256：`bf98ec31f777bb9711e2f63bd7698541a868466b0d3a3ceded6cf01378da5bb0`。
- 图片资源：3 张 `48x48` PNG，总计 `8123` bytes，均小于 `4 KiB`。
- 视频资源：`assets/videos/seed-demo.mp4`，`1358537` bytes，包内 SHA-256：`1456ac6014de2e2fa2aa5412002648b872e428bc7ddce1c7d532b4ffdfe0fcbb`。
- Toolkit 变更：深冻结对原始数组的处理改为避免展开大数组；RPK ZIP 写入改为迭代追加字节，支持大于 1 MiB 的静态媒体。
- 构建命令：`cd quickapp-examples/showcases/commerce-001 && node scripts/build-commerce.mjs`；连续构建结果 SHA-256 一致。
- Android：`./gradlew :app:assembleDebug --no-daemon` 通过；安装并启动真实 commerce RPK 时出现 `rpk.verified`、`android.native.mount ... operations=829`、`android.platform.mount.result ... ok=true`、`android.initial.result ... prepared=1`。
- Android 种草验证：切换 `Tabs index=1 value=种草` 后，RenderTransaction revision `1` 挂载成功；RPK 中的 `assets/videos/seed-demo.mp4` 已 materialize，收到 `android.video.prepared`，点击视频后收到 `android.event.start.received`，截图出现真实视频画面。
- Android 购物车验证：切换 `Tabs index=2 value=购物车` 后，RenderTransaction revision `1` 挂载成功；截图和 UI 节点确认 `晨光便携灯 / 129 元`、`城市通勤包 / 299 元`、`合计：428 元` 和结算按钮可见。
- Android 截图：`/tmp/commerce-android-seed-final.png`、`/tmp/commerce-android-seed-video-playing-final.png`、`/tmp/commerce-android-cart-final-latest.png`。
- Android 构建：`cd quickapp-runtime-android && ./gradlew :app:assembleDebug --no-daemon`；安装：`adb install -r app/build/outputs/apk/debug/app-debug.apk`；启动：`adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk commerce-001.rpk`。
- iOS：本次未修改；其 RPK 资源解析与 Video 播放仍需单独确认本地 `assets/videos` 支持。

状态：`READY_FOR_ANDROID_SHOWCASE`。

## Media-001 本地 MP4 验收包（2026-08-27）

结论：`media-001` 已从外部视频地址切换为真实本地 MP4，重新生成的 RPK 可重复构建，静态资源索引和 ZIP 均通过；本次未修改 Core、JS ABI、公共 Contract 或任何平台 Runtime。

- DSL：`quickapp-examples/showcases/media-001/src/pages/Home/index.ux` 使用 `assets/videos/demo.mp4`。
- 视频：H.264/AVC、`432x240`、约 `20.109s`、`1358537` bytes；资源 SHA-256：`1456ac6014de2e2fa2aa5412002648b872e428bc7ddce1c7d532b4ffdfe0fcbb`。
- 海报：`assets/images/media-poster.png`，`32x32`，`1720` bytes；失败路径 `onerror` 保留。
- RPK：`quickapp-examples/showcases/media-001/dist/media-001.rpk`，`1374522` bytes；SHA-256：`d1faf1aae393579053b7a68960f6a3a13973122a456859763521118cd5fddc87`。
- RPK 资源索引：`assets/videos/demo.mp4` 的 MIME 为 `video/mp4`，`byteLength=1358537`，`resourceId=assets/videos/demo.mp4`；`unzip -t` 通过。
- 构建命令：`cd quickapp-examples/showcases/media-001 && node scripts/build-media.mjs`；连续两次构建 SHA-256 一致。
- Toolkit：`cd quickapp-toolkit && npm test`，`92 passed, 0 failed`。
- 平台边界：本包只验证 Toolkit/RPK 资源合同；Android VideoView、iOS AVPlayer 的本地 RPK 资源解析和播放由各平台 Adapter 单独验收，LVGL 继续遵循现有 Video 支持策略。

状态：`MEDIA_001_LOCAL_MP4_READY_FOR_PLATFORM_VALIDATION`。

## LVGL 嵌入式 Video 能力评估（2026-08-27）

结论：LVGL 当前没有可靠的视频解码和播放后端，因此本轮不实现伪播放。平台能力固定为
typed `unsupported`，并保证不创建播放器、解码缓冲、播放线程或残留资源。

- 输入 RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/media-001/dist/media-001.rpk`
- RPK SHA-256：`439009523904f8335f96902e642e6d2150379dacdc28d3bceb690923ea0ba0df`
- RPK 内容：Video Host、`src/poster/autoplay/controls/muted` 和生命周期语义；仅携带
  `assets/images/media-poster.png`，没有视频字节。
- 后端检查：LVGL 工程没有 FFmpeg、硬件解码器、GStreamer、Video Host 或播放器线程；现有
  SDL 只提供窗口/输入，不提供媒体解码。
- 新增 LVGL `LvglMediaAdapter`：`play/pause/seek` 返回
  `VideoControlResult{kUnsupported, HOST_FEATURE_UNSUPPORTED}`；非法 seek 返回
  `kFailed/ABI_INVALID_ARGUMENT`。适配器不持有资源，`teardown/clear` 后计数恒为 `0`。
- 单测：`lv_b7_video_unsupported_tests`，`1/1` 通过；覆盖三种控制、非法参数和 teardown
  零资源。
- 真实 Loader：执行 `SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk
  showcases/media-001/dist/media-001.rpk`，确定性返回 `RPK open failed: Runtime component unavailable`。
  原因是当前 LVGL Runtime Composition 未声明 Video；未绕过该门禁，也未创建部分 Host 对象。
- 构建：LVGL 重新配置、`lv_b7_video_unsupported_tests` 构建和 CTest 通过；Simulator 既有
  构建不受影响。
- 预算判断：不引入视频帧缓存，因此本轮 LVGL 运行时 RAM/Flash 增量为零；真实解码能力需要
  后续按目标硬件的 codec、帧缓冲、带宽和帧率预算单独立项。
- 修改范围：仅 `quickapp-runtime-lvgl` 的 Media Adapter、单测和本交接记录；未修改 Core、
  JS、Toolkit、Android、iOS、Examples 或公共 Contract。

状态：`LVGL_VIDEO_UNSUPPORTED_READY`。

## Unified Media Resource Contract 与 media-001（2026-08-27）

结论：本地静态视频的最小合同已冻结。Toolkit 负责读取、格式/路径/预算校验、计算字节大小与 SHA-256 并写入 RPK；Core Loader 只保留并校验资源描述符；JS/Core 只传递 typed 控制意图和生命周期事件；Platform Adapter 后续负责播放器。Core 不持有媒体字节，不解码，不创建播放器线程。

- 合同文档：`v3/spec/contracts/media-resource-contract.md`；资源描述符新增可选 `resourceId`、`width`、`height`、`durationMs`。静态视频 V1 使用 `resourceId == path`，视频路径必须位于 `assets/videos/`，MIME 为 `video/mp4` 或 `video/webm`。
- 错误语义：Toolkit 路径/MIME/格式/预算错误为构建失败；Core 描述符或 ZIP member 不完整为 `PACKAGE_ENTRY_INVALID`；SHA-256 不一致为 `PACKAGE_INTEGRITY_FAILED`；平台能力缺失为 typed `unsupported`；加载、解码、控制失败为 typed `failed` 和 Video `error`。失败和 teardown 均不得留下播放器或缓存资源。
- 生命周期：`indexed -> verified -> requested -> prepared -> playing -> paused/finished`，异常转 `error`；`timeupdate` 要求非负有限 `currentTime`，`error` 要求非空错误分类。
- 修改范围：`quickapp-runtime-core` 的 ArtifactDescriptor/Loader 及 Core Loader 测试；`quickapp-runtime-js` 的 Video 生命周期 payload 校验及 JS-S02 测试；`quickapp-toolkit` 的视频资源输入、格式签名校验、描述符生成和测试；`quickapp-examples/showcases/media-001` 使用本地 `assets/videos/demo.mp4`。未修改 Android、iOS、LVGL、播放器、Router、Tree 或 Bridge 架构。
- 真实 RPK：`quickapp-examples/showcases/media-001/dist/media-001.rpk`，`1,374,522` bytes，连续两次 SHA-256 均为 `d1faf1aae393579053b7a68960f6a3a13973122a456859763521118cd5fddc87`；`unzip -t` 通过。资源共 2 个：poster PNG `1,720` bytes；视频 `assets/videos/demo.mp4`，MIME `video/mp4`，`1,358,537` bytes，`resourceId` 同路径，SHA-256 `1456ac6014de2e2fa2aa5412002648b872e428bc7ddce1c7d532b4ffdfe0fcbb`。
- Toolkit：`npm test`，`92/92` 通过；新增真实媒体描述符确定性和非法格式/身份拒绝测试。
- Core：`core_s02_package_loader_tests` 构建并执行通过；覆盖视频描述符、可选元数据、资源身份和非法身份。Core 全量 CTest 的既有 `core_m1_alpha_core_boundary_scan` 仍因 `mount_coordinator.cpp` 命中 `LVGL` 失败，本次未触碰该文件。
- JS：`js_s02_contract_tests` 构建并执行通过，Video `prepared/timeupdate/error` payload 和非法值校验通过；JS CTest `11/11` 通过。
- Schema：`validate-schemas.mjs` 通过，包含 Runtime Metadata 新增视频分支；旧四字段 Artifact Descriptor 仍合法，旧 RPK 保持兼容。

状态：`MEDIA_RESOURCE_CONTRACT_FROZEN`。

## iOS Media Adapter Contract Revalidation (2026-08-27)

结论：iOS Media Adapter 已切换为严格的 RPK 本地资源路径；真实
`media-001.rpk` 当前没有本地视频资源，因此本次通过的是资源拒绝、错误事件和
teardown，不是播放成功。旧的 `example.invalid` 到 Bundle MP4 映射不再适用。

- 真实输入：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/media-001/dist/media-001.rpk`
- RPK SHA-256：`439009523904f8335f96902e642e6d2150379dacdc28d3bceb690923ea0ba0df`
- Bundle：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/build-ios-ninja/quickapp_ios_simulator.app/media-001.rpk`
- Bundle SHA-256：`439009523904f8335f96902e642e6d2150379dacdc28d3bceb690923ea0ba0df`
- RPK 内容：只有 `assets/images/media-poster.png`，没有 `assets/videos/*.mp4`；Video
  `src` 是 `https://example.invalid/quickapp-kit/demo.mp4`。
- 修改范围：仅 `quickapp-runtime-ios/include/quickapp/ios/ios_gateway.h`、
  `quickapp-runtime-ios/src/runtime_spine.cpp`、
  `quickapp-runtime-ios/src/ios_gateway.mm` 及 iOS evidence。
- Adapter 合同：只接受 `assets/...`；拒绝 URL、路径穿越、缺失资源、空资源、非
  `video/mp4`、长度不匹配、超过 16 MiB 或 SHA-256 不匹配；校验成功后写入受控临时
  缓存，AVPlayer 只使用缓存文件。
- 真实日志：
  `ios.video.resource ... code=MEDIA_PATH_INVALID`
  `ios.video.source ... code=MEDIA_SOURCE_REJECTED`
  `ios.video.event ... type=error`
  `ios.video.control ... action=play|pause|seek ... code=VIDEO_NOT_READY`
- Teardown：
  `ios.runtime.stopped surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0`
  `ios.runtime.platform.resources surfaces=0 nodes=0`。
- 截图：`/tmp/quickapp-ios-media-001-error-state-20260827.png`；已归档至
  `quickapp-runtime-ios/evidence/screenshots/ios-media-001-error-state-2026-08-27.png`。
- 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4`，通过；
  仅有既有 SDK 弃用和初始化警告。
- 限制：当前 RPK 无法验证 `prepared/start/pause/finish`；不能通过修改 Core、JS、
  Toolkit、RPK 或公共 Contract 补造资源。下一次真实播放验收必须使用包含本地
  `assets/videos/*.mp4` 和一致资源元数据的 RPK。

状态：`IOS_MEDIA_ADAPTER_CONTRACT_ALIGNED_INPUT_BLOCKED`。
