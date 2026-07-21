# RN 热更新体系（HMR: Hot Module Replacement → OTA Update）

> 热更新 = 不走商店审核，直接更新 JS Bundle。
>
> 本文覆盖：方案选型 → 灰度发布 → 观测指标 → 回滚机制 → Native Shell 配合。

→ [XRN: hmr.md](../card3:native-shell/XRN/hmr.md)

## 目录

- [一、热更新整体架构](#一热更新整体架构)
- [二、方案选型](#二方案选型)
- [三、灰度发布流程](#三灰度发布流程)
- [四、观测指标（判断是否需要回滚）](#四观测指标判断是否需要回滚)
- [五、回滚机制](#五回滚机制)
- [六、Native Shell 的职责](#六native-shell-的职责)
- [七、多 Bundle 热更新](#七多-bundle-热更新)
- [八、面试叙述](#八面试叙述)

---

## 一、热更新整体架构

```
┌─────────────────────────────────────────────────────────────┐
│ 热更新全链路                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 构建阶段：                                                    │
│   代码合并 → CI 构建 Bundle → 生成差量包 → 上传 OSS/CDN      │
│                                                               │
│ 服务端：                                                      │
│   版本管理 + 灰度配置 + 回滚控制                              │
│   GET /check-update → { version, url, gray, minNativeVer }   │
│                                                               │
│ 客户端（Native Shell）：                                      │
│   检查更新 → 下载 → 校验 → 存储 → 下次启动加载               │
│                                                               │
│ 观测：                                                        │
│   加载成功率 + Error 率 + Crash 率 → 异常自动回滚             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、方案选型

| 方案 | 海外 | 国内 | 灰度 | 差量 | 自定义程度 | 推荐 |
|------|------|------|------|------|-----------|------|
| **CodePush（微软）** | ✅ | ⚠️ 需代理 | ✅ 内置 | ✅ | 低 | 快速起步 |
| **EAS Update（Expo）** | ✅ | ⚠️ CDN 慢 | ✅ | ✅ | 中 | Expo 项目 |
| **Pushy（国内）** | ⚠️ | ✅ | ✅ | ✅ | 中 | 国内项目 |
| **自建** | ✅ | ✅ | ✅ 完全控制 | ✅ 自实现 | **高** | 长期方案 |

### 自建方案（推荐，30 人团队够用）

```
三个组件：

1. API 服务（Node/Go，十几行核心逻辑）：
   GET /check-update
     ?appVersion=1.2.0
     &bundleId=home
     &platform=ios
     &currentBundleVersion=v101
   → { needUpdate: true, version: "v102", url: "https://cdn/bundles/home-v102.bundle", hash: "sha256:xxx", minNativeVersion: "1.2.0", gray: 10 }

2. OSS 存储 Bundle 文件：
   s3://bundles/
     ├── home-v101.bundle
     ├── home-v102.bundle
     └── home-v102.patch  (差量包, 可选)

3. 管理后台（初期可以是 JSON/数据库）：
   - 配置灰度比例
   - 标记 revoke
   - 查看各版本加载成功率
```

---

## 三、灰度发布流程

```
构建完成 → 上传 Bundle 到 OSS
  → 服务端创建版本记录（status: gray, percent: 1%）
  → 1% 用户命中灰度 → 下载新 Bundle → 下次启动加载
  → 观测 1h（指标正常）→ 扩大到 10%
  → 观测 4h（指标正常）→ 扩大到 100%
  → 任何时刻异常 → revoke → 回滚
```

### 灰度分配策略

```javascript
// 服务端判断用户是否命中灰度
function shouldUpdate(userId, grayPercent) {
  // 稳定 hash：同一用户每次结果一致（不会反复切换版本）
  const hash = crc32(userId + bundleVersion) % 100;
  return hash < grayPercent;
}
```

---

## 四、观测指标（判断是否需要回滚）

> 核心逻辑：**新版本 vs 上一版本同时段对比**，不是看绝对值。

### 必看指标

| 指标 | 数据来源 | 判断标准 | 自动化 |
|------|---------|---------|--------|
| **Bundle 加载成功率** | Native Shell 上报 | > 99.5%（低于则说明包损坏/不兼容） | ✅ 可自动回滚 |
| **JS Error 率** | Sentry（按 release 筛选） | 不超过上版本 2 倍 | ✅ 可自动回滚 |
| **Crash 率** | Sentry / Crashlytics | 不超过基线 0.5% | ✅ 可自动回滚 |
| **白屏率** | ErrorBoundary 上报 | 无 spike（对比上版本） | ✅ 可自动回滚 |

### 辅助指标

| 指标 | 数据来源 | 判断标准 | 自动化 |
|------|---------|---------|--------|
| **启动耗时 P95** | Performance Tracing | 不比上版本慢 500ms+ | ⚠️ 告警，人工判断 |
| **关键路径转化率** | 业务埋点 | 不下降（如支付成功率） | ⚠️ 告警，人工判断 |
| **API 错误率** | 网络监控 | 无异常上升 | ⚠️ 告警 |

### 观测时间窗口

```
灰度 1%  → 观测窗口 1h（样本量小，只看硬指标：加载成功率 + Crash）
灰度 10% → 观测窗口 4h（样本够了，看全部指标）
灰度 100% → 持续监控 24h（确认无长尾问题）
```

### 自动回滚触发条件

```
任一条件命中即触发回滚：
  1. Bundle 加载成功率 < 99.5%（连续 5 分钟）
  2. JS Error 率 > 上版本 3 倍（连续 10 分钟）
  3. 新增 Crash 堆栈且 count > 10
  4. 白屏率 > 1%
```

---

## 五、回滚机制

### 两种方式

#### 1. 服务端回滚（推荐，秒级生效）

```
操作：服务端标记 v102 status = revoked

效果：
  → App 下次检查更新：
    服务端返回 { latestVersion: "v101", revoked: ["v102"] }
  → Native Shell 判断当前是 v102 → 切回 v101
  → 下次启动生效

时效：用户下次启动 / 切后台回来 时生效（通常分钟级）
```

#### 2. 客户端自动回滚（兜底，Crash 级别）

```
Native Shell 内置逻辑：

启动 Bundle v102：
  → 标记 status = "launching"
  → 启动计时器（5s）
  → 如果 5s 内：
    - App Crash → 下次启动检测到异常退出
    - JS Error count > 阈值
    - 白屏（ErrorBoundary 触发）
  → 标记 v102 = "failed"
  → 下次启动自动加载 v101
  → 上报失败原因给服务端

  → 如果 5s 后 App 正常运行：
    - 标记 status = "success"
    - 可以清理旧版本缓存
```

#### 3. 版本保留策略

```
Native Shell 本地保留：
  - 当前运行版本（v102）
  - 上一个稳定版本（v101）← 回滚目标
  - 内置兜底版本（App 打包时内置的 Bundle）← 终极兜底

回滚链：v102（新）→ v101（上一稳定）→ 内置版本（最后防线）
```

---

## 六、Native Shell 的职责

```
Native Shell 在热更新中的角色 = Bundle 的生命周期管理者

┌────────────────────────────────────────────────────────────┐
│ Native Shell 热更新相关职责：                                │
├────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. 检查更新                                                  │
│    - 时机：App 启动 / 切回前台 / 定时轮询                    │
│    - 调用：GET /check-update                                 │
│    - 判断：版本号 + minNativeVersion 兼容性                  │
│                                                              │
│ 2. 下载 + 校验                                               │
│    - 下载 Bundle（全量或差量 patch）                          │
│    - SHA256 校验完整性                                        │
│    - 签名验证（防篡改）                                       │
│                                                              │
│ 3. 存储管理                                                   │
│    - 保留最近 2-3 个版本                                     │
│    - 清理过旧版本释放空间                                     │
│                                                              │
│ 4. 加载决策                                                   │
│    - 启动时选择加载哪个版本                                   │
│    - 检测上次是否异常退出 → 回滚                             │
│    - minNativeVersion 不满足 → 不加载，用旧版本             │
│                                                              │
│ 5. 加载结果上报                                               │
│    - 上报：{ bundleId, version, loadResult, loadTime }       │
│    - 供服务端计算加载成功率                                   │
│                                                              │
│ 6. 回滚执行                                                   │
│    - 服务端 revoke → 切回上一版本                            │
│    - 客户端检测 Crash → 自动切回                             │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

### minNativeVersion 机制

```
问题：热更新的 JS 代码调用了新的 TurboModule，但旧 Native 版本没有
结果：Crash / 功能不可用

解决：每个 Bundle 版本声明 minNativeVersion
  v102: { minNativeVersion: "1.2.0" }

Native Shell 检查：
  if (appNativeVersion < bundle.minNativeVersion) {
    // 不加载这个 Bundle，继续用旧版本
    // 提示用户去商店更新 App
  }
```

---

## 七、多 Bundle 热更新

```
多 Bundle 场景下，每个 Bundle 独立热更新：

  bundle-home:    v50 → v51（灰度中）
  bundle-payment: v30（稳定，未更新）
  bundle-social:  v20 → v21（刚全量）

优势：
  - 独立灰度：payment 不受 home 更新影响
  - 独立回滚：home 回滚不影响其他 Bundle
  - 增量构建：只构建变化的 Bundle
  - 风险隔离：一个 Bundle 崩了不影响全局

Native Shell 管理：
  每个 Bundle 独立的版本 + 加载状态 + 回滚链
```

---

## 八、叙述

> "热更新不只是推个包的事，核心是建立一个'推送→灰度→观测→自动回滚'的闭环。我的做法是：Bundle 推到 1% 灰度后，Native Shell 上报加载成功率，Sentry 监控 JS Error 率和 Crash 率，同时段对比上一版本——任一指标异常自动 revoke 并回滚到上一稳定版本。回滚动作由 Native Shell 执行，本地保留最近两个版本，启动时根据服务端指令或本地异常检测决定加载哪个。这样即使热更新出了问题，用户最多经历一次异常，下次启动就恢复正常。"
