# skill-card-engine — 需求文档

## 目录

- [一、项目定位](#一项目定位)
- [二、核心问题](#二核心问题)
- [三、用户角色](#三用户角色)
- [四、功能需求](#四功能需求)
  - [P0 MVP](#p0-mvp)
  - [P1 交互增强](#p1-交互增强)
  - [P2 远期](#p2-远期)
- [五、非功能需求](#五非功能需求)
- [六、验收标准](#六验收标准)

---

## 一、项目定位

一个 **纯 Flutter/Dart** 实现的 Server-Driven UI 卡片渲染引擎：

```
JSON 卡片协议（后端/AI 下发）→ Dart 解析引擎 → Flutter Widget 树 → 跨端渲染
```

- 面向 AR 眼镜 / 手机 / 桌面的技能卡片渲染场景
- 纯 Dart 实现，无 Native 依赖，一套代码跑全平台
- 轻量级 MVP，一周可交付，后续可渐进演进

## 二、核心问题

> 如何让后端/AI 通过 JSON 协议动态控制客户端 UI，无需发版即可更新卡片内容和交互？

对标场景：
- AR 眼镜上展示"技能卡片"（导航/天气/翻译/消息）
- 手机 App 中的技能流程看板和卡片预览
- AI Agent 生成的技能输出结果展示

## 三、用户角色

| 角色 | 与引擎的关系 |
|------|-------------|
| 后端/AI 服务 | 产出 JSON 卡片协议，下发给客户端 |
| 客户端开发者 | 集成引擎，将 JSON 渲染为 Flutter Widget |
| 可视化编辑器 | 拖拽生成 JSON（未来） |
| 最终用户 | 看到并交互卡片 UI |

注意：**开发者和用户都不手写 JSON**。JSON 是机器间的通信格式。

## 四、功能需求

### P0 MVP

| ID | 需求 | 验收标准 |
|----|------|---------|
| R1 | 卡片协议定义 | 支持 column/row/stack/text/image/button 六种基础组件 |
| R2 | 样式系统 | 支持 width/height/padding/margin/color/fontSize/borderRadius/alignment |
| R3 | 数据绑定 | 支持 `{{variable}}` 和 `{{object.field}}` 表达式 |
| R4 | 条件渲染 | 支持 `$if` 指令，表达式为 false 时不渲染 |
| R5 | 列表渲染 | 支持 `$for` 指令，遍历数组生成多个子项 |
| R6 | 数据推送刷新 | 推送新 JSON data → 只更新变化的 Widget（不全量重建） |
| R7 | Flutter 渲染 | JSON → Widget 树，支持 Android/iOS/Desktop |
| R8 | Demo App | 展示 5 个示例卡片 + 热更新演示 |

### P1 交互增强

| ID | 需求 | 说明 |
|----|------|------|
| R9 | 事件系统 | 支持 tap/longPress 事件绑定 |
| R10 | Action 系统 | 支持 navigate/updateData/showDialog 三种 action |
| R11 | 动画 | 支持 entry animation（fade/slide） |
| R12 | 表单组件 | 支持 input/switch/slider |
| R13 | 主题 | 支持 light/dark 主题切换 |

### P2 远期

| ID | 需求 |
|----|------|
| R14 | 自定义组件注册（开发者扩展） |
| R15 | Native 下沉接口（预留 FFI 扩展点） |
| R16 | 可视化卡片编辑器 |
| R17 | 离线缓存 + 增量更新 |

## 五、非功能需求

| 维度 | 要求 |
|------|------|
| 首次渲染 | < 8ms（50 个节点的卡片） |
| 增量刷新 | < 3ms（数据变更后） |
| 包体积增量 | < 200KB（引擎代码，不含 Flutter 框架本身） |
| 依赖 | 零外部依赖（纯 Dart，不依赖第三方 pub package） |
| 测试 | 核心模块（parser/expression/reactive）单元测试覆盖 |

## 六、验收标准

MVP 完成标准：
1. `flutter run` 启动 Demo App，展示 5 个示例卡片（天气/导航/通知/列表/条件）
2. 点击"推送数据"按钮 → 卡片局部刷新（不闪烁）
3. JSON 修改 → 实时看到 UI 变化
4. Android + Linux Desktop 双端跑通
5. README 有架构图 + GIF + 5 分钟跑通指南
