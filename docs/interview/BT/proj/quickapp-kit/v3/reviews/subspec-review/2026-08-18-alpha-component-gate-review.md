# M1-Alpha 组件门禁校审

## 目录

- [1. 结论](#1-结论)
- [2. 已验证结果](#2-已验证结果)
- [3. 当前进度](#3-当前进度)
- [4. 剩余工作](#4-剩余工作)
- [5. 集成 Agent 指令](#5-集成-agent-指令)

## 1. 结论

**Toolkit、Core、JS、LVGL 四项 Alpha 定向修正全部通过，状态为 `4/4 VERIFIED`。M1-Alpha 进入最终 Composition Root 阶段。**

现在不再修改四个组件的架构和分 Spec；唯一目标是用同一个新 RPK 跑通真实 JS -> Core -> LVGL/SDL 主链。

## 2. 已验证结果

| 项目 | 结果 | 关键证据 |
|---|---|---|
| Toolkit | `VERIFIED` | 新 RPK 22029 bytes，SHA-256 `95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4`；76/76、CLI 17/17；RPK 与 Core Loader 通过 |
| Core | `VERIFIED` | App/Shared/Page dependencies、DAG、非法依赖和原子失败；dependency build 14/14，Release/ASan/TSan 通过 |
| JS | `VERIFIED` | Router facade、Page Host Control、initial binding、InstantiateTemplate；Debug/Release/ASan/TSan 11/11 |
| LVGL | `VERIFIED` | `fontSize`、Source Han Sans CJK 资产、真实 LVGL/SDL visible、Measure 一致性；多配置与 embedded-only 通过 |

## 3. 当前进度

| Alpha 阶段 | 状态 | 进度 |
|---|---|---:|
| Case 001、公共合同 | `VERIFIED` | 100% |
| Toolkit/Core/JS/LVGL 组件门禁 | `4/4 VERIFIED` | 100% |
| 真实 Composition Root | 尚未完成 | 0% |
| 真实 RPK -> JS -> Core -> LVGL/SDL | 尚未完成 | 0% |
| S1 visible/Trace/资源归零 | 尚未完成 | 0% |

综合工程进度约 `85%`，但交付判定仍是 `S1 NOT PASSED`。

## 4. 剩余工作

1. Examples 建立唯一 Composition Root。
2. 使用 Toolkit 新 RPK，不使用旧 RPK、联盟 RPK 或手写中间产物。
3. 将 Core `VerifiedModule.bytes()` 交给 JS ModuleLoader。
4. 将 JS `InstantiateTemplate` 和真实 PageIrHandle 交给 Core Initial Render/Mount。
5. 将真实 MountTransaction 交给 LVGL/SDL，显示 Case 001 CJK 首屏。
6. 记录最小 load/module/vm/render/mount/present/teardown Trace。
7. 验证 Surface、Node、Handler、Module、Engine、LVGL object 和队列资源回到基线。

## 5. 集成 Agent 指令

```text
四个 Alpha 组件门禁已经 VERIFIED。现在不要重复修改 Toolkit/Core/JS/LVGL 的已通过实现。

只完成 Examples Composition Root：
1. 使用 quickapp-toolkit/evidence/tk-s07-case001.rpk，确认 SHA-256 为 95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4。
2. 依次装配 Core PackageLoader、JS Runtime/QuickJS、Core Runtime、LVGL/SDL Host。
3. 通过真实 Core VerifiedModule bytes 加载 App/Page Bundle；不得让 JS 读取 RPK 路径。
4. 使用真实 PageIrHandle、JS initial binding/InstantiateTemplate、Core Initial Render/Yoga/唯一 RuntimeTreeStore 和 MountTransaction。
5. 由真实 LVGL/SDL 显示 View/Text/Button 和 CJK 标题，完成 Present。
6. 输出可复现命令、visible 证据、结构化 Trace 和资源归零证据。

只有在真实链路出现明确实现缺口时，才允许在对应工程做最小 Alpha 修复；不得新增公共合同、第二棵 Tree、Fake Host、手写 Page IR/Bundle/Transaction、通用 JSON Bridge 或后续能力。

完成后在 v3/m1-alpha/INTEGRATION-HANDOFF.md 追加 READY_FOR_ARCH_REVIEW，列出真实运行结果和所有失败/降级事实；不要只提交组件测试结果。
```
