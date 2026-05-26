# CI/CD Quality Gate Design

## 目录

- [核心思路](#核心思路)
- [五层卡点](#五层卡点)
- [CI 阶段详解](#ci-阶段详解)
- [实现方式](#实现方式)
- [经验叙事](#经验叙事)

---

## 核心思路

卡点 = 在代码流动的关键节点设置自动化门禁，不通过就不让往下走。

```
编码 → 提交 → 合入 → 构建 → 发布
  │       │       │       │       │
  ▼       ▼       ▼       ▼       ▼
 Lint   Hooks    CI      Build   Deploy
(实时)  (本地)  (远端)   (产物)   (灰度)
```

设计原则：**分层递进，越早拦截成本越低**
- 本地：秒级反馈（写代码时就知道错了）
- CI：分钟级权威判定（远端统一标准）
- 发布：人工审批兜底（安全最后一道防线）

---

## 五层卡点

| 阶段 | 卡什么 | 怎么实现 | 不通过后果 |
|------|--------|---------|-----------|
| **编码时** | 语法/格式/类型 | ESLint + Prettier + TypeScript（IDE 实时） | 红色波浪线 |
| **提交时** | 增量检查（只查改动文件） | Husky + lint-staged | commit 被拒绝 |
| **合入时（CI）** | 全量检查 + 测试 + 审批 | Pipeline（Actions/Jenkins） | MR 不能合入 |
| **构建时** | 产物质量 | 包体阈值、构建时间阈值 | 构建失败 |
| **发布时** | 线上安全 | 灰度比例、回滚条件、审批人 | 不能全量 |

---

## CI 阶段详解

### Pipeline 结构

```yaml
stages:
  - lint        # ESLint + TypeScript 类型检查
  - test        # 单测覆盖率 ≥ 阈值
  - build       # 构建成功 + 包体不超标
  - security    # 依赖漏洞扫描
  - review      # Code Review 审批（人工）
```

### 具体卡点与阈值

| 卡点 | 指标 | 阈值示例 | 失败策略 |
|------|------|---------|---------|
| **Lint** | ESLint error 数 | = 0 | 直接失败 |
| **TypeScript** | tsc --noEmit | 类型错误 = 0 | 直接失败 |
| **单测覆盖率** | 新增代码覆盖率 | ≥ 80% | 直接失败 |
| **单测通过率** | 用例通过率 | = 100% | 直接失败 |
| **包体大小** | 产物增量 | 增量 > 50KB 需审批 | 告警 + 审批 |
| **构建时间** | 构建耗时 | > 5min 告警 | 告警（不阻塞） |
| **依赖安全** | 高危漏洞数 | = 0 | 直接失败 |
| **Code Review** | Approve 数 | ≥ 1 人（含 KeyPerson） | 不能合入 |

### 卡点分级

```
P0（阻塞合入）：Lint error、类型错误、单测失败、高危漏洞
P1（阻塞发布）：包体超标、覆盖率不达标、无 Review
P2（告警不阻塞）：构建时间、warning 数量、TODO 数量
```

---

## 实现方式

### Layer 1: Git Hooks（本地）

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint --edit $1"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["prettier --write"]
  }
}
```

关键点：
- `lint-staged` 只检查本次 git add 的文件（增量，快）
- `commitlint` 卡 commit message 格式（conventional commits）
- 本地可以 `--no-verify` 跳过（所以 CI 是权威）

### Layer 2: CI Pipeline（远端）

**GitLab CI 结构：**

```
stages（定义阶段顺序）
  └── job（具体任务，通过 stage 字段归属到某个阶段）
        └── script（该任务内的命令，按顺序执行）
```

执行规则：
- **同一 stage 内的 job → 并行**（lint 和 typecheck 同时跑）
- **不同 stage 之间 → 串行**（quality 全过了才跑 test）
- **任何 job 失败 → 后续 stage 不执行**（这就是"卡点"）

```yaml
# .gitlab-ci.yml

# 1. stages 定义全局顺序（从上到下依次执行）
stages:
  - quality    # 第一阶段
  - test       # 第二阶段（quality 全部通过后才跑）
  - build      # 第三阶段
  - security   # 第四阶段

# 2. 每个 job 通过 stage 字段归属到某个阶段
lint:
  stage: quality  # ← 归属 quality，和 typecheck 并行
  script:
    - pnpm install --frozen-lockfile
    - pnpm lint

typecheck:
  stage: quality  # ← 也归属 quality，和 lint 并行跑
  script:
    - pnpm tsc --noEmit

# quality 阶段全部通过后，才执行 test 阶段
test:
  stage: test
  script:
    - pnpm test --coverage
    - node scripts/check-coverage.js
  coverage: '/All files\s*\|\s*(\d+\.?\d*)\%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  script:
    - pnpm build
    - node scripts/check-bundle-size.js
  artifacts:
    paths:
      - dist/

security:
  stage: security
  script:
    - pnpm audit --audit-level=high
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### Layer 3: Bundle Size Gate（自定义脚本）

```javascript
// scripts/check-bundle-size.js
const fs = require('fs');
const current = getDirectorySize('./dist');
const baseline = JSON.parse(fs.readFileSync('.size-baseline.json'));
const diff = current - baseline.size;

if (diff > 50 * 1024) {
  console.error(`❌ Bundle +${(diff / 1024).toFixed(1)}KB (threshold: 50KB)`);
  console.error('   Needs approval from @build-team');
  process.exit(1);
} else if (diff > 10 * 1024) {
  console.warn(`⚠️ Bundle +${(diff / 1024).toFixed(1)}KB`);
}

// 更新 baseline（合入后）
fs.writeFileSync('.size-baseline.json', JSON.stringify({ size: current }));
```

### Layer 4: KeyPerson Review Plugin

```yaml
# CODEOWNERS（GitHub）或自定义审批规则
# 关键目录变更需要特定人审批
/src/core/**     @arch-team
/src/bridge/**   @native-team
/ci/**           @infra-team
package.json     @tech-lead
```

### Layer 5: Deploy Gate

```
发布前检查清单（自动化）：
  ✅ CI 全部通过
  ✅ 至少 1 人 Approve
  ✅ 无未解决的 blocking comment
  ✅ 灰度比例设置（先 1% → 10% → 50% → 100%）
  ✅ 回滚方案确认
  ✅ 监控告警配置
```

---

## 经验叙事

### 怎么讲

> "我在 XT 推动了全链路质量卡控：编码时 ESLint 实时提示 → 提交时 Husky + lint-staged 增量检查 → CI 流水线全量 Lint + 类型检查 + 单测 → 合入需要 KeyPerson Approve。
>
> 在 MT 优选做了 CI/CD 流程建设：发布脚本 + 流水线 + KeyPerson 审批插件。
>
> 关键设计思路是**分层递进**——本地秒级反馈，CI 分钟级权威判定，发布人工审批兜底。越早拦截，修复成本越低。"

### Q&A

**Q: 团队抵触怎么办？**

> 分步落地，不一步到位。先上 Prettier（零争议，自动格式化），再上 ESLint（有规则可讨论），最后上覆盖率卡点（有数据支撑）。每一步都让团队看到收益再推下一步。

**Q: 卡点太严会不会影响效率？**

> 本地卡点用 lint-staged（只查增量，< 3s），不影响开发节奏。CI 并行跑（lint/test/build 同时），总耗时 = 最慢的那个 job。真正慢的是"出了 bug 再修"，卡点是用前置 30s 省后面 3h。

**Q: 怎么衡量卡点的效果？**

> 跟踪指标：线上 bug 率、hotfix 频率、Code Review 打回率。上卡点前后对比，用数据说话。
