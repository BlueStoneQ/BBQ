## 核心概念和代码映射表
# 核心概念与代码名称映射

| 核心概念 | 英文代称 | 本质 | 所属层 | 当前代码中的名称 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 页面定义对象 | `PageDefinition` | 页面脚本导出的普通对象 | JS Framework | `target`、`createPageVm` 的第一个参数 | `.ux` 脚本导出的原始页面对象 |
| 响应式页面控制器 | `ReactivePageController` | 带变更追踪和渲染调度的 JS 对象代理 | JS Framework | `Page VM`、`__qak_reactive_page_vm__`、`proxy` | 当前代码仍称 `Page VM`；不拥有 Runtime Tree |
| Binding 依赖元数据 | `BindingDependencyMetadata` | state/property 到 Binding 的反向索引 | JS Framework | `bindings[id].deps` | 决定哪些 Binding 需要重算 |
| 页面模板描述 | `PageTemplate` | 可实例化的静态 UI 结构定义 | C++ Core | `Page IR`、`PageTemplate` | 包含节点、Binding、Block、Handler 和稳定 ID |
| 运行时节点树 | `RuntimeTree` | 当前页面的唯一 UI 运行实例 | C++ Core | `RuntimeTree`、`RuntimeTreeStore` | 维护节点状态、父子关系和实际属性 |
| 渲染意图事务 | `RenderIntentTransaction` | 对 UI 变化的声明式操作集合 | JS Framework → C++ Runtime Service | `RenderIntentTransaction`、`submitRenderTransaction` | 描述属性更新和动态结构变化 |
| 挂载事务 | `MountTransaction` | 面向平台的具体 UI 变更指令 | C++ Core → Platform | `MountTransaction` | Core 布局后生成，供平台后端执行 |
