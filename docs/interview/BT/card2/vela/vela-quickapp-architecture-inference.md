# Vela QuickApp 架构推导

## 目录

- [1. 推导前提](#1-推导前提)
- [2. 总体架构](#2-总体架构)
- [3. 三层树](#3-三层树)
- [4. 状态更新](#4-状态更新)
- [5. 首次渲染](#5-首次渲染)
- [6. Bridge](#6-bridge)
- [7. 关键判断](#7-关键判断)

## 1. 推导前提

基于两个前提：

```text
1. Tree Diff 在 C++ 层
2. JS -> C++ 使用 JS Engine External Function
```

可以倒推出一种高度可能的架构。

## 2. 总体架构

```text
RPK / 页面 JS
-> JS Framework
-> External Function
-> C++ Runtime DOM
-> Tree Diff
-> Yoga Layout
-> LVGL Object Tree
```

## 3. 三层树

```text
JS：渲染意图树或节点描述
C++：旧 Runtime Tree + 新候选 Tree
LVGL：Host Object Tree
```

Diff 在 C++，意味着 C++ 至少要同时获得旧结构和新结构，或者接收足以构造新候选树的描述。

## 4. 状态更新

```text
State 修改
-> JS Framework 重新生成页面/组件渲染描述
-> External Function 把节点操作或新结构传给 C++
-> C++ 构造候选 Tree
-> 对旧 Tree 与候选 Tree 做 Diff
-> 更新 Runtime Tree
-> Yoga Layout
-> 更新 LVGL Object Tree
```

## 5. 首次渲染

```text
加载 RPK
-> QuickJS 执行页面 JS
-> JS Framework 执行模板和数据绑定
-> External Function 创建 C++ 节点
-> C++ 建立 Runtime Tree
-> Yoga 首次布局
-> 创建 LVGL Object Tree
-> 显示
```

## 6. Bridge

External Function 可能类似：

```cpp
createElement(type, props)
appendChild(parent, child)
setAttribute(node, key, value)
commit(root)
```

它避免 JSON 消息序列化，但仍有 JS Value 到 C++ Value 的转换和可能的数据复制。

## 7. 关键判断

如果 C++ 接收的是逐条 `create/update/remove`，严格说它可能不是“完整 Tree Diff”，而是 **C++ DOM 增量更新**。只有当 JS 提交新树或新子树、C++ 比较新旧结构时，才能确认 Diff 真正在 C++。

所以目前能高概率推导的是：

> **Vela QuickApp 用 External Function 把 JS 渲染描述送入 C++ Runtime DOM，再由 C++ 完成结构协调、Yoga 布局和 LVGL 渲染；但究竟是完整树 Diff、子树 Diff，还是增量 DOM 操作，还需要符号、调用日志或动态库行为验证。**
