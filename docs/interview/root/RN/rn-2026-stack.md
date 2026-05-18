

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

### 推荐目标：0.76+

### 升级收益

| 收益 | 说明 |
|------|------|
| 新架构默认开启 | JSI/TurboModule/Fabric，通信性能提升 |
| TurboModule 懒加载 | 启动更快 |
| 同步方法支持 | BLE 状态查询可同步返回 |
| Fabric 并发渲染 | UI 更流畅 |
| Codegen 类型安全 | 编译时发现接口错误 |
| Hermes 稳定 | 启动快 + 内存低 |

### 如何升级

```
1. 用官方 upgrade-helper 对比差异（当前版本 → 目标版本，逐文件 diff）
2. 升级 package.json 中 react-native 版本
3. 按 diff 修改 android/ 和 ios/ 配置
4. 升级所有第三方库到兼容版本
5. 跑构建 + 测试
```

### 风险控制

- 分支上升级，不动主干
- 逐个解决第三方库兼容（查 reactnative.directory）
- 新架构兼容层保证旧 Native Module 仍能跑
- 灰度发布验证

**最大的坑不是 RN 本身，是第三方库兼容性。** 升级前先盘点所有依赖。

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
