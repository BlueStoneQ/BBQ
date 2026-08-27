# Media Resource Contract

## 目录

- [1. 结论](#1-结论)
- [2. 资源身份](#2-资源身份)
- [3. 描述符](#3-描述符)
- [4. 生命周期](#4-生命周期)
- [5. 错误与降级](#5-错误与降级)
- [6. 所有权](#6-所有权)
- [7. 兼容性](#7-兼容性)

## 1. 结论

静态媒体的本质是 RPK 中由 Toolkit 校验并索引的不可变资源；Runtime 只传递资源引用和
元数据，Platform Adapter 决定是否能够加载和播放。Core 不持有媒体字节、不解码、不创建
播放器线程。

`resourceId` 是包内资源的稳定身份，V1 约定它等于规范化 `path`。这样既有一个明确的
身份字段，也保持现有 RPK 的 `path` 寻址和兼容性。

## 2. 资源身份

| 字段 | 语义 | V1 规则 |
|---|---|---|
| `path` | ZIP member 的包内路径 | 相对路径；视频必须位于 `assets/videos/` |
| `resourceId` | Runtime/Adapter 关联资源的稳定 ID | 静态视频必填，必须等于 `path` |
| `mediaType` | MIME 类型 | `video/mp4` 或 `video/webm` |
| `byteLength` | 未压缩媒体字节数 | 必须等于 ZIP member 大小 |
| `sha256` | 未压缩媒体内容校验和 | 小写十六进制 SHA-256 |
| `width/height` | 可选视频尺寸 | 正整数；未知时省略 |
| `durationMs` | 可选时长 | 非负整数；未知时省略 |

`src="assets/videos/demo.mp4"` 通过 `path/resourceId` 解析为同一资源。Core 不根据文件
扩展名猜 MIME，也不把裸路径当作已加载媒体；加载前必须存在对应 Metadata descriptor。

## 3. 描述符

Toolkit 在构建阶段完成：读取静态资源、识别 MIME、校验路径和预算、计算字节大小与 SHA-256，
然后把原始字节写入 RPK，把描述符写入 `quickapp-kit/runtime.json`。重复构建必须生成相同
描述符和相同包字节。

Core Loader 在执行 JS 前校验：描述符字段、ZIP member 存在性、未压缩大小和 SHA-256；通过后
向 Runtime/Platform 传递只读描述符。资源字节只在实际 `PackageSource` 读取或 Platform
Adapter 缓存期间存在，不进入 Runtime Tree。

## 4. 生命周期

```text
indexed -> verified -> requested -> prepared -> playing -> paused/finished
                         \-> error
```

- `prepared`：Adapter 已验证资源可用于播放；不代表已经播放。
- `start`：播放开始。
- `pause`：播放暂停。
- `finish`：播放到末尾。
- `timeupdate`：携带有限非负 `currentTime` 秒数。
- `error`：携带结构化错误分类，不携带播放器对象或平台指针。

`play/pause/seek` 是 typed 控制意图；`seek` 使用有限非负秒数。Core 只关联
`RequestId/SurfaceId/NodeId`，不实现控制动作。

## 5. 错误与降级

| 阶段 | 条件 | 语义 |
|---|---|---|
| Toolkit | 路径不存在、非 `assets/videos/`、MIME/格式不支持 | 构建失败，不发布部分 RPK |
| Toolkit/Core | 单资源或包超过预算 | `PACKAGE_ENTRY_INVALID` / artifact limit failure |
| Core Loader | descriptor/member 缺失或大小不一致 | `PACKAGE_ENTRY_INVALID` |
| Core Loader | SHA-256 不一致 | `PACKAGE_INTEGRITY_FAILED` |
| Platform Adapter | 平台没有播放器或格式能力 | typed `unsupported` / Video `error` |
| Platform Adapter | 加载、解码、控制失败 | typed `failed` / Video `error` |

任何失败不得留下半初始化播放器、Surface 绑定或 Runtime 资源引用。资源不存在、格式不支持
和播放器失败都不能让 Core 崩溃；页面保留错误状态或由应用自行降级到 poster/文本。

## 6. 所有权

- Toolkit：拥有源码读取和打包责任。
- Core：拥有 descriptor 索引、完整性门禁和生命周期关联，不拥有媒体字节。
- JS Runtime：接收 typed 生命周期事件，发出 typed 控制意图，不持有平台播放器对象。
- Platform Adapter：拥有解码器、播放器、平台缓存和实际释放责任。
- `teardown`：先停止事件/控制投递，再释放播放器和缓存，最后释放 Surface 关联；重复
  teardown 必须幂等。

## 7. 兼容性

旧 RPK 的四字段 Artifact Descriptor 仍合法；`resourceId`、尺寸和时长都是新增可选字段。
旧的外部 Video `src` 仍可被现有 Host 合同接受，但不能被当作本地静态资源索引。LVGL Profile
不声明 Video 时，Video 资源不会被挂载；Android/iOS 后续各自实现 Adapter，不改变本合同。
