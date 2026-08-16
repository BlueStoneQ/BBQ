# AND-S01 实现任务

## 目录
- [1. 结论](#1-结论)
- [2. 任务](#2-任务)
- [3. 依赖与完成定义](#3-依赖与完成定义)

## 1. 结论
编码获准后，按“模块边界 -> PackageSource -> Composition Root -> Host 编排 -> 故障测试 -> 产物证据”推进；所有任务都不得实现 AND-S02..S07。

## 2. 任务
| ID | 任务 | 完成条件 |
|---|---|---|
| T01 | 建立 Host/Composition/PackageSource target 与依赖规则 | Shared Core/JS 不反向依赖 Android |
| T02 | 实现严格 Profile Decoder | 覆盖未知字段、target、viewport、params、artifact 负例 |
| T03 | 实现 file/asset/memory PackageSource | File open 固定只读 fd，随机读、immutable bytes、close、exactly-once 通过 |
| T04 | 实现 read 并发与销毁保护 | close race、晚到 completion、溢出、短读无泄漏 |
| T05 | 实现 Android Composition Root | 恰好一个 Engine，Sink/Port 可替换，无全局定位器 |
| T06 | 消费并校验 Composition Manifest 与 build inventory | Schema、模块集合、`binaryBytes` 不一致时拒绝；不生成 Fake link map |
| T07 | 实现只读 composition describe | 不经 Runtime Bridge，不可运行时改写 |
| T08 | 实现 Runtime Host 启动编排 | 仅 Root presented 成功；中间失败完整清理 |
| T09 | 实现 lifecycle control 代理 | requestId/action 关联正确，busy/error 不被吞并 |
| T10 | 实现单次 teardown | 正常、启动中取消、失败路径均释放 |
| T11 | 建立 Fake Core 合同测试 | 无 JNI/View 即可验证请求、顺序、结果与清理 |
| T12 | 建立 Package backend 合同测试 | bytes 所有权、路径替换、短读、read/close 竞争与 exactly-once 可证明 |
| T13 | 建立 Noop/Recording 等价测试 | 除观测外状态、结果、错误、顺序相同 |
| T14 | 建立 S01 隔离组成检查并声明最终证据门禁 | Fake inventory 验证拒绝逻辑；真实 APK/native link/symbol evidence 明确归 AND-S08/AND-S09 |

## 3. 依赖与完成定义
```text
T01 -> T02
    -> T03 -> T04
    -> T05 -> T06 -> T07
T02 + T04 + T05 -> T08 -> T09 -> T10
T08 -> T11
T04 -> T12
T05 + T08 -> T13
T06 -> T14
```

返修只允许修改 AND-S01，AND-S02 不得启动。S01 完成时必须满足：Fake Core 证明 Host 未复制 Core 状态机；PackageSource 固定资源身份且无二次完成、悬空引用或泄漏；Root 未 presented 不成功；Composition Root 能拒绝 Manifest/inventory 不一致；真实链接事实保持 integration evidence pending；未修改公共合同或实现后续 Adapter。
