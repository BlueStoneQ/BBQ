# V1 Basic Runtime Next Execution Plan

## 目录

- [1. 结论](#1-结论)
- [2. 当前状态](#2-当前状态)
- [3. 执行顺序](#3-执行顺序)
- [4. Agent 边界](#4-agent-边界)
- [5. 停止条件](#5-停止条件)

## 1. 结论

当前主架构已经进入稳定验证阶段：不再扩展 Core 架构，不再重写三大系统，不再为完成 72 个 Spec 而机械推进。AI 作为可选 Feature 进入产品展示，但不改变固定 Kernel。

下一步唯一主线是：

```text
Gallery-001 联盟 DSL
-> Toolkit 生成唯一 RPK
-> LVGL/SDL 验证
-> Android 验证
-> iOS 验证
-> 三端结果对齐
-> AI-Chat-001 Feature Showcase
```

Gallery-001 是“设备巡检/任务看板”的本地数据展示，使用 1-3 张小型本地 PNG，覆盖多页、Image、Text、Button、if、keyed for、状态更新、`router.push/back`、基础 prompt 和 teardown。它不假设存在 `system.device`；平台能力另用 Feature RPK 验证。详细案例约束见 [`EXAMPLE-GALLERY-PLAN.md`](./EXAMPLE-GALLERY-PLAN.md)。

## 2. 当前状态

已具备并保持冻结：

- 真实联盟 DSL -> Toolkit -> RPK -> JS -> C++ Core -> Platform 主链；
- Core 唯一 Runtime Tree、Navigation、Event 和 Lifecycle；
- LVGL/SDL 首屏、事件、状态更新、if/for、Image/Input 基础能力和资源清理；
- Android/iOS 基础页面、Detail、back 和再次 push 的路径已修复；
- Case 001、CASE-002、BLOCK-001、Binding-001 等机制回归。

当前不把字体视觉微调、完整 Benchmark、裁剪 Profile、网络、存储、权限、媒体和真实 AI Engine 作为基础案例阻塞项。AI-Chat-001 使用确定性 Mock Provider，在基础三端案例通过后单独推进。

## 3. 执行顺序

| 阶段 | 负责者 | 目标 | 产物 |
|---|---|---|---|
| G0 | 总架构/现有 Integration Agent | 固定当前三端 Detail 修复并回归旧案例 | 回归命令和结果 |
| G1 | Example Agent | 实现 `Gallery-001` 联盟 DSL，含 1-3 张小 PNG | `quickapp-examples/showcases/gallery-001/` |
| G2 | Toolkit Agent | 用真实 Toolkit 生成可重复 Gallery RPK，检查资源预算和 Page IR | Gallery RPK、SHA-256、构建元数据 |
| G3 | LVGL Agent | 用同一 Gallery RPK 完成 SDL 可见、点击、路由、返回和 teardown | LVGL 运行结果和截图/命令 |
| G4 | Android Agent、iOS Agent | 并行使用同一 Gallery RPK 完成平台适配验收 | 两端运行结果和差异记录 |
| G5 | 总架构 | 对齐三端语义，记录真实缺口并决定下一项基础能力 | 三端一致性结论 |
| G6 | Feature Agent | 后续设计平台 Feature RPK，例如 Android/iOS Camera；不修改固定 Kernel | Feature Contract、平台结果 |
| A1 | AI Feature Agent | 定义 `system.ai.chat` 最小 typed Contract，实现 Mock Provider | 流式结果、取消、失败和清理测试 |
| A2 | AI Example Agent | 实现 AI-Chat-001 联盟 DSL 和真实 RPK | Chat UI、消息列表、Feature 调用、路由 |
| A3 | Platform Feature Agent | 先在 LVGL 跑 Mock AI，再规划 Android/iOS/Rust Provider | AI-Chat 运行结果 |

G1 与 G0 可以并行；G3 必须等待 G2 产出 RPK；G4 可以在 Gallery RPK 稳定后并行。A1 不阻塞 G1-G5；A2 依赖 A1 的 Contract；A3 依赖 A2 的 RPK。除新增可选 Feature Contract/Provider 外，不允许修改 Core 主语义。

## 4. Agent 边界

### Example Agent

只修改 Gallery-001 源码、图片资产、构建说明和必要的 Example 构建脚本。不得手写 Page IR、RenderTransaction 或平台旁路逻辑。

### Toolkit Agent

只修复 Gallery-001 无法由现有联盟 DSL 正确编译的问题。不得改变既有 RPK 合同，不新增 SVG Runtime 支持；图片最终产物为预生成 PNG。

### LVGL/Android/iOS Agent

只实现对应 Platform Adapter 的真实加载、Mount、Input、Navigation 和资源释放。不得创建第二套路由、第二棵 Tree 或平台私有业务状态。

### Core Agent

本轮默认停止。只有 Gallery-001 暴露出已经存在 Contract 的 Core 实现缺陷，才允许最小修复，并必须回归旧案例；不得借机扩展架构。

## 5. 停止条件

Gallery-001 在三端使用同一 RPK 完成以下路径后，本轮结束：

```text
Home
-> 小图列表可见
-> if 状态可见
-> keyed for 列表更新
-> 点击条目
-> Detail 可见
-> back 返回 Home
-> teardown 资源归零
```

完成后再评估 `Input`、Scroll、Camera、storage 和网络；不把平台 Feature 塞进基础 Gallery RPK。
