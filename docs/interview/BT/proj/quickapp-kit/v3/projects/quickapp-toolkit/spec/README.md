# QuickApp Toolkit v3 Spec

## 目录

- [1. 结论](#1-结论)
- [2. 输入输出](#2-输入输出)
- [3. 权威合同](#3-权威合同)
- [4. Spec 交付物](#4-spec-交付物)
- [5. 启动顺序](#5-启动顺序)

## 1. 结论

**Toolkit v3 从零设计和实现，不继承旧 Toolkit Spec 与代码结构。**

保留的只有事实和外部合同：联盟 DSL、Case 001、联盟 Toolkit/Runtime 研究、v3 公共 Runtime Contract。旧文档只可用于追溯，不得复制为 v3 设计。

Toolkit 的本质：

```text
联盟 DSL 源码
  -> 编译分析
  -> JS Bundle + 静态 IR + Runtime Metadata
  -> 可验证 QuickApp Kit Runtime RPK
```

## 2. 输入输出

输入基线：

```text
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test1
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/quickapp-code-test2
```

代码工程：

```text
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
```

Case 001 验证真实联盟样例加载、首屏、click、router、prompt 和页面销毁；Case 002 验证状态更新 `RenderTransaction`、if 和 keyed for。不得把 Case 001 不包含的行为写成其 Golden。

Case 001 的 `router.widgets.CardDemo` 不属于 V1 页面 Runtime 范围。Toolkit 必须识别该声明并输出 `TK_WIDGET_EXCLUDED_V1` 诊断，在 V1 Runtime Manifest/IR 中排除 Widget；启用 strict all-entry 构建时改为错误。不得静默丢弃，也不得因 CardDemo 的 `flex: 1` 扩大 V1 Host Contract。

联盟 Toolkit 已生成的 RPK/RPKS 只作为 inspect、行为和产物比对基线，不直接作为 Core 可执行输入。正式输入必须由本 Toolkit 从联盟 DSL 构建，并符合公共 Runtime Artifact Contract。

## 3. 权威合同

唯一公共合同：

```text
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/architecture.md
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/contracts/
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/spec/contracts/schemas/
```

Toolkit 不得重新定义 Runtime Artifact、Manifest/Metadata/Page IR/JS Bootstrap、App/Page Lifecycle、Capability、`LogicalNodeRef`、Render/Mount/Event/Navigation/Page Control、Runtime Error、Revision 或 Handler 生命周期。Release 签名草案不属于 V1 交付。

## 4. Spec 交付物

当前总 Spec 四件套：

- [需求](./requirements.md)
- [总体架构](./architecture.md)
- [分 Spec 索引](./subspec-index.md)
- [验收](./acceptance.md)

第五次定向复核 `PASS`；当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 TK-S01。

`subspec-index.md` 负责拆分 Compiler Pipeline、Artifact Emitter、Package、CLI、Testing 等分 Spec，并声明依赖顺序。总 Spec 校审通过前不得创建这些分 Spec；分 Spec 校审通过前不得编码。

Toolkit 总 Spec 不建立第二套 IR/Package Schema；公共 Schema 是唯一机器事实源。

## 5. 启动顺序

1. 确认 v3 总架构门禁已通过。
2. 阅读 `AGENT-HANDOFF.md` 和 v3 公共合同。
3. 研究 Case 001/002 源码、联盟 build 和 debug/release RPK。
4. 校审 Toolkit 总 Spec，不写分 Spec、不编码。
5. 总 Spec 通过后，按 `subspec-index.md` 编写并校审分 Spec。
6. 对应分 Spec 通过后才初始化代码工程。
7. 按纵向闭环实现：源码发现 -> IR -> Bundle -> RPK -> Case 001/002 Golden。
