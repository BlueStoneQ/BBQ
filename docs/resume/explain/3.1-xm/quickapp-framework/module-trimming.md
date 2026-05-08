# 模块裁剪与降级方案

## 问题

buildForRom=true 时凡泰模块被排除，`new FinClipProviderImpl()` 编译失败。

## 反射 vs 注解处理器的 trade-off

| | 反射（采用） | 注解处理器 |
|---|---|---|
| 做法 | `Class.forName("...FinClipProviderImpl")` | 用 `@DependencyAnnotation` 标注 |
| 优点 | 改动小，一行代码解决 | 更规范，编译时安全 |
| 缺点 | 类名硬编码字符串，重构易遗漏 | 改动稍多，需确认处理器配置 |

## 决策

选反射，因为快速修复优先。框架的 `@DependencyAnnotation` 内部也是反射，本质一样，只是更规范。标注 TODO 后续优化。

## 降级方案

反射解耦编译依赖 + metadata 入口控制 + 自升级兜底
