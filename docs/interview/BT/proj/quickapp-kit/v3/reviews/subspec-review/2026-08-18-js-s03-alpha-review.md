# JS-S03 与 M1-Alpha JS-S04 校审

## 目录

- [1. 结论](#1-结论)
- [2. 已验证事实](#2-已验证事实)
- [3. 必须修正](#3-必须修正)
- [4. 验收边界](#4-验收边界)
- [5. 给 JS Agent 的指令](#5-给-js-agent-的指令)

## 1. 结论

结论：**JS Agent 已完成主体编码，但当前不能标记 VERIFIED，也不能推进 JS-S05。结论为 `IMPLEMENTATION_CORRECTION_REQUIRED`。**

这不是架构推翻，代码主体可以保留；必须先修正证据一致性、RequestId 所有权和 Alpha 证据命名。

| 项目 | 当前判断 | 门禁 |
|---|---|---|
| JS-S03 Module Loader | 实现存在，行为测试通过；独立 source manifest 失效 | `IMPLEMENTATION_CORRECTION_REQUIRED` |
| M1-Alpha JS-S04 initial-only | 合成垂直切片存在，测试通过；不是 Case 001 真 RPK 验证 | `COMPONENT_EVIDENCE_ONLY` |
| 完整 JS-S04 | 未完成 | `CODE_BLOCKED` |
| JS-S05 及以后 | 未启动 | `CODE_BLOCKED` |

## 2. 已验证事实

1. JS-S03 Debug、Release、ASan/UBSan、TSan 均为 `7/7 PASS`。
2. Alpha JS-S04 Debug、Release、ASan/UBSan、TSan 均为 `9/9 PASS`。
3. JS-S03 的独立摘要校验有 3 个失败项：`CMakeLists.txt`、`include/quickapp/js/module/module_loader.h`、`src/module/module_loader.cpp`。这意味着证据不能代表当前源码状态。
4. JS-S04 Alpha 测试使用合成模块 `app`、`pages/index` 和 `tpl:pages/index`，绑定值为 `Hello` 与 `true`；没有消费 Toolkit 生成的 Case 001 RPK。
5. 当前代码没有新增第二条 Bridge、VNode Tree、Platform 类型或平台私有逻辑；JS-S03 的 immutable bytes 边界仍然正确。

## 3. 必须修正

### 3.1 修正 JS-S03 source manifest

最终源码状态确定后，重新生成 `evidence/js-s03/source-manifest.sha256`，并执行：

```sh
shasum -a 256 -c evidence/js-s03/source-manifest.sha256
```

所有条目必须通过。不要用旧 manifest 覆盖当前实现，也不要把 S04 专属文件伪装成 S03 独立证据。

### 3.2 移除 VmLifecycleService 的局部 RequestId 分配器

当前 `VmLifecycleService::nextRequestId()` 和 `nextRequestId_{1}` 是错误的所有权设计。公共 ID 合同规定：每个 AppRuntime 只有一个由 JS Framework bootstrap 创建的 `JsRequestIdAllocator`，Navigation、Capability、Handler 等所有请求模块共享它。

修正要求：

- `VmLifecycleService` 不得拥有或生成 RequestId 序列。
- 通过 JS Framework 级共享 allocator/port 注入使用；不要把 allocator 放入 C++ Core、Runtime ABI Client、Native Function 或 JS-S02。
- 添加至少两个请求生产者交错取号的测试，证明不会各自从 `req:j-1` 开始。
- 保持已有 wire 格式 `req:j-<positive-decimal>` 和 AppRuntime 生命周期内不复用。

### 3.3 重新标记 Alpha 证据

`js-s04-alpha-evidence.md` 可以保留，但必须明确它是 **JS 组件级合成证据**，不能宣称 Case 001 S1 已通过，也不能替代真实 Toolkit RPK 集成证据。

真实 Alpha 验收必须等待 Toolkit 产出真实 RPK，并验证真实标题、页面路由、Template/Page IR 与实际模块字节进入 JS Loader；在此之前，Alpha 只能保持 `IN_PROGRESS / COMPONENT_REVIEW`，S1 不能标记通过。

## 4. 验收边界

- 本次不要求实现完整响应式状态、Block、Event、Navigation、Capability 或完整 Lifecycle。
- 本次不启动 JS-S05，不改变公共 ABI、Schema、Runtime Tree 或 Render Contract。
- JS-S03 修正 manifest 和共享 allocator 后，才能再次进入总架构实现复核。
- Alpha JS-S04 只可作为后续真实 RPK 集成的基础组件证据。

## 5. 给 JS Agent 的指令

```text
继续当前 JS Runtime 对话。

本次校审结论：JS-S03 行为实现可保留，但 source manifest 失效；M1-Alpha JS-S04 仅接受为合成组件证据，不能宣称 Case 001 或完整 JS-S04 已通过。

只做以下修正：
1. 在最终集成源码状态下重新生成 evidence/js-s03/source-manifest.sha256，并用 shasum -a 256 -c 全部通过。
2. 删除 VmLifecycleService 自有的 nextRequestId_ 和 nextRequestId()；改为消费 JS Framework bootstrap 创建、AppRuntime 级共享的 allocator/port。不要把 allocator 放进 C++、Runtime ABI Client、Native Function 或 JS-S02。
3. 增加两个请求生产者交错取号的唯一性测试，证明共享 req:j-<positive-decimal> 序列不会碰撞。
4. 将 js-s04-alpha-evidence.md 明确标记为 synthetic/component evidence；不要声称 Case 001、真实 RPK 或完整 JS-S04 已通过。
5. 更新 AGENT-HANDOFF.md，提交修正后的 evidence、source manifest、构建测试结果并标记 READY_FOR_REVIEW。

不要启动 JS-S05，不要实现完整 JS-S04 生命周期，不要修改公共合同、Schema 或 Runtime ABI。
```
