# 分 Bundle 方案（Code Splitting）

> **推荐方案**：按 DDD 拆分为多 Bundle（类似 CRN），每个 Domain 独立开发/构建/发布/热更新。详见 [architecture-engineering.md](./architecture-engineering.md) 和 [XRN PRD](/home/mi/disk/qiaoyang/code/my-github/XRN/me-docs/PRD.md)。
>
> 本文讲分 Bundle 的基础知识，作为多 Bundle 方案的前置理解。
> - 问题：单 Bundle 太大，启动时全量加载 → 启动慢
> - 本质：构建怎么拆 + 运行时怎么加载 + 路由怎么配合

### ⚠️ 分 Bundle 的局限性

分 Bundle（Code Splitting）方案成色一般，实操问题多：
- Metro 不原生支持——模块过滤/ID 管理需要手动配置，容易出 bug
- 模块依赖关系复杂——排除逻辑容易出错（A 依赖 B 里的模块）
- 没有标准工具链——每家自己造轮子，维护成本高
- 收益有限——中小型 App Bundle 总共 2-3MB，拆了省几百 KB 差异不大

**实际建议**：
- 启动优化 → Hermes AOT + 首屏最小化 + Splash 预加载（够用）
- 需要独立发布/热更新 → 直接上多 Bundle（XRN 方案），跳过分 Bundle 这个中间态
- 分 Bundle 只作为知识储备理解原理，不作为首选落地方案

---

## 目录

- [一、分 Bundle vs 多 Bundle](#一分-bundle-vs-多-bundle)
- [二、拆分维度](#二拆分维度)
- [三、构建层：怎么拆](#三构建层怎么拆)
- [四、运行时：怎么加载](#四运行时怎么加载)
- [五、路由层：怎么配合](#五路由层怎么配合)
- [六、加载策略](#六加载策略)
- [七、对 Root 的方案](#七对-root-的方案)

---

## 一、分 Bundle vs 多 Bundle

```
分 Bundle（Code Splitting）：
  一个 Bundle 拆成多个文件，按需加载到同一个 JS 引擎
  目的：启动优化（首屏只加载首屏代码）
  类比：Webpack 的 dynamic import / lazy load

多 Bundle（Multi-Bundle）：
  多个独立的 Bundle，每个是一个完整的业务模块
  可以独立开发/独立构建/独立发布/独立热更新
  目的：业务解耦 + 独立发版 + 团队并行开发
  CRN/XRN 的方案

本质区别：
  分 Bundle = 构建优化（一个产物拆小，按需加载）
  多 Bundle = 架构方案（多个独立产物协同，独立生命周期）
```

本文讲的是**分 Bundle**（启动优化）。多 Bundle 方案见 [architecture-engineering.md](./architecture-engineering.md)。

---

## 二、拆分维度

### 拆分粒度演进

```
阶段 1（最简单）：React.lazy + Suspense
  → 组件级懒加载，同一个 Bundle 内部按需渲染
  → 零成本，不需要改 Native / Metro
  → 适合：中小型 App 的非首屏页面延迟加载

阶段 2（启动优化）：Metro 多入口拆 Bundle
  → 文件级拆分：common + home + 按需 Bundle
  → 需要改 Metro 配置 + Native loadScript
  → 适合：启动慢的 App

阶段 3（终极形态）：XRN 多 Bundle（DDD + 独立发布）
  → 每个 Domain 一个独立 Bundle
  → 独立开发/构建/发布/热更新
  → 配合 Native 路由层统一管理
  → 适合：大型 App / 多团队协作
```

### 按 DDD 拆分（推荐，和 XRN 对齐）

```
common.bundle（框架层，启动加载）：
  - React / RN / Navigation / Zustand / 通用组件

home.bundle（首页 Domain，启动加载）：
  - 设备列表 + 连接状态 + 首页 UI

device.bundle（设备 Domain，闲时预加载）：
  - 设备详情 / 控制面板 / 实时数据
  - 首屏完成后自动预加载（用户进入时秒开）

settings.bundle（设置 Domain，懒加载）：
  - 设置 / 账号 / 配网流程
  - 用户点击时才加载
```

每个 Domain = 一个独立 Bundle = 可以独立热更新。这就是 XRN 方案的落地形态。

### 拆分维度选择

| 维度 | 怎么拆 | 适合 |
|------|--------|------|
| **加载时机** | 启动必须 / 首屏 / 按需 | 启动优化（最常用） |
| **路由/页面** | 每个页面一个 chunk | 页面多的 App |
| **业务模块** | 每个 feature 一个 chunk | 大型 App / 多团队 |
| **更新频率** | 不变的（框架）vs 常变的（业务） | 缓存优化 / 热更新 |

---

## 三、构建层：怎么拆

### Metro 本身不原生支持 Code Splitting

不像 Webpack 有 `dynamic import` 自动拆分。RN 的分 Bundle 需要自己配置。

### Metro 多入口打包（主流方案）

```bash
# 1. 打 common bundle（框架代码）
npx react-native bundle \
  --entry-file common.js \
  --bundle-output dist/common.bundle \
  --platform android

# 2. 打 business bundle（排除 common 里已有的模块）
npx react-native bundle \
  --entry-file index.js \
  --bundle-output dist/home.bundle \
  --platform android \
  --config metro.home.config.js
```

```javascript
// metro.home.config.js — 排除 common 里已有的模块
const commonModules = require('./common-modules.json'); // 构建 common 时记录的模块列表

module.exports = {
  serializer: {
    // 过滤：common 里已有的模块不打入 business bundle
    processModuleFilter: (module) => {
      if (commonModules.includes(module.path)) return false;
      return true;
    },
    // 模块 ID 工厂：保证 common 和 business 的模块 ID 不冲突
    createModuleIdFactory: () => {
      let nextId = 10000; // business 从 10000 开始，common 从 0 开始
      return (path) => nextId++;
    },
  },
};
```

### Metro 关键优化配置

```javascript
// metro.config.js
module.exports = {
  transformer: {
    // Hermes AOT 编译
    hermesCommand: 'hermes',
    // 压缩：删除 console.log
    minifierConfig: { compress: { drop_console: true } },
  },
  serializer: {
    // 自定义模块 ID（多 Bundle 去重用）
    createModuleIdFactory: () => { /* ... */ },
    // 模块过滤（排除 common 已有的）
    processModuleFilter: (module) => { /* ... */ },
  },
  resolver: {
    // 排除不需要的文件
    blockList: [/node_modules\/.*\/example\/.*/],
    // 平台特定文件
    platforms: ['ios', 'android'],
  },
};
```

---

## 四、运行时：怎么加载

### 为什么 Native Shell 必须改？

默认 RN 启动流程只加载一个 Bundle（`index.bundle`），没有"动态加载第二个文件"的能力。分 Bundle 后需要 Native 侧支持多次 `loadScript`。

```
默认 RN（单 Bundle）：
  MainApplication → ReactInstanceManager → loadScript("index.bundle") → 完事
  Native 侧不需要改，因为只加载一次

分 Bundle 后：
  MainApplication → ReactInstanceManager → loadScript("common.bundle")  ← 启动时
                                         → loadScript("home.bundle")    ← 启动时
                                         → loadScript("device.bundle")  ← 用户触发时
  Native 侧必须改：支持多次调用 loadScript
```

**改动很小**：写一个 `BundleLoader` TurboModule，把 `loadScript` 能力暴露给 JS 层。JS 层决定什么时候加载哪个 Bundle，Native 层只负责执行。

### Native 层：BundleLoader TurboModule

```kotlin
// Android 侧：动态加载 Bundle 文件到当前 JS 引擎
class BundleLoader(private val reactContext: ReactApplicationContext) {

    fun loadBundle(bundlePath: String) {
        val catalystInstance = reactContext.catalystInstance
        // 从文件加载并执行 JS Bundle（加载到同一个引擎，共享全局作用域）
        catalystInstance.loadScriptFromFile(bundlePath, bundlePath, false)
    }

    fun loadBundleFromAssets(assetName: String) {
        val catalystInstance = reactContext.catalystInstance
        catalystInstance.loadScriptFromAssets(reactContext.assets, assetName, false)
    }
}
```

### JS 层：加载管理器

```typescript
// BundleManager.ts
const loadedBundles = new Set<string>();

export async function loadBundle(bundleName: string): Promise<void> {
  if (loadedBundles.has(bundleName)) return; // 已加载，跳过

  // 调用 Native 加载器
  await NativeBundleLoader.loadBundle(`${bundleName}.bundle`);
  loadedBundles.add(bundleName);
}

export function isBundleLoaded(bundleName: string): boolean {
  return loadedBundles.has(bundleName);
}
```

### 加载顺序

```
App 启动：
  1. Native 初始化
  2. 加载 common.bundle（框架代码）→ React/RN/Navigation 就绪
  3. 加载 home.bundle（首屏）→ 首页组件注册
  4. 渲染首屏
  5. 空闲时预加载其他 Bundle（可选）
```

---

## 五、路由层：怎么配合

### 模块注册表

```typescript
// bundleRegistry.ts — 记录每个路由对应哪个 Bundle
export const bundleRegistry: Record<string, BundleConfig> = {
  Home:         { bundle: 'home',     preload: true },
  DeviceList:   { bundle: 'home',     preload: true },
  DeviceDetail: { bundle: 'device',   preload: false },
  DeviceControl:{ bundle: 'device',   preload: false },
  Settings:     { bundle: 'settings', preload: false },
  Profile:      { bundle: 'settings', preload: false },
};
```

### 路由拦截（跳转前检查）

```typescript
// 封装 navigate：跳转前确保 Bundle 已加载
export async function navigateTo(routeName: string, params?: object) {
  const config = bundleRegistry[routeName];

  if (config && !isBundleLoaded(config.bundle)) {
    // Bundle 未加载 → 先加载，显示 loading
    showLoading();
    await loadBundle(config.bundle);
    hideLoading();
  }

  navigation.navigate(routeName, params);
}
```

### 和 React.lazy 的区别

| | React.lazy | 分 Bundle |
|---|---|---|
| 拆什么 | 组件（同一个 Bundle 内部） | 整个 Bundle 文件 |
| 加载方式 | JS 层 dynamic import | Native 层 loadScript |
| 需要 Native 配合 | 不需要 | 需要 |
| 粒度 | 组件级 | 页面/模块级 |
| 适合 | 非首屏组件延迟渲染 | 大型 App 启动优化 |

两者可以配合使用：分 Bundle 拆大块，React.lazy 在 Bundle 内部再拆组件。

---

## 六、加载策略

| 策略 | 时机 | 用户感知 | 适合 |
|------|------|---------|------|
| **启动加载** | App 启动时 | 无（必须等） | common + 首屏 |
| **闲时预加载** | 首屏渲染完后空闲时 | 无（用户无感，进页面秒开） | 高概率访问的页面 |
| **懒加载** | 用户点击时 | 有短暂 loading | 低频页面 |
| **预测加载** | 根据用户行为预测 | 无 | 进了列表 → 预加载详情 |

```typescript
// 闲时预加载：首屏渲染完 + 动画结束后，自动预加载高概率页面
import { InteractionManager } from 'react-native';

function App() {
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      // 用户大概率会进设备详情 → 提前加载
      loadBundle('device');
    });
  }, []);
}

// 懒加载：用户点击时才加载（配合 loading 状态）
async function navigateTo(routeName: string, params?: object) {
  const config = bundleRegistry[routeName];
  if (config && !isBundleLoaded(config.bundle)) {
    showLoading();                    // 显示 loading
    await loadBundle(config.bundle);  // 加载 Bundle
    hideLoading();                    // 隐藏 loading
  }
  navigation.navigate(routeName, params);
}

// 预测加载：根据用户行为提前加载
function DeviceListItem({ device }) {
  return (
    <Pressable
      onPress={() => navigateTo('DeviceDetail', { id: device.id })}
      onPressIn={() => {
        // 手指按下时就开始预加载（不等松手）
        if (!isBundleLoaded('device')) loadBundle('device');
      }}
    />
  );
}
```

---

## 七、对 Root 的方案

```
Root IoT App 的分 Bundle 方案：

common.bundle（~1MB，启动加载）：
  React + RN + Navigation + Zustand + 通用组件 + BLE 基础

home.bundle（~300KB，启动加载）：
  设备列表 + 连接状态 + 首页 UI

device.bundle（~200KB，进入设备时加载）：
  设备详情 + 控制面板 + 实时数据展示

settings.bundle（~150KB，点击设置时加载）：
  设置 + 账号 + 配网流程

效果：
  启动只加载 ~1.3MB（common + home）而不是全部 ~2MB
  启动时间减少 ~30%（减少了 JS 解析和执行量）
```

---

## 概念速查

| 概念 | 一句话 |
|------|--------|
| Code Splitting | 把一个大 Bundle 拆成多个小文件，按需加载 |
| Splash（启动屏） | 用户点击图标后立刻看到的品牌画面，Native 层控制，前置任务完成后消失 |
| Splash 时长 | 不是固定时间，是"前置任务做完就消失"，目标 1-2s，超过 3s 用户觉得慢 |
| Splash 期间做什么 | Native：SDK/BLE 初始化；JS 就绪后：请求数据/预加载图片，全部完成再 hide |
| React.lazy | 组件级懒加载（用到时才加载 JS 模块），不需要 Native 配合 |
| Suspense | React 的等待机制：组件没准备好时显示 fallback，准备好了自动替换 |
| Metro | RN 的打包器，不原生支持 Code Splitting，需手动配置 |
| processModuleFilter | Metro 配置项，过滤模块不打入当前 Bundle |
| createModuleIdFactory | Metro 配置项，自定义模块 ID（多 Bundle 去重） |
| loadScriptFromFile | Native API，动态加载 JS 文件到当前引擎 |
| 闲时预加载 | 首屏完成后空闲时自动加载高概率页面（用户无感） |
| 懒加载 | 用户触发时才加载（有短暂 loading） |
| DDD + 多 Bundle | 每个 Domain 一个独立 Bundle，独立开发/发布/热更新（XRN 方案） |
| bundleRegistry | 模块注册表，记录每个路由对应哪个 Bundle |
