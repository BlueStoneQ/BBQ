# 2026 RN 技术栈选型

> 问题：2026 年新建一个 RN IoT App，技术栈怎么选？
> 本质：每个选型都是在解决一个具体问题，不是追新。
> 截至 2026.05，RN 最新稳定版 **0.85**（2026.04 发布），0.86 预计 2026.06。

---

## 目录

- [一、技术栈全景](#一技术栈全景)
- [二、核心三方库选型](#二核心三方库选型)
- [三、推荐目录结构](#三推荐目录结构)
- [四、Hermes V1 + 新架构现状](#四hermes-v1--新架构现状)
- [五、Expo vs Bare RN](#五expo-vs-bare-rn)
- [六、版本升级建议](#六版本升级建议)
- [七、状态管理选型](#七状态管理选型)

---

## 一、技术栈全景

```
┌─────────────────────────────────────────────────────┐
│  App 层                                              │
│  React 19.2 + TypeScript + 函数组件 + Hooks          │
├─────────────────────────────────────────────────────┤
│  框架层                                              │
│  React Native 0.85（新架构 only，Legacy 已移除）      │
│  Hermes V1（默认引擎，JIT + 并发 GC + WASM）         │
├─────────────────────────────────────────────────────┤
│  核心能力层                                          │
│  导航: React Navigation 7                            │
│  状态: Zustand                                       │
│  网络: Axios + TanStack Query                        │
│  动画: Reanimated 4（核心已合入 RN 0.85）            │
│  手势: Gesture Handler                               │
│  存储: MMKV（同步 KV）                               │
│  UI:   自建 Design System / NativeWind              │
├─────────────────────────────────────────────────────┤
│  Native 层                                           │
│  TurboModule（BLE/相机/传感器等自定义模块）            │
│  Fabric（唯一渲染器，Paper 已移除）                   │
├─────────────────────────────────────────────────────┤
│  工程化层                                            │
│  Metro（打包）+ CodePush/自建热更新                   │
│  ESLint + Prettier + Husky                           │
│  Jest + React Native Testing Library                 │
│  Fastlane（自动化发布）                              │
└─────────────────────────────────────────────────────┘
```

---

## 二、核心三方库选型

| 领域 | 推荐 | 解决什么问题 | 为什么选它 |
|------|------|-------------|-----------|
| 导航 | React Navigation 7 | 页面跳转/Tab/Deep Link | 社区标准，native-stack 底层走原生导航 |
| 状态管理 | Zustand | 跨组件共享状态 | 极简/TS 友好/1KB/无 Provider |
| 服务端缓存 | TanStack Query | 接口数据缓存/刷新/分页 | 不把服务端数据塞 store |
| 网络请求 | Axios | HTTP 请求 | 拦截器/取消/TS 类型 |
| 动画 | Reanimated 4 | 流畅交互动画 | 0.85 起核心合入 RN，worklet 在 UI 线程 |
| 手势 | Gesture Handler | 手势识别 | Native 层识别，不过 JS |
| 列表 | FlashList | 长列表性能 | View 复用，替代 FlatList |
| 图片 | FastImage | 图片缓存/预加载 | Native 缓存，不闪烁 |
| 存储 | MMKV | 本地 KV 持久化 | 同步读写，比 AsyncStorage 快 100x |
| 样式 | NativeWind / StyleSheet | UI 样式 | Tailwind 语法或原生 StyleSheet |
| 国际化 | react-intl / i18next | 多语言 | 格式化/复数/日期 |
| 表单 | React Hook Form | 复杂表单 | 性能好，不触发全量重渲染 |
| 调试 | React Native DevTools | 开发调试 | 0.83+ 内置新 DevTools |
| 监控 | Sentry + Firebase | 线上崩溃/性能 | 错误上报 + 性能指标 |
| 发布 | Fastlane + EAS | 自动化构建发布 | CI/CD 一键发版 |

**选型原则**：
1. 社区活跃度（GitHub stars + 最近更新时间）
2. 新架构兼容（0.82+ 已强制新架构，不兼容的库已淘汰）
3. 包体大小（IoT App 用户网络可能差）
4. TS 支持（类型安全 = 少踩坑）

### React Navigation：JS 路由管理 + 原生导航

React Navigation **不是纯 JS 导航**，取决于用哪个 Navigator：

| Navigator | 底层实现 | 性能 |
|-----------|---------|------|
| `@react-navigation/native-stack` | **原生导航**（iOS: UINavigationController / Android: Fragment） | 原生转场，推荐 |
| `@react-navigation/stack` | 纯 JS 实现（JS 动画驱动页面切换） | 一般，已不推荐 |

**2026 标准做法**：用 `native-stack`。React Navigation 负责路由管理（声明式配置/Deep Link/路由守卫/参数传递），实际页面切换动画走原生导航控制器。

```
React Navigation 的分工：
- JS 层：路由配置 + navigate/goBack API + Deep Link + 路由守卫
- Native 层（native-stack）：UINavigationController / Fragment 执行真正的页面转场动画

= API 在 JS 写，动画在 Native 跑
```

### Axios 在 RN 中的底层链路

```
Axios → XMLHttpRequest（RN polyfill，不是浏览器的）
      → RN Networking Module（Native 模块）
        → Android: OkHttp
        → iOS: NSURLSession
```

RN 同时提供 `fetch` 和 `XMLHttpRequest` 两个 polyfill，底层都是同一个 Native Networking Module。Axios 默认走 XMLHttpRequest 路径。所以不管用 fetch 还是 Axios，最终都是 Native 在发请求，JS 层只是 API 封装。

---

## 三、推荐目录结构

```
src/
├── app/                    # 应用入口 + 导航配置
│   ├── App.tsx
│   ├── navigation/         # 路由定义（Stack/Tab/Deep Link）
│   └── providers/          # 全局 Provider（Query/Theme）
├── features/               # 按业务功能划分（DDD 思想）
│   ├── device/             # 设备管理
│   │   ├── screens/        # 页面组件
│   │   ├── components/     # 功能内部组件
│   │   ├── hooks/          # 功能内部 hooks
│   │   ├── store.ts        # Zustand store（功能级）
│   │   ├── api.ts          # 接口定义
│   │   └── types.ts        # 类型
│   ├── ble/                # BLE 通信
│   ├── auth/               # 登录/注册
│   └── settings/           # 设置
├── shared/                 # 跨功能共享
│   ├── components/         # 通用 UI 组件（Button/Card/Modal）
│   ├── hooks/              # 通用 hooks（useDebounce/useMount）
│   ├── utils/              # 工具函数
│   ├── constants/          # 常量
│   └── types/              # 全局类型
├── native/                 # TurboModule 定义（JS 侧 Spec）
│   ├── BLEModule.ts
│   └── DeviceModule.ts
└── assets/                 # 静态资源（图片/字体/动画 JSON）
```

**核心思想**：
- **features 按业务切**：不按技术类型（components/hooks/services）切，而是按业务功能切。好处：一个功能的所有代码在一个目录，删功能 = 删目录。
- **shared 放公共**：只有被 2 个以上 feature 用到的才提到 shared。
- **native 单独放**：TurboModule 的 JS Spec 集中管理，方便 Codegen。

---

## 四、Hermes V1 + 新架构现状

### Hermes V1（0.84+ 默认）

| 问题 | Hermes V1 怎么解决 |
|------|-------------------|
| JS 解析慢 | AOT 编译为 .hbc 字节码，运行时直接执行 |
| 运行时性能 | 新增 JIT 编译器，热代码编译为机器码，运行时快 40% |
| 内存占用高 | 并发 GC（Hades），GC 暂停时间从 ms 级降到 μs 级 |
| 不支持 WASM | 新增 WebAssembly 支持（可跑 C++/Rust 编译的模块） |
| 启动慢 | 新字节码格式 + 预编译，TTI 提升 ~8% |

**本质**：Hermes V1 = 重写的编译器 + JIT + 并发 GC + WASM。从"够用的解释器"进化为"高性能 JS 引擎"。

### 新架构时间线

| 版本 | 时间 | 里程碑 |
|------|------|--------|
| 0.76 | 2024.10 | 新架构默认开启（可选关闭） |
| 0.82 | 2025.10 | "A New Era"：完全运行在新架构，Legacy 代码开始移除 |
| 0.83 | 2025.12 | React 19.2，无破坏性变更 |
| 0.84 | 2026.02 | Hermes V1 默认，WASM，预编译 iOS 二进制 |
| 0.85 | 2026.04 | 新动画后端（Reanimated 核心合入），Fabric commit 分支机制 |

### 新架构四大组件（0.85 现状）

| 组件 | 作用 | 现状 |
|------|------|------|
| JSI | C++ 直调替代 Bridge | 唯一通信方式，Bridge 已移除 |
| TurboModule | Native Module 懒加载 | 唯一 Module 系统 |
| Fabric | C++ 渲染器 | 唯一渲染器，Paper 已移除 |
| Codegen | 编译时类型生成 | 强制使用，TS Spec → Native 接口 |

### 0.85 新动画后端

**重大变化**：Reanimated 的动画更新逻辑合入 RN 核心。

```
之前：RN Animated API（弱） + Reanimated（强，第三方）→ 两套动画引擎并存
0.85：统一动画后端 → Reanimated 和 Animated 共享同一个底层引擎
```

收益：
- 可以用 Native Driver 动画化 layout 属性（flex/width/height），之前不行
- 动画更新和 Fabric 渲染管线深度集成，更流畅
- Reanimated 未来版本可以做更多底层优化

**一句话**：0.85 = 新架构完全体 + Hermes V1 + 动画引擎统一。2026 年新项目直接用 0.85，不需要考虑旧架构兼容。

---

## 五、Expo vs Bare RN

| | Bare RN | Expo |
|---|---------|------|
| 原生工程 | 自己管（完全控制 android/ios 目录） | Expo 托管（看不到原生工程） |
| 自定义 Native Module | 随便写 | 需要 eject 或 Expo Modules |
| 构建 | 本地 Gradle/Xcode | Expo 云构建（EAS Build） |
| 适合 | 深度 Native 定制（IoT/BLE/自定义 SDK） | 快速原型、纯 JS 业务 |

**企业级 IoT App 用 Bare**：要写 BLE TurboModule、控制 Gradle、做分 Bundle、集成 Native SDK，Expo 托管模式限制太多。

---

## 六、版本升级建议

### 推荐目标：0.85（当前最新稳定版）

### 近期版本演进

| 版本 | 发布时间 | 核心变化 |
|------|---------|---------|
| 0.79 | 2025.04 | 更快的工具链 |
| 0.80 | 2025.06 | React 19.1 |
| 0.81 | 2025.08 | Android 16 支持，更快 iOS 构建 |
| 0.82 | 2025.10 | 完全新架构，Legacy 代码开始移除 |
| 0.83 | 2025.12 | React 19.2，新 DevTools，零破坏性变更 |
| 0.84 | 2026.02 | Hermes V1 默认，WASM，预编译 iOS 二进制 |
| **0.85** | **2026.04** | **新动画后端，Fabric commit 分支，Metro TLS** |
| 0.86 | 2026.06（预计） | 待发布 |

### 升级收益（以 0.85 为目标）

| 收益 | 说明 |
|------|------|
| Hermes V1 | 运行时快 40%，TTI 提升 ~8%，并发 GC |
| 新动画后端 | Reanimated 核心合入，layout 属性可用 Native Driver |
| 新架构 only | 无 Legacy 包袱，代码更精简 |
| React 19.2 | 并发特性，Suspense 改进 |
| WASM 支持 | 可跑 C++/Rust 编译的高性能模块 |
| 多 CDP 连接 | DevTools + VS Code + AI Agent 同时调试 |

### 如何升级

```
1. 用官方 upgrade-helper 对比差异（当前版本 → 0.85，逐文件 diff）
2. 升级 package.json 中 react-native + react 版本
3. 按 diff 修改 android/ 和 ios/ 配置
4. 升级所有第三方库到兼容版本（查 reactnative.directory）
5. 0.82+ 强制新架构：确保所有 Native Module 已迁移为 TurboModule
6. 跑构建 + 测试
```

### 风险控制

- 分支上升级，不动主干
- 逐个解决第三方库兼容（0.82+ 不兼容新架构的库已被淘汰，大部分主流库已适配）
- 灰度发布验证
- 0.83 起承诺零破坏性变更，升级成本显著降低

**最大的坑**：如果从 0.76 以前升级，需要把所有 NativeModule 迁移为 TurboModule。如果已经在 0.82+，后续升级基本无痛。

---

## 七、状态管理选型

### 快速对比

| 维度 | Redux (Toolkit) | MobX | Zustand |
|------|----------------|------|---------|
| 理念 | 单一 store + action + reducer | 可观察对象 + 自动追踪 | 极简 store + hook |
| 样板代码 | 中 | 少 | 极少 |
| TS 支持 | 好 | 一般 | 极好（天然） |
| 包体 | ~11KB | ~16KB | ~1KB |
| 适合 | 大型团队/复杂状态流 | 已有 MobX 项目/OOP 风格 | 新项目/追求简洁 |

### 为什么 Zustand 是 2026 新项目首选

- 极简：一个函数创建 store，一个 hook 消费，无 Provider
- TS 天然友好：类型推导完美
- 性能好：selector 机制，只有用到的字段变化才重渲染
- 体积小：~1KB

### 对已有项目的建议

- 现有 MobX/Redux → 不急着迁移
- 新模块 → 用 Zustand，和旧 store 共存
- 统一 → 渐进式迁移

### IoT App 状态分层

| 状态 | 方案 |
|------|------|
| 设备列表/连接状态（全局共享） | Zustand store |
| 用户/token（全局+持久化） | Zustand + MMKV persist |
| 服务端数据缓存 | TanStack Query（不放 store） |
| 页面内表单（局部） | useState / React Hook Form |

**不是所有状态都放全局 store。** 服务端数据用 Query 管，局部用 useState，只有跨页面共享的才放 Zustand。

### Zustand 使用范式

**1. 创建 store**（状态 + 操作，一个函数搞定）

```typescript
const useDeviceStore = create((set, get) => ({
  devices: [],
  connectedId: null,
  addDevice: (device) => set((state) => ({ devices: [...state.devices, device] })),
  connect: (id) => set({ connectedId: id }),
  disconnect: () => set({ connectedId: null }),
  isConnected: () => get().connectedId !== null,
}))
```

**2. 组件中消费**（selector 只订阅用到的字段，其他变了不重渲染）

```typescript
const devices = useDeviceStore((state) => state.devices)
const connect = useDeviceStore((state) => state.connect)
```

**3. 组件外也能用**（Native 事件回调/工具函数中直接调用）

```typescript
useDeviceStore.getState().connect(deviceId)
```

**核心范式特征**：
- 无 Provider（不像 Redux/Context）
- selector 自动优化重渲染
- 组件内外都能读写
- 一个 store = 一个 hook
