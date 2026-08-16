# T1 Project Loader

## 职责

读取项目根目录、Manifest、入口、源码、资源并生成 `ProjectGraph`。

## 验收

- 路径统一为 project-root 相对 POSIX 路径。
- 缺失 Manifest 返回 `TK_MANIFEST_INVALID`。
- 未引用资源不进入输出。
- Case 001 文件图与源码目录一致。

