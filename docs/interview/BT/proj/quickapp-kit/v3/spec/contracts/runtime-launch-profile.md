# Runtime Launch Profile Contract

## 目录

- [1. 结论](#1-结论)
- [2. 数据合同](#2-数据合同)
- [3. 所有权与边界](#3-所有权与边界)
- [4. 启动结果](#4-启动结果)
- [5. 验收](#5-验收)

## 1. 结论

`RuntimeLaunchProfile` 是 Toolkit 与 Runtime Host 之间唯一的**进程级启动合同**：Toolkit Application Service 产生，目标 Runtime Host 消费；它不进入 JS/C++ Runtime ABI，也不允许各平台自行扩展语义。

## 2. 数据合同

```text
RuntimeLaunchProfile {
  artifact: absolute-or-resolved package path
  entryRoute: normalized route
  params: RuntimeValue object
  viewport: { width, height, unit: logical-px }
  traceOutput: resolved output path | disabled
  target: android | lvgl | ios
}
```

- `artifact` 必须在 Toolkit Application Service 侧完成路径解析，但包内容仍由 Runtime 的 Package Loader 校验。
- `entryRoute` 缺省时取 Runtime Metadata 的 `entryRoute`；显式值必须先规范化。
- `params` 只允许公共 `RuntimeValue`。
- `viewport` 是首个 Root Surface 的逻辑尺寸，不是平台像素尺寸。
- `traceOutput` 只指定观测输出位置，不改变 Runtime 成功条件。
- `target` 只选择 Host Adapter，不改变 Artifact 或 Runtime ABI。

## 3. 所有权与边界

| 阶段 | 唯一责任者 | 责任 |
|---|---|---|
| 参数解析与默认值 | Toolkit Application Service / TK-S08 | CLI、Skill、MCP 输入统一转换为同一 Profile |
| 目标进程启动 | Toolkit target launcher | 传递 Profile，保留退出码和结构化错误 |
| Profile 解码 | Android/LVGL/iOS Runtime Host | 严格校验字段，不解释 DSL，不改写公共语义 |
| AppRuntime/Root Surface | C++ Core | 按 Profile 创建 Runtime 与 Root Surface |

V1 CLI 只能调用 Toolkit Application Service 产生 Profile。第二期 Skill/MCP 同样只能调用该服务，不得另造启动参数。平台私有信息只能存在 launcher 内部，不能加入公共 Profile。

## 4. 启动结果

- 只有 Core 返回 Root `CreateSurfaceResult(status=presented)` 后，launcher 才报告启动成功。
- 解码、Package、初始化、首屏 Mount 或 Present 任一步失败，必须返回稳定 `RuntimeError` 和非零退出码。
- 正常关闭返回零；Trace 写出失败不得伪造 Runtime 启动成功或失败。
- Platform Host 不得用窗口已创建、Activity/Scene 已出现或 SDL 已打开替代 `presented`。

## 5. 验收

1. CLI 对相同输入产生相同规范化 Profile；第二期 Skill/MCP 必须复用同一结果。
2. Android、LVGL/SDL、iOS 对相同字段执行相同语义和错误分类。
3. 未知字段、非法 target、非法 viewport 或非 RuntimeValue params 在启动前拒绝。
4. Root Present 前进程不得报告成功；失败路径保留稳定错误与非零退出码。
