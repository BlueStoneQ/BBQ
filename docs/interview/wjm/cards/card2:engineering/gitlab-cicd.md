# GitLab 与 CI/CD 体系

> GitLab = 代码托管 + CI/CD 引擎 + 制品管理，一站式覆盖从代码到发布的全链路。

→ [XRN 热更新](../card3:native-shell/XRN/hmr.md)

## 目录

- [一、GitLab 套件组成](#一gitlab-套件组成)
- [二、GitLab 在 CI/CD 中的角色](#二gitlab-在-cicd-中的角色)
- [三、核心概念](#三核心概念)
- [四、.gitlab-ci.yml](#四gitlab-ciyml)
- [五、Runner](#五runner)
- [六、围绕 GitLab 搭建 CI/CD 体系](#六围绕-gitlab-搭建-cicd-体系)
- [七、关键实践](#七关键实践)
- [QA](#qa)
  - [Q1: RN → APK/IPA 的 CD 流水线设计](#q1-来设计一个-rn--apkipa-的-cd-流水线cd-不需要-gitlab-触发吗)

---

## 一、GitLab 套件组成

| 套件 | 本质（一句话） |
|------|--------------|
| **GitLab Server** | 代码仓库 + Web 管理界面 + CI/CD 调度中心 |
| **GitLab Runner** | 执行构建任务的 Worker 进程（拉代码→跑脚本→上报结果） |
| **GitLab Container Registry** | 内置 Docker 镜像仓库（存构建镜像） |
| **GitLab Pages** | 静态站点托管（文档/博客） |
| **GitLab Package Registry** | 私有 npm/Maven/PyPI 包仓库 |

---

## 二、GitLab 在 CI/CD 中的角色

```
开发者提交代码 / 打 tag / 手动触发
  → GitLab Server 创建 Pipeline（任务编排）
  → Runner 领取任务（pull 模式）
  → Runner 执行 .gitlab-ci.yml 中定义的脚本
  → 上报结果（成功/失败/产物）
  → GitLab 展示状态 + 存储产物
```

---

## 三、核心概念

| 概念 | 含义 |
|------|------|
| **Pipeline** | 一次完整的 CI/CD 流程（由多个 Stage 组成） |
| **Stage** | 阶段（lint → test → build → deploy），同 Stage 内并行，Stage 间串行 |
| **Job** | 最小执行单元，一个 Job = 一个 Runner 执行一段 script |
| **Runner** | 执行 Job 的机器/进程 |
| **Artifact** | Job 产出物（APK/IPA/Bundle），可下载或传递给下一个 Stage |
| **Cache** | 跨 Pipeline 缓存（node_modules / Gradle 缓存），加速构建 |
| **Variables** | 环境变量（密钥/配置），CI/CD Settings 中管理 |

---

## 四、`.gitlab-ci.yml`

> Pipeline 的定义文件，放在仓库根目录。

```yaml
# 定义阶段顺序
stages:
  - lint
  - test
  - build
  - deploy

# Job 定义：名字 + 属于哪个 stage + 执行什么
lint:
  stage: lint
  script:
    - pnpm install
    - pnpm run lint
    - pnpm run typecheck
  only:
    - merge_requests      # 触发条件：MR 时执行

build_android:
  stage: build
  script:
    - pnpm install
    - cd android && ./gradlew assembleRelease
  artifacts:
    paths:
      - android/app/build/outputs/apk/  # 产物存储
  when: manual            # 手动触发
  tags:
    - mac-mini            # 指定哪个 Runner 执行
```

---

## 五、Runner

### 什么是 Runner

> 本质: gitlab-runner 是一个常驻进程，每个 job 启动一个独立子进程执行 script。多个 job 并发时 = 多个子进程同时跑。

Runner = 后台常驻服务，主动轮询 GitLab："有没有任务给我？"

```
Runner 启动后：
  while (true) {
    task = pollGitLab();     // 主动问 GitLab 有没有活
    if (task) {
      git clone → run script → upload artifacts → report result
    }
    sleep(3s);
  }
```

### Runner 类型

| 类型 | 适用 | 说明 |
|------|------|------|
| **Shared Runner** | 轻量 CI（lint/test） | GitLab.com 提供，共享资源 |
| **Specific Runner** | 重量构建（iOS/Android） | 自己的机器，专属项目 |
| **Group Runner** | 团队共享 | 一组项目共用 |

### 常用 Executor

| Executor | 环境 | 适用 |
|----------|------|------|
| **Shell** | 直接跑在 Runner 机器上 | iOS 构建（需要 macOS + Xcode） |
| **Docker** | 每个 Job 跑在独立容器 | Linux CI（隔离干净） |
| **Kubernetes** | K8s Pod | 大规模、弹性伸缩 |

### 部署一个 Runner（Mac Mini）

```bash
# 1. 安装
brew install gitlab-runner

# 2. 注册（绑定到 GitLab Server）
gitlab-runner register \
  --url https://gitlab.company.com \
  --token <从 GitLab 后台获取> \
  --executor shell \
  --description "mac-mini-builder" \
  --tag-list "mac-mini,ios,android"

# 3. 启动（后台常驻）
gitlab-runner install && gitlab-runner start
# 之后开机自启，无需人工干预
```

---

## 六、围绕 GitLab 搭建 CI/CD 体系

### 整体架构

```
┌─────────────────────────────────────────────────┐
│ GitLab Server（调度中心）                         │
│  - 代码仓库                                      │
│  - Pipeline 编排 + 状态展示                      │
│  - Variables（密钥管理）                         │
│  - Artifacts（产物存储）                         │
└────────────────────┬────────────────────────────┘
                     │ Runner 主动 pull
┌────────────────────▼────────────────────────────┐
│ Mac Mini Runner（构建机）                         │
│  - Xcode CLI（iOS 构建）                         │
│  - Gradle + Android SDK（Android 构建）          │
│  - Node + pnpm（JS/RN 构建）                    │
│  - Fastlane（自动化签名+上传）                   │
└─────────────────────────────────────────────────┘
```

### CI 策略（轻量高频）

| 触发事件 | 执行什么 | Runner | 耗时 |
|---------|---------|--------|------|
| MR 提交/更新 | lint + typecheck + test | Shared/Docker | 2-5 min |
| 合并到 main | 不触发 CD（太频繁） | — | — |
| 打 tag `v*` | 构建双端包 + 上传 | Mac Mini | 10-30 min |
| 手动触发 | 构建测试包（指定分支） | Mac Mini | 10-30 min |

### CD 三条线

```
① H5：   pnpm build → 上传 CDN → 灰度
② RN：   metro bundle → 上传热更新服务 → 灰度
③ Native：fastlane build → 上传 TestFlight / Google Play
```

---

## 七、关键实践

| 实践 | 做法 |
|------|------|
| **密钥管理** | GitLab CI/CD Variables（加密），不进代码仓库 |
| **iOS 证书** | Fastlane Match（加密 Git 仓库存证书） |
| **Android Keystore** | Base64 编码存 CI Variable，构建时解码 |
| **缓存加速** | `cache: paths: [node_modules/, .gradle/]` |
| **产物传递** | `artifacts` 在 Stage 间传递构建产物 |
| **并行构建** | 同一 Stage 内多 Job 并行（lint 和 test 同时跑） |
| **手动确认** | 生产发布 `when: manual`，防误操作 |

## QA

### Q1: 来设计一个 RN → APK/IPA 的 CD 流水线？CD 不需要 GitLab 触发吗？

**核心方案：GitLab CI 编排 + Fastlane 执行签名打包上传。CI 自动触发，CD 手动点击触发。**

```yaml
# .gitlab-ci.yml
stages:
  - lint        # ESLint + TypeScript 检查
  - test        # Jest 单测
  - build_js    # xrn build → .hbc + assets
  - build_app   # Fastlane → APK/IPA
  - deploy      # Fastlane → 商店/内部分发

build_android:
  stage: build_app
  script:
    - fastlane android build  # Gradle 构建 + 签名 → APK
  artifacts:
    paths: [app/build/outputs/apk/release/*.apk]

build_ios:
  stage: build_app
  script:
    - fastlane ios build  # Xcode 构建 + 证书 → IPA
  tags: [macos]  # iOS 必须在 macOS Runner 上跑

deploy_android:
  stage: deploy
  script:
    - fastlane android upload  # → Google Play / 蒲公英 / 内部分发
  when: manual  # 手动确认才发布

deploy_ios:
  stage: deploy
  script:
    - fastlane ios upload  # → App Store Connect / TestFlight
  when: manual
```

**热更新发布（不走商店）**：

```yaml
deploy_hot_update:
  stage: deploy
  script:
    - xrn publish --env production  # 上传 .hbc 到 CDN + 注册版本
  only:
    - tags  # 打 tag 触发
```

> bus一句话：**CI（lint/test/build）自动触发，CD（发布）手动确认**。全部在 GitLab CI 里编排(CD 也可以选用jenkins)，Fastlane 负责移动端签名打包上传。
---

### Fastlane

移动端 CD 自动化工具（Ruby）。封装签名、打包、上传商店为一条命令。

```ruby
# Fastfile
lane :android_release do
  gradle(task: "assembleRelease")         # 构建 APK
  upload_to_play_store(track: "internal") # 上传 Google Play
end

lane :ios_release do
  match(type: "appstore")                 # 从 Git 仓库拉取签名证书
  build_app(scheme: "MyApp")              # Xcode 构建 IPA
  upload_to_app_store                     # 上传 App Store Connect
end
```

---

### Q2: XRN 需要自建哪些 Runner？

| Runner | 环境 | 职责 |
|--------|------|------|
| **Linux Runner** | Docker / Linux 机器 | lint + test + `xrn build`（Metro + Hermes）+ 热更新发布 |
| **Linux Runner（Android）** | Linux + Android SDK + JDK | Fastlane android build（Gradle → APK） |
| **macOS Runner** | Mac mini / Mac Studio | Fastlane ios build（Xcode → IPA），iOS 构建只能在 macOS 上跑 |

最少 2 台：1 台 Linux（CI + Android CD）+ 1 台 macOS（iOS CD）。

### Q3: Runner 的本质是什么？需要自己开发吗？加自动化测试呢？

**[Runner](#注释runner-本质) = 执行 CI/CD 任务的代理进程**。不需要自己开发，GitLab 官方提供 `gitlab-runner` 二进制，安装注册即可。

加自动化测试（pytest + uiautomator2）：在 Runner 所在机器连接 Android 真机/模拟器，pipeline 里加一个 stage：

```yaml
e2e_test:
  stage: test
  script:
    - adb devices  # 确认设备连接
    - pytest tests/e2e/ --device=emulator-5554
  tags: [android-device]  # 指定有真机连接的 Runner
```

不需要开发新 Runner——只需要一台连着手机的机器装 `gitlab-runner` + Python + adb 环境。

---

# 注释

<a id="注释runner-本质"></a>
### Runner 本质

Runner = 一台能执行 shell 命令的机器 + `gitlab-runner` 进程（本质就是一个常驻后台进程，轮询 GitLab 领任务）。

一台机器上是一个 `gitlab-runner` 进程，但可以配置 `concurrent` 参数同时跑多个 job（每个 job 是一个子进程）。多台机器 = 多个 Runner 进程 = 并行能力。

它拿到任务后就三步：git clone → 逐行执行 `script` 里的 shell 命令 → 返回 exit code。

能执行什么任务取决于那台机器装了什么：装了 Node.js 就能跑 lint，装了 Android SDK 就能跑 Gradle，装了 Xcode 就能构建 iOS。Runner 本身不"会"做任何事，它只是个 shell 执行器。

**注册 Runner：**

```bash
# 安装
sudo apt install gitlab-runner

# 注册（绑定到 GitLab 项目）
sudo gitlab-runner register
  → GitLab URL
  → Token（项目 Settings → CI/CD → Runners）
  → Executor: shell / docker
  → Tags: android, linux（yml 里用 tags 指定哪个 runner 跑哪个 job）
```

**Executor（执行环境）：**

| Executor | 说明 |
|----------|------|
| `shell` | 直接在机器 shell 跑（移动端构建用这个，需要 SDK/Xcode/真机） |
| `docker` | 每个 job 起一个容器跑（隔离好，适合纯 Node.js 任务） |
