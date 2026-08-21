# TK-S05 Tasks

## 目录

- [1. 结论](#1-结论)
- [2. 设计门禁](#2-设计门禁)
- [3. 实现任务](#3-实现任务)
- [4. 依赖与并行](#4-依赖与并行)
- [5. 完成定义](#5-完成定义)

## 1. 结论

S05 只实现“Canonical Lowered Model -> JS Bundle/Source Map”这一条后端投影链；不实现 Page IR 或 Runtime Artifact。

## 2. 设计门禁

1. TK-S04 必须保持 `VERIFIED`，输入模型和四类 ID 合同不得被未校审修改。
2. S05 五份分 Spec 必须经总架构校审 `PASS`。
3. 工作看板必须明确 `TK-S05 CODE_ALLOWED`。
4. 公共 JS Module ABI、Bootstrap Schema、Artifact Contract 无未决冲突。

## 3. 实现任务

### TK-S05-T01 输入与 emission plan

- 定义 immutable `JsEmissionRequest/Result`、limits、diagnostics 和 cancellation。
- 校验 model version、module closure、Page identity、ID 集、module path collision。
- 固定 App/Shared/Page 的 module 与 output path 排序。

完成定义：不读取 SourceAccess，不重新解析 S02/S03，不修改 S04 model。

### TK-S05-T02 JS AST emitter

- 为已验证 S03 JavaScript AST 实现确定性 statement/expression emitter。
- 实现 ESM/CJS/global 的 canonical module projection、require/context 和 capability reference。
- 不支持语义返回 SourceSpan Diagnostic，不使用源码字符串 fallback。

完成定义：Case 001/002 所需 program 生成稳定可执行文本。

### TK-S05-T03 ABI wrapper、module.exports 与 bootstrap

- 生成 define wrapper 和 helper 调用；只为 App/Page 生成 bootstrap wrapper。
- 在 App/Page define factory 内通过 `module.exports` 生成 Definition，并验证 `$app_require$` 返回同一 Definition。
- 验证 App/Page 各自恰好一次 bootstrap；验证 Shared 只 define、不得 bootstrap。
- 为 Shared 保持普通 module export 和 AppRuntime cache scope。

完成定义：公共 Module ABI validator 通过；App/Page `module.exports` Definition 可由 `$app_require$` 取得且各自恰好一次 bootstrap；Shared 无 bootstrap。

### TK-S05-T04 Binding/Handler export

- 按 canonical IDs 生成 evaluator callable 和 method map。
- 实现 concat、displayString、boolean coercion、lexical scope 和 method body。
- 禁止 target/property/eventType、Runtime ID 和完整 tree 进入 Bundle。

完成定义：所有 output key 与 S04 ID 集一一对应，Case 002 的 `0` 语义成立。

### TK-S05-T05 Source Map

- 实现 Source Map v3、workspace-relative source、VLQ mapping 和确定性 ordering。
- 为 module body、evaluator、handler、bootstrap 生成最窄 SourceSpan 映射。
- 覆盖非法 span、源路径泄露、map/bundle mismatch。

完成定义：每个 Bundle 有合法 Map，字节稳定且无绝对路径。

### TK-S05-T06 预算、取消、原子发布

- 实现累计 bytes/AST/dependency/map/diagnostic limits。
- 在 module、statement、expression、map segment 和 finalize 阶段检查取消。
- staging 全成功后一次性发布，否则无 partial output。

完成定义：失败/取消不残留 Bundle/Map/cache；连续 Build Session 无跨次 mutable state。

### TK-S05-T07 合同与联合验收

- Case 001/002、BLOCK-001、CAP-DEVICE-001 Bundle/Map Golden。
- ABI positive/negative、module reference、fetch deferred、`module.exports`/`$app_require$` 返回值、Shared 无 bootstrap、App/Page 单 bootstrap 和 ID set tests。
- Determinism、Source Map、resource、cancellation 和 forbidden-scope scan。
- 与 S06 的 fake projection 做 module/template/binding/handler ID 集联合校验。

完成定义：提交源码摘要、需求映射、全部门禁和 Handoff；不得启动 TK-S07。

## 4. 依赖与并行

S05 可与 TK-S06 并行设计和编码，但两者只能各自消费同一 S04 model；任何跨 emitter 共享语义 helper 必须归属于公共合同或 S04，不在 S05 私有复制。

## 5. 完成定义

- 五份分 Spec 经总架构 `PASS`。
- 代码只修改 Toolkit S05 范围。
- Typecheck/lint/build/unit/integration/Case/determinism/resource/cancellation/boundary 全通过。
- 证据证明 S05 没有 Page IR、Artifact、RPK 或 Runtime 实现。
- Handoff 标记 `READY_FOR_REVIEW` 后停止，等待总架构发布下一项。
