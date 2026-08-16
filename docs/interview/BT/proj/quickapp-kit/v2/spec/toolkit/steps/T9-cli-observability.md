# T9 CLI and Observability

## 职责

完成 `build`、`validate`、`inspect`、`clean` 和构建 Trace。

## 验收

- 人类文本和 JSON 两种输出稳定。
- 退出码可区分失败阶段。
- Trace 能输出各阶段耗时、缓存命中和产物体积。
- CLI 不承载编译业务逻辑。

