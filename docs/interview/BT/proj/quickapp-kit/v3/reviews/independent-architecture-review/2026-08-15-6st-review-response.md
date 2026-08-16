# QuickApp Kit v3 六审整改响应

日期：2026-08-15  
角色：总架构

## 目录

- [1. 结论](#1-结论)
- [2. P0 关闭情况](#2-p0-关闭情况)
- [3. P1 关闭情况](#3-p1-关闭情况)
- [4. 核心决策](#4-核心决策)
- [5. 验证结果](#5-验证结果)
- [6. 门禁状态](#6-门禁状态)

## 1. 结论

六审提出的 2 个 P0 和 2 个 P1 已落实到 v3 公共合同、机器 Schema、项目入口和自动合同验证。当前状态是“具备七审条件”，不自行宣告总架构通过；七审通过前继续冻结全部项目 Spec 和产品编码。

## 2. P0 关闭情况

| 六审问题 | 整改结果 | 公共事实源 |
|---|---|---|
| Release RPK 签名合同仍留给项目 Spec | 冻结固定签名成员、二进制格式、规范签名输入、Ed25519/SHA-256、包外可信公钥、PackageOpenPolicy 和拒绝规则；Runtime Metadata 删除 `signaturePolicy` | `spec/contracts/artifact-contract.md`、`package-open-policy.schema.json`、`runtime-metadata.schema.json` |
| Root Surface 首次展示未闭环 | 冻结 `Create Host -> full Mount hidden -> Present root -> Core commit -> upper success`；Root/Push 的 Instantiate 成功统一表示已展示；冻结 Present failure、可见 Surface Destroy 和 push 原子状态转换 | `surface-control.md`、`platform-surface-contract.md`、`navigation-contract.md`、对应 Schema |

## 3. P1 关闭情况

| 六审问题 | 整改结果 |
|---|---|
| Page IR 树约束和语义测试不完整 | Node/Block 冻结为单根、全可达、无环、非 Root 入度为 1 的结构树；冻结 Block slot/parent/root 一致性和 Binding/Handler 显式 scope；增加 8 个图语义反例 |
| Artifact 关系覆盖不完整 | 增加 Manifest/Metadata page 双向映射、moduleId 全局唯一、dependency 白名单、app bootstrap、templateId 和 Artifact path 唯一性、未索引入口拒绝；增加 8 个关系反例和 10 个签名/信任案例 |

## 4. 核心决策

### 4.1 签名

V1 使用固定 `Ed25519 + SHA-256`。签名覆盖除签名文件自身和目录项外的全部 ZIP 成员，成员按 UTF-8 path bytes 排序；签名输入包含 keyId、成员路径、展开长度和内容 SHA-256。压缩方式、ZIP 时间戳和成员物理顺序不影响签名。

可信公钥只来自 Runtime Host 传入的 `PackageOpenPolicy`。Release 必须签名；Development 只有包外策略显式允许时才能无签名。包内 `buildMode` 不能降低安全级别。

### 4.2 首屏成功

首屏成功只有一个定义：

```text
Runtime Tree committed
  + full Mount succeeded
  + Platform Present succeeded
  + Core visible/navigation state committed
```

full Mount 成功但未 Present 仍不是上层成功。`InstantiateTemplateResult(status=presented)`、Root `CreateSurfaceResult(status=presented)` 和 `NavigationPushResult(status=presented)` 都服从该定义。

### 4.3 Page IR

Page IR 不是松散节点表，而是一棵由 Node edge、Block slot edge 和 Block root edge 共同组成的静态结构树。Binding/Handler 的 scope 由结构树派生并与显式声明相互校验，因此同一 IR 只能产生一种 Runtime Tree 所有权关系。

## 5. 验证结果

执行：

```bash
cd spec/contracts/schemas/tests
npm test
npm ls --all
```

结果：

```text
Validated 17 schemas, 55 union branches, 8 Page IR graph negatives,
8 Artifact relation negatives, and 10 signature cases.
ajv@8.17.1 dependency tree valid
```

签名测试使用固定 Ed25519 seed、公钥、规范 payload SHA-256 和 signature Golden；覆盖合法 release、无签名 release、无签名 development、release/development 篡改、添加成员、重复成员、未知 signer、重复可信 keyId 和畸形签名。

## 6. 门禁状态

| 工作 | 当前状态 |
|---|---|
| 六审整改与自动验证 | 完成 |
| 第七轮独立架构复核 | 可启动 |
| 各项目 Spec | 继续冻结，等待七审通过 |
| 任一项目编码 | 继续冻结，等待全部项目 Spec 独立校审通过 |
