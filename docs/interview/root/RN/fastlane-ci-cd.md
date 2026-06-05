# 移动端 CI / CD 方案

## 目录

- [CI 和 CD 的区别](#ci-和-cd-的区别)
- [CI：持续集成](#ci持续集成)
- [CD：持续交付（Fastlane）](#cd持续交付fastlane)
  - [Fastlane 是什么](#fastlane-是什么)
  - [核心能力](#核心能力)
  - [项目结构](#项目结构)
  - [Fastfile 示例](#fastfile-示例)
  - [证书管理](#证书管理)
- [CD 平台配置（GitLab CI / GitHub Actions）](#cd-平台配置gitlab-ci--github-actions)
- [日常发版操作](#日常发版操作)
- [10 人小团队基础设施方案](#10-人小团队基础设施方案)
- [自建发布管理平台方案](#自建发布管理平台方案)
- [大厂 vs 小团队对比](#大厂-vs-小团队对比)

---

## CI 和 CD 的区别

CI 和 CD 是两个独立阶段，**跑在不同环境、不同时机触发**：

| | CI（持续集成） | CD（持续交付） |
|---|---|---|
| 目的 | 保证代码质量，尽早发现问题 | 快速安全地发版 |
| 触发时机 | 每次 push / MR | 打 tag / 手动触发 |
| 跑在哪 | GitLab 云端 Shared Runner（Linux，免费） | Mac Mini（self-hosted Runner） |
| 做什么 | lint + 单测 + 类型检查 + 构建验证 | 打包 + 签名 + 上传商店 |
| 频率 | 每天很多次 | 每周 1-2 次 |
| 需要证书 | ❌ | ✅ |
| 核心工具 | ESLint / Jest / TypeScript | **Fastlane** |
| 失败后果 | MR 不让合入 | 版本发不出去 |

**分开的原因**：
- CI 频率高，不需要占用 Mac Mini 资源
- CD 频率低，才需要真正打包
- CI 不需要证书/签名，Linux 就够
- Mac Mini 专注做 CD，不被 CI 任务占满

### 10 人团队实际部署

```
GitLab 云端 Shared Runner（免费，Linux）
  └── CI: lint / test / type-check（每次 MR 自动跑）

Mac Mini（局域网，self-hosted Runner）
  └── CD: Fastlane 打包 + 发布（打 tag 或手动触发）
```

---

## CI：持续集成

CI 部分跟 Fastlane 无关，用 GitLab CI 云端 Runner 跑就行：

```yaml
# .gitlab-ci.yml — CI 部分
stages:
  - ci

lint:
  stage: ci
  image: node:20
  script:
    - npm ci
    - npm run lint
    - npm run typecheck
  only:
    - merge_requests

test:
  stage: ci
  image: node:20
  script:
    - npm ci
    - npm run test -- --run
  only:
    - merge_requests
```

**要点**：
- 跑在 GitLab 免费的 Shared Runner 上（Linux）
- 每次 MR 自动触发
- 不需要 Xcode / Android SDK / 证书
- 全部通过才允许合入

---

## CD：持续交付（Fastlane）

### Fastlane 是什么

一个开源的**移动端发布自动化工具**（Ruby 写的），iOS 和 Android 都支持。

**本质是命令行脚本，没有界面。** 把打包、签名、上传、发布封装成一行命令。

> 注意：Fastlane 是 CD 工具，不负责 lint/test 这些 CI 的事。

### 核心能力

| 能力 | 命令 | iOS | Android |
|---|---|---|---|
| 证书管理 | `match` | ✅ 自动同步证书 | — |
| 打包 | `gym` / `gradle` | ✅ .ipa | ✅ .aab/.apk |
| 上传测试 | `pilot` / `supply` | ✅ TestFlight | ✅ Play 内测轨道 |
| 上传正式 | `deliver` / `supply` | ✅ App Store | ✅ Google Play |
| 截图 | `snapshot` / `screengrab` | ✅ | ✅ |
| 版本号管理 | `increment_build_number` | ✅ | ✅ |
| 通知 | `slack` | ✅ | ✅ |

### 依赖环境

| 平台 | 打包服务器需要 | 说明 |
|---|---|---|
| iOS | **macOS + Xcode** | Apple 限制，`xcodebuild` 只能在 macOS 跑 |
| Android | **JDK + Gradle + Android SDK CLI** | 不需要 Android Studio（只需命令行工具） |

### 项目结构

```
project/
├── fastlane/
│   ├── Fastfile          # 核心：定义各种 lane（发版流程）
│   ├── Appfile           # App 信息（bundle_id、apple_id 等）
│   ├── Matchfile         # 证书管理配置（可选）
│   └── Pluginfile        # 插件依赖
├── Gemfile               # Ruby 依赖（锁定 fastlane 版本）
└── ...
```

### Fastfile 示例

```ruby
# fastlane/Fastfile

platform :ios do
  desc "发布到 TestFlight（内测）"
  lane :beta do
    increment_build_number
    gym(scheme: "MyApp", export_method: "app-store")
    pilot(skip_waiting_for_build_processing: true)
    slack(message: "iOS Beta #{lane_context[SharedValues::BUILD_NUMBER]} 已发布 🚀")
  end

  desc "发布到 App Store（正式）"
  lane :release do
    gym(scheme: "MyApp", export_method: "app-store")
    deliver(
      force: true,
      submit_for_review: true,
      automatic_release: true
    )
  end
end

platform :android do
  desc "发布到 Google Play 内测"
  lane :beta do
    gradle(task: "bundleRelease")
    supply(track: "internal")
    slack(message: "Android Beta 已发布 🚀")
  end

  desc "发布到 Google Play 正式"
  lane :release do
    gradle(task: "bundleRelease")
    supply(track: "production", rollout: "0.1")  # 先灰度 10%
  end
end
```

### 证书管理

#### 方案 1：证书放打包服务器本地（小团队推荐）

只有一台 Mac Mini 做打包，证书直接放本地 Keychain，最简单：

```bash
# 证书导入 Keychain
security import distribution.p12 -k ~/Library/Keychains/login.keychain -P "password"

# Provisioning Profile 放到系统目录
cp MyApp_AppStore.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/
```

#### 方案 2：match（多机器需要同步时）

match 把证书存在私有 Git 仓库，所有机器自动同步：

```ruby
# fastlane/Matchfile
git_url("git@gitlab.com:team/ios-certificates.git")
type("appstore")
app_identifier("com.toggee.app")
```

#### 什么时候用哪个

| 场景 | 放本地 | 用 match |
|---|---|---|
| 只有一台打包机 | ✅ 够了 | 没必要 |
| 多台构建机 | ❌ 同步麻烦 | ✅ |
| 打包机挂了要换 | 手动重新导入 | 一行命令恢复 |

---

## CD 平台配置（GitLab CI / GitHub Actions）

> Fastlane 本身没有界面，界面由 CI 平台提供。小公司一般用 GitLab。

### GitLab CI 配置 CD

```yaml
# .gitlab-ci.yml — CD 部分（和上面的 CI 部分在同一文件，但阶段分开）
stages:
  - ci
  - cd

# CD: iOS 发布（只在打 tag 时触发，跑在 Mac Mini）
ios_beta:
  stage: cd
  tags:
    - macos  # 指定 Mac Mini runner
  only:
    - tags
  script:
    - cd ios && pod install
    - bundle exec fastlane ios beta

# CD: Android 发布
android_beta:
  stage: cd
  tags:
    - macos
  only:
    - tags
  script:
    - bundle exec fastlane android beta
```

**GitLab Runner 注册（在 Mac Mini 上）：**

```bash
# 安装
brew install gitlab-runner

# 注册（token 从 GitLab → Settings → CI/CD → Runners 获取）
gitlab-runner register \
  --url https://gitlab.com/ \
  --registration-token YOUR_TOKEN \
  --executor shell \
  --tag-list "macos"

# 启动为服务
gitlab-runner install
gitlab-runner start
```

### GitHub Actions 配置 CD（北美团队）

```yaml
# .github/workflows/cd-release.yml
name: CD - Release

on:
  push:
    tags: ['v*']

jobs:
  ios:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: cd ios && pod install
      - run: bundle exec fastlane ios beta

  android:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: bundle exec fastlane android beta
```

### GitLab vs GitHub

| | GitLab | GitHub |
|---|---|---|
| 私有仓库 | 免费无限 | 免费（有限制） |
| CI/CD | 内置 | GitHub Actions |
| 自托管 Runner | GitLab Runner | Self-hosted Runner |
| 小公司 | ✅ 多（国内/自建） | ✅ 多（北美/开源） |

---

## 日常发版操作

```bash
# 方式 1：打 tag 自动触发 CD（推荐）
git tag v1.2.0-beta.1
git push --tags
# → Mac Mini 上的 Runner 自动执行 Fastlane → 出包 → 上传 → 通知

# 方式 2：手动跑（调试时）
fastlane ios beta
fastlane android release

# 方式 3：CI 平台手动触发
# GitLab: CI/CD → Pipelines → Run Pipeline
# GitHub: Actions → Run workflow
```

### 完整流程图

```
开发 push → CI 自动跑（GitLab 云端 Linux Runner）：
              ├── ESLint
              ├── TypeScript 类型检查
              └── Jest 单测
              → ✅ 全部通过才允许合入 MR

合入 main → 打 tag → CD 触发（Mac Mini）：
              ├── iOS: Fastlane → Xcode 打包 → 上传 TestFlight
              ├── Android: Fastlane → Gradle 打包 → 上传 Play 内测
              └── 通知团队（Slack/飞书）

测试验收通过 → 手动触发正式发布（Mac Mini）：
              ├── iOS: deliver 提审 App Store
              ├── Android: supply 推到 production（灰度 10%）
              └── 监控 Crashlytics → 无异常 → 全量
```

---

## 10 人小团队基础设施方案

### 方案 A：一台 Mac Mini 搞定 CD（推荐）

```
Mac Mini (M2/M4, 16GB+)
├── iOS 构建：Xcode + xcodebuild + Fastlane
├── Android 构建：JDK 17 + Android SDK CLI + Gradle + Fastlane
├── 注册为 GitLab Runner（tag: macos）
└── 专门跑 CD（打包发布）
```

CI 跑在 GitLab 免费云端 Runner 上，Mac Mini 只负责 CD。

**成本**：~$600 一次性（Mac Mini M2 16GB）
**适用**：发版频率不高（每周 1-2 次），10 人以内

### 方案 B：双机分离

```
Mac Mini (CD 专用 - iOS + Android 打包)
Linux 服务器 (CI 专用 + 后端部署 + 其他)
```

**适用**：Linux 机器同时承担后端部署、定时任务等职责

### 搭建步骤（方案 A）

```bash
# 1. Mac Mini 初始化
xcode-select --install
brew install ruby
gem install bundler fastlane

# 2. Android 环境
brew install openjdk@17
sdkmanager "platforms;android-34" "build-tools;34.0.0"

# 3. 注册为 GitLab Runner
brew install gitlab-runner
gitlab-runner register --url https://gitlab.com/ --token YOUR_TOKEN --executor shell --tag-list "macos"
gitlab-runner install && gitlab-runner start

# 4. 证书导入 Keychain（一次性）
security import distribution.p12 -k ~/Library/Keychains/login.keychain -P "password"
```

### 为什么用 self-hosted 而不是云端 Runner

| | 云端 Runner | Self-hosted（Mac Mini） |
|---|---|---|
| macOS 费用 | GitLab: 无免费 macOS / GitHub: $0.08/分 | 免费 |
| 速度 | 每次冷启动（装依赖 5-10 分钟） | 依赖已缓存，快 |
| 隐私 | 代码上传公有云 | 代码留本地 |

---

## 自建发布管理平台方案

> 适合场景：产品/测试需要自己触发构建，不想让他们学 GitLab 操作。

### 思路

Mac Mini 上跑一个 Node.js Web 服务，团队在局域网访问页面点按钮发版：

```
团队成员浏览器 → 局域网访问 Mac Mini (192.168.x.x:3000)
                            ↓
              Node.js Server（Express）
                            ↓
              child_process.spawn('bundle exec fastlane ios beta')
                            ↓
              Fastlane → Xcode/Gradle → 出包 → 上传商店
                            ↓
              WebSocket 实时推送构建日志到前端
```

### 技术选型

```
Mac Mini (局域网)
├── 前端：React / Next.js（AI 一天搓完）
├── 后端：Node.js + Express
│   ├── POST /api/build/ios-beta     → 执行 fastlane ios beta
│   ├── POST /api/build/android-beta → 执行 fastlane android beta
│   ├── GET  /api/builds             → 构建历史
│   └── WS   /ws/build-log           → 实时日志
├── 存储：SQLite 存构建记录
├── Fastlane + Xcode + Android SDK
└── pm2 守护进程
```

### 核心代码

```ts
import { spawn } from 'child_process';

app.post('/api/build/ios-beta', async (req, res) => {
  const { branch, version } = req.body;
  const buildId = uuid();

  execSync(`git checkout ${branch} && git pull`, { cwd: PROJECT_PATH });

  const child = spawn('bundle', ['exec', 'fastlane', 'ios', 'beta'], {
    cwd: PROJECT_PATH,
    env: { ...process.env, VERSION: version },
  });

  child.stdout.on('data', data => wss.broadcast(buildId, data.toString()));
  child.stderr.on('data', data => wss.broadcast(buildId, data.toString()));

  child.on('exit', code => {
    saveBuildResult(buildId, code === 0 ? 'success' : 'failed');
    notifyFeishu(code === 0 ? '✅ iOS Beta 发布成功' : '❌ 构建失败');
  });

  res.json({ buildId, status: 'started' });
});
```

### 对比 GitLab CI 的 Web UI

| | GitLab CI Pipeline | 自建发布平台 |
|---|---|---|
| 搭建成本 | 零 | 1-2 天 |
| 操作门槛 | 需要 GitLab 账号 | 打开网页点按钮 |
| 定制化 | 有限 | 完全可控 |
| 适合谁 | 开发自己用 | 产品/测试也能操作 |

**建议**：先用 GitLab CI 顶着，真有需求再搓发布面板。

---

## 大厂 vs 小团队对比

| | 小团队（10 人） | 大厂 |
|---|---|---|
| CI | GitLab 云端 Shared Runner | 自建 Jenkins 集群 |
| CD | Mac Mini + Fastlane | 自研发布平台 + Mac 集群 |
| 界面 | GitLab Web UI / 自建简单页面 | 自建 Web 发布平台 + 审批流 |
| 证书 | 本地 Keychain | 自研证书管理系统 |
| 灰度 | Play Console + TestFlight | 自研灰度系统 |
| 成本 | 一台 Mac Mini (~$600) | 专职团队维护 |
