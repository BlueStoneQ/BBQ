# IOS-S01 实施任务

## 目录

- [1. 结论](#1-结论)
- [2. 门禁](#2-门禁)
- [3. 有序任务](#3-有序任务)
- [4. 完成定义](#4-完成定义)

## 1. 结论

产品代码放行后，按“测试支架 -> Composition -> PackageSource -> Host -> lifecycle -> 资源与证据”的顺序实现。每项任务都必须保持 UIKit/Gateway/Collector 在边界之外。

## 2. 门禁

- 本分 Spec 独立校审通过。
- `AGENT-WORK-BOARD.md` 显式将 IOS-S01 设置为 `CODE_ALLOWED`。
- CORE-S01/JS-S01 的实际 Port 若尚未完成，先用本地 Fake 对齐，不复制公共实现。
- 公共合同发生差异时写 `[待决策]`，暂停受影响任务。

## 3. 有序任务

| ID | 任务 | 依赖 | 产出/测试 |
|---|---|---|---|
| IOS-S01-T01 | 建立 iOS Runtime Host library/test target 与 Fake Core/Engine/Ports | 门禁 | 不链接 UIKit 业务 Adapter 的测试可运行 |
| IOS-S01-T02 | 实现 Build Profile 校验、单 Engine 选择、观测矩阵和 immutable RuntimeDependencies | T01 | zero/two Engine、ABI 不兼容、`v1/off` 与 custom 三种 level 正负例 |
| IOS-S01-T03 | 生成 Composition Manifest 与 describe，并接入 Schema fixture 校验 | T02 | Manifest 正反例、唯一 module 校验 |
| IOS-S01-T04 | 增加 link map/symbol inventory 一致性构建检查 | T03 | 一次 JS Framework、一个 Engine 的构建证据 |
| IOS-S01-T05 | 实现 immutable Data PackageSource | T01 | slice、越界、close、可变输入隔离测试 |
| IOS-S01-T06 | 实现 file/Bundle PackageSource 与 I/O executor | T05 | random read、短读、删除/错误、close race 测试 |
| IOS-S01-T07 | 实现 Profile 严格校验和 AppRuntimeSession 未发布装配 | T02、T03、T05 | 非 iOS target/非法字段、部分构造回滚测试 |
| IOS-S01-T08 | 实现 Root 启动协调与 `presented` 唯一成功判据 | T07 | created/mounted 不成功、present failed 清理测试 |
| IOS-S01-T09 | 实现 raw Scene admission、前置去重和 accepted RuntimeLifecycleControl 关联表 | T08 | 去重不生成 ID；accepted 请求不合并；唯一 Result 与 `LIFECYCLE_BUSY` 原样透传测试 |
| IOS-S01-T10 | 实现 destroy、晚到信号隔离和逆序资源释放 | T09 | normal/failure/repeated destroy、引用归零测试 |
| IOS-S01-T11 | 按冻结矩阵接入 Noop/Recording Sink | T02、T07 | `custom/off` Noop；v1/custom baseline/diagnostic Recording；`v1/off` 拒绝；合法 Sink 下行为等价 |
| IOS-S01-T12 | 完成 sanitizers、线程与泄漏证据，更新实现交接 | T04、T06、T10、T11 | acceptance 全部证据 |

## 4. 完成定义

- 所有 [验收项](./acceptance.md) 通过。
- 需求 IOS-S01-R01..R12 均至少由一个自动化测试覆盖。
- 无 UIKit/Foundation 类型进入共享 Core/JS 公共头文件。
- 无产品代码复制公共 Loader、Lifecycle 或 JS Framework。
- 资源、线程和失败测试可重复，未使用时间等待代替确定同步。
- Handoff 记录实现结果、证据、剩余待验证项和公共合同影响。
