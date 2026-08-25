# iOS Runtime Spec Agent Handoff

> 状态：IOS-S01 `VERIFIED`；IOS-S02 `HOLD_M3`。

## 目录

- [目标](#目标)
- [交接记录](#交接记录)

## 目标

代码目录：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-ios/`

只读：v3 公共 Spec、公共 launch profile、Cases 和 upstream；可写：本项目 `AGENT-HANDOFF.md`；项目总 Spec gate 通过后可写本项目 `spec/subspecs/<name>/`；对应分 Spec 通过后才可写上述代码目录。

平台总 Spec 必读：`../../../spec/requirements.md`、`../../../spec/design.md`、`../../../spec/tasks.md`、`../../../spec/acceptance.md`。

启动阅读：本文件、`./README.md`、`../../../README.md`、`../../../AGENT-WORK-BOARD.md`、`../../../spec/v1-scope-and-acceptance.md`、`../../../spec/contracts/runtime-launch-profile.md`、`../../../spec/contracts/application-lifecycle-contract.md`、`../../../spec/contracts/lifecycle-and-threading.md`、`../../../spec/contracts/navigation-contract.md`、`../../../spec/contracts/platform-surface-contract.md`、`../../../spec/contracts/measure-adapter-contract.md`、`../../../spec/contracts/event-contract.md`、`../../../spec/contracts/runtime-composition-contract.md`、`../../../spec/contracts/observation-contract.md`、`../../../spec/contracts/schemas/runtime-composition.schema.json`、`../../../spec/contracts/schemas/README.md`。

当前总 Spec 只交付：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。

目标：定义 iOS Runtime Host、PackageSource、UIKit Platform Surface/Host Adapter、prompt/device PlatformProvider、字体 Measure Adapter、页面生命周期、输入转换和主线程提交；复用共享 Core 和 JS Runtime。

必须遵守：UIKit 类型不得进入 Core；平台输入转换为 `PlatformInputMessage`；公共协议沿用 v3 Core Contract。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 历史事件：建立 iOS Runtime 项目入口；当时尚未启动项目总 Spec。
- 意图：先完成平台边界和生命周期设计，具体实现可晚于 Android/LVGL。
- 历史门禁：现已解除；当前以最新总 Spec 门禁为准。

### 2026-08-15 / 总架构 Agent / 六审修订（签名部分已被需求回归校准取代）

- Runtime Host 提供包外 PackageOpenPolicy；UIKit Adapter 不参与签名判断。
- Root/Push Present 必须遵循公共原子可见状态转换。

### 2026-08-15 / 总架构 Agent / 需求回归校准

- iOS 总 Spec 可并行设计，实现排在 Android/LVGL 闭环之后。
- 新增：实现 `system.prompt/system.device` PlatformProvider 与不依赖 UIKit View Tree 的字体 Measure Adapter。
- 校正：PackageOpenPolicy/签名后置；App/Page Hook 使用公共状态机，不直接等同 UIKit Controller 生命周期。
- 历史门禁：该阶段已完成；当前以最新校审门禁为准。

### 2026-08-15 / 总架构 Agent / 项目总 Spec 初稿

- 已完成：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。
- 核心边界：iOS 只实现 typed Gateway 与 UIKit Adapter；Core Navigation 和生命周期保持权威。
- 下一步：独立校审主线程、跨语言 ownership、Surface/Mount、Measure、Provider 和资源回收。
- 门禁：校审通过前不得编写分 Spec，不得初始化产品代码。

### 2026-08-16 / 总架构 Agent / 首轮项目总 Spec 校审修订

- Host 必须消费 typed `RuntimeLifecycleControl` 和 launch profile；root `presented` 是启动成功唯一判据。
- Surface 增加原子 close/reveal；Measure 精确实现 request、measured/failed result 与字体 generation。
- Objective-C++ Gateway 仍只做 typed 转换与主线程投递，不拥有 Core Navigation 或 Hook 状态机。
- 当前门禁：iOS `DESIGN_ALLOWED`；实现优先级晚于 Android/LVGL，产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / V1 范围校准

- `[已冻结]`：iOS 保留在 V1 最终交付，复用同一 RPK/Core/JS；实现顺序晚于 LVGL/SDL 和 Android。
- UIKit 只实现平台端口，不反向改变共享合同。

### 2026-08-16 / 总架构 Agent / 平台总 Spec 修正同步

- `[已冻结]`：`CAP-DEVICE-001` 独立验证 device，不修改 Case 001；iOS 必须消费同一 fixture。
- Observation Contract/Schema 由总架构维护；iOS 只按合同产出 marker，缺口通过 Handoff 提议。
- 当前只允许设计分 Spec；产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / 第二次复核修正

- `CAP-DEVICE-001` 补充独立 iOS success/failure/cleanup 验收；Case 001 保持不含 device。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 定向复核 PASS

- 平台总 Spec 定向复核结果：P0/P1/P2 为 0。
- 当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`；启动 IOS-S01 分 Spec 设计，禁止产品编码。

### 2026-08-16 / 总架构 Agent / P0-CUT-001 同步

- 新增：IOS-S01 拥有 iOS Composition Root 和 Runtime Composition Manifest；Core/JS 不得出现 iOS/UIKit 组成分支。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待可裁剪组成定向校审。

### 2026-08-16 / 总架构 Agent / JS Engine 边界校准

- IOS-S01 Composition Root 必须且只能选择一个 JS Engine Provider，并把 identity 写入 Runtime Composition Manifest；V1 默认 QuickJS。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`。

### 2026-08-16 / 总架构 Agent / 第四次复核修正

- IOS-S01 生成的 Manifest 与 link map/symbol inventory 必须共同证明：一次 `runtime.js-framework`、一个选定 Engine。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 第五次定向复核 PASS

- P0/P1/P2 均为 0；当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`。
- 允许设计 IOS-S01；禁止产品编码。

### 2026-08-16 / 总架构 Agent / 最小可观测合同

- IOS-S01 只选择 Noop/iOS TraceSink；IOS-S09 实现平台 Collector，存储、导出与分析不进入 Core。
- 当前授权不变：`DESIGN_ALLOWED + CODE_BLOCKED`。

### 2026-08-16 / iOS Runtime Agent / IOS-S01 分 Spec 启动

- 状态：`IN_PROGRESS`
- 已完成：确认 IOS-S01 门禁、写入边界和必读合同。
- 新增事实：无。
- 本项目设计决定：无；设计将严格消费冻结公共合同。
- 待验证项：PackageSource bytes 所有权、启动与销毁时序、组成失败及 Noop/Recording 观测的 Fake Core 验收闭环。
- 阻塞项：无。
- 下一步：编写 IOS-S01 五份分 Spec 并执行链接、需求覆盖和边界自检。
- 公共合同影响：无。

### 2026-08-16 / iOS Runtime Agent / IOS-S01 分 Spec 完成

- 状态：`READY_FOR_REVIEW`
- 已完成：创建 `subspecs/ios-s01-runtime-host-package-source/` 下 `README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`。
- 新增事实：无；全部设计均消费已冻结公共合同。
- 本项目设计决定：Composition Root、Runtime Host、PackageSource 三责分离；Host 使用 unpublished Session 保证启动原子性；Scene 通过 desired/committed state 和单在途 request 串行映射为公共 `RuntimeLifecycleControl`；PackageSource completion 只回 Core queue，bytes 使用转移或共享只读所有权。
- 待验证项：编码阶段用真实 Core/JS Port 名称替换 Fake 接口；以实际 iOS link map/symbol inventory 证明单 Engine 和一次 JS Framework；用 sanitizer 验证 close/read 与 destroy/late signal 竞态。
- 阻塞项：无。
- 下一步：提交 IOS-S01 独立校审；校审通过且工作看板显式 `CODE_ALLOWED` 后才实现。
- 公共合同影响：无。
- 自检：IOS-S01-R01..R12 均有验收映射；13 个文档链接有效；Git whitespace 检查通过。

### 2026-08-16 / 总架构 Agent / [已冻结] P0-EVENT-002

- 状态：READY_FOR_REVIEW
- 已完成：公共事件合同要求每次 Platform 输入生成一个不复用的 `RequestId`。
- 新增事实：IOS-S05 是 iOS 输入 `RequestId` 的 producer，Gateway/Core 只原样传递。
- 本项目设计决定：iOS 不按 target/action 对象或时间戳替代输入关联。
- 待验证项：IOS-S05 覆盖连续点击唯一性、同 AppRuntime 不复用和销毁后输入拒绝。
- 阻塞项：无；不改变 IOS-S01 当前边界。
- 下一步：IOS-S05 启动时读取最新 Event Message Schema。
- 公共合同影响：已冻结，无需项目 Agent 修改公共文件。

### 2026-08-16 / iOS Runtime Agent / IOS-S01 首批校审修订

- 状态：`READY_FOR_REVIEW`
- 已完成：按 `S1-IOS-001` 与 `S2-IOS-002` 修订 IOS-S01 五份文档；产品代码未改动。
- 新增事实：无；重新对齐 Application Lifecycle 与 Runtime Composition Contract。
- 本项目设计决定：raw Scene signal 仅可在生成 RequestId 前去重；accepted `RuntimeLifecycleControl` 必须逐条进入 Core 并返回同 RequestId/action 的唯一 typed Result，`LIFECYCLE_BUSY` 原样透传。上一版“Host 单在途 request/desired state 收敛”描述由本记录明确取代。观测矩阵固定为：`v1 -> baseline|diagnostic + Recording`；`custom/off -> Noop`；`custom/baseline|diagnostic -> Recording`；`v1/off` 拒绝。
- 待验证项：定向复核确认 accepted control 关联语义与观测矩阵已无歧义。
- 阻塞项：无文档阻塞；产品代码继续 `CODE_BLOCKED`。
- 下一步：停止修改，等待 IOS-S01 定向复核。
- 公共合同影响：无。

### 2026-08-16 / iOS Runtime Agent / IOS-S01 实现启动

- 状态：`IN_PROGRESS`
- 已完成：确认工作看板与第二批结果已将 IOS-S01 设置为 `PASS + CODE_ALLOWED`；重新读取五份已通过分 Spec。
- 新增事实：现有 iOS 目录只有默认 SwiftUI 工程，IOS-S01 Foundation 尚未实现。
- 本项目设计决定：在 `quickapp-runtime-ios` 根建立纯 Foundation/Dispatch Swift Package，保持现有 App 不变；IOS-S02 及后续 UIKit/Gateway 职责不进入本轮。
- 待验证项：Swift Package 普通、ASan、TSan 构建测试及资源归零证据。
- 阻塞项：无。
- 下一步：严格按 IOS-S01 T01-T12 实现并验证。
- 公共合同影响：无。

### 2026-08-16 / 总架构 Agent / IOS-S01 定向复核 PASS

- 状态：`PASS + CODE_ALLOWED`。
- 已完成：S1-IOS-001 与 S2-IOS-002 已关闭；raw Scene 去重、accepted control、LIFECYCLE_BUSY、RequestId/action 和 Observation 矩阵均闭环。
- 阻塞项：无；IOS-S02 仍不得提前实现。
- 下一步：严格按 IOS-S01 tasks 实现并提交证据。
- 公共合同影响：无。

### 2026-08-16 / iOS Runtime Agent / IOS-S01 实现完成

- 状态：`READY_FOR_REVIEW`；本项是并行 Foundation 基础准备，不代表 iOS 平台实施提前。
- 已完成：在 `quickapp-runtime-ios` 根实现纯 Foundation/Dispatch Swift Package，覆盖 RuntimeLaunchProfile/Composition Manifest 前置严格预检、单 Engine 与 TraceSink/Clock/PlatformPortSet 依赖选择、冻结观测矩阵、Memory/File/Bundle PackageSource、Root `presented` 启动边界、raw Scene admission、accepted RuntimeLifecycleControl 关联和确定销毁；IOS-S02 未启动。
- 新增事实：File PackageSource 在创建时固定打开的文件身份，路径后续被替换不会改变已创建 Source 的读取对象；关闭后拒绝新读取，已接受读取仍在 Core queue 完成。
- 本项目设计决定：raw Scene signal 仅在 RequestId 生成前去重；每条 accepted control 均进入 Core，以同 RequestId/action 唯一完成，`LIFECYCLE_BUSY` 原样透传。观测矩阵保持 `v1 baseline|diagnostic -> Recording`、`custom off -> Noop`、`custom baseline|diagnostic -> Recording`、`v1/off` 拒绝。
- 验证证据：Debug、ASan、TSan 各 19/19 测试通过；Release 构建、`arm64-apple-ios15.0-simulator` 编译、Swift format lint 和 IOS-S01 职责边界扫描通过；三类 PackageSource 共用同一随机读取合同，并覆盖固定文件身份、短读及 Host 所有资源归零；详见 `quickapp-runtime-ios/evidence/ios-s01-implementation.md`。
- 待验证项：真实 App/native target 的 link map 与 symbol inventory 需在 IOS-S08/IOS-S09 集成共享 Core、JS Framework 和选定 Engine 后生成；本轮已实现 Manifest 与注入 BuildInventory 的严格一致性校验，不伪造尚不存在的产品链接证据。
- 阻塞项：IOS-S01 无；IOS-S02 及 UIKit Surface/Mount/Input 全部等待 M3，M2 Android 完成前不得启动。
- 下一步：只对 IOS-S01 Foundation 实现做定向校验；停止扩展，不启动 IOS-S02。
- 公共合同影响：无。

### 2026-08-17 / 总架构 Agent / IOS-S01 实现复核 PASS

- 状态：`VERIFIED + HOLD_M3`。
- 已完成：验证脚本通过；Debug、ASan、TSan 各 19/19，Release、iOS Simulator 编译、格式和边界扫描通过。
- 边界：该结果只证明 UIKit-free Foundation，不代表 iOS 平台 Runtime 已实施；真实产品链接证据仍由 IOS-S08/IOS-S09 收口。
- 下一步：停止扩展；M2 Android 完成前不得启动 IOS-S02。
- 公共合同影响：无。

### 2026-08-23 / iOS Code Agent / IOS-A1 最小端到端实现

- 状态：`IMPLEMENTED + HOST_VERIFIED + SIMULATOR_BUILD_VERIFIED + UI_RUNTIME_BLOCKED`；不能标记 `IOS-A1 VERIFIED`。
- 已完成：iOS Runtime Spine、UIKit Gateway、UIKit Surface/Mount Adapter、Simulator App target 和 macOS Host probe；使用真实 `tk-s07-case001.rpk` 复用共享 QuickJS/JS Framework、C++ Core 和 RPK Loader。
- 已验证事实：Host probe 输出 `first surfaces=1 nodes=3 handlers=1 jsResources=3`；点击后 `surfaces=2 nodes=8 handlers=2 jsResources=5`；teardown 后 `surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0`。iOS Simulator `arm64` target 构建成功，Bundle 内 RPK SHA 为 `32e012e2235c7ffa36143d9619c90264bbbab5ae0d083e12a13092859990b493`；Swift Foundation 回归 19/19 通过。
- 关键实现修正：JS-owned services 使用 `JsEngineService::stop` 的 owner-thread teardown barrier 释放；不把普通 queued task 当作停止清理任务，避免 Quiescing 后任务取消导致 VM 析构异常。
- 合理推断：Objective-C++ Gateway 的 UIKit 主线程边界和 typed 回 Core 路径已完成编译接入；Host probe 证明共享 Core/JS/RPK 链路，尚未证明真实 UIKit 运行。
- 待验证项：本机 `CoreSimulatorService` 当前 `Connection refused`，因此真实安装、首屏截图、UIKit Button 点击、Detail 页面、Scene 关闭迟到输入、Simulator Sanitizer 和正式 App link map 尚未完成。
- 失败和降级：RPK/Surface/Mount 失败不发布半存活 Runtime；teardown 期间输入被拒绝；CoreSimulator 不可用时仅保留 Host probe 和 Simulator build 证据，不把编译当作 UI 运行证据。
- 公共 Contract 是否变化：无。未修改 Core、JS Runtime、Toolkit、Android、LVGL 或公共 Contract。
- 证据：`quickapp-runtime-ios/evidence/ios-spine-a1-implementation.md`。
- 下一步：修复或恢复 CoreSimulatorService 后运行 Bundle，补齐真实 UIKit 证据；总架构复核前停止 IOS-S02 及外围扩展。

### 2026-08-23 / iOS Code Agent / IOS-A1 真实 UI 复核

- 状态：`UI_VERIFIED + TEARDOWN_PENDING`。
- 已验证事实：iPhone 17 Pro / iOS 26.5 Simulator 已安装并启动 Bundle；真实 UIKit 首屏显示 RPK 内容；真实 Button 点击日志为 `ios.input.click surface=srf:1 node=node:3`；点击后 Detail Surface 截图已保存到 `quickapp-runtime-ios/evidence/screenshots/ios-a1-detail.png`。
- 已修复：iOS Gateway 支持基线所需 `textAlign`、`borderRadius`；Button Action 按值捕获 SurfaceId/NodeId，修复点击后 NodeId 失效导致 Handler 无法匹配的问题。
- 合理推断：真实点击已通过 UIKit -> typed Gateway -> JS Handler -> Core Navigation；Detail 页面截图与 Host probe 的第二 Surface 结果一致。
- 待验证项：`simctl terminate` 未触发当前 AppDelegate 的 `applicationWillTerminate`，所以真实 iOS teardown 资源归零尚未证明；Simulator 运行期 Sanitizer 和正式 link map 仍待补齐。
- 公共 Contract 是否变化：无。未修改 Core、JS Runtime、Toolkit、Android、LVGL 或公共 Contract。
- 下一步：只补齐 teardown/运行期 Sanitizer/link map，然后进行总架构复核；停止 IOS-S02 及外围扩展。
