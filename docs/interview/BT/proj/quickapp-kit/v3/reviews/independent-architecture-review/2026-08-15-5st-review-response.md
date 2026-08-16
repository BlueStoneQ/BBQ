# QuickApp Kit v3 五审整改响应

日期：2026-08-15  
角色：总架构

## 目录

- [1. 结论](#1-结论)
- [2. 核心决策](#2-核心决策)
- [3. P0 关闭情况](#3-p0-关闭情况)
- [4. P1 关闭情况](#4-p1-关闭情况)
- [5. 验证结果](#5-验证结果)
- [6. 门禁状态](#6-门禁状态)

## 1. 结论

五审提出的 3 个 P0 和 3 个 P1 均已落实到 v3 公共合同、机器 Schema、项目入口和自动测试中。当前状态是“具备六审条件”，不自行宣告架构通过；六审通过前仍不启动项目 Spec 和编码。

## 2. 核心决策

### 2.1 Runtime 输入

联盟 DSL 是 V1 源码兼容边界；联盟现成 RPK/RPKS 是 Case 001 行为与产物基线，不是 V1 Core 的直接可执行输入。

本 Toolkit 从联盟 DSL 生成 QuickApp Kit Runtime RPK，其中包含公共 Runtime Metadata、Page IR 和 JS Module ABI。原因只有一个：V1 的单一权威 Runtime Tree 位于 C++ Core，不能一边要求 C++ 消费 Page IR，一边又让 Core 直接执行“Template/Style/VM 全部嵌在 JS、没有 Page IR”的联盟包。

### 2.2 Surface 控制

C++ Core 管理权威 Surface 状态和 Navigation 栈；Platform Surface Adapter 只管理页面容器；Mount Adapter 只管理容器内部 Host Tree。三者不得合并语义。

### 2.3 Keyed move

V1 使用显式 `MoveHost`，不把“重复 Insert”解释成移动。这样 Android、UIKit 和 LVGL 对 detach/reinsert、索引和 NativeHandle 保留只有一种行为。

### 2.4 Handler 身份

`HandlerId` 是一次 EventBinding 的身份，不是 JS 函数身份。同一个函数绑定到多个目标时产生多个 HandlerId；单次 unregister 只删除一条绑定。

## 3. P0 关闭情况

| 五审问题 | 整改结果 | 公共事实源 |
|---|---|---|
| Toolkit -> Core/JS Artifact 合同缺失 | 冻结两类 RPK 边界、包布局、Manifest/Metadata/Page IR 关系、JS Module ABI、PackageSource、Loader 顺序、完整性与版本 | `spec/contracts/artifact-contract.md`；Manifest、Runtime Metadata、Page IR、JS Bootstrap Schema |
| Platform Surface typed 控制面缺失 | 冻结 Create/Present/Visibility/Destroy 命令与结果、隐藏首屏 Mount、push 原子展示、Core 栈提交和失败销毁顺序 | `spec/contracts/platform-surface-contract.md`；`platform-surface.schema.json` |
| MoveBlock 无唯一 Mount 语义 | 新增显式 `MoveHost`；冻结跨父移动、移除后最终 index、递归 RemoveHost、映射清理、full Mount 禁止 Move/Remove 和事务失败规则 | `spec/contracts/render-contract.md`；`block-lifecycle.md`；`mount-transaction.schema.json` |

## 4. P1 关闭情况

| 五审问题 | 整改结果 |
|---|---|
| HandlerId 粒度、复用和解绑键不清 | 冻结为 Surface 内唯一且不复用的绑定级 ID；建立正反向 EventBinding 索引；重复注册和缺失解绑均有 typed error |
| 测试未覆盖全部 union 分支 | 测试器按 Schema 顶层 `$defs` 自动核对 fixture 集，覆盖全部 55 个联合分支；每个分支同时验证未知字段拒绝 |
| Toolkit Handoff 研究路径错误 | 改为从 Handoff 文件可解析的 `../../../../v2/research/...` 路径 |

同时补齐首屏动态结构合同：`InstantiateTemplate` 必须携带 `initialBindings + initialBlocks + initialHandlers`，每个初始 Block 携带自身初值和 Handler。Core 在首个 full Mount 前原子建立完整 Runtime Tree 与 EventBinding，禁止先显示空数据或无事件页面。

## 5. 验证结果

执行：

```bash
cd spec/contracts/schemas/tests
npm test
npm ls --all
```

结果：

```text
Validated 16 schemas, 55 union branches, and Artifact relationships.
ajv@8.17.1 dependency tree valid
```

验证范围包括全部 Schema strict 编译、跨文件 `$ref`、全部顶层消息分支、`additionalProperties`、ID/Revision、成功/失败结果、full Mount 非法 MoveHost、包路径穿越，以及 Manifest/Metadata/Page IR/Bootstrap 跨产物一致性。

## 6. 门禁状态

| 工作 | 当前状态 |
|---|---|
| 五审整改与自动验证 | 完成 |
| 第六轮独立架构复核 | 可启动 |
| 各项目 Spec | 继续冻结，等待六审通过 |
| 任一项目编码 | 继续冻结，等待全部项目 Spec 独立校审通过 |
