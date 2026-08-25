# QuickApp Kit 能力实施看板

## 目录

- [总顺序](#toc-order)
- [B1：Input + Switch](#toc-b1)
  - [目标](#toc-b1-goal)
  - [执行](#toc-b1-execution)
  - [公共实现 Agent 提示词](#toc-b1-common-agent)
  - [平台 Agent 提示词](#toc-b1-platform-agent)
  - [B1 放行](#toc-b1-gate)
- [B2：Slider + Picker](#toc-b2)
  - [目标](#toc-b2-goal)
  - [执行](#toc-b2-execution)
  - [公共实现 Agent 提示词](#toc-b2-common-agent)
  - [平台 Agent 提示词](#toc-b2-platform-agent)
  - [B2 放行](#toc-b2-gate)
- [B3：List + Scroll](#toc-b3)
  - [目标](#toc-b3-goal)
  - [执行](#toc-b3-execution)
  - [公共实现 Agent 提示词](#toc-b3-common-agent)
  - [平台 Agent 提示词](#toc-b3-platform-agent)
- [B3.5：Tabs](#toc-b35)
- [B4：prompt + fetch + file](#toc-b4)
  - [目标](#toc-b4-goal)
  - [执行](#toc-b4-execution)
  - [公共实现 Agent 提示词](#toc-b4-common-agent)
  - [平台 Agent 提示词](#toc-b4-platform-agent)
- [B5：Android/iOS Video](#toc-b5)
  - [目标](#toc-b5-goal)
  - [执行](#toc-b5-execution)
  - [公共实现 Agent 提示词](#toc-b5-common-agent)
  - [Android/iOS Agent 提示词](#toc-b5-platform-agent)
- [B6：openUrl + system.webview](#toc-b6)
  - [目标](#toc-b6-goal)
  - [执行](#toc-b6-execution)
  - [公共实现 Agent 提示词](#toc-b6-common-agent)
  - [平台 Agent 提示词](#toc-b6-platform-agent)
- [放行条件](#toc-gate)

<a id="toc-order"></a>
## 总顺序

```text
B1 Input + Switch
-> B2 Slider + Picker
-> B3 List + Scroll
-> B3.5 Tabs
-> B4 prompt + fetch + file
-> B5 Android/iOS Video
-> B6 openUrl + system.webview
```

每个 Batch 内部固定顺序：

```text
公共实现 Agent
-> 公共测试与真实 RPK
-> Android / iOS / LVGL Agent 并行
-> Example Agent 更新验收案例
-> 总架构验收
-> 下一 Batch
```

公共实现 Agent 可以修改：

```text
quickapp-runtime-core
quickapp-runtime-js
quickapp-toolkit
```

平台 Agent 只能修改自己的目录：

```text
quickapp-runtime-android
quickapp-runtime-ios
quickapp-runtime-lvgl
```

平台实现属于 Platform；Core 只保存组件/Feature 的公共语义合同、Runtime Tree、事件、布局和生命周期语义。

每个 Batch 必须复用既有 Core Tree、Bridge、Render Pipeline、Event Router、Navigation 和 Lifecycle；不得创建第二棵树、第二套路由或平台旁路。

<a id="toc-b1"></a>
## B1：Input + Switch

<a id="toc-b1-goal"></a>
### 目标

完成受控输入和布尔开关的三端闭环。

```text
Input: value / enabled / input / change / focus
Switch: checked / enabled / change({ checked })
```

<a id="toc-b1-execution"></a>
### 执行

1. 公共实现 Agent 串行完成 Contract、Toolkit、JS、Core。
2. Toolkit 生成 `controls-001.rpk` 并通过全量测试。
3. Android、iOS、LVGL 三个 Agent 并行接入和验收。
4. Example Agent 保留独立 `controls-001`，不修改 `commerce-001`、`wallet-001`。

<a id="toc-b1-common-agent"></a>
### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B1 公共实现：Input + Switch。

读取：
- v3/spec/architecture.md
- v3/spec/contracts/host-component-contract.md
- v3/spec/contracts/event-contract.md
- v3/spec/contracts/render-contract.md
- v3/quickapp-dsl/CAPABILITY-EXECUTION-PLAN-2026-08-25.md

完成：
- Input 的 value/enabled/input/change/focus
- Switch 的 checked/enabled/change({checked})
- Core 公共组件合同、Page IR、Runtime Tree、事件和渲染映射
- JS typed ABI、Facade、受控状态回写
- Toolkit DSL lowering、真实 controls-001.rpk、manifest 依赖
- Core、JS、Toolkit 测试

约束：
- JS/Core 状态是唯一权威状态。
- 不重写 Router、Event Router、Yoga、Lifecycle 或三大系统。
- 不修改 Android/iOS/LVGL 代码。
- 不修改已有最终 RPK。
- 只做向后兼容扩展，不引入第二棵树、第二套路由或通用 JSON Bridge。

完成后追加 v3/quickapp-dsl/AGENT-HANDOFF.md，写明文件、测试、RPK、SHA-256 和剩余问题，然后停止。
```

<a id="toc-b1-platform-agent"></a>
### 平台 Agent 提示词

```text
你负责 B1 Input + Switch 的本平台实现和验收。

只修改你的平台目录：
- Android: quickapp-runtime-android
- iOS: quickapp-runtime-ios
- LVGL: quickapp-runtime-lvgl

复用公共 Contract、Core RenderTransaction、MountTransaction、Event Router 和 Lifecycle。
实现真实控件映射、状态同步、input/change/focus 或 change 事件、页面返回和 teardown。
不修改 Core、JS、Toolkit、公共 Contract 或 Examples Composition Root。

使用真实 controls-001.rpk，完成首屏、交互、状态更新、push/back、重复进入和资源释放。
把日志/截图/测试写入本平台 evidence，并追加 handoff；完成后停止。
```

<a id="toc-b1-gate"></a>
### B1 放行

```text
controls-001 可加载
-> 三端目标运行通过
-> 旧基线回归通过
-> teardown 资源归零
-> 放行 B2
```

<a id="toc-b2"></a>
## B2：Slider + Picker

<a id="toc-b2-goal"></a>
### 目标

```text
Slider: min / max / step / value / change({value,isFromUser})
Picker: mode=text / range / selected / value / change
```

第一批只实现普通文本 Picker。日期、时间、多列 Picker 作为后续扩展，不阻塞 B2。

<a id="toc-b2-execution"></a>
### 执行

1. B1 放行后，公共实现 Agent 串行完成 Contract、Toolkit、JS、Core。
2. 生成 `controls-002.rpk` 并通过公共测试。
3. Android、iOS、LVGL 并行实现。
4. Example Agent 增加 Slider/Picker 验收页。

<a id="toc-b2-common-agent"></a>
### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B2 公共实现：Slider + Picker。

前置条件：B1 已通过；先读取 B1 handoff。

完成：
- Slider：min/max/step/value，change({value,isFromUser})
- Picker：mode=text、range、selected/value、change
- Core 公共合同、Page IR、Runtime Tree、事件和状态回写
- JS typed ABI/Facade
- Toolkit lowering、真实 controls-002.rpk
- Core、JS、Toolkit 测试

不做：日期、时间、多列 Picker 的完整平台实现；不修改 Router、三大系统、已有 RPK 或平台代码。

完成后追加 handoff，写明测试和 RPK，然后停止。
```

<a id="toc-b2-platform-agent"></a>
### 平台 Agent 提示词

```text
你负责 B2 Slider + Picker 的本平台实现和验收。

只修改对应平台目录；不修改 Core、JS、Toolkit 和公共 Contract。
复用既有 Runtime Tree、MountTransaction、Event Router、状态更新和 Lifecycle。

完成 Slider 的范围/步进/值同步和 change；完成普通文本 Picker 的选择、取消/确认和 change。
使用 controls-002.rpk 验收交互、路由、重复进入和 teardown，写 evidence/handoff 后停止。
```

<a id="toc-b2-gate"></a>
### B2 放行

```text
普通 Slider/Picker 三端可用
-> controls-002 通过
-> 旧基线回归通过
-> 放行 B3
```

<a id="toc-b3"></a>
## B3：List + Scroll

<a id="toc-b3-goal"></a>
### 目标

```text
List：纵向列表、keyed item、scroll/scrollend/scrolltop/scrollbottom
Scroll：纵向滚动、内容范围、生命周期
```

第一版不做虚拟化、瀑布流、多列布局、复杂复用和动画滚动。

<a id="toc-b3-execution"></a>
### 执行

1. B2 放行后，公共实现 Agent 串行完成 Toolkit、Core、JS。
2. 生成 `list-001.rpk`。
3. Android、iOS、LVGL 并行接入。
4. Example Agent 创建长列表、点击详情、返回和滚动验收页。

<a id="toc-b3-common-agent"></a>
### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B3 公共实现：List + Scroll。

前置条件：B2 已通过。

把当前 View + keyed for 的轻量列表扩展为明确的 List/Scroll 语义：
- List 纵向布局和 keyed item
- Scroll 纵向内容范围
- scroll、scrollend、scrolltop、scrollbottom
- 状态更新、事件和 teardown
- Toolkit lowering、Page IR、真实 list-001.rpk

不做虚拟化、瀑布流、多列布局、复杂复用和动画滚动。
Core 仍只有一棵 Runtime Tree；不创建第二棵列表树。
不得修改平台代码、已有 RPK 或三大系统架构。

完成 Core/JS/Toolkit 测试和 handoff 后停止。
```

<a id="toc-b3-platform-agent"></a>
### 平台 Agent 提示词

```text
你负责 B3 List + Scroll 的本平台实现和验收。

只修改对应平台目录；复用 Core 的滚动和事件语义。
实现真实滚动容器、滚动范围、scroll 事件、边界事件和销毁清理。
不实现平台私有列表状态，不创建第二棵树，不修改公共层。

使用真实 list-001.rpk，验证 keyed for、滚动、点击详情、返回、重复进入和 teardown。
写 evidence/handoff 后停止。
```

<a id="toc-b4"></a>
## B3.5：Tabs

### 目标

实现可裁剪的受控 Tabs 组件：

```text
items / selected / change({ index, value })
```

### 执行

1. B3 通过后，公共实现 Agent 完成 Contract、Core、JS、Toolkit 和 `tabs-001.rpk`。
2. Android、iOS、LVGL Platform Agent 并行完成原生映射和事件回传。
3. Example Agent 增加 Tabs 验收案例；总架构完成三端回归后放行 B4。

### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B3.5 公共实现：Tabs。

完成受控 Tabs 的 items、selected 和 change({index,value}) 语义，接入既有 Runtime Tree、Render Pipeline、Event Router、Navigation 和 Lifecycle。
完成 Core Contract、Page IR、JS typed ABI/Facade、Toolkit lowering、真实 tabs-001.rpk，以及 Core/JS/Toolkit 定向测试。

Tabs 是可裁剪 UI Component，不进入固定内核；Core 只维护公共语义和运行时节点，平台负责具体原生渲染。
不得创建第二棵 Tree、第二套路由或旁路 Bridge；不得修改 Android、iOS、LVGL 目录或已有 RPK。
完成后追加 handoff，记录测试、RPK、SHA-256 和剩余问题，然后停止。
```

### 平台 Agent 提示词

```text
你负责 B3.5 Tabs 的本平台实现和验收。

只修改自己的平台目录，复用既有 Runtime Tree、MountTransaction、Event Router、状态回写和 Lifecycle。
实现真实 Tabs 原生映射、selected 受控更新、用户切换 change({index,value})、重复切换和 teardown。
使用真实 tabs-001.rpk 验证首屏、切换、状态回写和资源释放；写 evidence/handoff 后停止。
不得修改 Core、JS、Toolkit、公共 Contract 或 Examples Composition Root。
```

Tabs 不阻塞当前 B4；B3.5 在 B3 通过后进入公共实现，在 B4 前完成平台收口。

<a id="toc-b4"></a>
## B4：prompt + fetch + file

<a id="toc-b4-goal"></a>
### 目标

```text
prompt：showToast / alert / confirm
fetch：url / method / headers / body / timeout / text/json / cancel
file：read / write / exists / delete，限定应用私有目录或内存 Provider
```

<a id="toc-b4-execution"></a>
### 执行

1. B3 放行后，公共实现 Agent 串行完成 Feature Contract、JS Facade、Toolkit capability 和 Core Registry 接线。
2. 生成 `platform-001.rpk`，网络使用 deterministic mock/local Provider，不依赖公网。
3. Android、iOS、LVGL Platform Feature Agent 并行实现。
4. Example Agent 增加 Feature 状态、失败、unsupported、取消和清理验收。

<a id="toc-b4-common-agent"></a>
### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B4 公共 Feature：prompt + fetch + file。

前置条件：B3 已通过。

完成：
- typed Feature Contract、ModuleRegistry、RequestId、生命周期和结果模型
- prompt：showToast/alert/confirm
- fetch：url/method/headers/body/timeout，text/json，cancel
- file：read/write/exists/delete，应用私有目录或内存 Provider 边界
- JS Facade 和 manifest capability lowering
- completed/failed/unsupported/cancelled 语义
- deterministic mock/local Provider 测试
- 真实 platform-001.rpk

Core 不实现网络、文件系统和原生弹窗，只实现合同、Registry、关联和生命周期。
不修改 Host Component、Router、Render Pipeline、Event Router 和已有 RPK。

测试与 handoff 完成后停止。
```

<a id="toc-b4-platform-agent"></a>
### 平台 Agent 提示词

```text
你负责 B4 Platform Feature 的本平台 Provider。

只修改对应平台目录；不修改 Core、JS、Toolkit、公共 Contract 或 Examples Composition Root。
实现 prompt/fetch/file 的 Provider，正确返回 completed、failed、unsupported、cancelled。
文件访问必须限制在应用私有目录或内存 Provider；网络验收使用本地 deterministic Provider。

使用真实 platform-001.rpk，验证成功、失败、取消、无 Provider、页面销毁和资源清理。
写 evidence/handoff 后停止。
```

<a id="toc-b5"></a>
## B5：Android/iOS Video

<a id="toc-b5-goal"></a>
### 目标

只实现移动端 Video：

```text
属性：src / poster / autoplay / controls / muted
操作：play / pause / seek
事件：prepared / start / pause / finish / error / timeupdate
```

LVGL 不实现 Video；包含 Video 的 RPK 在 LVGL Profile 加载阶段明确拒绝。

<a id="toc-b5-execution"></a>
### 执行

1. B4 放行后，公共实现 Agent 串行完成 Video Contract、Toolkit Page IR 和 `media-001.rpk`。
2. Android Video Agent 与 iOS Video Agent 并行，只修改各自平台目录。
3. Example Agent 生成移动端媒体验收案例。
4. 总架构验收后放行 B6。

<a id="toc-b5-common-agent"></a>
### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B5 公共 Video Contract 和 Toolkit 输入。

完成 Video 的 src/poster/autoplay/controls/muted、play/pause/seek、
prepared/start/pause/finish/error/timeupdate 语义，生成真实 media-001.rpk。

Core 只保存公共组件合同、Runtime Tree、Render/Mount 生命周期和事件语义；
不包含解码器、播放器、网络媒体线程或平台播放器实现。
LVGL Profile 不声明 Video。

不得修改 Router、三大系统、已有 RPK。完成测试和 handoff 后停止。
```

<a id="toc-b5-platform-agent"></a>
### Android/iOS Agent 提示词

```text
你负责 B5 Video 的移动平台实现。

只修改对应平台目录：Android 使用现有平台播放器能力；iOS 使用 AVPlayer。
复用 Core Runtime Tree、MountTransaction、Event Router 和 Lifecycle。
完成首帧、播放、暂停、seek、失败、返回和 teardown。

使用真实 media-001.rpk；不扩展直播、倍速、截图、复杂全屏容器和自定义控制层。
写 evidence/handoff 后停止。
```

<a id="toc-b6"></a>
## B6：openUrl + system.webview

<a id="toc-b6-goal"></a>
### 目标

明确三种语义：

```text
应用内 href       -> Core Router
open-mode=external -> system.openUrl -> 系统默认浏览器
open-mode=webview  -> system.webview -> 平台 WebView 页面
```

第一版不做内嵌 `<webview>` Host Component、Cookie 全量管理、网页 JS 双向通信和 WebView 内部路由。

<a id="toc-b6-execution"></a>
### 执行

1. B5 放行后，公共实现 Agent 串行完成 `a` lowering、openUrl/webview Feature Contract 和 `url-001.rpk`。
2. Android、iOS Provider Agent 并行实现。
3. LVGL Agent 只实现 typed `unsupported` 验收。
4. Example Agent 生成 external/webview/失败/关闭案例。

<a id="toc-b6-common-agent"></a>
### 公共实现 Agent 提示词

```text
你负责 QuickApp Kit B6 的 a lowering、openUrl 和 system.webview 公共合同。

应用内路径必须进入 Core Router；external 和 webview 必须进入 Platform Feature。
生成真实 url-001.rpk 和 manifest capability。

不实现内嵌 webview Host Component，不实现 Cookie、UA、网页 JS 双向通信和内部网页路由。
不修改 Core Tree、Router 主链、三大系统和已有 RPK。
完成 Toolkit/Core/JS 测试和 handoff 后停止。
```

<a id="toc-b6-platform-agent"></a>
### 平台 Agent 提示词

```text
你负责 B6 的本平台 Provider。

Android/iOS：
- external 调起系统默认浏览器
- webview 打开平台 WebView 页面
- 处理失败、关闭和 teardown

LVGL：
- 不打开网页
- 返回 typed unsupported

不得把外部 URL 当作 Core 内部路由，不实现内嵌 webview Host Component。
只修改对应平台目录，使用真实 url-001.rpk，写 evidence/handoff 后停止。
```

<a id="toc-gate"></a>
## 放行条件

每个 Batch 必须满足：

```text
公共 Contract 通过
-> Toolkit 真实 RPK 生成
-> Core/JS 测试通过
-> 目标平台运行通过
-> wallet-001/commerce-001/Case 回归通过
-> evidence + handoff 完成
```

通过后才启动下一 Batch。不同 Batch 不并行修改公共 Core、JS 和 Toolkit。
