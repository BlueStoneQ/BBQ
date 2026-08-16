# Runtime Composition Contract

## 目录

- [1. 结论](#1-结论)
- [2. 固定内核与可裁剪外围](#2-固定内核与可裁剪外围)
- [3. 组成过程](#3-组成过程)
- [4. Runtime Composition Manifest](#4-runtime-composition-manifest)
- [5. Artifact 兼容性预检](#5-artifact-兼容性预检)
- [6. 依赖规则](#6-依赖规则)
- [7. 验收证据](#7-验收证据)

## 1. 结论

QuickApp Kit 采用：**固定 C++ Runtime Kernel + 必选 JS Runtime Service + 编译期可组合外围。**

Bridge、Render、Event 三大系统及其共同依赖的生命周期、唯一 Runtime Tree、事务提交、ID、错误和队列机制不可裁剪；JS 执行能力必选，但具体 JS Engine Provider 可替换；Platform Backend、Provider、扩展 Host Component、诊断能力和第二期 Feature 按产品 Build Profile 组合。

可裁剪的含义是未选模块的源文件、对象文件和依赖不进入最终链接产物，不是运行时关闭一个仍已链接的开关。

## 2. 固定内核与可裁剪外围

| 类别 | V1 规则 |
|---|---|
| C++ Runtime Kernel | Bridge、Render、Event 的 Core-side 部件，以及 Lifecycle、Runtime Tree、Transaction；不可裁剪 |
| JS Runtime Service | JS Framework 与 `JsEnginePort` 是必选服务合同，不属于 C++ Kernel |
| JS Engine Provider | Build Profile 必须且只能选择一个；V1 提供 QuickJS，未来可替换为其他 Provider |
| V1 Conformance | `conformance=v1` 时包含 `View/Text/Button`、`system.router/prompt/device` 和 baseline Observation |
| Custom Profile | 可裁掉非当前产品必需的组件和能力；只能运行需求集合为其子集的 Artifact |
| Platform Backend | LVGL embedded、SDL simulator、Android、iOS 按目标选择；一个产物只链接目标所需实现 |
| 可选外围 | 额外 Provider、Host Component、EventLoop Backend、诊断与故障注入、第二期 Feature；未选即不链接 |

Kernel 不提供动态插件生命周期。外围通过稳定 Port 向内注册实现，Kernel 不依赖外围具体类型。

## 3. 组成过程

```text
Product Composition Root
  -> select Build Profile
  -> link fixed C++ Kernel + JS Framework
  -> select exactly one JS Engine Provider
  -> register selected Platform/Provider/Component/Backend modules
  -> produce RuntimeCompositionManifest
  -> embed manifest in Runtime Host
```

Composition Root 归各 Platform Runtime 所有；Core 不知道具体 JS Engine，JS Framework 只依赖 `JsEnginePort`，平台构建只负责选择 Provider，不把平台分支写入 Core 或 JS Framework。

Build Profile 是产品构建输入，可以由各平台构建系统表达；`RuntimeCompositionManifest` 是构建后的公共事实，必须符合机器 Schema。

## 4. Runtime Composition Manifest

Manifest 最少声明：

```text
profileId / target / runtimeAbi / buildMode
jsEngine(engineId / engineVersion / engineAbi / moduleId)
linkedModules[]
components[]
capabilities[]
observationLevel
binaryBytes
```

约束：

1. `linkedModules` 是最终链接清单，不是可选模块目录。
2. Manifest 中六个 Core Kernel 模块和 `runtime.js-framework(category=runtime)` 必须始终且各自只出现一次。
3. 必须且只能链接 `jsEngine` 指向的一个 Engine module。
4. `components` 和 `capabilities` 只声明本产物真实可提供的公共能力。
5. `binaryBytes` 来自最终可执行产物或共享库，不得使用源码大小代替。
6. Profile 配置、链接清单和实际符号不一致时，构建失败。
7. `linkedModules.moduleId` 在一个 Manifest 内唯一，固定 Kernel module 的 category 必须是 `kernel`。
8. `engineAbi` 不兼容时启动失败并返回 `MODULE_ABI_UNSUPPORTED`；不得降级到另一 Engine 或继续执行 Bundle。
9. `conformance=v1` 的 `observationLevel` 必须是 `baseline` 或 `diagnostic`；`custom` 可以选择 `off` 并注入 Noop TraceSink。

Composition Root 将 Manifest 作为 immutable startup input 交给 Core；Runtime Host 同时提供只读 describe 能力，供 Toolkit Target Adapter 和 Benchmark 获取同一事实。describe 的进程传输形式由平台实现，不成为新的 Runtime Bridge。

机器合同见 [`runtime-composition.schema.json`](./schemas/runtime-composition.schema.json)。

## 5. Artifact 兼容性预检

Core Loader 在执行任何 JS 前计算 Artifact 需求：

```text
required components  = Page IR 中使用的 Host Component type
required capabilities = Manifest.features 中的模块名
available set          = RuntimeCompositionManifest 声明
```

若 `required - available` 非空，Loader 返回 `RUNTIME_PROFILE_INCOMPATIBLE` 并拒绝整个 Package。V1 不扫描 JS 文本推断能力，也不向 Runtime Metadata 增加重复需求字段。

方法级 unsupported 仍由 Capability Contract 的 typed Invoker 返回；组成预检只做组件和模块级判断。

## 6. 依赖规则

```text
Product Composition Root -> Platform modules -> shared Ports -> Runtime Kernel
Optional Feature/Provider -> shared Ports -> Runtime Kernel
Runtime Kernel -X-> Platform/optional concrete module
JS Framework -> JsEnginePort <- selected JS Engine Provider
```

1. 依赖只能由外围指向内核与公共 Port。
2. Core/JS 公共目标不得引用平台头文件、SDK、Backend 或可选 Provider。
3. 不得在 Kernel 业务路径散布外围功能的条件编译。
4. 条件构建只出现在 Composition Root、模块目标和依赖选择处。
5. 每个外围模块必须有单一注册入口、明确所有权和确定销毁点。
6. Core 只依赖 JS Runtime Contract；JS Framework 不得引用 QuickJS 类型，QuickJS handle 只能存在于 QuickJS Provider。

## 7. 验收证据

可裁剪性必须同时由结构和产物证明：

1. 依赖检查证明 Kernel 无外围反向依赖。
2. 至少构建 `lvgl-simulator-dev` 与 `lvgl-embedded-min` 两个 Profile。
3. 两个产物均保留固定 Kernel 和 V1 Conformance 能力。
4. SDL、诊断和故障注入模块不出现在 embedded-min 的链接清单、符号或依赖中。
5. 记录 Profile、最终二进制 bytes、运行基线/峰值内存和对象数量。
6. 缺少组件或 Capability 的专用负例必须在 JS 执行前稳定失败。
7. 每个 Profile 只链接一个 Engine module；Fake Engine 合同测试与 QuickJS Provider 证明 `JsEnginePort` 不泄漏引擎类型。
8. Manifest 中 `runtime.js-framework` 必须与 link map/symbol inventory 对应；仅声明但未链接视为构建失败。
