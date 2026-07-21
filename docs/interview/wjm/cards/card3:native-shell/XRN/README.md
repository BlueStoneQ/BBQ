# XRN

→ 父目录: [card3:native-shell 总览](../README.md)

→ [root: XRN 文档（资料库）](../../../../root/XRN/README.md)

## 目录

- [四大核心模块](#四大核心模块)
- [索引](#索引)
- [QA](#qa)
  - [Q1: RN 版本升级怎么做？](#q1-rn-版本升级怎么做)
  - [多 Instance 架构核心收益](#多bundle-多instance架构设计的核心收益)
  - [Q3: Native Shell 启动 RN 主流程？](#q3-native-shell-启动-rn-主流程)
  - [用到 TurboModule 的地方？](#用到turbo-module的地方)
  - [多 Activity 的核心收益？](#多activity的核心收益)
  - [Q4: 两段式路由，bundle 内部多页面怎么管？](#q4-两段式路由bundle-内部多页面怎么跳转和统一管理)

## 四大核心模块

| 模块 | 职责 |
|------|------|
| **Native Shell** | 多实例容器 + 实例池 + 路由 + CrashGuard + 内存管理 |
| **Bundler** | [→ build-metro.md](./build-metro.md) Metro 多 entry + Common/Business 分包 + Hermes .hbc |
| **HMR（热更新）** | [→ hmr.md](./hmr.md) Server（版本管理/灰度/差量）+ Client SDK |
| **CLI** | create / build / publish / dev，开发者入口 |

## 索引

- [Android Shell](./android-shell/README.md)
- [iOS Shell](./IOS-shell/README.md)
- [多 Bundle 构建（Metro）](./build-metro.md)
- [热更新（HMR）](./hmr.md)

## QA

### Q1: RN 版本升级怎么做？

**用 Upgrade Helper 看 diff → 改 Native 配置 → 升依赖 → 回归测试 → 灰度验证。**

步骤：
1. https://react-native-community.github.io/upgrade-helper/ 查两版本间 diff
2. 按 diff 改 `android/`、`ios/` 下的 Native 配置（最痛的部分）
3. 升级 JS 依赖 + 处理 breaking changes
4. 编译通过 → 单测通过 → E2E 回归 → 灰度发布观测 → 全量

### 多bundle: 多instance架构设计的核心收益?
- 多 Instance 隔离的核心收益就是：一个 bundle 的 JS 崩了（JS Error / JS 线程卡死），只影响那一个页面，其他页面和主 App 不受影响。每个 Instance 有独立的 HermesRuntime（独立 JS Context），互不干扰。

### 多activity的核心收益?
崩溃隔离是 ReactInstance 提供的（独立 JS Context），和 Activity 无关。

Activity 的价值不是隔离，是导航体验：

系统 back stack
Native 转场动画
和 Native 页面混排
即使用单 Activity + 多 Instance（Fragment 承载），隔离性一样——因为隔离是 Instance 级别的。多 Activity 解决的是"导航栈怎么管"的问题，不是"崩溃怎么隔离"的问题。

### 用到turbo module的地方?

- XRNRouterModule — 统一路由（JS 调 → Native startActivity / push ViewController）
- XRNUpdaterModule — 热更新接口（checkUpdate / installBundle / reload）
- PerfModule — 性能打点上浮（JS 层 T3/T4 时间戳传给 Native 上报线程）

挑一个展开说细节（比如 Router）：

"我们的多 Bundle 架构需要跨模块跳转走 Native 路由，所以我写了一个 XRNRouterModule。JS 侧调 Router.push(url)，TurboModule 解析 URL 判断目标模块，决定是 React Navigation push 还是 startActivity 新建容器。双端各实现一套 Native 层逻辑，JS 层 API 统一。"

这样既展示了实际场景，又能引出架构设计的深度讨论。

### Q3: Native Shell 启动 RN 主流程？

**本次启动直接用本地 bundle，不等网络。更新是后台静默的，下次生效。**

```
1. Splash 显示
2. 读本地 manifest → hot/ 有就用 hot，没有用 builtin
3. 预热 Instance + 加载 bundle → 渲染首页 → 隐藏 Splash
4. 首页渲染完后，后台静默：检查服务端 → 有新版本 → 下载 diff → 合并 → 下次启动生效
```

---

### Q4: 两段式路由，bundle 内部多页面怎么跳转和统一管理？

**结构**：1 Activity = 1 RNInstance = 1 bundle = 多个页面（React Navigation 管内部路由）。

**两段**：

| 段 | 场景 | 谁管 | 底层 |
|---|------|------|------|
| 第一段 | 跨模块/跨容器（RN→Flutter→Native→H5） | Native 路由管理器（URL 注册表 dispatch） | startActivity |
| 第二段 | 同一 bundle 内多页面 | React Navigation（native-stack） | Fragment 切换（同 Activity 内） |

**统一路由的本质**：Native 层维护一个 URL → 容器类型的注册表，统一 dispatch。不是"一个路由栈管所有"，是"一个入口统一决策走哪个容器"。

```
Router.push("order/detail?id=123")
  → Native 路由管理器查注册表
  → 目标是 RN order 模块
    → 当前已在 order Activity 内？
      → 是 → Bridge 通知 JS 层 React Navigation 内部 navigate（不新建 Activity）
      → 否 → startActivity(RNContainerActivity, bundle=order, initialRoute="detail")

Router.push("pay/confirm")
  → 查表 → Flutter 容器
  → startActivity(FlutterActivity, route="/pay/confirm")
```

**back 键行为**：系统 Activity back stack 天然管跨容器的返回顺序。bundle 内部按 back → React Navigation 先 pop，栈空了 → Activity.finish()。

**XRNRouter 统一入口**（JS 侧封装）：

```typescript
function push(url: string) {
  const target = parseModule(url);
  const current = getCurrentModule();
  if (target === current) {
    // 同 bundle 内 → JS 路由
    navigation.navigate(parseScreen(url), parseParams(url));
  } else {
    // 跨模块 → Native 路由
    NativeRouter.push(url);
  }
}
```

#### 演进方向：路由全收口 Native 层

> 后期优化方向：**所有路由（包括同 bundle 内页面跳转）统一收口到 Native Router 层**，不走 RN 内部 Navigation。

**为什么**：
- 路由栈全局统一，Native 侧完整感知所有页面生命周期
- 返回手势一致（不存在 RN Navigation 和 Native back stack 两套行为）
- Native 层可统一做：预加载、埋点、内存回收、页面曝光统计

**实现方式**：同 bundle 内跳转也走 `NativeRouter.push(url)` → Native 判断目标在同一容器内 → 通过 Bridge 通知 JS 层切换页面（而不是 JS 层自己 navigate）。本质上 JS 侧不再持有路由决策权，只负责渲染。
