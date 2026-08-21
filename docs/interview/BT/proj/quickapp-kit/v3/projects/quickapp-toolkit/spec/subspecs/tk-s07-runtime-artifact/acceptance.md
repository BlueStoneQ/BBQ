# TK-S07 Acceptance

## 目录

- [1. 结论](#1-结论)
- [2. 验收输入](#2-验收输入)
- [3. Case 001](#3-case-001)
- [4. Core Loader](#4-core-loader)
- [5. 失败与安全](#5-失败与安全)
- [6. 确定性与门禁](#6-确定性与门禁)
- [7. 证据映射](#7-证据映射)
- [8. 禁止事项验收](#8-禁止事项验收)

## 1. 结论

TK-S07 通过的必要条件是：真实 Case 001 源码经 Toolkit 前序阶段产生的 Bundle/Page IR，能够组成一个 Schema 合法、关系闭合、字节确定且 Core `PackageLoader` 可读取的 Runtime RPK；失败和取消不能产生部分 RPK。

## 2. 验收输入

验收使用：

```text
Case: quickapp-code-test1
Source manifest: quickapp-examples/quickapp-code-test1/src/manifest.json
Runtime RPK: evidence/tk-s07-case001.rpk
```

输入必须由同一 S04 Canonical Lowered Model 投影到 S05/S06；S07 产品实现不得重新解析 UX/JS/Style。集成测试可以调用已验证的上游 Pipeline，为 S07 构造真实、同源输入。

## 3. Case 001

### 3.1 结构

必须存在：

- `manifest.json`。
- `quickapp-kit/runtime.json`。
- `app.js`。
- Case 001 的 App/Shared/Page Bundle。
- 两个 Page IR：Demo、DemoDetail。
- `assets/images/logo.png`。
- 每个 JS Bundle 对应的 `META-INF/quickapp-kit/source-maps/**`。

已验证结果：19 个成员，22029 bytes，SHA-256：

```text
95648dd40a32bc7b28830f301f6db9443decb4dbd1138d43a54c73410168b7c4
```

### 3.2 关系

```text
entryRoute = /pages/Demo
Demo Bundle = pages/pages/Demo/index.js
Demo Page IR = quickapp-kit/pages/pages/Demo/index.ir.json
Demo moduleId = @quickapp-kit/page/pages/Demo
Demo Page IR templateId == Runtime Metadata templateId
App/Shared/Page define dependencies == Runtime Metadata dependencies
Package dependencies contain package modules only
```

`pages/pages/Demo` 是 `pages/<manifestRoute>` 公式对 `manifestRoute=pages/Demo` 的直接结果，属于已验证事实。

### 3.3 Descriptor

对所有 19 个 member：

```text
descriptor.byteLength == actual member byte length
descriptor.sha256 == SHA-256(actual member bytes)
path is safe and unique
```

## 4. Core Loader

使用真实 Core PackageLoader 验证：

1. `PackageLoader::open` 成功。
2. `load_module(@quickapp-kit/app)` 成功。
3. `load_module(@quickapp-kit/page/pages/Demo, SurfaceId)` 成功。
4. `load_page_ir(/pages/Demo)` 成功。
5. Page IR Template ID 返回 `page:/pages/Demo`。

机器输出：

```text
CORE_PACKAGE_LOADER_PASS package=com.example.case1 app=1 page=1 page_ir=page:/pages/Demo
```

这证明 RPK 满足当前 Core Loader 的格式、Manifest、Runtime Metadata、Descriptor、Page IR 和 Module 关系检查；不代表已完成 Platform Render 或完整 Runtime 行为。

## 5. 失败与安全

| 场景 | 预期 |
|---|---|
| 缺失 Page Bundle/Page IR | 关系失败，无 `packageBytes` |
| Manifest/Page 闭包不一致 | 关系失败，无 members/metadata |
| 非法或重复 member path | 路径失败 |
| Manifest/Metadata/Page IR 超预算 | 预算失败 |
| Package/member/central directory 超预算 | 预算失败 |
| 输入未深冻结 | 输入失败 |
| CancellationToken 已取消 | `TK_ARTIFACT_CANCELLED` |
| Schema validator 失败 | Schema Diagnostic |
| 任意失败 | 不发布部分 RPK |

路径规则禁止绝对路径、反斜线、NUL、`.`、`..`、空 path segment 和超长 UTF-8 path。Core 对齐预算为：Package 32 MiB、展开包 64 MiB、members 2048、member 16 MiB、central directory 2 MiB、pages 128、Manifest/Metadata 1 MiB、Page IR 4 MiB。

## 6. 确定性与门禁

同一输入重复构建必须得到完全相同的：

- Runtime Metadata JSON bytes。
- member path 顺序。
- member bytes。
- ZIP bytes。
- Package SHA-256。

已通过：

```text
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
npm test           76/76 PASS
npm run test:cli   17/17 PASS
unzip -t           PASS (19/19 members)
Core PackageLoader PASS
```

## 7. 证据映射

| 验收项 | 证据 |
|---|---|
| 源 Manifest | `evidence/tk-s07-case001-manifest.json` |
| RPK bytes/SHA-256 | `evidence/tk-s07-case001.rpk`、`evidence/tk-s07.json` |
| Member/Descriptor/关系/确定性 | `test/integration/runtime-artifact.test.ts`、`evidence/tk-s07.json` |
| ZIP 解包检查 | `evidence/tk-s07.json`、`unzip -t` 结果 |
| Core Loader | `evidence/tk-s07-core-loader.txt` |
| Source manifest | `evidence/tk-s07-source-manifest.json` |
| R01-R06 输入与关系闭包 | `runtime-artifact.test.ts` Case 001、relation negative |
| R07-R14 Metadata/Descriptor/RPK | `runtime-artifact-builder.ts`、`tk-s07.json`、`unzip -t` |
| R15-R20 安全与资源 | Builder path/limit checks、boundary scan、上游资源快照输入、Case 001 resource member |
| R21-R25 失败与确定性 | cancellation/relation/budget negatives、repeat-build byte equality |
| R26-R28 Case/Core/evidence | `tk-s07-case001.rpk`、`tk-s07-core-loader.txt`、source manifest |
| R29-R30 禁止范围/公共合同 | boundary scan、Toolkit Handoff、总架构 Alpha 校审 |

## 8. 禁止事项验收

以下均必须保持未实现：

- 签名和 RPKS。
- 完整 `inspect`/`run` 与 TK-S08。
- TK-S09 Golden orchestrator。
- Skill/MCP、AI Feature、Chat 组件和后续生态能力。
- 对 S05/S06 的扩展或 RPK 字节重建。
