# Android Runtime Spec Agent Handoff

> 状态：AND-S01 `VERIFIED`；AND-S02 `HOLD_M2`。

## 目录

- [目标](#目标)
- [交接记录](#交接记录)

## 目标

代码目录：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/`

只读：v3 公共 Spec、公共 launch profile、Cases 和 upstream；可写：本项目 `AGENT-HANDOFF.md`；项目总 Spec gate 通过后可写本项目 `spec/subspecs/<name>/`；对应分 Spec 通过后才可写上述代码目录。

平台总 Spec 必读：`../../../spec/requirements.md`、`../../../spec/design.md`、`../../../spec/tasks.md`、`../../../spec/acceptance.md`。

启动阅读：本文件、`./README.md`、`../../../README.md`、`../../../AGENT-WORK-BOARD.md`、`../../../spec/v1-scope-and-acceptance.md`、`../../../spec/contracts/runtime-launch-profile.md`、`../../../spec/contracts/application-lifecycle-contract.md`、`../../../spec/contracts/lifecycle-and-threading.md`、`../../../spec/contracts/navigation-contract.md`、`../../../spec/contracts/platform-surface-contract.md`、`../../../spec/contracts/measure-adapter-contract.md`、`../../../spec/contracts/event-contract.md`、`../../../spec/contracts/runtime-composition-contract.md`、`../../../spec/contracts/observation-contract.md`、`../../../spec/contracts/schemas/runtime-composition.schema.json`、`../../../spec/contracts/schemas/README.md`。

当前总 Spec 只交付：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。

目标：建立联盟 Android Runtime 的行为基线，设计 Android Runtime Host、JNI Adapter、PackageSource、Platform Surface Host、Host Component、prompt/device PlatformProvider、字体 Measure Adapter、输入和首屏/更新/事件集成；RPK Loader、Core 和 JS Executor 使用共享工程。

JNI 只属于 Android Platform Adapter；不得把 Android 类型带入 Core，也不得自行改变 Runtime Artifact、Platform Surface、Mount 或其他公共协议。

## 交接记录

### 2026-08-15 / 总架构 Agent

- 历史事件：建立 Android Runtime 项目入口；当时尚未启动项目总 Spec。
- 意图：Android 提供联盟行为基线，不作为 Core 的平台实现模板。
- 历史门禁：现已解除；当前以最新总 Spec 门禁为准。

### 2026-08-15 / 总架构 Agent / 六审修订（签名部分已被需求回归校准取代）

- Runtime Host 必须从包外可信配置构造 PackageOpenPolicy，不读取包内字段决定是否允许无签名。
- Root full Mount 完成后仍保持隐藏；只有 `PresentSurfaceHost(root)` 成功才算首屏成功。

### 2026-08-15 / 总架构 Agent / 需求回归校准

- 该阶段采用旧平台顺序，已被下方“平台实施顺序调整”取代；共享 Core/JS 不得写入 Android 工程的边界继续有效。
- 新增：实现 `system.prompt/system.device` PlatformProvider Factory；JNI 只承载 typed message。
- 新增：提供可在 Core Runtime Thread 调用、且不访问 View Tree 的字体 Measure Adapter。
- 校正：PackageOpenPolicy/签名不进入 V1 主线；按公共 App/Page Hook 时序校准联盟行为。
- 历史门禁：该阶段已完成；当前以最新校审门禁为准。

### 2026-08-15 / 总架构 Agent / 项目总 Spec 初稿

- 已完成：`requirements.md`、`architecture.md`、`subspec-index.md`、`acceptance.md`。
- 核心边界：JNI 只做 typed message 与线程桥接，不拥有共享 Runtime 逻辑；该阶段的平台先后顺序已被最新冻结事件取代。
- 下一步：独立校审 JNI/UI Thread、Surface/Mount、Measure、Provider、资源销毁和 Case 001/002。
- 门禁：校审通过前不得编写分 Spec，不得初始化产品代码。

### 2026-08-16 / 总架构 Agent / 首轮项目总 Spec 校审修订

- Host 必须消费 typed `RuntimeLifecycleControl` 和 launch profile；root `presented` 是启动成功唯一判据。
- Surface 增加原子 close/reveal；Measure 精确实现 request、measured/failed result 与字体 generation。
- JNI 仍只做 typed 数据与线程桥接，不新增私有模块、生命周期、导航或测量协议。
- 当前门禁：Android `DESIGN_ALLOWED`；产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / V1 范围校准

- `[已冻结]`：Android 只实现 Runtime Host、JNI、Surface/Mount/Input/Measure 和 Case 能力；该阶段的平台先后顺序已被最新冻结事件取代。
- 不承载共享 Core/JS，不等待签名、完整权限或完整 Benchmark。

### 2026-08-16 / 总架构 Agent / 平台实施顺序调整

- `[已冻结]`：Android 是第二个平台闭环，复用 LVGL/SDL 首闭环使用的同一 Runtime RPK、Core 和 JS Runtime。
- 联盟 Android 源码从第一天作为行为语义参考；Android 实现负责验证联盟兼容与 Core 无 LVGL 耦合。
- 公共合同和项目总 Spec 边界不变；当前状态仍为 `DESIGN_ALLOWED`。

### 2026-08-16 / 总架构 Agent / 平台总 Spec 修正同步

- `[已冻结]`：`CAP-DEVICE-001` 独立验证 device，不修改 Case 001；Android 必须消费同一 fixture。
- Observation Contract/Schema 由总架构维护；Android 只按合同产出 marker，缺口通过 Handoff 提议。
- 当前只允许设计分 Spec；产品代码等待对应分 Spec 独立校审 PASS。

### 2026-08-16 / 总架构 Agent / 第二次复核修正

- Case 001 已移除 DeviceInfo；`CAP-DEVICE-001` 拥有独立 Android success/failure/cleanup 验收。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 定向复核 PASS

- 平台总 Spec 定向复核结果：P0/P1/P2 为 0。
- 当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`；启动 AND-S01 分 Spec 设计，禁止产品编码。

### 2026-08-16 / 总架构 Agent / P0-CUT-001 同步

- 新增：AND-S01 拥有 Android Composition Root 和 Runtime Composition Manifest；Core/JS 不得出现 Android/JNI 组成分支。
- 当前授权：`DESIGN_BLOCKED + CODE_BLOCKED`，等待可裁剪组成定向校审。

### 2026-08-16 / 总架构 Agent / JS Engine 边界校准

- AND-S01 Composition Root 必须且只能选择一个 JS Engine Provider，并把 identity 写入 Runtime Composition Manifest；V1 默认 QuickJS。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`。

### 2026-08-16 / 总架构 Agent / 第四次复核修正

- AND-S01 生成的 Manifest 与 link map/symbol inventory 必须共同证明：一次 `runtime.js-framework`、一个选定 Engine。
- 当前仍为 `DESIGN_BLOCKED + CODE_BLOCKED`，等待定向复核。

### 2026-08-16 / 总架构 Agent / 第五次定向复核 PASS

- P0/P1/P2 均为 0；当前授权：`DESIGN_ALLOWED + CODE_BLOCKED`。
- 允许设计 AND-S01；禁止产品编码。

### 2026-08-16 / 总架构 Agent / 最小可观测合同

- AND-S01 只选择 Noop/Android TraceSink；AND-S09 实现平台 Collector，存储、导出与分析不进入 Core。
- 当前授权不变：`DESIGN_ALLOWED + CODE_BLOCKED`。

### 2026-08-16 / Android Runtime Spec Agent / AND-S01 分 Spec 启动

- 状态：`IN_PROGRESS`
- 已完成：确认 AND-S01 写入边界、公共合同优先级与 `DESIGN_ALLOWED + CODE_BLOCKED` 门禁。
- 新增事实：无。
- 本项目设计决定：无；设计将严格消费公共 Composition、Launch、Lifecycle 与 Observation 合同。
- 待验证项：Host 生命周期、包 bytes 所有权、组成失败、线程、销毁和 Fake Core 验收闭环。
- 阻塞项：无。
- 下一步：完成 AND-S01 五份分 Spec 文档并执行链接、需求覆盖和验收闭环自检。
- 公共合同影响：无。

### 2026-08-16 / Android Runtime Spec Agent / AND-S01 分 Spec 完成

- 状态：`READY_FOR_REVIEW`
- 已完成：交付 `README.md`、`requirements.md`、`design.md`、`tasks.md`、`acceptance.md`；冻结 Host 编排、PackageSource bytes 所有权、启动成功、组成失败、线程、销毁和 Fake Core 验收。
- 新增事实：无；本分 Spec 仅投影已冻结公共合同。
- 本项目设计决定：Host 只维护资源编排状态，不复制 Core 的 foreground/background 或 App/Page/Surface 状态；Package completion 恰好一次且异步回 Core queue。
- 待验证项：编码阶段用真实 Android Asset/file 行为、构建 link map 和 sanitizer 证据验证设计。
- 阻塞项：无。
- 下一步：提交 AND-S01 独立校审；通过且工作看板设置 `CODE_ALLOWED` 后才可编码。
- 公共合同影响：无；未发现 `[待决策]`。

### 2026-08-16 / 总架构 Agent / [已冻结] P0-EVENT-002

- 状态：READY_FOR_REVIEW
- 已完成：公共事件合同要求每次 Platform 输入生成一个不复用的 `RequestId`；项目总需求 AND-R09 已同步。
- 新增事实：AND-S05 是 Android 输入 `RequestId` 的 producer，JNI/Core 只原样传递。
- 本项目设计决定：Android 不生成 HandlerId，不按 View identity 或时间戳替代输入关联。
- 待验证项：AND-S05 覆盖连续点击唯一性、同 AppRuntime 不复用和销毁后输入拒绝。
- 阻塞项：无；不改变 AND-S01 当前边界。
- 下一步：AND-S05 启动时读取最新 Event Message Schema。
- 公共合同影响：已冻结，无需项目 Agent 修改公共文件。

### 2026-08-16 / Android Runtime Agent / AND-S01 实现启动

- 状态：`IMPLEMENTING`
- 已完成：确认 AND-S01 `PASS + CODE_ALLOWED`，读取首批结论与 `P0-ID-001`。
- 新增事实：Android 代码目录为空；AND-S01 将建立零网络依赖的 CMake/C++20 Host 合同模块和 Fake Core 测试。
- 本项目实现决定：`AppRuntimeFactory::create` 的返回值持有 Core 创建的 AppRuntime；Android create request 不包含 `AppRuntimeId`。
- 待验证项：Composition、PackageSource、Root presented、`LIFECYCLE_BUSY`、销毁与 Noop/Recording 等价性。
- 阻塞项：无。
- 下一步：严格按 AND-S01 tasks 实现并提交可重复测试证据。
- 公共合同影响：无。

### 2026-08-16 / Android Runtime Agent / AND-S01 实现完成

- 状态：`VERIFIED`
- 已完成：实现 CMake/C++20 Composition Root、严格 Launch Profile/Composition Manifest 解码、Runtime Host、异步 file/memory/Asset PackageSource、Fake Core 合同测试和可重复验证脚本。
- 已验证事实：普通构建与 ASan/UBSan 均通过；6/6 合同测试组通过；符号扫描无 JNI、SurfaceView、MountTransaction、PlatformInputMessage。
- 组成证据：唯一 Engine、`runtime.js-framework` 唯一身份、Manifest 与 build inventory 模块集合/`binaryBytes` 精确一致；不一致返回 `RUNTIME_PROFILE_INCOMPATIBLE`。
- 包读取证据：随机读、零长度、越界、immutable bytes、异步 Core completion、close race、file/memory/Asset backend 均通过。
- Host 证据：Root `presented` 前不成功；Core `LIFECYCLE_BUSY` 原样返回；Root 失败、启动中销毁、重复销毁和 Core 销毁失败均收敛到单次本地释放。
- 身份边界：`AppRuntimeCreateRequest` 不含 `AppRuntimeId`；Fake Core Factory 生成并拥有该身份，Android Host 不生成、不传入、不解释。
- 本项目实现决定：TraceSink 在 Android Host 中保持 opaque，仅选择和注入，不复制公共 Observation message；Asset 通过不含 Android SDK 类型的 `AssetReader` Port 接入。
- 待验证项：真实 Core/JS/QuickJS 可链接后，由 AND-S08/AND-S09 提交 APK/native library link map；当前不把 Fake inventory 伪装成真实链接事实。
- 阻塞项：AND-S01 无。
- 下一步：按工作看板启动下一 Android 分 Spec；真实平台绑定不得回写或扩张 AND-S01 合同。
- 证据：`quickapp-runtime-android/evidence/and-s01-implementation.md`，执行 `./tools/verify-and-s01.sh`。
- 公共合同影响：无；未生成私有 `AppRuntimeId`、生命周期、路由或观测协议。

### 2026-08-16 / 总架构 Agent / 第二批实现检查

- 状态：`IMPLEMENTATION_CHANGES_REQUIRED`。
- 已完成：normal 与 ASan/UBSan 合同脚本通过；Host/Core 边界保持成立。
- 新增事实：FilePackageBackend 每次 read 按 path 重开文件，没有持有 open 时的固定资源身份；实际 Core/JS link map 仍未形成。
- 阻塞项：修复 file package identity 并校正组成证据状态前，AND-S02 不得启动。
- 下一步：按第二批 Agent 话术返修并重新标记 `READY_FOR_REVIEW`。
- 公共合同影响：无。

### 2026-08-16 / Android Runtime Agent / AND-S01 定向返修启动

- 状态：`CORRECTING`
- 已完成：确认 `S1-AND-001` 与 `S2-AND-002`；AND-S02 保持阻塞。
- 新增事实：现有 FilePackageBackend 只保存 path，每次 read 重开文件，无法保持 open 时的资源身份。
- 本项目实现决定：改为 `open + fstat + pread + close` 持有同一只读文件描述符；组成证据分为 S01 隔离合同证据和 S08/S09 最终链接证据。
- 待验证项：路径替换、file read/close 竞争、normal、ASan/UBSan 和证据表述。
- 阻塞项：无。
- 下一步：仅返修 AND-S01 代码、测试、五份 Spec、evidence 和 Handoff。
- 公共合同影响：无。

### 2026-08-16 / Android Runtime Agent / AND-S01 定向返修完成

- 状态：`READY_FOR_REVIEW`；AND-S02 未启动。
- 已完成：FilePackageBackend 改为 `open + fstat + pread + close`，从 open 到 close 固定持有同一只读文件资源，不再按 path 重开。
- 已验证事实：open 后替换原路径仍读取原资源；原资源被截断时返回 `PACKAGE_IO_ERROR`；排队 read 与 close 竞争只在 Core queue 完成一次。
- 运行证据：normal 与 ASan/UBSan 均通过，7/7 合同测试组通过，边界符号扫描通过。
- 组成证据：当前仅为 `isolated implementation verified`；真实 APK/native link map 中一次 JS Framework、一个 Engine 和未选模块不入链接仍为 `integration evidence pending`，由 AND-S08/AND-S09 闭环。
- Spec 同步：五份 AND-S01 文档已明确固定资源身份、路径替换/短读/close race 验收，以及 S01 隔离证据与 S08/S09 最终集成证据的分工。
- 阻塞项：等待本次定向返修复核；工作看板放行前不得启动 AND-S02。
- 证据：`quickapp-runtime-android/evidence/and-s01-implementation.md`，执行 `./tools/verify-and-s01.sh`。
- 公共合同影响：无。

### 2026-08-16 / 总架构 Agent / AND-S01 定向复核 PASS

- 状态：`VERIFIED`。
- 已完成：固定文件资源身份、路径替换/截断/read-close 竞争和 7/7 合同组通过；真实链接证据仍正确标记 pending。
- 下一步：停止扩展，等待 M2；不得启动 AND-S02。
- 公共合同影响：无。

### 2026-08-23 / Android M2 / Android Spine A1 完成

- 状态：`A1_VERIFIED`。
- 已完成：以真实 `quickapp-toolkit/evidence/tk-s07-case001.rpk` 组装 Android Host，串通 RPK Loader、共享 QuickJS/JS Framework、共享 C++ Core、Android Surface Host、typed JNI、事件和 Core Navigation。
- 已验证：首屏 `srf:1` 创建、18 个 Mount 操作、Root Present；真实 Button `node:3` 点击；Platform Input `RequestId` 进入 JS；JS Handler 触发 typed `NavigationPush`；Core 接受 `/pages/DemoDetail`；详情 `srf:2` 创建、28 个 Mount 操作、push Present。
- 已验证：正常 Activity 退出后 `runtime.stopped` 报告 `surfaces=0 nodes=0 handlers=0 pendingCallbacks=0 jsResources=0 coreQueue=0 javaSurfaces=0 javaNodes=0`。
- 构建证据：CMake/Ninja Android arm64 native build 通过；APK 使用 NDK `28.2.13676358`、Android platform 36.1、build-tools 36.0.0；因 Maven 网络不可用，Gradle APK 未作为本次验收前提，使用本地 `aapt2 + zipalign + apksigner` 组装并安装签名 APK。
- Fixture：`tk-s07-case001.rpk` SHA-256 为 `32e012e2235c7ffa36143d9619c90264bbbab5ae0d083e12a13092859990b493`。
- 代码边界：Android/JNI/Android View 代码留在 `quickapp-runtime-android`；Core sole owner Runtime Tree、Navigation、Lifecycle；Android Platform Adapter 只负责 UI thread View 操作、typed message 和输入；未创建旁路路由、第二棵 Runtime Tree 或通用 JSON Bridge。
- 证据：`quickapp-runtime-android/evidence/android-spine-a1-implementation.md`。
- 当前限制：已在 arm64 Android Emulator 验证，尚未在实体 Android 设备验证；A1 只覆盖 View/Text/Button、首屏、点击、push 和 teardown，不代表完整 Android 平台能力或 V1 全量完成。
- 下一步：进入 Android A2/后续 M2 分阶段实现前，先由总架构 Agent 复核 A1 证据；不得因 A1 成功扩张冻结公共合同或提前实现外围能力。
- 公共合同影响：无。
