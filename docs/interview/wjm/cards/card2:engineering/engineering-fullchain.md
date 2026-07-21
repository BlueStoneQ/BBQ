# 全链路工程化（RN + H5 双端）

> 30 人 AI 泛娱乐创业公司，海内外产品，RN + H5 + Native Shell 架构。
> 本文覆盖：调试 → 构建 → 测试 → 发布 全链路。

## 目录

- [1. RN 调试](#1-rn-调试)
- [2. 云测与真机测试](#2-云测与真机测试)
- [3. 构建系统搭建](#3-构建系统搭建)
- [4. 发布体系](#4-发布体系)

---

## 1. RN 调试

### 工具链

| 工具 | 用途 | 适用场景 |
|------|------|---------|
| **React Native DevTools** | 官方内置调试器（RN 0.74+，替代 Flipper） | 日常开发首选 |
| **Chrome DevTools** | JS 断点调试（Hermes 直连） | JS 逻辑调试 |
| **React DevTools** | 组件树、Props、State 查看 | React 层调试 |
| **Xcode Instruments** | iOS 性能分析（CPU/内存/渲染） | iOS 性能问题 |
| **Android Studio Profiler** | Android 性能分析 | Android 性能问题 |
| **Reactotron** | 状态管理/网络/异步追踪 | Redux/Zustand 调试 |
| **adb logcat** | Android 原生日志 | Native 层问题 |

> Flipper 已在 RN 0.73 废弃，0.74+ 不再默认集成。官方用内置的 React Native DevTools 替代（基于 Chrome DevTools Protocol）。

### 调试流程

```
开发阶段调试流程：
  1. Metro Dev Server 启动（本地）
  2. 真机/模拟器连接 Dev Server（同局域网 / USB）
  3. Shake 手势 → Dev Menu → 打开调试器
  4. JS 调试：Chrome DevTools 自动 attach Hermes（RN DevTools 内置）
  5. UI 调试：React DevTools 组件树 + Dev Menu → Inspector
  6. 性能调试：Xcode Instruments / Android Studio Profiler
  7. 网络：Charles / Proxyman 抓包（RN DevTools 内置 Network 面板）
```

### RN 调试关键能力

| 能力 | 方式 |
|------|------|
| **JS 断点** | Chrome DevTools → Hermes → 直接断点（RN DevTools 内置） |
| **Hot Reload** | Metro Dev Server 自动推送变更 |
| **Network 抓包** | RN DevTools Network 面板 / Charles / Proxyman |
| **Native 日志** | adb logcat / Xcode Console |
| **状态调试** | Reactotron / React DevTools |
| **布局调试** | Dev Menu → Inspector / React DevTools |

### 多 Bundle 调试模式

```
调试单个 Bundle（日常开发）：
  当前开发的 Bundle → 从本地 Dev Server 加载（热更新）
  其他 Bundle → 从缓存/远程加载（不影响）

全量调试（集成测试）：
  所有 Bundle → 从本地 Dev Server 加载
  或：打 debug 包，所有 Bundle 内置
```

---

## 2. 云测与真机测试

### 方案：Mac Mini + 真机

**可以，但不建议叫"云测"——更准确叫"自动化测试环境"。**

```
Mac Mini（CI Runner）
  ├── USB 连接 Android 真机
  ├── USB 连接 iPhone 真机
  └── CI 任务中运行自动化测试脚本

触发方式：
  GitLab Pipeline → 测试阶段 → 在真机上跑 UI 自动化
```

### 自动化测试工具

| 工具 | 平台 | 用途 |
|------|------|------|
| **Detox** | iOS + Android | RN 官方推荐的 E2E 测试框架 |
| **Appium** | 跨平台 | 通用 UI 自动化 |
| **Maestro** | 跨平台 | 声明式 UI 测试（简单易用） |
| **XCTest** | iOS | Xcode 原生测试 |
| **uiautomator2** | Android | Android 原生 UI 自动化 |

### 实际方案（30 人团队推荐）

```
P0（先跑通）：
  - Jest 单元测试（CI 中跑，不需要真机）
  - 手动测试 + TestFlight/Internal Testing 分发

P1（有余力时）：
  - Detox E2E 测试（Mac Mini + 真机）
  - 关键路径自动化（启动 → 登录 → 核心流程 → 付费）

P2（团队成熟后）：
  - 全量 E2E 覆盖
  - 性能回归测试
```

**30 人团队现实**：手动测试 + 单元测试就够了，E2E 自动化 ROI 不高（维护成本 > 收益）。优先保证 CI 门禁（lint + test）+ TestFlight 快速分发。

---

## 3. 构建系统搭建

### 整体架构

```
Mac Mini（GitLab + Runner + 构建环境）
  ├── GitLab 服务端（Docker）
  ├── GitLab Runner（后台服务）
  ├── 构建工具：
  │   ├── Xcode CLI（iOS 构建）
  │   ├── Fastlane（自动化构建+签名+上传）
  │   ├── Gradle + Android SDK（Android 构建）
  │   ├── Node + pnpm（JS/RN 构建）
  │   └── CocoaPods / SPM（iOS 依赖）
  └── 真机（可选，用于自动化测试）
```

### 搭建步骤

**Step 1：Mac Mini 基础环境**
```bash
# Xcode CLI
xcode-select --install

# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node + pnpm
brew install node
npm install -g pnpm

# Android SDK
brew install --cask android-studio
# 或 sdkmanager 命令行安装

# Fastlane
brew install fastlane

# CocoaPods
sudo gem install cocoapods
```

**Step 2：GitLab 部署**
```bash
# Docker 部署 GitLab
docker run -d \
  --hostname gitlab.local \
  -p 80:80 -p 443:443 -p 22:22 \
  --name gitlab \
  --volume /srv/gitlab/config:/etc/gitlab \
  --volume /srv/gitlab/logs:/var/log/gitlab \
  --volume /srv/gitlab/data:/var/opt/gitlab \
  gitlab/gitlab-ce:latest
```

**Step 3：注册 Runner**
```bash
gitlab-runner register \
  --url http://localhost \
  --token <从 GitLab 后台获取> \
  --executor shell \
  --description "mac-mini-runner"

gitlab-runner install && gitlab-runner start
```

### 密钥管理

> **常见分离策略**：业务代码放云端（GitHub/GitLab.com），密钥/证书加密放公司内部服务器（Mac Mini）。构建时 Runner 从云端拉代码 + 从本地取密钥，合在一起完成签名。

| 密钥类型 | 存储位置 | 管理方式 |
|---------|---------|---------|
| **iOS 签名证书 + Profile** | 加密 Git 仓库（内网 GitLab） | Fastlane Match（推荐） |
| **Android Keystore** | GitLab CI/CD Variables（加密） | 环境变量注入 |
| **App Store Connect API Key** | GitLab CI/CD Variables | Fastlane 调用时注入 |
| **Google Play Service Account** | GitLab CI/CD Variables | JSON 密钥文件 |
| **环境变量（API Keys 等）** | GitLab CI/CD Variables | `.env` 构建时生成 |

**Fastlane Match（iOS 证书管理最佳实践）**：
```ruby
# Matchfile
git_url("git@gitlab.local:ios-team/certificates.git")  # 加密存储在私有仓库
type("appstore")
app_identifier("com.example.myapp")

# CI 中自动解密下载证书
lane :build do
  match(type: "appstore", readonly: true)  # 只读，不修改证书
  build_app(scheme: "MyApp")
end
```

**Android Keystore**：
```yaml
# .gitlab-ci.yml
build_android:
  script:
    # 从 CI Variables 中解码 Keystore 文件
    - echo $ANDROID_KEYSTORE_BASE64 | base64 --decode > app/release.keystore
    - ./gradlew assembleRelease
  variables:
    KEYSTORE_PASSWORD: $KEYSTORE_PASSWORD
    KEY_ALIAS: $KEY_ALIAS
    KEY_PASSWORD: $KEY_PASSWORD
```

### .gitlab-ci.yml 完整示例

```yaml
stages:
  - lint
  - test
  - build
  - deploy

# CI：每次 PR 触发（轻量）
lint:
  stage: lint
  script:
    - pnpm install
    - pnpm run lint
    - pnpm run typecheck
  only:
    - merge_requests

test:
  stage: test
  script:
    - pnpm install
    - pnpm run test
  only:
    - merge_requests

# CD：手动触发 或 tag 触发（重量）
build_ios:
  stage: build
  when: manual  # 手动触发
  script:
    - pnpm install
    - cd ios && pod install && cd ..
    - fastlane ios beta
  only:
    - branches
    - tags

build_android:
  stage: build
  when: manual
  script:
    - pnpm install
    - echo $ANDROID_KEYSTORE_BASE64 | base64 --decode > android/app/release.keystore
    - cd android && ./gradlew assembleRelease
    - fastlane android beta
  only:
    - branches
    - tags

# 发布：tag 自动触发
deploy_production:
  stage: deploy
  script:
    - fastlane ios release
    - fastlane android release
  only:
    - tags
  when: manual  # 即使 tag 触发也需要手动确认
```

---

## 4. 发布体系

### 发布流程

```
开发完成 → 合并到 release 分支
  → 手动触发 CD（GitLab Run Pipeline）
  → 构建双端包
  → 上传 TestFlight + Google Play Internal
  → QA 验证
  → 打 tag（v1.2.0）
  → 手动确认 → 发布到 App Store + Google Play Production
```

### 发布包含在构建系统中吗？

**是的，发布是 CD 的最后一步**，和构建在同一个 Pipeline 中：

```
Pipeline 阶段：
  lint → test → build → deploy
                         ↑
                    发布在这里
```

但通常**发布需要手动确认**（`when: manual`），不自动推生产。

### 版本管理

```
版本号：major.minor.patch（语义化）
  major：大版本/breaking change
  minor：新功能
  patch：bug fix / 热更新

Git 分支模型：
  main（稳定）→ release/1.2（发布准备）→ tag v1.2.0（正式发布）
  feature/* → 合并到 main
  hotfix/* → 合并到 release + main
```

### 热更新与发版的关系

```
正式发版（走商店审核）：
  → Native 代码变更
  → 新功能上线
  → 频率：1-2 周一次

热更新（不走商店）：
  → 仅 JS Bundle 变更
  → Bug 修复 / 文案调整
  → 频率：随时
  → 灰度 → 全量 → 异常自动回滚
```

### CD 三条发布线

**CD 本质是三条独立的发布管道，频率和流程各不相同**：

```
┌─────────────────────────────────────────────────────────────┐
│ CD = 三条独立管道                                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ① H5 发布（最快，分钟级）                                    │
│    构建 → 上传 CDN → 灰度（1%→10%→100%）→ 即时生效           │
│                                                               │
│ ② RN Bundle 热更新（快，小时级）                             │
│    构建 Bundle → 上传热更新服务 → 灰度 → App 内静默更新      │
│                                                               │
│ ③ Native 包发布（慢，天级）                                  │
│    构建 APK/IPA → 签名 → 上传商店 → 审核（1-3天）→ 上架     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### ① H5 构建 + 灰度发布

```
触发：H5 代码合并到 main / 手动触发
构建：pnpm build → 产出静态资源（html/css/js）
上传：上传到 OSS（阿里云/AWS S3）
灰度：CDN 配置流量比例（1% → 10% → 100%）
回滚：切换 CDN 指向上一个版本的资源目录
生效：用户刷新页面即可（无需更新 App）
```

```yaml
# .gitlab-ci.yml
deploy_h5:
  stage: deploy
  script:
    - pnpm --filter h5-app build
    - aws s3 sync dist/ s3://cdn-bucket/h5/v${CI_COMMIT_TAG}/ --delete
    - aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/h5/*"
  only:
    - tags
  when: manual
```

**灰度机制**：
- CDN 按 cookie / userId 分流
- 或：版本文件（`version.json`）控制客户端拉取哪个版本
- 异常监控：灰度期间 Sentry 错误率飙升 → 自动回滚

#### ② RN Bundle 热更新 + 灰度发布

```
触发：RN 代码合并 / 手动触发
构建：metro bundle → 产出 .bundle 文件 + assets
差量：与上一版本 diff → 生成 patch（减少下载体积）
上传：上传到热更新服务（自建 / CodePush）
灰度：服务端配置灰度比例
下发：App 启动/切后台时检查更新 → 静默下载 → 下次启动生效
回滚：服务端标记版本为 revoked → App 回退到上一版本
```

```yaml
deploy_rn_bundle:
  stage: deploy
  script:
    - pnpm install
    - npx react-native bundle --platform android --entry-file index.js --bundle-output ./build/index.android.bundle
    - npx react-native bundle --platform ios --entry-file index.js --bundle-output ./build/index.ios.bundle
    # 上传到热更新服务
    - node scripts/upload-bundle.js --version=$CI_COMMIT_TAG --gray=10
  only:
    - tags
  when: manual
```

**灰度策略**：
```
发布 → 1% 用户（观察 1h）
  → Sentry 无异常 → 扩大到 10%（观察 4h）
  → 无异常 → 100% 全量
  → 有异常 → 自动回滚 + 告警
```

**多 Bundle 场景**：
```
识别变更的 Bundle → 只构建变化的 → 独立灰度
  bundle-home（未变）→ 不发布
  bundle-payment（变了）→ 构建 + 灰度发布
  bundle-activity（变了）→ 构建 + 灰度发布
```

#### ③ Native 包（APK/IPA）发布

```
触发：打 release tag
构建：Fastlane 构建双端包
签名：Match（iOS）/ Keystore（Android）
上传：TestFlight（iOS）/ Google Play Internal（Android）
测试：QA 在 TestFlight / Internal Testing 验证
发布：手动确认 → 提交 App Store / Google Play Production 审核
审核：iOS 1-3 天 / Android 几小时到 1 天
```

```yaml
deploy_native:
  stage: deploy
  script:
    - fastlane ios release   # 构建+签名+上传 App Store
    - fastlane android release  # 构建+签名+上传 Google Play
  only:
    - tags
  when: manual  # 必须手动确认
```

#### 三条线对比

| | H5 | RN Bundle | Native 包 |
|--|----|-----------|----|
| **频率** | 随时（天/周多次） | 随时（周多次） | 1-2 周一次 |
| **生效时间** | 即时（刷新页面） | 下次启动 | 审核后（1-3 天） |
| **需要审核** | ❌ | ❌ | ✅ |
| **能改什么** | H5 页面（HTML/CSS/JS） | RN JS 代码 + 样式 | Native 代码 + 任何东西 |
| **不能改什么** | Native 能力 | Native 代码 / 新 Native 模块 | — |
| **回滚速度** | 秒级（切 CDN） | 分钟级（服务端标记） | 天级（重新提审） |
| **灰度** | CDN 分流 | 热更新服务端配置 | 商店灰度发布（Google Play 支持） |
| **风险** | 低 | 中（可能 crash） | 高（回滚慢） |

#### 三条线的协作

```
日常迭代（不改 Native）：
  H5 活动页 → ① H5 发布
  RN 业务逻辑修复 → ② 热更新
  紧急 bug → ② 热更新（灰度 + 回滚）

大版本（改 Native）：
  新 Native 模块 / 升级 RN 版本 → ③ Native 发版
  发版后立即跟一次 ② 热更新（修复发版后发现的问题）
```


### CD 本质与自建决策

#### 核心思路（三条线统一）

```
三条线本质相同：拉代码 → 构建 → 发布
区别只是构建工具、产物、发布目标不同：

  ① H5：  拉代码 → pnpm build       → 上传 CDN
  ② RN：  拉代码 → metro bundle     → 上传热更新服务（OSS）
  ③ Native：拉代码 → fastlane build → 上传商店
```

#### 哪些自建，哪些用云

| 环节 | 自建？ | 用什么 | 为什么 |
|------|--------|--------|--------|
| GitLab + Runner | **自建**（Mac Mini） | GitLab CE + gitlab-runner | iOS 构建必须 macOS |
| H5 CDN | **不自建** | 阿里云 OSS + CDN / AWS S3 + CloudFront | 成熟云服务，按量付费 |
| RN 热更新服务 | **轻量自建** | 一个 Node API + OSS 存 bundle | 海内外统一，CodePush 维护力度下降 |
| Native 发布 | **不自建** | TestFlight + Google Play | 苹果/Google 官方，没有替代 |
| 灰度控制 | **轻量自建** | 一个接口返回版本号+灰度比例 | 逻辑简单，不需要第三方 |

#### 自建热更新服务有多"轻"

```
本质就三样东西：

1. 一个 API（Node/Go 都行，十几行代码）：
   GET /check-update?appVersion=1.2.0&platform=ios&bundleId=home
   → { needUpdate: true, url: "https://cdn.xxx/bundles/home-v102.bundle", gray: 10 }

2. 一个 OSS 桶存 bundle 文件：
   s3://my-bundles/
     ├── home-v101.bundle
     ├── home-v102.bundle（新版本）
     └── payment-v50.bundle

3. 一个管理界面（初期可以是 JSON 文件/简单后台）：
   配置哪个 bundle 灰度多少、是否回滚

不是什么大系统。一个人半天能搭完。
```


### Expo 到自建 Shell 的演进路径

**不推翻 Expo，渐进式升级**：

| 阶段 | 架构 | 触发条件 |
|------|------|---------|
| 现状 | Expo Managed Workflow | 快速验证产品 |
| Phase 1 | Expo Bare Workflow（eject） | 需要自定义 Native 模块时 |
| Phase 2 | 自建 Shell + 保留 EAS Update | 需要多 Bundle / WebView 容器定制 |
| Phase 3 | 完全自建（Shell + CI/CD + 热更新） | 需要完全可控时 |

**Expo 的天花板（迟早碰到）**：
- 自定义 TurboModule（BLE/支付/音视频）
- 多 Bundle 独立灰度
- 深度定制 WebView 容器
- 复杂 Native 逻辑（后台任务/进程保活）
- 自建 CI/CD（完全可控）

**定位**：Expo 解决 0→1，我能解决 1→10。渐进式迁移，不推翻重来。

### 架构演进：monorepo + DDD + 多 Bundle

**泛娱乐 App 业务域多，适合按域拆分——但要看阶段**：

| 阶段 | 团队规模 | 架构选择 | 理由 |
|------|---------|---------|------|
| 0→1（现在） | 5-8 前端 | Expo 单 bundle + monorepo | 快速出产品 |
| 1→3（半年后） | 10-15 前端 | Bare RN + monorepo + 按域拆包 | 多人并行需要隔离 |
| 3→10（一年后） | 20+ 前端 | 自建 Shell + 多 bundle + DDD | 独立发布、独立灰度 |

**monorepo 现在就可以用（成本低收益高）**：
```
monorepo/
├── apps/
│   ├── mobile/          ← RN 主应用
│   └── admin/           ← 管理后台
├── packages/
│   ├── @myapp/bridge    ← 统一 Bridge SDK
│   ├── @myapp/ui        ← 公共组件库
│   ├── @myapp/payment   ← 支付领域
│   ├── @myapp/social    ← 社交领域
│   └── @myapp/game      ← 游戏化互动领域
└── tools/
    └── cli/             ← 开发工具
```

**DDD 在这里的价值**：不是复杂的领域建模，而是**按业务域隔离代码和发布**——游戏化互动频繁迭代不影响支付模块的稳定性。

**多 bundle 不急**：等 monorepo 里的 packages 稳定后，再按域拆成独立 bundle 独立热更新。
