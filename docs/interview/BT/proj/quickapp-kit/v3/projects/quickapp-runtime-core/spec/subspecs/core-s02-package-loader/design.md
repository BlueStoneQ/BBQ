# CORE-S02 设计

## 目录

- [1. 结论](#1-结论)
- [2. 模块与状态机](#2-模块与状态机)
- [3. PackageSource](#3-packagesource)
- [4. ZIP 与验证管线](#4-zip-与验证管线)
- [5. Verified 对象](#5-verified-对象)
- [6. Page IR Cache](#6-page-ir-cache)
- [7. Verified Module](#7-verified-module)
- [8. 线程与所有权](#8-线程与所有权)
- [9. 错误](#9-错误)
- [10. 观测与计数](#10-观测与计数)
- [11. 销毁与晚到结果](#11-销毁与晚到结果)
- [12. 边界不变量](#12-边界不变量)

## 1. 结论

采用“异步随机读 + 分阶段 fail-closed 校验 + immutable verified handle + 有界 pinned cache”。Loader 不向下游暴露解析器、ZIP 成员或未验证字节；S05 永远看不到 ZIP/JSON/Bundle。

## 2. 模块与状态机

```text
PackageSession
  PackageSourceGateway
  ZipIndexReader
  ArtifactValidator
  PageIrRepository + PageIrCache
  VerifiedModuleService
```

状态固定为：

```text
closed -> opened -> indexed -> verified -> executable -> closed
              \         \          \
               ---------- failed ----
```

- 每次状态跃迁只在 Core Runtime Thread 完成。
- `failed` 是终态，只允许 close；不得继续读 Bundle 或发布部分结果。
- `executable` 表示包合同与组合预检通过，不表示任何模块已经执行。

## 3. PackageSource

概念接口：

```cpp
class PackageSource {
 public:
  virtual Result<uint64_t> size() noexcept = 0;
  virtual Result<Accepted> readAt(PackageReadRequest&&) noexcept = 0;
  virtual void close() noexcept = 0;
};

struct PackageReadRequest {
  RequestId requestId;
  uint64_t offset;
  uint64_t length;
  PackageReadCompletion completion;
};
```

- completion 返回 immutable owned bytes 或 `PackageReadError`，并通过 Core ingress 恢复状态机。
- V1 每个 Package Session 最多一个在途 source read，简化顺序、取消和 scratch 内存上限。
- `offset + length` 必须 checked，结果必须恰好为请求长度；短读是 `PACKAGE_IO_ERROR`。
- 重复 completion 只接受第一次，之后作为协议违规丢弃并记录诊断；不能二次推进状态机。
- Session 独占 Source，close 恰好一次。Source 实现不得回调 Session 裸指针。

## 4. ZIP 与验证管线

固定顺序：

1. 读取 size 和 End of Central Directory，验证 V1 package 总大小。
2. 读取中央目录，验证成员数、偏移、长度、方法和 checked 总量。
3. 规范化所有路径并拒绝非法、重复、目录穿越和特殊文件。
4. 读取并校验 `manifest.json` 与 `quickapp-kit/runtime.json`。
5. 建立 descriptor 索引，验证成员覆盖、固定版本和跨文件关系。
6. 逐页读取、摘要校验、Schema 解析和 Page IR 图校验，聚合 required components。
7. 执行 Runtime Composition 预检。
8. 原子发布 `VerifiedPackage`，状态进入 executable。

实现必须使用成熟 ZIP/DEFLATE 与结构化 JSON 解析库，并在库边界转换错误；禁止手写压缩算法或用字符串扫描 JSON。Local header 必须与中央目录的名称、方法和尺寸语义一致。解压输出采用固定上限 sink，超过声明长度或上限立即终止。

## 5. Verified 对象

```cpp
struct VerifiedPackage final {
  PackageId packageId;
  VerifiedManifest manifest;
  VerifiedRuntimeMetadata metadata;
  ImmutableMemberIndex members;
  ImmutablePageDescriptorIndex pages;
  ImmutableModuleDescriptorIndex modules;
  VerifiedComposition composition;
  PackageSessionLease sourceLease;
};

struct VerifiedPageIr final {
  Route route;
  TemplateId templateId;
  Sha256 digest;
  ImmutableNodeTable nodes;
  ImmutableBindingTable bindings;
  ImmutableBlockTable blocks;
  ImmutableHandlerTable handlers;
  ImmutableLookupIndexes indexes;
};

using PageIrHandle = PinnedImmutableHandle<VerifiedPageIr>;
```

- `VerifiedPackage` 发布后字段不可修改；只读索引可以共享。
- `VerifiedPageIr` 是静态定义表，不是对象树，也不含任何运行时实例 ID。
- `PageIrHandle` 的 pin 生命周期至少覆盖使用它的 Surface Runtime Tree。
- `sourceLease` 保证按需重载 Page IR 或模块期间 Source 仍存活；它不向下游暴露 Source。

## 6. Page IR Cache

缓存键：

```text
(PackageId, Route, TemplateId, descriptor.sha256)
```

entry 状态：`loading -> ready -> evictable`，失败不入 cache。

- 预算按 normalized tables、indexes 和拥有字符串的实际容量计费，不按 JSON 文件长度计费。
- 获取 ready entry 时增加 pin，返回 `PageIrHandle`；handle 销毁时 unpin。
- eviction 只选择 `pin == 0` 的 LRU ready entry，直到满足预算。
- 被 pin entry 即使包关闭请求到达也先由 Surface teardown 释放；Package teardown 必须等待/取消 Surface 后再释放 cache。
- 打开包时全部 Page IR 都经同一 parser/validator；预检结束后未 pin entry 可立即成为 evictable。
- cache miss 重读成员时必须再次校验 descriptor、长度、CRC 和 SHA-256，结果不得依赖先前解析副作用。
- cache 不是权威状态。驱逐后重新加载必须生成语义相同的 immutable Page IR。

## 7. Verified Module

概念服务：

```cpp
Result<Accepted> loadVerifiedModule(VerifiedModuleRequest&&) noexcept;
```

流程：descriptor lookup -> scope/dependency/expected ABI 校验 -> source read -> bounded decompress -> CRC/SHA-256 -> immutable bytes -> `VerifiedModule` -> JS Port。

- 只有 S02 能创建 `VerifiedModule`。
- app/shared 请求填写 AppRuntime cache scope，page 请求填写 Surface cache scope；实际 Module Cache 由 JS Runtime 独占，S02 不复制该状态。
- 每个 AppRuntime 同时只允许一个已交付、尚未返回 Result 的 module load；后续请求只在 CORE-S01 有界 ingress 中保留 descriptor，不提前读取 Bundle bytes。
- 模块字节采用不可变 shared ownership 或一次性 move；JS Port 接受后 Core 不保留可变别名。
- `VerifiedModule` 创建只表示 Core 输入验证完成；后续 `LoadVerifiedModuleResult.loaded` 必须严格采用公共 Module Load Contract 的语义：JS 已完成 define/bootstrap/export 校验并提交对应模块缓存，但尚未完成 VM 初始化或 Mount。
- Bundle 绝不进入 Page IR cache；S02 只在当前 read/handoff 生命周期持有 bytes，Result 或取消后立即释放。

## 8. 线程与所有权

| 对象 | 所有者/写者 | 跨边界 |
|---|---|---|
| Package Session/state/index | Core Runtime Thread | 不跨线程共享可变引用 |
| PackageSource | Session 独占；外围执行 read | completion 转 immutable bytes |
| VerifiedPackage | 发布后 immutable shared ownership | 下游只读 handle |
| Page IR cache | Core Runtime Thread | `PageIrHandle` 只读且 pin |
| VerifiedModule bytes | request/result 生命周期 | immutable share 或 move |
| ZIP/JSON scratch | 当前 Loader operation | 不跨 completion 保留裸 view |

S02 不创建额外 worker 语义。具体外围可异步完成 I/O，但所有 Loader 状态推进、cache 写入和结果发布都回到 Core Runtime Thread。

## 9. 错误

| 场景 | 错误 |
|---|---|
| 无 Runtime Metadata / 格式不支持 | `PACKAGE_FORMAT_UNSUPPORTED` |
| Source 关闭、短读、越界、I/O 失败 | `PACKAGE_IO_ERROR` |
| ZIP 结构破损或压缩特征非法 | `PACKAGE_INVALID` |
| 非法路径、重复成员、声明成员缺失或 descriptor 覆盖不一致 | `PACKAGE_ENTRY_INVALID` |
| packageFormat 不受支持 | `PACKAGE_FORMAT_UNSUPPORTED` |
| package/runtime 版本不受支持 | `PACKAGE_VERSION_UNSUPPORTED` |
| Page IR Schema、图、scope 或静态 ID 非法 | `IR_INVALID` |
| JS Module ABI 不受支持 | `MODULE_ABI_UNSUPPORTED` |
| Manifest/Metadata Schema 或跨文件语义关系非法 | `PACKAGE_INVALID` |
| descriptor path/length/hash/CRC 不一致 | `PACKAGE_INTEGRITY_FAILED` |
| 组合缺失必需组件、能力或 service | `RUNTIME_PROFILE_INCOMPATIBLE` |
| 超资源上限、cache 无可驱逐空间、分配失败 | `OUT_OF_MEMORY` |
| 请求队列满 | `QUEUE_OVERFLOW` |
| Metadata 声明的成员不存在 | `PACKAGE_ENTRY_INVALID` |

错误必须携带公共 `RuntimeError` 允许的关联字段；包身份作为结构化 Trace 字段关联，不能擅自扩张 `RuntimeError`。失败前创建的临时对象全部释放，错误信息不得包含未清洗的任意包内容。

## 10. 观测与计数

- 包：`package.open.started`、`package.verified`、`package.failed`。
- 模块：`module.load.started`、`module.load.completed`、`module.load.failed`。
- 事件使用 CORE-S01 clock、sequence、TraceSink 和公共关联 ID。
- cache bytes、pins、在途 reads/modules 作为测试快照，不扩张公共 RuntimeCounters 闭集。
- 热路径不格式化 ZIP/JSON 文本，不做文件 I/O；Noop 与 Recording 行为等价。

## 11. 销毁与晚到结果

```text
stop accepting package/module requests
-> cancel logical requests and close Core-facing gateways
-> close PackageSource
-> absorb/reject late completion by RequestId tombstone
-> release module bytes and unpinned Page IR
-> after Surface handles released, release pinned entries
-> release VerifiedPackage/source lease/session
```

- close 幂等；每个已接受请求必须得到一个终态结果或按已冻结 tombstone 规则吸收。
- late completion 只能释放自己的 bytes，不能重新打开 Session、写 cache 或发布结果。
- 稳定结束时 `inFlightReads=0`、`inFlightModules=0`、`cachePins=0`、`cacheBytes=0`、`openSources=0`。

## 12. 边界不变量

1. 未 verified 的数据不能进入任何下游 Port。
2. S02 不拥有 Surface、Runtime Tree、NodeId、BlockInstanceId 或 HandlerId。
3. S05 只接收 `PageIrHandle`，不能访问 Source、ZIP、JSON 和 Bundle。
4. Cache 只保留静态不可变 Page IR，不构成第二棵权威树。
5. 具体平台和执行引擎只能位于 Port 实现或 Composition Root，不进入 Loader 类型。
