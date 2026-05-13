# RPK 包生命周期

> 快应用的"安装包"是怎么管理的？

## 目录

- [一、核心问题](#一核心问题)
- [二、RPK 包的本质](#二rpk-包的本质)
- [三、生命周期全链路](#三生命周期全链路)
- [四、关键设计决策](#四关键设计决策)
- [五、Android 知识映射](#五android-知识映射)

---

## 一、核心问题

| 问题 | 本质 |
|------|------|
| RPK 是什么格式？ | ZIP 压缩 + 数字签名 |
| 怎么做到"免安装"？ | 动态下载 + 本地缓存 + 流式加载 |
| 怎么更新？ | 版本比对 + 增量更新 |
| 缓存策略是什么？ | LRU + 容量限制 |

## 二、RPK 包的本质

```
output.rpk = ZIP {
  manifest.json      ← 应用元信息（包名、版本、权限、路由）
  app.js             ← 应用级 JS（全局逻辑）
  pages/
    index/index.js   ← 页面 JS Bundle（模板+样式+逻辑）
    detail/detail.js
  common/            ← 公共资源
  assets/            ← 图片、字体等静态资源
  sign/              ← 数字签名
}
```

**与 APK 的对比**：

| 维度 | APK | RPK |
|------|-----|-----|
| 格式 | ZIP（含 DEX + SO + 资源） | ZIP（含 JS + 资源） |
| 大小 | 10-100 MB | 0.1-5 MB |
| 安装 | PackageManager 安装到系统 | 解压到应用私有目录 |
| 运行时 | Dalvik/ART 执行 DEX | V8 执行 JS |
| 签名 | APK Signature Scheme | 自定义签名（RSA） |

## 三、生命周期全链路

```
开发者构建 RPK → 上传到分发平台
    │
    ▼
用户触发（点击链接/应用市场推荐）
    │
    ▼
DistributionManager.getAppStatus(pkg)
    │  APP_STATUS_NONE → 需要下载安装
    │  APP_STATUS_UPDATE → 有新版本
    │  APP_STATUS_READY → 可直接运行
    │
    ▼
下载 → 签名校验 → 解压 → 缓存
    │
    ▼
CacheStorage.getCache(pkg) → 读取 manifest → 加载 JS → 运行
    │
    ▼
后台检查更新 → 增量下载 → 下次启动生效
```

## 四、关键设计决策

### 为什么不用 WebView 直接加载 URL？

1. **离线可用**：RPK 下载后缓存在本地，无网也能打开
2. **启动快**：本地读取 vs 网络请求，差 10-100 倍
3. **安全**：签名校验防篡改，沙箱隔离防越权
4. **体验一致**：不受网络波动影响

### 流式加载（Streaming）

**场景**：用户第一次打开一个 2MB 的快应用，不想等全部下载完。

**方案**：先下载 manifest + 首页 JS（几十 KB），渲染首页的同时后台继续下载其他页面。

### 分包加载

**场景**：一个快应用有 20 个页面，但用户通常只用 3-4 个。

**方案**：编译时按页面拆分为多个子包，运行时按需下载。首包（主页面）必须下载，其他页面用到时再下载。

## 五、Android 知识映射

| 框架概念 | Android 知识点 |
|----------|---------------|
| RPK 下载 | DownloadManager / OkHttp |
| 缓存管理 | 文件 I/O、LRU 缓存策略 |
| 签名校验 | RSA/SHA256、Certificate |
| 版本管理 | SharedPreferences / SQLite |
| 流式加载 | InputStream 边读边处理 |

---

## 待深入（后续填充）

- [ ] RPK 签名校验的完整流程
- [ ] DistributionManager 状态机设计
- [ ] 增量更新算法（bsdiff？）
- [ ] 缓存淘汰策略的具体实现
