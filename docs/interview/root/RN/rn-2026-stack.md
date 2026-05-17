

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
