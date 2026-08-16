# Measure Adapter Contract

## 目录

- [1. 结论](#1-结论)
- [2. 所有权](#2-所有权)
- [3. V1 测量对象](#3-v1-测量对象)
- [4. 数据合同](#4-数据合同)
- [5. 调用时机与线程](#5-调用时机与线程)
- [6. 缓存与失败](#6-缓存与失败)

## 1. 结论

Measure Adapter 的本质是：**Platform 只提供字体固有尺寸，Core 仍拥有约束求解、Yoga Layout 和最终 Rect。**

它不是把 Layout 下放平台，也不是让 Core 同步等待 UI Thread。

## 2. 所有权

| 部件 | 所有者 | 输出 |
|---|---|---|
| Style resolve、Flex 约束、百分比 | C++ Core | Yoga constraints |
| Text/font 固有尺寸 | Platform Measure Adapter | width/height metrics |
| Button padding/min-size | C++ Core | canonical intrinsic size |
| 最终 Layout Rect | C++ Core | `SetHostLayout` |
| Native object placement | Platform Host Adapter | 平台对象坐标 |

Platform Measure Adapter 不接收 JS Binding、Template IR 或 NativeHandle；Platform Host 不得二次改变 Core 输出的 Layout Rect。

## 3. V1 测量对象

| Host Component | 何时测量 | 规则 |
|---|---|---|
| `View` | 不测量 | 尺寸完全由 Yoga 和子节点决定 |
| `Text` | width 或 height 为 auto | 测量文本，并按 width constraint 换行 |
| `Button` | width 或 height 为 auto | Adapter 只测量 button label；Core 再加 canonical padding/min-size |

V1 canonical defaults：

```text
Text:   fontToken=system-default, fontSize=16 logical-px, weight=400
Button: fontToken=system-default, fontSize=16 logical-px, weight=400
        horizontalPadding=16 logical-px each side
        verticalPadding=10 logical-px each side
        minWidth=64 logical-px
        minHeight=40 logical-px
```

显式 width/height 优先于 intrinsic size。不同平台默认字体的字形可以不同，但约束输入、Core 算法和最终 Rect 产生流程必须相同。

## 4. 数据合同

```text
MeasureRequest
  requestId / surfaceId / nodeId
  contentRevision
  platformFontGeneration
  role: text | buttonLabel
  text: UTF-8 string
  fontToken: system-default
  fontSize + fontSizeUnit: logical-px
  fontWeight: 400
  widthConstraint: unconstrained | atMost(value, logical-px) | exactly(value, logical-px)
  heightConstraint: unconstrained | atMost(value, logical-px) | exactly(value, logical-px)

MeasureResult
  measured(width, height, logical-px)
  | failed(RuntimeError)
```

成功结果必须回显 requestId、Surface、Node、contentRevision 和 platformFontGeneration；width/height 必须有限、非负且满足 `atMost/exactly` 约束。Adapter 无法测量或结果非法时固定返回 `failed(MEASURE_FAILED)`，不得抛跨语言异常或返回 nullable/boolean/out-param。V1 不跨层传递字体对象、glyph buffer、JNI/UIKit/LVGL 指针或可变共享内存。

`contentRevision` 在以下任一输入改变时递增：text、font token、font size、font weight、相关约束。它只用于测量缓存与诊断，不替代 Surface Render Revision。

## 5. 调用时机与线程

```text
Core stage Instantiate/Render intent
  -> Style resolve
  -> Yoga requests intrinsic measure
  -> Core calls PlatformMeasureAdapter.measure(request)
  -> Core completes Yoga Layout
  -> produce SetHostLayout
```

同步 Port 签名固定为：

```text
PlatformMeasurePort.measure(const MeasureRequest&) -> MeasureResult
```

Request 是调用期间只读借用的 POD/value；Result 按值返回。Platform Adapter 不保留 Request 引用，同一 request 只返回一次结果。

Yoga measure callback是同步求值，因此 V1 的 `measure` 必须能在 Core Runtime Thread 同步执行，并满足：

1. 不投递并等待 Platform UI Thread。
2. 不读取或修改 Host Tree/NativeHandle。
3. 只使用线程安全的字体度量服务或预先准备的不可变字体数据。
4. Platform 若无法在线程外访问字体 API，必须在 Surface 创建时准备 font metrics/cache，再供 Core Thread 查询。

Core 与 Platform UI Thread 之间“禁止同步等待”的总规则保持不变。

## 6. 缓存与失败

Core 拥有测量缓存，最小 key 为：

```text
platformFontGeneration
role + text bytes
fontToken + fontSize + fontWeight
widthConstraint + heightConstraint
```

Surface viewport、density 或系统字体变化时，Platform 在 Core 队列投递 `PlatformFontGenerationChanged(newGeneration)`。generation 必须严格递增；Core 清除受影响缓存并在下一轮安全调度点重新 Layout。该通知不在 Measure 同步调用栈内重入 Core。

Adapter 失败时，本轮 Layout 失败，不生成部分 Mount：

- 首屏：`InstantiateTemplateResult(failed, MEASURE_FAILED)`，Surface 进入 failed 并销毁。
- 更新：丢弃候选变更，保持已提交 Runtime Tree、Revision 和上一版 Host Tree，返回对应失败并记录 Trace。

禁止用 `0x0`、任意常量或平台默认控件尺寸静默兜底。

机器合同：[measure-adapter.schema.json](./schemas/measure-adapter.schema.json)。
