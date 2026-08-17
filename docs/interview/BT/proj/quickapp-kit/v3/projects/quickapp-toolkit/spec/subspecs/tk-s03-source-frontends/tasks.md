# TK-S03 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖顺序](#4-依赖顺序)
- [5. 完成定义](#5-完成定义)

## 1. 结论

实现顺序固定为“位置模型 -> UX/Template -> Script -> Style -> FeatureGate -> S02 联调”。本文不授予编码权限。

## 2. 门禁

编码前必须同时满足：

1. TK-S03 分 Spec 总架构校审 `PASS`。
2. 工作看板对 TK-S03 写出 `CODE_ALLOWED`。
3. Parser 依赖、固定版本和许可证已记录；不得复用联盟 loader 作为隐式 Runtime 合同。

## 3. 实现任务

### TK-S03-T01 Frontend 基础合同

- 实现 SourceSpan、SourceCoordinateMap、ParsedSource union、UnresolvedReference 和 limits。
- 建立 parser error -> Diagnostic adapter。
- 验证中文、CRLF、fragment offset 与 end-exclusive range。

完成定义：三个 parser 使用同一坐标和 Diagnostic 合同。

### TK-S03-T02 UX/Template Frontend

- 实现 fragment parser、App/Page section 规则和 recovery error 拒绝。
- 实现 Template syntax model、单根、text/interpolation、attribute/event/directive parser。
- 覆盖 Case 001/002 与 unsupported matrix 负例。

完成定义：不靠 regex 拆分 UX；Template AST 无 Host/ID 语义。

### TK-S03-T03 JavaScript Frontend

- 固定 ESTree-compatible parser profile。
- 实现 App/Page default export 结构校验。
- 实现 ESM/CommonJS/context/Capability reference visitor。
- 覆盖 Case 001 helper 链、global 与 Case 002 script。

完成定义：所有引用来自 AST node；不 transform、不 resolve、不执行 JS。

### TK-S03-T04 Style Frontend

- 固定 CSS/Less parser profile。
- 输出 rule/selector/declaration/at-rule/mixin/variable/arithmetic/nesting syntax。
- 发现 local import/url reference，不读取 target。
- 覆盖 Case 001 Less 与 Case 002 CSS。

完成定义：mixin/arithmetic/nesting 保持源码语法，未求值、未规范化。

### TK-S03-T05 Feature Matrix 与限制

- 将 design 中矩阵实现为版本化、可枚举 typed table。
- Parser/visitor 对每个使用项记录 featureId；unsupported 项产生稳定 Diagnostic。
- 实现 bytes/node/depth/token/reference/selector/expression limit 与取消。

完成定义：Case 必需 feature 全是 supported；矩阵外语义不透传。

### TK-S03-T06 S02/S04 边界验收

- 用 Fake S02 证明 S03 不解析 target、route、moduleId 或 Capability 声明。
- 与 S02 ReferenceResolver 联调 Case 001/002。
- 用 Fake S04 证明 ParsedSource 含足够语法与位置，但不含 Lowered Model/ID。
- 添加禁止范围、确定性和资源释放扫描。

完成定义：满足 Acceptance，且没有 Lowering/Emitter/Artifact 产品实现。

## 4. 依赖顺序

```text
T01
  -> T02 + T03 + T04
  -> T05
  -> T06
```

T02/T03/T04 可并行；三者必须共享 T01 位置模型与 T05 Feature Matrix，不得建立各自的 range 或 Diagnostic 类型。

## 5. 完成定义

1. `TK-S03-R01..R25` 全部有直接测试或静态证据。
2. Case 001/002 所有冻结源码可解析，feature usage 与矩阵一致。
3. parser error/unsupported/limit 均不返回可供 S04 消费的 AST。
4. 输出无 resolved target、moduleId、Host/ID 和 Artifact 字段。
5. typecheck、lint、unit、integration、Golden、determinism、resource、boundary scan 全部通过。
6. 更新证据与 Handoff 后提交实现校审；不得自行启动 TK-S04。
