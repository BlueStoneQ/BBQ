# bridge
## js-bridge
- js -> c++
    - external obj.func
    - 参数传递：
        - 普通值：js类型 转为 CPP 层
        - 大数据 走 arraybuffer 共享内存
- c++ -> js
    - global.method/val

## platform-bridge
```
核心：
platform-adapter
core需要提供接口设计（虚函数？），platform-adapter需要实现这些接口
```
- android: JNI
- 嵌入式LVGL端： C++ SO/a 同语言调用
- IOS: framework，桥接，同语言调用

# 渲染管线
## 首次渲染
- js层：tpl ——构建/编译-> renderIntentTree(vDOMTree) -> sendRenderIntentTransaction
- CPP层：-> 执行事务，构造vNodeTree -> sendRenderTrasaction
- platform层：-> 构建host tree
## update
- js层：this.xxx = b -proxy> component-watcher: update
    this.xxx = b
    -> Component State Proxy.set -> 写入状态
    -> 找到依赖 StatePath(xxx) 的 Binding
    -> 标记 Binding Dirty
    -> Microtask 批量求值
    -> [RenderTransaction](#render-transaction)
- cpp层: 
    - 收到RenderTransaction
    - 构建一个new-vnodeTree？还是直接上手改vNodeTree？
    - 发给platform层是什么呢？还是MountTransaction吗
- platform层
    - 收到cppRenderTransaction

# 事件系统
## 事件注册
## 事件触发


# 构建工具：toolkit


# platform
## Android
## 嵌入式LVGL
## IOS

# 注释
<a id="render-transaction"></a>

- RenderTransaction: 
```js
RenderTransaction {
  surfaceId: 1,
  revision: 8,
  intents: [
    UpdateProp {
      nodeId: 12,
      propId: Text,
      value: "hello"
    }
  ]
}
```

- binding概念：
- 一个 ComponentInstance
  -> 多个 Binding
- 一个 state 字段
  -> 可能影响多个 Binding
- 一个 Binding
  -> 对应一个动态表达式及其渲染目标


- js层只管状态，尽可能计算都下沉到C++：
    this.xx = b
    -> JS 捕获状态变化
    -> StateTransaction(StateId.xx, b)
    -> C++ RenderStateStore
    -> DependencyTable 找到 Dirty Binding
    -> Binding VM 求值
    -> 更新 Runtime Tree
    -> Style/Layout
    -> MountTransaction
    -> Platform

- JS 层没有完整 VNode Tree，也不遍历完整 VNode Tree；C++ 层保留 Runtime Tree，只在结构、样式和布局需要时局部遍历。
    - 取消的是 JS VNode Tree 和新旧树遍历；保留的是 C++ Runtime Tree，并且只按 NodeId 定位或按 Dirty 范围局部遍历。

- JS + C++ Runtime 两层合起来，只有 C++ 的一棵权威渲染树。

- 沿用“每页独立入口、跳转时加载执行页面 JS”；不沿用“每页复制全部依赖”。
    - QuickApp Kit 以页面作为按需加载与生命周期单位，以模块作为共享与缓存单位；页面跳转执行目标页面入口，但公共依赖在同一 App JS Runtime 内只加载并执行一次。


