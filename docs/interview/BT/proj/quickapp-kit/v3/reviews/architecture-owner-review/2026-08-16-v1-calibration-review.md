# V1 主链路范围校准

## 目录

- [1. 结论](#1-结论)
- [2. 产品本质](#2-产品本质)
- [3. 继续冻结](#3-继续冻结)
- [4. 第二期后置](#4-第二期后置)
- [5. Spec 放行规则](#5-spec-放行规则)

## 1. 结论

**总架构内核保持不变且可以指导分 Spec；此前阻塞来自外围合同和统一全量门禁过重，不来自单树 Runtime 设计。**

V1 校准为六组阻塞合同。签名、Skill/MCP、AI、完整权限、完整 Benchmark、外部框架对比和高级容灾只登记扩展位置，不参与分 Spec 放行。

## 2. 产品本质

```text
联盟 DSL
  -> Toolkit
  -> quickapp-kit-rpk(JS Bundle + Page IR + Metadata)
  -> JS Runtime + C++ Core
  -> Android / LVGL/SDL / iOS
  -> 可见、可点击、可更新、可导航
```

不能直接服务这条链路的设计，不得成为 V1 前置条件。

## 3. 继续冻结

1. JS 维护 state/Binding/Block/Handler，不维护 VNode Tree。
2. C++ Core 维护唯一 Runtime Tree，不执行完整新旧树 Diff。
3. JS 通过 Owner + Template ID 提交增量意图。
4. Core 输出 MountTransaction；Platform 只维护 Host Tree 和 NativeHandle 映射。
5. 事件由 Platform Input -> Core Event Router -> JS Handler 反向闭环。
6. Toolkit 输出自己的 Runtime RPK；联盟现成 RPK 只用于研究和行为对照。
7. Core/JS 从第一天是共享工程；Android 只负责首集成，不承载共享实现。
8. 平台顺序为 Android -> LVGL/SDL -> iOS；三端最终运行同一 Artifact/Core/JS。
9. 插件能力只保留 ModuleRegistry + typed Provider；完整权限 Guard 后置。
10. Case 001、Case 002、`BLOCK-001` 是 V1 唯一产品验收输入。

## 4. 第二期后置

| 项目 | 后置内容 |
|---|---|
| Toolkit 生态 | Skill/MCP、VS Code 插件、应用生成和 Agent tools |
| AI | AI Feature 与 Chat 组件 |
| 安全 | Release 签名、PackageOpenPolicy 和完整信任链 |
| 能力体系 | CapabilityGuard、完整权限、IDL/Codegen、动态插件治理 |
| Benchmark | 完整统计平台、外部框架公平对比和排名 |
| 渲染扩展 | 动画、复杂文本、完整字体排版、Widget/Card |
| 容灾 | 多级 Surface/进程恢复和完整故障组合矩阵 |

已有草案和 Schema 可以作为未来参考，但不得产生 V1 分 Spec 或代码任务。

## 5. Spec 放行规则

一个项目只需满足以下条件即可启动自身分 Spec：

1. 明确自己在六组阻塞合同中的输入和输出。
2. 每个运行时状态只有一个所有者。
3. 能用 Case 001/002/`BLOCK-001` 验收。
4. 第二期内容已明确标记为非门禁。

项目之间不再统一等待。Toolkit、Core、JS 可以并行设计分 Spec；Android 首先集成，LVGL/SDL 紧随其后，iOS 保留完整 Spec 并在前两端之后实现。
