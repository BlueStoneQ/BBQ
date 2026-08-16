# Frontend Adapter Tasks

## 目录

- [1. 实施任务](#1-实施任务)
- [2. 追踪矩阵](#2-追踪矩阵)

## 1. 实施任务

- [ ] T2.1 定义 `ProjectGraph`、`SourceUnit`、`FrontendFacts` 和 `Diagnostic` 类型（R1、R4、R5）。
- [ ] T2.2 实现 Manifest、路由、入口和资源发现（R1、R2）。
- [ ] T2.3 实现 `.ux` 区段解析和源码位置计算（R3、R6）。
- [ ] T2.4 实现 TemplateAdapter，不分配 Runtime ID（R3、R4）。
- [ ] T2.5 实现 ScriptAdapter，提取模块依赖、状态和事件引用（R3、R4）。
- [ ] T2.6 实现 StyleAdapter，输出规则顺序和源码位置（R3、R4）。
- [ ] T2.7 增加 Case 001 Fixture、错误和确定性测试（R1-R6）。
- [ ] T2.8 通过 Normalized IR Contract Test 后，才能进入 T3。

## 2. 追踪矩阵

| 任务 | 需求 | 产物 |
|---|---|---|
| T2.1 | R1/R4/R5 | `src/frontend/types.ts` |
| T2.2 | R1/R2 | `src/frontend/project-loader.ts` |
| T2.3 | R3/R6 | `src/frontend/ux-section-parser.ts` |
| T2.4 | R3/R4 | `src/frontend/template-adapter.ts` |
| T2.5 | R3/R4 | `src/frontend/script-adapter.ts` |
| T2.6 | R3/R4 | `src/frontend/style-adapter.ts` |
| T2.7 | R1-R6 | `test/frontend-adapter.test.mjs` |
