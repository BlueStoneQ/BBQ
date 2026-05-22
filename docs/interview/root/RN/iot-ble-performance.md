# IoT App 体验优化方案（带着方案去沟通）

> 场景：母婴智能硬件 App（智能吸奶器等），BLE 连接设备，RN 前端
> 观察：App 不复杂但不流畅 + 图片/视频加载慢 + 缺 loading 反馈
> 目标：展示对产品痛点的理解 + 系统化解决能力

---

## 目录

- [一、产品场景](#一产品场景)
- [二、实际体验观察（带着问题去沟通）](#二实际体验观察带着问题去沟通)
- [三、BLE 通信是否导致卡顿？](#三ble-通信是否导致卡顿)
- [四、BLE 通信层改造计划](#四ble-通信层改造计划)
- [五、前端体验问题与方案](#五前端体验问题与方案)
- [六、整体优化路线图](#六整体优化路线图)
- [七、我能带来什么](#七我能带来什么)
- [八、沟通话术](#八沟通话术)

---

## 一、产品场景

Hubble Connected（Root）：母婴智能硬件（智能吸奶器、监控器、传感器等）。

**通信架构**：

```
手机 App ←── BLE ──→ 智能硬件 ←── WiFi ──→ 路由器/云端

App ↔ 设备：BLE（控制指令/传感器数据/配网）
设备 ↔ 云：WiFi（设备自己联网，上传数据/接收推送）
App 帮设备配网：通过 BLE 把 WiFi 凭证传给设备
```

**BLE 通信特点（智能吸奶器为例）**：

| 数据类型 | 频率 | 方向 | 内容 |
|---------|------|------|------|
| 控制指令 | 低频（用户触发） | App → 设备 | 调档位/切模式/开关 |
| 状态上报 | 中频（1-5s 一次） | 设备 → App | 当前模式/电量/工作状态 |
| 实时数据 | 高频（可能） | 设备 → App | 压力曲线/吸力值（如果有实时展示） |
| 配网 | 一次性 | App → 设备 | WiFi SSID + 密码 |

---

## 二、实际体验观察（带着问题去沟通）

> 以下是实际体验 App 后发现的问题，每个都分析了根因和方案。

### 观察 1：首屏不确定顺序出现两个 loading

**现象**：进入首屏后，先后（顺序不固定）出现两个 loading 指示器，看起来是 BLE 初始化和数据请求各自独立完成。

**根因**：多个异步初始化任务各自独立，没有统一编排。

```
现状：
  BLE init ──────→ loading1 消失（时间不确定）
  API 请求 ───→ loading2 消失（时间不确定）
  两个 loading 交替出现/消失 → 用户困惑

本质：缺乏统一的初始化编排器
```

**方案：统一初始化管理**

```typescript
// ✅ 统一编排：所有前置任务完成后，一次性展示首屏
function useAppInit() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      bleService.init(),        // BLE 初始化
      authService.getUser(),    // 用户信息
      deviceService.getList(),  // 设备列表
    ]).then(() => setReady(true));
  }, []);

  return ready;
}

// App 根组件
function App() {
  const ready = useAppInit();
  if (!ready) return <SplashScreen />;  // 统一 Splash，不是多个 loading
  return <MainNavigator />;
}
```

**效果**：用户只看到一个 Splash → 一次性进入首屏，不再有多个 loading 闪烁。

**进阶方案：初始化任务管理器**

比 `Promise.all` 更好的方案——可扩展的任务管理器，各模块解耦注册：

```typescript
// 任务管理器：各模块独立注册自己的初始化任务（解耦）
const appInitManager = createInitManager();

appInitManager.register('ble', () => bleService.init(), { priority: 'high' });
appInitManager.register('auth', () => authService.getUser(), { priority: 'high' });
appInitManager.register('devices', () => deviceService.getList(), { priority: 'normal' });
appInitManager.register('config', () => remoteConfig.fetch(), { priority: 'low', optional: true });

// 统一调度 + 统一 loading 状态
const { ready, progress, failedTasks } = useAppInit(appInitManager);
// ready: 全部完成（或必要任务完成）
// progress: 0-100（可选，做进度条）
// failedTasks: 哪些失败了（可降级处理，如 config 失败不阻塞进入）
```

**好处**：
- 各模块解耦注册，不需要集中维护一个 Promise.all 列表
- 支持优先级（high 必须成功，low/optional 可降级）
- 统一 loading 状态（一个地方控制）
- 可扩展（新模块加一行注册）
- 失败降级（BLE 初始化失败不阻塞首屏，只是设备功能暂不可用）

**Splash 期间预加载（利用等待时间）**

Splash 停留的 1-2 秒不应该浪费——JS 就绪后立即开始预加载，不等 Splash 消失：

```
时间线：
  T0: App 启动 → Native Splash 显示
  T0: 同时 → JS Bundle 加载 + 执行
  T1: JS 就绪 → 立即开始预加载（Splash 还在显示）
      ├── 请求用户信息
      ├── 请求设备列表
      ├── BLE 初始化
      ├── 预加载首屏图片（FastImage.preload）
      └── 预加载远程配置
  T2: 预加载完成 → 隐藏 Splash → 直接展示首屏内容（无 loading）

效果：Splash 消失后首屏内容已准备好 → "秒开"感
```

```typescript
import SplashScreen from 'react-native-splash-screen';

function App() {
  const { ready } = useAppInit(appInitManager);

  useEffect(() => {
    if (ready) {
      SplashScreen.hide();  // 数据准备好了才隐藏 Splash
    }
  }, [ready]);

  if (!ready) return null;  // Splash 还在显示，不渲染 RN 内容
  return <MainNavigator />;
}
```

**关键**：不是"Splash 结束后再加载数据"，而是"Splash 期间就在加载，加载完了才结束 Splash"。

---

### 观察 2：启动界面长 + 进来后还有 loading + 抖动

**现象**：
- Splash 停留时间长（2-3 秒）
- Splash 消失后，首屏还有 loading
- 数据加载完后，布局发生跳动（元素位置/大小突然变化）

**根因分析**：

```
Splash 长 = Native 初始化慢 + Bundle 加载慢
进来后还有 loading = Splash 结束时数据还没准备好（Splash 和数据加载没协调）
抖动 = 数据回来后组件从"无数据"→"有数据"，高度/布局变化 → 重排
```

**本质问题**：Splash → 首屏之间没有衔接，数据加载和 UI 渲染没有协调。

**方案：Splash → 骨架屏 → 内容填充（三段式）**

```
改造后：
  Splash（Native 层控制，Bundle 加载完就消失）
    → 骨架屏（布局和真实内容一致，只是内容空/灰色块）
      → 数据填充（骨架屏原地替换为真实内容，无跳动）

关键：骨架屏的布局结构 = 真实内容的布局结构
     → 数据填充时不会发生重排 → 无抖动
```

```typescript
// 骨架屏组件：和真实 DeviceCard 布局一致
function DeviceCardSkeleton() {
  return (
    <View style={{ height: 80, flexDirection: 'row', padding: 12 }}>
      <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#E0E0E0' }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ width: '60%', height: 16, backgroundColor: '#E0E0E0' }} />
        <View style={{ width: '40%', height: 12, backgroundColor: '#E0E0E0', marginTop: 8 }} />
      </View>
    </View>
  );
}

// 首屏：数据没来显示骨架，来了显示真实内容（高度一致，无跳动）
function DeviceList() {
  const { data, isLoading } = useDevices();
  if (isLoading) return <>{[1,2,3].map(i => <DeviceCardSkeleton key={i} />)}</>;
  return data.map(d => <DeviceCard key={d.id} device={d} />);
}
```

**启动时间优化**（减少 Splash 停留）：
- TurboModule 懒加载（不全量注册 Native Module）
- Hermes AOT（Bundle 加载快）
- 首屏最小化（只加载首屏需要的模块）

---

### 观察 3：切换某个 Tab 发生抖动

**现象**：点击某个 Tab，内容区域发生一次明显的布局跳动。

**根因分析**：

| 可能原因 | 机制 |
|---------|------|
| Tab 内容懒加载 | 切换时才开始渲染/请求 → 从无到有 → 跳动 |
| 图片没有固定宽高 | 图片加载完才知道尺寸 → 撑开布局 |
| 条件渲染 | `{data && <View/>}` → 元素突然出现 |
| 列表没有预设高度 | 没有 `getItemLayout` / `estimatedItemSize` |
| 字体加载 | 自定义字体加载完文字区域大小变化 |

**方案**：

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **图片固定宽高** | `<FastImage style={{width:100, height:100}} />` | 图片加载前后布局不变 |
| **骨架屏占位** | Tab 切换时先显示骨架，不是空白 | 布局已确定，数据填充无跳动 |
| **Tab 预渲染** | `lazy={false}` 或提前渲染相邻 Tab | 切换时内容已就绪 |
| **列表预设高度** | `getItemLayout` / `estimatedItemSize` | 列表不会因为 item 渲染而跳 |
| **避免条件渲染跳动** | 用 `opacity: 0` 替代 `{show && <View/>}` | 元素始终占位，只是不可见 |

```typescript
// ❌ 条件渲染：元素突然出现 → 布局跳动
{device && <DeviceInfo device={device} />}

// ✅ 始终占位：数据没来时显示骨架（高度一致）
<DeviceInfo device={device} isLoading={!device} />

// ❌ 图片不固定尺寸：加载完撑开
<FastImage source={{ uri }} style={{ width: '100%' }} />

// ✅ 固定宽高：加载前后布局不变
<FastImage source={{ uri }} style={{ width: 100, height: 100 }} />
```

---

### 观察 4：WebView 进度条出现两次

**现象**：跳转到用户指导页（微博帖子），WebView 进度条出现两次。

**根因**：URL 有重定向（短链 → 中间页 → 最终页），WebView 每次导航都触发一次进度条。

**方案**：

| 方案 | 做什么 | 效果 |
|------|--------|------|
| 拦截重定向 | `onNavigationStateChange` 只在最终 URL 显示进度条 | 进度条只出现一次 |
| 自定义进度条 | 隐藏 WebView 自带进度条，用自定义的（只从 0→100 一次） | 体验统一 |
| 内容内置 | 用户指导等固定内容做成 RN 页面或本地 HTML | 秒开，不依赖网络 |

**最佳实践**：固定内容（用户指导/FAQ）不应该依赖外部网页。内置到 App 里 → 秒开 + 离线可用 + 体验可控。

---

### 观察 5：商城跳转淘宝体验差（直接影响复购率）

**现象**：WebView 加载淘宝网页 → 用户要重新输入淘宝账号 → 体验稀碎。

**根因**：WebView 和淘宝 App 不共享 Cookie/登录态，用户在 WebView 里等于"未登录状态"。

**方案（按体验排序）**：

| 方案 | 体验 | 实现 | 适合 |
|------|------|------|------|
| **Deep Link 跳转淘宝 App** | ✅ 最好 | `Linking.openURL('taobao://...')` | 只是引导购买 |
| 淘宝客 SDK | ✅ 好 | 接入淘宝联盟 SDK，App 内购买 | 需要分佣变现 |
| 跳转系统浏览器 | 中 | `Linking.openURL(url)` | 兜底方案 |
| WebView（现状） | ❌ 差 | 需要重新登录 | 不推荐 |

**推荐：Deep Link**（对 Root 场景最合适）

```typescript
import { Linking } from 'react-native';

async function openInStore(itemUrl, itemId) {
  // 1. 尝试跳转淘宝 App（用户已安装 + 已登录 → 一键购买）
  const taobaoDeepLink = `taobao://item.taobao.com/item.htm?id=${itemId}`;
  const canOpen = await Linking.canOpenURL(taobaoDeepLink);
  
  if (canOpen) {
    await Linking.openURL(taobaoDeepLink);
  } else {
    // 2. 没装淘宝 → 跳系统浏览器（比 WebView 好，浏览器可能有登录态）
    await Linking.openURL(itemUrl);
  }
}
```

**Deep Link vs Intent 的关系**：

```
Deep Link = 跨平台概念（"用 URL 打开另一个 App 的特定页面"）
Intent = Android 底层实现机制

在 Android 上：Linking.openURL('taobao://...') 
  → RN 底层创建 Intent { action: VIEW, data: 'taobao://...' }
  → 系统找到注册了 taobao:// 的 App → 启动淘宝

在 iOS 上：同样的 Linking.openURL 走 URL Scheme / Universal Link

RN 的 Linking.openURL 帮你屏蔽了平台差异 → 一行代码两端生效
```

**为什么不用淘宝 SDK**：接入成本高（申请账号 + 集成 SDK + 审核），Root 只是引导买配件/耗材，Deep Link 一行代码就够了。

---

### 观察 6：只适配了 Light Theme

**现象**：系统切换到 Dark Mode 后，App 仍然是白色背景，没有适配。

**影响**：
- 夜间使用刺眼（母婴场景：半夜喂奶/查看设备时）
- App Store/Google Play 审核扣分项
- 用户差评

**方案：Theme 系统化**

```typescript
// RN 内置 hook：检测系统主题
import { useColorScheme } from 'react-native';

const colorScheme = useColorScheme(); // 'light' | 'dark'

// 统一 Theme 配置
const themes = {
  light: { background: '#FFFFFF', text: '#000000', card: '#F5F5F5' },
  dark: { background: '#1A1A1A', text: '#FFFFFF', card: '#2A2A2A' },
};

// 全局 Theme Provider
const theme = themes[colorScheme];
```

**落地方式**：
1. 设计出 Dark Mode 色板（和 Light 对应）
2. 所有颜色走 Theme 变量，不写死色值
3. 组件库统一用 Theme（改一处全局生效）
4. 图片/图标准备 Dark 版本（或用 tint color）

---

### 观察 7：出海产品的国际化

**现象**：Root 是出海产品，国际化是基本要求。

**需要覆盖的维度**：

| 维度 | 内容 | RN 方案 |
|------|------|---------|
| 文案翻译 | 多语言文案 | react-intl / i18next |
| 日期/时间 | 格式化（12h/24h，日期顺序） | Intl API / dayjs |
| 数字/货币 | 千分位/货币符号 | Intl.NumberFormat |
| RTL 布局 | 阿拉伯语/希伯来语从右到左 | RN 内置 RTL 支持 + I18nManager |
| 图片/图标 | 含文字的图片需要多语言版本 | 按 locale 加载不同资源 |
| 字体 | 不同语言字体大小/行高不同 | 按语言调整 Typography |
| 法律合规 | GDPR/隐私政策/用户协议 | 按地区展示不同内容 |
| App Store | 多语言截图/描述/关键词 | ASO 多语言 |

**技术方案**：

```typescript
// i18next 配置
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { welcome: 'Welcome' } },
    zh: { translation: { welcome: '欢迎' } },
    ja: { translation: { welcome: 'ようこそ' } },
  },
  lng: getDeviceLanguage(),  // 跟随系统语言
  fallbackLng: 'en',
});

// 使用
const { t } = useTranslation();
<Text>{t('welcome')}</Text>
```

---

### 所有观察的共同本质

```
核心问题：前端体验工程化缺失 + 产品细节没人管

表现：
- 多个异步任务各自为政 → 多个 loading 闪烁
- 数据加载和 UI 渲染不协调 → 先空后填 → 抖动
- 没有骨架屏/占位 → 布局从无到有 → 跳动
- WebView 体验没优化 → 进度条重复/登录态丢失
- 商城跳转方案粗糙 → 直接影响复购率
- 没适配 Dark Mode → 夜间使用刺眼（母婴场景致命）
- 国际化基础设施 → 出海产品的基本要求

解决思路：
1. 统一初始化编排（任务管理器 + Splash 预加载）
2. 骨架屏衔接（布局先确定 → 数据填充无重排）
3. 固定布局尺寸（从设计源头规范）
4. 外部跳转用 Deep Link（不用 WebView）
5. Theme 系统化（Light/Dark 统一管理）
6. 国际化基础设施（i18next + RTL + 格式化）
```

---

## 三、BLE 通信是否导致卡顿？

### 判断逻辑

```
BLE 会不会导致 RN 卡？取决于通信频率：

低频（控制指令，几秒一次）→ 不会卡
中频（状态上报，1-5s 一次）→ 不太会卡
高频（实时数据，每秒 10-30 次）→ 可能卡 ← 需要关注
```

### 为什么高频 BLE 回调会卡 RN？

```
每个 BLE 数据包的链路：
  Native BLE 回调 → Bridge/JSI → JS 线程处理 → setState → 组件重渲染

如果每秒 30 次：
  JS 线程每帧（16ms）要处理 BLE 回调 + UI 渲染 + 业务逻辑
  帧预算不够 → 掉帧 → 用户感知"卡"
```

### 对 Root 的判断

智能吸奶器的控制指令和状态上报是**低/中频**，大概率不是卡顿主因。

但如果有以下场景，BLE 就可能是原因：
- 实时压力/吸力曲线展示（高频数据流）
- 多设备同时连接（多个设备同时上报）
- BLE 扫描持续进行（扫描回调很频繁）

**结论**：BLE 可能是卡顿的**贡献因素之一**，但大概率不是主因。主因更可能是前端本身的体验工程化不足。不过，BLE 通信层的改造仍然值得做——为未来设备品类扩展（可能有高频数据场景）打基础。

---

## 四、BLE 通信层改造计划

### 现状（猜测）

```
BLE 数据 → NativeModule → Bridge（JSON 序列化，异步队列）→ JS 线程 → setState → 重渲染
问题：
1. Bridge 序列化有开销（每个包都 JSON.stringify/parse）
2. 每个 BLE 包都触发一次 JS 回调 → 频率高了 JS 忙不过来
3. 每次回调都 setState → 可能触发不必要的重渲染
4. 连接/重连逻辑在 JS → 占 JS 线程时间
```

### 改造方案

| 阶段 | 改什么 | 怎么做 | 收益 |
|------|--------|--------|------|
| **P0** | BLE Module → TurboModule | JSI 直调替代 Bridge | 消除序列化开销，通信延迟 ms→μs |
| **P0** | Native 层事件聚合 | 100ms 内多个 BLE 包合并为一次回调 | JS 回调频率降 3-10 倍 |
| **P1** | 状态精准更新 | Zustand selector，只有变化的字段触发重渲染 | 减少无效重渲染 |
| **P1** | BLE 状态机下沉 Native | 连接/断连/重连逻辑放 Native 层 | JS 只接收最终状态，不参与过程 |
| **P2** | 数据去重 | Native 层对比前后值，相同不通知 JS | 进一步减少 JS 负担 |
| **P2** | 多设备并发管理 | Native 层设备队列，轮询上报 | 避免多设备同时冲击 JS |

### 代码示例

```typescript
// ❌ 改造前：每个 BLE 包都回调 + setState
bleModule.onData((data) => {
  setDeviceState(data);  // 每次都触发重渲染
});

// ✅ 改造后：Native 聚合 + 精准更新
// Native 层：100ms 内的数据聚合，只回调最新值
// JS 层：
const pressure = useDeviceStore(s => s.pressure);  // 只订阅 pressure
const battery = useDeviceStore(s => s.battery);    // 只订阅 battery

// BLE 回调（已被 Native 节流）：
bleModule.onBatchData((latest) => {
  // 只有值真正变了才更新 store
  const state = useDeviceStore.getState();
  if (latest.pressure !== state.pressure) {
    useDeviceStore.setState({ pressure: latest.pressure });
  }
});
```

### BLE 稳定性保障（Native 层）

| 策略 | 做什么 | 为什么 |
|------|--------|--------|
| 重连状态机 | 断连 → 指数退避重连（1s/2s/4s/8s...） | 避免疯狂重连耗电 |
| 心跳检测 | 定时发心跳包，超时判定断连 | 比等系统回调更快发现断连 |
| 连接参数调优 | 根据场景切换 priority（控制时 HIGH，空闲时 LOW_POWER） | 平衡延迟和功耗 |
| 指令确认 | 控制指令发送后等 ACK，超时重发 | 保证指令不丢 |
| 错误分类 | 区分信号弱/超时/系统错误，分别处理 | 精准恢复策略 |

---

## 五、前端体验问题与方案

### 问题 1：不流畅（滑动/切换卡顿）

**可能原因**：

| 原因 | 机制 | 概率 |
|------|------|------|
| 组件重渲染没控制 | 父 state 变 → 子组件全部重渲染 | 高 |
| 列表没优化 | FlatList 销毁重建 View | 高 |
| 页面切换动画走 JS | 转场和业务抢帧预算 | 中 |
| BLE 状态变化触发全局重渲染 | 设备状态放顶层 store | 中 |
| 旧架构 Bridge 开销 | 如果还在 < 0.76 | 看版本 |

**方案**：

| 手段 | 做什么 | 优先级 |
|------|--------|--------|
| React.memo + useCallback | 控制重渲染 | P0 |
| FlashList 替代 FlatList | 列表 View 复用 | P0 |
| native-stack | 页面转场走原生 | P0 |
| Zustand selector | 状态精准订阅 | P1 |
| Reanimated worklet | 动画不占 JS 线程 | P1 |

---

### 问题 2：图片/视频加载慢

**可能原因**：

| 原因 | 现象 |
|------|------|
| 用 RN 原生 Image（无缓存） | 每次进页面都重新下载 |
| 服务端返回原图 | 大图在客户端缩放，浪费带宽和内存 |
| 没有预加载 | 进页面才开始加载，白屏等待 |
| 视频没有封面图 | 视频加载前是空白 |

**方案**：

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **FastImage** 替代 Image | Native 层缓存（内存+磁盘） | 二次加载秒出 |
| CDN 图片裁剪 | URL 加参数 `?w=200&h=200` | 按需下载小图 |
| 预加载 | 列表可见区域外提前加载 | 滚动时图片已就绪 |
| 渐进式加载 | 先加载模糊缩略图 → 再加载高清 | 感知上"秒出" |
| 视频封面 | 视频未播放时显示首帧截图 | 不再空白 |

### FastImage 原理详解

**底层**：封装了各平台最成熟的图片加载库：
- Android → **Glide**
- iOS → **SDWebImage**

RN 原生 Image 组件没有用这些库，所以缓存能力很弱。

**和 RN Image 的区别**：

| | RN Image | FastImage |
|---|---------|-----------|
| 缓存 | 基本无缓存（iOS 有 NSURLCache 但弱） | 三级缓存：内存 → 磁盘 → 网络 |
| 解码 | JS 线程参与调度 | Native 层异步解码，不占 JS |
| 优先级 | 无 | 支持 low/normal/high |
| 预加载 | 无 | `FastImage.preload([urls])` |
| placeholder | 不支持 | 支持（加载中显示占位图） |
| 渐进式 | 不支持 | 支持（先模糊后清晰） |

### FastImage 能优化首次查看吗？

**FastImage 本身不能让首次下载更快**（第一次还是要从网络下载），但能让首次**感知上更快**：

| 手段 | 首次有效？ | 原理 |
|------|-----------|------|
| 磁盘/内存缓存 | ❌ 首次无缓存 | 只优化二次加载 |
| **预加载 preload** | ✅ | 提前下载，用户看到时已在缓存 |
| **placeholder** | ✅ | 加载中显示占位图，不白屏 |
| **渐进式加载** | ✅ | 先显示模糊缩略图，再加载高清 |
| **优先级控制** | ✅ | 可见区域图片优先下载 |
| Native 异步解码 | ✅ | 解码不阻塞 JS 线程，UI 不卡 |

**真正优化首次加载速度**（配合 FastImage）：

| 手段 | 做什么 | 效果 |
|------|--------|------|
| CDN 图片裁剪 | 服务端按需返回小尺寸图 `?w=200` | 下载量减少 80%+ |
| WebP 格式 | 比 PNG/JPG 小 30-50% | 下载更快 |
| 预加载 | 进入列表前就 `FastImage.preload()` | 用户看到时已下载完 |
| 缩略图 → 高清 | 先加载 10KB 模糊图，再加载原图 | 感知秒出 |

```typescript
// 预加载：在上一个页面就开始下载下一页的图片
FastImage.preload([
  { uri: 'https://cdn.example.com/device1.webp?w=200' },
  { uri: 'https://cdn.example.com/device2.webp?w=200' },
]);

// placeholder：加载中显示本地占位图（秒出）
<FastImage
  source={{ uri: fullImageUrl }}
  defaultSource={require('./placeholder.png')}
/>

// CDN 裁剪：服务端返回适合尺寸的图
const thumbUrl = `${imageUrl}?w=200&h=200&q=80`;
```

**一句话**：FastImage 核心是**缓存（二次秒出）+ Native 解码（不卡 JS）**。首次加载速度要靠 CDN 裁剪 + 预加载 + 渐进式来解决。

---

### 问题 3：缺乏 loading 反馈

**本质**：用户不知道"在加载还是卡了"→ 感知体验差。

**方案**：

| 场景 | 方案 | 效果 |
|------|------|------|
| 页面切换 | 骨架屏（Skeleton） | 瞬间有内容框架，不白屏 |
| 图片加载 | placeholder + 渐进式 | 先模糊后清晰 |
| 异步操作 | Loading 指示器 + 超时提示 | 用户知道在等 |
| BLE 连接中 | 连接状态动画 + 进度提示 | 不是"卡了" |
| 列表加载更多 | 底部 loading + 空状态 | 有反馈 |
| 操作反馈 | 按钮 disable + loading | 防重复点击 |

**体系化做法**：

```typescript
// 统一 Loading 组件体系
<Skeleton />          // 页面级骨架屏
<ImagePlaceholder />  // 图片占位
<LoadingOverlay />    // 全屏 loading（BLE 连接/配网）
<InlineLoading />     // 行内 loading（按钮/列表底部）
<EmptyState />        // 空状态（无设备/无数据）
<ErrorState />        // 错误状态（网络失败/BLE 断连）
```

---

## 六、整体优化路线图

```
第一阶段（P0，2 周）：快速见效
├── FlashList 替代 FlatList
├── FastImage 替代 Image
├── 骨架屏 + Loading 体系
├── native-stack 页面转场
└── React.memo 控制重渲染

第二阶段（P1，1 个月）：架构升级
├── BLE Module → TurboModule
├── Native 层事件聚合/节流
├── Zustand 状态管理改造（selector 精准更新）
├── Reanimated 动画下沉
└── 图片 CDN 裁剪 + 预加载

第三阶段（P2，持续）：体系化
├── 性能监控埋点（启动/帧率/BLE 延迟）
├── BLE 状态机下沉 Native
├── 多设备并发管理
├── 性能 CI 卡点（防退化）
└── 新架构全面迁移（如果还没迁）
```

---

## 七、我能带来什么

| 他们的痛点 | 我的经验 | 具体做过什么 |
|-----------|---------|-------------|
| App 不流畅 | CRN 性能优化体系 | 启动/渲染/内存全链路优化，建监控 |
| BLE 通信架构 | 快应用 J2V8 同步 Bridge | 理解 JS↔Native 通信瓶颈，做过类似改造 |
| 缺 Loading/体验差 | 弹窗治理 + 组件体系 | 建统一组件体系，规范交互状态 |
| 架构升级 | CRN 新架构迁移 | 从旧架构规划迁移路径 |
| 工程化不足 | CRN 工程化体系 | 多 Bundle/热更新/CLI/规范 |

**我的方案优势**：
1. **不是只修 bug**：是建体系（监控→定位→优化→验证→防退化）
2. **不是只会 UI**：理解 JS↔Native 通信本质，能从架构层解决
3. **有节奏感**：P0 快速见效 → P1 架构升级 → P2 持续治理

---

## 八、沟通话术

### 开场（展示你研究过产品）

> "我体验了你们的 App，整体功能不复杂，但流畅度有提升空间——滑动和页面切换有掉帧感，图片加载偏慢，一些异步操作缺少 loading 反馈。这些不是业务逻辑问题，是前端体验工程化的问题。"

### BLE 部分（展示架构思维）

> "BLE 通信层我也看了，如果设备上报频率不高（控制指令+状态同步），大概率不是卡顿主因。但我建议做一次通信层改造：迁移 TurboModule + Native 层聚合节流。一方面消除 Bridge 开销，另一方面为未来高频数据场景（比如实时曲线）打基础。"

### 方案（展示执行力）

> "我的思路是分阶段：第一阶段 2 周快速见效——FlashList、FastImage、骨架屏、native-stack，用户马上能感知到变化。第二阶段做架构升级——BLE TurboModule、状态管理改造、动画下沉。第三阶段建监控体系，持续保障不退化。"

### 收尾（展示系统思维）

> "性能优化不是一次性的事。我在 CRN 建立过完整闭环：量化问题 → 分层定位 → 针对性优化 → 数据验证 → CI 防退化。这套方法论可以直接复用到你们的场景。"
