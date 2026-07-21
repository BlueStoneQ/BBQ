# 高性能 H5 JS Bridge 设计（总结）

→ [H5 容器总览](./README.md)

→ [详细版（含 QA）](./h5-bridge-design.md)

---

## 核心设计 5 点

| # | 设计点 | Android 实现 | iOS 实现 |
|---|--------|-------------|---------|
| 1 | **通道选择** | `@JavascriptInterface` 注入对象 | `WKScriptMessageHandler`（postMessage） |
| 2 | **统一入口 + 协议分发** | 注入一个 `nativeBridge` 对象，统一 `callNative(apiName, params, callbackId)` | 同（JS 侧 API 完全一致） |
| 3 | **全异步 Promise + callbackId** | Native 处理完后 `evaluateJavascript` 回调 JS | Native 处理完后 `evaluateJavaScript` 回调 JS |
| 4 | **批量队列（Batching）** | JS 侧微任务攒一批 → 一次性发给 Native | 同 |
| 5 | **大数据不走 Bridge** | 文件走 `onShowFileChooser` 系统回调；Native→JS 数据走 `shouldInterceptRequest` 拦截返回 | 文件走 `runOpenPanel`；Native→JS 数据走 `WKURLSchemeHandler` |

## 为什么不用 URL Scheme 拦截？

能用但不推荐作为主通道——有 URL 长度限制、字符串解析开销、无法同步返回。只做兜底（旧 WebView 兼容）。

## 安全

域名白名单 + 敏感 API token 校验。未授权 Origin 调 Bridge → 不响应。
