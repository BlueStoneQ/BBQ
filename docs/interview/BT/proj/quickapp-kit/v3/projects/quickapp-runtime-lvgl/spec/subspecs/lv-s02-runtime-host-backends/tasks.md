# LV-S02 任务

## 目录

- [1. 结论](#1-结论)
- [2. 编码前门禁](#2-编码前门禁)
- [3. 实现任务](#3-实现任务)
- [4. 验证任务](#4-验证任务)
- [5. 完成条件](#5-完成条件)

## 1. 结论

LV-S02 的实现顺序固定为：**先让组合事实可验证，再实现 Host/Package/Backend，最后证明两种 Profile 的选择和销毁成立。** 本文件只指导后续编码，当前不授权产品代码。

## 2. 编码前门禁

- 本分 Spec 经总架构校审 `PASS`，工作看板明确 `CODE_ALLOWED`。
- LV-S01 保持 `VERIFIED`。
- CORE-S02 与 JS-S01 实际公开 Port 名称、target 名称若与本文投影不同，只做机械适配；语义冲突写 Handoff `[待决策]`。
- 不因兄弟分 Spec 尚未实现而创建假的生产 `conformance=v1` Manifest。

## 3. 实现任务

| ID | 任务 | 依赖 | 完成定义 |
|---|---|---|---|
| LV-S02-T01 | 建立 Host、Package、Backend concrete modules 与两个 Composition target | LV-S01 | target 边界清楚；Core/JS target 不反向依赖 LVGL/SDL/libuv；未选 target 不链接。 |
| LV-S02-T02 | 实现 build inventory registry、Profile 校验、Manifest 生成/describe | T01 | 固定 Kernel/JS Framework/单 Engine、S02 module identity、V1 component/capability/observation 规则全部可验证；Fake inventory 不标记为产品证据。 |
| LV-S02-T03 | 实现显式 Composition Root 与 immutable RuntimeSession | T02 | 无 Service Locator/全局 Engine；一个 Session 恰好一个 Provider/Sink/PackageSource/Core/JS owner graph。 |
| LV-S02-T04 | 实现严格 Launch Profile decoder 与 Runtime Host 状态机 | T03 | target/字段校验、单 start、root presented、typed failure、describe 和未发布 Session 语义成立。 |
| LV-S02-T05 | 实现 File/Memory PackageSource | T01 | identity 固定、immutable bytes、一次 completion、Core queue、越界/短读/close race 和无 FS memory path 成立。 |
| LV-S02-T06 | 实现 libuv owner-loop、SDL Display 与 SDL Raw Input Backend | T01 | 只实现 LV-S01 Port；可展示测试 frame、采集 raw sample、执行 bounded owner turn；无 Surface/Mount/Event。 |
| LV-S02-T07 | 实现 builtin cooperative loop 与 embedded callback Display/Raw Input Backend | T01 | caller-owned pump、fixed storage、unsupported wakeup 降级、无 SDL/libuv/文件系统依赖。 |
| LV-S02-T08 | 实现 TraceSink 选择与 LVGL forwarding Adapter | T02-T03 | V1 选择 Adapter、custom/off 选择 Noop；emit 无 I/O/文本格式化/Runtime 回调；Collector 未实现。 |
| LV-S02-T09 | 实现 raw Host signal admission 与 RuntimeLifecycleControl 代理 | T04 | pre-admission 去重、RequestId、逐条投递、同 ID/action 一次 result、busy 原样返回。 |
| LV-S02-T10 | 实现启动失败回滚、destroy 与 owner queue stop 协调 | T04-T09 | 逆序清理、bounded pump、busy 有界外层重试、晚到 callback 失效、所有资源归零。 |

## 4. 验证任务

| ID | 任务 | 必须输出 |
|---|---|---|
| LV-S02-V01 | Fake Core/JS/Engine/Sink/Package/Backend 合同测试 | start/control/destroy 顺序、单 Engine、单 Sink、typed result 与资源计数。 |
| LV-S02-V02 | PackageSource 并发和故障测试 | 越界、短读、rename/replace、close race、一次 completion、immutable bytes。 |
| LV-S02-V03 | 两种 Backend standalone 测试 | SDL test frame/raw sample/libuv wake；embedded cooperative/fixed storage/unsupported wake。 |
| LV-S02-V04 | 组成正负例 | 两个 Profile blueprint、重复/缺失 Engine、交叉 Backend、缺 V1 能力、Manifest/inventory mismatch。 |
| LV-S02-V05 | 背压、线程和停止测试 | owner-only、busy 无 spin、full 明确失败、pump budget、10,000 轮 start/stop。 |
| LV-S02-V06 | 依赖、链接和符号扫描 | embedded target 无 SDL/libuv/file/diagnostic-only；共享 Core/JS 无平台类型；每个测试产物单 Engine/单 JS Framework。 |
| LV-S02-V07 | sanitizer 与资源证据 | Debug/Release、ASan/UBSan/TSan；live task/read/backend/session/engine/sink 归零。 |
| LV-S02-V08 | 生成 `evidence/lv-s02-verification.md` | 区分 isolated/fake 证据与 LV-S09 最终产品证据，不声明 Surface/Case 已运行。 |

## 5. 完成条件

1. T01-T10 与 V01-V08 全部完成。
2. [验收](./acceptance.md) 的全部 S02 Case 通过。
3. 没有 Surface/Mount/标准 Input/Measure/Capability/Collector 代码。
4. 没有公共合同私改；冲突已写 Handoff 等待总架构。
5. Handoff 标记实现 `READY_FOR_REVIEW`；不得自行启动 LV-S03。
