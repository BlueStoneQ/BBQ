# consumerProguardFiles 排查

## 现象

cherry-pick 混淆提交后 dex 大小没变（44.4MB），混淆没生效。

## 排查过程

1. 检查 R8 seeds.txt → 569,654 个 keep 条目，几乎所有类都被保留
2. 对比 os3 原始提交 → 发现冲突解决时保留了宽泛 keep 规则
3. 修复后仍然没变 → 继续排查
4. 定位根因：新增的 guide/recommend/subscribe 三个模块的 `build.gradle` 声明了 `consumerProguardFiles`，其 proguard-rules.pro 中的宽泛规则通过 consumer 机制传递给 app 模块，阻止了 R8 裁剪

## consumer 机制

Android 库模块可以通过 `consumerProguardFiles` 把自己的混淆规则传递给依赖它的 app 模块。如果库的规则太宽泛（`-keep public class * { *; }`），会阻止整个 app 的代码裁剪。
