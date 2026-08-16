# iOS Runtime 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. Adapter 验收](#3-adapter-验收)
- [4. Case 验收](#4-case-验收)
- [5. 失败与资源验收](#5-失败与资源验收)
- [6. 证据](#6-证据)

## 1. 结论

iOS Runtime 的完成标准是：**同一 Runtime RPK 和共享 Runtime 在 iOS 完成与 Android/LVGL 等价的逻辑行为，同时保持 UIKit 主线程和跨语言资源安全。**

## 2. 总 Spec 通过条件

- Scene、Core lifecycle 和 Page Hook 三者没有混为一体。
- Gateway 只做 typed conversion 和线程桥接。
- Surface、Mount、Input、Measure、Provider 和销毁都有唯一分 Spec。
- Core Navigation 栈保持唯一权威。
- iOS 后置集成不允许改变已验证的共享合同语义。
- Scene 信号只转换为 typed Host lifecycle control；background 按 Host hidden -> Core commit -> Page/App `onHide`，foreground 按 Host visible -> Core commit -> App/Page `onShow`，UIKit 不得直接调用 Hook。
- iOS Composition Root 选择且只选择一个 JS Engine Provider 并生成公共 Runtime Composition Manifest；共享 Core/JS Framework 无 iOS/UIKit 组成分支。
- Runtime Composition Manifest 与 App/native library link map 或 symbol inventory 能对应证明：`runtime.js-framework` 恰好链接一次，且只链接 Manifest 选定的一个 Engine module。
- Composition Root 可注入 Noop/iOS TraceSink；Collector 丢样、关闭或失败不改变 Runtime 结果，热路径不执行文本格式化或文件 I/O。

## 3. Adapter 验收

| Adapter | 必须证明 |
|---|---|
| PackageSource | 文件/Data 随机读取、close 和 error 正确 |
| Gateway | typed 往返、主线程投递、ID 关联和引用生命周期正确 |
| Surface | hidden create、root/push present、visibility、close/reveal、destroy 正确 |
| Mount | full/incremental、Move/Remove、frame 和 mapping 清理正确 |
| Input | click 只产生标准消息，不直接调用 JS |
| Measure | Core Thread 可调用，不访问 UIView Tree；measured/failed 与字体 generation 符合公共 Schema |
| Provider | prompt/device/title/meta 与 fallback 正确 |

## 4. Case 验收

- Case 001 完成首屏、click、navigation、Capability、Page Control 和销毁。
- Case 002 完成局部 text update、if 和 keyed move，保留 NativeHandle 身份。
- App/Page Hook 顺序与 Android/LVGL Trace 的逻辑事件一致。
- UIKit 差异只体现在字体 metrics、视觉控件和平台耗时。
- Toolkit `run` 只在 root presented 后返回成功；启动失败返回稳定错误与非零退出状态。
- `BLOCK-001` keyed add/remove 后，新 Host 子树正确创建，被删 View/target-action/mapping 全部释放，已有 key 身份不变。
- `CAP-DEVICE-001` 独立调用 iOS device Provider，不修改 Case 001；success Result 提供 required fields、物理像素和正确 density，且无设备唯一标识。
- `CAP-DEVICE-001` 的 unsupported/failed 可观察；Surface/App 销毁后 Gateway pending request 和晚到 callback 被清理。

## 5. 失败与资源验收

- 注入 Surface、Mount、Present、Measure 和 Provider 失败，返回公共错误且不崩溃。
- incremental Mount 失败后执行 Core full rebuild。
- Surface 销毁后 View、target/action、mapping、pending block 和跨语言引用清零。
- 晚到主线程回调不得访问已销毁 Surface 或 C++ owner。

## 6. 证据

- iOS Adapter 单元与集成测试报告。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 模拟器或设备截图、交互和 Trace。
- Main/Core/JS 线程标记与 Gateway 耗时。
- iOS Collector 的结构化 Marker、计数器、丢样和 Noop/Recording 行为等价记录。
- 内存图、引用环检查和重复导航资源曲线。
- Android/LVGL/iOS 行为差异清单。
- Runtime Composition Manifest、App/native library link map 与外围模块依赖清单。
