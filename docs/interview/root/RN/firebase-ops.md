# Firebase + 运维监控

> 问题：出海 App（北美）的运维监控体系怎么搭？
> 核心：Firebase 套件 + 自建埋点/日志

---

## 目录

- [一、Firebase 是什么](#一firebase-是什么)
- [二、Firebase 核心能力](#二firebase-核心能力)
- [三、集成方式（载体）](#三集成方式载体)
- [四、出海 IoT App 的运维选型](#四出海-iot-app-的运维选型)
- [五、架构师视角：接口层抽象](#五架构师视角接口层抽象)

---

## 一、Firebase 是什么

Google 的移动端开发套件。把 App 开发中"除了写业务代码以外"的基础设施打包提供。集成 SDK 就能用，大部分免费。海外 App 的事实标准。

---

## 二、Firebase 核心能力

| 类别 | 能力 | 作用 |
|------|------|------|
| 质量 | Crashlytics | Crash 上报 + 堆栈还原 + 聚合 |
| 质量 | Performance Monitoring | 启动耗时/网络延迟/帧率 |
| 增长 | Analytics | 用户行为埋点/漏斗/留存 |
| 增长 | Remote Config | 远程配置/AB 实验/灰度开关 |
| 增长 | Cloud Messaging (FCM) | 推送通知（海外 Android 唯一可靠方案） |
| 开发 | Authentication | 登录认证（Google/Apple/邮箱） |
| 开发 | Firestore | 云数据库（实时同步） |
| 开发 | Cloud Storage | 文件存储 |
| 测试 | Test Lab | 真机云测试 |
| 发布 | App Distribution | 内测分发 |

**IoT App 最常用**：FCM（推送）+ Crashlytics + Analytics + Remote Config

---

## 三、集成方式（载体）

**两层都要集成**：

| 层 | 载体 | 说明 |
|----|------|------|
| Android 原生层 | Gradle 依赖（AAR） | `implementation 'com.google.firebase:firebase-crashlytics'` |
| RN JS 层 | npm 包 | `@react-native-firebase/app` + 各子模块 |

**具体结构**：

```
npm 包（@react-native-firebase/xxx）
├── JS 层：提供 React Hook / API 给业务代码调用
└── Native 层：内部依赖 Firebase 官方 AAR（Android）/ Pod（iOS）
```

所以 `@react-native-firebase` 本质是一个 **RN Plugin**——JS 接口 + Native 实现（内部调 Firebase 官方 SDK）。

**集成步骤**：
1. `npm install @react-native-firebase/app @react-native-firebase/crashlytics`
2. Android: `google-services.json` 放入 `android/app/`（Firebase 控制台下载）
3. Gradle 配置 Firebase 插件
4. JS 侧直接调用 API

---

## 四、出海 IoT App 的运维选型

| 能力 | 推荐方案 | 原因 |
|------|---------|------|
| Crash 上报 | Sentry 或 Firebase Crashlytics | Sentry RN 支持最好；Crashlytics 免费 |
| 性能监控 | Firebase Performance | 和 Google Play 数据打通 |
| 埋点分析 | Firebase Analytics + 自建 | 通用行为用 Firebase，业务指标自建 |
| 推送 | FCM | 海外 Android 唯一可靠方案 |
| AB 实验/灰度 | Firebase Remote Config | 免费，支持条件下发 |
| 日志 | AWS CloudWatch / 自建 | 设备通信日志量大且敏感 |
| 热更新 | 自建（S3 + CloudFront） | 分 Bundle 独立更新，社区方案不够 |

### 合规注意（GDPR/CCPA）

- 首次启动弹隐私弹窗，用户同意后才初始化 Firebase Analytics
- 提供"删除我的数据"入口
- 最小化采集（不采集不需要的信息）

---

## 五、架构师视角：接口层抽象

**核心原则**：业务代码不直接调 Firebase API，中间加一层抽象。

```
业务代码 → 监控 SDK 接口层（自定义） → 具体实现（Firebase / Sentry / 自建）
```

好处：
- 换底层实现不改业务代码（从 Firebase 换到 Sentry 只改实现层）
- 统一 API（不同平台/不同工具的 API 差异在实现层屏蔽）
- 可以同时上报多个平台（Crash 同时报 Sentry + Firebase）

```
// 接口层示例
interface MonitorSDK {
  reportCrash(error, context)
  trackEvent(name, params)
  setUser(userId)
  log(level, message)
}

// 实现层
class FirebaseMonitor implements MonitorSDK { ... }
class SentryMonitor implements MonitorSDK { ... }
```
