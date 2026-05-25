# 打包流程优化

> 问题：构建慢 + 产物大 + 开发体验差
> 本质：构建时能做的优化（压缩/裁剪/预编译），减少运行时负担
> 目标：构建快 + 产物小 + 开发时热重载快

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| Metro 构建日志 | 各阶段耗时（transform/serialize） |
| `source-map-explorer` | Bundle 各模块占比 |
| APK Analyzer | APK 内部各部分体积 |
| `time npx react-native bundle` | 总构建时间 |

---

## 如何优化

### Metro 构建优化

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **Hermes AOT** | 构建时编译为 .hbc 字节码 | 运行时跳过解析，启动快 |
| **drop_console** | 删除 console.log | Bundle 体积减少 + 运行时不做无用输出 |
| **maxWorkers** | 增加并行打包线程 | 构建速度提升 |
| **blockList** | 排除不需要的文件/目录 | 减少扫描时间 |
| **缓存** | Metro 增量构建缓存 | 二次构建快 |

```javascript
// metro.config.js 优化配置
module.exports = {
  transformer: {
    hermesCommand: 'hermes',
    minifierConfig: { compress: { drop_console: true } },
  },
  resolver: {
    blockList: [/node_modules\/.*\/example\/.*/, /\.git\/.*/],
  },
  maxWorkers: 4,
};
```

### Android 构建优化（Gradle）

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **Gradle 缓存** | `org.gradle.caching=true` | 增量构建快 |
| **并行构建** | `org.gradle.parallel=true` | 多模块并行 |
| **R8** | 代码混淆 + 无用代码删除 | DEX 体积减少 30-40% |
| **abiFilters** | 只保留 arm64-v8a | .so 体积减半 |
| **资源压缩** | `shrinkResources true` | 删除未使用的资源 |

```groovy
// android/app/build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true       // R8 混淆
            shrinkResources true     // 资源压缩
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
    defaultConfig {
        ndk { abiFilters 'arm64-v8a' }  // 只保留 64 位
    }
}
```

### iOS 构建优化

| 手段 | 做什么 | 效果 |
|------|--------|------|
| App Thinning | App Store 按设备分发 | 用户下载量减少 |
| 预编译 iOS 二进制（0.84+） | 跳过本地编译 RN 框架 | 构建速度提升 |

---

## 开发体验优化

| 手段 | 做什么 | 效果 |
|------|--------|------|
| Fast Refresh | 代码修改后热重载（保留状态） | 开发时秒级反馈 |
| Metro 增量构建 | 只重新打包变化的模块 | 热重载快 |
| Flipper / DevTools | 调试工具不影响构建速度 | 开发体验好 |
