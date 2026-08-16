# LVGL Runtime 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. Simulator 验收](#3-simulator-验收)
- [4. Case 验收](#4-case-验收)
- [5. 嵌入式验收](#5-嵌入式验收)
- [6. 证据](#6-证据)

## 1. 结论

LVGL Runtime 的完成标准是：**SDL 窗口里运行的必须是完整框架而不是 UI Demo，并且同一链路能迁移到受约束设备 backend。**

## 2. 总 Spec 通过条件

- SDL 与设备端只替换 Backend，不复制 Platform Adapter。
- LVGL owner thread、Core/JS 队列和 Measure 边界明确。
- Host object、内部组合对象和 Runtime NodeId 映射职责明确。
- 内存、队列、失败与销毁是正式需求，不是编码后补充。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 和 Android 使用同一 Runtime RPK 和共享库版本。
- SDL/设备 Host 信号只转换为 typed Host lifecycle control；background 按 Host hidden -> Core commit -> Page/App `onHide`，foreground 按 Host visible -> Core commit -> App/Page `onShow`，Backend 不得直接调用 Hook。
- 每个产物的 Runtime Composition Manifest 与 link map/symbol inventory 都能对应证明：`runtime.js-framework` 恰好链接一次，且只链接 Manifest 选定的一个 Engine module。
- Composition Root 可注入 Noop/LVGL TraceSink；Collector 有界且不要求文件系统，丢样、关闭或失败不改变 Runtime 结果。

## 3. Simulator 验收

- 可通过公开 `run --platform lvgl` 启动完整 Runtime。
- 窗口非空白，viewport 正确，文字和按钮可见。
- 鼠标/触摸点击进入标准事件链路。
- 页面更新、push、隐藏、展示和销毁可交互观察。
- 支持截图、Trace 导出和可重复自动化运行。
- `run` 只在 root presented 后返回成功；启动失败返回稳定错误与非零退出状态。

## 4. Case 验收

### 4.1 Case 001

- App/Page lifecycle、首屏、click、router、prompt 和 Page Control 完成。
- `setTitleBar` 在 LVGL 可见生效；`setMeta` 若未提供则返回 typed unsupported，且源码中的能力检查可降级。
- Navigation push 成功原子切换；close 成功后才关闭栈顶并恢复前驱；失败不影响 source/权威栈。
- Destroy 后 LVGL object、Listener、mapping 和页面资源清零。

### 4.2 Case 002

- Text update 不重建整棵 Host Tree。
- if create/remove 正确。
- keyed move 复用原 `lv_obj_t*` 根对象和 NodeId。
- Render/Mount/Event 时延与事务大小进入统一 Benchmark。

### 4.3 BLOCK-001

- keyed add 创建一个新 LVGL Host 子树；remove 后对应 `lv_obj_t*`、Listener 和 mapping 全部释放。
- 已有 key 的 Host 根对象不因相邻 add/remove 改变。

### 4.4 CAP-DEVICE-001

- SDL simulator 与设备 Backend 使用独立 fixture 调用 device Provider，不修改 Case 001。
- success Result 提供 required fields、物理像素和正确 density，不返回设备唯一标识。
- unsupported/failed 可观察；Surface/App 销毁后 Provider pending request 和回调清零。

## 5. 嵌入式验收

| 维度 | 必须证明 |
|---|---|
| 内存 | 启动峰值、steady-state、页面销毁回落和重复导航无持续增长 |
| 队列 | 深度可观测，有界，过载不静默破坏事务 |
| 观测 | 整数纳秒、结构化计数和错误/降级 Marker 可导出；热路径无文本格式化、文件 I/O 或 Collector 等待 |
| 线程 | 所有 `lv_*` 调用来自 owner thread，Measure 不访问可变 UI |
| Backend | SDL 与至少一个替代 Backend/Fake Backend 通过相同合同测试 |
| 可裁剪 | `lvgl-simulator-dev` 与 `lvgl-embedded-min` 均生成 Composition Manifest 且各只链接一个 Engine module；embedded-min 的链接清单、符号和依赖不含 SDL/diagnostic-only 模块 |
| 失败 | Mount、Measure measured/failed、font generation、Provider 失败可验证并可降级，不终止整个 Runtime 进程 |

## 6. 证据

- SDL desktop/mobile-size 截图与自动交互记录。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 结构化 Trace。
- Android/LVGL 关键行为对照表。
- 内存、LVGL object、队列和重复导航曲线。
- Backend 替换与故障注入测试报告。
- 双 Profile Runtime Composition Manifest、link map、binary bytes 与基线/峰值/销毁回落内存对照。
