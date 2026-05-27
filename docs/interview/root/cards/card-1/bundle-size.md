# 包体优化方案

## 目录

- [全景](#全景)
- [ABI Split（SO 按架构裁剪）](#abi-splitso-按架构裁剪)
- [JS Bundle 优化](#js-bundle-优化)
- [Native 代码优化](#native-代码优化)
- [资源优化](#资源优化)
- [iOS 侧包体优化](#ios-侧包体优化)

---

## 全景

RN App 包体组成：

```
APK/IPA
├── JS Bundle（2~8MB）      ← Metro 打包产物
├── Native SO 库（5~15MB）  ← Hermes、RN 框架、三方 Native SDK
├── DEX/Mach-O（3~10MB）   ← Java/ObjC 编译产物
├── 资源（2~10MB）          ← 图片、字体、音频
└── 其他（签名、manifest）
```

---

## ABI Split（SO 按架构裁剪）

### 问题

SO 库按 CPU 架构编译，不拆分则所有架构的 SO 都打进包里，包体 ×2~3。

### 架构说明

| 架构 | 说明 | 2026 覆盖建议 |
|------|------|--------------|
| **arm64-v8a** | 64 位 ARM，主流设备 | ✅ 必须 |
| armeabi-v7a | 32 位 ARM，老设备 | 出海可不管，国内看情况 |
| x86_64 / x86 | 模拟器/Chromebook | ❌ 不需要 |

### 方案一：AAB（出海 / Google Play）

Google Play 2021 年起强制 AAB，自动按设备架构下发。

```groovy
// build.gradle — 配置支持的架构
android {
  defaultConfig {
    ndk {
      abiFilters "arm64-v8a", "armeabi-v7a"  // 构建时编译这些架构
    }
  }
}
```

```bash
# 构建 AAB
./gradlew bundleRelease        # → 产物：app-release.aab（上传 Google Play 用）

# 构建 APK（本地测试 / 国内商店）
./gradlew assembleRelease      # → 产物：app-release.apk（可直接安装到设备）

# AAB 不能直接安装，是给 Google Play 的"原料"
# Google Play 收到 AAB 后，按用户设备自动裁剪生成定制 APK 下发
```

### Android 常见构建命令速查

| 命令 | 产物 | 用途 |
|------|------|------|
| `./gradlew assembleDebug` | `app-debug.apk` | 开发调试（可直接装设备） |
| `./gradlew assembleRelease` | `app-release.apk` | 发布用 APK（签名+混淆） |
| `./gradlew bundleRelease` | `app-release.aab` | 上传 Google Play |
| `./gradlew assembleRelease` (library module) | `module-release.aar` | 库模块产物（给其他项目依赖） |
| `./gradlew publishToMavenLocal` | `.aar` + pom → 本地 Maven | 本地发布库供其他项目引用 |
| `./gradlew clean` | — | 清除 build 目录 |
| `./gradlew dependencies` | — | 查看依赖树 |
| `./gradlew lint` | lint 报告 | 静态代码检查 |
| `./gradlew test` | 测试报告 | 跑单元测试 |
| `./gradlew connectedAndroidTest` | 测试报告 | 跑设备上的 instrumented 测试 |

### 产物格式区别

| 格式 | 是什么 | 能直接安装吗 | 用途 |
|------|--------|------------|------|
| **APK** | 最终安装包 | ✅ | 设备安装、国内商店 |
| **AAB** | 包含所有变体的中间格式 | ❌ | 上传 Google Play，自动裁剪下发 |
| **AAR** | Android 库（代码+资源+manifest） | ❌ | 给其他 App/模块依赖（类似 npm 包） |
| **JAR** | 纯 Java 库（只有代码） | ❌ | Java 依赖（无 Android 资源） |

**效果**：用户实际下载的包体减少 40~60%（只有一套 SO）。

### 方案二：Split APK（国内商店 / 预装）

```groovy
android {
  splits {
    abi {
      enable true
      reset()
      include "arm64-v8a", "armeabi-v7a"
      universalApk false  // 不生成全架构兜底包
    }
  }
}
// 构建后生成每个架构一个 APK：
// outputs/apk/release/
//   ├── app-arm64-v8a-release.apk      ← 只含 arm64 SO
//   └── app-armeabi-v7a-release.apk    ← 只含 armv7 SO
//   (universalApk = true 时还会多一个包含所有架构的兜底包)
```

构建产物：
```
app-arm64-v8a-release.apk    ← 64 位设备
app-armeabi-v7a-release.apk  ← 32 位设备
```

上传商店时选对应架构的包，或只传 arm64-v8a（放弃 <1% 的 32 位设备）。

### 方案三：预装场景（只打一个架构）

```groovy
android {
  defaultConfig {
    ndk {
      abiFilters "arm64-v8a"  // 只保留 64 位
    }
  }
}
```

**效果**：SO 体积直接减半。适用于目标设备确定的场景（IoT 设备、预装 ROM）。

### SO 文件在包里的结构

```
lib/
├── arm64-v8a/          ← 每个架构一个目录
│   ├── libhermes.so    ← 预编译的（RN/Hermes 提供）
│   ├── libreactnative.so
│   └── libmymodule.so  ← 自己编译的（CMake + NDK）
└── armeabi-v7a/
    ├── libhermes.so
    └── ...
```

**abiFilters 对所有 SO 一视同仁**：不管是预编译引入的还是源码编译的，都按配置过滤。

---

## JS Bundle 优化

| 手段 | 效果 | 说明 |
|------|------|------|
| **Hermes 字节码（.hbc）** | Bundle -30% | 预编译为字节码，比 JS 源码小且加载快 |
| **分 Bundle** | 首屏 Bundle -50% | Common + Business 分离，按需加载 |
| **Tree Shaking** | -10~20% | Metro 配置 + 避免 barrel exports |
| **代码分割（lazy）** | 首屏 -30% | React.lazy + 路由级拆分 |
| **移除 console/debug** | -5% | babel-plugin-transform-remove-console |

---

## Native 代码优化

| 手段 | 效果 | 说明 |
|------|------|------|
| **R8/ProGuard** | DEX -20~30% | 代码缩减、混淆、优化 |
| **strip debug symbols** | SO -30~50% | 移除调试符号（release 默认开启） |
| **移除未用的 Native 模块** | 按需 | 不用的 TurboModule 不注册 |
| **条件编译** | 按需 | 按平台/环境裁剪代码 |

---

## 资源优化

| 手段 | 效果 | 说明 |
|------|------|------|
| **图片 WebP** | -30~50% | 替代 PNG/JPEG |
| **图片 CDN** | 资源不打包 | 运行时从 CDN 加载 |
| **移除未引用资源** | 按需 | `shrinkResources true` |
| **字体裁剪** | -50~80% | 只保留用到的字符（fonttools subset） |
| **SVG 替代位图** | 按需 | 图标用 SVG，不用多倍图 |

---

## iOS 侧包体优化

| 手段 | 效果 | 说明 |
|------|------|------|
| **App Thinning** | 自动 | App Store 按设备下发对应资源（@2x/@3x） |
| **Asset Catalog** | 自动 | 图片放 xcassets，系统自动优化 |
| **Strip Swift Symbols** | -5~10% | Build Settings 开启 |
| **Link-Time Optimization (LTO)** | -5~10% | 编译器跨模块优化 |
| **Dead Code Stripping** | 自动 | 移除未调用的函数 |

---

## 总结

| 优化方向 | 核心手段 | 预期效果 |
|---------|---------|---------|
| SO 库 | ABI Split / 只打 arm64 | -40~60% |
| JS Bundle | Hermes .hbc + 分 Bundle | -30~50% |
| DEX | R8 混淆优化 | -20~30% |
| 资源 | WebP + CDN + 字体裁剪 | -30~50% |
| iOS | App Thinning + LTO | 自动优化 |
