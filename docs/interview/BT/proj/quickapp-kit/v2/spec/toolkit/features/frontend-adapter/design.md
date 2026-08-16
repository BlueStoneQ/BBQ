# Frontend Adapter Design

## 目录

- [1. 结论](#1-结论)
- [2. 组件](#2-组件)
- [3. 数据流](#3-数据流)
- [4. 边界与不变量](#4-边界与不变量)
- [5. 验证策略](#5-验证策略)

## 1. 结论

**Adapter 采用“发现、读取、分段、归一化”的单向流水线；每一步只增加事实，不提前执行编译后端职责。**

```text
ProjectLoader -> ProjectGraph -> UxSectionParser -> FrontendFacts -> NormalizedIR Builder
```

## 2. 组件

| 组件 | 职责 | 禁止职责 |
|---|---|---|
| `ProjectLoader` | 发现 Manifest、入口、模块、资源 | 解析模板语义 |
| `UxSectionParser` | 分离 template/script/style 并记录位置 | 构造 Runtime Tree |
| `TemplateAdapter` | 输出模板事实 | 分配运行时 NodeId |
| `ScriptAdapter` | 提取 import/export、状态、事件引用 | 执行 JS |
| `StyleAdapter` | 提取样式规则和来源 | 计算平台布局 |
| `DiagnosticSink` | 汇总错误和警告 | 自动吞错或静默降级 |

## 3. 数据流

```text
manifest.json + source files
  -> ProjectGraph
  -> SourceUnit { kind, logicalPath, content, loc }
  -> FrontendFacts
  -> NormalizedIR
```

所有路径使用相对项目根目录的 `/` 分隔路径。所有列表按规范化逻辑路径排序。每个阶段产生不可变结果，下一阶段不得重新读取源码。

## 4. 边界与不变量

1. Adapter 不依赖 Android、iOS、LVGL、JNI 或 Platform API。
2. Adapter 不产生 `SurfaceId`、`NodeId`、`HandlerId` 等运行时对象 ID。
3. Adapter 只产生静态源码事实和源码位置。
4. 不支持的语义进入 Diagnostic；严格模式失败，兼容模式也必须显式记录降级。
5. `.ux` 区段解析与模板、脚本、样式语义解析分离。

## 5. 验证策略

- 单元测试：区段、位置、重复区段、非法输入；
- Fixture Test：Case 001 全量源码发现；
- Golden Test：FrontendFacts JSON 确定性；
- Contract Test：输出不得出现平台类型和运行时 ID。
