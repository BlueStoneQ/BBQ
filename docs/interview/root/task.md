# 考察点清单（从 JD1 + JD2 挖掘）

> 逐个过，有答案的链接文档，没答案的补上。

---

## 一、技术架构与规划（JD1-1）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 1.1 | 你怎么做技术规划？短期/中期/长期怎么分？ | ✅ | [prep.md](./prep.md) 职责 1 部分 |
| 1.2 | 怎么评估一个新技术要不要引入？ | ✅ | 三维度：业务收益/迁移成本/团队能力 |
| 1.3 | RN 新架构升级你怎么规划？ | ✅ | [rn-native-communication.md](./RN/rn-native-communication.md) 第九节 |

---

## 二、RN 基础架构升级 + 工程化（JD1-2）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 2.1 | 分 Bundle 怎么做？运行时怎么加载？ | ✅ | [architecture-engineering.md](./RN/architecture-engineering.md) 第三/八/九/十节 |
| 2.2 | 热更新方案怎么设计？ | ✅ | [architecture-engineering.md](./RN/architecture-engineering.md) 第四/七节 |
| 2.3 | CLI 脚手架怎么设计？ | ✅ | [architecture-engineering.md](./RN/architecture-engineering.md) 第九节 |
| 2.4 | 组件体系怎么建？ | ⚠️ | 有方向但没展开（Design System/通用组件/业务组件） |
| 2.5 | monorepo 怎么组织？ | ✅ | [architecture-engineering.md](./RN/architecture-engineering.md) 第二节 |

---

## 三、性能与质量（JD1-3）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 3.1 | 启动优化怎么做？ | ✅ | [performance.md](./RN/performance.md) 启动优化完整链路 |
| 3.2 | 列表卡顿怎么优化？ | ✅ | [performance.md](./RN/performance.md) 列表优化 |
| 3.3 | 内存泄漏怎么排查？ | ✅ | [debugging-issues.md](./RN/debugging-issues.md) 场景 3 |
| 3.4 | 你做过的性能优化案例？ | ✅ | [prep.md](./prep.md) P0-1 三个故事 |
| 3.5 | 怎么建性能监控体系？ | ✅ | [firebase-ops.md](./RN/firebase-ops.md) |

---

## 四、复杂问题攻关（JD1-4）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 4.1 | 复杂手势动画怎么做？ | ✅ | [gesture-animation.md](./RN/gesture-animation.md) |
| 4.2 | 原生混合开发怎么做？ | ✅ | [rn-native-communication.md](./RN/rn-native-communication.md) |
| 4.3 | 动态化方案怎么做？ | ✅ | [architecture-engineering.md](./RN/architecture-engineering.md) 第四/七节 |
| 4.4 | 讲一个你解决过的最复杂的问题？ | ✅ | [prep.md](./prep.md) P1-2（弹窗治理/模块裁剪） |

---

## 五、规范与协作（JD1-5）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 5.1 | 你怎么制定代码规范？ | ⚠️ | prep.md 有简要，但没展开 |
| 5.2 | Code Review 怎么做？ | ⚠️ | 同上 |
| 5.3 | 怎么提升团队技术水平？ | ⚠️ | 同上 |

---

## 六、RN 实操（JD2 核心）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 6.1 | RN 项目目录结构怎么组织？ | ✅ | [rn-full-picture.md](./RN/rn-full-picture.md) 第一/二节 |
| 6.2 | RN 渲染流程是什么？ | ✅ | [rn-full-picture.md](./RN/rn-full-picture.md) 第五/七节 |
| 6.3 | TurboModule 怎么写？ | ✅ | [rn-native-communication.md](./RN/rn-native-communication.md) 第四节 |
| 6.4 | React Hooks 生命周期？useEffect 执行时机？ | ❌ | 待补充 |
| 6.5 | 状态管理选型？Zustand 怎么用？ | ✅ | [rn-2026-stack.md](./RN/rn-2026-stack.md) 第七节 |
| 6.6 | React Navigation 怎么用？Deep Linking？ | ⚠️ | performance.md 有提到，但没展开 |
| 6.7 | RN 常用三方库有哪些？ | ✅ | [rn-2026-stack.md](./RN/rn-2026-stack.md) 第二节 + [note.md](./note.md) |
| 6.8 | RN 绘制机制？ | ✅ | [rn-full-picture.md](./RN/rn-full-picture.md) 第五节 |
| 6.9 | 代码调试怎么做？ | ✅ | [debugging-issues.md](./RN/debugging-issues.md) |

---

## 七、Android 实操（JD2 加分）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 7.1 | Android 启动流程？Application/Activity？ | ✅ | [rn-full-picture.md](./RN/rn-full-picture.md) 第四节 |
| 7.2 | Gradle 构建配置？ | ✅ | [build-system.md](./RN/build-system.md) |
| 7.3 | JNI 是什么？怎么用？ | ✅ | [j2v8-deep.md](../../resume/explain/3.1-xm/quickapp-framework/j2v8-deep.md) |
| 7.4 | DEX/R8/包体优化？ | ✅ | [conditional-compile.md](./RN/conditional-compile.md) |
| 7.5 | Android 线程模型？ | ✅ | [rn-full-picture.md](./RN/rn-full-picture.md) 第六节 |

---

## 八、iOS/跨平台差异（JD2）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 8.1 | iOS 和 Android 的核心差异？ | ⚠️ | [IOS/README.md](./IOS/README.md) 有概念对比，缺具体差异案例 |
| 8.2 | iOS 侧 RN 怎么集成？ | ✅ | [IOS/README.md](./IOS/README.md) 第三/四节 |
| 8.3 | 发布流程（签名/上架/审核）？ | ❌ | 待补充 |

---

## 九、IoT / BLE（JD2 加分）

| # | 可能的问题 | 状态 | 答案/链接 |
|---|-----------|------|----------|
| 9.1 | BLE 连接流程？ | ✅ | [rn-native-communication.md](./RN/rn-native-communication.md) 第七节 |
| 9.2 | BLE 模块怎么设计？ | ✅ | [rn-native-communication.md](./RN/rn-native-communication.md) 第四/五节 |
| 9.3 | BLE 断连重连策略？ | ✅ | [rn-native-communication.md](./RN/rn-native-communication.md) 第七节 |

---

## 待补充清单

| # | 内容 | 优先级 |
|---|------|--------|
| 6.4 | React Hooks 生命周期（useEffect/useState/useRef 执行时机、闭包陷阱） | P1 |
| 8.3 | 发布流程（Android 签名/iOS 证书/上架/审核/热更新上线） | P2 |
| 5.1-5.3 | 规范与协作（代码规范怎么定/CR 怎么做/团队提升） | P2 |
| 6.6 | React Navigation 细节（配置/Deep Linking/路由守卫） | P2 |
| 8.1 | iOS/Android 具体差异案例（权限/推送/键盘/后台） | P2 |
