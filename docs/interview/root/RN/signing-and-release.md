# RN App 签名与发布全流程

## 目录

- [Android 签名与发布](#android-签名与发布)
- [iOS 签名与发布](#ios-签名与发布)
- [CI 自动化发布](#ci-自动化发布)
- [对比总结](#对比总结)

---

## Android 签名与发布

### Step 1：生成签名密钥（一次性，永久保管）

```bash
# 用 Java keytool 生成 keystore 文件
keytool -genkeypair -v \
  -keystore my-release-key.keystore \  # 输出文件名
  -alias my-key-alias \                 # 密钥别名（后面要用）
  -keyalg RSA \                         # 加密算法
  -keysize 2048 \                       # 密钥长度
  -validity 10000                       # 有效期（天）

# 交互式输入：
#   密钥库密码（storePassword）
#   你的姓名/组织/城市/国家
#   密钥密码（keyPassword）
```

**产物**：`my-release-key.keystore` 文件。

⚠️ **这个文件丢了就永远不能更新 App**（Google Play 绑定签名，换签名 = 新 App）。必须安全备份。

### Step 2：配置 Gradle 使用签名

```groovy
// android/app/build.gradle
android {
  signingConfigs {
    release {
      storeFile file('my-release-key.keystore')  // keystore 文件路径
      storePassword 'your-store-password'         // 密钥库密码
      keyAlias 'my-key-alias'                     // 别名（Step 1 中设的）
      keyPassword 'your-key-password'             // 密钥密码
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release        // release 构建使用此签名
      minifyEnabled true
      shrinkResources true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

**安全做法**：密码不要硬编码在 build.gradle 里，用环境变量或 `gradle.properties`（加入 .gitignore）：

```properties
# ~/.gradle/gradle.properties（不提交 git）
MYAPP_RELEASE_STORE_PASSWORD=xxx
MYAPP_RELEASE_KEY_PASSWORD=xxx
```

```groovy
// build.gradle 中引用
storePassword System.getenv("KEYSTORE_PASSWORD") ?: project.property("MYAPP_RELEASE_STORE_PASSWORD")
```

### Step 3：构建签名包

```bash
# 构建 AAB（上传 Google Play）
cd android && ./gradlew bundleRelease
# 产物：android/app/build/outputs/bundle/release/app-release.aab

# 或构建 APK（国内商店 / 直接安装）
./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

### Step 4：上传 Google Play

1. 登录 [Google Play Console](https://play.google.com/console)
2. 创建应用（首次）或选择已有应用
3. Production → Create new release
4. 上传 `.aab` 文件
5. 填写版本说明（Release notes）
6. Review → Start rollout
7. 审核通过（几小时~1天）→ 上架

### Step 5：内测分发（不上架，给测试团队用）

```
方式一：Google Play 内测轨道
  Play Console → Testing → Internal testing → 上传 .aab → 邀请测试者邮箱

方式二：Firebase App Distribution（更灵活）
  firebase appdistribution:distribute app-release.apk --groups "testers"

方式三：直接发 APK（最简单）
  把 .apk 文件发给测试者，手动安装
```

---

## iOS 签名与发布

### 前置条件

1. **Apple Developer 账号**（$99/年）— [developer.apple.com](https://developer.apple.com)
2. **Mac + Xcode**（只能在 macOS 上构建 iOS 应用）

### 签名体系（三个东西）

```
Certificate（证书）
  → 证明"你是谁"（开发者身份）
  → Apple 颁发，存在 Mac 钥匙串中
  → 分两种：Development（调试）/ Distribution（发布）

App ID（应用标识）
  → 证明"这是哪个 App"
  → 格式：com.mycompany.myapp（= Bundle Identifier）
  → 在 Apple Developer Portal 创建

Provisioning Profile（配置文件）
  → 把 Certificate + App ID + 设备列表 绑在一起
  → 分两种：Development（指定设备调试）/ Distribution（App Store 发布）
```

### Step 1：获取证书（Xcode 自动管理，推荐）

```
Xcode → Preferences → Accounts → 登录 Apple ID
  → Xcode 自动创建/下载 Certificate
  → 存入 Mac 钥匙串（Keychain）

或手动：
  Apple Developer Portal → Certificates → 创建 → 下载 .cer → 双击安装到钥匙串
```

### Step 2：配置签名（Xcode 自动管理）

```
Xcode → 选择项目 → Signing & Capabilities
  → Team: 选择你的开发者账号
  → ✅ Automatically manage signing
  → Xcode 自动处理 Certificate + Profile 的匹配

Bundle Identifier: com.mycompany.myapp（必须唯一，全球不能重复）
```

### Step 3：构建 Archive + 导出 IPA

**3a. 构建 Archive**（产出 `.xcarchive`，中间产物，包含编译好的二进制 + dSYM 符号表）

```
Xcode → Product → Archive（必须选 Generic iOS Device，不能选模拟器）
  → 等待编译完成
  → 弹出 Organizer 窗口，显示 Archive 列表
```

或命令行：
```bash
xcodebuild archive \
  -workspace ios/MyApp.xcworkspace \
  -scheme MyApp \
  -archivePath build/MyApp.xcarchive
```

**3b. 导出 IPA**（从 Archive 导出最终的 `.ipa` 安装包）

```
Xcode Organizer 里点 "Distribute App" 时会自动完成 export + upload。
如果用命令行需要显式导出：
```

```bash
xcodebuild -exportArchive \
  -archivePath build/MyApp.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ExportOptions.plist
# → 产出 build/MyApp.ipa
```

ExportOptions.plist 示例：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>  <!-- app-store / ad-hoc / enterprise / development -->
  <key>teamID</key>
  <string>YOUR_TEAM_ID</string>
  <key>uploadSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
```

> **面试要点**：Archive 是中间产物（.xcarchive），IPA 才是最终可分发的包。Xcode GUI 里 Distribute App 把 export + upload 合并了，但 CI/CD 命令行场景必须显式分两步。

### Step 4：上传到 App Store Connect

```
Organizer → 选择 Archive → Distribute App
  → App Store Connect → Upload
  → 等待上传完成（几分钟）

或命令行（用 Xcode 自带的 altool）：
xcrun altool --upload-app -f MyApp.ipa -t ios -u "apple-id" -p "app-specific-password"
```

### Step 5：提交审核

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 选择 App → 新版本
3. 选择刚上传的 Build
4. 填写：版本说明、截图（各尺寸）、关键词、分类
5. Submit for Review
6. 审核（1~3 天，首次可能更久）→ 通过 → 上架

### Step 6：内测分发（TestFlight）

```
App Store Connect → TestFlight
  → 上传的 Build 自动出现在 TestFlight
  → 添加内部测试者（邮箱）→ 他们收到邀请 → 通过 TestFlight App 安装
  → 内部测试不需要审核，外部测试需要简单审核（~1天）
```

---

## CI 自动化发布

### 工具：Fastlane（业界标准）

```bash
# 安装
gem install fastlane
# 或
brew install fastlane
```

### Android CI

```ruby
# android/fastlane/Fastfile
lane :release do
  gradle(task: "bundleRelease")
  supply(  # 上传到 Google Play
    track: "production",  # 或 "internal"（内测）
    aab: "app/build/outputs/bundle/release/app-release.aab"
  )
end
```

### iOS CI

```ruby
# ios/fastlane/Fastfile
lane :release do
  match(type: "appstore")  # 自动下载/创建证书和 Profile（存在 Git 私有仓库）
  gym(scheme: "MyApp")     # 构建 + 签名 → 产出 .ipa
  deliver                  # 上传到 App Store Connect
end
```

**match**：Fastlane 的证书管理方案——把证书和 Profile 加密存在 Git 私有仓库，CI 机器自动拉取，团队共享同一套证书，不用每人手动管理。

### GitLab CI 完整示例

```yaml
stages:
  - build
  - deploy

build-android:
  stage: build
  script:
    # 从 CI 变量中还原 keystore
    - echo $KEYSTORE_BASE64 | base64 -d > android/app/my-release-key.keystore
    - cd android && ./gradlew bundleRelease
  artifacts:
    paths:
      - android/app/build/outputs/bundle/release/

deploy-android:
  stage: deploy
  script:
    - fastlane supply --aab android/app/build/outputs/bundle/release/app-release.aab --track internal

build-ios:
  stage: build
  tags: [macos]  # iOS 构建必须在 macOS Runner 上
  script:
    - cd ios && pod install
    - fastlane match appstore
    - fastlane gym
  artifacts:
    paths:
      - ios/build/MyApp.ipa

deploy-ios:
  stage: deploy
  tags: [macos]
  script:
    - fastlane deliver --ipa ios/build/MyApp.ipa
```

---

## 对比总结

| | Android | iOS |
|--|---------|-----|
| 签名文件 | keystore（自己生成，永久保管） | Certificate + Profile（Apple 颁发，Xcode 自动管理） |
| 签名配置 | build.gradle 手动配 | Xcode 自动管理（勾选 Automatically manage signing） |
| 构建命令 | `./gradlew bundleRelease` | `xcodebuild archive` 或 Xcode GUI |
| 产物 | .aab（Google Play）/ .apk（直接安装） | .ipa / .xcarchive |
| 上传 | Google Play Console | App Store Connect（通过 Xcode/altool/Transporter） |
| 审核 | 几小时~1天 | 1~3天 |
| 内测 | Firebase App Distribution / Play 内测轨道 | TestFlight |
| CI 工具 | Fastlane supply | Fastlane match + gym + deliver |
| 证书丢失后果 | 不能更新 App（需要重新上架） | 可以重新生成（Apple 管理） |
| 热更新 | ✅ JS Bundle 不需要重新签名 | ✅ 同 |
