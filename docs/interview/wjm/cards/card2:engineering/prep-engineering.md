# 面试准备：JD 拆解与场景应答

> 针对 JD 中的每个核心能力项，拆解对方的场景痛点、我能做什么、经验支撑。

## 目录

- [工程化 & CI/CD](#工程化--cicd)
  - [对方痛点](#对方痛点)
  - [我能做什么](#我能做什么分阶段)
  - [经验支撑](#经验支撑)
  - [CI/CD 基础设施方案](#cicd-基础设施方案)
  - [全链路工程化详解](./engineering-fullchain.md)
- [跨端容器与 Hybrid 架构](#跨端容器与-hybrid-架构)
  - [拆解：4 个子能力](#拆解4-个子能力)
  - [他们可能的技术架构](#他们可能的技术架构)
  - [为什么不全用 RN](#为什么不全用-rn)
  - [QA 补充](#qa-补充)

---

## 工程化 & CI/CD

> JD："主导前端核心底座、公共框架、CI/CD 自动化流水线及工程化基建的搭建，解决跨平台开发中的深层次性能瓶颈与技术难题。"

### 场景：30 人 AI 泛娱乐创业公司（海内外，下月海外上线）

**背景约束**：
- 海外上线 → Google Play + App Store 审核合规
- 游戏化付费 → IAP/订阅收入 → 不能出线上事故（直接影响收入）
- 海内外双版本 → 多渠道构建（国内渠道包 + 海外 Google Play/App Store）

**他们大概率用什么**：

| 层面 | 海外产品典型选型 | 原因 |
|------|---------|------|
| 代码托管 | GitHub | 海外团队标配 |
| CI/CD | GitHub Actions | 免费 + 生态好 |
| 构建工具 | Fastlane（双端）| 打包+签名+上传一条龙 |
| iOS 分发 | TestFlight（内测）→ App Store | 苹果官方 |
| Android 分发 | Google Play Internal Testing → Production | Google 官方 |
| 热更新 | CodePush / EAS Update | RN 热更 |
| 监控 | Sentry / Firebase Crashlytics | 海外首选 |
| 支付 | RevenueCat / 自建 IAP 层 | 订阅+内购管理 |

### 对方痛点

1. **没有统一构建流程**：每个人本地环境不同，"我这能跑"
2. **发版靠人**：手动打包 → 签名 → 上传 → 容易出错
3. **没有质量卡控**：代码直接合进 main，没有 lint/test 门禁
4. **多 Bundle 管理混乱**：谁打的、哪个版本、怎么回滚？
5. **热更新没体系**：紧急修复靠人肉推，没有灰度/回滚
6. **出了问题难追溯**：不知道哪次提交引入了 bug
7. **海外上线合规风险**：Google Play / App Store 审核要求（隐私合规、支付合规、内容审核）
8. **多渠道管理**：国内版 vs 海外版，付费逻辑不同、合规要求不同、需要条件编译

### 我能做什么（分阶段）

**P0：基础流水线（1-2 周见效）**

```
PR 提交
  → ESLint + TypeScript 类型检查（门禁）
  → 单元测试跑通
  → 构建验证（能编译过）
  → 通过 → 允许合并
```

**P1：自动化发版（2-4 周）**

```
合并到 release 分支
  → Fastlane 自动构建 Android APK + iOS IPA
  → 自动签名（Match 管理 iOS 证书 / Keystore 管理 Android）
  → 自动上传 TestFlight（iOS）+ Google Play Internal（Android）
  → 自动生成 changelog
  → 通知测试群（Slack/飞书）
```

**P2：多 Bundle + 热更新体系（1-2 月）**

```
RN 多 Bundle 构建：
  → 自动识别变更的 Bundle
  → 增量构建（只构建变化的）
  → 版本号自动递增
  → 推送到热更新服务
  → 灰度发布（1% → 10% → 100%）
  → 异常自动回滚
```

### 经验支撑

| 他们的需求 | 我做过的 |
|-----------|---------|
| CI/CD 流水线 | XRN CLI + 多 Bundle 构建体系 |
| 热更新 | Pushy 集成 + 版本管理 |
| 质量卡控 | ESLint + Git Hooks + CI 门禁 |
| 包体优化 | R8 / 条件编译 / 依赖分析 |
| 监控体系 | 性能探针 SDK + CrashGuard |

### 叙述

> "30 人团队最缺的不是技术深度，是工程效率。我做过的事：从 0 搭建 RN 多 Bundle 的 CI/CD 流水线——PR 门禁自动跑 lint + test，合并自动构建双端包并分发，热更新走灰度 + 异常自动回滚。本质是把人工操作变成自动化，让开发专注写代码不操心发版。"

### CI/CD 基础设施方案

#### 触发策略（CI 轻量频繁，CD 手动/tag 触发）

| 事件 | 触发什么 | 在哪跑 | 耗时 |
|------|---------|--------|------|
| PR 提交/更新 | **CI**（lint + test，不构建包） | 轻量 Runner / Docker | 2-5 分钟 |
| 合并到 main | 不触发 CD（太频繁） | — | — |
| **打 tag** `v*` | CD 自动构建发布包 | Mac Mini | 10-30 分钟 |
| **手动触发**（指定分支） | CD 构建测试包 | Mac Mini | 10-30 分钟 |

**CD 触发方式**：
1. **打 tag**：`git tag v1.2.0 && git push --tags` → 自动触发正式包构建
2. **手动触发指定分支**：GitLab Web → CI/CD → Run Pipeline → 选分支 → 点 Run

#### 手动触发指定分支构建

GitLab CI 原生支持 `when: manual` + 选择分支：

```yaml
# .gitlab-ci.yml
build_app:
  stage: build
  when: manual                    # ← 手动触发（Web 界面点按钮）
  script:
    - fastlane ios beta
    - fastlane android beta
  only:
    - branches                    # 任何分支都可以手动触发
    - tags
```

操作方式：
```
GitLab Web → CI/CD → Pipelines → Run Pipeline
  → 选择分支（feature/xxx、develop、release 任意）
  → 点 "Run Pipeline"
  → Mac Mini 拉取该分支代码 → 构建 → 上传
```

**不需要 SSH，不需要登录 Mac Mini**，在 GitLab 网页上选分支点按钮就行。

#### Mac Mini 做 Runner（30 人团队够用）

一台 Mac Mini 放办公室，同时构建 iOS + Android（macOS 可以跑 Gradle）。

**Mac Mini = 纯服务器，不接显示器键盘（headless）**：
- 初次配置时 SSH 进去装好环境（Xcode CLI、Fastlane、Node、Gradle）
- 注册为 GitLab Runner
- 之后再也不用碰，角色等同 Linux 服务器

**Mac Mini 上装的东西分两类**：

```
1. gitlab-runner（后台常驻服务 = "调度者"）
   → 注册时绑定 GitLab 服务器地址
   → 启动后持续轮询 GitLab："有没有任务给我？"
   → 收到任务 → 拉代码 → 执行 .gitlab-ci.yml 里的 script
   → 执行完 → 上报结果给 GitLab

2. Fastlane / Xcode CLI / Gradle / Node（构建工具 = "干活的"）
   → 被 gitlab-runner 调用来执行具体构建
   → 不主动做任何事，等被调
```

**网络连接方向：Runner 主动连 GitLab（pull 模式），不是 GitLab 找 Runner**：

```
Mac Mini Runner → 主动轮询 → GitLab 服务器
  （Runner 知道 GitLab 的 IP，注册时配置的）
  （GitLab 不需要知道 Runner 的 IP）
```

**初次注册（只做一次）**：
```bash
# SSH 到 Mac Mini 执行
gitlab-runner register \
  --url http://192.168.1.100  \   # GitLab 局域网地址
  --token xxx                      # GitLab 后台生成的注册令牌

# 注册完启动为系统服务
gitlab-runner install && gitlab-runner start
# 之后 Runner 常驻后台，开机自启，无需人工干预
```

**完整链路（连贯版）**：

```
开发者在自己电脑浏览器访问 GitLab（http://192.168.1.100）
  → 点 Run Pipeline → 选分支 → 点 Run
  → GitLab 创建一个任务，标记"等待 Runner 领取"
  → Mac Mini 上的 gitlab-runner 轮询发现新任务
  → gitlab-runner 拉取指定分支代码
  → gitlab-runner 执行 script：调 fastlane build → 调 fastlane upload
  → 构建完成 → 产物上传到 TestFlight / Google Play
  → gitlab-runner 上报"任务成功"给 GitLab
  → 开发者在浏览器看到 Pipeline 变绿 ✅
```

**简单方案：GitLab + Runner 跑同一台 Mac Mini**（30 人够用）：
```
Mac Mini 一台机器同时跑：
  - GitLab 服务端（Docker 部署）
  - GitLab Runner（构建 iOS/Android）

开发者访问：http://192.168.1.100 或 http://gitlab.local
```

扩容：再加一台 Mac Mini 注册为第二个 Runner，GitLab 自动负载均衡。

#### iOS 分发：TestFlight（不需要打开 Xcode）

**上传 App Store / TestFlight 不需要 Xcode GUI**，Fastlane 命令行全自动：

```ruby
# Fastfile
lane :beta do
  match(type: "appstore")              # 自动下载签名证书
  build_app(scheme: "MyApp")           # xcodebuild 编译
  upload_to_testflight                  # 命令行上传（底层用 altool）
end
```

测试人员：在手机上装 TestFlight App → 收到邀请邮件 → 自动收到每次新包推送。

#### 热更新：海内外统一方案

| 方案 | 海外 | 国内 | 推荐 |
|------|------|------|------|
| CodePush（微软） | ✅ | ⚠️ 需代理/自建 CDN | 稳定但维护力度下降 |
| EAS Update（Expo） | ✅ | ⚠️ CDN 慢 | 适合 Expo 项目 |
| **自建**（bundle → OSS + CDN） | ✅ | ✅ | **最灵活，海内外统一** |

**海内外统一最佳方案 = 自建热更新服务**：
```
构建 bundle → 上传到 OSS（阿里云 / AWS S3）
  → CDN 加速（Cloudflare 全球 / 阿里云国内）
  → App 启动检查版本 → 下载差量包 → 热替换
```

#### 海内外一套 App 的策略

**一套代码 + 两个 flavor（条件编译）**：

| 维度 | 海外（overseas） | 国内（domestic） |
|------|------|------|
| 监控 | Firebase Crashlytics | Sentry 自部署 / Bugly |
| 埋点 | Firebase Analytics | 友盟 / 自建 |
| 推送 | FCM | JPush / 个推 |
| 支付 | Google Play Billing + Apple IAP | 微信/支付宝 |
| 热更新 | 统一自建（CDN 全球） | 统一自建（CDN 国内） |
| 分发 | Google Play + App Store | 多渠道包（华为/小米/vivo） |

```
// 运行时判断
if (Config.isOverseas) {
  Firebase.init();
} else {
  Bugly.init();
}

// 构建时条件编译（Gradle flavor / Xcode Build Config）
// overseas flavor 不包含微信 SDK
// domestic flavor 不包含 Firebase SDK
```

**结论**：一套业务代码（95% 共享）+ 两个构建产物（配置和 SDK 依赖不同）。