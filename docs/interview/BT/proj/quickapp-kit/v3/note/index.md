# QuickApp Kit V3 技术笔记

## 核心文档
- [QA 问答](qa.md) - 关键技术问题与答案
- [Runtime Tree 数据结构](runtime-tree.md) - C++ 底层实现

## 架构图核心理解
围绕 QuickApp Kit 架构图展开，聚焦三大核心：

### runtime 核心
├─ 状态中枢：Runtime Tree（唯一权威可变树，单一事实源，ID 寻址驱动）
├─ 通信底座：bridge（typed ABI + Transaction，贯穿所有子系统）
└─ 三条核心链路（都围绕 Tree、都走 bridge）：
   ├─ 渲染管线：怎么改这棵树（Render→Tree/Layout/Measure→Mount）
   ├─ 事件系统：外部输入怎么进来、怎么寻址到树上的节点、怎么回调 JS
   └─ 生命周期/导航：树/页面的创建、切换、销毁

## 外部索引
- [上级索引](../../../../BT/index.md)
- [根索引](../../../../INDEX.md)

## 学习路径
1. 先理解架构图整体框架
2. 深入 Runtime Tree（状态中枢）
3. 掌握 bridge + 三条核心链路
4. 扩展到 toolkit、feature、平台适配