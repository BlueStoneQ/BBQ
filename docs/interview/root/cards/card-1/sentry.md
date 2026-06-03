# Sentry — RN 错误监控与性能监控

> 线上 App 出了问题（crash/JS Error/卡顿/慢接口），Sentry 帮你自动收集 + 告警 + 还原现场。
> 是错误监控领域的事实标准，开源，支持 Web/RN/iOS/Android/Node。

---

## 目录

- [一、Sentry 是什么](#一sentry-是什么)
- [二、能监控什么](#二能监控什么)
- [三、RN 中安装与配置](#三rn-中安装与配置)
- [四、异常监控](#四异常监控)
- [五、性能监控](#五性能监控)
- [六、自定义埋点](#六自定义埋点)
- [七、Source Map 与堆栈还原](#七source-map-与堆栈还原)
- [八、告警与 Release 追踪](#八告警与-release-追踪)
- [九、面试话术](#九面试话术)

---

## 一、Sentry 是什么

| 维度 | 说明 |
|------|------|
| 定位 | 应用监控平台（错误 + 性能 + 用户行为） |
| 开源 | ✅ 可自部署（self-hosted），也有 SaaS 版 |
| 支持平台 | Web / React Native / iOS / Android / Node / Python / Go... |
| 核心价值 | 线上出问题不用猜 → 自动收集堆栈 + 用户操作路径 + 设备信息 → 快速定位 |

**类比**：
```
没有 Sentry：用户说"App 闪退了" → 你不知道哪里崩的 → 等复现 → 猜
有 Sentry：收到告警 → 完整堆栈 + crash 前操作路径 + 设备型号/OS → 直接定位修复
```

---

## 二、能监控什么

| 类别 | 具体内容 | 自动/手动 |
|------|---------|----------|
| **JS Error** | uncaught exception / Promise rejection / console.error | 自动 |
| **Native Crash** | iOS 崩溃（EXC_BAD_ACCESS）/ Android 崩溃（SIGSEGV） | 自动 |
| **ANR** | Application Not Responding（主线程阻塞 > 5s） | 自动 |
| **性能 - App 启动** | 冷启动耗时（App launch → 首屏渲染完成） | 自动 |
| **性能 - 页面加载** | 路由切换 → 页面渲染完成的耗时 | 自动（配合 React Navigation） |
| **性能 - 慢接口** | HTTP 请求耗时 + 状态码 | 自动（自动 instrument fetch/XHR） |
| **性能 - 帧率** | 慢帧 / 冻结帧（FPS < 60） | 自动 |
| **自定义埋点** | 业务指标（BLE 连接耗时、首屏数据就绪时间） | 手动 |
| **面包屑** | crash 前用户做了什么（点击/导航/网络/console） | 自动 + 手动 |
| **用户反馈** | 用户主动上报问题 + 截图 | 手动（Sentry Feedback Widget） |

---

## 三、RN 中安装与配置

### 安装

```bash
# 一个包搞定 JS + iOS + Android
yarn add @sentry/react-native

# iOS
cd ios && pod install

# Android: autolinking 自动处理
```

`@sentry/react-native` 是 Native Module 类型的包（JS + Android + iOS），安装后 autolinking 自动接入。

### 初始化

```typescript
// App.tsx 最顶部（越早越好，在任何业务代码之前）
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://xxx@o123.ingest.sentry.io/456',  // 项目唯一标识（Sentry 后台获取）
  
  // 性能监控采样率（0~1）
  tracesSampleRate: 0.2,        // 20% 的请求做性能追踪（生产环境不要 1.0）
  
  // 环境标记
  environment: __DEV__ ? 'development' : 'production',
  
  // Release 版本（用于关联 source map + 版本追踪）
  release: 'com.myapp@1.2.3+45',  // bundleId@version+buildNumber
  
  // 敏感数据过滤
  beforeSend(event) {
    // 过滤掉开发环境的错误
    if (__DEV__) return null;
    return event;
  },
});
```

### 配合 React Navigation（自动追踪页面性能）

```typescript
import * as Sentry from '@sentry/react-native';

const routingInstrumentation = new Sentry.ReactNavigationInstrumentation();

Sentry.init({
  dsn: '...',
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation,
    }),
  ],
});

// NavigationContainer 里绑定
function App() {
  const navigation = useNavigationContainerRef();
  return (
    <NavigationContainer
      ref={navigation}
      onReady={() => routingInstrumentation.registerNavigationContainer(navigation)}
    >
      {/* ... */}
    </NavigationContainer>
  );
}
```

绑定后 Sentry 自动追踪每次路由切换的耗时（Time to Initial Display / Time to Full Display）。

---

## 四、异常监控

### 自动捕获（不用写代码）

初始化后以下异常**自动上报**：

| 类型 | 触发条件 |
|------|---------|
| JS Error | 未捕获的异常 / Promise rejection |
| Native Crash | iOS EXC_BAD_ACCESS / Android SIGSEGV / SIGABRT |
| ANR | 主线程阻塞 > 5s |

### 手动上报

```typescript
// 捕获并上报一个错误（不 crash，但你想知道）
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
}

// 上报一条消息（非错误，但想追踪）
Sentry.captureMessage('User attempted invalid operation', 'warning');
```

### ErrorBoundary（React 组件级降级 + 上报）

```tsx
import * as Sentry from '@sentry/react-native';

// Sentry 提供的 ErrorBoundary，捕获子组件 render 错误 → 自动上报 + 显示 fallback
function App() {
  return (
    <Sentry.ErrorBoundary fallback={<CrashFallbackScreen />}>
      <MainApp />
    </Sentry.ErrorBoundary>
  );
}
```

### 添加上下文（帮助定位）

```typescript
// 设置用户信息（每个错误都会带上）
Sentry.setUser({ id: 'user-123', email: 'test@example.com' });

// 设置标签（可筛选）
Sentry.setTag('device_type', 'iot_hub');
Sentry.setTag('ble_firmware', 'v2.1.0');

// 设置额外数据
Sentry.setExtra('connected_devices', ['device-a', 'device-b']);
```

### 面包屑（Breadcrumbs）

Sentry 自动记录 crash 前的操作链：

```
自动记录：
  - 用户点击了什么按钮
  - 导航到了哪个页面
  - 发了什么网络请求（URL + 状态码）
  - console.log/warn/error

手动添加：
Sentry.addBreadcrumb({
  category: 'ble',
  message: `连接设备 ${deviceId}`,
  level: 'info',
});
```

crash 报告里会看到完整的面包屑列表 → 还原用户操作路径 → 快速复现。

---

## 五、性能监控

### 自动追踪（配置后免代码）

| 指标 | 说明 | 对应你的 app-metrics |
|------|------|---------------------|
| App Start | 冷启动 → 首屏渲染完成 | TTI |
| Screen Load | 路由切换 → 目标页渲染完成 | TTID / TTFD |
| HTTP Requests | fetch/XHR 耗时 + 状态码 | 接口 P95 |
| Slow/Frozen Frames | 慢帧（<60fps）/ 冻结帧（>700ms） | FPS |

### 自定义 Transaction（手动测量业务指标）

```typescript
// 测量 BLE 连接全流程耗时
const transaction = Sentry.startTransaction({
  name: 'BLE Connection',
  op: 'ble.connect',
});

// 分段测量
const scanSpan = transaction.startChild({ op: 'ble.scan', description: 'Scanning devices' });
await bleScan();
scanSpan.finish();

const connectSpan = transaction.startChild({ op: 'ble.pair', description: 'Pairing' });
await blePair(deviceId);
connectSpan.finish();

transaction.finish(); // 整个 transaction 结束，上报到 Sentry
```

Sentry 后台会展示这个 transaction 的瀑布图：scan 耗时 + pair 耗时 + 总耗时。

### 性能阈值告警

Sentry 后台可以配置：
- App Start > 3s → 告警
- 某接口 P95 > 2s → 告警
- Frozen Frames > 5% → 告警

---

## 六、自定义埋点

### 业务指标埋点

```typescript
// 方式 1：用 Transaction + Span（有时间线关系的）
const tx = Sentry.startTransaction({ name: 'First Screen Render', op: 'ui.render' });
// ... 首屏渲染逻辑 ...
tx.finish();

// 方式 2：用 Measurement（纯数值指标）
Sentry.setMeasurement('ble_connect_time', 1200, 'millisecond');
Sentry.setMeasurement('bundle_size', 2.5, 'megabyte');

// 方式 3：用 captureMessage + tags（离散事件）
Sentry.captureMessage('BLE connection timeout', {
  level: 'warning',
  tags: { device_id: 'xxx', firmware: 'v2.1' },
  extra: { retry_count: 3, signal_strength: -78 },
});
```

### IoT App 典型埋点

| 指标 | 方式 | 说明 |
|------|------|------|
| BLE 连接耗时 | Transaction + Span | scan → pair → connected 瀑布图 |
| BLE 连接成功率 | Tag + captureMessage | 按设备型号/固件版本分组 |
| 首屏数据就绪 | Measurement | Native 预请求 → JS 读取的时间差 |
| 热更新下载耗时 | Transaction | download → verify → apply |
| 包体解压耗时 | Measurement | 分 Bundle 场景 |

---

## 七、Source Map 与堆栈还原

### 问题

生产环境的 JS 代码是 Hermes bytecode（.hbc），堆栈全是乱码：
```
Error: Cannot read property 'name' of undefined
  at anonymous (address at BLEModule.hbc:1:23456)
```

### 解决：上传 Source Map

```bash
# 构建时生成 source map
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output main.jsbundle \
  --sourcemap-output main.jsbundle.map

# 上传到 Sentry（CI/CD 里自动执行）
npx @sentry/cli sourcemaps upload \
  --release "com.myapp@1.2.3+45" \
  --dist "45" \
  ./main.jsbundle ./main.jsbundle.map
```

### iOS dSYM 上传（Native 崩溃堆栈还原）

```bash
# Xcode Archive 后自动生成 dSYM
# 上传到 Sentry
npx @sentry/cli debug-files upload \
  --include ./ios/build/MyApp.xcarchive/dSYMs
```

### Android ProGuard mapping

```bash
# Android 混淆后的 mapping 文件
npx @sentry/cli debug-files upload \
  --include ./android/app/build/outputs/mapping/release/
```

上传后 Sentry 自动还原堆栈：
```
还原前：at anonymous (BLEModule.hbc:1:23456)
还原后：at connect (src/modules/ble/BLEService.ts:42:8)  ← 源码行号
```

---

## 八、告警与 Release 追踪

### 告警规则

Sentry 后台配置：

| 条件 | 动作 |
|------|------|
| 新错误首次出现 | 通知钉钉/Slack |
| 某错误 1h 内 > 100 次 | P0 告警 |
| Crash-free rate < 99.5% | 邮件通知 |
| P95 响应时间 > 2s | 性能告警 |

### Release 追踪

每次发版标记 release：
```typescript
Sentry.init({
  release: 'com.myapp@1.2.3+45',  // 关联 source map + 追踪版本
});
```

Sentry 后台可以看到：
- 每个版本的 crash-free rate
- 新版本引入了哪些新错误
- 版本回退后错误是否消失

### 和热更新配合

```typescript
// 热更新后更新 Sentry 的 release 标记
Sentry.setRelease(`com.myapp@1.2.3+45-hotfix-${bundleVersion}`);
```

这样热更新后的错误能关联到对应的 bundle 版本。

---

## 九、回答要点

> "线上监控用 Sentry。覆盖三层：异常监控（JS Error / Native Crash / ANR 自动捕获）、性能监控（启动时间/帧率/接口耗时自动采集）、业务埋点（BLE 连接耗时用 Transaction + Span 做瀑布图）。配合 CI/CD 自动上传 source map + dSYM，生产环境堆栈直接还原到源码行号。告警规则配好后新错误自动通知，crash-free rate 低于 99.5% 触发 P0。"

> 追问"为什么不用 Firebase Crashlytics？"
> "Crashlytics 只管 crash，不管性能和自定义埋点。Sentry 是全链路（错误 + 性能 + 用户行为），而且支持自部署，数据合规更好（出海场景 GDPR）。"

> 追问"采样率怎么设？"
> "错误 100% 上报（不能漏）。性能采样率生产环境 10-20%（tracesSampleRate: 0.2），开发/预发 100%。太高了影响流量和后端存储成本。"
