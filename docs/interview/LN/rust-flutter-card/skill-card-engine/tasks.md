# skill-card-engine — 任务拆解

## 目录

- [阶段概览](#阶段概览)
- [Phase 1：引擎核心 (Day 1-3)](#phase-1引擎核心-day-1-3)
- [Phase 2：Flutter 渲染 + Demo (Day 4-5)](#phase-2flutter-渲染--demo-day-4-5)
- [Phase 3：交互 + 打磨 (Day 6-7)](#phase-3交互--打磨-day-6-7)
- [依赖关系](#依赖关系)

---

## 阶段概览

| 阶段 | 时间 | 交付物 | 里程碑 |
|------|------|--------|--------|
| Phase 1 | Day 1-3 | 引擎核心：JSON 解析 + 表达式 + 响应式 diff | `dart test` 全绿 |
| Phase 2 | Day 4-5 | Flutter 渲染 + 5 个卡片跑通 | `flutter run` 看到卡片 |
| Phase 3 | Day 6-7 | 事件交互 + README + GIF | GitHub 发布 |

---

## Phase 1：引擎核心 (Day 1-3)

### Task 1.1：项目脚手架

- [ ] 创建 Flutter package（`flutter create --template=package skill_card_engine`）
- [ ] 创建 example/ Flutter App 项目
- [ ] 定义 pubspec.yaml（无外部依赖，只用 dart:convert）
- [ ] 验证：`flutter test` 空项目通过

### Task 1.2：协议定义

- [ ] `lib/src/protocol/card_definition.dart` — CardDefinition / NodeDefinition
- [ ] `lib/src/protocol/action_def.dart` — ActionDef（navigate/updateData/callback）
- [ ] `lib/src/protocol/directive.dart` — Directive 枚举（if/for/show）
- [ ] `lib/src/protocol/prop_value.dart` — PropValue（static / expression + deps 提取）
- [ ] 编写 5 个示例卡片 JSON 放 `example/assets/cards/`
- [ ] 验证：数据结构定义完整，无编译错误

### Task 1.3：Parser

- [ ] `lib/src/engine/parser.dart` — `CardDefinition parse(String json)`
- [ ] 解析 template 树：递归构建 NodeDefinition
- [ ] 识别 `{{xxx}}` 标记为 expression 类型，提取 deps
- [ ] 解析 `$if` / `$for` / `$show` 指令
- [ ] 解析 events 字段 → ActionDef
- [ ] 单元测试：5 个示例 JSON 全部解析成功
- [ ] 验证：`dart test test/parser_test.dart` 通过

### Task 1.4：Expression 引擎

- [ ] `lib/src/engine/expression.dart` — ExpressionEngine
- [ ] `evaluate(template, data)` — 替换 `{{path}}` 为实际值
- [ ] 支持嵌套路径：`{{object.field}}`、`{{array[0].name}}`
- [ ] 支持 $for 循环变量：`{{item.name}}`（在上下文中注入 item）
- [ ] `evaluateBool(expr, data)` — 布尔求值（`{{x > 0}}`、`{{flag}}`）
- [ ] `extractDeps(template)` — 提取依赖路径列表
- [ ] 单元测试：路径解析、嵌套、循环变量、布尔
- [ ] 验证：`dart test test/expression_test.dart` 通过

### Task 1.5：Reactive 数据 diff

- [ ] `lib/src/engine/data_diff.dart` — `List<String> diff(old, new)`
- [ ] 递归比较 JSON，产出变更路径列表（如 `["temp", "forecast[0].weather"]`）
- [ ] `lib/src/engine/reactive.dart` — ReactiveEngine
- [ ] `register(nodeId, deps)` — 注册节点依赖
- [ ] `onDataChanged(changedPaths) → Set<nodeId>` — 查询 dirty 节点
- [ ] 单元测试：数据变更 → 正确识别受影响节点
- [ ] 验证：`dart test test/reactive_test.dart` 通过

---

## Phase 2：Flutter 渲染 + Demo (Day 4-5)

### Task 2.1：Style 映射

- [ ] `lib/src/renderer/style_mapper.dart`
- [ ] JSON style → Flutter 属性映射：
  - width/height → SizedBox 或 Container constraints
  - padding/margin → EdgeInsets
  - color/background → Color
  - fontSize/fontWeight → TextStyle
  - borderRadius → BoxDecoration
  - justifyContent/alignItems → MainAxisAlignment/CrossAxisAlignment
- [ ] 验证：常见样式属性正确映射

### Task 2.2：Node Builder

- [ ] `lib/src/renderer/node_builder.dart` — 递归构建 Widget
- [ ] column → Column
- [ ] row → Row
- [ ] stack → Stack
- [ ] text → Text (表达式求值后)
- [ ] image → Image.network
- [ ] button → ElevatedButton / InkWell
- [ ] spacer → Spacer
- [ ] `$if` → 求值为 false 返回 SizedBox.shrink()
- [ ] `$for` → 展开为 List<Widget>
- [ ] `$show` → Visibility / Offstage
- [ ] 验证：weather.json 能渲染出可视 Widget 树

### Task 2.3：CardRenderer Widget

- [ ] `lib/src/renderer/card_renderer.dart` — 顶层 StatefulWidget
- [ ] 接收 CardDefinition + data + onAction 回调
- [ ] `pushData(newData)` 方法：diff → reactive → setState
- [ ] build 时传入当前 data 到 node_builder
- [ ] 验证：构建 CardRenderer(card: ..., data: ...) 不报错

### Task 2.4：Demo App

- [ ] `example/lib/main.dart` — TabBar 切换 5 个卡片
- [ ] 每个 tab 加载对应 JSON → CardRenderer 渲染
- [ ] "推送数据"按钮：修改 data → 调用 pushData → 看到 UI 变化
- [ ] 验证：`flutter run` Android + Desktop 双端展示正常

### Task 2.5：热更新演示

- [ ] 加一个文本输入框，可以修改 JSON data 字段
- [ ] 实时预览效果（类似 CodePen）
- [ ] 验证：改 JSON 字段值 → Widget 即时更新

---

## Phase 3：交互 + 打磨 (Day 6-7)

### Task 3.1：事件系统

- [ ] node_builder 为带 events 的节点包裹 GestureDetector
- [ ] tap → 查找 events["tap"] → 构造 ActionDef
- [ ] 通过 onAction 回调传给宿主
- [ ] Demo 中实现 navigate action → 打印/跳转
- [ ] 验证：点击按钮触发 action 回调

### Task 3.2：updateData Action

- [ ] action type = "updateData" → 修改 currentData 指定 path
- [ ] 触发 pushData 流程 → UI 自动更新
- [ ] Demo：点击"切换城市"按钮 → 天气卡片数据变化
- [ ] 验证：交互闭环跑通

### Task 3.3：公开 API 封装

- [ ] `lib/skill_card_engine.dart` — 导出干净的公开 API
- [ ] `SkillCardEngine.parse(json)` → CardDefinition
- [ ] `CardRenderer` Widget
- [ ] `ActionDef` 类型
- [ ] 验证：外部项目能 `import 'package:skill_card_engine/skill_card_engine.dart'`

### Task 3.4：README + 文档

- [ ] README.md：一句话定位 + 架构图 + Features + Quick Start
- [ ] 录制 Demo GIF（3 个场景：加载/刷新/交互）
- [ ] CHANGELOG.md
- [ ] LICENSE (MIT)
- [ ] 验证：README 可读，GIF 能看到效果

### Task 3.5：发布

- [ ] GitHub repo 创建
- [ ] 推送代码 + tag v0.1.0
- [ ] （可选）发布到 pub.dev
- [ ] 验证：`git clone` + `flutter run` 一步跑通

---

## 依赖关系

```
Task 1.1 → 1.2 → 1.3 → 1.4 → 1.5
                                 │
                                 ↓
Task 2.1 → 2.2 → 2.3 → 2.4 → 2.5
                                 │
                                 ↓
Task 3.1 → 3.2 → 3.3 → 3.4 → 3.5
```

关键路径：1.3(Parser) → 1.4(Expression) → 2.2(NodeBuilder) → 2.4(Demo)

Phase 1 和 Phase 2 之间有硬依赖（引擎完成后才能渲染）。Phase 3 的文档(3.4)可以和交互(3.1)并行。
