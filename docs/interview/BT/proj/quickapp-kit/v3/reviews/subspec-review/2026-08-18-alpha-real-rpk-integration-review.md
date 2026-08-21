# M1-Alpha 真实 RPK 联调校审

## 目录

- [1. 结论](#1-结论)
- [2. 已验证事实](#2-已验证事实)
- [3. 当前进度](#3-当前进度)
- [4. 剩余阻塞](#4-剩余阻塞)
- [5. Agent 指令](#5-agent-指令)

## 1. 结论

**M1-Alpha 当前约 75%，处于真实 RPK 上游语义修正阶段，S1 尚未通过。**

架构骨架与四个局部组件已经成立。真实 RPK 已证明 Container/Loader 链路可用，同时暴露了模块依赖、Page VM、typed facade 和字体四个边界缺口。现在不增加系统，只修正边界并完成唯一 Composition Root。

## 2. 已验证事实

### 2.1 已完成

- Toolkit TK-S07 打包实现、五份详细分 Spec、RPK 确定性和 Core Loader probe 已完成。
- JS initial-only 分层已归位：S04 只编排 `PageInitializationStagePort`，Binding Stage 与 Initial Transaction Builder 分离；CTest `9/9 PASS`，源码清单全部通过。
- Core 已能从真实 RPK 发布 App/Page `VerifiedModule` 与 `PageIrHandle`；Alpha Render/Layout/Mount 局部链路已通过。
- LVGL Surface、Measure、Mount/Present 局部组件已通过；尚未支持真实 Page IR 的 `fontSize`。

### 2.2 真实输入暴露的事实

- 当前 Page Definition 返回 `{ private: { title }, ... }`，而 evaluator 是 `String(title)`；这不满足 `this=PageVm` 的冻结求值合同。
- 当前 Bundle 使用非 canonical `system.*` ID；Shared index 还产生自依赖和未冻结的 `$app_require$.context`。
- 当前 Runtime Metadata 只记录 Page dependencies，App/Shared 的真实包内依赖无法交给 Core/JS；公共 Artifact Contract 与 Schema 已定向补齐。
- `onInit` 调用 `this.$page.setTitleBar/setMeta`，当前 JS Composition 尚未安装 typed Page Control Facade。
- 当前 LVGL Mount Host 明确拒绝 `fontSize`，不能形成 Case 001 CJK 可见证据。

## 3. 当前进度

| Alpha 能力 | 状态 | 判断 |
|---|---|---:|
| Case 001 与公共合同 | 完成 | 100% |
| Toolkit 打包机制与 S07 Spec | 完成 | 100% |
| Toolkit 当前 RPK 运行语义 | 待定向修正 | 70% |
| JS Module/VM/initial 分层 | 完成 | 90% |
| Core Loader/Render/Layout/Mount | 完成，待真实组装 | 100% |
| LVGL Mount/Present | 组件完成，字体待接线 | 80% |
| Composition Root | 被上游阻塞 | 10% |
| S1 可见、Trace、资源归零 | 未形成 | 0% |

`75%` 表示 Alpha 垂直主线工程进度，不等于完整 M1 分 Spec 完成率。

## 4. 剩余阻塞

1. Toolkit：修正 Page VM state projection 与 evaluator identifier emission。
2. Toolkit：输出完整包内依赖图，消除 Shared 自依赖/`require.context`，并统一 typed facade moduleId。
3. Core：消费 App/Shared/Page dependencies，校验包内 DAG 并原样发布 `VerifiedModule`。
4. JS：实现最小 Router 与 `$page` typed facade，不引入通用 Bridge。
5. LVGL：把 `fontSize` 接入已声明字体资产和 LV-S06 Measure 合同。
6. Examples：使用修正后的真实 RPK 完成唯一 Composition Root 与 S1 证据。

Core 只需定向补齐 Module dependency handoff，其他实现保持停止。完整 Mount 失败恢复属于后续 M1，不阻塞 Alpha。

## 5. Agent 指令

### 5.1 Toolkit

```text
继续当前 Toolkit 对话，只修正真实 RPK 联调暴露的三项语义问题。

1. 按 Canonical state symbol resolution 把受支持的 DSL 状态字段生成到 Runtime Page VM 根对象；Case 001 private.title 必须使 evaluator 生成并执行 this.title，不得依赖自由变量或 Runner 注入。
2. Package dependency graph 只包含 App/Shared/Page 的静态包内依赖；Bundle define dependencies 与 Runtime Metadata dependencies 必须完全一致。修复 Shared 自依赖，并把静态 require.context 在构建期展开为直接依赖/require。
3. 把联盟 system.* import 规范化为公共合同冻结的 @app-module/system.*；typed facade 不进入 Package dependency graph。

重新生成 Case 001 RPK、证据和 Core Loader probe，并补 Core VerifiedModule -> JS ModuleLoader 的依赖闭包测试。
不得启动 TK-S08/TK-S09，不做签名、inspect/run、Skill/MCP 或通用兼容层。
完成后在 Toolkit AGENT-HANDOFF.md 标记 READY_FOR_REVIEW 并停止。
```

### 5.2 Core

```text
继续当前 Runtime Core 对话，只对齐已冻结的 Runtime Metadata module dependencies 合同。

PackageLoader 必须读取 App/Shared/Page 的 dependencies[]，验证 App -> Shared、Shared -> Shared DAG、Page -> App/Shared，拒绝未知、自依赖、Page 依赖和 Shared cycle，并原样发布到 VerifiedModule。
@app-module/system.* 是 JS Framework typed facade，不属于 Package dependency graph。
完成后提交 Loader 正负例、source manifest 和 AGENT-HANDOFF.md，标记 READY_FOR_REVIEW 并停止；不得扩展其他 Core 能力。
```

### 5.3 JS

```text
继续当前 JS Runtime 对话。Alpha initial-only 分层已经通过，不要重复修改。

只实现 Case 001 S1 所需的最小 typed facade：
1. 静态 facade catalog 解析公共合同冻结的 Router moduleId，并提供当前 ESM 产物所需的 default export；S1 不调用 push。
2. 按 SurfaceContext.hostCapabilities 给 Page VM 安装 $page.setTitleBar/setMeta，并通过现有 typed Runtime ABI 转发。
3. 消费 Toolkit 修正后的 Core VerifiedModule，证明 App/Page Module -> VM -> onInit -> initial binding -> InstantiateTemplate。

不得实现通用 module/method/JSON Bridge，不启动完整 Reactive、Block、Event、Navigation 或 Capability。
完成后提交测试、资源归零、源码清单和 AGENT-HANDOFF.md，标记 READY_FOR_REVIEW 并停止。
```

### 5.4 LVGL

```text
继续当前 LVGL Runtime 对话，只完成 Case 001 fontSize 接线。

把 Core MountTransaction 的 fontSize 映射到既有 LV-S06 system-default 字体/Measure 合同和仓库内已声明字体资产；不得静默忽略，不得使用未声明系统字体。
保持 LVGL owner-thread 规则，不接管 Core Layout、Runtime Tree 或 Revision。
提交真实 CJK 文本的 mount/visible、Measure 一致性、资源归零和源码清单证据。
不得启动 LV-S05/LV-S07..S10。
完成后在 LVGL AGENT-HANDOFF.md 标记 READY_FOR_REVIEW 并停止。
```

### 5.5 Examples

```text
继续当前 Examples 对话，保持 INTEGRATION_BLOCKED_UPSTREAM，不创建绕过真实链路的 Runner。

Toolkit、Core、JS、LVGL 四项修正通过后，加载重新生成的真实 Case 001 RPK，依次装配 JS、Core、LVGL/SDL，完成唯一 Composition Root。
不得手写 Page IR、Bundle、BindingValue、RenderTransaction 或 MountTransaction，不得使用 Fake Host。
提交可复现命令、真实页面可见证据、结构化 Trace，以及 Surface/Node/Handler/Module/Engine 资源归零证据。
```
