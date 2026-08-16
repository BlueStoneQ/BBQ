# P0-CUT-001 定向校审入口

## 目录

- [1. 结论](#1-结论)
- [2. 校审目标](#2-校审目标)
- [3. 必读文件](#3-必读文件)
- [4. 必查问题](#4-必查问题)
- [5. 禁止扩张](#5-禁止扩张)
- [6. 输出要求](#6-输出要求)

## 1. 结论

本轮只校审 `P0-CUT-001`：**固定 C++ Runtime Kernel + 必选 JS Runtime Service + 编译期可组合外围。**

不重开已经通过的单树、typed Bridge、渲染、事件、线程、路由和平台顺序设计；只有发现本次变更造成真实冲突时才回归相关合同。

## 2. 校审目标

判断以下命题是否同时成立：

1. Bridge、Render、Event 三大系统及共同权威机制始终存在。
2. 三大系统仍按 JS/Core/Platform 分层，不被误写为全部属于 C++ Core。
3. 外围只依赖内核 Port，Platform Composition Root 是唯一产品组成点。
4. 未选模块及依赖在链接期移除，不以运行时开关伪装裁剪。
5. V1 Profile 保留 V1 基线；Custom Profile 可裁外围，但只能运行需求集合兼容的 Artifact。
6. Core 在执行 JS 前完成 Artifact/Profile 兼容性预检。
7. 该设计没有引入动态插件平台、配置中心或第二条 Bridge。
8. JS 执行能力必选，但具体 Engine Provider 可替换且不属于 C++ Kernel。

## 3. 必读文件

按顺序读取：

1. `v3/spec/requirements.md`
2. `v3/spec/design.md`
3. `v3/spec/tasks.md`
4. `v3/spec/acceptance.md`
5. `v3/spec/architecture.md`
6. `v3/spec/v1-scope-and-acceptance.md`
7. `v3/spec/contracts/runtime-composition-contract.md`
8. `v3/spec/contracts/schemas/runtime-composition.schema.json`
9. `v3/spec/contracts/error-contract.md`
10. `v3/AGENT-WORK-BOARD.md`
11. 八个项目的 `requirements.md`、`subspec-index.md`、`acceptance.md`、`AGENT-HANDOFF.md`

## 4. 必查问题

| 检查项 | 通过标准 |
|---|---|
| 内核边界 | 固定的是架构骨架；各层所有权不改变，不形成 C++ 单体 |
| 裁剪边界 | Platform/Backend/Provider/扩展 Component/diagnostic 可模块化选择；依赖只向内 |
| Profile 语义 | `conformance=v1` 保留 V1 基线；`custom` 允许裁剪；两者无合同冲突 |
| JS Engine | JS Framework 只依赖 `JsEnginePort`；V1 QuickJS 只是 Provider；一个 Profile 只链接一个 Manifest 指定的 Engine module |
| Bridge binding | 公共边界是 Native Function Binding + typed Runtime ABI；External Function 只属于 QuickJS V1 Provider |
| Manifest | 描述最终实际链接事实，不是可选模块目录；Core、Toolkit、Benchmark 的消费职责唯一 |
| 兼容预检 | Component 从 Page IR、Capability 从 Manifest.features 推导；不复制到 Runtime Metadata，不扫描 JS 文本 |
| 验收 | 双 LVGL Profile、link map/symbol/dependency、binary bytes、内存和负例可执行 |
| 项目归属 | Core 做预检；Platform 做 Composition Root；Toolkit 展示；Benchmark 测量；Examples 提供负例 |
| 范围 | 没有把动态插件、权限平台、AI、Skill/MCP 或完整性能平台带入 V1 |
| 门禁 | 当前为 `DESIGN_BLOCKED + CODE_BLOCKED`；只有本轮 PASS 后才恢复分 Spec 设计 |

执行：

```bash
cd v3/spec/contracts/schemas/tests
npm test
```

并检查相对 Markdown 链接、Schema catalog、Requirement/分 Spec/验收映射和当前状态词一致性。

## 5. 禁止扩张

本轮不得要求：

- 动态加载、卸载或远程插件。
- 通用 IDL/Codegen、插件市场或完整版本协商。
- 为所有未来组件和 Feature 预建接口。
- 把第二期事项提升为 V1 阻塞项。
- 因偏好差异重写已冻结的三大系统和单树架构。

## 6. 输出要求

输出到同目录 `2026-08-16-4th-review.md`，格式固定：

1. 结论先行：`PASS` 或 `CHANGES_REQUIRED`。
2. P0/P1/P2 问题按严重级排序，每条给出文件、行号、违反的冻结命题、最小修正。
3. 分别回答第 4 节十一项检查结果。
4. 报告命令与结果；不得只凭文字判断 Schema。
5. 若 P0/P1/P2 均为 0，明确写出：允许工作看板恢复八项目 `DESIGN_ALLOWED`；产品代码继续 `CODE_BLOCKED`。
