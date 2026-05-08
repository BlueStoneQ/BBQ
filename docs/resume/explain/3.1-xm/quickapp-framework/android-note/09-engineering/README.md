# 09. 工程化

> Gradle 深度、CI/CD、多模块管理、构建优化。

## 目录

- [一、Gradle 构建系统深度](#一gradle-构建系统深度)
- [二、多模块项目管理](#二多模块项目管理)
- [三、构建变体（Build Variants）](#三构建变体build-variants)
- [四、CI/CD 实践](#四cicd-实践)
- [五、构建性能优化](#五构建性能优化)
- [六、快应用框架的工程化实践](#六快应用框架的工程化实践)

---

## 一、Gradle 构建系统深度

### Gradle 生命周期

```
1. Initialization（初始化）
   读取 settings.gradle → 确定有哪些 module 参与构建

2. Configuration（配置）
   执行所有 build.gradle → 构建 Task DAG（有向无环图）

3. Execution（执行）
   按 DAG 依赖顺序执行 Task（可并行）
```

### Task DAG 示例

```
:app:preBuild
    ↓
:core:compileJava  ←→  :bridge:compileJava  （并行）
    ↓                       ↓
:app:mergeClasses（等两个都完成）
    ↓
:app:minifyReleaseWithR8
    ↓
:app:packageRelease
    ↓
:app:assembleRelease
```

### 自定义 Task

```groovy
// 自定义 Task（类比 npm scripts）
task prebuild(type: Exec) {
    commandLine 'bash', 'scripts/prebuild.sh'
}

// 让 preBuild 依赖我们的 prebuild task
preBuild.dependsOn prebuild
```

### Gradle Plugin

```groovy
// 应用插件（类比 Webpack Plugin）
plugins {
    id 'com.android.application'  // Android 构建插件
    id 'kotlin-android'           // Kotlin 支持
    id 'com.google.protobuf'      // Protobuf 代码生成
}
```

插件本质：注册一组 Task + 配置 Extension。类比 Webpack Plugin 注册 hooks。

---

## 二、多模块项目管理

### 模块类型

| 类型 | 插件 | 产物 | 说明 |
|------|------|------|------|
| Application | `com.android.application` | APK | 可安装运行的 App |
| Library | `com.android.library` | AAR | 被其他模块依赖的库 |
| Java Library | `java-library` | JAR | 纯 Java 库（无 Android 依赖） |

### 模块划分原则

```
按职责分：
├── app/          ← 壳工程（只做组装，不写业务）
├── core/         ← 核心能力（引擎、Bridge）
├── features/     ← 业务 Feature（可插拔）
├── common/       ← 公共工具（不依赖 Android）
└── platform/     ← 平台适配层
```

### 模块间依赖规则

```
app → 可以依赖所有模块
features → 只能依赖 core 和 common
core → 只能依赖 common 和 platform
common → 不依赖任何业务模块
platform → 只依赖 common
```

类比前端 monorepo 的依赖规则（@nx/enforce-module-boundaries）。

---

## 三、构建变体（Build Variants）

### buildType × productFlavor = 变体

```groovy
android {
    buildTypes {
        debug { ... }
        release { minifyEnabled true }
    }
    productFlavors {
        rom { ... }      // 预装版
        market { ... }   // 商店版
    }
}
// 产出 4 个变体：romDebug, romRelease, marketDebug, marketRelease
```

### 快应用框架的变体设计

```
buildForRom=true  → rom flavor → 裁剪凡泰/百度 → 小包
buildForRom=false → market flavor → 完整功能 → 大包
```

### 变体特有代码/资源

```
src/
├── main/          ← 所有变体共享
├── rom/           ← rom flavor 特有
│   └── java/      ← rom 特有的 Java 代码
├── market/        ← market flavor 特有
│   └── java/      ← market 特有的 Java 代码
└── debug/         ← debug buildType 特有
```

---

## 四、CI/CD 实践

### Android CI/CD 流水线

```
代码提交
  ↓
Stage 1: 静态检查
  - ktlint / detekt（Kotlin lint）
  - Android Lint
  - 依赖漏洞扫描

Stage 2: 编译
  - ./gradlew assembleRelease
  - 产出 APK/AAB

Stage 3: 测试
  - 单元测试（./gradlew test）
  - Instrumented 测试（需要设备/模拟器）
  - UI 自动化测试

Stage 4: 质量门禁
  - APK 大小检查（超过基线告警）
  - 方法数检查（65536 限制）
  - 签名验证

Stage 5: 发布
  - 上传到内部分发平台 / 商店
  - 灰度发布
  - ROM 集成（预装场景）
```

### ROM 出包流程（快应用框架）

```
框架代码提交
  ↓ CI 构建
产出 APK（签名后）
  ↓ 提交到 ROM 仓库
ROM 构建系统集成
  ↓ 编译整个 ROM 镜像
产出 ROM 包
  ↓ 刷机验证
OTA 推送 / 工厂预装
```

---

## 五、构建性能优化

| 手段 | 原理 | 效果 |
|------|------|------|
| Gradle Daemon | 常驻进程，避免每次启动 JVM | 首次后构建快 50%+ |
| 增量编译 | 只重新编译改动的文件 | 增量构建秒级 |
| Build Cache | 缓存 Task 输出，跨机器复用 | CI 构建加速 |
| 并行构建 | `org.gradle.parallel=true` | 多模块并行编译 |
| Configuration Cache | 缓存配置阶段结果 | 跳过 build.gradle 执行 |
| 模块化 | 改动只影响一个模块 → 只重新编译一个模块 | 增量范围缩小 |

### 快应用框架的构建优化

- 自定义 base Docker 镜像：预装 Gradle + NDK + SDK，CI 不需要每次下载
- Gradle Build Cache：跨 CI 任务复用编译结果
- 模块化：Feature 模块独立编译，改一个 Feature 不需要重新编译整个框架

---

## 六、快应用框架的工程化实践

| 实践 | 说明 |
|------|------|
| 多模块架构 | app + core + bridge + features（可插拔） |
| buildForRom 变体 | 预装版/商店版通过 flavor 区分 |
| R8 全局混淆 | 只在 app 模块开启，全程序分析 |
| consumerProguardFiles | 库模块自带 keep 规则 |
| CI 构建 | GitLab CI + Docker + Gradle |
| ROM 集成 | APK → ROM 仓库 → ROM 构建 → 刷机验证 |
| 自动化测试 | Python + pytest + uiautomator2 |
| 版本管理 | versionCode 自增 + versionName 语义化 |
