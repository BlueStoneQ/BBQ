# Public Contract Schemas

## 目录

- [1. 结论](#1-结论)
- [2. Schema 清单](#2-schema-清单)
- [3. 合同测试](#3-合同测试)

## 1. 结论

本目录是 QuickApp Kit v3 公共协议的机器可验证基线。各项目类型定义必须从这些 Schema 对齐，不得自行重定义同名消息。

## 2. Schema 清单

| Schema | 合同 |
|---|---|
| `runtime-abi.schema.json` | InstantiateTemplate、Owner + TemplateHandlerId 的 Handler 注册/解绑 |
| `runtime-composition.schema.json` | Runtime 最终链接模块、单 JS Engine identity、观测级别、V1 组件/能力与 Build Profile 事实 |
| `render-transaction.schema.json` | JS -> C++ 增量渲染事务；Binding 使用 Owner + TemplateBindingId 寻址 |
| `mount-transaction.schema.json` | C++ -> Platform Host 操作事务 |
| `event-message.schema.json` | PlatformInputMessage 与 JsEventDispatch |
| `manifest.schema.json` | Runtime 所需联盟 Manifest 投影 |
| `runtime-metadata.schema.json` | RPK 执行索引、版本与 Artifact 完整性 |
| `media-resource-contract.md` | 静态媒体资源引用、元数据、生命周期与错误语义 |
| `page-ir.schema.json` | Template/Binding/Block/Handler Page IR |
| `js-bootstrap.schema.json` | App/Page `$app_bootstrap$` Metadata |
| `module-load.schema.json` | Verified Artifact/Core Loader -> JS Module Loader 的 Bundle 交接与结果 |
| `lifecycle.schema.json` | AppContext、LifecycleDispatch/Result 与 Runtime Host lifecycle control |
| `measure-adapter.schema.json` | 同步 MeasureRequest/Result 与字体 generation 通知 |
| `platform-surface.schema.json` | Core 与 Platform Surface Host 控制面 |
| `navigation.schema.json` | NavigationPush / NavigationClose 与 typed Result |
| `observation.schema.json` | Toolkit/JS/Core/Platform 公共 Marker、整数纳秒、关联 ID、计数器与错误/降级事件 |
| `package-open-policy.schema.json` | 后续 Release profile 的包外签名信任策略草案，非 V1 门禁 |
| `feature.schema.json` | ShowToast / Prompt / Fetch / File / Device / OpenUrl / Webview typed Capability 与 SetTitleBar / SetMeta Page Control |
| `transaction-result.schema.json` | Render/Mount 异步执行结果 |
| `surface-control.schema.json` | Surface 创建/销毁、首屏、Handler 和状态结果 |
| `host-component.schema.json` | V1 Host Component（含 Video）、Prop 与 Style 语义 |
| `runtime-value.schema.json` | 跨语言 Runtime Value 唯一值域 |
| `runtime-error.schema.json` | 公共 RuntimeError |

所有 Schema 使用 JSON Schema Draft 2020-12，`schemaVersion` 当前固定为 `1`。不兼容修改必须提升版本并提供加载期拒绝行为。

## 3. 合同测试

`catalog.json` 是 `$id -> 本地文件` 的唯一目录。验证器必须先按 catalog 预注册全部 Schema，再执行校验；禁止尝试访问 `quickapp-kit.dev`。

`tests/*.mjs` 是总架构阶段的可执行合同校验，不是 Toolkit、Core、JS 或 Platform 产品实现；它只证明消息形状、跨 Artifact 关系和冻结语义负例可被一致拒绝。

```bash
cd schemas/tests
npm ci
npm test
```

测试使用 Ajv Draft 2020-12 strict mode，必须同时验证：

1. `catalog.json` 中全部 Schema 及跨文件 `$ref`。
2. 每个顶层判别联合的全部消息分支，以及分支的 `additionalProperties` 拒绝行为。
3. ID、Revision、成功/失败结果、full/incremental Mount 等关键反例。
4. Manifest、Runtime Metadata、Page IR 与 JS Bootstrap 的跨 Artifact 关系。
5. InstantiateTemplate、RenderTransaction 与 RegisterHandler 的 Owner、Template scope、missing/stale target 和父子挂载语义负例。

当前基线数量以 `npm test` 输出为准；签名/信任案例仅作为后续 Release profile 试验，不属于 V1 产品门禁。
