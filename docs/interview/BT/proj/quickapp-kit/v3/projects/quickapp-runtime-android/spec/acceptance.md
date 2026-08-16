# Android Runtime 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. Adapter 验收](#3-adapter-验收)
- [4. Case 验收](#4-case-验收)
- [5. 失败与资源验收](#5-失败与资源验收)
- [6. 证据](#6-证据)

## 1. 结论

Android Runtime 的完成标准是：**不复制共享 Runtime 逻辑，使用同一 Runtime RPK、Core 和 JS Runtime 在 Android 完成真实可见、可点击、可导航、可降级的全链路。**

## 2. 总 Spec 通过条件

- JNI、UI Thread、NativeHandle 和 Android 生命周期边界明确。
- 每项 Platform Port 都有唯一分 Spec 和 typed Result。
- Surface/Mount、Measure、Input、Provider 与资源销毁全部覆盖。
- 不存在 Android 私有 Render、Event 或 Navigation 协议。
- Android 复用 LVGL/SDL 首闭环使用的同一 Core/JS 和 Runtime RPK，且不引入 LVGL/SDL 耦合或 Android 私有公共协议。
- Activity/Process 信号只转换为 typed Host lifecycle control；background 按 Host hidden -> Core commit -> Page/App `onHide`，foreground 按 Host visible -> Core commit -> App/Page `onShow`，平台不得直接调用 Hook。
- Android Composition Root 选择且只选择一个 JS Engine Provider 并生成公共 Runtime Composition Manifest；共享 Core/JS Framework 无 Android/JNI 组成分支。
- Runtime Composition Manifest 与 APK/native library link map 或 symbol inventory 能对应证明：`runtime.js-framework` 恰好链接一次，且只链接 Manifest 选定的一个 Engine module。
- Composition Root 可注入 Noop/Android TraceSink；Collector 丢样、关闭或失败不改变 Runtime 结果，热路径不执行文本格式化或文件 I/O。

## 3. Adapter 验收

| Adapter | 必须证明 |
|---|---|
| PackageSource | 随机读取、close、I/O error 与 bytes 生命周期正确 |
| JNI | typed message 往返、线程切换、异常转换和 ID 关联正确 |
| Surface | hidden create、root/push atomic present、visibility、close/reveal、destroy 正确 |
| Mount | full/incremental、Move/Remove、非法操作失败与映射清理正确 |
| Component | View/Text/Button、受控 prop 和 logical-px layout 语义正确 |
| Input | click 只产生一个标准消息，不直接调用 JS |
| Measure | Core Thread 可调用，不访问 View Tree；measured/failed 与字体 generation 符合公共 Schema，不返回静默假值 |
| Provider | prompt/device/title/meta success/unsupported/failure 正确 |

## 4. Case 验收

### 4.1 Case 001

- 真实 Runtime RPK 在模拟器或真机完成首屏。
- 标题、文本和按钮可见且布局可复现。
- 点击触发一次 JS Handler。
- push 成功时页面原子切换；失败时 source 保持可见。
- Toast、TitleBar/Meta 结果可观察。
- 页面关闭后所有 Android 与 JNI 对象释放。
- Toolkit `run` 只在 root presented 后返回成功；启动失败返回稳定错误与非零退出状态。

### 4.2 Case 002

- Text update 不重建整个 Host Tree。
- if 节点正确创建和递归删除。
- keyed move 复用同一 NativeHandle，并执行显式 Move。
- Transaction 数量、大小和端到端延迟进入 Benchmark。

### 4.3 BLOCK-001

- keyed add 创建一个新 Host 子树；remove 后对应 View、Listener、NativeHandle mapping 全部释放。
- 已有 key 的 NativeHandle 不因相邻 add/remove 改变。

### 4.4 CAP-DEVICE-001

- 独立 fixture 在模拟器或真机调用 Android device Provider，不修改 Case 001。
- success Result 提供 required fields、物理像素和正确 density，不返回设备唯一标识。
- unsupported/failed 可观察；Surface/App 销毁后 JNI 引用、pending request 和晚到 callback 被清理。

## 5. 失败与资源验收

- 注入 Host create、Mount、Present、Measure、Provider 失败，返回公共错误且不崩溃。
- incremental Mount 失败后能接受 Core 的一次 full rebuild。
- Surface Destroy 后容器、View、Listener、NativeHandle、JNI 引用计数归零。
- 晚到 callback 不访问已释放 Core/Surface。

## 6. 证据

- Android 单元、Adapter 与集成测试报告。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 屏幕录制或截图、交互和 Trace。
- UI/Core/JS 线程标记与跨 JNI 耗时。
- Android Collector 的结构化 Marker、计数器、丢样和 Noop/Recording 行为等价记录。
- Mount 失败恢复和资源泄漏检测记录。
- 与联盟 Android 行为基线的差异清单。
- Runtime Composition Manifest、APK/native library link map 与外围模块依赖清单。
