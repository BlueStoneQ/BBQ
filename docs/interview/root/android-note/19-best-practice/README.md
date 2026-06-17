# Android 最佳实践

> 从各专题中摘录的高价值实践，方便速查。

## 进程隔离

- **WebView 独立进程**：WebView crash 不影响主 App，避免 WebView 内存泄漏拖垮主进程。（来源：[进程、线程与通信](../02-process-thread/README.md)）
