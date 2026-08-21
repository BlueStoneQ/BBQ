# M1-Alpha Integration Handoff

## 当前状态

`S1_VERIFIED / READY_FOR_M1_S2`

## Alpha 最终状态

Alpha S1 已完成。最后一条交接记录中的真实 Composition Root 已经证明 RPK、JS、Core 和 LVGL/SDL 首屏闭环；本文件前面的历史记录保留为过程证据。

## 当前发现

Alpha 端到端 Composition Root 已完成并通过 S1。以下历史记录中的“尚未完成”描述
只表示当时的中间状态，不代表当前状态。Alpha Agent 已停止；M1 后续切片统一由
[`../m1/README.md`](../m1/README.md) 和 [`../m1/agent-instructions.md`](../m1/agent-instructions.md)
管理。

最新真实 RPK：

- `quickapp-toolkit/evidence/tk-s07-case001.rpk`
- SHA-256：`95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`

## 最新复验

- Core module-dependency Release、ASan：各 `14/14 PASS`。
- JS typed-facade Debug、Release：各 `11/11 PASS`。
- JS typed-facade ASan：`js_s02_contract_tests` 的弱引用生命周期断言在
  `tests/js_s02_contract_tests.cpp:1003` 失败，其余测试通过；需单独复验，不能作为端到端成功证据。
- LVGL font Debug、Release：各 `14/14 PASS`。
- 现有 LVGL integration test 使用 fixture page，只能证明挂载合同，不能证明真实 RPK 主链。

## 下一步

启动 `v3/m1/agent-instructions.md` 中的 M1-S2 提示词；不得重新启动 Alpha 组件开发。

## 2026-08-19 / 集成 Agent / Step 1 完成

- 状态：`IN_PROGRESS / REAL_RPK_LOADER_PASS / JS_CORE_MOUNT_PENDING`。
- 已完成：在 `quickapp-examples` 建立首个 Composition Root 入口
  `composition/case001_loader.cpp`，使用真实文件 RPK Source 接入 Core
  `PackageLoader`。
- 已验证事实：真实 RPK 通过 Manifest、Runtime Metadata、Artifact SHA-256
  和 Page IR 校验；真实 `/pages/Demo` Page IR 成功加载，templateId 为
  `page:/pages/Demo`；Loader close、AppRuntimeIdentity reset 和 Factory teardown
  均完成，资源释放证据为 `resources_released=true`。
- 可复现命令：
  `cmake -S . -B build -DQUICKAPP_CORE_BUILD_TESTS=OFF && cmake --build build --target quickapp_case001_loader -j2 && ./build/quickapp_case001_loader ../quickapp-toolkit/evidence/tk-s07-case001.rpk`
- 当前证据输出：
  `rpk.opened=true`、`package=com.example.case1`、`entry_route=/pages/Demo`、
  `page_ir.template_id=page:/pages/Demo`、`resources_released=true`。
- 修改项目：仅 `quickapp-examples`；新增 CMake Composition Root 和真实文件
  PackageSource，未修改公共合同及四个已验证组件。
- 当前待完成：从同一个 Loader 取得真实 App/Page `VerifiedModule.bytes()`，交给
  QuickJS ModuleLoader/VM，再把真实 initial binding 接入 Core Render/Mount 和
  LVGL/SDL Present。
- 公共合同影响：无。

## 2026-08-19 / 集成 Agent / Step 2 进行中

- 已建立 Examples 的 QuickJS 真实模块探针 `composition/case001_js.cpp`，并
  使用同一真实 RPK、Core `VerifiedModule` 和 JS typed `LoadVerifiedModule`。
- 该探针已成功编译，运行阶段仍有 `libc++abi` 终止，尚未形成 App/Page
  Module loaded 证据；当前不能标记 JS S1 通过。
- 初步判断：异常发生在异步 JS 组装探针的回调边界，正在改为无抛异常的结构化
  错误收集。没有修改公共合同或四个已验证组件。
- 当前 Alpha 状态仍为：`REAL_RPK_LOADER_PASS / JS_CORE_MOUNT_PENDING`。

## 交接记录

### 2026-08-18 / 总架构 Agent / 单集成 Agent 放行

- 状态：`CODE_ALLOWED_END_TO_END`。
- 唯一目标：Case 001 真实 RPK 经 JS/Core/LVGL/SDL 显示首屏并确定释放资源。
- 所有权：M1-Alpha 范围内统一拥有 Toolkit、Core、JS、LVGL、Examples 五个工程的联调修改。
- 下一步：按 [`INTEGRATION-AGENT.md`](./INTEGRATION-AGENT.md) 执行，完成后标记 `READY_FOR_ARCH_REVIEW`。
- 公共合同影响：无；继续消费 v3 冻结合同。

### 2026-08-18 / 总架构 Agent / 四项组件门禁通过

- 状态：`CODE_ALLOWED_RUNNER`。
- 已验证：Toolkit、Core、JS、LVGL 四项 Alpha 定向修正均为 `VERIFIED`。
- 当前任务：只完成 Examples Composition Root；使用新 RPK SHA-256 `95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`。
- 禁止项：不重复修改已通过组件，不使用 Fake Host，不手写中间产物，不新增公共合同。

## 2026-08-19 / 集成 Agent / 当前联调结果

- JS S1：`VERIFIED`。真实 RPK 的 shared module DAG 按依赖拓扑加载，随后加载
  App/Page `VerifiedModule.bytes()`；QuickJS、`$app_define$`、
  `$app_bootstrap$`、静态 typed facade 和 Loader teardown 均通过。
- JS 可复现命令：
  `cmake -S . -B build-alpha -DQUICKAPP_CORE_BUILD_TESTS=OFF && cmake --build build-alpha --target quickapp_case001_js -j2 && ./build-alpha/quickapp_case001_js ../quickapp-toolkit/evidence/tk-s07-case001.rpk`
- JS 证据：shared 4/4、App 1/1、Page 1/1 loaded；输出
  `quickjs.started=true`、`resources_released=true`。
- 真实 RPK 暴露的既有静态 facade 缺口为 `system.prompt`、`system.fetch`；已在
  JS 静态 facade catalog 中以最小 typed facade 补齐，未引入通用 JSON Bridge。
- LVGL/Core Mount：`VERIFIED` 到真实 Page IR、Core initial render、Yoga layout、
  唯一 RuntimeTreeStore、MountHost 和 SDL/LVGL Present；无 Fake Host、无手写 IR。
- LVGL 可复现命令：
  `cmake -S . -B build-alpha -DQUICKAPP_CORE_BUILD_TESTS=OFF && cmake --build build-alpha --target quickapp_case001_lvgl -j2 && SDL_VIDEODRIVER=dummy ./build-alpha/quickapp_case001_lvgl ../quickapp-toolkit/evidence/tk-s07-case001.rpk`
- 当前阻塞：真实 Page JS VM 的 initial binding 尚未接入 LVGL Composition Root；因此
  Core/LVGL 已挂载真实树，但 CJK Text 的实际值为空。Composition Root 明确拒绝
  手写 binding，命令以非零状态退出，未伪造 `READY_FOR_ARCH_REVIEW`。
- 当前状态：`REAL_RPK_LOADER_PASS / JS_MODULE_PASS / CORE_LVGL_MOUNT_PASS / JS_VM_BINDING_TO_CORE_PENDING`。
- 下一步唯一任务：在同一 Composition Root 中复用 JS `VmLifecycleService`、
  `AlphaInitialBindingStage`、`AlphaInitialTransactionBuilder` 的真实输出，接入
  `RuntimeAbiService::CoreIngressPort` 和 `MountCoordinator::InitialRenderIntent`；
  完成后再验证 CJK 首屏和资源归零。

## 2026-08-19 / 集成 Agent / M1-Alpha S1 完成

- 状态：`READY_FOR_ARCH_REVIEW`。
- 结论：Case 001 已跑通真实端到端主链；未使用 Fake Host、手写 Page IR、手写
  Bundle、手写 RenderTransaction、手写 MountTransaction 或第二套 Runtime Tree。
- Composition Root：`quickapp-examples/composition/case001_lvgl.cpp`。
- 真实输入：`quickapp-toolkit/evidence/tk-s07-case001.rpk`。
- RPK SHA-256：`95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`。

### 可复现命令

```sh
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake -S . -B build-alpha -DQUICKAPP_CORE_BUILD_TESTS=OFF
cmake --build build-alpha --target quickapp_case001_loader quickapp_case001_js quickapp_case001_lvgl -j2
./build-alpha/quickapp_case001_loader ../quickapp-toolkit/evidence/tk-s07-case001.rpk
./build-alpha/quickapp_case001_js ../quickapp-toolkit/evidence/tk-s07-case001.rpk
SDL_VIDEODRIVER=dummy ./build-alpha/quickapp_case001_lvgl ../quickapp-toolkit/evidence/tk-s07-case001.rpk
```

### 主链证据

- RPK：`rpk.opened=true`，`page_ir.loaded=true`，Page IR template id 为
  `page:/pages/Demo`。
- JS：shared `4/4`、App `1/1`、Page `1/1` verified modules loaded；QuickJS、
  `$app_define$`、`$app_bootstrap$`、typed static facades 和 Loader teardown 通过。
- VM：App context、Surface context、App VM、Page VM、`onInit` 和 initial binding
  evaluator 均执行；Page VM 产生一个真实 `InstantiateTemplate` 消息，binding 数为 1。
- Bridge：`CompleteVmInitialization(app)`、Page controls、
  `CompleteVmInitialization(page)`、`InstantiateTemplate` 依次通过 typed
  `RuntimeAbiService::CoreIngressPort`；未引入通用 JSON Bridge。
- Core：`MountCoordinator::InitialRenderIntent` 接收真实 binding，完成 initial
  render、Yoga layout 和唯一 `RuntimeTreeStore`。
- Platform：真实 `MountTransaction` 经 `MountHost`、LVGL/SDL mount/present。
- 首屏：`phase=first_frame prepared=1 title=欢迎体验快应用开发`，最终
  `cjk.first_frame.visible=true`。

### 资源与测试证据

- Loader：`resources_released=true`，PackageLoader、Runtime Identity 和 Factory
  teardown 完成。
- JS：`resources_released=true`，QuickJS Engine、VM、ModuleLoader、Facade 和
  ABI 服务完成 teardown。
- LVGL：`resources_released=true`，Surface、MountHost、Node、Font、OwnerTaskQueue、
  SDL display 和 Core coordinator 完成释放；Mount live object/font 计数归零。
- Loader、JS Composition Root、LVGL Composition Root 均编译成功并运行成功。
- 当前仅为真实 Case 001 的 Alpha S1 证据；Android、iOS、Benchmark、完整事件/路由
  和后续 Capability 不属于本门禁。
