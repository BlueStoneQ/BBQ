# BT / KS / DD 三家统筹准备

> 三家都是大厂前端高级/专家岗，准备方向高度重叠，统一备战。

---

## 岗位对比

| | BT（营销中台） | KS（支付） | DD（运营增长） |
|---|---|---|---|
| **级别** | 高级工程师 | 高级工程师 | 专家/Leader |
| **业务** | 广告投放/创意素材/AIGC | 支付/电商 | 运营增长平台 |
| **核心技术** | 微前端 + 编辑器 + AIGC + Node | H5 + RN + 性能优化 + 可观测 | React + 微前端 + AI Coding + 低代码 |
| **管理要求** | 无 | 无 | 带团队 |
| **AI 要求** | 中（AIGC 创意生产） | 弱（AI 融入开发流程） | **强**（AI 编程体系 + Agent 落地） |
| **匹配度** | 中 | 高 | **最高** |

---

## 统一准备清单

### 三家都考的（必须准备）

| 方向 | 内容 | 文档 |
|------|------|------|
| JS 基础 | 闭包/原型链/事件循环/Promise/this | basic/ |
| CSS | Flex 布局/响应式/BFC | basic/ |
| HTTP | 缓存（强/协商）/CORS/状态码 | qa3 7.2 |
| React | Hooks/状态管理/性能优化/Diff | basic/react |
| 工程化 | Vite 原理/Webpack/CI-CD/构建链路 | DiDi/engineering/ |
| Node.js | BFF/GraphQL/中间件/进程管理 | root/Node/ |
| 微前端 | qiankun/Module Federation/隔离方案 | root/Vue/micro-fe/ |
| Web 安全 | XSS/CSRF/CSP | basic/ |
| **手写代码** | TS + JS 手写题 + 算法 Hot20 | writeByHand/ |
| **AI** | Mako Agent/Stream/MCP/ReAct | project/AI/ |

### KS 额外

- 支付安全（幂等性/金额精度/防重复提交）
- RN 深度（性能优化/Native 桥接/热更新）
- 可观测体系（指标/埋点/监控）

### DD 额外

- 管理叙事（带团队/技术决策/跨团队推动）
- AI Coding 体系规划（MCP 全链路落地）
- 低代码/业务标准化

### BT 额外

- 低代码/搭建系统（投放编排框架）
- 编辑器（Canvas/拖拽，IDE 经验迁移）
- 广告业务简单了解（投放流程/ROI）

---

## 手写 & 算法准备

> 三家大厂必考，KS 和 BT 尤其重视。

### JS 手写（高频）

- Promise.all / Promise.race / Promise.allSettled
- 防抖 debounce / 节流 throttle
- 深拷贝 deepClone
- 函数柯里化 curry
- EventEmitter（发布订阅）
- 数组拍平 flat
- instanceof 实现
- new 实现
- call / apply / bind

### 算法 Hot20

- 两数之和 / 三数之和
- 反转链表
- 有效括号
- 合并两个有序数组
- 二叉树前/中/后序遍历
- 最大子数组和
- 爬楼梯（DP）
- 二分查找
- LRU 缓存
- 岛屿数量（DFS/BFS）

→ 详见 [手写题索引](../../writeByHand/js-coding/README.md) / [算法速查](../../writeByHand/algorithm-cheatsheet.md)

---

## 面试节奏

```
时间线：
  KS：12h 后（明天）
  DD：24h 后（后天）
  BT：下下周启动

策略：
  现在 → KS 专项（手写 + RN + 支付业务 + 性能）
  KS 面完 → DD 专项（AI Agent + 管理叙事 + 低代码 + 低代码）
  下周起 → BT 准备（微前端 + Node + 工程化 + 编辑器）
```
