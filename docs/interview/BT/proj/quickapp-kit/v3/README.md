# QuickApp Kit v3

## 目录

- [1. 定位](#1-定位)
- [2. 目录规则](#2-目录规则)
- [3. 当前阶段](#3-当前阶段)
- [4. 阅读顺序](#4-阅读顺序)

## 1. 定位

**v3 是 QuickApp Kit 当前的干净执行基线；v2 只作为研究和设计演进记录。**

v2 是过渡和孵化资料；v3 依据已验证事实重新冻结公共合同，并把每个产品的正式 Spec 放入对应项目目录。v2 不作为执行合同。

## 2. 目录规则

```text
v3/
├── spec/                         # 平台总 Spec、详细架构与公共合同
├── projects/<project>/spec/      # 单项目正式 Spec
├── V1-EXECUTION-PLAN.md          # 端到端里程碑与执行波次
└── AGENT-WORK-BOARD.md           # Agent 分工与通信入口
```

代码仍位于：

```text
/Users/qy/code/my-github/quickapp-kit-ai/<project>
```

`projects/<project>/spec/` 与代码项目一一对应。

## 3. 当前阶段

```text
总架构与公共合同完成
  -> 各项目总 Spec 初稿完成
  -> 总架构与项目总 Spec 校审 PASS
  -> F0 Foundation：首批分 Spec 实现或定向返修
  -> W1-W5：Toolkit + JS + Core + LVGL/SDL 端到端汇合
  -> M1：同一 Runtime RPK 完成 Case 001 S1-S5
  -> M2：Android 复用同一 Artifact/Core/JS
  -> M3：iOS 复用同一 Artifact/Core/JS
  -> M4：三平台基础 Benchmark
```

## 4. 阅读顺序

1. `spec/README.md`
2. `spec/requirements.md`
3. `spec/design.md`
4. `spec/tasks.md`
5. `spec/acceptance.md`
6. `V1-EXECUTION-PLAN.md`
7. `AGENT-WORK-BOARD.md`
8. `SUBSPEC-AGENT-LAUNCH.md`
9. `reviews/subspec-review/2026-08-17-w2-design-review.md`
10. 对应项目的 `projects/<project>/spec/README.md`
11. 对应项目的 `AGENT-HANDOFF.md`

总架构和项目总 Spec 已通过；当前里程碑、分 Spec 状态和编码授权以 `AGENT-WORK-BOARD.md` 第 6 节为唯一事实源。
