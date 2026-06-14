# aria-render — 需求文档

## 目录

- [一、项目定位](#一项目定位)
- [二、核心问题](#二核心问题)
- [三、目标用户](#三目标用户)
- [四、功能需求](#四功能需求)
  - [P0：MVP 必须](#p0mvp-必须)
  - [P1：Demo 加分](#p1demo-加分)
  - [P2：远期扩展](#p2远期扩展)
- [五、非功能需求](#五非功能需求)
- [六、验收标准](#六验收标准)

---

## 一、项目定位

一个轻量级 Server-Driven UI 渲染引擎：

```
JSON DSL 协议 → Rust 解析引擎 → Flutter 渲染后端 → 跨平台运行
```

面向资源受限设备（AR 眼镜、IoT、穿戴设备），核心卖点：
- 协议驱动，无需重新编译即可动态更新 UI
- Rust 引擎零 GC，内存可控
- Flutter 渲染跨平台（Android / Desktop / 未来 embedded）

## 二、核心问题

> 在受限硬件环境中，如何通过 JSON 协议描述 UI，并实现高性能动态渲染 + 数据级局部刷新？

对标场景：
- AR 眼镜上的技能卡片渲染
- IoT 设备的信息展示面板
- 手机 App 中的 Server-Driven 动态页面

## 三、目标用户

| 用户角色 | 需求 |
|---------|------|
| 前端/客户端开发者 | 通过 JSON DSL 描述 UI，无需编译发版 |
| 后端/AI 服务 | 下发 JSON 协议控制客户端展示 |
| 架构评估者（面试官） | 快速理解系统设计能力和技术深度 |

## 四、功能需求

### P0：MVP 必须

| ID | 需求 | 验收标准 |
|----|------|---------|
| R1 | JSON 协议定义卡片结构（嵌套布局 + 文本 + 图片 + 样式） | 有 JSON Schema，支持 div/text/image 三种基础组件 |
| R2 | Rust 引擎解析 JSON → 节点树 | 解析 5 个示例卡片 JSON 无报错 |
| R3 | Flexbox 布局计算 | 支持 flex-direction / justify-content / align-items / padding / margin / width / height |
| R4 | 响应式数据绑定 | 支持 `{{variable}}` 表达式，数据变更时局部更新对应节点 |
| R5 | 增量更新协议 (FrameUpdate) | 数据推送后只更新变化的节点属性，不全量重建 |
| R6 | Flutter 渲染后端 | 通过 Dart FFI 调用 Rust .so，FrameUpdate → Widget 树增量重建 |
| R7 | Demo App 跑通 | Android/Linux Desktop 启动后展示 3 个示例卡片 |

### P1：Demo 加分

| ID | 需求 | 说明 |
|----|------|------|
| R8 | 热更新演示 | App 运行中推送新 JSON → 实时看到 UI 变化 |
| R9 | 事件系统 | 支持 tap 事件绑定 + 回调 |
| R10 | 条件渲染 | 支持 `$if` / `$show` 指令 |
| R11 | 列表渲染 | 支持 `$for` 指令遍历数组 |

### P2：远期扩展（不在 MVP 范围）

| ID | 需求 |
|----|------|
| R12 | 自定义组件系统（Props / Slot） |
| R13 | CSS 动画 / 过渡 |
| R14 | JS 引擎集成（ViewModel 驱动） |
| R15 | 多渲染后端（Web / Android Native） |

## 五、非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 首次渲染 < 16ms（60fps），增量更新 < 5ms |
| 内存 | 引擎本身 < 2MB RSS（空载） |
| 包体积 | Rust .so < 1MB (stripped, release) |
| 可维护 | 模块清晰分层，单元测试覆盖核心逻辑 |
| 文档 | README 有架构图 + 运行 GIF + 快速上手 |

## 六、验收标准

MVP 完成标准：
1. `flutter run` 启动 Demo App，展示 3 个示例卡片
2. 运行时推送新数据 JSON，UI 局部刷新（不闪烁、不全量重建）
3. README 清晰，新人 5 分钟内能 clone + run
4. 有至少一个录屏 GIF 展示效果
