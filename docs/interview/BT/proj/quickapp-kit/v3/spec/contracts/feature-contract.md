# Page Host Control Contract

## 目录

- [1. 结论](#1-结论)
- [2. V1 控制](#2-v1-控制)
- [3. 执行边界](#3-执行边界)
- [4. 生命周期](#4-生命周期)

## 1. 结论

Page Host Control 是绑定当前 Surface、但不改变 Runtime Tree 的页面控制；V1 只包含 `SetTitleBar`、`SetMeta`，不提供 `feature + method + args` 通用 Bridge。

`ShowToast` 是 `system.prompt.showToast` 的 typed request，消息结构仍由本合同的机器 Schema 定义，但注册和调用遵循 [Capability Module Contract](./capability-module-contract.md)。路由会改变 Surface 栈，遵循 [Navigation Contract](./navigation-contract.md)。

## 2. V1 控制

| Request | 参数 | Result | 执行层 |
|---|---|---|---|
| `SetTitleBar` | `requestId`、`surfaceId`、`text` | `SetTitleBarResult` | Platform Page Control Adapter |
| `SetMeta` | `requestId`、`surfaceId`、`title?`、`description?` | `SetMetaResult` | Platform Page Control Adapter |

每个 Result 都是 `completed | failed` 判别联合。`SurfaceContext.hostCapabilities` 只决定 JS Framework 是否暴露 `$page.setTitleBar/$page.setMeta`；例如没有 `setMeta` 时不挂载该 Page API。若控制能力在调用与执行之间失效，返回 `HOST_FEATURE_UNSUPPORTED`，不得静默成功。

## 3. 执行边界

```text
JS Framework typed Page Control request
  -> Runtime ABI
  -> C++ Page Control Router
  -> Platform Page Control Adapter
  -> typed result
  -> JS Promise/callback
```

C++ 只校验、路由和关联请求；JNI、UIKit、LVGL 类型仅存在 Platform Adapter。请求进入 Core 队列时复制或转移为 immutable message，层间不共享可变 JS 对象。

## 4. B4 Feature 扩展

B4 保持同一条 typed ABI，但把三个可替换能力加入封闭合同：

| Module | Methods | Result payload | Provider 边界 |
|---|---|---|---|
| `system.prompt` | `alert`、`confirm` | `confirmed?` | 平台提示 Provider |
| `system.fetch` | `fetch`、`cancel` | `httpStatus?`、`responseBody?`、`responseIsJson?` | 平台或宿主网络 Provider |
| `system.file` | `read`、`write`、`exists`、`delete` | `fileData?`、`fileExists?` | 应用私有目录或内存 Provider |
| `system.openUrl` | `open` | 无业务载荷 | 系统默认浏览器 Provider |
| `system.webview` | `open` | 无业务载荷 | 平台 WebView Provider |

Fetch 请求固定包含 `url`、`httpMethod`、`headers`、`body?`、`timeoutMs`、`responseType=text|json`；File 路径必须以 `private/` 开头。Core 不访问网络、文件系统或原生弹窗，只负责 ModuleRegistry、RequestId 关联、Surface 生命周期和 typed Result 转发。

B6 的 URL 规则是：应用内 `/...` 路径由 `system.router` 进入 Core Router；`system.openUrl.open({url})` 和 `system.webview.open({url})` 只接受 `http(s)` URL，并分别进入系统浏览器和平台 WebView。第一版不实现内嵌 `webview` Host Component、Cookie、UA、网页 JS 双向通信或 WebView 内部路由。

所有 B4 Result 的状态是 `completed | failed | unsupported | cancelled`。`failed/unsupported` 必须带结构化错误；`cancelled` 表示在途 Fetch 被取消，可以不带错误。JS Facade 负责 Promise 结算，未注册 Provider 必须可观察地 reject，不得伪造成功。

## 5. 生命周期

1. ABI 同步校验失败时不入队。
2. 入队后只能产生一次同类型 Result。
3. Surface 在执行前销毁时返回 `SURFACE_NOT_FOUND`。
4. Page Host Control 和 Feature Provider 不创建、销毁或修改 Surface/Runtime Tree。
5. 控制结果需要改变页面内容时，结果回到 JS，再由状态更新产生 `RenderTransaction`。

机器合同：[feature.schema.json](./schemas/feature.schema.json)。
