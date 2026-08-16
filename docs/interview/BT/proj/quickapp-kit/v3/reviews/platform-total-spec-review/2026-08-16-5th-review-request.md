# QuickApp Kit v3 第五次定向复核入口

## 目录

- [1. 结论](#1-结论)
- [2. 复核范围](#2-复核范围)
- [3. 必读文件](#3-必读文件)
- [4. 四项通过条件](#4-四项通过条件)
- [5. 自动校验](#5-自动校验)
- [6. 禁止扩张](#6-禁止扩张)
- [7. 输出要求](#7-输出要求)

## 1. 结论

本轮只复核第四次报告中的 2 个 P1、2 个 P2 是否闭环；不得重开已经冻结的 Runtime Tree、Bridge、渲染、事件、线程、路由和平台顺序。

通过标准：P0/P1/P2 均为 0。通过后允许工作看板恢复八个项目第一批分 Spec 的 `DESIGN_ALLOWED`；产品代码继续 `CODE_BLOCKED`。

## 2. 复核范围

1. Runtime Composition Manifest 能否证明必选 JS Framework 已进入最终链接。
2. QuickJS External Function 是否只归 QuickJS Provider 所有。
3. 七个受影响项目是否直接读取 Runtime Composition Contract 与 Schema。
4. 单 Engine 语义是否有直接双 Engine 负例。

## 3. 必读文件

1. `v3/reviews/platform-total-spec-review/2026-08-16-4th-review.md`
2. `v3/spec/contracts/runtime-composition-contract.md`
3. `v3/spec/contracts/schemas/runtime-composition.schema.json`
4. `v3/spec/contracts/schemas/tests/fixtures.mjs`
5. `v3/spec/contracts/schemas/tests/validate-schemas.mjs`
6. `v3/spec/contracts/capability-module-contract.md`
7. `v3/projects/quickapp-runtime-js/spec/requirements.md`
8. `v3/projects/quickapp-runtime-js/spec/subspec-index.md`
9. 三个平台项目的 `spec/acceptance.md`
10. 八个项目的 `spec/AGENT-HANDOFF.md`
11. `v3/AGENT-WORK-BOARD.md`、`v3/spec/tasks.md`、`v3/spec/README.md`

## 4. 四项通过条件

| 原问题 | 必须证明 |
|---|---|
| P1-001 | 合同、Schema、正例和语义校验均要求 `runtime.js-framework(category=runtime)` 恰好一次；三个平台验收要求 Manifest 与 link map/symbol inventory 对应。 |
| P1-002 | 公共边界只有 `JsEnginePort Native Function Binding + typed Runtime ABI`；JS-S01 唯一拥有 QuickJS External Function Adapter；JS-S02 和 Capability Contract 不暴露 QuickJS 专有入口。 |
| P2-001 | Toolkit、JS、LVGL、Android、iOS、Benchmark、Examples 的启动必读直接包含 Runtime Composition Contract 与 Schema；Core 继续读取全部公共合同。 |
| P2-002 | 自动测试直接执行“追加第二个不同 Engine module”的语义负例，同时保留 Engine moduleId 不匹配负例。 |

还需确认：修正没有引入动态插件、多 Engine 运行、热切换、自动降级、第二条 Bridge，当前门禁仍统一为 `DESIGN_BLOCKED + CODE_BLOCKED`。

## 5. 自动校验

执行：

```bash
cd v3/spec/contracts/schemas/tests
npm test
```

并检查：

1. v3 全部本地 Markdown 相对链接。
2. Schema catalog 与 fixture 覆盖。
3. `QK-R01..QK-R20` 需求和责任映射。
4. 八份 Handoff 顶部状态。
5. 不再存在把 External Function 分配给通用 Runtime ABI Client 的有效表述。

## 6. 禁止扩张

- 不提出第四次报告之外的新产品能力。
- 不要求动态插件、运行时 Engine 切换、权限平台、AI、Skill/MCP 或完整性能平台进入 V1。
- 不因命名或风格偏好重写已冻结设计。
- 只有发现本次修正造成真实 P0/P1 冲突时，才允许报告新的阻塞问题。

## 7. 输出要求

输出到同目录 `2026-08-16-5th-review.md`：

1. 结论先行：`PASS` 或 `CHANGES_REQUIRED`。
2. 先逐项回答第四次报告的 P1-001、P1-002、P2-001、P2-002。
3. 新问题按 P0/P1/P2 排序，必须给文件、行号、违反的冻结命题和最小修正。
4. 记录真实命令及结果。
5. 若 P0/P1/P2 均为 0，明确写出：允许恢复八项目第一批分 Spec 的 `DESIGN_ALLOWED`；产品代码继续 `CODE_BLOCKED`。
