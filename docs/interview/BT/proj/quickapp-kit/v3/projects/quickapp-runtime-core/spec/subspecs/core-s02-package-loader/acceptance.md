# CORE-S02 验收

## 目录

- [1. 结论](#1-结论)
- [2. 验收矩阵](#2-验收矩阵)
- [3. Cache 专项](#3-cache-专项)
- [4. 线程与资源](#4-线程与资源)
- [5. 边界扫描](#5-边界扫描)
- [6. 证据](#6-证据)

## 1. 结论

验收通过的含义不是“能解压”，而是：任意不可信输入只能得到完整 verified 输出或单一失败，且失败、取消、驱逐和销毁都不泄漏状态或资源。

## 2. 验收矩阵

| ID | 场景 | 预期 |
|---|---|---|
| S02-A01 | Case 001 合法 Runtime RPK | 状态到 executable；Manifest/Metadata/Page IR/模块均可通过 typed handle 查询 |
| S02-A02 | 缺少 Runtime Metadata | `PACKAGE_FORMAT_UNSUPPORTED`，零 Bundle 交付 |
| S02-A03 | 绝对路径、`..`、反斜杠、规范化重复成员 | `PACKAGE_ENTRY_INVALID`，无成员读取越界 |
| S02-A04 | 加密、多卷、ZIP64、非 Store/Deflate、symlink | 在索引阶段拒绝 |
| S02-A05 | offset/size 溢出、短读、损坏 local header | typed failure，Session 进入 failed |
| S02-A06 | 超 package/member/count/path/depth/ratio 限制 | 分配或解压前拒绝，无预算突破 |
| S02-A07 | package/runtime 版本、JS Module ABI、Page IR 分别错误 | 分别为 `PACKAGE_VERSION_UNSUPPORTED`、`MODULE_ABI_UNSUPPORTED`、`IR_INVALID` |
| S02-A08 | route/page/entry/module/dependency 关系错误 | typed failure，错误稳定 |
| S02-A09 | descriptor 长度、CRC 或 SHA-256 不匹配 | `PACKAGE_INTEGRITY_FAILED` |
| S02-A10 | Page IR 环、不可达、多父、重复 ID、scope/target 错误 | typed failure，未形成 PageIrHandle |
| S02-A11 | Runtime Composition 缺少必需项 | `RUNTIME_PROFILE_INCOMPATIBLE`，JS 未启动 |
| S02-A12 | module scope/expected ABI/dependency 不匹配 | module failed，缓存不污染 |
| S02-A13 | Source OOM/关闭/重复 completion/late completion | 每个请求最多一个终态；无状态复活 |
| S02-A14 | TraceSink Noop/Recording/Recording-full | Loader 业务输出和顺序完全一致 |
| S02-A15 | 同一 AppRuntime 并发请求两个 module load | 第二个不提前读取 bytes；首个终态后再启动，cacheScope 正确 |
| S02-A16 | ZIP 可读成员与 Metadata descriptors 任一方向存在额外项 | `PACKAGE_ENTRY_INVALID`，零 Bundle 交付 |

## 3. Cache 专项

1. 填满 8 MiB 预算后按 LRU 驱逐未 pin entry，计费不超预算。
2. Surface 持有 `PageIrHandle` 时，即使它最旧也不能驱逐。
3. 全部 entry 被 pin 且新页无法容纳时返回 `OUT_OF_MEMORY`，既有 handles 仍有效。
4. 最后一个 handle 释放后 entry 可驱逐；重载后 Page IR typed 内容和摘要一致。
5. 解析失败、摘要失败和 OOM 不创建半成品 entry。
6. Package teardown 前释放全部 Surface handles；结束后 pins/bytes/entries 为零。

## 4. 线程与资源

- 至少两个异步 Source 实现顺序组合，验证状态只由 Core Runtime Thread 推进。
- close 与 completion 竞争重复运行，验证无二次回调、UAF、死锁和状态复活。
- accepted read/module 请求全部有一个终态；未 accepted 请求不转移所有权。
- ASan/UBSan 验证恶意长度和 parser 失败；TSan 验证 read completion/close 竞争。
- 稳定 teardown：`inFlightReads=0`、`inFlightModules=0`、`cachePins=0`、`cacheBytes=0`、`openSources=0`。

## 5. 边界扫描

- S02 生产代码不得引用 Runtime Tree、Runtime Node、Block 实例和 Handler 实例类型。
- S02 公共接口不得出现具体平台、文件句柄、流或具体执行引擎类型。
- `VerifiedPageIr` 不含运行时 ID；`VerifiedModule` 不含路径、fd 和可变 bytes。
- S05 测试只能通过 `PageIrHandle` Fake 输入，不能读取 ZIP/JSON/Bundle。

## 6. 证据

实现复核必须提交：

- requirement/test 对照表。
- 合法 Case 001 与全部负例输出摘要。
- cache pin/evict/OOM 和重复加载证据。
- Release、ASan/UBSan、TSan、依赖扫描结果。
- 资源归零和 Noop/Recording 等价快照。
