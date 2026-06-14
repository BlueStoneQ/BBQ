# aria-render — 任务拆解

## 目录

- [阶段概览](#阶段概览)
- [Phase 1：引擎核心（W1）](#phase-1引擎核心w1)
- [Phase 2：Flutter 渲染 + Demo（W2）](#phase-2flutter-渲染--demow2)
- [Phase 3：打磨 + 开源（W3）](#phase-3打磨--开源w3)
- [依赖关系](#依赖关系)

---

## 阶段概览

| 阶段 | 时间 | 交付物 | 关键里程碑 |
|------|------|--------|-----------|
| Phase 1 | W1 (5天) | Rust 引擎能解析 JSON → 布局 → 生成 FrameUpdate | `cargo test` 全绿 |
| Phase 2 | W2 (5天) | Flutter App 渲染 3 个卡片 + 数据推送刷新 | `flutter run` 看到卡片 |
| Phase 3 | W3 (3天) | README + 文档 + Demo GIF + GitHub 发布 | 链接可分享 |

---

## Phase 1：引擎核心（W1）

### Task 1.1：项目脚手架
- [ ] 创建 Rust workspace（engine crate, cdylib 输出）
- [ ] 添加依赖：taffy 0.7, serde_json, log
- [ ] 定义 types.rs 公共类型（NodeId, NodeType, ComputedLayout）
- [ ] 验证：`cargo build` 通过

### Task 1.2：协议定义
- [ ] 定义 JSON Schema（protocol/schema.json）
- [ ] 编写 3 个示例卡片 JSON（weather / music / notification）
- [ ] 验证：JSON 能通过 schema 校验

### Task 1.3：Parser 模块
- [ ] 实现 `parse_card(json: &str) -> Result<CardDef, Error>`
- [ ] CardDef = { data: JsonValue, template: NodeDef }
- [ ] NodeDef = { node_type, style, props, children, directives }
- [ ] 处理 `{{expr}}` 识别为 Expression 类型
- [ ] 单元测试：3 个示例 JSON 解析成功

### Task 1.4：Style + Layout 模块
- [ ] StyleProps 结构定义（width/height/padding/margin/flex-direction/justify/align/bg-color/font-size/color）
- [ ] style.rs：JSON style object → StyleProps
- [ ] layout.rs：NodeTree → Taffy Style 映射 → compute_layout
- [ ] 单元测试：column 嵌套 row，验证计算出的 x/y/w/h 正确

### Task 1.5：响应式系统
- [ ] reactive.rs：dep_map (HashMap<String, Vec<WatcherId>>)
- [ ] Watcher 结构：{ id, expr, target_node_id, target_field, last_value }
- [ ] 首次渲染时注册 watchers（扫描所有 Expression props）
- [ ] `json_diff(old, new) -> Vec<String>` 变更路径检测
- [ ] `collect_dirty_watchers(changed_paths) -> Vec<WatcherId>`
- [ ] `execute_watcher(id)` 重新求值 + 生成 patch
- [ ] 单元测试：推送新 data，验证只有变更节点被 patch

### Task 1.6：FrameUpdate 生成
- [ ] update.rs：Mutation / NodePatch / FrameUpdate 定义
- [ ] 首次渲染 → 生成全量 Mutation::NodeAdded
- [ ] push_data → 生成 NodePatch（仅变更字段）
- [ ] FrameUpdate 序列化为 JSON（FFI 传递用）
- [ ] 单元测试：完整流程 load → push → 验证 FrameUpdate 内容

### Task 1.7：FFI 导出
- [ ] lib.rs：`aria_init / aria_load_card / aria_push_data / aria_get_frame_update / aria_destroy`
- [ ] catch_unwind 包裹防止 panic 跨 FFI
- [ ] 内存安全：字符串通过 ptr+len 传递，FrameUpdate 用引擎内部 buffer
- [ ] 验证：编译产出 .so，nm 能看到导出符号

---

## Phase 2：Flutter 渲染 + Demo（W2）

### Task 2.1：Flutter 项目脚手架
- [ ] 创建 Flutter project（flutter_app/）
- [ ] 配置 native/ 目录存放 .so
- [ ] CMakeLists.txt 或 build script 复制 .so 到产物目录
- [ ] 验证：`flutter run` 空白 App 启动

### Task 2.2：Dart FFI 绑定
- [ ] aria_bindings.dart：DynamicLibrary 加载 + 所有 FFI 函数声明
- [ ] AriaEngine class 封装：init() / loadCard(json) / pushData(json) / getFrameUpdate() / destroy()
- [ ] 错误处理（返回码映射）
- [ ] 验证：Dart 调用 aria_init + aria_load_card 不 crash

### Task 2.3：Renderer 核心
- [ ] aria_renderer.dart：管理 nodeMap (id → Widget 描述)
- [ ] applyUpdate(FrameUpdate)：处理 mutations + patches
- [ ] node_widget.dart：根据 NodeSnapshot 构建 Widget（Container / Text / Image）
- [ ] 布局使用绝对定位（Positioned in Stack），坐标来自 FrameUpdate
- [ ] 验证：load 一个卡片 JSON → 屏幕上看到 Widget

### Task 2.4：Demo 页面
- [ ] card_gallery.dart：展示 3 个示例卡片（tab 切换）
- [ ] hot_reload_demo.dart：输入框输入新 data JSON → 点击"推送" → 实时更新
- [ ] 验证：完整操作流程可运行

### Task 2.5：事件系统（P1）
- [ ] Flutter 侧：GestureDetector 包裹 Widget → 获取 node_id → 调用 FFI dispatch_event
- [ ] Rust 侧：event.rs 简单路由（node_id + event_type → action）
- [ ] 验证：点击卡片某个区域，触发数据变更，UI 更新

---

## Phase 3：打磨 + 开源（W3）

### Task 3.1：README
- [ ] 一句话定位
- [ ] 架构图（ASCII art）
- [ ] Features 列表
- [ ] Quick Start（3 步跑起来）
- [ ] Demo GIF（录屏转 GIF）
- [ ] 技术栈 badge

### Task 3.2：文档
- [ ] docs/architecture.md（对外版，精简）
- [ ] docs/protocol-spec.md（DSL 协议规范）
- [ ] docs/design-decisions.md（关键 trade-off 说明）

### Task 3.3：发布
- [ ] GitHub repo 创建
- [ ] LICENSE (MIT)
- [ ] .gitignore
- [ ] CI（GitHub Actions：cargo test + cargo build --release）
- [ ] Release：tag v0.1.0

---

## 依赖关系

```
Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4 → Task 1.5 → Task 1.6 → Task 1.7
                                                                          │
Task 2.1 ──────────────────────────────────────────────────────────────────┤
                                                                          │
Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4 → Task 2.5                    │
                                                                          │
Task 3.1 + Task 3.2 + Task 3.3（Phase 2 完成后并行）                       │
```

关键路径：1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 2.2 → 2.3 → 2.4
