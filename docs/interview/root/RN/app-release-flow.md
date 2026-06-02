# App 发布流程（iOS + Android 双端）

> RN 架构师需要了解的完整发布流程——从构建到上架，双端对比。

---

## 目录

- [双端流程对比总览](#双端流程对比总览)
- [1. 证书与签名体系](#1-证书与签名体系)
- [2. 构建](#2-构建)
- [3. 内测分发](#3-内测分发)
- [4. 提审与审核](#4-提审与审核)
- [5. 审核规则（踩坑点）](#5-审核规则踩坑点)
- [6. 发布与灰度](#6-发布与灰度)
- [7. 热更新](#7-热更新)
- [RN 项目的双端发布实践](#rn-项目的双端发布实践)

---

## 双端流程对比总览

| 阶段 | iOS | Android |
|------|-----|---------|
| 签名 | 证书 + Provisioning Profile + Entitlements | KeyStore 文件 |
| 构建工具 | Xcode + CocoaPods | Gradle |
| 产物 | .ipa | .apk / .aab |
| 内测 | TestFlight | Google Play Internal Testing / Firebase |
| 审核 | App Review（1-7 天，通常 24-48h） | Google Play Review（几小时） |
| 灰度 | 7 天分阶段（1%→100%） | 自定义百分比 |
| 热更新 | 允许更新 JS Bundle | 同 |
| 自动化 | fastlane + xcodebuild | fastlane + Gradle |
| 费用 | $99/年 | $25 一次性 |

---

## 1. 证书与签名体系

> 这是 iOS 发布最复杂的部分，也是新手最头疼的。

### 核心概念

| 概念 | 作用 | 类比 |
|------|------|------|
| **Apple Developer Account** | 开发者账号（$99/年） | 营业执照 |
| **Certificate（证书）** | 证明"这个 App 是我（公司）开发的" | 身份证 |
| **App ID** | App 的唯一标识（com.company.appname） | 门牌号 |
| **Provisioning Profile** | 把证书 + App ID + 设备绑定在一起 | 通行证（谁、做什么、在哪些设备） |
| **Entitlements** | 声明 App 需要的能力（BLE/Push/Background） | 资质证明 |

### 证书类型

```
Development Certificate — 开发调试用
Distribution Certificate — 发布用（App Store / Ad Hoc / Enterprise）
```

### Provisioning Profile 类型

```
Development — 绑定开发证书 + 指定设备（最多 100 台）
Ad Hoc — 绑定发布证书 + 指定设备（内部测试分发）
App Store — 绑定发布证书 + 不限设备（提交商店用）
Enterprise — 企业内部分发（不经商店，需 $299 企业账号）
```

### 实践中怎么管

- 小团队：Xcode 自动管理（Automatically manage signing）
- 大团队/CI：手动管理证书 + fastlane match（Git 仓库存证书，团队共享）

---

## 2. 构建

### 手动构建

```
Xcode → Product → Archive → 生成 .xcarchive
  → Distribute App → App Store Connect → 上传
```

### CI 自动化构建（推荐）

```bash
# 清理 + 构建 + 归档
xcodebuild -workspace MyApp.xcworkspace \
  -scheme MyApp \
  -configuration Release \
  -archivePath build/MyApp.xcarchive \
  archive

# 导出 .ipa
xcodebuild -exportArchive \
  -archivePath build/MyApp.xcarchive \
  -exportPath build/output \
  -exportOptionsPlist ExportOptions.plist

# 上传到 App Store Connect
xcrun altool --upload-app -f build/output/MyApp.ipa \
  --type ios --apiKey xxx --apiIssuer xxx
```

### fastlane（业界标准自动化工具）

```ruby
# Fastfile
lane :release do
  match(type: "appstore")           # 自动下载/创建证书
  build_app(scheme: "MyApp")        # 构建
  upload_to_testflight              # 上传到 TestFlight
end
```

---

## 3. TestFlight 内测

**TestFlight 是什么**：Apple 官方的内测分发工具（免费）。

### 流程

```
上传 .ipa 到 App Store Connect
  → App Store Connect 自动处理（编译检查、约 10-30 分钟）
  → 内部测试（Internal Testing）：最多 100 人，无需审核，立即可用
  → 外部测试（External Testing）：最多 10000 人，需 Beta 审核（通常几小时）
  → 测试人员通过 TestFlight App 安装
  → 收集反馈 + Crash 报告
```

### 内部测试 vs 外部测试

| | 内部测试 | 外部测试 |
|--|---------|---------|
| 人数 | 100 | 10000 |
| 审核 | 不需要 | 需要 Beta 审核 |
| 人员要求 | 必须是 App Store Connect 团队成员 | 任何人（邮箱邀请） |
| 用途 | 开发团队自测 | 真实用户内测 |

---

## 4. App Store 提审

### 提交材料

```
App Store Connect 后台填写：
├── App 名称、副标题、关键词
├── 描述、更新日志（What's New）
├── 截图（多种设备尺寸：6.7"/6.5"/5.5"/iPad）
├── App 预览视频（可选）
├── 年龄分级
├── 隐私政策 URL
├── 联系信息
└── App Review 备注（给审核员看的说明）
```

### 审核时间

- 首次提交：通常 24-48 小时
- 更新版本：通常 24 小时内
- 被拒后重新提交：可能更慢
- 加急审核：可以申请（有正当理由，如严重 Bug 修复）

---

## 5. 审核规则（踩坑点）

> RN/IoT App 常见被拒原因：

| 拒审原因 | 说明 | 怎么避免 |
|---------|------|---------|
| **热更新改变核心功能** | Apple 允许更新 JS，但不能偷偷加新功能 | 热更新只做 Bug 修复和小改动 |
| **权限用途说明不清** | Info.plist 的 Usage Description 写得太模糊 | 明确写"为了连接 XX 设备需要蓝牙权限" |
| **后台能力滥用** | 声明了 Background Mode 但没实际用到 | 只声明真正需要的（bluetooth-central） |
| **缺少设备不可用时的降级** | App 依赖蓝牙设备，但没设备时崩溃/空白 | 提供 Demo 模式或友好提示 |
| **隐私政策缺失** | 没有隐私政策页面 | 必须提供可访问的 URL |
| **IPV6 兼容** | Apple 网络审核是纯 IPv6 环境 | 不要硬编码 IPv4 地址 |
| **UIWebView** | 使用了废弃的 UIWebView | 确保所有依赖都用 WKWebView |

---

## 6. 发布与灰度

### 发布选项

```
审核通过后可以选择：
├── 立即发布（Immediately）
├── 手动发布（Manual Release）← 你自己点"发布"按钮
└── 定时发布（Scheduled）← 指定日期时间
```

### 灰度（Phased Release）

```
Apple 支持分阶段发布（Phased Release）：
- 第 1 天：1% 用户
- 第 2 天：2%
- 第 3 天：5%
- 第 4 天：10%
- 第 5 天：20%
- 第 6 天：50%
- 第 7 天：100%

可以随时暂停或加速到 100%。
注意：只对自动更新用户生效，手动更新的用户直接拿到新版本。
```

---

## 与 Android 发布流程对比

| 维度 | iOS | Android |
|------|-----|---------|
| 签名复杂度 | 高（证书 + Profile + Entitlements） | 低（一个 KeyStore 文件） |
| 审核速度 | 1-7 天（通常 24-48h） | 几小时 |
| 审核严格度 | 严格（热更新/权限/隐私） | 相对宽松 |
| 内测分发 | TestFlight（免费，集成好） | Google Play Internal Testing / Firebase Distribution |
| 灰度 | 7 天分阶段 | 百分比灰度（自定义比例） |
| 自动化工具 | fastlane + xcodebuild | fastlane + Gradle |
| 费用 | $99/年 | $25 一次性 |

---

## 7. 热更新

> RN 项目的关键优势——不经过商店审核就能更新 JS 代码。

| | iOS | Android |
|--|-----|---------|
| 允许范围 | JS Bundle 可更新（不能更新原生代码） | 同 |
| 审核风险 | 如果热更新改变核心功能 → 可能被 Apple 拒审 | Google 限制较松 |
| 方案 | CodePush（微软） / 自建热更新服务 | 同 |
| 流程 | 打新 Bundle → 上传 CDN → App 启动时检查版本 → 下载 → 替换 → 重启 JS | 同 |
| 灰度 | CodePush 支持百分比灰度 | 同 |
| 回滚 | CodePush 支持一键回滚 | 同 |

**自建热更新流程**（XRN 的方案）：
```
1. CI 构建新 JS Bundle（bsdiff 生成差量包）
2. 上传到 CDN + 更新版本信息接口
3. App 启动时请求版本接口 → 发现新版本
4. 下载差量包 → 合并到本地 Bundle
5. 下次启动加载新 Bundle
6. 如果新 Bundle 崩溃 → 自动回滚到上一版本
```

---

## RN 项目的双端发布实践

### 目录结构

```
MyApp/
├── ios/                    ← iOS 原生代码
│   ├── MyApp.xcworkspace   ← 用这个打开（因为有 CocoaPods）
│   ├── MyApp/
│   │   ├── Info.plist      ← 权限声明、App 配置
│   │   ├── AppDelegate.mm  ← 入口
│   │   └── Entitlements    ← 能力声明
│   ├── Podfile             ← CocoaPods 依赖
│   └── Podfile.lock
├── android/                ← Android 原生代码
└── src/                    ← RN JS 代码
```

### CI/CD 建议

```
推荐方案：GitHub Actions / GitLab CI + fastlane

流程：
1. 触发：push tag (v1.2.3) 或手动触发
2. 安装依赖：yarn install + pod install
3. 匹配证书：fastlane match
4. 构建：fastlane build_app
5. 上传：fastlane upload_to_testflight
6. 通知：Slack/飞书通知团队
```

### 常见问题

- `pod install` 失败 → 删除 Pods/ 和 Podfile.lock 重新安装
- 签名错误 → 检查 Provisioning Profile 是否匹配 Bundle ID
- Hermes 构建报错 → 确认 Podfile 里 `hermes_enabled => true`
- 新 RN 版本升级 → 可能需要更新 ios/ 下的原生文件（用 react-native upgrade）
