# Error Contract

## 目录

- [结论](#结论)
- [V1 错误码](#v1-错误码)
- [处理规则](#处理规则)

## 结论

跨层错误必须是可观察、可分类、可降级的 typed error；不得依赖字符串匹配或跨语言异常穿透。

## V1 错误码

```text
ABI_INVALID_ARGUMENT
ABI_UNSUPPORTED_VERSION
SURFACE_NOT_FOUND
SURFACE_DEGRADED
SURFACE_FAILED
SURFACE_HOST_ALREADY_EXISTS
SURFACE_HOST_NOT_FOUND
SURFACE_PRESENTATION_FAILED
REVISION_STALE
TARGET_NOT_FOUND
INVALID_PARENT
BLOCK_NOT_FOUND
HANDLER_NOT_FOUND
HANDLER_ALREADY_EXISTS
ROUTE_NOT_FOUND
NAVIGATION_BUSY
LIFECYCLE_BUSY
NAVIGATION_FAILED
PACKAGE_NOT_FOUND
PACKAGE_FORMAT_UNSUPPORTED
PACKAGE_VERSION_UNSUPPORTED
PACKAGE_IO_ERROR
PACKAGE_ENTRY_INVALID
PACKAGE_INTEGRITY_FAILED
PACKAGE_SIGNATURE_REQUIRED
PACKAGE_SIGNATURE_INVALID
PACKAGE_SIGNER_UNTRUSTED
PACKAGE_INVALID
IR_INVALID
TEMPLATE_NOT_FOUND
MODULE_ABI_UNSUPPORTED
RUNTIME_PROFILE_INCOMPATIBLE
CAPABILITY_NOT_DECLARED
CAPABILITY_DENIED
CAPABILITY_UNSUPPORTED
CAPABILITY_FAILED
HOST_FEATURE_UNSUPPORTED
MEASURE_FAILED
OUT_OF_MEMORY
QUEUE_OVERFLOW
JS_EXCEPTION
PLATFORM_REJECTED
```

## 处理规则

| 错误 | 处理 |
|---|---|
| 参数/版本错误 | 拒绝当前请求，不修改状态 |
| 过期 Revision | 丢弃当前事务，记录可观测事件 |
| 目标或 Block 无效 | 拒绝整笔 RenderTransaction，Runtime Tree 不部分提交 |
| JS Handler 异常 | 结束当前 Handler，报告 `JS_EXCEPTION`，Runtime 继续运行 |
| Platform 执行失败 | 停止当前 MountTransaction，标记 Surface degraded，报告错误 |
| route 不存在 | Navigation 失败，不创建目标 Surface |
| Lifecycle control 并发或重入 | 返回 `LIFECYCLE_BUSY`，不启动第二次状态转换 |
| Host 能力不可用 | 返回 `HOST_FEATURE_UNSUPPORTED`，JS 执行能力降级 |
| Capability 未声明、未提供或执行失败 | 分别返回 `CAPABILITY_NOT_DECLARED`、`CAPABILITY_UNSUPPORTED`、`CAPABILITY_FAILED`；`CAPABILITY_DENIED` 为第二期 Guard 保留码 |
| 字体固有尺寸测量失败 | 返回 `MEASURE_FAILED`，首屏失败或丢弃本轮候选更新 |
| Runtime 必要分配失败 | 返回 `OUT_OF_MEMORY`，不部分提交当前事务；只尝试发出预分配最小 Trace |
| 有界业务队列达到上限 | 返回 `QUEUE_OVERFLOW`，拒绝当前入队；不得静默丢弃已接受请求 |
| 包格式/版本/完整性失败 | 执行任何 JS 前拒绝整个 Package |
| Runtime Profile 缺少 Artifact 所需组件或能力 | 返回 `RUNTIME_PROFILE_INCOMPATIBLE`，执行任何 JS 前拒绝整个 Package |
| 后续 Release profile 的签名缺失、无效或签名者不受信 | 依据包外 PackageOpenPolicy 拒绝整个 Package；该规则不阻塞 V1 development 闭环 |
| Surface Host 创建/展示失败 | target 不提交 Navigation 栈，销毁 target 并保留 source |

V1 不承诺跨平台 Host 回滚。Platform 失败后 Core 保留权威 Runtime Tree，Surface 进入 degraded；Core 通过一次 `mode: full` 的 MountTransaction 清空并重建 Host。重建完成前拒绝新的 RenderTransaction；再次失败则 Surface 进入 failed，必须销毁并新建。

`RuntimeError` 可选关联字段只有 `surfaceId`、`requestId`、`transactionId`、`mountAttemptId`，并必须遵循统一 ID 前缀。
