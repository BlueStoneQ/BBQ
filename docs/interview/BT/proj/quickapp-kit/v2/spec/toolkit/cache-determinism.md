# Cache and Determinism Contract

## 1. 结论

**缓存只能跳过已证明等价的阶段；构建结果必须不依赖机器路径、时间和遍历顺序。**

## 2. Cache Key

```text
cacheKey = hash(
  normalized source content,
  dependency content hashes,
  manifest relevant fields,
  toolkit version,
  compiler options,
  schema versions
)
```

## 3. 可缓存阶段

| 阶段 | 默认缓存 |
|---|---|
| Parse | 是 |
| Normalize | 是 |
| Analyze | 是 |
| Lower | 是 |
| Bundle | 是 |
| Package | 仅缓存中间产物，最终签名重新验证 |

## 4. 确定性规则

1. 文件路径使用 project-root 相对 POSIX 路径。
2. Map/Set 输出按稳定键排序。
3. ID 按规范化遍历顺序分配。
4. ZIP 成员顺序、时间策略和压缩配置固定。
5. 构建报告可包含环境信息，但环境信息不进入运行产物哈希。

