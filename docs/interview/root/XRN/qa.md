# XRN Q&A

> Root 二面准备。对方可能很懂 Android/iOS，会追问 Native 层细节。
>
> 策略：问点答面答体系。每个问题都是展示"我能建完整大前端工程化体系"的入口。

---

## 目录

- [开发全链路：构建到发布](#开发全链路构建到发布)
  - [分 Bundle 构建原理](#分-bundle-构建原理)
  - [开发调试流程](#开发调试流程)
    - [调试阶段 Bundle 来源决策机制](#调试阶段-bundle-来源决策机制)
  - [热更新全流程](#热更新全流程)
  - [差量更新原理（bsdiff）](#差量更新原理bsdiff)
  - [灰度 + 回滚机制](#灰度--回滚机制)
  - [和 CodePush 的区别](#和-codepush-的区别)
- [架构与原理](#架构与原理)
  - [核心大件 + 全链路覆盖](#核心大件--全链路覆盖)
    - [XRN CLI 功能设计](#xrn-cli-功能设计)
  - [分 Bundle 加载时序](#分-bundle-加载时序)
  - [Native 壳多 Bundle 文件管理](#native-壳多-bundle-文件管理)
  - [性能监控（Native 侧）](#性能监控native-侧)
- [稳定性保障](#稳定性保障)
  - [白屏检测](#白屏检测)
  - [热更新后 crash/白屏处理（CrashGuard）](#热更新后-crash白屏处理crashguard)
  - [稳定性保障全景](#稳定性保障全景)
- [选型与生态](#选型与生态)
  - [为什么不选 Expo](#为什么不选-expo)
  - [Expo 对 XRN 的启发](#expo-对-xrn-的启发)
  - [Push Server 部署方案](#push-server-部署方案)
  - [可观测体系是必须的](#可观测体系是必须的)

---

# 开发全链路：构建到发布

---

## 分 Bundle 构建原理

**本质**：构建时排除，运行时共享。`processModuleFilter` 是核心 — 让 business bundle 只含业务代码，公共依赖引用指向 common。

### Common Bundle 包含什么

```
common.hbc = React + RN + Navigation + 团队公共组件/工具
= 所有 business bundle 的运行时基座
= App 启动时同步加载一次
```

### 为什么 business bundle 不会重复打入 React

```
代码里正常写 import React from 'react'
Metro 构建 business bundle 时：
  → 解析到 react → 得到 moduleId
  → processModuleFilter 检查：该 ID 在 commonModuleIds 里？
  → 在 → return false → react 源码不写入 bundle
  → 但 __r(moduleId) 引用保留在 bundle 里

运行时：
  → common.hbc 先加载 → react 注册到全局模块表 __d(moduleId, factory)
  → business.hbc 执行 __r(moduleId) → 从全局表找到 → 用 common 的

= 类似 C 的 extern：声明存在但定义在别处
```

### processModuleFilter 配置

```js
// metro.config.js（构建 business bundle 时）
// commonModuleIds.json = 构建 common 时自动产出的副产物（记录所有已打入的模块 ID）
const commonModuleIds = new Set(require('./commonModuleIds.json'))

module.exports = {
  serializer: {
    createModuleIdFactory: () => (path) => hashPath(path), // 跨 bundle 一致的 ID
    processModuleFilter: (module) => {
      // common 已有 → 排除；自己的 → 打入
      return !commonModuleIds.has(module.id)
    }
  }
}

// commonModuleIds.json 怎么来的：构建 common 时记录所有打入的模块 ID
```

### 开发阶段怎么跑

```
开发时 = 普通 Monorepo，不分 Bundle：
  → 根目录 npx react-native start → Metro 全量加载
  → 和正常 RN 开发一样（HMR/调试全正常）
  → 分 Bundle 只在 xrn build 时生效，开发者无感知

依赖管理：
  公共依赖 → 根 package.json，pnpm hoist 到根 node_modules
  业务独有依赖 → 各 package 自己的 package.json
  版本统一靠 pnpm-lock.yaml
```

### 开发调试流程

**开发模式架构**：

```
┌─────────────────────────────────────────────────────┐
│  开发者机器                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  npx xrn dev → Metro Dev Server (8081)      │    │
│  │  ↓                                          │    │
│  │  源码变更 → HMR/Fast Refresh → 增量编译      │    │
│  │  ↓                                          │    │
│  │  WebSocket 推送 → 应用热更新                  │    │
│  └─────────────────────────────────────────────┘    │
│           ↓ (HTTP/WebSocket)                        │
│  ┌─────────────────────────────────────────────┐    │
│  │  模拟器/真机                                  │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │  App Shell 启动                      │    │    │
│  │  │  ↓                                  │    │    │
│  │  │  检测 localhost:8081 是否可达        │    │    │
│  │  │  ↓                                  │    │    │
│  │  │  是 → 从 Dev Server 加载 Bundle      │    │    │
│  │  │  否 → 回退到内置 Bundle             │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**调试工具链**：

| 工具 | 用途 | 适用场景 |
|------|------|---------|
| React Native DevTools | JS 断点、Console、组件树、性能分析 | RN 0.76+ 内置 |
| Flipper | Network 抓包、Layout 层级、Database | 网络/布局调试 |
| Hermes Debugger | 内存分析、性能 profiling | 性能调优 |
| VS Code Debugger | 源码断点调试 | 日常开发 |

**本地通信方式**：

| 场景 | 通信方式 | 说明 |
|------|---------|------|
| 模拟器 | `localhost:8081` | 直接访问主机端口 |
| Android 真机 | `adb reverse tcp:8081 tcp:8081` | 端口转发 |
| iOS 真机 | 同一局域网 + 主机 IP | `http://<IP>:8081` |

**开发 vs 生产模式对比**：

| 维度 | 开发模式 | 生产模式 |
|------|---------|---------|
| Bundle 来源 | 本地 Dev Server | 内置 / 热更新 |
| 调试能力 | 完整 DevTools | 禁用 |
| 性能 | 较慢（调试模式） | 最优 |
| 代码压缩 | 未压缩 | 压缩混淆 |

---

### 调试阶段 Bundle 来源决策机制

**Q：XRN 在调试阶段如何决定 Bundle 来源？开发模式和生产模式的 Bundle 加载机制有何不同？**

**A**：XRN 设计了两套并行的调试方案，以适应不同的开发场景：

#### 1. Dev Server 模式（开发调试）

**适用场景**：日常开发、功能调试、HMR 热重载

**架构设计**：
```
┌─────────────────────────────────────────────────────┐
│  开发者机器                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  npx xrn dev → Metro Dev Server (8081)      │    │
│  │  ↓                                          │    │
│  │  源码变更 → HMR/Fast Refresh → 增量编译      │    │
│  │  ↓                                          │    │
│  │  WebSocket 推送 → 应用热更新                  │    │
│  └─────────────────────────────────────────────┘    │
│           ↓ (HTTP/WebSocket)                        │
│  ┌─────────────────────────────────────────────┐    │
│  │  模拟器/真机                                  │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │  App Shell 启动                      │    │    │
│  │  │  ↓                                  │    │    │
│  │  │  检测 localhost:8081 是否可达        │    │    │
│  │  │  ↓                                  │    │    │
│  │  │  是 → 从 Dev Server 加载 Bundle      │    │    │
│  │  │  否 → 回退到内置 Bundle             │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**关键特性**：
- **不分 Bundle**：开发时使用全量模式，保持与标准 RN 开发体验一致
- **HMR 支持**：完整的 Hot Module Replacement 和 Fast Refresh
- **构建配置**：不执行分 Bundle 构建，使用标准的 Metro 配置

**Bundle 来源决策**：
```kotlin
// Native Shell 启动时检测
fun shouldUseDevServer(): Boolean {
    // 1. 检查是否启用开发模式（BuildConfig.DEBUG）
    if (!BuildConfig.DEBUG) return false
    
    // 2. 检测 localhost:8081 是否可达
    val reachable = NetworkUtils.isReachable("localhost", 8081, 3000)
    
    // 3. 检测是否连接了模拟器或真机
    val hasActiveDevice = DeviceManager.hasActiveDevice()
    
    return reachable && hasActiveDevice
}
```

#### 2. Pushy Server 模式（集成测试）

**适用场景**：集成测试、灰度验证、生产环境验证

**架构设计**：
```
┌─────────────────────────────────────────────────────┐
│  构建服务器                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  xrn build → 分 Bundle 构建 → .hbc 文件     │    │
│  │  ↓                                          │    │
│  │  xrn publish → 上传 OSS → 通知热更新服务     │    │
│  └─────────────────────────────────────────────┘    │
│           ↓ (HTTP/API)                               │
│  ┌─────────────────────────────────────────────┐    │
│  │  @x-rn/server 热更新服务                      │    │
│  │  版本管理 │ 灰度策略 │ 差量计算 │ 回滚       │    │
│  └─────────────────────────────────────────────┘    │
│           ↓ (CDN)                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │  客户端设备                                  │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │  @x-rn/updater 检查更新              │    │    │
│  │  │  ↓                                  │    │    │
│  │  │  下载 Bundle → bspatch → 安装        │    │    │
│  │  │  ↓                                  │    │    │
│  │  │  更新 manifest → 触发重载             │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**关键特性**：
- **分 Bundle 构建**：严格按照业务模块进行分离打包
- **按需加载**：支持 preload/idle/on-demand 多种加载策略
- **版本管理**：完整的版本控制和灰度发布机制

#### 3. 构建配置传递机制

**配置来源**：
```typescript
// xrn.config.ts - 项目级配置
export default {
  devServer: {
    enabled: true,              // 是否启用 Dev Server 模式
    host: 'localhost',
    port: 8081,
    // 开发模式特定配置
  },
  
  build: {
    output: './dist',
    platform: 'android',       // 目标平台
    // 构建相关配置
  },
  
  modules: {
    home: { 
      entry: './modules/home',
      loadStrategy: 'preload',  // 加载策略传递给 Native Shell
      version: '1.0.0'
    }
  }
}
```

**传递给 Native Shell 的方式**：

1. **通过 manifest.json**（生产模式）：
```json
{
  "modules": {
    "home": {
      "activeVersion": "2.1.0",
      "source": "hot",         // ← 标识 Bundle 来源（hot/builtin）
      "loadStrategy": "preload" // ← 传递给 Native Shell 的加载策略
    }
  }
}
```

2. **通过 BuildConfig (Android) / Info.plist (iOS)**：
- `BuildConfig.XRN_DEV_MODE`: 开发模式标识
- `BuildConfig.XRN_DEV_SERVER_URL`: Dev Server 地址
- `BuildConfig.XRN_BUILD_FLAVOR`: 构建变体（debug/release）

3. **通过 xrn-cli 命令行参数**：
```bash
# 开发模式
npx xrn dev --port 8081 --host localhost

# 生产模式构建
npx xrn build --platform android --output ./dist

# 发布到热更新服务器
npx xrn publish --env production --channel stable
```

#### 4. 模式切换决策流程

```
App 启动时决策流程：
  1. 读取 BuildConfig 判断是否 DEBUG 模式
      ↓
  2. DEBUG = true → 检查 Dev Server 可达性
      ├─ 可达 → 使用 Dev Server 模式
      │      → 所有 Bundle 从 localhost:8081 加载
      │      → 启用 HMR/Fast Refresh
      │
      └─ 不可达 → 回退到生产模式
             → 从本地缓存加载 Bundle
             → hot > builtin 优先级
             → 按加载策略（preload/idle/on-demand）执行
      ↓
  3. DEBUG = false → 直接使用生产模式
      → 从本地缓存加载 Bundle
      → 使用热更新机制检查更新
      → 严格按分 Bundle 架构运行
```

**优势**：
- **开发体验一致**：开发者无需关心分 Bundle 细节，专注业务开发
- **生产环境真实**：测试环境与生产环境架构完全一致
- **平滑过渡**：Debug 和 Release 版本使用同一套代码路径
- **按需切换**：可根据测试需求灵活选择模式

---

## 热更新全流程

→ 详见 [hot-update.md](./hot-update.md#全流程)

---

## 差量更新原理（bsdiff）

→ 详见 [hot-update.md](./hot-update.md#差量更新bsdiff)

---

## 灰度 + 回滚机制

→ 详见 [hot-update.md — 灰度](./hot-update.md#灰度策略) / [回滚](./hot-update.md#回滚机制)

---

## 和 CodePush 的区别

→ 详见 [hot-update.md](./hot-update.md#vs-codepush)

---

# 架构与原理

---

## 核心大件 + 开发全链路覆盖

**Q：XRN 的架构有哪些核心部件？覆盖了开发到运维的哪些环节？**

| 阶段 | 部件 | 做什么 |
|------|------|--------|
| 开发 | @x-rn/cli | create / dev / build / publish 一键命令 |
| 构建 | @x-rn/bundler | Metro 多 entry 分 Bundle + Hermes AOT |
| 发布 | @x-rn/publisher | 上传 OSS + 通知 Server + 触发 diff |
| 分发 | @x-rn/server | 版本管理 + 灰度策略 + 差量计算 + 回滚 |
| 更新 | @x-rn/updater | 客户端：检查更新 / 下载 / bspatch / 生效 |
| 监控 | @x-rn/monitor | JS+Native 采集 → Sentry → 联动回滚 |
| 运行 | Native Shell | 多 Bundle 加载器 + 实例池 + CrashGuard |

= 7 个核心部件，覆盖开发→构建→发布→分发→更新→监控完整闭环。

---

### XRN CLI 功能设计

**Q：XRN 的 CLI 都提供什么功能？已经有了 React Native 的 CLI，为什么还需要 XRN CLI？**

**A**：XRN CLI 是专门为多 Bundle 工程化场景设计的命令行工具，它扩展和增强了标准 RN CLI 的能力。

#### 1. XRN CLI 的核心功能

**完整的开发工作流命令**：

```bash
# 项目初始化
npx @x-rn/cli create <project-name> [options]

# 开发调试
npx xrn dev [--port 8081] [--host localhost]

# 分 Bundle 构建
npx xrn build [--platform android|ios] [--output ./dist]

# 发布到热更新服务
npx xrn publish [--env production] [--channel stable]

# 创建新业务模块
npx xrn module create <module-name> [--entry ./modules/<name>]

# 查看构建状态和版本
npx xrn status [--detail]

# 清理构建缓存
npx xrn clean [--all]
```

**详细功能说明**：

| 命令 | 功能 | 输出 | 与 RN CLI 的关系 |
|------|------|------|------------------|
| `xrn create` | 创建多 Bundle 项目骨架 | 完整的 monorepo 结构 + Native Shell + 配置 | 替代 `react-native init` |
| `xrn dev` | 启动开发服务器 | Metro Dev Server + 开发模式配置 | 增强 `react-native start` |
| `xrn build` | 分 Bundle 构建 | common.hbc + business.hbc 文件 | 新增功能，RN CLI 无对应 |
| `xrn publish` | 发布热更新包 | OSS 上传 + 服务端通知 | 新增功能，RN CLI 无对应 |
| `xrn module` | 模块管理 | 模块模板 + 配置更新 | 新增功能，RN CLI 无对应 |
| `xrn status` | 查看状态 | 构建/发布/部署状态 | 新增功能，RN CLI 无对应 |
| `xrn clean` | 清理缓存 | 删除临时文件 | 类似 `react-native clean` |

#### 2. 为什么需要独立的 XRN CLI？

**2.1 填补 RN CLI 的功能空白**

| 需求场景 | RN CLI 能力 | XRN CLI 解决方案 |
|----------|------------|------------------|
| **多 Bundle 构建** | 不支持 | `xrn build` 实现分 Bundle 打包 |
| **模块独立热更新** | 不支持 | `xrn publish` 支持模块级发布 |
| **企业级工程化** | 基础功能 | 完整的 CI/CD 集成 |
| **版本管理** | 无 | 完整的版本控制和灰度策略 |

**2.2 统一的多 Bundle 开发体验**

**标准 RN 开发流程的问题**：
```bash
# 标准 RN 开发（单 Bundle）
react-native start           # 启动 Metro
react-native run-android     # 运行 Android
react-native run-ios         # 运行 iOS

# 问题：
# 1. 无法处理多 Bundle 场景
# 2. 开发和生产构建不一致
# 3. 缺少热更新发布能力
```

**XRN 统一开发流程**：
```bash
# 开发阶段（无感知分 Bundle）
xrn dev                     # 启动开发服务器
                            # → 自动检测设备连接
                            # → 智能决策 Bundle 来源

# 构建阶段（严格分 Bundle）
xrn build --platform android
                            # → 构建 common bundle
                            # → 构建所有业务 bundle
                            # → Hermes 字节码编译

# 发布阶段（企业级发布）
xrn publish --env staging
                            # → 上传 OSS/S3
                            # → 通知热更新服务器
                            # → 触发灰度发布
```

**2.3 配置管理自动化**

**XRN CLI 自动管理的配置**：

1. **项目级配置** (`xrn.config.ts`)：
```typescript
// 自动生成和维护
export default {
  modules: {
    home: { entry: './modules/home', loadStrategy: 'preload' },
    order: { entry: './modules/order', loadStrategy: 'on-demand' }
  },
  devServer: { port: 8081, host: 'localhost' },
  build: { output: './dist', platform: 'android' }
}
```

2. **Native 配置同步**：
```bash
# 构建时自动生成 Native 配置
xrn build --platform android
# ↓
# 自动更新：
# - android/app/build.gradle（Bundle 路径配置）
# - ios/Info.plist（Bundle 版本信息）
# - Native Shell manifest 模板
```

3. **CI/CD 集成配置**：
```yaml
# .github/workflows/xrn-ci.yml（自动生成）
name: XRN CI/CD
on: [push, pull_request]
jobs:
  build-and-publish:
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @x-rn/cli
      - run: xrn build --platform android
      - run: xrn publish --env ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
```

#### 3. 技术架构设计

**3.1 模块化架构**

```
@x-rn/cli/
├── src/
│   ├── commands/
│   │   ├── create.ts        # 项目创建
│   │   ├── dev.ts          # 开发服务器
│   │   ├── build.ts        # 构建命令
│   │   ├── publish.ts      # 发布命令
│   │   └── module.ts       # 模块管理
│   ├── utils/
│   │   ├── config-loader.ts # 配置加载
│   │   ├── metro-helper.ts  # Metro 集成
│   │   └── platform-check.ts # 平台检测
│   └── templates/          # 项目模板
│       ├── android-shell/  # Android 壳模板
│       ├── ios-shell/      # iOS 壳模板
│       └── module-template/ # 业务模块模板
```

**3.2 与 RN CLI 的集成关系**

```typescript
// XRN CLI 内部调用 RN CLI 的示例
import { runReactNativeCommand } from '@react-native-community/cli'

class XRNDevCommand {
  async execute(options: DevOptions) {
    // 1. 检查开发环境
    await this.checkEnvironment()
    
    // 2. 准备 XRN 特定配置
    await this.prepareXRNConfig()
    
    // 3. 调用 RN CLI 的 start 命令（增强版）
    await runReactNativeCommand('start', {
      port: options.port,
      host: options.host,
      // 添加 XRN 特定的 Metro 配置
      config: this.getEnhancedMetroConfig()
    })
    
    // 4. 启动额外的 XRN 服务
    await this.startXRNServices()
  }
}
```

**3.3 智能决策逻辑**

```typescript
// Bundle 来源智能决策
class BundleSourceDecision {
  async decideSource(): Promise<BundleSource> {
    // 1. 检查是否为开发模式
    if (process.env.NODE_ENV === 'development') {
      // 2. 检测 Dev Server 是否可达
      const devServerReachable = await this.checkDevServer()
      
      if (devServerReachable) {
        return BundleSource.DEV_SERVER
      }
    }
    
    // 3. 检查是否有热更新包
    const hasHotUpdate = await this.checkHotUpdate()
    if (hasHotUpdate) {
      return BundleSource.HOT_UPDATE
    }
    
    // 4. 回退到内置包
    return BundleSource.BUILTIN
  }
}
```

#### 4. 开发体验优化

**4.1 零配置启动**

```bash
# 开发者只需：
xrn dev

# CLI 自动完成：
# 1. 检测当前目录是否为 XRN 项目
# 2. 加载 xrn.config.ts 配置
# 3. 启动 Metro Dev Server（增强配置）
# 4. 检测连接设备并建立通信
# 5. 启动 Bundle 加载决策服务
```

**4.2 错误友好提示**

```bash
# 当配置错误时
$ xrn build
❌ 错误：缺少 xrn.config.ts 配置文件

建议执行以下操作：
1. 运行 `xrn init` 初始化配置
2. 或手动创建 xrn.config.ts 文件

参考配置模板：
module.exports = {
  modules: {
    home: { entry: './modules/home' }
  }
}
```

**4.3 渐进式迁移支持**

```bash
# 从标准 RN 项目迁移到 XRN
$ xrn migrate --from react-native

正在分析项目结构...
�� 检测到 React Native 项目
✅ 检测到 Android/iOS 原生代码
✅ 检测到业务模块结构

迁移步骤：
1. 创建 xrn.config.ts 配置文件
2. 添加 Native Shell 依赖
3. 配置多 Bundle 构建
4. 更新 CI/CD 流程

是否继续？ [Y/n]
```

#### 5. 企业级特性

**5.1 多环境支持**

```bash
# 不同环境的构建和发布
xrn build --env development    # 开发环境
xrn build --env staging       # 测试环境  
xrn build --env production    # 生产环境

# 对应不同的配置：
# - development: 调试符号、未压缩代码
# - staging: 部分压缩、测试数据
# - production: 完全优化、生产数据
```

**5.2 灰度发布管理**

```bash
# 灰度发布命令
xrn publish --channel canary --percentage 5
# → 发布到 canary 通道，5% 灰度

xrn publish --channel stable --rollout 30
# → 发布到 stable 通道，30% 逐步放量

# 查看灰度状态
xrn status --channel canary
# 显示：
# - 下载用户数
# - 崩溃率统计
# - 性能指标
```

**5.3 审计和安全**

```bash
# Bundle 安全校验
xrn audit --bundle ./dist/home.hbc
# 检查：
# - 代码签名
# - 依赖漏洞
# - 敏感信息泄露

# 发布审批流程
xrn publish --require-approval
# → 生成发布申请
# → 等待审批通过
# → 自动执行发布
```

#### 6. 总结：XRN CLI 的价值

**对比维度**：

| 维度 | React Native CLI | XRN CLI |
|------|-----------------|---------|
| **架构支持** | 单 Bundle | 多 Bundle + 模块化 |
| **开发体验** | 基础调试 | 智能决策 + 零配置 |
| **构建能力** | 基础构建 | 分 Bundle + Hermes 优化 |
| **发布流程** | 无 | 完整的热更新发布 |
| **企业特性** | 基础功能 | 灰度 + 审计 + 安全 |
| **工程化** | 项目创建 | 全链路工程化 |

**核心价值主张**：

1. **标准化多 Bundle 开发**：统一团队的多 Bundle 开发规范
2. **降低工程化门槛**：开发者无需关心底层分 Bundle 细节
3. **提升发布效率**：一键完成构建、上传、发布、监控全流程
4. **保障发布安全**：内置审计、审批、回滚等企业级特性
5. **未来扩展性**：插件化架构支持自定义命令和工具链

**一句话总结**：XRN CLI 不是要替代 RN CLI，而是在多 Bundle 工程化场景下**扩展和增强** RN CLI 的能力，提供企业级 React Native 开发的全套工具链。

---

## 分 Bundle 加载时序

**Q：Native 壳启动时，Common 和 Business Bundle 的加载时序？**

```
1. Native 壳启动（Application.onCreate）
2. 创建 ReactHost（RN 引擎）
3. 同步加载 Common Bundle（common.hbc）— 必须先加载
4. Common 就绪 → RN Runtime 可用
5. 按策略加载 Business Bundle：
   → preload：立即异步（首页/搜索）
   → idle：主线程空闲时
   → onDemand：用户触发时
6. Business Bundle 加载 = 注册 RN 组件到 AppRegistry
7. Native 路由跳转 → AppRegistry 找到组件 → ReactRootView 渲染
```

```kotlin
// Android 实现（简化）
class XRNApplication : Application() {
  override fun onCreate() {
    reactHost = ReactHost.create(this, config)
    reactHost.loadBundle("common.hbc", synchronous = true)
    // 延迟预热实例池
    Handler().postDelayed({ instancePool.warmUp() }, 3000)
  }
}
```

---

## Native 壳多 Bundle 文件管理

**Q：本地多版本 Bundle 怎么管理？启动时加载哪个？**

```
/data/data/com.app/files/xrn/
├── common/v1.0.0/common.hbc
├── home/v2.3.0/home.hbc
├── home/v2.3.1/home.hbc     ← pending
└── manifest.json

manifest.json:
  { "home": { "current": "v2.3.0", "pending": "v2.3.1", "fallback": "builtin" } }

加载决策：
  1. 有 pending → 尝试加载
  2. 成功 → pending 变 current
  3. 失败/crash → 回退 fallback
  4. fallback 也挂 → 加载 APK 内置 builtin
```

---

## 性能监控（Native 侧）

**Q：RN App 性能监控，Native 侧怎么采集？**

| 平台 | 指标 | 采集方式 |
|------|------|---------|
| **Android** | FPS | Choreographer.FrameCallback |
| | ANR | 主线程 Watchdog（超时检测） |
| | Crash | UncaughtExceptionHandler + Signal Handler |
| | 内存 | Debug.getMemoryInfo() |
| | 启动 | ContentProvider.onCreate → reportFullyDrawn |
| **iOS** | FPS | CADisplayLink |
| | 卡顿 | RunLoop Observer |
| | Crash | PLCrashReporter |
| | 内存 | task_info(MACH_TASK_BASIC_INFO) |
| | 启动 | main() → viewDidAppear |
| **RN 特有** | JS Error | ErrorUtils.setGlobalHandler |
| | Bundle 加载时间 | loadScriptFromFile 前后打点 |
| | 首屏渲染 | ReactMarker(CONTENT_APPEARED) |

---

# 稳定性保障

> RN App 稳定性 = 发布前防 + 发布中控 + 发布后治。用户永远能看到一个可用版本。

---

## 白屏检测

**Q：如何检测到 RN 白屏？**

```
方案 A（主方案）：超时检测
  → ReactRootView 创建后启动 5s 定时器
  → 监听 ReactMarker.CONTENT_APPEARED
  → 5s 未收到 = 白屏 → 降级页 + 上报

方案 B（兜底）：View 树检测
  → childCount == 0 超过阈值 = 白屏

方案 C（离线分析）：像素采样
  → 截图 → > 95% 同色 = 白屏
```

---

## 热更新后 crash/白屏处理（CrashGuard）

**Q：热更新后出现 crash/白屏，XRN 怎么处理？**

```
三层防线：

Layer 1：客户端 CrashGuard
  → 启动递增 crash 计数器
  → 正常运行 5s → 清零
  → 连续 crash 2 次 → 回退 fallback → 上报

Layer 2：白屏降级
  → 5s 超时 → Native 降级页 + 上报

Layer 3：服务端停灰度
  → crash 率 > 0.5% → 自动停止推送
  → 已下载用户靠 CrashGuard 回退
```

**Q：CrashGuard + 回退机制的具体设计和实现是怎样的？**

**A**：XRN 的 CrashGuard 是一个完整的稳定性保障体系，包含客户端检测、服务端联动和自动回退机制。

### 1. 客户端 CrashGuard 设计

#### 1.1 核心原理

```kotlin
// XRNCrashGuard.kt 核心实现
class XRNCrashGuard(private val context: Context, private val bundleManager: BundleManager) {
    companion object {
        private const val TAG = "XRNCrashGuard"
        
        // 崩溃阈值配置
        private const val CRASH_THRESHOLD = 2    // 连续崩溃 2 次触发回退
        private const val STABLE_THRESHOLD = 5000L // 稳定运行 5 秒清零计数器
    }

    /** 应用启动时调用 */
    fun onAppStart() {
        // 读取当前崩溃计数
        val manifest = bundleManager.getManifest()
        val currentCrashCount = manifest.crashCount
        
        // 检查是否需要回退
        if (currentCrashCount >= CRASH_THRESHOLD) {
            Log.w(TAG, "触发自动回退：连续崩溃 $currentCrashCount 次")
            triggerRollback()
            return
        }
        
        // 递增崩溃计数器
        val updatedManifest = manifest.copy(
            crashCount = currentCrashCount + 1,
            lastCrashTimestamp = System.currentTimeMillis()
        )
        bundleManager.updateManifest(updatedManifest)
        
        Log.d(TAG, "应用启动，崩溃计数器: ${currentCrashCount + 1}")
    }

    /** 应用稳定运行后调用（通常在首屏渲染完成 5 秒后） */
    fun onAppStable() {
        val manifest = bundleManager.getManifest()
        if (manifest.crashCount > 0) {
            val updatedManifest = manifest.copy(
                crashCount = 0,
                lastCrashTimestamp = null
            )
            bundleManager.updateManifest(updatedManifest)
            Log.i(TAG, "应用稳定运行，清零崩溃计数器")
        }
    }

    /** 触发自动回退 */
    private fun triggerRollback() {
        // 1. 清空 hot 目录（删除所有热更新包）
        bundleManager.clearHotDirectory()
        
        // 2. 重置 manifest 为 builtin 版本
        val manifest = bundleManager.getManifest()
        val updatedManifest = buildRollbackManifest(manifest)
        bundleManager.updateManifest(updatedManifest)
        
        // 3. 上报回退事件（等待 @x-rn/updater 集成后）
        reportRollbackEvent()
        
        Log.i(TAG, "自动回退完成，已回退到 builtin 版本")
    }
}
```

#### 1.2 崩溃检测机制

**Android 平台**：
```kotlin
// 通过 Thread.setDefaultUncaughtExceptionHandler 捕获崩溃
class XRNExceptionHandler(private val crashGuard: XRNCrashGuard) : Thread.UncaughtExceptionHandler {
    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    
    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        // 1. 记录崩溃信息
        val crashInfo = CrashInfo(
            timestamp = System.currentTimeMillis(),
            threadName = thread.name,
            throwable = throwable,
            stackTrace = throwable.stackTraceToString()
        )
        
        // 2. 持久化崩溃日志（用于后续分析）
        persistCrashLog(crashInfo)
        
        // 3. 触发 CrashGuard 处理
        crashGuard.onCrashDetected()
        
        // 4. 传递给默认处理器（触发应用重启）
        defaultHandler?.uncaughtException(thread, throwable)
    }
}
```

**iOS 平台**：
```swift
// 通过 NSSetUncaughtExceptionHandler 捕获 Objective-C 异常
NSSetUncaughtExceptionHandler { exception in
    // 1. 记录崩溃信息
    let crashInfo = [
        "name": exception.name.rawValue,
        "reason": exception.reason ?? "unknown",
        "callStackSymbols": exception.callStackSymbols,
        "timestamp": Date().timeIntervalSince1970
    ]
    
    // 2. 持久化崩溃日志
    persistCrashLog(crashInfo)
    
    // 3. 触发 CrashGuard 处理
    XRNCrashGuard.shared.onCrashDetected()
}
```

#### 1.3 白屏检测机制

**方案 A：ReactMarker 超时检测（主方案）**
```kotlin
class WhiteScreenDetector(private val context: Context) {
    private var timer: CountDownTimer? = null
    private const val WHITE_SCREEN_TIMEOUT = 5000L // 5 秒超时
    
    fun startDetection(rootView: ReactRootView) {
        // 启动 5 秒定时器
        timer = object : CountDownTimer(WHITE_SCREEN_TIMEOUT, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                // 每秒检查一次
            }
            
            override fun onFinish() {
                // 5 秒后仍未收到 CONTENT_APPEARED 事件
                if (!hasContentAppeared) {
                    handleWhiteScreen()
                }
            }
        }.start()
        
        // 监听 ReactMarker 事件
        setupReactMarkerListener()
    }
    
    private fun setupReactMarkerListener() {
        // 监听 CONTENT_APPEARED 事件
        ReactMarker.addListener(
            ReactMarkerConstants.CONTENT_APPEARED
        ) { markerName, tag, timestamp ->
            timer?.cancel()
            hasContentAppeared = true
        }
    }
    
    private fun handleWhiteScreen() {
        // 1. 显示降级页面
        showDegradePage()
        
        // 2. 上报白屏事件
        reportWhiteScreenEvent()
        
        // 3. 触发回退检查
        XRNCrashGuard.getInstance().onWhiteScreenDetected()
    }
}
```

**方案 B：View 树检测（兜底方案）**
```kotlin
fun checkViewTree(rootView: View): Boolean {
    // 检查 View 树是否为空
    return if (rootView is ViewGroup) {
        val childCount = rootView.childCount
        if (childCount == 0) {
            // 连续多次检测为空才判定为白屏
            emptyCheckCount++
            emptyCheckCount >= 3
        } else {
            emptyCheckCount = 0
            false
        }
    } else {
        false
    }
}
```

### 2. 服务端联动机制

#### 2.1 崩溃率监控

**服务端 API**：
```typescript
// @x-rn/server 的崩溃上报接口
POST /api/v1/crash/report
{
  "appId": "com.example.app",
  "version": "2.1.0",
  "bundleId": "order",
  "platform": "android",
  "crashType": "native", // native/js/white_screen
  "crashInfo": {
    "timestamp": 1640995200000,
    "stackTrace": "...",
    "deviceInfo": { ... }
  }
}
```

#### 2.2 自动停止灰度策略

```typescript
// 服务端灰度策略管理
class GrayscaleManager {
  async checkAndStopGrayscale(bundleId: string, version: string): Promise<boolean> {
    // 1. 查询该版本的最新崩溃率
    const crashRate = await this.getCrashRate(bundleId, version)
    
    // 2. 判断是否超过阈值
    if (crashRate > 0.5) { // 0.5% 阈值
      // 3. 停止灰度推送
      await this.stopGrayscale(bundleId, version)
      
      // 4. 通知所有已下载用户回退
      await this.notifyClientsToRollback(bundleId, version)
      
      return true
    }
    
    return false
  }
}
```

### 3. 自动回退机制

#### 3.1 客户端回退流程

```
检测到需要回退
    │
    ▼
读取当前 manifest 中的崩溃计数
    │
    ▼
判断是否达到阈值 (crashCount >= 2)
    │
    ├─ 否 → 记录崩溃，等待下一次启动
    │
    └─ 是 → 触发自动回退
           ↓
       清空 hot/ 目录
           ↓
       重置 manifest
           ↓
       上报回退事件
           ↓
       下次启动使用 builtin 版本
```

#### 3.2 回退 manifest 构建

```kotlin
private fun buildRollbackManifest(manifest: BundleManifest): BundleManifest {
    // 1. common 回退到 builtin
    val rolledBackCommon = manifest.common.copy(
        source = BundleSource.BUILTIN,
        activeVersion = manifest.common.builtinVersion
    )
    
    // 2. 所有业务模块回退到 builtin
    val rolledBackModules = manifest.modules.mapValues { (_, entry) ->
        entry.copy(
            source = BundleSource.BUILTIN,
            activeVersion = entry.builtinVersion
        )
    }
    
    // 3. 重置崩溃计数和记录回退时间
    return manifest.copy(
        common = rolledBackCommon,
        modules = rolledBackModules,
        crashCount = 0,
        lastCrashTimestamp = null,
        lastRollbackTimestamp = System.currentTimeMillis()
    )
}
```

### 4. 多层防御体系

#### 4.1 发布前防御（Prevention）
```yaml
CI/CD 质量门禁：
  - Lint 检查: ESLint + TypeScript 类型检查
  - 单元测试: 覆盖率 > 80%
  - Bundle 哈希校验: 确保 Bundle 完整性
  - 兼容性测试: 多设备、多系统版本
```

#### 4.2 发布中控制（Control）
```yaml
灰度发布策略：
  - 第一阶段: 5% 内部用户
  - 第二阶段: 30% 灰度用户（崩溃率 < 0.1%）
  - 第三阶段: 100% 全量（崩溃率 < 0.05%）
  
自动停止条件：
  - Crash 率 > 0.5%
  - 白屏率 > 2%
  - ANR 率 > 0.3%
```

#### 4.3 发布后恢复（Recovery）
```yaml
恢复策略分级：
  - P0 故障（Crash 率 > 2%）: 立即全量回滚 + 5 Why 分析
  - P1 故障（Crash 率 > 0.5%）: 停止灰度 + hotfix 修复
  - P2 问题（Crash 率 > 0.3%）: 监控观察 + 下个版本修复
  
恢复时间目标（RTO）：
  - P0: < 15 分钟
  - P1: < 2 小时
  - P2: < 24 小时
```

### 5. 与热更新的协同机制

#### 5.1 静默加载验证

```
热更新包下载完成
    │
    ▼
解压到临时目录
    │
    ▼
哈希校验 + 完整性检查
    │
    ▼
静默加载测试（不激活）
    │
    ├─ 失败 → 删除临时文件，上报失败
    │
    └─ 成功 → 移动到 hot/ 目录
           ↓
       更新 manifest（标记为 pending）
           ↓
       下次启动时尝试激活
```

#### 5.2 版本保留策略

```kotlin
// 保留多个版本供回退使用
fun cleanOldVersions(bundleId: String, keepLatest: Int = 2) {
    val bundleDir = if (bundleId == "common") {
        File(hotDir, "common")
    } else {
        File(hotDir, "modules/$bundleId")
    }
    
    // 获取所有版本目录
    val versionDirs = bundleDir.listFiles { file ->
        file.isDirectory && file.name.startsWith("v")
    }?.sortedByDescending { it.name }
    
    // 保留最新的 keepLatest 个，删除旧的
    versionDirs?.drop(keepLatest)?.forEach { dir ->
        dir.deleteRecursively()
    }
}
```

### 6. 优势总结

**XRN CrashGuard 的差异化优势**：

| 维度 | CRN | XRN |
|------|-----|-----|
| **崩溃阈值** | 3 次 | 2 次（更敏感） |
| **检测维度** | 崩溃检测 | 崩溃 + 白屏 + ANR 多维度 |
| **回退策略** | 版本回退 | 分层回退 + 服务端联动 |
| **恢复速度** | 用户重启 | 自动回退 + 即时生效 |
| **监控粒度** | 应用级 | Bundle 级（模块独立监控） |

**一句话总结**：XRN 的 CrashGuard 是一个**主动防御、快速响应、智能回退**的稳定性保障体系，确保热更新这种高风险发布模式的可用性。

**CRN vs XRN**：

| | CRN | XRN |
|--|-----|-----|
| crash 阈值 | 3 次 | 2 次（更激进） |
| 白屏检测 | ReactMarker 超时 | ReactMarker + childCount 双重 |
| 版本保留 | 最近 3 个 | current + fallback + builtin |

---

## 稳定性保障全景

```
发布前（Prevention）：
  - ErrorBoundary 包裹每个页面
  - TypeScript 类型约束
  - CI 门禁（Lint + Test + hash 校验）

发布中（Control）：
  - 灰度 5% → 30% → 100%
  - crash > 0.5% → 自动停灰度
  - 热更新：hash 校验 → silent load → 才生效

发布后（Recovery）：
  | 指标      | 正常    | P1     | P0     |
  |-----------|---------|--------|--------|
  | Crash 率  | < 0.3% | > 0.5% | > 2%   |
  | ANR 率    | < 0.1% | > 0.3% | > 1%   |
  | 白屏率    | < 0.5% | > 2%   | > 5%   |
  | JS Error  | < 0.1% | > 0.5% | > 2%   |

  自动：CrashGuard 回退 + Server 停灰度
  人工：P0 回滚 / P1 hotfix / 5 Why 复盘
```

**一句话**：三阶段分层防御，用户永远有兜底版本。

---

# 选型与生态

---

## 为什么不选 Expo

| 原因 | 详细 |
|------|------|
| 不支持分 Bundle | 单 Bundle 架构，无法模块独立热更新 |
| Native 层不可控 | 无法自定义加载器/实例池/CrashGuard |
| 热更新粒度粗 | EAS Update 整包更新，不支持模块级灰度 |
| 构建依赖云端 | EAS Build 付费 + 排队 |

```
Expo = "帮你管 Native，你别碰"
XRN = "Native 层是核心能力，必须自己控制"
```

---

## Expo 对 XRN 的启发

| Expo 优点 | XRN 吸收 |
|-----------|----------|
| CLI 极简 | `xrn create/publish` 一行搞定 |
| OTA 内置 | @x-rn/updater 接入 3 行代码 |
| Config Plugin | `xrn.config.ts` 统一声明，不改 Native |
| 云端构建 | CI 模板：push 即构建即发布 |
| 文档驱动 | 先写 PRD/Architecture，代码跟文档走 |

---

## Push Server 部署方案

**结论：自建代码 + 云上部署 = 最优解。**

```
为什么自建（而非 CodePush/EAS）：
  - 分 Bundle 粒度第三方不支持
  - 灰度策略是业务强相关
  - 自动回滚需和 CrashGuard 上报联动
  - 数据可控不出境

为什么云上（而非自建机房）：
  - CDN 天然需要云（Bundle 分发就是 CDN 场景）
  - OSS 弹性存储 + 运维少
  - 成本低（¥500/月）

技术栈：Fastify + PostgreSQL + S3/OSS
推荐：代码自建（@x-rn/server）+ 云部署（ECS + OSS + CDN + RDS）
核心 API 3 天，生产级全套 2-3 周。
```

---

## 可观测体系是必须的

**结论：可观测不是锦上添花，是热更新体系的必要组件。**

```
为什么"必须"：
  - 热更新 = 高风险发布（不经应用商店审核）
  - CrashGuard 自动回滚依赖上报数据
  - 灰度"阈值停灰度"依赖 crash 率统计
  - 没有监控的热更新 = 盲人开车

@x-rn/monitor 的定位：
  不是替代 Sentry，而是：
  1. 封装 Sentry SDK（统一 API + 扩展 Bundle 特有指标）
  2. 和热更新联动（新版本 crash → 触发回滚）
  3. 和 Server 联动（上报 → Server 判断停灰度）

= 可观测是热更新闭环的一环，不是独立的东西
```

→ 详细设计方案见 [observability.md — @x-rn/monitor 设计方案](./observability.md#x-rnmonitor-设计方案)

---
