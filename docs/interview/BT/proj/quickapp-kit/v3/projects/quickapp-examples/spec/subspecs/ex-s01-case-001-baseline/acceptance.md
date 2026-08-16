# EX-S01 验收

## 目录

- [1. 结论](#1-结论)
- [2. 前置条件](#2-前置条件)
- [3. 身份验收](#3-身份验收)
- [4. 可执行场景](#4-可执行场景)
- [5. Lifecycle 与 Trace](#5-lifecycle-与-trace)
- [6. 跨平台判定](#6-跨平台判定)
- [7. 负向门禁](#7-负向门禁)
- [8. 证据与通过条件](#8-证据与通过条件)

## 1. 结论

EX-S01 通过必须同时满足：输入身份一致、S1-S5 可执行、屏幕与 Trace 双重成立、三平台逻辑一致、销毁后资源回落。任一平台通过修改源码获得成功，整体直接失败。

## 2. 前置条件

每次运行前记录：`CASE-001@1`、Source snapshot SHA-256、Runtime Artifact SHA-256、Toolkit/runtime revision、composition profile、平台/设备、viewport、build mode、runId。

正式运行输入必须是 QuickApp Kit Toolkit 从冻结源码生成的 Runtime RPK。联盟 RPK/RPKS 仅执行 reference inspect，不进入 Core 执行路径。

## 3. 身份验收

| Check | 通过条件 |
|---|---|
| A-ID-01 | 复算 Source snapshot 得到 `aa99ea04873aa3fa22a006b37dada4608b06d903fed90370b117074a3834e78a`。 |
| A-ID-02 | 四个联盟归档的 bytes 与 SHA-256 等于 design.md 的 Reference identities。 |
| A-ID-03 | RPK inspect 能识别 Manifest、App/Page JS、Card、asset、META-INF；同时明确缺少 QuickApp Kit Runtime Metadata/Page IR。 |
| A-ID-04 | RPKS inspect 能识别其分包成员，并明确 V1 Runtime 不直接执行 RPKS。 |
| A-ID-05 | 三平台运行记录中的 `quickAppKitArtifactSha256` 完全一致。 |

## 4. 可执行场景

### 4.1 S1 Launch

1. 以 entry route 启动新的 AppRuntime。
2. 等待 `surface.create.presented`。
3. 断言当前 route 为 `/pages/Demo`。
4. 断言页面存在标题 `欢迎体验快应用开发` 和按钮 `跳转到详情页`。
5. 断言 title bar 文本为 `欢迎体验快应用开发`；`setMeta` 若在 profile 中可用，则 title/description 与源码一致。

### 4.2 S2 Push Detail

1. 对文本为 `跳转到详情页` 的 button 发出一次 click。
2. 等待 `navigation.push.presented`。
3. 断言当前 route 为 `/pages/DemoDetail`，Demo hidden，Detail visible。
4. 断言标题 `快应用是什么？`、两段非空且与源码完全匹配的说明、按钮 `欢迎使用` 可见。

### 4.3 S3 Show Toast

1. 对文本为 `欢迎使用` 的 button 发出一次 click。
2. 等待 prompt capability completed。
3. 断言只出现一次 Toast，消息严格等于 `快应用：复杂生活的简单答案，让生活更顺畅`。
4. 断言 route 和页面栈不变，未产生 navigation marker。

### 4.4 S4 Back

1. 发出一次平台 back，不直接调用 JS 页面方法。
2. 等待 typed NavigationClose 成功与 Detail destroy 完成。
3. 断言 Demo 再次 visible，Detail 不可路由且其 Surface/Handler/Node/Host 映射已释放。
4. 断言 Root 未被 pop。

### 4.5 S5 Destroy

1. 发出 `destroyAppRuntime`。
2. 等待 Runtime lifecycle completed。
3. 断言 Demo、App VM、Page VM、Handler、Runtime Node、Host object、Surface 和映射全部释放。
4. 断言销毁后输入不再执行 Handler，late callback 按公共合同丢弃。

## 5. Lifecycle 与 Trace

### 5.1 Lifecycle 偏序

必须证明以下偏序，允许其间插入合同定义的 module/render/mount marker，不允许逆序或重复一次性 Hook：

```text
App onCreate < Demo onInit < Demo onReady < Demo Present < App onShow < Demo onShow
Demo click < Detail onInit < Detail onReady < Detail Present < Demo onHide < Detail onShow
Detail back < Detail onHide < Detail onDestroy < Demo onShow
destroy < Demo onHide < App onHide < Demo onDestroy < App onDestroy
```

### 5.2 Trace 完整性

| 阶段 | 必须成立 |
|---|---|
| Load | package verified 先于任何 module execution；App module completed 先于 App initialization，Page module completed 先于对应 Page initialization。 |
| First render | render submitted -> mount submitted/completed -> platform present requested/completed -> surface presented。 |
| Click | 每次物理 click 只有一个 input captured，并关联一个 Handler started 与一个 completed；HandlerId/SurfaceId 对应目标页面。 |
| Push | router capability request/completion 与 navigation accepted/presented 可用 RequestId/runId 关联；Present 后才提交 hide/show。 |
| Toast | prompt capability request/completion 一次；没有 navigation marker。 |
| Close | typed close result成功；Detail lifecycle 与 surface destroy 完整；不得私造公共 Catalog 外 marker。 |
| Destroy | destroy Hook 与 surface destroy 各完成一次；资源计数回落。 |

失败 marker、Schema 不合法、重复关联键、sequence 非递增或必需边界缺失，均使该 run 无效，不能仅凭截图判定通过。

## 6. 跨平台判定

对 LVGL/SDL、Android、iOS 的三个有效 run 逐项比较：

- route 序列固定为 `Demo -> DemoDetail -> Demo`。
- 可见文本、按钮语义、Toast 内容和事件次数一致。
- Lifecycle 偏序、Surface/Handler 释放语义与错误分类一致。
- Artifact SHA-256 一致；源码无平台条件分支。
- 字体、系统 UI 外观、viewport 数值和性能耗时可不同，但必须记录。

任一平台缺失同一逻辑能力、使用不同 Artifact 或需要改 Case 源码，判定失败并归入对应实现项目。

## 7. 负向门禁

- 修改 Case 001 来绕过 Toolkit/Runtime 缺陷：失败。
- 声称 Case 001 覆盖 state update、`if`、keyed block、device 或 Widget：失败。
- 执行 `system.fetch` 网络请求或把 shortcut 声明算作调用覆盖：失败。
- 直接执行联盟 RPK/RPKS 并称为 Runtime RPK 验收：失败。
- 只提交截图、日志文本或 Schema fixture，没有结构化运行 Trace：失败。
- provenance 未知时编造上游 URL、commit 或许可证：失败。

## 8. 证据与通过条件

最小证据包：

1. Source 与 Reference identity 清单。
2. Toolkit build/inspect 结果及 Runtime Artifact identity。
3. 三平台各一份 S1-S5 操作记录、可见结果和原始结构化 Trace。
4. 三平台一致性比较及允许差异记录。
5. 销毁前后 Runtime/Handler/Surface/Host object 计数。
6. Noop 与 Recording TraceSink 行为等价结果。

全部身份、场景、Trace、资源和跨平台条件通过，且无负向门禁命中时，EX-S01 才可标记 `PASS`。
