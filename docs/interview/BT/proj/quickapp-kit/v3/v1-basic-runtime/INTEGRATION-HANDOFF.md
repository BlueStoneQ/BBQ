# B1 CASE-002 Integration Handoff

## 结论

状态：READY_FOR_ARCH_REVIEW

CASE-002 已使用真实 Toolkit 生成的 RPK 打通：

```text
联盟 DSL
-> Toolkit
-> RPK
-> JS Page VM
-> State / Binding / Dirty / microtask
-> RenderTransaction
-> C++ Core Runtime Tree
-> RemoveBlock + MoveBlock + UpdateBinding
-> MountTransaction
-> LVGL / SDL
```

主架构未改变。Core 仍维护唯一 Runtime Tree，平台仍只消费 MountTransaction。

## 已完成

1. Toolkit 支持 CASE-002 的 `if` 和 keyed `for` 初始 Block 快照。
2. Toolkit 生成稳定的 `BlockInstanceId`，并在状态变化后生成 `RemoveBlock` 与 keyed `MoveBlock`。
3. JS 初始阶段只求值页面级 Binding；Block Binding 保留在完整 Definition ID 集合中，由 Block 初始快照提交。
4. JS 通过事件请求上下文传递 `RequestId` 到 RenderTransaction。
5. Core 接收 `UpdateBinding`、`RemoveBlock`、`MoveBlock`，提交一次原子增量事务。
6. Core MountCoordinator 输出 `RemoveHost`、`MoveHost`；LVGL Bridge 转换并提交给 LVGL MountHost。
7. Composition Root 支持无 shared module 的真实 RPK，不再写死 Case 001 的 shared module 列表。
8. `quickapp_case001_lvgl --case-002` 增加自动 CASE-002 验收和非法 RenderTransaction 拒绝验收。
9. `quickapp_lvgl_simulator --case-002` 可以持续运行真实 RPK，SDL 窗口关闭后完成 Runtime teardown。

## 工程修改

- `quickapp-toolkit/src/compiler/emitter/js-module-emitter.ts`
- `quickapp-toolkit/test/integration/emitters.test.ts`
- `quickapp-toolkit/test/integration/runtime-artifact.test.ts`
- `quickapp-runtime-js/include/quickapp/js/module/module_loader.h`
- `quickapp-runtime-js/include/quickapp/js/render/alpha_initial_transaction_builder.h`
- `quickapp-runtime-js/include/quickapp/js/alpha/alpha_page_initialization_stage.h`
- `quickapp-runtime-js/src/module/module_loader.cpp`
- `quickapp-runtime-js/src/binding/alpha_initial_binding_stage.cpp`
- `quickapp-runtime-js/src/render/alpha_initial_transaction_builder.cpp`
- `quickapp-runtime-js/src/alpha/alpha_page_initialization_stage.cpp`
- `quickapp-runtime-js/src/event/handler_registry.cpp`
- `quickapp-runtime-core/include/quickapp/core/render/initial_render_pipeline.h`
- `quickapp-runtime-core/src/initial_render_stager.cpp`
- `quickapp-runtime-core/src/mount_coordinator.cpp`
- `quickapp-runtime-lvgl/src/integration/core_mount_bridge.cpp`
- `quickapp-examples/composition/case001_lvgl.cpp`

冻结公共 Contract 未修改。

## RPK 证据

Case 002 基线：`quickapp-examples/quickapp-code-test2`。

产物：`quickapp-toolkit/evidence/tk-s09-case002.rpk`

SHA-256：`e8e71234580d71120d06809e52d5256314135ba2d9722782ea2ba0c504ae53cc`

RPK 关键成员：

- `manifest.json`
- `app.js`
- `pages/pages/Contract/index.js`
- `quickapp-kit/pages/pages/Contract/index.ir.json`
- `quickapp-kit/runtime.json`

## 验证命令和结果

Toolkit：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
```

结果：`78 passed, 0 failed`。

C++ 构建：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
```

结果：构建通过。

自动验收：

```text
./build-m1-s2/quickapp_case001_lvgl --case-002
```

结果：通过。关键证据：

```text
case002.render.op kind=updateBinding id=1
case002.render.op kind=moveBlock id=blk:srf:1-2-b index=2
case002.render.op kind=removeBlock id=blk:srf:1-1-if
negative.invalid_render_transaction rejected=1 error=ABI_INVALID_ARGUMENT
case002.chain ... render_transaction=1 revision=0->1 removeBlock=1 moveBlock=1 ... keyed=B,A
resources.before_cleanup surfaces=0 nodes=0 handlers=0 live_surface=0 mount_objects=0 roots=0
resources_released=true
```

交互 Simulator：

```text
./build-m1-s2/quickapp_lvgl_simulator --case-002
```

结果：SDL 窗口持续运行，加载真实 RPK；关闭窗口后 `simulator.closed=true`、`resources_released=true`。

BINDING-001 回归：

```text
./build-m1-s2/quickapp_case001_lvgl --binding-001
```

结果：通过，原有单 Binding 增量链路保持可用。

## 已验证事实

- CASE-002 页面入口为 `/pages/Contract`。
- 初始状态包含 `count=0`、`visible=true`、`A/B` 两个 keyed Block。
- 点击真实 LVGL Button 后只提交一笔 Revision `0 -> 1` 的 RenderTransaction。
- 更新结果为 `count=1`、条件 Block 移除、keyed 顺序 `B,A`。
- A/B 没有 Remove + Instantiate；增量操作只对 B 发出 Move，对条件 Block 发出 Remove。
- Mount 结果为 presented，Core、LVGL 和 JS 资源在 teardown 后归零。

## 合理推断

- A/B 的 Runtime NodeId、LVGL NativeHandle 和 HandlerId 在本次 Move 中保持，因为 Core 使用 `stage_move_block`，LVGL 使用 MoveHost，不执行对象重建；资源计数也没有出现 A/B 重建增量。
- `RequestId` 已从点击事件进入 JS 全局请求上下文，并可被 RenderTransaction 携带；本次 Core 事务接受了该关联上下文。
- 目前 Block Binding 的初始求值属于 JS Block 快照，不属于页面级初始 Binding 提交。

## 待验证项

- 尚未建立独立的跨平台 CASE-002 Android/iOS 自动验收；本轮只验证 Core + LVGL/SDL。
- CMake 当前构建目录没有注册独立 `ctest` 测试；Core 事务失败路径通过 Composition Root 的非法事务验收覆盖，平台 Mount fault injection 留待后续专门测试。
- Block 内部 Binding 在 keyed 数据内容变化而非仅重排时的增量更新，留待后续波次。
- 更复杂的嵌套 Block、Block Handler 和跨父节点 Move 不属于 B1。

## 下一步建议

等待总架构复核。B1 通过后再放行 B2；不要在本轮继续扩展 Feature、更多 Host Component、平台 API 或完整 Benchmark。

---

## B2 BLOCK-001 交接

状态：`READY_FOR_ARCH_REVIEW`

本轮范围：仅验证真实 Toolkit RPK 经 JS State/Binding、Core Block 增量事务、LVGL Mount 的 keyed add/remove/re-add 生命周期；只运行 LVGL/SDL，不修改 Android、iOS、Benchmark。

### RPK

基线源码：`quickapp-examples/quickapp-code-test3`。

产物：`quickapp-toolkit/evidence/tk-s10-block001.rpk`。

SHA-256：`7638b22e2c89af02ebf363d3b09540f08079e4985deb5681a9fcc9d33ea1124e`。

本 RPK 由 Toolkit 从真实 DSL 生成，未手写 Page IR、RenderTransaction 或 MountTransaction。

### 验收结果

- 初始：keyed 列表为 `[A,B]`，Revision `0`，9 个 Runtime Node/Platform Mount 对象。
- 添加 C：结果为 `[A,B,C]`，Revision `1`；Render 操作为 `instantiateBlock(C)`，A/B 身份稳定，只创建 C；Mount 为 C 子树的 Create/Insert/Prop/Layout 操作。
- 删除 B：结果为 `[A,C]`，Revision `2`；Render 操作为 `removeBlock(B)`，并对 C 执行必要的 `moveBlock(C)`；Mount 为 B 子树 Remove 和 C 的 Move，A/C 保持原对象。
- 重新添加 B：结果为 `[A,B,C]`，Revision `3`；Render 操作为 `instantiateBlock(B-new)` 和 `moveBlock(C)`；Mount 为 B-new 子树 Create/Insert/Prop/Layout 和 C 的 Move。
- B 删除后，旧 `BlockInstanceId`、Handler、Runtime Node、LVGL NativeHandle 均释放；旧 Handler 触发返回 `HANDLER_NOT_FOUND`，不进入 JS 或 Render。
- 重新添加 B 使用 `blk:srf:1-1-b-g2`、`node:13` 和新的 Handler，不复用旧身份。

关键运行证据：

```text
block001.initial keyed=A,B ...
block001.add_c keyed=A,B,C instantiate=C only identity_ab=stable mount_objects=12
block001.remove_b keyed=A,C remove=B handler_released=1 node_released=1 native_released=1 stale_event=HANDLER_NOT_FOUND mount_objects=9
block001.readd_b keyed=A,B,C instantiate=B-new identity_new=1 ...
block001.chain initial=AB add=ABC remove=AC readd=ABC revisions=0->1->2->3 old_handler_rejected=1 resources=12->9->12
resources.before_cleanup surfaces=0 nodes=0 handlers=0 live_surface=0 mount_objects=0 roots=0
resources.js_after_cleanup handlers=0 module_entries=0 page_leases=0 active_loads=0 module_bytes=0 module_pending=0 app_vms=0 page_vms=0 vm_surfaces=0 abi_entries=0 abi_correlations=0 abi_consumers=0 abi_surfaces=0 abi_callbacks=0 page_entries=0 page_factories=0 queue_depth=0
resources_released=true
```

### 测试命令和结果

Toolkit：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
```

结果：`80 passed, 0 failed`。

C++/LVGL 构建：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
```

结果：构建通过。

B2 自动验收：

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
```

结果：通过，退出码 `0`；真实 RPK、Core、LVGL/SDL、事件和 teardown 均完成。

### 公共边界

- 冻结的跨层公共 Contract 未变化。
- 未修改 Android、iOS、Benchmark。
- 未新增 Mount Fault Injection、跨平台 CASE-002、完整 Hardening 或性能系统。
- Runtime-js 增加的 Handler unbind 仅用于既有 HandlerRegistry 的生命周期清理，不改变 Core/Platform ABI。

### 下一步

等待总架构复核和 B3 放行；本 Agent 在 B2 完成后停止。

---

## B3 Contract Extension 交接

状态：`CONTRACT_EXTENSION_READY`

本轮只完成 V1 基础组件公共 Contract 扩展，不实现 Image/Input 的完整 Toolkit lowering、Core Runtime、LVGL Mount、Android/iOS 或 Benchmark。

### 修改的 Contract 与类型文件

- `v3/spec/contracts/schemas/host-component.schema.json`
- `v3/spec/contracts/schemas/page-ir.schema.json`
- `v3/spec/contracts/schemas/event-message.schema.json`
- `v3/spec/contracts/host-component-contract.md`
- `v3/spec/contracts/event-contract.md`
- `quickapp-runtime-core/include/quickapp/core/package/page_ir.h`
- `quickapp-runtime-core/src/page_ir_model.cpp`
- `quickapp-runtime-core/src/event_router.cpp`
- `quickapp-toolkit/src/compiler/lowering/types.ts`
- `quickapp-toolkit/src/compiler/emitter/page-ir-emitter.ts`
- `v3/spec/contracts/schemas/tests/fixtures.mjs`

### 新增字段与语义

- Host Component 新增 `Image`：`props.src` 必须是 RPK 内 `assets/` 路径；不接受网络 URL。资源缺失、不可解码或平台无法加载时，沿既有 Mount 失败语义报告，不新增错误码。
- Host Component 新增 `Input`：`props.value: string`、`props.enabled: boolean`。
- Page IR Binding target 新增 `value`，用于 Input 的字符串绑定；既有 `text/enabled` 保持不变。
- EventType 新增 `input`、`change`、`focus`；既有 `click` 保持不变。
- `input/change` payload 至少携带字符串 `value`；`focus` payload 至少携带布尔 `focused`。
- Core enum wire 映射新增 `Image`、`Input`、`input`、`change`、`focus`，仅完成合同类型序列化准备，不执行平台行为。

### 向后兼容结论

- 旧 `View`、`Text`、`Button`、`text`、`enabled`、`click` Schema 与语义未改变。
- 新分支是加法扩展；旧 Case 生成的 RPK、Page IR 和 Runtime ABI 不需要修改。
- Image/Input 尚未进入现有 Runtime Tree 的实际实例化和 Mount 路径，因此本轮不宣称跨层功能已完成。

### 回归命令和结果

公共 Schema：

```text
cd /Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/contracts/schemas/tests
npm test
```

结果：`22 schemas, 83 union branches, 26 supplemental positives`，通过。

Toolkit 与旧 Case：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
```

结果：`80 passed, 0 failed`；Case 001、Case 002、BLOCK-001 既有 Toolkit 构建回归通过。

Core/LVGL 编译：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
```

结果：通过。

B1/B2 LVGL 回归：

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --case-002
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
```

结果：均通过，B1 keyed 增量事务和 B2 Block add/remove/re-add 资源清理保持可用。

### 架构结论

本轮只新增 V1 基础组件合同，不改变架构分层；没有新增通用 JSON Bridge、第二棵 Tree、第二套路由或平台旁路。未修改 Android、iOS、Benchmark。

### 下一步

等待总架构快速复核后，再单独放行 Image/Input 的 Toolkit lowering、RPK 资源关系、Core Page IR 实例化、LVGL Mount 和 Input Event 实现。

---

## B3 Architecture Review 交接

日期：2026-08-23

状态：`IMPLEMENTATION_ALLOWED`

总架构结论：主架构通过，B3 可以继续实现。`Image/Input` 是向后兼容的 Host Component、Page IR 和 Event Contract 加法，不改变唯一 Runtime Tree、RenderTransaction、MountTransaction、Event Router、Bridge 或平台边界。

当前状态不能标记 `FUNCTIONALLY_VERIFIED`。已完成的是合同类型准备和旧链路回归；Core `parse_host`、MountTransaction 的 Image/Input 合同、Runtime Composition Profile、LVGL Image/Input Mount、Input Event 仍需完成。

B3 Agent 现在直接执行完整最小闭环，不再等待下一轮总架构校审：

```text
联盟 DSL -> Toolkit -> Page IR/RPK -> Core Loader -> Runtime Tree
-> MountTransaction -> LVGL Host -> PlatformInputMessage
-> Core Event Router -> JS Handler
```

必须保持：旧 Case 001、CASE-002、BLOCK-001 回归；Image 资源失败无部分对象泄漏；Input value 和 input/change/focus 到达 JS；teardown 资源归零。

本波次不做 Android/iOS、网络图片、复杂输入法/上传、Benchmark 或完整观测系统。完成后提交运行输出和变更摘要，进入一次快速架构复核。

---

## Overnight Execution 交接

日期：2026-08-23

当前优先级高于 B3 Image/Input：先用已有 `View/Text/Button + click` 合同，完成同一个联盟 DSL RPK 在 LVGL/SDL、Android、iOS 三端的多页、状态、`if`、keyed `for` 和路由验收。

完整执行合同见：

`v3/v1-basic-runtime/OVERNIGHT-EXECUTION-2026-08-23.md`

这是一次代码优先的垂直集成波次。Agent 不再等待 Spec 或架构校审；下一次交付必须是共享 Fixture、RPK SHA-256、三端构建和运行结果。Image/Input、Benchmark 和额外观测不属于本波次。

---

## LVGL Roadmap 收敛

日期：2026-08-24

LVGL 实施的唯一目标文档已收敛为：

`v3/v1-basic-runtime/LVGL-IMPLEMENTATION-ROADMAP.md`

当前阶段：`LVGL-P0-A / IN_PROGRESS`。

先完成 LVGL Core Track：多页、state、if、keyed for、列表、push/back、基础组件、页面生命周期和 teardown，形成第一个基本可用快应用；Image/Input、Feature、失败恢复、Simulator 产品化和 Benchmark 均后置。Android/iOS 在 LVGL Core Track 完成前保持 `HOLD_LVGL_CORE`。

---

## LVGL Core Track CORE-4 交付

日期：2026-08-24

阶段：`CORE-1 -> CORE-2 -> CORE-3 -> CORE-4`

状态：`READY_FOR_ARCH_REVIEW`

Fixture：`quickapp-examples/quickapp-code-test5`

Fixture 页面：`/pages/Home`、`/pages/Detail`

RPK：`quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk`

RPK SHA-256：`10322e1f0023e97eb7989523c5799e11157a769f91d4df91ef87ab773ee17b61`

### 构建命令

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
```

结果：`82 passed, 0 failed`，包含 TK-S12 真实多页 RPK 构建。

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
```

结果：通过；`quickapp_case001_lvgl` 和 `quickapp_lvgl_simulator` 均完成构建。

### 运行命令

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --lvgl-p0
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --case-002
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
```

四条命令均退出码 `0`。

### 可见结果与核心链路

- Home 首屏由真实 RPK 加载并可见，标题为 `Home`。
- 点击“更新状态”后，`count: 0 -> 1`，条件节点执行 `removeBlock`，keyed 列表可见顺序变为 `B,A`。
- 同一批增量操作包含 `updateBinding`、`moveBlock`、`removeBlock`；没有重建无关节点。
- 点击“打开详情”进入 `/pages/Detail`，由 Core Router push 创建并显示第二个 Surface。
- Detail 返回按钮经过 LVGL Input -> Core Event Router -> JS Handler -> `router.back()` -> Core NavigationClose，Home 被 reveal。
- 页面 create/show/hide/destroy 和 stale Handler 拒绝均在真实运行中通过。
- CORE-3 的真实 RPK 包含并通过 Core Layout 的 width/height、margin/padding、flexDirection、justifyContent、alignItems、backgroundColor、color、fontSize、textAlign、borderRadius；Layout 使用 Yoga 和平台文本测量完成。

### Core/事件/路由结果

```text
Home initial: revision=0, nodes=9, handlers=2
Home update: revision=1, updateBinding=1, moveBlock=1, removeBlock=1
Home -> Detail: navigation stack 1 -> 2, Detail visible=1
Detail -> Home: navigation stack 2 -> 1, reveal_home=1
```

真实运行日志确认：`core.event.dispatch`、`js.core.navigation_push`、`js.core.navigation_close`、`core.navigation.close` 均出现；Platform 只通过 LVGL Mount/Input 参与。

### 资源清理

teardown 后真实运行输出：

```text
surfaces=0
nodes=0
handlers=0
live_surface=0
mount_objects=0
roots=0
app_vms=0
page_vms=0
vm_surfaces=0
abi_entries=0
abi_correlations=0
abi_consumers=0
abi_surfaces=0
abi_callbacks=0
queue_depth=0
resources_released=true
```

### 旧 Case 回归

- Case 001：通过，真实联盟 RPK、click、Core Router、Detail 和 teardown 通过。
- CASE-002：通过，增量 `updateBinding`、`removeBlock`、`moveBlock` 和非法事务拒绝通过。
- BLOCK-001：通过，Block add/remove/re-add、旧 Handler 拒绝、新身份生成和资源归零通过。

### 公共边界

- 未修改 Android、iOS、Benchmark。
- 未新增第二棵 Runtime Tree、第二套路由、平台旁路状态或通用 JSON Bridge。
- Core 仍是唯一 Runtime Tree、Navigation、Lifecycle 和 Commit 权威。
- 本轮只做向后兼容的基础样式字段扩展（padding 的四边 Page IR 字段）并完成 Toolkit/Core/LVGL 闭环，不改变分层和线程所有权。

### 下一阶段

第一个基本可用 LVGL Runtime 已形成。CORE Track 到此停止，等待总架构复核；Image、Input、Feature、失败恢复、Simulator 产品化、裁剪、Android、iOS 和 Benchmark 均不在本轮自动启动。

---

## P1 LVGL 基础能力首轮验证

日期：2026-08-24

状态：`P1-FOUNDATION-VERIFIED`

已验证：

- `--image-input-001`：真实 RPK 包内 Image 资源加载并显示；Input 初始 value、focus、input、change 均经过 LVGL Input -> Core Event Router -> JS Handler，teardown 资源归零。
- `--image-input-001-missing`：Image 资源失败被拒绝，`partial_objects=0`、`mount_objects=0`，Core/Surface/Handler 资源归零。
- `quickapp_lvgl_simulator --lvgl-p0`：持续 SDL Event Loop 入口可加载真实 P0 RPK，收到 SIGINT 后正常 teardown，`simulator.closed=true`、`resources_released=true`。

验证命令：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --image-input-001
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --image-input-001-missing
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator --lvgl-p0
```

前三项均完成；Simulator 由 SIGINT 结束，退出码 `0`。

边界保持：P1 本轮仍只验证已有 Image/Input 和 Simulator 入口；未修改 Android、iOS、Benchmark，未新增第二棵 Tree、第二套路由或通用 Bridge。后续 P1 扩展按路线处理，不回改已冻结 Core Track。

---

## 总架构快速复核

日期：2026-08-24

状态：`CORE_TRACK_VERIFIED`

复核结果：CORE-1、CORE-2、CORE-3、CORE-4 已由真实 Toolkit RPK 和 LVGL/SDL 运行通过；P1 已完成 Image/Input、资源失败和持续 Simulator 入口的首轮验证。主架构、唯一 Runtime Tree、Core Navigation、Event Router、Bridge 和线程边界未被改变。

当前可进入下一阶段：补齐 LVGL P1 剩余基础能力；Android/iOS 等 LVGL P1 目标稳定后再复用 Fixture。Benchmark 不启动。

---

## LVGL P1 Continuous Authorization

日期：2026-08-24

状态：`P1_CONTINUOUS_CODE_ALLOWED`

覆盖范围：

```text
prompt/device/title/meta
-> RPK/组件/Render/Mount 失败恢复
-> 基础滚动容器
-> Simulator 参数化 RPK 和持续 Event Loop
-> embedded-min 裁剪
-> 最小观测
```

执行规则：上述阶段是连续编码序列，不是人工审批门禁。Agent 完成一个阶段后立即进入下一个，不等待总架构、用户或新的 Spec；每阶段只追加最小结果。只有真实架构冲突、不可兼容公共 Contract 或环境完全不可用才允许 `BLOCKED`。

本轮仍不做 Android、iOS、Benchmark、fetch、storage、权限、媒体、复杂手势和完整组件库。P1 全部完成后才停止并提交一次汇总交接。

---

## LVGL Core/Product Scope Calibration

日期：2026-08-24

最新范围覆盖优先级高于上一条 `P1_CONTINUOUS_CODE_ALLOWED`：当前只连续推进 LVGL 基础产品能力：

```text
Image/Input 已验证
-> RPK/组件/Render/Mount 失败和资源清理
-> 基础滚动容器
-> Simulator 稳定加载真实 RPK、输入和 teardown
```

`system.prompt/device/title/meta` 属于 `P1-FEATURE`，embedded-min、完整 Simulator 工具化、最小观测、裁剪和 Benchmark 属于工程增强，暂不进入当前主线。它们不阻塞基本可用快应用。

Agent 仍连续执行当前基础产品范围，不等待确认；完成后提交一次汇总，不自动跳入工程增强范围。

---

## V1 Golden App Verification

日期：2026-08-24

状态：`EXAMPLE_BASELINE_VERIFIED`

基线：`quickapp-examples/quickapp-code-test5`

结论：现有 `quickapp-code-test5` 已满足 V1 经典集成案例合同，不需要修改 Runtime 或公共 Contract。已补充案例 README，明确其作为 V1 Golden App；现有 `src/` DSL 保持为真实联盟 DSL 输入。

覆盖：

- Home/Detail 双页面。
- state 更新。
- `if` 条件节点切换。
- keyed `for` 列表重排。
- LVGL click 事件。
- `router.push()` 和 `router.back()`。
- Detail destroy、Home reveal 和 teardown。

验证命令：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --lvgl-p0
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --case-002
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
```

结果：

- Toolkit：`82 passed, 0 failed`。
- CMake：通过。
- Golden App：`lvgl.p0.router push=1 detail_visible=1 back=1 reveal_home=1 stack=2->1`。
- Golden App：`detail.real_rpk.visible=true`。
- CASE-002：state、if、keyed for、`B,A` 重排通过。
- BLOCK-001：add/remove/re-add、stale Handler 拒绝和资源释放通过。
- teardown：`resources_released=true`，Runtime Node、Handler、NativeHandle 和 JS 资源归零。

真实 RPK：`quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk`

SHA-256：`10322e1f0023e97eb7989523c5799e11157a769f91d4df91ef87ab773ee17b61`

边界：未修改 Core、JS、LVGL、公共 Contract、Android、iOS、Benchmark 或其他案例；未新增第二套路由、第二棵树或旁路 Runtime。

## LVGL Core/Product Scope Completion

日期：2026-08-24

状态：`P1_CORE_PRODUCT_SCOPE_COMPLETE`

结论：当前基础产品范围已完成；主链继续保持为真实 RPK -> JS Framework -> C++ Core -> LVGL，未改变唯一 Runtime Tree、Core Navigation、Event Router、Bridge ABI 或线程所有权。

### 已完成

- 失败恢复和资源清理：真实 Image 资源缺失、Surface 创建失败、队列溢出、延迟创建失败、非法 RenderTransaction 和 stale Event 均保持失败后不提交、不复活、不泄漏。
- 基础滚动：LVGL Page Root 作为唯一 Platform viewport，显式启用纵向滚动和自动滚动条；未新增第二个 Runtime 容器、虚拟列表或复杂手势。
- Simulator：`quickapp_lvgl_simulator --rpk <path>` 可加载指定真实 RPK，持续运行 SDL Event Loop，关闭事件或 SIGINT 后执行 Core destroy-all、LVGL teardown 和资源归零。

### 真实验证

RPK：`quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk`

SHA-256：`10322e1f0023e97eb7989523c5799e11157a769f91d4df91ef87ab773ee17b61`

Case 001 RPK：`quickapp-toolkit/evidence/tk-s07-case001.rpk`

Case 001 RPK SHA-256：`8b1ca86e355e4d7afe0cdbd9ce4179efccb280803bc6cbe4a94098db74c3c642`

构建命令：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
```

运行结果：

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl
  exit=0, detail.real_rpk.visible=true, resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --case-002
  exit=0, lvgl.case002.count=1, lvgl.case002.keyed_order=B,A, resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
  exit=0, keyed add/remove/re-add and stale handler rejection passed, resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --image-input-001-missing
  exit=0, partial_objects=0, mount_objects=0, resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --s4-back
  exit=0, queue_overflow=1, mid_create=1, core_stack_unchanged=1, resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator \
  --rpk ../quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk --lvgl-p0
  SIGINT -> simulator.closed=true, resources_released=true, exit=0
```

Toolkit：`82/82` tests passed。

### 当前边界

本轮不继续推进 `system.prompt/device/title/meta`、embedded-min、完整观测、裁剪、Benchmark、Android 或 iOS；这些属于后续 Feature/工程增强，不阻塞当前基础产品范围。已存在的兼容性实现和回归证据保持不扩展。

### 下一步

停止当前 LVGL 基础产品范围编码，等待下一次范围校准；不自动进入工程增强或跨平台工作。

## LVGL P1-FEATURE Completion

日期：2026-08-24

状态：`LVGL_P1_FEATURE_COMPLETE`

结论：LVGL P1 Feature 的最小闭环已完成并验证。调用路径固定为：

```text
JS Facade
-> typed ABI
-> Core ModuleRegistry/Invoker
-> LVGL Feature Provider
-> typed result
-> JS callback validation
```

未新增第二套路由、第二棵 Runtime Tree、平台旁路状态或通用 JSON Bridge；Android、iOS 和 Benchmark 未修改。

### 已完成

- `system.prompt.showToast`：真实 JS Facade 生成 typed request，Core Registry 路由到 LVGL Provider，Provider 创建并管理 LVGL toast 对象。
- `system.device.getInfo`：真实 JS Facade 生成 typed request，LVGL Provider 返回当前 SDL/LVGL display 的 typed device info。
- `title/meta`：页面 host API 通过同一 Core Registry 路由到 LVGL Provider，并按 SurfaceId 保存页面级状态。
- typed 状态：Core 使用 `success / unsupported / failed`；JS ABI 对 Feature callback 接受 `completed / unsupported / failed`，unsupported 和 failed 必须携带结构化错误，成功的 device result 必须携带 info。
- 关联：Feature request/result 携带同一个 `RequestId` 和 `SurfaceId`；页面生命周期通过 VM Surface context 设置当前 Surface，teardown 清理 Provider 状态。
- Provider 清理：Surface teardown 清理已知 Surface，Runtime teardown 清空剩余 Provider 状态；实际运行结果为 `resources.feature_after_cleanup providers=0`。

### 修改工程

- `quickapp-runtime-core`：新增 `core::feature::ModuleRegistry`、typed `Request/Result`、Provider port 和 registry contract test。
- `quickapp-runtime-lvgl`：新增 `LvglFeatureProvider`；toast、device、title/meta 均在 LVGL Provider 内实现，Provider 不拥有 Runtime Tree 或 Navigation。
- `quickapp-runtime-js`：补充 Feature callback 的 `unsupported` typed 状态校验和回归测试；保留既有 ABI identity/schema version。
- `quickapp-examples`：将 JS ABI Feature message 适配为 Core typed request，并注册同一个 LVGL Provider；补充 Feature teardown 证据。

### 真实 RPK

Case 001：`quickapp-toolkit/evidence/tk-s07-case001.rpk`

SHA-256：`8b1ca86e355e4d7afe0cdbd9ce4179efccb280803bc6cbe4a94098db74c3c642`

关联 RPK：

- CASE-002：`44e5f897081445a52c2ec758c616458267924d1b4524eb1e07449999d560a2d4`
- BLOCK-001：`7638b22e2c89af02ebf363d3b09540f08079e4985deb5681a9fcc9d33ea1124e`
- Image/Input：`0f5905c6f91a2ae2e842553178c741d2bd7b123d2fb9903d5ea7d0f435220747`

### 验证命令和结果

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
# 82/82 passed

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4
# passed
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl
# exit=0; system.prompt/device/title/meta provider logs; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --case-002
# exit=0; state/if/keyed move/remove; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
# exit=0; add/remove/re-add and stale Handler rejection; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --image-input-001
# exit=0; image/input/focus/input/change; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --s4-back
# exit=0; back/close/reveal, queue failure and teardown; resources_released=true
```

独立合同测试：

- `core_feature_registry_tests`：通过；验证 Provider dispatch、缺失 Provider 的 `unsupported` 和 teardown。
- `js_s02_contract_tests`：通过；验证 Feature `completed / unsupported / failed` 的 callback 形态。

### 已验证事实

- Case 001 的真实联盟 DSL 经 Toolkit 生成的 RPK 能触发四类 Feature，并由 LVGL Provider 完成。
- `RequestId` 和 `SurfaceId` 从 JS ABI message 到 Core request、Provider result 和 JS callback 保持关联。
- Core、JS、LVGL、Runtime Node、Handler、Mount object 和 Feature Provider 在 teardown 后均回到零基线。
- 旧 Case 001、CASE-002、BLOCK-001、Image/Input 和 S4 back 均回归通过。

### 合理推断

- 当前 Feature 边界可作为后续 Android/iOS Provider 的 typed port 基础；各平台只需实现同一个 Core Provider port，不需要复制 JS Facade 或 Core Registry。
- `ModuleRegistry` 当前是固定小集合，后续扩展模块应继续使用 typed module/method，不应退化为通用 JSON dispatch。

### 待验证项

- Android/iOS 的具体 Provider 行为和真实平台 device info 尚未在本轮验证。
- toast 的平台视觉样式、title/meta 的宿主窗口呈现和异步 Feature Provider 行为属于后续平台适配，不影响本轮 Core/LVGL typed contract。

### 下一步

停止 LVGL P1-FEATURE 当前编码，等待总架构下一次放行；不自动进入 Android、iOS、embedded-min、完整观测、裁剪或 Benchmark。

## LVGL P1-FEATURE Final Closeout

日期：2026-08-24

状态：`CLOSED`

本轮没有继续扩展实现，只完成最终验证和交接。

### 最终验证结果

- Toolkit：`npm test`，`82/82 passed`。
- Core：全量 CMake build 通过；`ctest`，`16/16 passed`。
- JS ABI：`js_s02_contract_tests`，`1/1 passed`；覆盖 `completed / unsupported / failed` typed callback 校验。
- LVGL：`cmake --build build-m1-s2 -j 4` 通过。
- LVGL P0 真实 RPK：Home state、if 移除、keyed `B,A`、push、back/reveal 全部通过。
- Case 001：system.prompt、system.device、title/meta 均打印 LVGL Provider completed 证据，exit `0`。
- CASE-002：增量 state/if/keyed Move/Remove 通过，exit `0`。
- BLOCK-001：add/remove/re-add、旧 Handler 拒绝和 NativeHandle 释放通过，exit `0`。
- Image/Input：Image、focus/input/change 和资源清理通过，exit `0`。
- S4 back：back/close/reveal、队列失败、失败恢复和 teardown 通过，exit `0`。

### 三态证据

- `success`：LVGL Provider 的 prompt/device/title/meta 真实运行均返回 `completed`。
- `unsupported`：Core `ModuleRegistry` 缺少 Provider 时返回 `CAPABILITY_UNSUPPORTED`；Core Registry 独立测试通过。
- `failed`：Core 测试 Provider 和 LVGL Provider 的非法参数/平台不可用路径返回结构化失败；JS ABI 对失败错误合同校验通过。

### 资源结果

真实运行日志均包含：

```text
resources.feature_after_cleanup providers=0
resources_released=true
```

并确认 Core surfaces/nodes、Event Handler、LVGL mount objects、JS module/page/VM/ABI entries 均归零。

### 最终边界

本轮未修改 Android、iOS、Benchmark；未实现 embedded-min、fetch/storage、新组件、新 Toolkit 语法、Benchmark 或完整观测；未新增第二套路由、第二棵 Tree 或旁路 Bridge。当前 LVGL P1-FEATURE 工作正式收口。

## Golden Baseline Visual Regression Fix

日期：2026-08-24

状态：`FIXED_PENDING_SCREENSHOT`

### 结论

此前 `quickapp-code-test5` 的 LVGL 画面不可用，主因是 Toolkit CSS selector lowering 错误：单一 `.page` 选择器被错误匹配到所有后代节点，导致标题、列表和按钮继承页面根节点的尺寸、内边距和布局属性。该问题不属于 Core、Bridge、路由或 LVGL Mount 架构错误。

### 修复

- Toolkit `matches()` 现在要求最后一个 selector compound 匹配当前节点，只有前置 compound 才能匹配祖先。
- 新增 Toolkit 回归测试，验证页面样式不会泄漏到后代节点。
- 重新生成 `tk-s12-lvgl-p0.rpk`；新的 Page IR 中只有根节点拥有 `300x560` 页面样式。
- 扩展 LVGL Alpha 字体清单，覆盖 P0 基线使用的“更新状态、条件节点、打开详情、详情页、返回”等字形，并重新生成内置字体资产。

### 验证

- Toolkit：`83/83 passed`。
- LVGL 字体、Mount、Core Mount、Measure 合同：`6/6 passed`。
- P0 自动验收：真实 RPK 加载、状态更新、if 移除、keyed reorder、路由 push/back、资源释放均通过。
- 新 RPK SHA-256：`25977ea6d92ed571ed6d019c3b0dc0b3ee5f1576acdf1ac3ee98fa68244ed74b`。

### 残余项

- 需要用 `quickapp_lvgl_simulator --rpk` 启动新 RPK 做一次人工截图确认；自动合同不能替代视觉确认。
- 全量 CTest 中 `lv_s02_contract_tests` 仍有既有的 LibuvLoopBackend 显式 close 生命周期失败；本次 LVGL 字体/布局修复相关的 6 项合同测试全部通过。

## Simulator RPK Entry Route Fix

日期：2026-08-24

状态：`VERIFIED`

Simulator 使用 `--rpk <path>` 时必须以已验证 RPK 的 `entryRoute` 作为首个 Root Surface 路由。此前入口仍写死为 Case 001 的 `/pages/Demo`，加载 `tk-s12-lvgl-p0.rpk` 时会错误请求不存在的页面；异常路径又在 JS 仍运行时触发析构 `terminate`，因此用户只看到 `libc++abi: terminating`。

本次修复位于 `quickapp-examples/composition/case001_lvgl.cpp`：

- 交互 Simulator 的显式 RPK 使用 `VerifiedPackage::entry_route()`。
- `/pages/Home` 基线自动识别为 LVGL P0 流程，保留原有 Case 验收分支。
- 增加 Simulator 级 terminate 诊断，异常不再静默遮蔽。

验证：

- `./build-m1-s2/quickapp_lvgl_simulator --rpk ../quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk`：成功进入 `simulator.ready`。
- 关闭窗口或发送 SIGINT：Core/JS/LVGL teardown 完成，`resources_released=true`。
- 自动程序使用同一 RPK：P0 全链路 exit `0`。

## LVGL Baseline Container Chrome Fix

日期：2026-08-24

状态：`FIXED_PENDING_MANUAL_SCREENSHOT`

### 结论

基线截图中的灰色页面边框、动态列表容器边框和默认内边距来自 LVGL `lv_obj_create` 的平台主题样式，不来自 RPK、Core Runtime Tree 或 Toolkit IR。

### 修复

- Page Root 清除默认边框、outline、shadow、radius、padding，并显式使用白色 viewport 背景。
- Runtime `View` 清除默认背景、边框、outline、shadow、radius、padding 和滚动条；DSL 显式声明的 `backgroundColor` 仍由 Mount Transaction 设置。
- `BoundedText` 写入 LVGL Label/Textarea 时转换为明确的 NUL 结尾字符串。

### 验证

- `quickapp_case001_lvgl --lvgl-p0 --rpk tk-s12-lvgl-p0.rpk`：真实 RPK、状态更新、if/for、路由 push/back 和 teardown 通过。
- `lv_s04`/`lv_s06` 相关测试：`6/6 passed`。
- 仍需用桌面 Simulator 做人工截图确认；字体视觉和具体像素位置不在本次公共 Contract 变更范围内。

## Cross-Platform Status Review

日期：2026-08-24

### 结论

Core/LVGL 主架构不需要调整。Android 和 iOS 当前都已有平台接入代码，但两端都还没有达到“使用当前 TK-S12 RPK 的平台验收完成”。

| 平台 | 当前事实 | 状态 | 下一步 |
|---|---|---|---|
| LVGL | 真实 RPK、View/Text/Button、if/for、状态更新、push/back、teardown 已通过；默认容器样式已修复 | 主链通过，视觉截图待确认 | 用新 Simulator 截图确认；不改 Core Contract |
| Android | Native ARM64 CMake 通过；旧 TK-S07 APK 有历史首屏/点击证据；当前 TK-S12 APK 尚未生成 | `P0_BUILD_BLOCKED` | 修复/替代 Gradle 构建入口，生成 TK-S12 APK，再验收 Home、state/if/for、push/back、teardown |
| iOS | TK-S12 Host probe 已通过 Home、push、back、teardown；UIKit bundle 可编译；当前环境无法连接 CoreSimulatorService | `UI_BUILD_VERIFIED_HOST_PROBE_VERIFIED` | 在可用 Simulator 上完成真实 TK-S12 UI、输入和 teardown；补正式 link map |

### 统一输入

三端后续 P0 验收统一使用：

```text
quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk
SHA-256: 25977ea6d92ed571ed6d019c3b0dc0b3ee5f1576acdf1ac3ee98fa68244ed74b
```

不得用旧 TK-S07 证据替代当前 P0 验收。平台适配层可以继续独立修改；不得修改 Core 的 Runtime Tree、Navigation、Lifecycle、Bridge Contract 或新增平台旁路状态。

## Simulator Detail Back Binding Fix

日期：2026-08-24

状态：`FIXED_PENDING_MANUAL_INTERACTION`

### 结论

Detail 页面点击“返回 Home”无反应的原因是 Simulator 组合入口只绑定了初始 Home 页面按钮；Detail 挂载后，其真实 LVGL Button 没有安装 click callback。Core EventRouter、JS `router.back()` 和 NavigationClose 链路没有缺陷，真实 RPK 也没有缺陷。

### 修复

- `quickapp-examples/composition/case001_lvgl.cpp` 在交互 Simulator 的页面栈进入第二页后，等待 Core Handler、Runtime Node 和 LVGL Native Object 均可用，再绑定 Detail back Button。
- 绑定仍调用既有 `MountHost::installClickHandler`，事件仍经过 `LVGL -> Core EventRouter -> JS Handler -> router.back() -> Core NavigationClose`。
- 返回 Home 后释放绑定状态；再次进入 Detail 时按新的 SurfaceId 重新绑定。
- 未修改 Core Runtime Tree、Navigation、Bridge、RPK 合同或增加第二套路由。

### 验证

- Simulator 目标重新编译通过。
- 非交互 P0 真实 RPK 回归通过，日志包含 `core.event.dispatch surface=srf:2 handler=hdl:1`、`js.core.navigation_close` 和 `stack=2->1`。
- 仍需在桌面窗口中人工点击 Detail back Button，确认交互截图和重复 push/back 体验。

## Navigation Back Then Push Again Fix

日期：2026-08-24

状态：`VERIFIED`

### 结论

`Home -> Detail -> back -> Home` 后再次点击“打开详情”失败的主因是 Core `SurfaceController` 在 push 时将 Home 标记为 `accepting_input=false`，close 时只恢复了 `lifecycle` 和 `host_state`，没有恢复 `accepting_input=true`。因此第二次点击即使到达平台对象，也无法满足 Core push 前置条件。

这是 Core 生命周期状态机缺口，不是 RPK、Toolkit、字体或 Simulator zoom 问题。

### 修复

- `quickapp-runtime-core/src/surface_controller.cpp`：close reveal predecessor 时恢复 `reveal->accepting_input = true`。
- `quickapp-runtime-core/tests/core_s04_surface_tests.cpp`：增加 close 后再次 push 的回归。
- `quickapp-runtime-lvgl/src/mount/mount_host.cpp`：Surface 销毁时同时清理 ClickBinding 和 InputBinding，避免重复 push/back 后失效 ClickBinding 累积。
- `quickapp-examples/composition/case001_lvgl.cpp`：P0 真实 RPK 自动验收增加 `Home -> Detail -> back -> Home -> Detail -> back` 二次循环。

### 验证

- Core `core_s04_surface_tests`：`1/1 passed`。
- 真实 TK-S12 RPK P0：通过，日志包含：

```text
lvgl.p0.router second_push=1 second_back=1 stack=1->2->1
resources_released=true
```

- 二次循环实际使用新 SurfaceId：`srf:1 -> srf:2 -> srf:1 -> srf:3 -> srf:1`。
- LVGL 相关构建通过；未修改 Bridge Contract、Runtime Tree、Toolkit 或 RPK。

## LVGL P0 Font and Visual Rendering Closeout

日期：2026-08-24

状态：`READY_FOR_ARCH_REVIEW`

### 结论先行

本次视觉问题的主因是 Simulator 默认使用 `720x1280` 逻辑视口并以 `0.5` 倍缩放输出到 `360x640` 窗口。字体在逻辑像素栅格化后再被整体缩小，英文和中文都会出现笔画变软、细节丢失；不是 RPK 字符串、Core Runtime Tree、Bridge、Mount 或路由架构问题。

已将 Simulator 默认缩放改为 `1.0`，窗口按逻辑视口使用 `720x1280`；`--zoom 0.5` 仍可显式用于小窗口适配和 A/B 对比。未修改 Core、JS、Toolkit、RPK 或公共 Contract。

### 已验证事实

- RPK：`quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk`
- RPK SHA-256：`25977ea6d92ed571ed6d019c3b0dc0b3ee5f1576acdf1ac3ee98fa68244ed74b`
- `fc-scan` 和 `hb-shape` 确认 Alpha 字体包含 P0 使用的 ASCII、中文和全角标点 Glyph；没有发现 cmap 缺失或 Glyph offset 异常。
- RPK -> Page IR -> MountHost -> LVGL Label 的文本在运行日志和 LVGL Label 读取中没有出现 UTF-8 截断、NUL 截断或乱码。
- TinyTTF 源码确认 `cache_size=8` 是 Glyph/DrawData LRU 条目数，不是字形裁剪参数；没有证据表明它会改变合法 Glyph 的位图内容，因此本轮没有用扩大缓存掩盖问题。
- 字体测量继续使用与 MountHost 相同的内置 `NotoSansSC-Alpha.ttf` 资产和 `system-default/400` 语义；未修改测量规则。
- Alpha 字体样例像素证据：
  - `quickapp-runtime-lvgl/evidence/lv-p0-font-alpha-16.png`
  - `quickapp-runtime-lvgl/evidence/lv-p0-font-alpha-30.png`

### 修改文件

- `quickapp-examples/composition/case001_lvgl.cpp`
  - 增加 Simulator `--zoom <positive-number>` 参数。
  - 默认缩放从 `0.5` 调整为 `1.0`。
  - 窗口尺寸按逻辑视口和缩放值计算，避免缩放后再用固定尺寸裁剪。
  - 仅补充一个非交互构建目标的 `[[maybe_unused]]` 标记，修复已有 `-Werror` 未使用变量阻断。
- `quickapp-runtime-lvgl/tests/lv_s04_core_mount_integration_tests.cpp`
  - 补齐已有 `InitialRenderIntent.initial_blocks` 测试字段初始化；不改变运行时语义。
- `quickapp-runtime-lvgl/evidence/lv-p0-font-alpha-16.png`
- `quickapp-runtime-lvgl/evidence/lv-p0-font-alpha-30.png`

### 缩放 A/B

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator \
  --rpk ../quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk
# simulator.display zoom=1.00 size=720x1280
# phase=rpk_opened ... simulator.ready

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator \
  --rpk ../quickapp-toolkit/evidence/tk-s12-lvgl-p0.rpk --zoom 0.5
# simulator.display zoom=0.50 size=360x640
# phase=rpk_opened ... simulator.ready
```

两组使用同一 RPK、同一 Core、同一 Mount、同一页面和同一字号；差异只来自 Simulator 显示缩放。当前环境无法通过 `screencapture` 创建桌面窗口图像（返回 `could not create image from display`），因此本交接不伪造 Home/Detail UI 截图；真实窗口人工截图仍是环境恢复后的最后视觉确认项。

### 运行与回归

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
# 83/83 passed

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4 \
  --target quickapp_lvgl_simulator quickapp_case001_lvgl
# passed
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --lvgl-p0
# exit=0; Home state/if/keyed/push/back; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --case-002
# exit=0; revision=1; removeBlock=1; moveBlock=1; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --block-001
# exit=0; add/remove/re-add; stale Handler rejected; resources_released=true
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --binding-001
# exit=0; state/binding/render/mount; resources_released=true

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl
cmake --build build-s04-debug -j 4
# passed
ctest --test-dir build-s04-debug -R 'lv_s04|lv_s06' --output-on-failure
# 6/6 passed
ctest --test-dir build-s04-debug --output-on-failure
# 13/14 passed; existing lv_s02_contract_tests LibuvLoopBackend explicit-close assertion remains
```

### 资源与架构结果

真实 P0、CASE-002、BLOCK-001、BINDING-001 日志均确认 teardown 后：

```text
surfaces=0
runtime nodes=0
handlers=0
mount objects=0
fonts=0
JS resources=0
resources_released=true
```

本次没有改变 Runtime Tree、Navigation、EventRouter、Bridge、Core/Platform 边界或字体测量合同；视觉问题已在 Simulator 显示配置边界内收口。剩余两项是非阻塞确认：桌面环境恢复后补 Home/Detail 人工截图及点击截图；另行处理既有 `lv_s02_contract_tests` Libuv close 生命周期失败。

## Gallery-001 基线（2026-08-24）

### 结论

Gallery-001 已形成可重复的真实联盟 DSL -> Toolkit -> RPK -> JS -> C++ Core -> LVGL/SDL 基线。它是设备巡检/任务看板，不是照片墙；本轮未修改 Core、JS Runtime、LVGL Runtime 或公共 Contract。

### 产物

- 源码：`quickapp-examples/showcases/gallery-001/`
- 构建脚本：`quickapp-examples/showcases/gallery-001/scripts/build-gallery.mjs`
- RPK：`quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk`
- 元数据：`quickapp-examples/showcases/gallery-001/dist/gallery-001.json`
- Entry：`/pages/Home`
- Routes：`/pages/Home`、`/pages/Detail`
- RPK：`30,619` bytes，SHA-256 `058e9b5383504d72b602160d90d6d6fcf1aac2db15243464543677f7fe1bcfe5`
- 图片：`assets/images/inspection.png`，`32x32`，`1,720` bytes；图片总大小 `1,720` bytes；图片 SHA-256 `7779d18c8feca18c8b1a42c6e8a3ca243953fdb52df3e487d3205e92a011cb41`
- 构建连续执行两次，RPK SHA-256 和大小一致。

### 功能验收

真实 RPK 中已验证：

```text
Home 首屏
-> system.device.getInfo 请求已发出
-> system.prompt.showToast 已调用
-> 手动刷新触发 state 更新
-> loading if 与 keyed for 增量更新
-> 首次刷新从 1 条变为 2 条，随后可确定性重排
-> 真实列表 Handler 点击
-> router.push('/pages/Detail')
-> Detail 显示同一张图片
-> router.back()
-> Detail Surface 销毁、Home 恢复
-> 再次点击同一列表项并 push
-> teardown 后资源归零
```

自动验收输出：

```text
gallery001.chain refresh=1 push=1 back=1 push_again=1 stack=2
resources.before_cleanup surfaces=0 nodes=0 handlers=0 mount_objects=0 roots=0
resources_released=true
```

当前 `system.device` ABI 在页面侧只暴露请求入口，没有设备结果回调合同；案例展示“设备摘要已请求”，没有伪造设备返回值。

### 运行与回归

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/gallery-001/dist/gallery-001.rpk
# exit=0; refresh=1; push=1; back=1; push_again=1; resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator \
  --rpk showcases/gallery-001/dist/gallery-001.rpk
# simulator.ready ... input=lvgl_sdl
# Ctrl-C -> simulator.closed=true; resources_released=true

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
# 83 passed, 0 failed
```

既有回归均通过：`--lvgl-p0`、`--case-002`、`--block-001`、`--binding-001` 均为 `exit=0`，并确认资源回到零。

### Simulator 边界修复

仅在 `quickapp-examples/composition/case001_lvgl.cpp` 增加了 Gallery 的组合入口适配：加载 RPK 图片资源、按真实 Page IR Handler 绑定 LVGL Button、支持 Gallery 真实 RPK 的自动验收和交互入口。未手写 Page IR、RenderTransaction、MountTransaction、UI、Router 或第二棵 Tree。

动态 Handler 解析按 `surface + templateHandlerId` 稳定前缀处理，避免 keyed key 含短横线时错误解析；交互循环的 Handler 安装按 Handler/native object 幂等，避免重复安装和日志刷屏。

### 独立阻塞

在本记录之后，工作区内并行的 `system.timer` 改动被纳入 CMake 全量重新链接；该改动当前存在独立编译错误（`timer_registry.cpp` 的 `Result` 字段以及 JS ABI Timer switch/codec 分支未完成）。本次 Gallery 适配源文件独立编译通过，Gallery 非交互真实 RPK 验收、交互 Simulator 启动/关闭和 Toolkit/既有案例回归均已通过；不在 Gallery 任务中修改 Timer/Core。

## system.timer 状态（2026-08-24）

状态：`DEFERRED`

当前仅保留 Timer 的已有 Core Registry、typed JS ABI 类型/编解码入口、静态 facade 草案和独立 Timer Fixture/回归产物；不继续扩展 Timer API、后台唤醒、Android/iOS 接入或 Gallery 集成。`timer-001` 不进入 Gallery-001 当前 RPK。

主链恢复结果：

- Toolkit：`npm test`，`84/84` 通过。

## Commerce-001 与 Wallet-001 基线（2026-08-24）

状态：`READY_FOR_PLATFORM_SHOWCASE`。

本轮新增两个产品形态 Showcase，均使用真实联盟 DSL、现有 Toolkit 和真实 RPK；未修改 Core、JS Runtime、LVGL、Android、iOS 或公共 Contract。

### Commerce-001：Android/iOS C 端产品形态

定位是“看起来像电商/小程序”的 QuickApp，不实现完整电商业务。

- Home：商品列表、图片、标题、分类、状态、价格、详情入口。
- ProductDetail：商品详情、操作按钮、真实 `router.push()` / `router.back()`。
- 底部四个 Tab：首页、直播、AI Agent、我的。
- Home 使用 state、`if`、keyed `for`、Image/Text/Button；AI Agent 当前是产品入口，不伪造 AI 能力。
- 不引入网络、Storage、支付、账号或模型依赖。

产物：

```text
源码：/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/
RPK：/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk
Size：84,813 bytes
SHA-256：295ddd67e92e9cafad9749c6a0599b83a3098f74115377003e46653dd404b0e2
Routes：Home / Live / Agent / Me / ProductDetail
Images：3 PNG，32x32，5,717 bytes total
Capabilities：system.router，system.prompt
```

### Wallet-001：嵌入式受限小屏卡包

定位是门卡、公交卡、工卡的本地卡包选择，不实现真实 NFC。

- 220x220 有限视口；Home/Detail 均保持紧凑安全区域。
- 三张 keyed 卡片：门卡、公交卡、工卡。
- 当前卡 state、`if` 状态、选择操作、详情和返回。
- 使用 3 张 32x32 本地 PNG，图片总大小 5,717 bytes。
- NFC 不进入本轮 RPK；后续以 `system.nfc` typed Feature 接入 Android/iOS Provider，LVGL 可返回 unsupported。

产物：

```text
源码：/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wallet-001/
RPK：/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wallet-001/dist/wallet-001.rpk
Size：37,386 bytes
SHA-256：c35a63ada9288655fce18a3aa35b4d105a1c0174457a2c448302692dc3024b98
Routes：Home / Detail
Images：3 PNG，32x32，5,717 bytes total
Capabilities：system.router，system.prompt
```

### 构建与验收

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/commerce-001
node scripts/build-commerce.mjs
# 连续两次 SHA-256：295ddd67e92e9cafad9749c6a0599b83a3098f74115377003e46653dd404b0e2

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wallet-001
node scripts/build-wallet.mjs
# 连续两次 SHA-256：c35a63ada9288655fce18a3aa35b4d105a1c0174457a2c448302692dc3024b98

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
# 84/84 passed
```

两个 Home Page IR 均通过结构检查：`View/Text/Button/Image`、`if`、keyed `for`、页面级和 block 级 click Handler 均存在。Android/iOS 使用 Commerce-001 作为共同 C 端 RPK；嵌入式优先使用 Wallet-001 验证有限屏幕形态。现有案例专用 LVGL composition 入口尚不是任意 Showcase 的通用 Runner，因此本轮以 Toolkit/RPK/IR 交付为主，不在案例目录内旁路补造运行逻辑。

- Core：`cmake --build build-m1-s2 -j 4`，通过；`core_timer_registry_tests` 通过。
- JS：`cmake --build build-m1-s2 -j 4`，通过；`js_s02_contract_tests`、`js_s03_module_loader_tests` 通过。`js_s04_vm_lifecycle_tests` 当前仍受工作区既有 Device/VM 测试修改影响，失败于既有消息数量断言，不由本次 Timer 收口修复。
- Examples：`cmake --build build-m1-s2 -j 4`，通过。
- Timer 当前不作为第一阶段产品阻塞项，后续重新放行时再做 Core + JS + LVGL/SDL 垂直验收。

### Timer 收口后的主链复核

- Core：`cmake --build build-m1-s2 -j 4`；`core_feature_registry_tests`、`core_timer_registry_tests`、`core_event_router_tests`，3/3 通过。
- JS：`cmake --build build-m1-s2 -j 4`；`js_s02_contract_tests`、`js_s03_module_loader_tests`，2/2 通过。
- Toolkit：`npm test`，84/84 通过；Timer Fixture 只作为独立测试产物，不进入 Gallery。
- Examples：`cmake --build build-m1-s2 -j 4`，通过。
- LVGL/SDL 默认主链：Case 001、`--lvgl-p0`、`--case-002`、`--block-001` 均真实加载 RPK 并以 exit code 0 完成；状态更新、条件/Keyed 增量、路由、资源归零均通过。
- Gallery-001 当前 RPK manifest 未声明 `system.timer`，Timer 未进入 Gallery 产物。
- Timer 继续保持 `DEFERRED`；不再扩展 API、平台接入、后台唤醒或独立运行验收。

## V1 Showcase Suite E1-E3（2026-08-24）

### 结论

E1-E3 的真实联盟 DSL、Toolkit 构建、双次确定性、RPK 结构和 Page IR 验收已完成；三个 Showcase 均已产出可交付 RPK。当前未修改 Core、JS Runtime、LVGL Runtime、公共 Contract、Navigation 或 Event。

运行层需要单独看待：现有 `quickapp_case001_lvgl` / `quickapp_lvgl_simulator` 是既有案例组合入口，不是任意 RPK 的通用 Showcase Runner。它目前只注入一张已知图片，并含有既有案例的页面结构断言；因此不能把 Consumer-001、Wearable-001 的启动失败归因于 Toolkit 或 RPK。

### 产物与确定性

| Case | Routes | Images | 图片总字节 | RPK 字节 | SHA-256 | 构建 |
| --- | --- | --- | ---: | ---: | --- | --- |
| Gallery-001 | Home / Detail | 3 x 32x32 | 5,717 | 39,349 | `adbb832cc3f36e744b5eb610842cea755ab3331f3fde12eef5ed3f2d5ce5210a` | 两次一致 |
| Consumer-001 | Home / Detail | 3 x 32x32 | 5,717 | 39,685 | `85d85579ae7cb1cbf8b1267ce5decc9257ef1e3b625e2d020caffaa2ec597907` | 两次一致 |
| Wearable-001 | Home / Detail | 2 x 32x32 | 3,716 | 35,470 | `2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588` | 两次一致 |

对应元数据在每个案例的 `dist/<case>.json`；包内均包含 `app.js`、两个页面 JS、两个 Page IR、`manifest.json`、`runtime.json` 和本地 PNG 资源。

### DSL 与 IR 验收

三个 Home Page IR 均已检查：

```text
hostTypes = View, Text, Button, Image
blocks = if, for
handlers = page click + block click
routes = /pages/Home, /pages/Detail
```

Gallery-001 覆盖设备巡检摘要、三条 keyed 任务、确定性刷新、状态 if、Detail 和真实 push/back。Consumer-001 覆盖每日清单卡片、分类/状态/摘要、刷新和 Detail。Wearable-001 覆盖安全区域内的紧凑摘要、最多三条短任务和 Detail。三个案例均未使用 Timer、网络、Storage、权限、媒体或 SVG Runtime。

构建入口：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001
node scripts/build-gallery.mjs

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/consumer-001
node scripts/build-consumer.mjs

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001
node scripts/build-wearable.mjs
```

Toolkit 当前回归：`npm test`，`84/84` 通过；`npm run lint`，Architecture boundaries 通过。

### LVGL/SDL 运行结果

已重新构建：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4 --target quickapp_case001_lvgl quickapp_lvgl_simulator
```

当前真实运行结果：

```text
Gallery-001: RPK opened -> display ready -> Core/JS instantiate -> PLATFORM_REJECTED: mount preflight rejected -> exit=134
Consumer-001: RPK opened -> display ready -> Core coordinator ready -> existing composition path terminates -> exit=134
Wearable-001: RPK opened -> display ready -> Core coordinator ready -> existing composition path terminates -> exit=134
```

这不是案例绕过或伪造的通过结果。阻塞原因在既有 composition 入口：它不是 Showcase 通用加载器，且当前只向 LVGL Mount 注入一张固定资源；多图片真实 RPK 需要一个按 RPK 资源表加载资源、按 Page IR 通用挂载并按动态 Handler 通用绑定的 Simulator/Platform Adapter。该修复属于 Runtime/Simulator 边界，超出本轮“只修改 showcases”的任务范围，不能在案例目录内旁路解决。

因此本轮状态为：

```text
Toolkit + RPK + IR：PASS
Showcase DSL 交付：PASS
现有 LVGL 组合入口对三套 Showcase 的通用运行：BLOCKED
公共 Runtime 架构：未改变
```

### 后续唯一动作

下一步应单独安排通用 Showcase Simulator/Platform Adapter：资源表全量注册、任意 RPK 的页面结构验收、通用 Event Handler 绑定和 teardown；完成后再用本节三个 RPK 做 Home -> Detail -> back 的真实回归。不要在 Showcase 源码中手写 Page IR、RenderTransaction、MountTransaction 或第二套路由。

## AI-Chat-001 阻塞记录（2026-08-24）

状态：`BLOCKED_PRECONDITION`。

工作区当前没有 AI Feature Agent 交付的 `system.ai.chat` typed Contract、Schema、JS facade 或 Mock Provider 入口。现有 Toolkit 能力白名单仍只有 `system.router`、`system.prompt`、`system.device`、`system.fetch`、`system.timer`；在 `quickapp-toolkit/src/compiler/module-graph/module-graph-builder.ts:286`，`system.ai.chat` 会被确定性拒绝为 `CAPABILITY_UNSUPPORTED`。

因此本 Agent 没有创建无效 `ai-chat-001` 源码，也没有伪造 AI 回复、绕过 Bridge 或把 Mock 结果直接写入页面状态。待 AI Feature Agent 交付最小 Contract（request/result kind、RequestId/SessionId、chunk/completed/failed/unsupported/cancelled、JS 调用形状和 Mock Provider 注册方式）后，才能在 Showcase 目录生成真实联盟 DSL 和 `ai-chat-001.rpk`。

## Gallery-001 Image Re-entry 修复（2026-08-24）

状态：`READY_FOR_ARCH_REVIEW`

### 结论

根因是 Composition Root 只向 LVGL MountHost 注册了 `assets/images/inspection.png`，而真实 Gallery-001 RPK 的 Page IR 还引用了 `assets/images/inspection-review.png` 和 `assets/images/inspection-alert.png`。第二个图片资源在 Mount 时不可用，导致整笔 MountTransaction 回滚。问题不在 Core、Router、Surface、Runtime Node、Handler 或 Image descriptor 的跨 Surface 复用。

### 修复

- `case001_lvgl.cpp` 按真实 RPK resource table 加载并注册全部 `assets/` 资源。
- LVGL MountTransaction 的操作存储改为有界容量的堆 vector；Simulator 上限为 256，embedded 上限仍为 16。
- LVGL Image 按资源路径缓存解码结果；每个 HostSlot 创建独立 descriptor、pixel buffer 和 native object；Surface release 后清理实例资源，Runtime teardown 后清理共享解码资源。
- 增加 Gallery-001 三次 Detail re-entry 的 Image snapshot 断言，覆盖 SurfaceId、NodeId、NativeHandle、descriptor、pixel buffer 和 back 后清理。

未修改 Core、JS、Toolkit、公共 Bridge/Render/Event/Navigation Contract、Timer、Gallery DSL 或 RPK 内容。

### 真实产物

```text
RPK: /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk
SHA-256: adbb832cc3f36e744b5eb610842cea755ab3331f3fde12eef5ed3f2d5ce5210a
```

### 验证结果

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/gallery-001/dist/gallery-001.rpk
# exit=0
# gallery001.chain cycles=3 image_mounts=3 surfaces=srf:2,srf:3,srf:4
# 每次 Detail Image Mount: success/presented
# 每次 back 后 Detail Image snapshot: empty
# resources.before_cleanup surfaces=0 nodes=0 handlers=0 mount_objects=0 roots=0
# resources_released=true

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_lvgl_simulator \
  --rpk showcases/gallery-001/dist/gallery-001.rpk
# simulator.ready ... input=lvgl_sdl
# simulator.closed=true
# resources.before_cleanup surfaces=0 nodes=0 handlers=0 mount_objects=0 roots=0
# resources_released=true
```

构建和回归结果：Toolkit `84/84` 通过；Examples CMake 构建通过；Case 001、CASE-002、BLOCK-001、BINDING-001 均 exit 0 且资源归零；Gallery RPK SHA-256 未变化。

LVGL CTest 为 `13/14` 通过；唯一失败是既有 `lv_s02_contract_tests` 的 `LibuvLoopBackend requires explicit close` 生命周期断言，与本次 Gallery Image re-entry 修复无关。

## Toolkit Showcase RPK 构建验收（2026-08-24）

状态：`READY_FOR_ARCH_REVIEW`

三个 Showcase 均由真实联盟 DSL 源码经 Toolkit 构建生成，未手写 Page IR、RenderTransaction 或 MountTransaction。每个案例连续构建两次，产物 SHA-256 完全一致。

| Case | RPK | Size | SHA-256 | Images | Routes |
| --- | --- | ---: | --- | --- | --- |
| Gallery-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk` | 39,349 bytes | `adbb832cc3f36e744b5eb610842cea755ab3331f3fde12eef5ed3f2d5ce5210a` | 3 PNG, 5,717 bytes total | `/pages/Home`, `/pages/Detail` |
| Consumer-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/consumer-001/dist/consumer-001.rpk` | 39,685 bytes | `85d85579ae7cb1cbf8b1267ce5decc9257ef1e3b625e2d020caffaa2ec597907` | 3 PNG, 5,717 bytes total | `/pages/Home`, `/pages/Detail` |
| Wearable-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001/dist/wearable-001.rpk` | 35,470 bytes | `2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588` | 2 PNG, 3,716 bytes total | `/pages/Home`, `/pages/Detail` |

每个 RPK 已检查包含 `app.js`、两个页面 JS、两个 Page IR、`manifest.json`、`runtime.json` 和本地图片资源。页面覆盖 View/Text/Button、`if`、keyed `for`、状态更新、详情路由和返回操作；未引入 Timer、网络、Storage、SVG 或公共 ABI 修改。

构建命令：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001 && node scripts/build-gallery.mjs
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/consumer-001 && node scripts/build-consumer.mjs
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001 && node scripts/build-wearable.mjs
```

Toolkit 回归：`cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit && npm test`，`84/84` 通过。三个 Showcase RPK 已生成并通过两次构建确定性验收；本轮未修改 Toolkit 公共输出合同。

## Gallery-001 system.device 清理（2026-08-24）

状态：`READY_FOR_PLATFORM_SHOWCASE`。

Gallery-001 已移除基础 Showcase 对 `system.device` 的依赖：

- Home 源码删除 `@system.device` import、`device.getInfo()`、设备摘要状态和设备请求展示；改为本地确定性摘要文本。
- `src/manifest.json` 删除 `system.device`，保留 `system.router` 和 `system.prompt`。
- README 删除设备 Feature 调用说明，并明确设备信息不是基础 Showcase 的运行前提。
- 最终 RPK manifest 不包含 `system.device`。

最终产物：

```text
RPK: /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk
Size: 39,154 bytes
SHA-256: 3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b
Routes: /pages/Home, /pages/Detail
Images: 3 PNG, 32x32, 5,717 bytes total
Capabilities: system.router, system.prompt
```

验收：

- Gallery 源码、manifest、README：`system.device` absent。
- 最终 RPK manifest：`system.device` absent。
- Page IR：仍包含 `View/Text/Button/Image`、`if`、keyed `for`、页面级和 block 级 click Handler、3 个 binding。
- Gallery 连续构建两次，SHA-256 均为 `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b`。
- Consumer-001 RPK 未变化：`85d85579ae7cb1cbf8b1267ce5decc9257ef1e3b625e2d020caffaa2ec597907`。
- Wearable-001 RPK 未变化：`2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588`。
- Toolkit：`npm test`，`84/84` 通过。

## LVGL Platform Showcase 验收（2026-08-24）

状态：`READY_FOR_ARCH_REVIEW`

本轮只修改 LVGL Showcase Composition Root：按真实 RPK resource table 注册全部 `assets/`，显式 `--rpk` 使用 RPK entry route，允许无 App lifecycle hook 的合法 `app.js`，并按真实 Page IR 的 page/block Handler 动态绑定 LVGL 对象。未修改 Core、JS、Toolkit、公共 Contract、案例 DSL 或 RPK。

### 真实 RPK

| Case | Size | SHA-256 | Images |
| --- | ---: | --- | ---: |
| Gallery-001 | 39,154 bytes | `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b` | 3 |
| Consumer-001 | 39,685 bytes | `85d85579ae7cb1cbf8b1267ce5decc9257ef1e3b625e2d020caffaa2ec597907` | 3 |
| Wearable-001 | 35,470 bytes | `2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588` | 2 |

### 自动化运行

三个案例均使用真实 RPK 完成：首屏 Mount、状态刷新 revision 1、Image、if/keyed for、详情 push、三次 Detail 进入、back/close 和 teardown。

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/gallery-001/dist/gallery-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/consumer-001/dist/consumer-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/wearable-001/dist/wearable-001.rpk
```

三个命令均 exit 0；均输出 `platform.mount.complete mounted=1`、`showcase.chain cycles=3 image_mounts=3 surfaces=srf:2,srf:3,srf:4`，并在结束时输出 `resources.before_cleanup surfaces=0 nodes=0 handlers=0 mount_objects=0`、`resources_released=true`。

自动化日志：

- `/private/tmp/quickapp-kit-lvgl-gallery-001.log`
- `/private/tmp/quickapp-kit-lvgl-consumer-001.log`
- `/private/tmp/quickapp-kit-lvgl-wearable-001.log`

旧 Case 001、CASE-002、BLOCK-001、BINDING-001 回归均 exit 0 且资源归零；Toolkit `npm test` 保持 `84/84` 通过。

### Simulator 入口

三个 RPK 均可通过以下持续 SDL 入口加载并关闭，退出码均为 0，输出 `simulator.ready`、`simulator.closed=true` 和 `resources_released=true`：

```text
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/gallery-001/dist/gallery-001.rpk
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/consumer-001/dist/consumer-001.rpk
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/wearable-001/dist/wearable-001.rpk
```

当前环境未生成截图或视频：headless SDL 验收完整通过；真实窗口启动因桌面会话不可用而失败于 `SDL display creation failed`。视觉差异待现场窗口确认，未修改应用语义或平台布局规则。

## iOS Platform Showcase 验收（2026-08-24）

状态：`BLOCKED_ON_FINAL_UI_RECHECK`；Core、JS、Toolkit、公共 Contract 和案例 DSL 均为只读输入。本轮只修改 `quickapp-runtime-ios/**`。

### 输入 RPK

| Case | RPK | SHA-256 |
| --- | --- | --- |
| Gallery-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk` | `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b` |
| Consumer-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/consumer-001/dist/consumer-001.rpk` | `85d85579ae7cb1cbf8b1267ce5decc9257ef1e3b625e2d020caffaa2ec597907` |
| Wearable-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001/dist/wearable-001.rpk` | `2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588` |

### 验证命令和结果

构建 iOS UIKit Simulator，并校验 Bundle 内四个 RPK：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios
./tools/build-ios-simulator.sh
```

结果：构建成功；三个 Showcase RPK 的 Bundle SHA-256 与上表一致；基线 `tk-s12-lvgl-p0.rpk` SHA-256 为 `25977ea6d92ed571ed6d019c3b0dc0b3ee5f1576acdf1ac3ee98fa68244ed74b`。

Host probe 使用真实 RPK 和相同 iOS Runtime Spine：

```text
./build-host/quickapp_ios_spine_probe <case-rpk> node:4
```

三个 Case 均 exit `0`，均验证：首屏 Mount、Image、if、keyed for、真实 page handler、`RenderTransaction revision=1`、资源 teardown。三套 RPK 的最终资源结果均为：`surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0`。原始日志：

- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/showcase-logs/gallery-001-host-probe.log`
- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/showcase-logs/consumer-001-host-probe.log`
- `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/showcase-logs/wearable-001-host-probe.log`

每个 Case 的增量刷新都确认了同一条边界：

```text
UIKit input -> iOS Gateway -> Core EventRouter -> JS Handler -> RenderTransaction revision=1 -> iOS Gateway Mount
```

### UIKit 运行结果

- Gallery-001：真实 UIKit 首屏、Image/list、状态刷新、详情 push/back、重复进入详情并返回均已执行；截图：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-gallery-home.png`。
- Consumer-001：真实 UIKit 首屏、Image/list、状态刷新、详情 push/back 已执行；截图：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-consumer-home.png`。
- Wearable-001：真实 UIKit 首屏、Image/list、详情 push/back 已执行；同步按钮的点击已进入 Core 并产生真实 RPK 的 `revision=1` 增量事务，最终可见文本复核因本轮 Simulator 在重装包时 CoreSimulatorService 崩溃且随后 Mac 锁屏，未伪造为通过；截图：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-wearable-home.png`。

本轮未生成视频；现有截图均为 Simulator 真实窗口截图。CoreSimulatorService 恢复后重新安装最新 Bundle 即可复核 wearable 的最终可见状态。

### iOS 侧变更

- `src/runtime_spine.cpp`：接入真实 RPK resource table，解析初始/增量 block，绑定 page/block handler，保留 Core Router、Runtime Tree 和 Lifecycle 为唯一实现；增加 iOS 结构化诊断日志。
- `src/ios_gateway.mm`：UIKit `View/Text/Button/Image/Input`、资源加载、真实点击、增量 Mount、Surface present/close/destroy 和 teardown。
- `src/ios_simulator_main.mm`、`QuickAppSimulator-Info.plist`、`CMakeLists.txt`、`tools/build-ios-simulator.sh`：多 RPK Simulator 入口和 UIKit Scene 生命周期。
- `src/ios_spine_probe.cpp`：支持指定 Home Node 的 iOS host 回归并输出 Mount 操作证据。

未修改 `quickapp-runtime-core/**`、`quickapp-runtime-js/**`、`quickapp-toolkit/**`、`quickapp-examples/**`、Android、LVGL 或公共 Contract。

### 其他测试

```text
swift test                         # 19 tests, 0 failures
cmake --build build-ios-ninja      # passed
cmake --build build-host --target quickapp_ios_spine_probe -j 4  # passed
```
## LVGL Simulator 点击详情闪退修复（2026-08-24）

状态：`READY_FOR_PLATFORM_SHOWCASE`

### 根因

1. Surface 对象销毁时，LVGL 可能在删除对象树过程中同步触发回调；旧实现先删除对象、后失效 Click/Input Binding，存在访问已退役 Binding 的窗口。
2. Detail 重入会反复创建和销毁相同字号的 TinyTTF 实例。第三次重入触发 `stbtt__new_active` 断言；该问题属于 LVGL 字体实例生命周期，不是 Core/Yoga/Layout 或 Navigation Contract。

### 修复

- `quickapp-runtime-lvgl/src/mount/mount_host.cpp`：Surface 销毁前先失效对应 Click/Input Binding，再删除 LVGL 对象树。
- `MountHost`：字体实例按字号在 MountHost 生命周期内缓存；Surface 释放只减少引用，MountHost `finishClose` 才销毁字体实例。
- 未修改 Core、Yoga、JS、Bridge、Render、Event、Navigation 公共语义。

### 验证

```text
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/gallery-001/dist/gallery-001.rpk
# exit=0
# showcase.chain cycles=3 image_mounts=3 surfaces=srf:2,srf:3,srf:4
# resources_released=true
```

LVGL 定向回归：`lv_s04_font_profile_probe`、`lv_s04_mount_contract_tests`、`lv_s04_core_mount_integration_tests`，`3/3` 通过。

现场交互复测：

```text
./build-m1-s2/quickapp_lvgl_simulator \
  --rpk showcases/gallery-001/dist/gallery-001.rpk \
  --zoom 1
```

需确认 Home -> 点击详情 -> Detail -> 返回 -> 再次详情连续执行三次。当前环境未能自动操作桌面窗口；自动化路径已覆盖相同 Surface/Handler/Mount 重入链路。

### 独立视觉问题

Showcase 使用的部分汉字不在当前 `NotoSansSC-Alpha.ttf` 字符子集内，表现为方框。这是字体资产覆盖范围问题，后续单独扩充 Showcase 字符集和重新生成字体，不修改 Core/Yoga。

## LVGL Showcase 字体资产与视觉收口（2026-08-24）

状态：`READY_FOR_ARCH_REVIEW`

### 结论

三个 Showcase 的中文方框和文字宽度异常已在 LVGL 字体边界收口：新增可见中文字符已加入受控 `system-default/400` 字体子集；Core 测量和 LVGL TinyTTF 使用同一内置 TTF 资产；在 64 KiB LVGL 内存预算下，TinyTTF glyph cache 从 8 降为 2，避免多页重入时的临时栅格化分配失败。未修改 Core、Yoga、JS、Toolkit、公共 Contract、Showcase DSL、Android、iOS 或 Simulator Composition Root。

### 字体资产

- 字符来源：Gallery-001、Consumer-001、Wearable-001 的真实 `.ux`、`manifest.json` 和页面可见文案。
- 新增字符：`81` 个去重 Unicode code point。
- 生成源：仓库内 `source/third_party/lvgl/tests/src/test_files/fonts/noto/NotoSansSC-Regular.ttf`。
- 受控子集：`quickapp-runtime-lvgl/assets/fonts/NotoSansSC-Alpha.ttf`。
- 字体文件大小：`68,008` bytes。
- 字体 SHA-256：`c44bb9ee7e921021ce95877315e570a39cda184a1ceb23ca6812987ce265d01d`。
- 编译期内置数组：`quickapp-runtime-lvgl/src/font/system_default_font_asset.inc`，长度 `68,008` bytes，与 TTF 一致。
- 内置 digest：`quickapp-runtime-lvgl/src/font/system_default_font_asset.cpp` 与上述 SHA-256 一致。
- 字符清单：`quickapp-runtime-lvgl/assets/fonts/system-default-cjk-glyphs.txt`；Showcase 新增字符保持单独可审计行。

### 根因与修复

1. 初始方框的直接根因是 Alpha 字体白名单只覆盖旧 Case 001/P0 文案，Showcase 新增中文未进入 cmap/glyph 子集。
2. 字体扩充后，三个 Showcase 的真实字符串在 LVGL TinyTTF 中均可获得 glyph descriptor 和非空 bitmap。
3. 首次回归还暴露出 64 KiB LVGL 内存预算下的 TinyTTF 临时栅格化压力：Gallery/Consumer 在 Detail 返回重入时触发 `stbtt__new_active` 断言。该问题不是 RPK、Core Layout 或缺字问题。
4. LVGL MountHost 的 TinyTTF cache 固定为每个字号 `2` 个 glyph 槽位；仍保留有限缓存、字体按字号复用和 MountHost teardown 统一销毁，不通过禁用释放或复用失效 Native Font 绕过问题。

### 字体一致性验证

`lv_s04_font_profile_probe` 对新增 81 个字符逐个验证：

- LVGL glyph descriptor 存在；
- glyph bitmap 非空；
- `FontMeasureAdapter` 单字符宽度与 LVGL `glyph.adv_w` 一致；
- 字体 publisher 和 TinyTTF 字体实例释放后内存归零。

三项 LVGL 定向测试：`3/3 PASS`。

### Showcase RPK 与自动验收

| Case | RPK | SHA-256 | 结果 |
| --- | --- | --- | --- |
| Gallery-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk` | `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b` | exit 0 |
| Consumer-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/consumer-001/dist/consumer-001.rpk` | `85d85579ae7cb1cbf8b1267ce5decc9257ef1e3b625e2d020caffaa2ec597907` | exit 0 |
| Wearable-001 | `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-001/dist/wearable-001.rpk` | `2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588` | exit 0 |

自动验收均覆盖真实 RPK 加载、首屏、state/if/keyed for、Image、push/back、三次 Detail 重入和 teardown。每个案例均输出 `showcase.chain cycles=3 image_mounts=3`，并以 `resources.before_cleanup surfaces=0 nodes=0 handlers=0 mount_objects=0`、`resources_released=true` 收口。

### 构建与回归

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl
cmake --build build-m1-s2 -j 4 --target \
  lv_s04_font_profile_probe \
  lv_s04_mount_contract_tests \
  lv_s04_core_mount_integration_tests
ctest --output-on-failure -R \
  'lv_s04_(font_profile_probe|mount_contract_tests|core_mount_integration_tests)'
# 3/3 passed

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
cmake --build build-m1-s2 -j 4 --target quickapp_case001_lvgl quickapp_lvgl_simulator
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/gallery-001/dist/gallery-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/consumer-001/dist/consumer-001.rpk
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl --rpk showcases/wearable-001/dist/wearable-001.rpk
# 三个 Showcase 均 exit 0

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm test
# 84/84 passed
```

旧 Case 001、CASE-002、BLOCK-001、BINDING-001 均 exit 0；LVGL Simulator 的三个真实 RPK 均可启动、持续运行、接收关闭信号并 teardown，均输出 `simulator.closed=true` 和 `resources_released=true`。

### 视觉证据与剩余项

当前环境的 headless SDL 已完成结构化验收，但无法生成真实桌面截图：真实窗口启动会因桌面会话不可用返回 `SDL display creation failed`。因此中文 glyph 的 descriptor、bitmap、measure 和真实 RPK 链路均已验证，肉眼截图仍需在可用桌面会话运行以下命令确认：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/gallery-001/dist/gallery-001.rpk
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/consumer-001/dist/consumer-001.rpk
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/wearable-001/dist/wearable-001.rpk
```

未发现 Core Layout 与 LVGL Mount rect 的新偏差；本轮没有通过修改页面坐标、字号或布局掩盖字体问题。剩余项仅为可用桌面会话下的人工截图确认，不阻塞字体资产和自动化 Runtime 验收。

## LVGL Showcase Image 视觉修复（2026-08-24）

状态：`READY_FOR_PLATFORM_SHOWCASE`

截图复核确认字体已清晰；剩余视觉问题来自 LVGL Image Host 的两个局部错误：

1. LodePNG 返回 RGBA 字节，但手工 Image Mount 直接按 LVGL BGRA 内存布局使用，造成红蓝通道错位和图像颜色异常。
2. 32x32 本地图片挂载到 24x24 Host Layout 时未设置缩小适配，造成图片裁切。

修复文件：`quickapp-runtime-lvgl/src/mount/mount_host.cpp`。

- 在每个 HostSlot 图片副本进入 `lv_image_dsc_t` 前执行 RGBA -> BGRA 通道转换；共享解码缓存仍保持原始 RGBA，不改变 RPK 资源语义。
- 使用 `LV_IMAGE_ALIGN_CONTAIN_DOWNSCALE`，保持宽高比并在小尺寸 Host 中完整显示图片。
- 未修改 Core、Yoga、JS、Toolkit、公共 Contract、Showcase DSL、Android、iOS 或 Simulator Composition Root。

验证：

- Examples CMake 构建：通过。
- Gallery-001、Consumer-001、Wearable-001 真实 RPK 自动验收：均 exit 0。
- 每个案例仍输出 `showcase.chain cycles=3 image_mounts=3`、`resources.before_cleanup surfaces=0 nodes=0 handlers=0 mount_objects=0`、`resources_released=true`。
- Case 001、CASE-002、BLOCK-001、BINDING-001：均 exit 0。
- 三个 Showcase 的 RPK SHA-256 未变化。

本次 screenshot 中的中文字体问题已解决；Image 颜色和小尺寸裁切问题已在 LVGL Mount 边界修复。最终肉眼效果可用以下命令复测：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
./build-m1-s2/quickapp_lvgl_simulator --rpk showcases/gallery-001/dist/gallery-001.rpk
```

## LVGL Image Descriptor stride 收口（2026-08-24）

最新截图中的残余水平条纹根因是手工创建的 `lv_image_dsc_t` 未填写 `header.stride`，LVGL 按 0 行步长读取 ARGB8888 图像；同时 descriptor 的 `header.magic` 也未显式设置。

已在 `quickapp-runtime-lvgl/src/mount/mount_host.cpp` 补齐：

- `header.magic = LV_IMAGE_HEADER_MAGIC`；
- `header.stride = width * 4`；
- 保留 RGBA -> BGRA 转换；
- 保留 `LV_IMAGE_ALIGN_CONTAIN_DOWNSCALE`。

这样 Image Host 的完整数据合同为：

```text
RPK PNG
-> LodePNG RGBA
-> HostSlot BGRA pixels
-> lv_image_dsc_t(magic, cf, w, h, stride, data_size, data)
-> LVGL Image
```

Gallery-001、Consumer-001、Wearable-001 真实 RPK 回归均 exit 0，均完成三次 Detail 重入并输出 `resources_released=true`。未修改 Core、Toolkit、RPK、公共 Contract 或 Showcase DSL。

补充：Image 的 `src` 通常先于 `SetHostLayout` 到达，因此在最终布局矩形提交后再次应用 `LV_IMAGE_ALIGN_CONTAIN_DOWNSCALE`，确保 32x32 资源在 24x24 Host 中按最终尺寸缩小，而不是按初始 intrinsic size 绘制后被裁切。最新 Examples 构建和 Gallery 自动验收已通过。
## Commerce-001 / Wallet-001 Toolkit RPK 构建验收（2026-08-24）

结论：两个最终演示案例均使用真实联盟 DSL 和现有 Toolkit 构建成功；重复构建字节级稳定，可进入平台 Showcase 验证。

### Commerce-001

- 源码：`quickapp-examples/showcases/commerce-001/src/`
- 构建：`node quickapp-examples/showcases/commerce-001/scripts/build-commerce.mjs`
- RPK：`quickapp-examples/showcases/commerce-001/dist/commerce-001.rpk`
- 大小：`84813` bytes；SHA-256：`295ddd67e92e9cafad9749c6a0599b83a3098f74115377003e46653dd404b0e2`
- 路由：`/pages/Home`、`/pages/Live`、`/pages/Agent`、`/pages/Me`、`/pages/ProductDetail`
- 图片：3 张，32x32，总计 `5717` bytes
- 能力声明：`system.router`、`system.prompt`
- 覆盖：Image/Text/Button、state、`if`、keyed `for`、商品详情 push/back、四 Tab
- `AI Agent` 仅为页面和 Tab，不声明或调用 AI Feature。

### Wallet-001

- 源码：`quickapp-examples/showcases/wallet-001/src/`
- 构建：`node quickapp-examples/showcases/wallet-001/scripts/build-wallet.mjs`
- RPK：`quickapp-examples/showcases/wallet-001/dist/wallet-001.rpk`
- 大小：`37386` bytes；SHA-256：`c35a63ada9288655fce18a3aa35b4d105a1c0174457a2c448302692dc3024b98`
- 路由：`/pages/Home`、`/pages/Detail`
- 图片：3 张，32x32，总计 `5717` bytes
- 能力声明：`system.router`、`system.prompt`
- 覆盖：Image/Text/Button、state、`if`、keyed `for`、卡片选择、详情 push/back
- 不调用 NFC、设备或其他未实现 Feature。

### 确定性与回归

- Commerce 两次构建均为 `295ddd67e92e9cafad9749c6a0599b83a3098f74115377003e46653dd404b0e2`。
- Wallet 两次构建均为 `c35a63ada9288655fce18a3aa35b4d105a1c0174457a2c448302692dc3024b98`。
- RPK 内容包含 `app.js`、各页面 `index.js`、Page IR、`runtime.json`、`manifest.json` 和 PNG 资源表；未手写 Page IR、RenderTransaction 或 MountTransaction。
- Toolkit 全量测试：`84 passed, 0 failed`。
- 状态：`READY_FOR_PLATFORM_SHOWCASE`。

## Android Platform Showcase 回归（2026-08-24）

结论：Android 已使用同一套真实 Toolkit RPK 完成三个 Showcase 的首屏、Image、if/for、状态刷新、详情 push/back 和第二次 push/back。主链路通过；页面关闭后的最终 Surface 销毁仍被 Core 未发送 `DestroySurface` 阻塞，不能宣称 Android 资源已归零。

### 输入与构建

平台项目：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android`

构建命令：

```text
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew :app:assembleDebug --no-daemon --no-configuration-cache
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

真实 RPK 与 SHA-256：

| Case | RPK | SHA-256 |
|---|---|---|
| gallery-001 | `quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk` | `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b` |
| consumer-001 | `quickapp-examples/showcases/consumer-001/dist/consumer-001.rpk` | `85d85579ae7cb1cb8f1267ce5decc9257ef1e3b625e2d020caffaa2ec597907` |
| wearable-001 | `quickapp-examples/showcases/wearable-001/dist/wearable-001.rpk` | `2c14cfceb356b55a7dccbef63675b2fe58046884df3783b117ad137e088ca588` |

启动命令模板：

```text
adb shell am start -n dev.quickapp.kit.android/.MainActivity --es quickapp.rpk <case>.rpk
```

### 验收结果

| Case | 首屏/Image | if/for | 状态刷新 | push/back | 第二次 push/back | 结果 |
|---|---|---|---|---|---|---|
| gallery-001 | PASS | PASS | PASS | PASS | PASS | 主链通过 |
| consumer-001 | PASS | PASS | PASS | PASS | PASS | 主链通过 |
| wearable-001 | PASS | PASS | PASS | PASS | PASS | 主链通过 |

每个案例的真实日志都包含：`handler_execute dispatched=1`、`android.navigation.push accepted=1`、`android.navigation.close.result ... revealed=srf:1 completed=1`，以及刷新后的 `mount.result ... revision=1`。

### 证据路径

截图位于：

```text
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/evidence/showcase-gallery-001-*.png
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/evidence/showcase-consumer-001-*.png
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/evidence/showcase-wearable-001-*.png
```

关键日志位于：

```text
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/evidence/showcase-gallery-001-final.log
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/evidence/showcase-consumer-001.log
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/evidence/showcase-wearable-001.log
```

### Android-only 修复

- Android 适配器支持 `Image` 的 RPK member 加载。
- Android 适配器把 `InitialBlock/InstantiateBlock` 的真实 block handler binding 注册到 JS HandlerRegistry，事件不再停在 Core EventRouter。
- Android 保留平台 close 返回的 reveal Surface，并向 JS 回传正确的 `revealedSurfaceId`。
- 未修改 Core、JS Framework、Toolkit、公共 Contract、RPK 或 Showcase DSL；没有增加第二套路由、第二棵树或平台私有业务状态。

### 阻塞事实

平台 close 日志显示：第一次返回时 `surfaces=2`，第二次返回时 `surfaces=3`。Android 只隐藏 source 并显示 reveal，没有提前删除 source；当前 Core 没有继续发送平台 `DestroySurface`，因此无法得到 `surfaces=1` 或 `resources_released=true` 的完整运行时证据。三个 Android 进程离开 Activity 后均已退出，但这是进程级结束，不等价于逐 Surface 销毁合同完成。

后续唯一必要动作：由 Core/Runtime 集成方补齐 `CloseSurface -> onDestroy -> DestroySurface` 时序并回归 Android；本次 Android Showcase Agent 到此停止。

## LVGL Gallery-001 视觉收口（2026-08-25）

结论：Android 基准中的 Gallery-001 页面语义和视觉规则已经确认；LVGL 侧本轮修复了 View 背景未呈现的问题，未修改 Core、JS Framework、Toolkit、RPK、公共 Contract 或 Showcase DSL。

### 根因与修复

- Gallery-001 的 `.summary` 和 `.list` 是 View，DSL 明确声明了 `background-color`。
- LVGL View 创建时由 `resetViewChrome()` 设置 `bg_opa=LV_OPA_TRANSP`，后续 `backgroundColor` 只设置颜色，没有恢复不透明度。
- `quickapp-runtime-lvgl/src/mount/mount_host.cpp` 现在在 View 的 `backgroundColor` 成功设置后同步设置 `bg_opa=LV_OPA_COVER`。
- 这是 LVGL Platform Mount 的样式呈现修复，不改变 Runtime Tree、Layout、Navigation、EventRouter、Bridge 或 RPK。

### 验证

- RPK：`quickapp-examples/showcases/gallery-001/dist/gallery-001.rpk`
- RPK SHA-256：`3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b`
- 构建：`cmake --build quickapp-examples/build-m1-s2 -j 4 --target quickapp_lvgl_simulator quickapp_case001_lvgl`
- LVGL CTest：`lv_s04_font_profile_probe`、`lv_s04_mount_contract_tests`、`lv_s04_core_mount_integration_tests`、`lv_s06_contract_tests`，`4/4` 通过。
- 真实 Gallery-001、Consumer-001、Wearable-001 RPK 自动验收均通过；每个均报告 `showcase.chain cycles=3 image_mounts=3`。
- CASE-002、BLOCK-001、BINDING-001 回归通过。
- 所有运行均报告 `resources_released=true`，teardown 后 surfaces、nodes、handlers、mount_objects、roots 和 JS 资源归零。
- 最新窗口截图：`/tmp/qak-gallery-lvgl-window.png`。截图验证 summary/list 背景已呈现；截图期间桌面存在系统级录屏权限弹窗，非 QuickApp/LVGL 输出。

### 当前判断

Gallery-001 的 LVGL 主链和基础视觉已经可用。Android 与 LVGL 的剩余差异主要是平台字体/显示缩放和图片素材在小尺寸下的视觉细节，不构成 Core 或 RPK 架构阻塞。

## LVGL Image 最终缩放重算（2026-08-25）

用户复核发现上一版仍存在 Image 裁切/条纹视觉问题，上一版不能视为完成。本轮继续限定在 LVGL Platform Mount。

根因：LVGL 的 `lv_image_set_inner_align()` 在目标 align 与当前 align 相同时直接返回。Image source 通常先于最终 `SetHostLayout` 设置，后续重复设置 `CONTAIN_DOWNSCALE` 不会重新计算最终 Host 尺寸，导致小尺寸 Image 沿用创建阶段的缩放状态。

修复：在 `SetHostLayout` 设置最终位置和尺寸后，Image 先切换到 `LV_IMAGE_ALIGN_CENTER`，再切换到 `LV_IMAGE_ALIGN_CONTAIN_DOWNSCALE`，强制基于最终 24x24/32x32 Host rectangle 重算缩放。未修改 Image 资源、Core、Toolkit、RPK、公共 Contract 或案例 DSL。

验证：

- `cmake --build quickapp-examples/build-m1-s2 -j 4 --target quickapp_lvgl_simulator quickapp_case001_lvgl` 通过。
- LVGL CTest 四项通过：`lv_s04_font_profile_probe`、`lv_s04_mount_contract_tests`、`lv_s04_core_mount_integration_tests`、`lv_s06_contract_tests`。
- Gallery-001 真实 RPK 自动验收通过：`showcase.chain cycles=3 image_mounts=3`、`resources_released=true`。
- Gallery-001 RPK SHA-256 仍为 `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b`。
- 当前 `mount_host.cpp` SHA-256：`12c1ceda7412052a41ff1d4aa69e654648d5c41dd3e3ad949f69e425f973cd7f`。

当前状态：Image 资源格式、descriptor stride、View 背景透明度和最终布局缩放均已覆盖；需要使用本次重新构建的 Simulator 进行最终人工视觉确认。

## LVGL Showcase Image/字体视觉第三次收口（2026-08-25）

上一张人工截图仍显示 Image 条纹、裁切和整体视觉比例偏大的问题；本轮不再把自动 Mount 成功当作视觉完成，继续处理两个平台侧问题。

### 修复

1. `MountHost` 保存每个 Image 的原始 BGRA 像素和源尺寸。
2. 最终 `SetHostLayout` 确定后，按 Host rectangle 使用确定性 nearest resize 生成目标像素，不再让 24px 图片进入 LVGL 的缩放 transform 路径。
3. 兼容 `SetHostLayout` 先于 `src` 的真实事务顺序：资源未到达时延迟缩放，`src` 到达后若布局已知立即完成缩放。
4. 上一版曾尝试使用 `720x1280 + zoom=0.5`，人工截图证明这会对已经栅格化的文字和小图片做二次采样，已撤回。当前 Simulator 直接使用 `360x640` 逻辑 Runtime viewport，默认 `zoom=1.0`；`--zoom` 仅用于显式 A/B。

### 验证

- 构建：`cmake --build quickapp-examples/build-m1-s2 -j 4 --target quickapp_lvgl_simulator quickapp_case001_lvgl` 通过。
- Gallery-001、Consumer-001、Wearable-001 的真实 RPK 均完成初始挂载、3 次 Detail re-entry 和 teardown。
- 三个案例均报告 `showcase.chain cycles=3 image_mounts=3`、`resources_released=true`。
- LVGL CTest：`lv_s04_font_profile_probe`、`lv_s04_mount_contract_tests`、`lv_s04_core_mount_integration_tests`、`lv_s06_contract_tests`，`4/4` 通过。
- RPK 未修改；Gallery-001 SHA-256 仍为 `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b`。
- 当前 `mount_host.cpp` SHA-256：`279e0a58ede7b870a596bb54d19d55126ac433f5270a30fa27e09ac68fc8e6f5`。

## LVGL Simulator 显示策略校正（2026-08-25）

用户复核证明上一版 `720x1280 + zoom=0.5` 会造成整页二次缩放，文字和小图片变模糊；该配置不是视觉修复，已撤回。

当前显示合同：

- interactive logical viewport：`360x640`；
- default display zoom：`1.0`；
- 默认路径不做二次 downsampling；
- `--zoom` 只用于显式显示 A/B，不改变 Core 布局。

同一轮还修正了 Image 解码边界：LVGL 内置 `lodepng_decode32` 返回 `lv_draw_buf_t`，MountHost 现在读取其 `data` 并通过 `lv_draw_buf_destroy` 释放，不再把 draw-buffer 头部误当作像素数据。

### 最新验证结果

- `mount_host.cpp` 最新 SHA-256：`c01005702cb1e37c8c8ab0c5fb68b255639bdb66a75d9ac7a205b9b2fdbf2b4f`。
- `quickapp_lvgl_simulator` 已重新构建，启动日志为 `simulator.display zoom=1.00 size=360x640`。
- Gallery-001 真实 RPK、CASE-002、BLOCK-001、BINDING-001 均退出码 `0`，且资源清理结果为 `resources_released=true`。
- LVGL 四项 CTest：`4/4 passed`。
- 真实窗口截图仍需用户在本机启动最新二进制后复核；桌面权限网关未允许本 Agent 捕获窗口，不能用自动日志替代肉眼验收。

## LVGL Wallet-001 Simulator 加载（2026-08-25）

### 结论

Wallet-001 的真实 RPK 已可被 LVGL Simulator 加载、首屏挂载并进入持续交互循环。此前退出不是 RPK、Toolkit、Core 或 Image 失败，而是 Composition Root 假设所有 Showcase 都存在静态 `hdl:1`；Wallet 的首个交互 Handler 来自 keyed block，使用 block-scoped HandlerId。

### 修复

- `quickapp-examples/composition/case001_lvgl.cpp`：Showcase 首个 Handler 解析改为先查静态 `hdl:1`，不存在时从当前 Surface 的真实 block Handler 列表解析。
- 未修改 Core、JS、Toolkit、公共 Contract、RPK 或第二套路由。

### 验证

- RPK：`quickapp-examples/showcases/wallet-001/dist/wallet-001.rpk`
- RPK SHA-256：`c35a63ada9288655fce18a3aa35b4d105a1c0174457a2c448302692dc3024b98`
- Simulator：`simulator.display zoom=1.00 size=360x640`
- 资源：`card-door.png`、`card-transit.png`、`card-work.png` 均成功加载。
- 初始 Mount：`mounted=1`，Surface `srf:1` 可见。
- Handler：`showcase.click_handlers installed=3`。
- 退出：`simulator.closed=true`、`resources_released=true`，Surface、Node、Handler、Mount Object、JS 资源均归零。
- 真实窗口模式仍受当前 macOS SDL 服务权限影响；dummy backend 的加载和生命周期验证已通过。

当前要求：必须使用本次重新构建的 `quickapp_lvgl_simulator`，默认窗口比例已改变；如果仍有视觉问题，下一步只比较最新窗口的逻辑 Host rect、字体字号和 Image descriptor，不再修改案例 DSL 或 Core。

## iOS Gallery-001 视觉适配（2026-08-25）

结论：iOS 侧窗口和原生控件适配已修复；Core 输出的统一逻辑布局未被改写。

- `ios_simulator_main.mm` 移除 Simulator 自有标题和导航容器，Runtime Host 绑定到 Root View Controller 的 safe area，避免动态岛/状态栏遮挡首屏。
- `ios_gateway.mm` 为 UILabel/UIButton 设置与 Android 默认控件接近的单行字体、尾部省略和最小缩放策略；Style 中的 `fontSize` 仍由真实 MountTransaction 应用。
- 真实 Gallery-001 RPK 未修改，SHA-256 仍为 `3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b`。
- Core probe 的真实 frame 显示标题节点宽 `54`、列表标题宽 `34`；因此少量省略号属于共享 Core 测量和布局结果，不在 iOS 端扩宽或创建旁路布局。

验证：

- iOS Simulator 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4`，通过。
- 真实画面：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-gallery-001-home-text-adapter-2026-08-25.png`。
- Bundle 内 Gallery-001 RPK SHA-256：`3f4e75176f05a38373e9a28781d5a5d217724785aad139740f2e26d785f0e10b`。

## Android B1 Input + Switch（2026-08-25）

结论：Android 平台已使用真实 `controls-001.rpk` 完成 Input/Switch 首屏和交互链路；没有修改 Core、JS、Toolkit、公共 Contract 或案例源码。

- RPK：`quickapp-examples/showcases/controls-001/dist/controls-001.rpk`
- SHA-256：`1e25a27daf59e5ae2f6b0bd046a7e9c4fe2876cfcd4dcebea2a2e26a7ed7f829`
- 初始 Mount：`operations=56`、`ok=true`、`revision=0`；Surface `srf:1` 已 Present。
- Android 原生 `EditText` 已映射 `focus/input/change`；`Switch` 已映射 `change` 并携带 `checked`；事件经 JNI、Core Event Router 到 JS Handler，均执行成功。
- 受控 `value/checked` 更新带反馈抑制，不产生平台回环事件。
- Android 资产与入口仅修改平台目录：`app/build.gradle.kts`、`MainActivity.java`、`RuntimeSurfaceHost.java`、`RuntimeBridge.java`、`NativeGateway.java`、`runtime_spine.h`、`jni_gateway.cpp`、`runtime_spine.cpp`。
- Evidence：`quickapp-runtime-android/evidence/b1-input-switch-android.md`、`controls-001-android-home.png`、`controls-001-android-final.png`、`controls-001-android-interaction.log`。
- `controls-001.rpk` 只有 `pages/Home`，没有 Detail route 或导航 handler，因此 push/back、重复进入和路由 teardown 对本案例为 `NOT_APPLICABLE`；未创建平台私有页面或旁路路由。

## iOS B1 Input + Switch（2026-08-25）

结论：iOS 平台已完成 `controls-001.rpk` 的真实 Input/Switch 映射和事件回传；未修改 Core、JS、Toolkit、公共 Contract 或 Examples。

### 实现

- `src/ios_gateway.mm`：
  - `Input` 映射为 `UITextField`；支持 `value`、`enabled`、`color`、`backgroundColor`、`borderRadius`。
  - `Switch` 映射为 `UISwitch`；支持 `checked`、`enabled`、`backgroundColor`、`borderRadius`。
  - UIKit 回调统一进入 `RuntimeSpine::dispatchInput`，再经过 Core `EventRouter` 和 JS Handler；没有平台私有事件旁路。
  - Input 接入 `focus`、`input`、`change`；Return 触发 `EditingDidEndOnExit` 的 change 回调。
  - Switch `ValueChanged` 映射为 `change`，payload 为 `{ checked: boolean }`。
- `src/runtime_spine.cpp` / `include/quickapp/ios/runtime_spine.h`：增加平台通用 typed input dispatch 入口；Click 复用该入口。
- `src/ios_spine_probe.cpp`：增加 iOS 自有 probe 的 input/change/focus/switch 事件参数，用于真实 RPK 回归。
- `CMakeLists.txt`：将 `controls-001.rpk` 纳入 iOS Simulator Bundle。

### 验收

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/controls-001/dist/controls-001.rpk`
- RPK SHA-256：`1e25a27daf59e5ae2f6b0bd046a7e9c4fe2876cfcd4dcebea2a2e26a7ed7f829`
- 真实 iOS Simulator Mount：`ios.ui.mount.result ... operations=56 mounted=1`。
- 真实 UIKit 截图：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-controls-001-home-final-2026-08-25.png`。
- UIKit 手动交互已观察到：Switch `ios.input.change surface=srf:1 node=node:7`；Input `ios.input.focus surface=srf:1 node=node:4`、`ios.input.input surface=srf:1 node=node:4`。
- Host probe 使用同一真实 RPK：`input`、`change`、`focus`、`switch` 均为 `queued=1`、`dispatched=1`；每次 teardown 均为 `surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0`。
- iOS 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4`，通过。

### 范围边界

`controls-001` Manifest 只声明 `pages/Home`，没有 Detail 页，也没有 `router.push/back` 场景。因此本 RPK 的 push/back 验收标记为不适用；未修改案例或伪造第二页面。多页返回继续由已有 Gallery/Commerce/Android/iOS 主链案例承担。

## Android B2 Slider + Picker（2026-08-25）

结论：Android 平台已使用真实 `controls-002.rpk` 完成 Slider/Picker 首屏、交互和 teardown；未修改 Core、JS、Toolkit、公共 Contract 或案例源码。

- RPK：`quickapp-examples/showcases/controls-002/dist/controls-002.rpk`
- SHA-256：`b738c890107d54f82ecf2c3f949c5df3688b6760e45d326b08f4c23de53d297a`
- Slider：Android `SeekBar`；`min/max/step/value` 经 MountTransaction 应用；真实拖动产生步进值并通过既有 Event Router 到 `onSlider`，payload 含 `value` 与 `isFromUser=true`。
- Picker：Android 原生 `AlertDialog`；支持文本选择、取消和确认；取消不发 `change`，确认“性能”产生 `selected=2,value=性能` 并执行 `onPicker`。
- 初始 Mount：`operations=58`、`ok=true`、`revision=0`；Surface `srf:1` Present 成功。
- teardown：`surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0 javaSurfaces=0 javaNodes=0`。
- Evidence：`quickapp-runtime-android/evidence/b2-slider-picker-android.md` 及对应截图、日志。
- `controls-002.rpk` 只有 `pages/Home`，没有 Detail 或导航 Handler；因此 push/back、重复页面进入对本案例为 `NOT_APPLICABLE`，路由基线继续使用 Gallery/Commerce 案例。

## iOS B2 Slider + Picker（2026-08-25）

结论：iOS 平台已完成 `controls-002.rpk` 的 Slider/Picker 映射、属性同步、UIKit 交互入口和 typed `change` 事件回传；未修改 Core、JS、Toolkit、公共 Contract 或 Examples。

### 实现

- `quickapp-runtime-ios/src/ios_gateway.mm`：
  - `Slider` 映射为 `UISlider`，支持 `min/max/step/value/enabled`；用户值按 step 量化并提交 `{ value, isFromUser: true }`。
  - `Picker(mode="text")` 映射为页面内 `UIButton`，点击后打开 iOS 原生 `UIPickerView` 面板；支持文本范围、当前索引、取消和确定。
  - Picker 取消只关闭临时平台面板，不发 `change`；确定提交 `{ selected, value }`，再经既有 `RuntimeSpine -> Core EventRouter -> JS Handler`。
  - 临时 Picker 面板不进入 Runtime Tree，不创建第二套路由或旁路事件通道；Surface/Node teardown 会清理面板引用。
- `quickapp-runtime-ios/src/runtime_spine.cpp`：iOS Runtime composition 声明 `Slider` 和 `Picker`，使真实 RPK 的 component preflight 与平台实现一致。
- `quickapp-runtime-ios/src/ios_spine_probe.cpp`：增加 `slider`、`picker` typed change probe。
- `quickapp-runtime-ios/CMakeLists.txt`：将 `controls-002.rpk` 纳入 iOS Simulator Bundle。

### 验收

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/controls-002/dist/controls-002.rpk`
- SHA-256：`b738c890107d54f82ecf2c3f949c5df3688b6760e45d326b08f4c23de53d297a`
- Bundle 内 RPK SHA-256 与源 RPK 一致。
- 真实 iOS Simulator 首屏截图：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-controls-002-home-2026-08-25.png`。
- 真实 iOS Simulator Picker 面板截图：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/evidence/screenshots/ios-controls-002-picker-open-2026-08-25.png`。
- Simulator Accessibility 验证：Slider 初始值 `40`，设置为 `55` 后真实 UIKit 控件值为 `55`；Picker 面板显示 `安静/标准/性能`，取消后面板关闭且页面值保持，确定入口产生 change。
- iOS host probe：
  - Slider：`ios.event.change.queued ... node=node:4 accepted=1`、`ios.event.change.dispatched ... accepted=1`、`ios.js.event.executed ... handler=hdl:1 accepted=1`。
  - Picker：`ios.event.change.queued ... node=node:7 accepted=1`、`ios.event.change.dispatched ... accepted=1`、`ios.js.event.executed ... handler=hdl:2 accepted=1`。
  - 两次 probe teardown 均为 `surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0`。
- Probe 日志：
  - `quickapp-runtime-ios/evidence/showcase-logs/ios-controls-002-slider-host-probe.log`
  - `quickapp-runtime-ios/evidence/showcase-logs/ios-controls-002-picker-host-probe.log`
- 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4` 和 `cmake --build build-host --target quickapp_ios_spine_probe -j 4`，通过。

### 范围边界

`controls-002` Manifest 只有 `pages/Home`，没有 Detail 页面或导航 Handler；因此本 RPK 的 push/back 与重复页面进入标记为 `NOT_APPLICABLE`，路由基线继续使用已有 Gallery/Commerce 多页案例。Slider/Picker 的事件 contract 已通过 host probe 验证，真实 UIKit 页面和 Picker 面板已通过 Simulator 截图验证。

## iOS B3 List + Scroll（2026-08-25）

结论：iOS 已完成真实 `list-001.rpk` 的 List/Scroll 平台实现。`UIScrollView` 承担真实滚动，`List` 是 UIKit 容器；Core Runtime Tree、keyed `for`、事件路由和生命周期保持唯一权威。`scroll`、`scrollend`、`scrolltop`、`scrollbottom` 均已通过 Host Probe 路由到 JS Handler，真实 Simulator 首屏已渲染四个 keyed-for 列表项。

- RPK：`quickapp-examples/showcases/list-001/dist/list-001.rpk`
- SHA-256：`f9087a6e1a9b0cc9c104a57586b6196636b8a2853d386ab68551fa2c0eb640c2`
- Bundle 内 RPK SHA-256 与源 RPK 一致。
- iOS 修改范围：`quickapp-runtime-ios/src/ios_gateway.mm`、`src/runtime_spine.cpp`、`src/ios_spine_probe.cpp`、`CMakeLists.txt`。
- `kScroll` 映射 `UIScrollView`，根据 Mount 子树 frame 计算 `contentSize`；滚动 payload 为 `scrollOffset`、`contentSize`、`viewportSize`。
- 顶部/底部只在边界状态变化时发送边界事件；拖动/减速结束发送 `scrollend`。
- 真实首屏截图：`quickapp-runtime-ios/evidence/screenshots/ios-list-001-home-2026-08-25.png`。
- Host Probe：`ios-list-001-scroll-host-probe.log`、`ios-list-001-scrollend-host-probe.log`、`ios-list-001-scrolltop-host-probe.log`、`ios-list-001-scrollbottom-host-probe.log` 均显示 queued/dispatched/JS executed；每次最终 `surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0`。
- 列表按钮点击真实执行 `router.push('/pages/Home')`，第二个 Surface Mount 成功；重复进入日志为 `ios-list-001-route-host-probe.log`、`ios-list-001-route-repeat-host-probe.log`。
- `list-001` 没有 Detail 页面和 `router.back()` handler，因此本案例的返回标记为 `NOT_APPLICABLE`；未创建平台私有 back。已有 Gallery/Commerce 案例承担真实多页 Detail push/back 验收。
- 本轮重建被共享 `quickapp-runtime-js/src/abi/runtime_abi_codec.cpp` 的已有指针调用编译错误阻断；该公共文件未修改，不能作为本平台 B3 代码错误归因。B3 代码在该共享错误出现前已完成编译。
- Evidence：`quickapp-runtime-ios/evidence/ios-list-001-b3.md`。

## iOS B4 Platform Feature Provider（2026-08-25）

结论：iOS 已接入 `prompt/fetch/file` 三个 typed Platform Provider，并使用真实 `platform-001.rpk` 验证 deterministic `completed`、`failed`、`cancelled`、无 Provider `unsupported` 和私有文件读取；Host probe 已验证同一真实 RPK 的 Runtime teardown 资源归零。未修改 Core、JS、Toolkit、公共 Contract 或 Examples Composition Root。

- RPK：`quickapp-examples/showcases/platform-001/dist/platform-001.rpk`
- SHA-256：`79ace8e7a28eeef67c31ae3cb519af7c7e3a85c8556c8ecb4811456f3a49035d`
- Bundle 内 RPK SHA-256 与源 RPK 一致。
- iOS 修改范围：`quickapp-runtime-ios/src/ios_gateway.mm`、`src/runtime_spine.cpp`、`src/ios_simulator_main.mm`、`include/quickapp/ios/runtime_spine.h`、`CMakeLists.txt`。
- `system.prompt`、`system.fetch`、`system.file` 由同一 iOS Platform Provider 实现；未创建第二个 Bridge 或平台业务状态。
- Fetch 只接受 `local://platform/status`、`local://platform/failure`、`local://platform/cancelled`；不访问公网。
- File 只使用内存私有 Provider；仅接受 `private/` 路径，拒绝路径穿越。
- 真实 iOS 日志：`quickapp-runtime-ios/evidence/showcase-logs/ios-platform-001-prompt-completed.log`、`prompt-cancelled.log`、`fetch-completed.log`、`fetch-failed.log`、`fetch-cancelled.log`、`file-completed.log`。
- 无 Provider：`ios-platform-001-no-provider.log` 配合 Host probe 的 `status=unsupported`；prompt、fetch、file 三次 Host probe teardown 后资源全为零，详见 iOS evidence。
- 真实首屏截图：`quickapp-runtime-ios/evidence/screenshots/ios-platform-001-home-2026-08-25.png`。
- RPK 资源和页面由既有 Runtime Loader、Core Runtime Tree、Lifecycle 和 ABI 处理；iOS Provider `close()` 清空内存文件和平台 Feature 视图，Host teardown 后页面对象与 JS/Core 资源归零。
- 当前冻结 Provider Contract 是同步 `invoke`，未新增异步接口；`cancelled` 通过 deterministic local Provider 输入验证，不伪造异步网络取消。
- 最新构建已通过：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4` 和 `cmake --build build-host --target quickapp_ios_spine_probe -j 4`。构建期间仅有已有的初始化和 iOS SDK 弃用警告，无 B4 编译错误；本轮未修改公共文件。
- Evidence：`quickapp-runtime-ios/evidence/ios-platform-001-b4.md`。

## B4 Public Features: Prompt + Fetch + File（2026-08-25）

### 结论

B4 的公共 Feature 合同已完成：JS Facade 通过封闭 typed ABI 发起 `FeatureRequest`，Core 只负责 `ModuleRegistry`、Provider 注册、RequestId/Surface 关联、生命周期和结果状态；网络、文件系统和原生弹窗仍由可替换 PlatformProvider 或确定性测试 Provider 实现。未修改 Host Component、Router、Render Pipeline、Event Router 或既有最终 RPK。

### 已实现

- Core `ModuleRegistry`：`system.prompt`、`system.fetch`、`system.file`；方法集合为 alert/confirm、fetch/cancel、read/write/exists/delete。
- Core 结果模型：`completed`、`failed`、`unsupported`、`cancelled`；Registry close 后返回 `CAPABILITY_CLOSED`，缺少 Provider 返回 `CAPABILITY_UNSUPPORTED`。
- JS ABI：`FeatureRequest` / `FeatureResult`、封闭 module/method 枚举、结构化 headers、RequestId 关联和 Feature callback slot。
- JS Facade：`system.prompt.alert/confirm`、`system.fetch.fetch/cancel`、`system.file.read/write/exists/delete`；异步结果由 Facade Promise 结算，失败和不支持不会伪造成功。
- Toolkit：允许并保留 `system.fetch`、`system.file` capability lowering；未声明或未知能力仍在模块图阶段失败。
- 确定性 Provider 测试：Prompt 结果、Fetch 本地响应/JSON/取消、File 私有内存目录和 teardown。
- 真实案例：`quickapp-examples/showcases/platform-001/`，仅使用联盟 DSL 和现有 Toolkit，不手写 Page IR、RenderTransaction 或 MountTransaction。

### 产物与验证

- RPK：`quickapp-examples/showcases/platform-001/dist/platform-001.rpk`
- 大小：`17171` bytes
- SHA-256：`79ace8e7a28eeef67c31ae3cb519af7c7e3a85c8556c8ecb4811456f3a49035d`
- 两次独立构建：metadata 与 RPK SHA-256 一致，`deterministicBuild=true`。
- Manifest capabilities：`system.router`、`system.prompt`、`system.fetch`、`system.file`。
- Entry：`/pages/Home`；页面：`pages/Home`；图片资源：`0`。
- Core：`ctest --test-dir quickapp-runtime-core/build-s04 --output-on-failure`，`18/18 passed`。
- Toolkit：`npm test`，`85 passed, 0 failed`。
- Contract Schema：`validate-schemas.mjs`，`22 schemas, 90 union branches` 通过。
- JS ABI：S01、S02、S03 和边界扫描通过；工作区既有 `js_s04_vm_lifecycle_tests` 仍在消息数量断言处失败（期望 5、实际 4），该问题在 B4 前已存在，本轮未修改其生命周期主链。

### 范围边界

B4 只完成公共合同、JS Facade、Toolkit capability lowering 和可替换 Provider 边界；未把真实网络、真实文件系统、Android/iOS/LVGL 平台 Feature 实现混入 Core。本 RPK 用于验证加载、声明和 typed request 形态，平台 Provider 接入另行进行。

## Android B3 List + Scroll（2026-08-25）

结论：Android 已完成 B3 的平台映射代码，但真实 APK 回归被共享 JS ABI 编译错误阻塞，不能把旧 APK 结果作为 B3 验收证据。

- RPK：`quickapp-examples/showcases/list-001/dist/list-001.rpk`
- SHA-256：`f9087a6e1a9b0cc9c104a57586b6196636b8a2853d386ab68551fa2c0eb640c2`
- `Scroll` 映射 Android `ScrollView`；`List` 映射 Android `FrameLayout`，列表项仍由 Core MountTransaction 管理。
- `scroll`、`scrollend`、`scrolltop`、`scrollbottom` 复用现有 Core EventType/EventRouter；payload 携带 `scrollOffset`、`contentSize`、`viewportSize`。
- ScrollView teardown 会解除监听并取消延迟 `scrollend` 回调；未创建平台私有列表状态、第二棵树或第二套路由。
- Android 资产同步和 RPK 选择入口已加入 `list-001.rpk`；源资产与生成资产 SHA 一致。
- 通过：`./gradlew :app:compileDebugJavaWithJavac`。
- 通过：Android `runtime_spine.cpp`、`jni_gateway.cpp`、`platform_adapter.cpp` 的单独 native 编译。
- 未通过：`./gradlew :app:assembleDebug`，失败在未修改的 `quickapp-runtime-js/src/abi/runtime_abi_codec.cpp`，包括 `FeatureRequest/FeatureResult` switch 和指针调用错误。
- 因此首屏、实际滚动、JS scroll 事件、点击、重复进入、返回和 teardown 的真实 Android 证据待共享 JS ABI 修复后补验。
- Evidence：`quickapp-runtime-android/evidence/b3-list-scroll-android.md`。

## Android B4 Platform Feature Provider（2026-08-25）

结论：Android 已完成 B4 Provider 的平台实现和 typed 状态矩阵验证；真实 `platform-001.rpk` 已完成加载、首屏、Prompt `completed` 端到端验证。File/Fetch Provider 逻辑已接入，但当前 RPK 的 File/Fetch 请求在冻结 JS ABI 入口因可选字段被拒绝，未到达 Android Provider；该阻塞不修改公共层处理。

- RPK：`quickapp-examples/showcases/platform-001/dist/platform-001.rpk`。
- SHA-256：`79ace8e7a28eeef67c31ae3cb519af7c7e3a85c8556c8ecb4811456f3a49035d`。
- Android Provider：`quickapp-runtime-android/include/quickapp/android/feature_provider.h`、`src/feature_provider.cpp`。
- Runtime 接入：Android Runtime Spine 注册现有 Core `ModuleRegistry` 的 Prompt/Fetch/File Provider；Surface `onDestroy` 调用 Provider teardown；未创建第二套路由、第二棵 Tree 或旁路 ABI。
- Prompt：`completed`；Fetch deterministic URL 覆盖 `completed/failed/cancelled/unsupported`；File 只允许 `private/` 内存 Provider；无 Provider/Registry close 由 Core 返回 `unsupported/failed`。
- Host 验收：`and_s01_contract_tests`、`and_b04_feature_provider_tests`，`2/2 passed`。
- Android 构建：`./gradlew :app:assembleDebug --no-daemon` 成功；APK 已安装到 `emulator-5554`。
- 真实日志：`quickapp-runtime-android/evidence/platform-001-android.log`；首屏截图：`quickapp-runtime-android/evidence/platform-001-android-home.png`。
- 真实日志确认 `feature.registry.created`、RPK verified、三条 Handler 绑定、首屏 Mount/Present、Prompt `android.feature.result ... status=completed`。
- 当前 File/Fetch 端到端阻塞：已安装 APK 中对应请求返回 `ABI_INVALID_ARGUMENT`，没有 Android `feature.result`；同一工作区的后续增量构建还被未修改的 `quickapp-runtime-core/src/page_ir.cpp:591` 语法错误阻塞。未修改 Core、JS、Toolkit、公共 Contract 或 Examples Composition Root。
- Evidence：`quickapp-runtime-android/evidence/b4-platform-feature-android.md`。

## B5 Public Video Contract + Toolkit Input（2026-08-25）

结论：公共 Video 合同和 Toolkit 输入已完成，真实 `media-001.rpk` 已生成并通过确定性构建。Core 只保存 Video Host Component、typed control contract、Mount 属性和事件语义；没有解码器、播放器、网络媒体线程或平台播放器实现。LVGL Profile 未声明 Video，Android/iOS/LVGL 现有实现未修改。

### 合同

- Host Component：`Video`，props 为 `src`、`poster`、`autoplay`、`controls`、`muted`。
- `src` 为非空媒体 URI，由 Platform Adapter 解释；Core 不下载、不解码。
- `poster` 为空或包内 `assets/` 路径。
- Core typed control：`VideoControlKind::{kPlay,kPause,kSeek}`，`seek` 使用有限非负秒数；结果为 `completed/failed/unsupported`。
- Video 事件：`prepared`、`start`、`pause`、`finish`、`error`、`timeupdate`；`timeupdate` 至少携带 `currentTime`，`error` 携带结构化错误分类。
- `play/pause/seek` 只是公共控制意图和结果合同，不代表 V1 已实现播放器。

### Toolkit 与 RPK

- DSL 支持 `<video src poster autoplay controls muted>` 及六个生命周期事件绑定。
- 未手写 Page IR、RenderTransaction、MountTransaction；Video 页面由现有 lowering/emitter/artifact builder 生成。
- RPK：`quickapp-examples/showcases/media-001/dist/media-001.rpk`
- 大小：`15695` bytes
- SHA-256：`439009523904f8335f96902e642e6d2150379dacdc28d3bceb690923ea0ba0df`
- 两次构建输出和 metadata 一致。
- 页面：`pages/Home`；能力：`system.router`；图片资源 1 个，`assets/images/media-poster.png`，32x32，1720 bytes。
- `src` 使用确定性示例 URI，不携带 mp4，避免在 Toolkit/Core 阶段伪造播放器或网络下载。

### 验证与边界

- Toolkit：`86 passed, 0 failed`，含 `TK-S14 media-001 lowers Video props and lifecycle handlers`。
- Core：`ctest --test-dir build-s04`，`18/18 passed`，含 Video Page IR、EventType 和 typed control contract。
- Contract JSON：host/page/event schema 可解析；Video 已加入 Host/Page/Event schema。
- LVGL Profile：未声明 Video；无 LVGL 播放器实现或公共平台代码修改。
- 未修改 Router、Bridge/Render/Event 三大系统架构、已有 RPK、Android、iOS 或 LVGL 源码。

## iOS B5 Video（2026-08-25）

结论：iOS 已使用 AVPlayer 完成真实 `media-001.rpk` 的首帧、prepared、播放、暂停、seek、失败和 teardown；复用现有 Core Runtime Tree、MountTransaction、Event Router 和 Lifecycle。`media-001` 只有 Home 页面且没有 `router.back()` Handler，因此返回场景对该 RPK 为 `NOT_APPLICABLE`，未添加平台私有返回逻辑。

- RPK：`quickapp-examples/showcases/media-001/dist/media-001.rpk`
- RPK SHA-256：`439009523904f8335f96902e642e6d2150379dacdc28d3bceb690923ea0ba0df`
- Bundle 内 RPK SHA-256：同上。
- Video 节点：`surface=srf:1 node=node:3`。
- iOS 映射：`AVPlayerViewController` 与 AVPlayer 原生控制层；未实现直播、倍速、截图、复杂全屏容器或自定义控制层。
- 资源策略：`example.invalid` 测试 URI 在 iOS Simulator 映射到 Bundle 内既有 deterministic `test_video_birds.mp4`，不访问公网、不修改 RPK。
- 生命周期：AVPlayerItem status 产生 `prepared/error`，timeControlStatus 产生 `start/pause`，周期观察产生 `timeupdate`，结束通知产生 `finish`；Node/Runtime teardown 移除 observer、time observer、结束通知和 player 引用。

### 真实验证

- 首帧与准备：`quickapp-runtime-ios/evidence/showcase-logs/ios-media-001-play-pause-seek.log`，包含 `rpk.verified`、Video Mount、`prepared`。
- 播放：同一日志包含 `action=play status=completed` 和 `start` 事件到达 JS Handler。
- 暂停：同一日志包含 `action=pause status=completed` 和 `pause` 事件到达 JS Handler。
- seek：同一日志包含 `action=seek position=1.000 status=completed`。
- 失败：`quickapp-runtime-ios/evidence/showcase-logs/ios-media-001-error.log`，包含 `VIDEO_SOURCE_REJECTED -> error -> JS Handler`，Mount 仍完成。
- teardown：`quickapp-runtime-ios/evidence/showcase-logs/ios-media-001-teardown.log`，Core 侧 `surfaces=0 nodes=0 handlers=0 jsResources=0 coreQueue=0`。
- 首屏截图：`quickapp-runtime-ios/evidence/screenshots/ios-media-001-home-2026-08-25.png`。
- 汇总证据：`quickapp-runtime-ios/evidence/ios-media-001-b5.md`。

### 构建与修改边界

- 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4` 通过。
- iOS 修改：`quickapp-runtime-ios/src/ios_gateway.mm`、`src/ios_simulator_main.mm`、`src/runtime_spine.cpp`、`include/quickapp/ios/ios_gateway.h`、`CMakeLists.txt` 及 iOS evidence。
- 未修改 Core、JS、Toolkit、公共 Contract、Examples、Android 或 LVGL。

## iOS B6 URL Provider（2026-08-25）

结论：B6 iOS 平台实现尚未启动，当前被公共前置输入阻塞，不能伪造 external 或 webview 验收。

- 已验证工作区不存在 `quickapp-examples/showcases/url-001/dist/url-001.rpk`，iOS Bundle 也没有该 RPK。
- 当前冻结 JS ABI 的 FeatureModule 只有 `Prompt`、`Fetch`、`File`；FeatureMethod 没有 `openUrl` 或 `webview`。
- 当前 Core ModuleRegistry 没有 URL Provider 模块，iOS RuntimeSpine 不能在不增加旁路的情况下接收这两类请求。
- 因此本轮未修改 iOS 运行时代码，未调起系统浏览器，未打开 WKWebView，未验证失败、关闭或 teardown。
- 正确顺序：公共实现先完成 typed Contract、JS ABI、Toolkit lowering、manifest capability 和真实 `url-001.rpk`；随后 iOS 仅实现 `UIApplication` external 与 `WKWebView` Provider。
- 禁止：iOS 侧写死 URL、页面私有处理、扩展字符串探测入口、把外部 URL 伪装为 Core Router 或创建内嵌 Host Component。
- Evidence：`quickapp-runtime-ios/evidence/ios-url-001-b6.md`。

## iOS B3.5 Tabs（2026-08-25）

结论：iOS `Tabs -> UISegmentedControl` 平台映射已完成并通过构建，但真实 `tabs-001.rpk` 验收被公共 JS 初始绑定阶段阻塞，不能报告平台功能完成。

- RPK：`quickapp-examples/showcases/tabs-001/dist/tabs-001.rpk`
- SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`
- iOS 已实现 `items`、受控 `selected`、用户切换 `change({index,value})`、既有 Event Router 回传和 teardown 清理；未修改 Core、Toolkit、公共 Contract 或 Examples。
- 构建：`cmake --build build-ios-ninja --target quickapp_ios_simulator -j 4` 通过。
- 真实启动日志：`rpk.verified -> page.start.completed -> page.vm.failed`，尚未进入 Mount。
- 根因：公共 `AlphaInitialBindingStage` 仍只接受 `string/boolean` 初始绑定结果，而 Tabs 的 `selected` 是 `number`；因此页面 VM 在初始绑定阶段失败。iOS 不绕过或转换该公共类型。
- 对照：同一构建加载 `media-001.rpk` 可正常完成 `page.vm.ready` 和 Mount。
- 状态：`BLOCKED_BY_JS_NUMERIC_INITIAL_BINDING`；公共 JS 放行后重新执行真实 Tabs 验收。
- Evidence：`quickapp-runtime-ios/evidence/ios-tabs-001-b35.md`。

## Android B5 Video Platform Implementation（2026-08-25）

结论：Android 已使用平台 `VideoView`/`MediaController` 完成真实
`media-001.rpk` 的加载、Video 挂载、poster 首屏和媒体错误事件回调。
无效媒体地址按预期经过 `Android MediaPlayer -> Android Adapter -> Core Event
Router -> JS onError`，进程未崩溃。未实现直播、倍速、截图、复杂全屏容器或自定义控制层。

- RPK：`quickapp-examples/showcases/media-001/dist/media-001.rpk`
- RPK SHA-256：`439009523904f8335f96902e642e6d2150379dacdc28d3bceb690923ea0ba0df`
- Android 修改：`quickapp-runtime-android/app/src/main/java/dev/quickapp/kit/android/RuntimeSurfaceHost.java`、`RuntimeBridge.java`、`MainActivity.java`、`app/build.gradle.kts`、`app/src/main/AndroidManifest.xml`。
- 真实日志：`quickapp-runtime-android/evidence/media-001-android.log`。
- 首屏截图：`quickapp-runtime-android/evidence/media-001-android-final.png`。
- Teardown 日志：`quickapp-runtime-android/evidence/media-001-android-teardown.log`；Android `RuntimeBridge.destroy()` 增加平台 View/VideoView 同步关闭兜底，避免 Activity 结束时残留播放器资源。返回键后模拟器回到 Launcher 且无 Android 崩溃；由于进程随 Activity 结束，异步 Native stop 回调不作为本条资源证据。
- 关键结果：`rpk.verified`、`android.platform.mount.result ... ok=true`、`android.video.error`、`android.event.error.received`、`android.event.error.dispatched=1`、JS Handler 执行，且无 `AndroidRuntime` 崩溃。
- `media-001` 只有 Home 页面且无路由 Handler，返回验证对该 RPK 为 `NOT_APPLICABLE`。
- 未修改 Core、JS、Toolkit、公共 Contract、Examples 或 LVGL；Android 未创建第二棵 Tree、第二套路由或平台旁路业务状态。
- 完整证据：`quickapp-runtime-android/evidence/b5-video-android.md`。

## Android B6 URL Provider 阻塞汇报（2026-08-25）

状态：`BLOCKED_BY_PUBLIC_CONTRACT`。

Android B6 尚未编码。当前仓库不存在真实 `url-001.rpk`；Core `ModuleId` 和
JS `FeatureModule/FeatureMethod` 也只有 `prompt/fetch/file`，没有
`system.openUrl` 或 `system.webview` typed request。Android 侧没有合法的
Provider 输入，若自行新增协议会形成旁路 ABI，违反公共架构边界。

架构侧下一步必须先交付：

1. `system.openUrl` / `system.webview` 的冻结 typed Contract 和 JS ABI；
2. 真实 `url-001.rpk` 及 SHA-256；
3. external/webview 的成功、失败、关闭和 teardown 语义。

前置产物完成后，Android 只实现 `Intent.ACTION_VIEW` 和平台 WebView 页面，
不进入 Core Router，不创建内嵌 WebView Host Component，不修改 Core Tree。
详细阻塞证据：`quickapp-runtime-android/evidence/b6-url-android.md`。

## Android B3.5 Tabs 平台交接（2026-08-25）

状态：`ANDROID_IMPLEMENTED_JS_STARTUP_BLOCKED`。

Android 已完成 Tabs 平台映射：`Tabs` Host 映射为平台 `LinearLayout`，
`items` 生成平台 tab label，`selected` 复用 MountTransaction 受控更新，
用户切换通过既有 EventSink 发送 `change({index, value})`；节点移除和
Surface teardown 清理平台子控件与监听器。未创建第二棵 Tree、平台业务状态或旁路事件通道。

- 真实 RPK：`quickapp-examples/showcases/tabs-001/dist/tabs-001.rpk`
- SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`
- Android APK：`./gradlew :app:assembleDebug --no-daemon` 已通过。
- 运行已到 `rpk.verified` 和 `initial.command.js`，随后在 JS Framework 初始绑定阶段失败：`Initial binding result must be string or boolean`。
- 根因：Tabs 合同要求 `selected` 为 number binding，而当前共享 JS 初始绑定实现仍拒绝 number；失败发生在 Android 收到 MountTransaction 之前，不能由 Android 绕过。
- 详细证据：`quickapp-runtime-android/evidence/b3.5-tabs-android.md`。

架构侧需要先修复 JS Framework 初始 binding 对冻结 `string | boolean | number`
合同的支持，然后用同一 RPK 重跑首屏、切换、回写、重复切换和 teardown；Android 不修改
Core、JS、Toolkit、公共 Contract 或 Examples。

## Android B3.5 Tabs 复验交接（2026-08-26）

本节 supersedes 上面的初始启动阻塞结论。

结论：Android Tabs 平台映射、真实 RPK 首屏和平台事件链路已通过；完整的受控状态
回写仍被共享 JS ABI 阻塞，不能标记 B3.5 Android 完成。

- RPK：`quickapp-examples/showcases/tabs-001/dist/tabs-001.rpk`
- SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`
- 首屏：`page.vm.ready`、`handler_bind onTabChange bound=1`、`mount.result ok=true`。
- 真实点击：`任务 -> 我的 -> 我的（重复） -> 首页`；日志证明
  `input.tabs.change -> event.change.received -> event.change.dispatched=1 ->
  handler_execute dispatched=1`。
- 平台 tab 选中样式发生变化，但绑定文本和 `if` 内容仍是首页，事件后没有新的
  MountTransaction。
- 根因：`quickapp-runtime-js/src/abi/runtime_abi_codec.cpp` 的 `updateBinding`
  校验仍只接受 `string | boolean`，拒绝 Tabs `selected` 所需的 numeric binding。
  该问题属于公共 JS/ABI，Android 不得用本地状态绕过。
- Android evidence：`quickapp-runtime-android/evidence/b3.5-tabs-android.md`。
- 截图：`tabs-001-android-task.png`、`tabs-001-android-mine.png`、
  `tabs-001-android-home-final.png`。

下一步：公共 JS/ABI 接受 numeric `updateBinding` 后，用同一 RPK 重跑受控更新、重复
切换和 teardown；在此之前 B3.5 只算平台实现完成，不算完整验收完成。

## iOS B3.5 Tabs 复验交接（2026-08-26）

结论：iOS `Tabs -> UISegmentedControl` 平台实现、真实 RPK 首屏、真实 UIKit
交互、重复切换和 teardown 已通过；完整的 `selected` 受控状态回写仍被共享 JS
ABI 阻塞，不能标记 B3.5 iOS 全部完成。

- RPK：`quickapp-examples/showcases/tabs-001/dist/tabs-001.rpk`
- SHA-256：`9a53e285d8d4cf13080b782f64762b6ab44596ad3c3ab68ace08a19340108792`
- 首屏：`rpk.verified -> page.vm.ready -> ios.ui.mount.result ... mounted=1`。
- 平台控件：真实 `UISegmentedControl`，首屏 `items=3`、`selected=0`，布局为
  `<63.0,102.0,276.0,48.0>`。
- 真实平台操作：`index=1 -> index=1（重复） -> index=2`；每次均为
  `ios.tabs.control ... status=completed -> ios.event.change.dispatched ... accepted=1 -> ios.js.event.executed ... accepted=1`。
- 平台视觉：修复选中态文字颜色后，第三个标签“我的”可见；截图为
  `quickapp-runtime-ios/evidence/screenshots/ios-tabs-001-selected-2026-08-26.png`。
- Teardown：`surfaces=0 nodes=0 handlers=0 jsResources=0 coreQueue=0`，随后
  `ios.runtime.platform.resources surfaces=0 nodes=0`。
- 阻塞：事件已执行到 JS Handler，但没有后续 `ios.render.submit`；共享
  `quickapp-runtime-js/src/abi/runtime_abi_codec.cpp` 的 `updateBinding` 仍拒绝
  numeric value。iOS 不修改共享 JS 或用平台状态绕过。
- Evidence：`quickapp-runtime-ios/evidence/ios-tabs-001-b35-2026-08-26.md`。

状态：`IOS_PLATFORM_IMPLEMENTED_SHARED_JS_NUMERIC_UPDATE_BLOCKED`。公共 JS ABI
接受 numeric `updateBinding` 后，三端使用同一 RPK 重跑完整受控更新验收。
