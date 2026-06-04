# 多 Bundle 加载方案选型：共享 Runtime vs 多实例

> 核心问题：多个 business bundle 和 common bundle 之间，是共享一个 JS Runtime，还是每个页面独立一个 Runtime？

---

## 目录

- [两种方案概览](#两种方案概览)
- [方案 A：共享 Runtime（单实例）](#方案-a共享-runtime单实例)
- [方案 B：多实例 + 实例池](#方案-b多实例--实例池)
- [核心对比](#核心对比)
- [Common 包公共依赖怎么给 Business 用？](#common-包公共依赖怎么给-business-用)
- [选型决策](#选型决策)
- [业界实践](#业界实践)

---

## 两种方案概览

```
方案 A：共享 Runtime（单实例）
  一个 ReactInstance（一个 Hermes Runtime）
    → 先加载 common.hbc
    → 按需追加加载 home.hbc / device.hbc / settings.hbc
    → 所有 Bundle 共享 global，直接通信
    → 页面切换由 JS 侧 React Navigation 管理

方案 B：多实例 + 实例池
  每个页面独立 ReactInstance（独立 Hermes Runtime）
    → ReactInstance 1：common.hbc + home.hbc
    → ReactInstance 2：common.hbc + device.hbc
    → ReactInstance 3：common.hbc + settings.hbc
    → 各实例 JS 层互不可见
    → 页面切换由 Native Router 管理
```

---

## 方案 A：共享 Runtime（单实例）

### 工作原理

```
App 启动
  → 创建一个 ReactInstance
  → 加载 common.hbc（React/Zustand/工具库注册到 global）
  → 用户进入首页 → 追加执行 home.hbc（从 global 读取公共依赖）
  → 用户进入设备页 → 追加执行 device.hbc
  → 所有 bundle 在同一个 JS 上下文中，可直接 import/调用
```

### 优势

- **内存低**：只有一个 JS 堆，公共依赖只初始化一次
- **通信简单**：同一个 global，bundle 之间直接调用函数/读写变量
- **无 Provider 重复**：React Context / 状态管理只需一套
- **导航简单**：React Navigation 管所有页面，和普通 RN App 一样

### 劣势

- **无隔离**：一个 bundle 的 JS Error / crash 影响整个 App
- **全局污染风险**：多团队开发可能踩到同名变量/模块冲突
- **卸载困难**：bundle 加载后无法从 Runtime 中"卸载"（没有 module unload 机制）
- **内存只增不减**：用过的页面代码留在内存里（除非 App 重启）

### 适合场景

- 中小型 App（业务模块 < 10 个）
- 单团队开发（不怕全局冲突）
- 对内存敏感（低端设备）
- 不需要模块级隔离/独立发版

---

## 方案 B：多实例 + 实例池

### 工作原理

```
App 启动
  → 实例池预热：创建 2-3 个 ReactInstance，各自加载 common.hbc
  → 用户进入首页 → 从池中取一个实例 → 追加执行 home.hbc
  → 用户进入设备页 → 从池中取另一个实例 → 追加执行 device.hbc
  → 每个实例有独立的 JS 堆、独立的 React 树
  → 页面关闭 → 实例回收到池中复用
```

### 优势

- **完全隔离**：一个页面 crash 不影响其他页面（各自独立 Runtime）
- **多团队安全**：全局命名空间互不干扰
- **可卸载**：页面关闭 → 销毁实例 → 内存完全释放
- **独立发版**：每个 bundle 可独立热更新，不影响其他模块
- **生产验证**：CRN / MRN / KRN 均采用

### 劣势

- **内存较高**：每个实例有独立 JS 堆（~30-50MB），需要实例池 LRU 控制
- **通信需中转**：跨实例通信必须经 Native（EventBus / MMKV / 路由参数）
- **Provider 重复**：每个实例各自包裹一套 React Context
- **common 重复加载**：每个实例都要执行一次 common.hbc

### Common 重复加载的成本分析

| 层面 | 是否真的"重复" | 说明 |
|------|---------------|------|
| 文件 I/O | ❌ 不重复 | .hbc 通过 mmap 加载，OS 缓存命中率极高 |
| 代码段（只读）| ❌ 不重复 | mmap 同一个文件 → 物理内存页共享（OS 级别去重） |
| JS 堆（状态）| ✅ 重复 | 每个实例初始化各自的 React / 工具库状态 → 这是隔离的代价 |
| 执行时间 | ⚠️ 有成本 | 每个实例首次执行 common.hbc ~100-200ms → 用实例池预热抵消 |

### 适合场景

- 大型 App（10+ 业务模块，多团队协作）
- 需要模块级隔离（一个模块 crash 不能拖垮全 App）
- 需要独立发版/热更新（按模块灰度）
- IoT App（BLE 页面 crash 不能影响首页）

---

## 核心对比

| 维度 | 方案 A（共享 Runtime） | 方案 B（多实例） |
|------|----------------------|----------------|
| 隔离性 | ❌ 无隔离 | ✅ 完全隔离 |
| 内存 | ✅ 低（一个 JS 堆） | ⚠️ 高（多个 JS 堆，池化控制） |
| 通信 | ✅ 直接调用（同 global） | ⚠️ 需 Native 中转 |
| Crash 影响范围 | 整个 App | 单个页面 |
| 独立发版 | ⚠️ 困难（共享状态可能冲突） | ✅ 天然支持 |
| 模块卸载 | ❌ 无法卸载 | ✅ 销毁实例即释放 |
| 导航 | JS 层 React Navigation | Native Router |
| 开发复杂度 | 低 | 中（需要 Native 路由 + 通信层） |
| 多团队协作 | ⚠️ 易冲突 | ✅ 天然隔离 |
| 业界案例 | 小型 App / 早期方案 | CRN / MRN / KRN |

---

## Common 包公共依赖怎么给 Business 用？

两种方案下处理方式不同：

### 方案 A（共享 Runtime）

```
加载顺序：common.hbc → home.hbc
common 执行后把 React / 工具库注册到 global
home.hbc 构建时通过 Metro externals 排除这些依赖
运行时从 global 读取

本质：同一个 <script> 标签的两个文件，后者依赖前者已注册的全局变量
```

### 方案 B（多实例）

```
每个 ReactInstance 内部：
  1. 先执行 common.hbc → 公共依赖注册到该实例的 global
  2. 再追加执行 business.hbc → 从该实例的 global 读取

和方案 A 相同，只是"每个实例各自做一次"。
代码段物理内存共享（mmap），JS 堆各自独立。
```

### 构建时怎么做

```javascript
// metro.config.js — business bundle 排除 common 依赖
module.exports = {
  serializer: {
    createModuleIdFactory: () => (path) => {
      // common 里的模块用固定 ID，business 里不重复打包
    },
  },
};

// 或用 Metro 的 --config + external modules 配置
// business.hbc 里不包含 react / react-native / zustand 等
// 运行时这些模块从 common.hbc 已注册的 module registry 读取
```

---

## 选型决策

### XRN 选方案 B 的理由

1. **IoT 场景需要隔离**：BLE 设备控制页面如果 crash，不能影响首页和设置页
2. **独立热更新**：device bundle 修了 BLE bug → 只热更 device.hbc → 不影响其他模块
3. **多团队协作**：未来团队扩大后，各团队负责各自的 bundle，互不干扰
4. **CRN/MRN/KRN 验证**：大厂生产环境跑了多年，方案成熟

### 什么时候选方案 A

- 初创团队 / MVP 阶段 / 单人开发
- App 简单（< 5 个页面）
- 内存极度敏感（低端设备 1GB RAM）
- 不需要模块级热更新

---

## 业界实践

| 公司 | 方案 | 说明 |
|------|------|------|
| **携程 CRN** | B（多实例） | 实例池 + Native 路由 |
| **美团 MRN** | B（多实例） | 实例池 + 模块隔离 |
| **快手 KRN** | B（多实例） | 类似 CRN |
| **58 同城** | A → B 演进 | 早期共享，后来因为稳定性问题改为多实例 |
| **小型 App** | A（共享） | 够用，不需要复杂度 |
