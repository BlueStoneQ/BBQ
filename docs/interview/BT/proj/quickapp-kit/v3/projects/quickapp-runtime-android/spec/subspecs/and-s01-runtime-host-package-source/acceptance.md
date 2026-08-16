# AND-S01 验收

## 目录
- [1. 结论](#1-结论)
- [2. 验收环境](#2-验收环境)
- [3. Composition](#3-composition)
- [4. PackageSource](#4-packagesource)
- [5. Host 与生命周期](#5-host-与生命周期)
- [6. 观测、资源与通过条件](#6-观测资源与通过条件)

## 1. 结论
AND-S01 的通过证据是：不依赖 JNI/View 的 Fake Core 测试证明 Host 只负责装配和转发，且任一失败都不会提前成功或泄漏 package/runtime 资源。

## 2. 验收环境
- Fake Core Runtime Factory：记录依赖和调用，可延迟或注入 typed Result。
- Fake JS Engine Provider：暴露 identity/ABI，不执行 Bundle。
- Fake Package backend：正常、短读、越界、I/O error、延迟 completion、close race。
- Noop 与 Recording TraceSink。
- Manifest Schema validator 与 Fake build inventory；真实 APK/native link map/symbol inventory 是 AND-S08/AND-S09 输入。

## 3. Composition
| Case | 输入/故障 | 期望 |
|---|---|---|
| C01 | V1 Android + QuickJS + baseline | 成功；Core 收到 immutable Manifest 与显式依赖 |
| C02 | 0 或 2 个 Engine | 失败，Core 未创建 |
| C03 | Engine identity/moduleId/ABI 不一致 | `MODULE_ABI_UNSUPPORTED`，不 fallback |
| C04 | `conformance=v1 + observationLevel=off` | 组成失败 |
| C05 | Artifact 需求超出 Manifest | JS 前返回 `RUNTIME_PROFILE_INCOMPATIBLE` |
| C06 | describe composition | 与嵌入 Manifest 一致，不经过 Runtime Bridge |
| C07 | Fake inventory 与 Manifest 一致 | S01 隔离组成成功，只证明消费和校验逻辑 |
| C08 | Fake inventory 缺少/重复 module 或 `binaryBytes` 不同 | `RUNTIME_PROFILE_INCOMPATIBLE`；不得宣称真实链接已验证 |

最终集成门禁：AND-S08/AND-S09 必须用真实 APK/native link map 与 symbol inventory 证明 `runtime.js-framework` 恰好一次、Engine module 恰好一个、未选模块不进入链接；该证据不属于 S01 隔离通过条件。

## 4. PackageSource
file、Asset、memory 后端分别执行：

| Case | 操作 | 期望 |
|---|---|---|
| P01 | 首、中、尾随机读取 | bytes 精确、immutable，Core queue completion 恰好一次 |
| P02 | `length=0` | 成功返回空 bytes |
| P03 | 加法溢出或越界 | `PACKAGE_IO_ERROR`，无非法后端读取 |
| P04 | 短读或异常 | `PACKAGE_IO_ERROR`，无部分成功 |
| P05 | close 后 read | `PACKAGE_IO_ERROR` |
| P06 | read/close 竞争 | 单次 completion，无悬空 Host/Activity 引用 |
| P07 | 调用方修改原内存 | Runtime 持有的 bytes 不变化 |
| P08 | 阻塞后端 | I/O 不在 Android UI Thread |
| P09 | File open 后原路径被替换 | 继续读取 open 时的原资源，或稳定 `PACKAGE_IO_ERROR`；绝不读取新路径 |
| P10 | 已打开的原资源被截断并产生短读 | `PACKAGE_IO_ERROR`，不返回部分 bytes |
| P11 | File read 已入 I/O queue，随后 close 抢先 | Core queue completion 恰好一次且为 `PACKAGE_IO_ERROR` |

## 5. Host 与生命周期
| Case | Fake Core 行为 | 期望 |
|---|---|---|
| H01 | Root `presented` | 结果后才进入 running 并成功 |
| H02 | Activity/Window 已创建，Root pending | 不成功 |
| H03 | 包、初始化、Mount 或 Present 失败 | 原 typed error；清理并 close Source |
| H04 | 第二次 start | 拒绝，不创建第二 AppRuntime |
| H05 | foreground/background | 只发公共 control，等待同 requestId/action |
| H06 | `LIFECYCLE_BUSY` | 原样返回，不直接调用 Hook |
| H07 | starting 时 destroy | 停止新请求；最终释放；晚到 start 不复活 |
| H08 | destroy completed | Source、handle、Engine、Sink 各释放一次 |
| H09 | destroy failed | failure 可观察，本地最终释放完成 |
| H10 | late read/control result | 不访问 destroyed Host，不二次完成 |

Fake Core 日志不得出现 Android 直接调用 App/Page Hook、修改 Surface 或维护 Navigation 栈。

## 6. 观测、资源与通过条件
1. Noop/Recording 运行同一脚本，除 Trace 外 Host 状态、Core 调用、Result、Error、释放顺序一致。
2. Sink 故障被 `noexcept` Adapter 隔离，不传播到 Runtime。
3. 热路径不格式化文本、不执行 Trace 文件 I/O、不使用无界缓冲。
4. 每个 Case 后 Package backend、pending read、AppRuntime handle、Engine、Sink live count 为零。
5. Sanitizer 或等价工具无 use-after-free、double completion 和泄漏。

需求覆盖：

| 需求 | Case |
|---|---|
| R01-R03 | C01-C08；最终 link/symbol 证据由 AND-S08/AND-S09 补齐 |
| R04 | C04、观测 1-3 |
| R05 | H03 及 Profile Decoder 正负例 |
| R06 | C01、C06 |
| R07-R08 | P01-P11 |
| R09-R10 | H01-H04 |
| R11-R12 | H05-H06、Fake Core 调用日志 |
| R13-R14 | H06-H10 |
| R15 | 全部 Fake 合同 Case |

S01 隔离通过要求：C01-C08、P01-P11、H01-H10 全部通过；R01-R15 的 S01 责任均被覆盖；Manifest 通过公共 Schema并与提供的 Fake inventory 一致；证据明确标记 `isolated implementation verified / integration evidence pending`；无私有公共协议或 AND-S02..S07 实现。真实 APK/native 组成验收必须等待 AND-S08/AND-S09，不得由本结果替代。
