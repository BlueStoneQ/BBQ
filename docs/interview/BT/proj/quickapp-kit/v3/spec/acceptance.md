# QuickApp Kit v3 平台总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 结构验收](#2-总-spec-结构验收)
- [3. 架构完整性验收](#3-架构完整性验收)
- [4. Artifact 与构建验收](#4-artifact-与构建验收)
- [5. Runtime 主链路验收](#5-runtime-主链路验收)
- [6. Case 验收](#6-case-验收)
- [7. 平台验收](#7-平台验收)
- [8. 失败、资源与可观测验收](#8-失败资源与可观测验收)
- [9. 证据清单](#9-证据清单)
- [10. V1 完成定义](#10-v1-完成定义)

## 1. 结论

V1 只有在**真实联盟 DSL 经 Toolkit 构建为 Runtime RPK，并由同一 JS Runtime 与 C++ Core 在 LVGL/SDL、Android、iOS 完成相同 Case**后才通过。

文档、Schema、Mock、截图或单个平台 Demo 都不能单独构成 V1 PASS；它们只是最终证据的一部分。

## 2. 总 Spec 结构验收

平台总 Spec 必须具备并保持一致：

```text
requirements.md
design.md
tasks.md
acceptance.md
architecture.md
v1-scope-and-acceptance.md
contracts/**
```

通过条件：

1. 每份标准文件有目录并结论先行。
2. 每项平台需求能映射到唯一 accountable owner；跨平台项目只作为明确 contributor。
3. 平台任务能映射到项目分 Spec，不出现无主任务。
4. 验收项能映射到 Case、合同测试或平台运行证据。
5. 标准文件与详细合同不维护两套相互矛盾的字段定义。

## 3. 架构完整性验收

以下任一不成立即 V1 失败：

| 冻结点 | 必须证明 |
|---|---|
| 单一权威树 | JS 无完整 VNode Tree；Core 只有一棵可变 Runtime Tree；Platform Host Tree 不反向决定逻辑状态 |
| Typed Bridge | JS/Core/Platform 无通用 module/method/JSON 旁路；JNI 和平台 Gateway 只存在于平台项目 |
| 所有权 | State/Binding/Handler、Runtime Tree/Navigation、NativeHandle 分属 JS/Core/Platform，不重叠 |
| 线程 | JS、Core、Platform 执行域无同步环形等待；Measure 例外满足只读和线程安全 |
| 平台无关 | Core/JS 公共构建不依赖任何平台头文件、对象或 EventLoop Backend |
| 可裁剪组成 | 固定 Kernel 完整；外围只向内依赖；未选模块不进入最终链接产物；Artifact/Profile 不兼容在 JS 前失败 |
| JS Engine Service | JS Framework 只依赖 `JsEnginePort`；一个 Profile 只链接一个 Manifest 指定的 Engine；Core/Framework 无 QuickJS 类型 |
| ID | Template、Owner/Handler、Runtime Node、NativeHandle 的产生和可见范围符合 ID Contract |
| 原子提交 | 非法 Render、Mount/Present/Close 失败不造成 Core/JS/Platform 权威状态静默分叉 |

公共 Schema 与语义负例必须全部通过，但 Schema 通过不能替代真实 Case。

## 4. Artifact 与构建验收

1. Case 001/002 源码可通过 CLI 非交互构建。
2. 输出包含 Manifest、App/Page Bundle、每页 Page IR、Runtime Metadata、assets 和 Descriptor。
3. 相同源码、配置和工具版本重复构建得到相同逻辑产物、稳定 Template ID 和哈希。
4. Page IR 满足单根、可达、无环、无多父及 Binding/Handler scope 一致。
5. Bundle 使用 `$app_define$/$app_bootstrap$/$app_require$`，不包含完整 VNode Tree或重复 target descriptor。
6. Loader 在 JS 执行前拒绝非法路径、重复成员、版本、关系、长度和 SHA-256。
7. `inspect` 明确区分联盟包与 Runtime RPK；`run` 产生统一 launch profile 并以 root presented 判断成功。

## 5. Runtime 主链路验收

### 5.1 首屏

```text
Package verified
  -> App/Page Module loaded
  -> App onCreate
  -> Page onInit / initial evaluation / onReady
  -> InstantiateTemplate
  -> Runtime Tree + Layout
  -> full Mount hidden
  -> Present
  -> Core visible commit
  -> Page onShow
```

顺序、一次性和失败闭环必须由 Trace 证明。

### 5.2 更新

一次同步状态更新必须只命中相关 Binding/Block，在 microtask checkpoint 合并，形成一个合法 RenderTransaction；Core 原子提交 Runtime Tree/Revision 后生成对应 Mount ops。不得重建完整静态页面树。

### 5.3 事件

一次平台 click 必须只生成一个带唯一 `requestId` 的 PlatformInputMessage，经 Core 原样传递到该输入的有效 Handler；JS Handler 执行后产生的同步状态更新可用同一 ID 关联到原事件。

### 5.4 Navigation 与 Capability

Root/Push/Close 必须以 Platform present/close 成功作为 Core 栈提交边界。router、prompt、device、title/meta 使用 typed route；unsupported、not-declared、failed 和 success 可区分。

## 6. Case 验收

### 6.1 Case 001

Case 001 使用现有联盟标准范例，冻结源码来源、参考产物和操作步骤。必须覆盖：

- App/Page 生命周期与真实首屏。
- 文本、按钮和基础 Style/Layout。
- click -> JS Handler。
- router push/back 与 Surface visibility。
- prompt/title/meta 最小能力。
- 页面关闭和资源释放。

### 6.2 Case 002

Case 002 是受控增量应用，必须覆盖：

- Binding 目标更新。
- `if` Instantiate/Remove。
- keyed reorder/move/reuse。
- 同轮状态写入合并和单在途 Revision。

### 6.3 BLOCK-001

Focused fixture 必须覆盖 keyed add/remove、递归 Node/EventBinding/Host object 清理和已有 key 身份保持。

### 6.4 CAP-DEVICE-001

独立 focused fixture 必须在 Manifest 声明 `system.device`，调用 `getInfo`，并验证 required fields、物理像素尺寸、logical-px density 关系、unsupported/failure 和禁止设备唯一标识；不得修改 Case 001 凑证据。

Case 的详细步骤和精确预期以 [V1 Scope And Acceptance](./v1-scope-and-acceptance.md) 和 Examples 分 Spec 为准；各项目不得修改 Case 以绕过失败。

## 7. 平台验收

| 里程碑 | 必须证据 |
|---|---|
| LVGL/SDL 首闭环 | SDL 窗口运行完整 Runtime RPK；Case 可见、可点击、可导航；同一进程输出 Runtime/Host/内存 Trace |
| LVGL 设备证明 | 同一 Adapter 更换 Backend 后主要语义不变；记录设备、构建、viewport、内存和对象证据 |
| Android 复用 | 同一 Artifact/Core/JS 在模拟器或真机通过相同 Case；JNI 无共享 Runtime 逻辑；记录联盟差异 |
| iOS 复用 | 同一 Artifact/Core/JS 在模拟器或设备通过相同 Case；UIKit/Gateway 不泄漏到 Core |

三平台视觉不要求像素完全一致，但组件语义、文本内容、交互结果、页面状态、ID 关系和错误分类必须一致。字体和设备差异必须记录，不得静默改变逻辑布局所有权。

## 8. 失败、资源与可观测验收

### 8.1 失败与降级

- 注入 Package、JS initialization、Render、Measure、Mount、Present、Capability 和 Close 失败。
- 每个失败返回稳定 typed error，不崩溃、不静默成功。
- incremental Mount 失败后可接受一次 full rebuild；失败仍未恢复时进入明确 degraded/failed 状态。
- Surface/AppRuntime 销毁后的 late callback 按 tombstone 丢弃。

### 8.2 资源

- 页面销毁后 Page VM、Binding、Handler、Runtime Node、Host object 和映射回落到预期基线。
- 多轮 push/back 和更新不出现无界对象、队列和内存增长。
- Runtime 不依赖进程退出完成正常资源回收。

### 8.3 可观测

- Build、Load、Lifecycle、Render、Mount、Event、Navigation、Capability 和 Destroy marker 可关联。
- 事务记录 operation count、logical payload bytes；存在真实传输边界时另记 actual transport bytes。
- 内存统一记录 bytes，Host/LVGL object 记录 count，不能混为一个数值。
- Noop 与 Recording `TraceSink` 运行相同 Case 时，除观测证据外的状态、结果、Revision、错误和线程顺序一致。
- `timestampNs` 来自单调时钟并使用整数纳秒；热路径不格式化文本、不执行文件 I/O、不阻塞 Collector。
- Package/Module、Bridge、Render、Mount、Event、Lifecycle 的关键阶段可由公共 ID 关联。
- Runtime Node、Handler、Surface 和队列深度使用结构化计数器；OOM、队列溢出、事务失败和 full rebuild 有明确事件。
- Android、LVGL、iOS Collector、存储、导出、统计、报告和可视化不进入 C++ Kernel。
- V1 只要求可重复基础报告，不要求宣称优于外部框架。

### 8.4 可裁剪性

1. 依赖检查证明 Core/JS 不引用 Platform、Backend、可选 Provider 或诊断实现。
2. 构建 `lvgl-simulator-dev` 与 `lvgl-embedded-min`，两个产物都包含固定 Kernel、`View/Text/Button`、`system.router/prompt/device` 和 baseline Observation。
3. embedded-min 的链接清单、符号和依赖中不存在 SDL、模拟设备、故障注入与 diagnostic-only 模块；不得用运行时关闭代替链接期移除。
4. 两个产物都生成符合公共 Schema 的 Runtime Composition Manifest，并记录最终二进制 bytes。
5. Benchmark 按 `profileId` 记录运行基线、首屏峰值、销毁回落内存和对象数量；不同 Profile 不混合统计。
6. 使用缺失组件和缺失 Capability 的专用负例，证明 Core 在执行 JS 前返回 `RUNTIME_PROFILE_INCOMPATIBLE`。
7. Fake Engine 通过 `JsEnginePort` 合同测试；QuickJS Provider 通过相同测试；链接清单只含 Manifest 指定的一个 Engine module。
8. Runtime Composition Manifest 与 link map/symbol inventory 均包含且只包含一个 `runtime.js-framework` 必选模块身份。

## 9. 证据清单

| 证据 | 所有者 |
|---|---|
| 总 Spec、公共合同和决策记录 | 总架构 Agent |
| Schema、语义正负例 | 总架构 Agent/对应公共合同维护者 |
| Case 源码、provenance、操作和预期 | Examples Agent |
| 构建产物、Golden、诊断和确定性 | Toolkit Agent |
| JS VM/Binding/Handler 单元与 Trace | JS Agent |
| Core Fake Port、状态机、树/事务/资源证据 | Core Agent |
| SDL、LVGL 设备、Android、iOS 运行记录 | 各 Platform Agent |
| Observation Contract 与 Schema | 总架构 Agent |
| Observation Contract 验证、raw data 和基础报告 | Benchmark Agent |
| Runtime Composition Manifest、链接清单、体积与 Profile 内存 | Core、Platform、Benchmark Agent |

每份证据必须记录代码版本、Artifact hash、构建模式、平台/设备、运行参数和失败样本；截图不能替代机器可读 Trace。

## 10. V1 完成定义

只有同时满足以下条件，V1 才能标记完成：

1. 平台总 Spec、公共合同、项目总 Spec 和已实现分 Spec 均通过各自门禁。
2. Toolkit 从联盟 DSL 构建正式 Runtime RPK，结果可重复且可检查。
3. Case 001、Case 002、`BLOCK-001`、`CAP-DEVICE-001` 在 LVGL/SDL、Android、iOS 使用同一 Artifact/Core/JS 通过。
4. 三大系统和跨层边界无私有旁路、重复权威状态或平台类型泄漏。
5. 关键失败可诊断，Mount 至少具备一次 full rebuild 兜底，资源可回收。
6. 三端输出可关联的启动、首屏、更新、事件、事务大小和内存基础结果。
7. 第二期事项未被伪装成 V1 完成条件，也未反向污染 V1 架构。
8. 固定 Kernel 与外围编译期组合通过双 Profile、链接清单和资源证据验证。
