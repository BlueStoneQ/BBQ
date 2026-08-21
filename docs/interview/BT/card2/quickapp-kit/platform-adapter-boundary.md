# Platform Adapter 边界

## 目录

- [1. 结论](#1-结论)
- [2. 所属层](#2-所属层)
- [3. 主要域](#3-主要域)
- [4. 数据流](#4-数据流)
- [5. 例子](#5-例子)

## 1. 结论

Platform Adapter 属于 Platform 层，由 Android、LVGL、iOS 各自实现。Core 只定义 typed Port 和平台无关消息，不包含 JNI、UIKit、LVGL 类型。

## 2. 所属层

```text
C++ Core
  -> 定义 Platform Port
  -> 输出 MountTransaction

Platform Adapter
  -> 执行 Host 操作
  -> 保存 NodeId -> NativeHandle 映射
  -> 上报标准 Platform Event
```

Adapter 不负责状态、Binding、Diff、路由或最终 Layout 决策。

## 3. 主要域

| 域 | 责任 |
|---|---|
| Surface | 页面容器的创建、展示、隐藏、关闭、销毁 |
| Mount | 节点创建、属性、布局、插入、移动、删除 |
| Input | 点击、输入等平台事件转换为标准消息 |
| Measure | 提供字体 metrics；Yoga 和最终 Rect 属于 Core |
| Capability | 实现 prompt、device 等平台能力 |
| Page Control | 标题栏、页面 metadata 等宿主控制 |

JNI、Objective-C++ Gateway、LVGL Backend 是平台基础设施，不进入 Core Port。

## 4. 数据流

```text
Core MountTransaction
  -> Platform Adapter
  -> Android View / LVGL Object / UIKit View

Android / LVGL / iOS Event
  -> Platform Adapter
  -> PlatformInputMessage
  -> C++ Core Event Router
```

## 5. 例子

Core 输出：

```text
UpdateProps {
  nodeId: 42,
  props: { text: "Hello" }
}
```

平台实现：

```text
Android: TextView.setText("Hello")
LVGL:   lv_label_set_text(label, "Hello")
iOS:    UILabel.text = "Hello"
```

三端共享 Core 的 `NodeId` 和事务语义，但各自管理 NativeHandle 和 UI 线程。
