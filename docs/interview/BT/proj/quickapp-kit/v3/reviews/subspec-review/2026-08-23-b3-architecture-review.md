# B3 架构复核

## 目录

- [1. 结论](#1-结论)
- [2. 已验证事实](#2-已验证事实)
- [3. 处理决定](#3-处理决定)
- [4. B3 执行合同](#4-b3-执行合同)

## 1. 结论

**主架构通过，B3 允许继续实现。**

`Image/Input` 是对现有 Host Component、Page IR 和 Event Contract 的向后兼容加法，不改变唯一 Runtime Tree、RenderTransaction、MountTransaction、Event Router、Bridge 或平台边界。

当前不能标记 B3 `FUNCTIONALLY_VERIFIED`。现状是合同类型已开始扩展，但 Image/Input 尚未完成从 Toolkit RPK 到 Core Page IR、LVGL Mount 和输入事件的完整闭环。

## 2. 已验证事实

1. Host/Page/Event Schema 已加入 `Image`、`Input`、`value`、`input/change/focus`。
2. Core enum 和 wire mapping 已加入对应类型，但 Core `parse_host` 仍只实际解析 `View/Text/Button`。
3. MountTransaction Schema 和 LVGL Mount 当前仍只实际支持 `View/Text/Button`。
4. Runtime Composition 预检已经按 Page IR 的 `required_components` 拒绝缺少组件的 Profile；因此 Image/Input 不能绕过 Composition Profile 直接运行。
5. Toolkit 旧 Case、Core/LVGL 构建和 B1/B2 回归保持通过。

## 3. 处理决定

### 3.1 不调整主架构

不增加第二棵树、第二套路由、通用 JSON Bridge 或平台旁路；不把 Image/Input 做成 Core 外的特例。

### 3.2 B3 继续实现

将当前状态改为：`IMPLEMENTATION_ALLOWED`。

合同闭环是 B3 实现的第一步，不再单独等待下一轮总架构校审。B3 Agent 可以在同一波次内补齐 Mount 合同、Composition Profile 和实际运行链路。

### 3.3 合同闭环要求

在宣称功能完成前，必须同步完成：

- MountTransaction 的 `createHost.type` 接受 `Image/Input`。
- Runtime Composition 文档明确：`Image/Input` 是 B3 新增可声明组件；只有实际链接对应实现的 Profile 才能运行使用它们的 RPK；不能把未实现组件提前写入现有 Profile 的可用集合。
- Core Page IR 实际解析 Image `src` 和 Input `value/enabled`。
- Toolkit 从联盟 DSL 生成 Image/Input 的 Page IR 和 RPK 资源关系。
- LVGL 创建、属性、布局和资源失败结果；Input 的 `input/change/focus` 进入既有 Event Router。

## 4. B3 执行合同

### 必须完成

```text
联盟 DSL
-> Toolkit lowering
-> Page IR / RPK
-> Core Loader required_components
-> Core Runtime Tree
-> MountTransaction
-> LVGL Host
-> PlatformInputMessage
-> Core Event Router
-> JS Handler
```

验收至少包含：

1. 旧 Case 001、CASE-002、BLOCK-001 不回归。
2. Image 包内资源可见；缺失或不可加载时整笔 Mount 失败且无部分对象泄漏。
3. Input 初始 `value` 可见；输入事件携带当前字符串并到达 JS Handler。
4. teardown 后 Runtime Node、Handler、Platform Object 和 JS 资源归零。

### 明确不做

不做 Android/iOS 同步实现、不做网络图片、不做复杂输入法/上传/blur、不做 Benchmark 和完整观测系统。这些不阻塞 B3。

### 放行条件

B3 Agent 完成上述最小闭环后，提交一份运行输出和变更摘要即可；不要求新增大规模证据系统。总架构只复核公共 Contract、边界和旧链路回归。
