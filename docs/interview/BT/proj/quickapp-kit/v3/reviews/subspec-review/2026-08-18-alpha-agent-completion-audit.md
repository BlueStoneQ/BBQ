# M1-Alpha 子 Agent 完成审计

> 后续执行方式已调整为单一 M1-Alpha 集成 Agent；本文件保留为问题审计，不再作为项目 Agent 派发入口。当前入口见 `v3/m1-alpha/INTEGRATION-AGENT.md`。
> 最新结果：Toolkit/Core/JS/LVGL 四项定向修正已完成；当前以 `2026-08-18-alpha-component-gate-review.md` 为准。

## 目录

- [1. 结论](#1-结论)
- [2. 审计结果](#2-审计结果)
- [3. 当前进度](#3-当前进度)
- [4. 下一步指令](#4-下一步指令)
- [5. 汇聚门禁](#5-汇聚门禁)

## 1. 结论

**最新四项定向修正为 `0/4` 完成；M1-Alpha 仍约 75%，S1 仍被上游阻塞。**

子 Agent 结束的是此前组件任务，没有执行最新 Toolkit/Core/JS/LVGL 定向指令。对话结束不等于任务完成；必须同时存在源码、测试、证据和 `AGENT-HANDOFF.md` 完成记录。

## 2. 审计结果

| Agent | 最新任务 | 审计结果 | 直接证据 |
|---|---|---|---|
| Toolkit | Page VM、Package dependencies、typed facade ID | `NOT_STARTED` | Handoff 终止于总架构放行；RPK 仍为旧字节；仍存在 `String(title)`、Shared 自依赖和 `$app_require$.context` |
| Core | App/Shared/Page dependency handoff | `NOT_STARTED` | Handoff 终止于总架构放行；Loader 仍只解析 Page dependencies |
| JS | Router 与 `$page` 最小 typed facade | `NOT_STARTED` | Handoff 终止于总架构放行；只有 Resolver Port 和既有 ABI，没有生产 facade/page-control 组合实现 |
| LVGL | `fontSize` 与 CJK 字体接线 | `NOT_STARTED` | Handoff 终止于总架构放行；`fontSize` 仍是显式 unsupported negative case |
| Examples | 最终 Composition Root | `CORRECTLY_WAITING` | 四项上游未完成；没有绕过真实链路创建 Runner |

## 3. 当前进度

| 项目 | 当前有效状态 |
|---|---|
| Toolkit | 打包机制已通过；最终 Alpha RPK 未生成 |
| Core | Alpha Render/Layout/Mount 组件已通过；dependency handoff 未对齐 |
| JS | initial-only 分层已通过；typed facade 未实现 |
| LVGL | Mount/Present 组件已通过；真实字体未接通 |
| Examples | 等待上游；S1 证据为 0 |

因此总体进度不变：`75%`。当前不是重新设计，而是完成四个已冻结的跨层合同。

## 4. 下一步指令

### 4.1 Toolkit Agent

```text
继续当前 Toolkit 对话。你上次结束的是 TK-S07 旧产物任务，最新 Alpha 定向修正尚未执行。

现在只完成以下内容：
1. 按 Canonical state symbol resolution 生成 Runtime Page VM 根状态；Case 001 private.title 必须由 this.title evaluator 读取。
2. App/Shared/Page Bundle define dependencies 与 Runtime Metadata dependencies[] 必须完全一致；Package graph 只包含包内模块。
3. 删除 Shared 自依赖；把静态 require.context 在构建期展开为确定性的直接模块依赖和 require。
4. 把联盟 system.* import 规范化为 @app-module/system.*；typed facade 不进入 Package dependencies。
5. 重建 Case 001 RPK、TK-S05/S06/S07 证据和 source manifest。

不得启动 TK-S08/TK-S09，不做签名、inspect/run、Skill/MCP。
完成后必须在 Toolkit AGENT-HANDOFF.md 追加 READY_FOR_REVIEW，列出新 RPK SHA-256、测试结果和禁止项，然后停止。
```

### 4.2 Core Agent

```text
继续当前 Runtime Core 对话。你上次结束的是 Alpha 组件任务，最新 Module dependency handoff 尚未执行。

现在只修改 PackageLoader：
1. 读取 App/Shared/Page 的 dependencies[]。
2. 验证 App -> Shared、Shared -> Shared DAG、Page -> App/Shared。
3. 拒绝未知依赖、自依赖、Shared cycle 和对 Page 的依赖。
4. 将 dependencies 原样发布到 VerifiedModule。
5. @app-module/system.* 不属于 Package graph，不由 Core 解析或创建。

补 Loader 正负例、完整测试、source manifest 和 evidence。
完成后必须在 Core AGENT-HANDOFF.md 追加 READY_FOR_REVIEW，然后停止；不得扩展其他 Core 能力。
```

### 4.3 JS Agent

```text
继续当前 JS Runtime 对话。Alpha initial-only 分层已经通过；最新 typed facade 任务尚未执行。

现在只实现 Case 001 S1 所需内容：
1. 静态 facade catalog 解析 @app-module/system.router，并提供 Bundle 所需 default export；S1 不调用 push。
2. 按 SurfaceContext.hostCapabilities 给 Page VM 安装 $page.setTitleBar/setMeta。
3. 两个 Page Control 方法必须通过现有 typed Runtime ABI 发送消息，不能由 Runner 吞掉。
4. 补 Module Resolver、Page VM 注入、onInit、initial binding 和 InstantiateTemplate 的组件测试。

不得实现通用 module/method/JSON Bridge，不启动完整 Reactive、Block、Event、Navigation 或 Capability。
完成后必须在 JS AGENT-HANDOFF.md 追加 READY_FOR_REVIEW，附测试和 source manifest，然后停止。
```

### 4.4 LVGL Agent

```text
继续当前 LVGL Runtime 对话。最新 fontSize/CJK 定向任务尚未执行。

现在只完成：
1. 将 MountTransaction.fontSize 映射到既有 LV-S06 system-default 字体/Measure 合同。
2. 使用仓库内明确声明和纳入构建的 CJK 字体资产。
3. 保持 LVGL owner thread，不接管 Core Layout、Runtime Tree 或 Revision。
4. 提交 fontSize 正例、真实 CJK mount/visible、Measure 一致性、资源归零和双 Profile 证据。

不得静默忽略 fontSize，不得使用未声明系统字体，不启动 LV-S05/LV-S07..S10。
完成后必须在 LVGL AGENT-HANDOFF.md 追加 READY_FOR_REVIEW，然后停止。
```

### 4.5 Examples Agent

```text
保持 INTEGRATION_BLOCKED_UPSTREAM，暂不编码。
等待 Toolkit、Core、JS、LVGL 四项均由总架构标记 VERIFIED 后，再建立唯一真实 Composition Root。
不得手写 Page IR、Bundle、BindingValue、RenderTransaction、MountTransaction 或使用 Fake Host。
```

## 5. 汇聚门禁

四个 Agent 可以并行，但必须分别满足：

```text
source change
-> focused tests PASS
-> full relevant tests PASS
-> evidence/source manifest PASS
-> AGENT-HANDOFF READY_FOR_REVIEW
-> total architecture review VERIFIED
```

四项全部 `VERIFIED` 后，才放行 Examples Runner。Runner 通过真实 RPK 形成可见页面、结构化 Trace 和资源归零证据后，M1-Alpha 才完成。
