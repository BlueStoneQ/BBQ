## tree定义
Page IR 静态模板tree = 有根有序语义树的归一化表
Runtime Tree          = C++ Core 唯一可变权威运行时树
Host Tree             = Platform 平台对象映射

## update渲染管线
State 修改
-> JS 标记 Dirty Binding/Block
-> Microtask 批量求值
-> RenderTransaction
-> Core 解析 Page IR 定位 Runtime Node
-> staged change + Layout/Measure
-> 原子提交 Runtime Tree
-> MountTransaction
-> Platform 更新 Host Tree

## 首次渲染管线
加载 RPK、Page IR 和 JS Bundle
-> 创建 App/Page VM
-> JS 求值初始 Binding/Block/Handler
-> InstantiateTemplate
-> Core 根据 Page IR 创建 Runtime Tree
-> Style/Layout/Measure
-> full MountTransaction
-> Platform 在隐藏 Surface 创建 Host Tree
-> Present Surface
∏∏∏