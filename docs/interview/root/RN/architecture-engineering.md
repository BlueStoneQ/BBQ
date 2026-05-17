# 架构和工程化治理

> 问题：怎么让一个 RN App 从"能跑"到"工程化"——支撑多团队并行、独立发版、灰度可控？
> 核心链路：DDD → Monorepo → 分 Bundle 构建 → 热更新推送

---

## 目录

- [一、DDD（领域划分）](#一ddd领域划分)
- [二、Monorepo（代码组织）](#二monorepo代码组织)
- [三、Bundle 级构建](#三bundle-级构建)
- [四、Push 策略（热更新推送）](#四push-策略热更新推送)
- [五、为什么社区方案不够](#五为什么社区方案不够)
- [六、一句话串联](#六一句话串联)

---

## 一、DDD（领域划分）

先把业务拆成独立的领域（bounded context）：

```
IoT App 领域划分：
├── 设备管理（device）    — 设备列表、配网、绑定/解绑
├── 设备控制（control）   — BLE 通信、指令下发、状态展示
├── 用户（user）          — 登录、个人中心、设置
├── 消息（message）       — 推送、告警、通知
└── 公共（common）        — UI 组件、工具函数、RN 框架依赖
```

**为什么要拆**：每个领域独立迭代、独立发版。设备控制改了 bug，不需要用户模块跟着发。

---

## 二、Monorepo（代码组织）

DDD 领域映射成 monorepo package：

```
monorepo (pnpm workspace)
├── packages/
│   ├── common/         ← 公共依赖（react/react-native/导航/状态管理）
│   ├── module-device/  ← 设备管理领域
│   ├── module-control/ ← 设备控制领域
│   ├── module-user/    ← 用户领域
│   ├── module-message/ ← 消息领域
│   └── native-ble/     ← BLE TurboModule（Native 层）
├── apps/
│   └── main/           ← 壳工程（入口 + 路由注册 + Android/iOS 工程）
└── tools/
    ├── bundler/        ← 分 Bundle 构建脚本
    └── pusher/         ← 热更新发布工具
```

每个 module-xxx 是独立 npm package，有自己的 `package.json`，声明对 common 的依赖。

---

## 三、Bundle 级构建

### 构建产物

```
├── common.hbc      ← react + react-native + 导航 + 状态管理 + 公共组件
├── device.hbc      ← 设备管理业务代码（不含 common 依赖）
├── control.hbc     ← 设备控制业务代码
├── user.hbc        ← 用户业务代码
└── message.hbc     ← 消息业务代码
```

### 怎么做

1. **Metro 多 entry**：每个 module 有自己的入口文件
2. **公共依赖提取**：common 打成 common.hbc，业务 Bundle 声明 external 不重复包含
3. **Hermes 编译**：每个 Bundle.js → hermes compiler → .hbc

### 运行时加载

```
App 启动 → 加载 common.hbc（先加载，提供基础依赖）
  → 路由跳转"设备管理" → 动态加载 device.hbc
  → 路由跳转"设备控制" → 动态加载 control.hbc
```

---

## 四、Push 策略（热更新推送）

### 架构

```
开发者 CLI 发布 → 发布平台（版本管理 + 灰度 + 差量计算）→ CDN/OSS → 用户设备 SDK
```

### 发布流程

```
1. 改了 module-device 代码
2. CI 只重新打 device.hbc（其他不动）
3. 上传到发布平台
4. 平台计算 diff（bsdiff 差量）
5. 配置灰度（5% → 50% → 全量）
6. 用户设备 SDK 检查更新 → 下载差量包 → 合并 → 下次进入该页面生效
```

### 灰度策略维度

| 维度 | 示例 |
|------|------|
| 比例 | 5% → 50% → 全量 |
| 用户 ID | 内部测试用户先更新 |
| 设备型号 | 某型号有 bug，只推给该型号 |
| 地区 | 先国内，再海外 |
| App 版本 | 只推给 >= 2.0 的用户 |

### 回滚机制

```
监控 crash 率 → 超阈值 → 自动停止灰度 → 已更新用户回退上一版 → 告警开发者
```

### 版本管理

```
每个 Bundle 独立版本号：
  common: v1.2.0
  device: v3.1.0
  control: v2.0.1

兼容性：device v3.1.0 要求 common >= v1.2.0
common 升级时要检查所有 business Bundle 兼容性
```

---

## 五、为什么社区方案不够

| 方案 | 分 Bundle | 独立灰度 | 自动回滚 | 国内可用 |
|------|-----------|---------|---------|---------|
| CodePush | ❌ 整包 | 基础 | ❌ 手动 | ❌ 海外服务器 |
| Pushy | ❌ 整包 | 基础 | ❌ | ✅ |
| EAS Update | ❌ 整包 | 基础 | ❌ | ⚠️ |
| **自建** | ✅ | ✅ 多维度 | ✅ crash 率触发 | ✅ 自己的 CDN |

分 Bundle + 独立灰度 + 自动回滚 = 必须自建。这是 CRN 级方案的核心价值。

---

## 六、一句话串联

DDD 定义边界 → Monorepo 组织代码 → Metro 分 Bundle 构建 → 独立版本管理 → 独立灰度推送 → 独立回滚。每个领域从开发到发布完全解耦。

---

## 七、热更新补充

### APK 内置基线版本

APK 上架时自带完整 Bundle（v1），确保离线可用。热更新是在基线上叠加升级。

```
APK 内置：common.hbc v1 + device.hbc v1 + control.hbc v1（保底版本）
热更新：下发变化的 Bundle → 覆盖本地 → 下次启动生效
回滚兜底：热更新失败/crash → 回退到 APK 内置的 v1
```

### 全量 vs 增量（差量）更新

| 方式 | 下发内容 | 下载量 | 适用场景 |
|------|---------|--------|---------|
| 全量 | 完整的新 Bundle 文件 | 大（整个文件） | 大改动/重构 |
| 增量 | 新旧 Bundle 的 diff（bsdiff） | 小（只有变化部分） | 小改动/bug 修复 |

```
增量流程：
  服务端：bsdiff(v1, v2) → 生成 patch 文件（50KB）
  设备端：v1 + patch → bspatch → 得到 v2
```

服务端根据 diff 大小自动决定：diff < 原文件 70% → 下发增量，否则下发全量。

### 端上增量合并

**流程**：
```
下载 patch → bspatch(旧文件, patch) → 生成新文件（临时）→ hash 校验 → 通过则 rename 替换
```

**关键保障**：
- hash 校验（防 patch 损坏）
- 先写临时文件再 rename（合并失败不影响旧文件）
- 磁盘空间预检查（旧文件 + patch + 新文件同时存在）

**合并耗时处理**：
- 合并在后台线程做（不阻塞 UI）
- 合并时机：下载完成后立即合并，但不立即生效（下次启动才加载新文件）
- 如果 Bundle 较大（>5MB），合并可能需要几百 ms ~ 几秒，所以不能在启动路径上做
- 最佳实践：App 进后台 / 空闲时做合并，启动时只做"该加载哪个版本"的判断

**成熟方案**：
- **bsdiff/bspatch**（C 库，Colin Percival 开源）：最经典，Android 系统 OTA 升级也用它
- **react-native-update（Pushy）**：内置了 bsdiff 差量能力，可参考其 Native 端实现
- **Google Archive Patcher**：Google 出品，针对 zip/apk 优化的差量算法
- 自建时一般直接集成 bsdiff C 库，通过 JNI 调用，几十行胶水代码

---

## 八、架构落地：Native 壳 + RN 嵌入

### 不是"创建 RN 项目加 Native"，是反过来

标准 `react-native init` 是 RN 为主体。CRN 级架构是 **Native 壳为主体，RN 作为渲染引擎嵌入**。

### 实际项目结构

```
├── android/              ← 自建 Android 工程（壳）
│   ├── app/              ← 主 Application，管启动/路由分发/Bundle 加载
│   └── modules/          ← Native AAR（BLE 等）
├── ios/                  ← 自建 iOS 工程（壳）
├── packages/             ← JS 业务代码（monorepo）
│   ├── common/
│   ├── module-device/
│   └── module-control/
└── tools/                ← 构建脚本（Metro 多 entry 打包）
```

### RN 怎么接入

1. Android 壳工程 Gradle 依赖 `react-native` AAR
2. `MainApplication` 初始化 `ReactNativeHost`
3. 需要显示 RN 页面时创建 `ReactRootView`，指定加载哪个 Bundle
4. Bundle 从 assets/ 或本地存储动态加载

```
// 伪代码：壳工程加载某个业务 Bundle
val reactRootView = ReactRootView(context)
val instanceManager = ReactInstanceManager.builder()
    .setBundleAssetName("device.hbc")  // 指定 Bundle
    .build()
reactRootView.startReactApplication(instanceManager, "DeviceModule")
```

### 和标准方式的区别

| | `react-native init` | CRN 级架构 |
|---|---------------------|-----------|
| 主体 | RN 是主体，Native 辅助 | Native 壳是主体，RN 是嵌入的渲染引擎 |
| Bundle | 一个 | 多个（Common + 各业务） |
| 创建方式 | CLI 一键生成 | 自建 Native 工程 + 手动集成 RN |
| Bundle 加载 | 启动时加载唯一 Bundle | 按路由动态加载对应 Bundle |
| 适合 | 简单 App | 大型多业务 App（多团队并行） |

### eject 的概念

- eject 是 **Expo 的概念**：Expo Managed 项目 eject 后暴露原生工程
- `react-native init` 创建的项目本来就是 Bare，不需要 eject
- CRN 级架构连 `react-native init` 都不用，直接自建 Native 工程

---

## 九、CLI 脚手架 + 模块模板

### CLI 覆盖的工程化动作

| 命令 | 作用 |
|------|------|
| `create` | 创建新业务模块（模板 + 注册到 workspace + 配置 Metro entry） |
| `build` | 打包指定模块的 Bundle（Metro + Hermes） |
| `publish` | 上传 Bundle 到热更新平台 |
| `dev` | 本地开发（启动 Metro + 指定模块） |
| `lint` | 代码检查 |

### 业务模块模板

```
packages/module-xxx/
├── index.ts              ← Bundle 入口（注册组件 + 导出路由）
├── package.json          ← 模块名、依赖（只依赖 @app/common）
├── screens/              ← 页面
├── components/           ← 模块内部组件
├── hooks/                ← 模块专用 Hooks
├── services/             ← 模块 API 接口
├── stores/               ← 模块状态（Zustand）
├── types/                ← TS 类型
├── constants/            ← 常量
├── navigation/routes.ts  ← 声明本模块路由
└── __tests__/            ← 测试
```

### 设计原则

1. **自包含**：页面/组件/状态/接口/路由都在模块内，不依赖其他业务模块
2. **只依赖 common**：公共能力从 `@app/common` 引入
3. **入口标准化**：`index.ts` 导出 `routes` + `moduleName`，壳工程按约定加载
4. **可独立构建**：Metro 以 `index.ts` 为 entry 单独打 Bundle

### RN Bundle 不需要 `react-native init`

Bundle 就是 JS 打包产物，只需要：
1. 写 JS/TS 代码（packages/ 下）
2. Metro 打包（指定 entry）→ .bundle.js
3. Hermes 编译 → .hbc
4. 放入 APK assets/ 或热更新下发

Metro 不依赖 init 生成的项目结构，只需要入口文件 + metro.config.js。
