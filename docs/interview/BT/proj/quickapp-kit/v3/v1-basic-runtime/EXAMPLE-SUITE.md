# V1 Example Suite

## 目录

- [1. 结论](#1-结论)
- [2. 案例分层](#2-案例分层)
- [3. 当前案例](#3-当前案例)
- [4. 经典集成基线](#4-经典集成基线)
- [5. 验收路径](#5-验收路径)
- [6. 边界](#6-边界)
- [7. Example Agent 执行合同](#7-example-agent-执行合同)

## 1. 结论

返回上一页已经实现，不是 Core 路由缺失：

```text
Detail button -> JS router.back()
-> Bridge NavigationClose
-> Core Navigation
-> Detail destroy + Home reveal
```

该路径已经在 `quickapp-code-test5` 和 LVGL S4 验收中通过。当前问题是标准可见案例分散，`quickapp-code-test1` 没有把返回操作作为完整用户路径展示。

`quickapp-examples` 中已经有多个案例，但它们主要是单项机制回归夹具。V1 需要一个集成型经典基线；直接复用 `quickapp-code-test5` 作为当前集成基线，不立即复制出第二套应用。

## 2. 案例分层

案例分为两类：

1. **机制回归夹具**：验证单个 Contract 或失败路径，允许结构简单、不可作为产品演示。
2. **集成基线应用**：验证真实联盟 DSL 经过 Toolkit、RPK、JS、Core、Platform 的完整主链，必须可见、可交互、可重复验收。

两类案例都必须使用真实 DSL 和 Toolkit 生成的 RPK；禁止手写 Page IR、RenderTransaction 或旁路 Runtime。

## 3. 当前案例

| 案例 | 位置 | 类型 | 覆盖能力 |
|---|---|---|---|
| Case 001 | `quickapp-examples/quickapp-code-test1` | 机制/基础回归 | 联盟 DSL、双页面、基础点击、页面跳转 |
| CASE-002 | `quickapp-examples/quickapp-code-test2` | 机制回归 | state、if、keyed for、列表重排 |
| BLOCK-001 | `quickapp-examples/quickapp-code-test3` | 资源与身份回归 | keyed 增删、身份复用、stale Handler、资源释放 |
| Image/Input 001 | `quickapp-examples/quickapp-code-test4` | 组件/失败回归 | Image、Input、资源失败和清理 |
| LVGL P0 | `quickapp-examples/quickapp-code-test5` | 集成基线 | 双页面、state、if、keyed for、click、push、back、生命周期 |
| Binding 001 | `quickapp-examples/binding-001` | 绑定回归 | 最小数据绑定路径 |

因此，当前不是“只有一个最简单案例”，而是“有多个分散夹具，但只有一个初步集成基线”。

## 4. 经典集成基线

V1 只维护一个集成基线：`quickapp-code-test5`。后续可以将其正式命名为 `quickapp-golden-app`，但重命名不是当前主线工作。

集成基线必须覆盖：

- Home 首屏。
- state 更新，产生可见文本变化。
- `if` 节点显示/隐藏。
- keyed `for` 列表重排，以及后续增删。
- 点击进入 Detail。
- Detail 中明确显示“返回 Home”操作。
- `router.back()` 返回后，Home 恢复并保持 Core 路由栈一致。
- 真实 RPK 加载、Platform 输入、生命周期和 teardown。

后续补齐 Image/Input 后，可在同一应用增加 Form 或 Media 区域；不新增第二套路由、第二棵树或专用测试 Runtime。

## 5. 验收路径

```text
真实联盟 DSL
-> Toolkit
-> RPK
-> JS Framework
-> C++ Core
-> LVGL
-> Home
-> state / if / keyed for
-> click
-> Core Router push
-> Detail
-> router.back()
-> Core Router close
-> Home reveal
-> teardown
```

V1 集成基线验收至少检查：

1. Home、Detail 均可见。
2. 更新按钮能改变 state、if 和列表顺序。
3. 打开详情后 Core 路由栈为 `2`。
4. 返回后 Detail 销毁、Home 恢复，路由栈为 `1`。
5. 旧 Handler 不可继续操作已销毁页面。
6. teardown 后 Runtime Node、Handler、NativeHandle 和 JS 资源归零。

## 6. 边界

本文件不增加组件库、fetch、storage、权限、媒体、Benchmark 或新的平台入口。

Android、iOS 和 LVGL 必须复用同一集成基线的 DSL/RPK 语义；各平台只实现自己的 Runtime/Platform 适配，不改变案例的 Core 路由和事件语义。

机制夹具继续保留，用于定位回归；集成基线用于判断“基本可用快应用”是否真正成立。

## 7. Example Agent 执行合同

```text
你是 QuickApp Kit 的 Example Agent。你的唯一目标是把现有
quickapp-examples/quickapp-code-test5 收敛为 V1 唯一的经典集成基线。

先读取：
1. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/EXAMPLE-SUITE.md
2. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/LVGL-IMPLEMENTATION-ROADMAP.md
3. BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md
4. quickapp-examples/quickapp-code-test5 的全部 DSL、manifest 和现有构建脚本

只允许修改：
- quickapp-examples/quickapp-code-test5/src/**
- quickapp-examples 中与该案例生成、运行、验收直接相关的最小脚本或文档

禁止修改：
- quickapp-runtime-core、quickapp-runtime-js、quickapp-runtime-lvgl
- 公共 Bridge、Render、Event、Navigation Contract
- Core 唯一 Runtime Tree、Core Router、Platform Adapter
- Android、iOS、Benchmark 和其他案例
- 不复制出第二套路由、第二棵树或旁路 Runtime

基线必须是货真价实的联盟 DSL，经 Toolkit 生成真实 RPK；禁止手写 Page IR、
RenderTransaction、MountTransaction，禁止在 C++ composition 中为这个案例补造 UI。

案例必须提供：
1. Home 首屏；
2. state 更新，并产生可见文本变化；
3. if 条件节点显示/隐藏；
4. keyed for 列表，至少支持一次可见的重排，并尽量覆盖增删；
5. 点击进入 Detail；
6. Detail 页面明确提供“返回 Home”操作；
7. router.back() 经过真实 Bridge 和 Core Navigation 返回；
8. 返回后 Detail 销毁、Home 恢复；
9. 页面生命周期和 teardown 可验收。

只使用当前已经支持的组件和 DSL 语义：View、Text、Button、state、if、for、
click、router.push、router.back 以及已经验证的基础样式。Image/Input 不作为本任务
的前置条件；如果加入它们必须完全复用现有 Contract，不能为了案例扩展 Runtime。

执行要求：
1. 先检查现有 quickapp-code-test5，能复用则最小修改，不重写无关代码；
2. 用现有 Toolkit CLI 生成 RPK，不改变 Toolkit 输出合同；
3. 用现有 CMake/Simulator 入口加载真实 RPK；
4. 验证 Home、state、if、列表、push、back、生命周期和 teardown；
5. 回归 Case 001、CASE-002、BLOCK-001，不修改它们；
6. 普通 DSL、构建、RPK 加载和显示问题自行修复，不等待确认；
7. 只有公共 Contract 冲突或无法运行才记录 BLOCKED；
8. 完成后把命令、RPK 路径、SHA-256、可见结果、路由栈变化和资源清理结果追加到
   BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/INTEGRATION-HANDOFF.md。

交付标准：
真实联盟 DSL -> Toolkit -> RPK -> JS -> Core -> LVGL/SDL 的完整案例可运行；
Home -> Detail -> router.back() -> Home 的真实交互通过；所有回归和资源清理检查通过。
完成后停止，不自动扩展组件库、Feature、Android、iOS 或 Benchmark。
```
