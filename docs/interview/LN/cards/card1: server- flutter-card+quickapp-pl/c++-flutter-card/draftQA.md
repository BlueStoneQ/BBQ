# C++ + Flutter 卡片框架 — QA Draft

> 聊透一个话题，再结构化整理。

## 目录

- [大纲 + card 分类](#大纲--card-分类)
- [1. 轻卡和 JS 卡的区别在哪一层](#1-轻卡和-js-卡的区别在哪一层)
- [2. 渲染管线](#2-渲染管线)
  - [2.1 渲染前端 vs 渲染后端](#21-渲染前端-vs-渲染后端)
  - [2.2 渲染后端拿到的是什么](#22-渲染后端拿到的是什么)
  - [2.3 DOM Tree vs RenderTree](#23-dom-tree-vs-rendertree)
  - [2.4 管线各阶段遍历](#24-管线各阶段遍历)
  - [2.5 每帧都要全量遍历吗](#25-每帧都要全量遍历吗)
  - [2.6 Yoga 的输入输出](#26-yoga-的输入输出)
  - [2.7 核心数据结构](#27-核心数据结构)
- [3. Flutter 轻卡首次渲染](#3-flutter-轻卡首次渲染)
  - [3.1 完整链路](#31-完整链路)
  - [3.2 核心数据结构](#32-核心数据结构)
  - [3.3 Flutter 渲染端设计](#33-flutter-渲染端设计)
  - [3.4 渲染管线走 FFI](#34-渲染管线走-ffi)
  - [3.5 Flutter 轻卡不需要 Yoga](#35-flutter-轻卡不需要-yoga)

---
## 大纲 + card分类
- flutter卡: 不需要yoga布局, flutter本身可以布局
    - 轻卡: 不需要
    - JS卡: 需要js引擎
- LVGL卡: 需要yoga布局, 适合IOT受限硬件, 例如手表眼镜
    - 轻卡
    - JS卡
- Native view卡: 渲染后端是 Android/IOS view
    - 轻卡
    - JS卡

### 纵览表格

| | Native View 渲染 | Flutter 渲染 | LVGL 渲染 |
|--|:---:|:---:|:---:|
| **轻卡** | JSON → Native View | JSON → Widget | JSON → Yoga + LVGL draw |
| **JS 卡** | QuickJS → DOM → Native View | QuickJS → DOM → Widget | QuickJS → DOM → Yoga + LVGL draw |
| **快应用（完整）** | V8/J2V8 → DOM → Native View | V8 → DOM → Widget | QuickJS/V8 → DOM → Yoga + LVGL draw |

me: 只要用CSS描述样式和位置的 都需要用yoga 


## 1. 轻卡和 JS 卡的区别在哪一层

### 轻卡 DSL 示例

```html
<template>
  <div class="box-style">
    <text class="text" @click="routerEvent">{{content}}</text>
  </div>
</template>

<data>
{
  "uiData": {
    "content": "轻卡示例"
  },
  "actions": {
    "routerEvent": {
      "type": "router",
      "url": "hap://app/com.example.quickapp/page",
      "params": {}
    }
  }
}
</data>

<style lang="less">
.box-style {
  width: 100%;
  height: 100%;
}
.text {
  font-size: 12px;
}
</style>
```

三段式：template（XML 布局）+ data（JSON 数据+事件声明）+ style（CSS 样式）。
和 JS 卡的区别：用 `<data>` 替代 `<script>`，没有 JS 逻辑。

### 区别在哪一层

差异只在**运行时层（渲染前端）**，引擎核心层和渲染后端层完全复用。

```
           轻卡                    JS 卡
应用层      template+data+style    template+script+style（.ux）
           ↓                      ↓
运行时层    模板解析+数据绑定        QuickJS 执行 JS + 响应式 + 生命周期
           (无 JS 引擎)            (有 JS 引擎)
           ↓                      ↓
  ─────────── 以下完全一样 ───────────
引擎核心层  C++ DOM + CSS + Yoga Layout
渲染后端层  Flutter / Android / LVGL
```

---

## 2. 渲染管线

### 2.1 渲染前端 vs 渲染后端

本质：**"渲染什么" vs "怎么画"**

| | 渲染前端 | 渲染后端 |
|--|---------|---------|
| 职责 | 产出要渲染的树结构 | 把树画到屏幕上 |
| 轻卡 | JSON 解析 → DOM 树 | Flutter/LVGL/Android |
| JS 卡 | QuickJS 执行 → 虚拟 DOM → DOM 树 | 同上 |
| 浏览器类比 | HTML 解析 + JS 执行 + DOM 构建 | Skia/GPU 合成 |
| RN 类比 | JS 层（React reconciler） | Native View / Fabric |

JS 引擎属于渲染前端 — 它的产出是"我要什么样的 DOM 树"，不关心画在哪里。

解耦价值：换后端不改前端逻辑，换前端不改渲染管线。

### 2.2 渲染后端拿到的是什么

取决于渲染后端的"智能程度"：

| 渲染后端 | 拿到的是 | 怎么画 |
|---------|---------|--------|
| LVGL | 渲染指令（drawRect/drawText） | 直接执行 |
| Flutter | 节点描述（type + layout + style） | 构建 Widget 树，Flutter 自己渲染 |
| Android Native View | 节点描述 → 创建对应 View | View 系统自己 measure/layout/draw |

本质：**渲染后端越"聪明"，给它的东西越抽象；渲染后端越"笨"，给它的东西越具体。**

### 2.3 DOM Tree vs RenderTree

| | DOM Tree | RenderTree |
|--|---------|-----------|
| 是什么 | 逻辑结构（"有什么节点"） | 视觉结构（"每个节点画在哪"） |
| 包含 | 节点类型、属性、父子关系、样式声明 | 节点 + 计算后的坐标(x,y,w,h) + 最终样式值 |
| 类比 | HTML DOM | 浏览器 Layout Tree |
| 差异 | `display:none` 的节点在 DOM 里 | RenderTree 里没有（不可见节点不进来） |

一句话：**DOM Tree 回答"有什么"，RenderTree 回答"画在哪"，渲染指令回答"怎么画"。**

### 2.4 管线各阶段遍历

```
DOM Tree 构建（渲染前端产出）
    ↓
遍历1: CSS 样式计算（层叠/继承/匹配）→ 每个节点拿到最终样式值
    ↓
遍历2: 过滤不可见节点 → 产出 RenderTree
    ↓
遍历3: Yoga Layout（输入：flexbox 属性 → 输出：原地写入 x,y,w,h）
    ↓
遍历4: 产出渲染指令 / 传给渲染后端
```

### 2.5 每帧都要全量遍历吗

不是。首次渲染完整遍历，后续更新是**增量**（dirty 标记，只重算脏节点）。

### 2.6 Yoga 的输入输出

Yoga 不产出新树，是**原地计算**：
- 输入：RenderTree 上每个节点的 flexbox 属性
- 输出：在同一个节点上写入 x, y, width, height

### 2.7 核心数据结构

```cpp
struct RenderNode {
    string type;             // "div", "text", "image"
    Style style;             // 样式属性
    LayoutResult layout;     // Yoga 计算后填入: x, y, w, h
    vector<RenderNode*> children;  // 子节点指针
};
```

和 JS 对象树概念一样，区别：JS 有 GC，C++ 手动管理（智能指针），无 GC 暂停。

---

## 3. Flutter 轻卡首次渲染

### 3.1 完整链路

```
轻卡 DSL（template + data + style）
    ↓ 编译期（hap-toolkit）
JSON 产物（模板树(json吗) + 数据 + 样式）
    ↓ C++ 运行时解析 + 数据绑定
虚拟 DOM Tree（C++ struct）
    ↓ FFI 传给 Dart
Dart 侧节点描述（List<CardNode>）
    ↓ 递归遍历构建 Widget
Flutter Widget Tree → 上屏
```

### 3.2 核心数据结构

传给 Flutter 的节点描述：

```dart
class CardNode {
  String type;          // "div", "text", "image"
  Map<String, dynamic> style;  // { "width": "100%", "fontSize": 12, "color": "#333" }
  String? text;         // type=="text" 时有值
  String? src;          // type=="image" 时有值
  Map<String, dynamic>? action;  // 点击事件（deeplink）
  List<CardNode> children;
}
```

### 3.3 Flutter 渲染端设计

本质就是低代码渲染 — 拿到描述树，递归 switch/case 映射成 Widget：

```dart
Widget renderNode(CardNode node) {
  switch (node.type) {
    case 'div':
      return Container(
        width: node.style['width'],
        height: node.style['height'],
        padding: parsePadding(node.style),
        child: node.style['flexDirection'] == 'row'
          ? Row(children: node.children.map(renderNode).toList())
          : Column(children: node.children.map(renderNode).toList()),
      );
    case 'text':
      return Text(node.text!, style: parseTextStyle(node.style));
    case 'image':
      return Image.network(node.src!, width: ..., height: ...);
  }
}
```

核心设计挑战：
1. 映射表完备性 — 所有 DSL type/style 都要有对应 Widget 映射
2. 增量更新 — 数据变了不全量重建，只更新脏节点
3. 性能 — 节点多时递归构建的开销控制

### 3.4 渲染管线走 FFI

FFI 优先。同步零拷贝，没有序列化开销。Platform Channel 需要 JSON 序列化 + 异步，没理由在渲染管线上用。

### 3.5 Flutter 轻卡不需要 Yoga

Flutter 有自己的布局系统（Row/Column/Flex/Stack），能力等价 Flexbox。C++ 层不需要算坐标，直接把节点描述传给 Dart，Flutter 自己布局 + 渲染。

Yoga 只在渲染后端没有布局能力时才需要（LVGL、Framebuffer 直绘）。

### 3.6 flutter轻卡渲染端本质
1. 本质就是用一个JSON型数据来描述flutter的页面结构
2. flutter的render端本质就是 来翻译这个JSON tree -> flutter页面数据结构

**样式计算底层：DOM Tree + Style Rules → RenderTree**

```
DOM Tree（只有结构）     Style Rules（CSS 规则集合）
     ↓                        ↓
     └──────── 匹配 ──────────┘
                ↓
     每个 DOM 节点找到自己匹配的样式规则
                ↓
     层叠（优先级排序：!important > inline > id > class > tag）
                ↓
     继承（color/font 等属性从父节点继承）
                ↓
     计算最终值（em→px, % →具体像素值）
                ↓
     过滤 display:none 的节点
                ↓
     RenderTree（每个节点带最终样式值）
```

用轻卡的例子：
```
DOM 节点: <text class="text">轻卡示例</text>
Style Rules: .text { font-size: 12px; }

匹配后 RenderNode:
{
  type: "text",
  content: "轻卡示例",
  computedStyle: { fontSize: 12, color: inherit(父节点) }
}
```

样式计算这部分是自己写的 C++ 代码（轻卡场景 CSS 在编译期已变成 JSON，运行时只需遍历匹配，比浏览器完整 CSS 引擎简单很多）。

### 3.7 渲染公式

- **RenderTree = DOM Tree（结构）+ Style 计算结果（样式）+ 数据绑定（真实值填入）- 不可见节点**
- 轻卡: 

```
DOM Tree:     <text class="text">{{content}}</text>
Style:        .text { font-size: 12px }
Data:         { content: "轻卡示例" }

↓ 合并

RenderTree节点:
{
  type: "text",
  content: "轻卡示例",        ← 数据绑定：{{content}} 替换为真实值
  computedStyle: { fontSize: 12 },  ← 样式计算结果
}

```

### 3.8 轻卡交互
- 官方: https://www.quickapp.cn/document?menu=2%252C143&pathUrl=%252Fdoc%252Flitewidget%252Fguide%252Freference%252Fapp-service%252Fevent-on.html%2523%2525E8%2525B7%2525B3%2525E8%2525BD%2525AC%2525E4%2525BA%25258B%2525E4%2525BB%2525B6-router

- 

## JS卡: flutter卡
### 背景: 轻卡 和 JS卡 场景选型

轻卡 = 纯展示 + 有限预定义交互（router/message/proxy），不具备自定义编程能力。

| | 轻卡 | JS 卡 |
|--|------|-------|
| 逻辑能力 | 无（声明式 actions） | 有（QuickJS 执行 JS） |
| 事件 | 只有 click/change，action 预定义 | 任意事件 + 自定义 handler |
| 数据 | 静态 JSON 绑定 | 动态计算、网络请求、条件判断 |
| 响应式 | 无 | 有（数据变 → UI 自动更新） |
| 生命周期 | 无 | 有（onInit/onReady/onDestroy） |
| 适用场景 | 天气/通知/快捷入口等静态卡片 | 复杂交互/动态内容/第三方开发者扩展 |
| 引擎依赖 | 不需要 JS 引擎 | 需要 QuickJS（C 库） |

选型判断：能用轻卡就用轻卡（开销小、确定性强），需要逻辑才上 JS 卡。

### 壁垒和优势分析

**岗位壁垒不在单点技术，在组合 + 判断力：**

1. **做过的人少** — 大部分 Flutter 开发者没碰过 Server-Driven UI
2. **工程完整度** — 不只是画出来：增量更新、事件系统、多端协议一致性、可观测、性能优化
3. **架构判断力** — 什么场景轻卡、什么场景 JS 卡、什么时候上 LVGL，trade-off 能讲清
4. **早期 Demo 能力** — JD 要求"需求不完整时推动落地"，要全栈 + 快速交付 + 产品判断

**LN JD 重点稀缺度：**

| JD 重点 | 稀缺度 |
|---------|:---:|
| Flutter App 开发（手机端） | 低 |
| Server-Driven UI / JSON 协议驱动渲染 | 高 |
| 受限硬件渲染（眼镜端） | 很高 |
| Flutter + Native 混合架构 | 中 |
| AI Agent / MCP | 中高 |
| 跨设备协议设计（手机→眼镜复用） | 很高 |

**我的核心稀缺性 = Server-Driven UI 完整方案 + 受限硬件渲染经验，这两个组合市场上极少。**
