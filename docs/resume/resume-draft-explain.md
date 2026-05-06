# Resume Draft - explain

> 简历中可能被面试官追问的点，以问题驱动形式记录详细解释。

---

## Q: 快应用框架的三线程模型是什么？

三线程是整个框架的线程模型，不只是渲染管线：

| 线程 | 职责 |
|------|------|
| JS Thread | 执行所有 JS（业务逻辑 + 虚拟 DOM diff + Feature 调用） |
| IO Thread Pool | 解析渲染 JSON + 异步 Feature 执行 |
| UI Thread | 创建/更新 Android View + 事件采集 |

渲染管线是其中一条链路：JS Thread（生成 Action）→ IO Thread（解析 JSON）→ UI Thread（应用 View 变更）。

Feature 调用也走这些线程：JS 同步调用 → IO 线程池异步执行 → 回调回 JS 线程。

---

## Q: 反射 vs 注解处理器的 trade-off 是什么？

**问题：** buildForRom=true 时凡泰模块被排除，`new FinClipProviderImpl()` 编译失败。

**两种方案：**

| | 反射（采用） | 注解处理器 |
|---|---|---|
| 做法 | `Class.forName("...FinClipProviderImpl")` | 用 `@DependencyAnnotation` 标注 |
| 优点 | 改动小，一行代码解决 | 更规范，编译时安全 |
| 缺点 | 类名硬编码字符串，重构易遗漏 | 改动稍多，需确认处理器配置 |

**决策：** 选反射，因为快速修复优先。框架的 `@DependencyAnnotation` 内部也是反射，本质一样，只是更规范。标注 TODO 后续优化。

---

## Q: CRN 是什么？和标准 RN 有什么区别？

CRN = 携程基于 React Native 的企业级工程化定制，主要增加了：
- 分 bundle 机制（按频道/业务拆分）
- 分版本热更新（不同版本下发不同 bundle）
- CI/CD 集成（构建 → 发布 → 灰度 → 回滚）
- 调试和运维监控工具链
- BFF 层 GraphQL 聚合裁剪

**为什么要 CRN：** 标准 RN 缺乏企业级的发布管控能力。CRN 解决的是"几十个业务团队如何在同一个 App 里独立开发、独立发布、互不影响"的问题——分 bundle 隔离业务、分版本灰度热更新、统一 CI/CD 和监控。

---

## Q: J2V8 同步 Bridge 是什么意思？

J2V8 是 V8 引擎的 Java 绑定库。"同步 Bridge"指 JS 调用 Native 方法时，在同一个线程上同步执行，不需要跨线程消息传递。

```java
v8.registerJavaMethod(new JavaCallback() {
    public Object invoke(V8Object receiver, V8Array parameters) {
        // 这里是 Java 代码，但在 JS 线程上同步执行
        return nativeResult;
    }
}, "JsBridge");
```

JS 调用 `JsBridge.invoke()` → V8 通过 JNI 直接调用 Java 方法 → 同线程同步返回。和 RN 新架构的 JSI 是同一个思路。

---

## Q: 条件编译 vs 插件化 vs 动态加载，为什么选条件编译？

| 方案 | 做法 | 成本 | 风险 |
|------|------|------|------|
| 条件编译（选） | buildForRom=true 时 Gradle 排除模块 | 低 | 无 |
| 插件化 | 模块打成独立 APK 运行时加载 | 极高 | Hook 系统 API，每个版本可能 break |
| 动态加载 | so + assets 按需下载 | 中 | 凡泰/百度是整个 Java 模块，不是纯 so |

凡泰/百度是完整的 Java 模块（dex + Activity + Service），动态加载等于插件化。系统预装应用不应该和系统对抗。最终决策：预装包不带，走自升级恢复。

---

## Q: consumerProguardFiles 问题是怎么排查的？

**现象：** cherry-pick 混淆提交后 dex 大小没变（44.4MB），混淆没生效。

**排查过程：**
1. 检查 R8 seeds.txt → 569,654 个 keep 条目，几乎所有类都被保留
2. 对比 os3 原始提交 → 发现冲突解决时保留了宽泛 keep 规则
3. 修复后仍然没变 → 继续排查
4. 定位根因：新增的 guide/recommend/subscribe 三个模块的 `build.gradle` 声明了 `consumerProguardFiles`，其 proguard-rules.pro 中的宽泛规则通过 consumer 机制传递给 app 模块，阻止了 R8 裁剪

**consumer 机制：** Android 库模块可以通过 `consumerProguardFiles` 把自己的混淆规则传递给依赖它的 app 模块。如果库的规则太宽泛（`-keep public class * { *; }`），会阻止整个 app 的代码裁剪。

---

## Q: 设计稿还原自动化链路怎么实现的？

```
Figma MCP（读设计稿节点/样式/布局）
    → AI Agent（生成代码）
    → DevTools MCP（打开浏览器 → 截图 → 对比设计稿）
    → 发现差异 → AI 自动修复 → 再次验证
```

Chrome DevTools MCP 提供的工具：navigate_page、take_screenshot、take_snapshot（DOM）、evaluate_script 等，让 AI 能"看到"渲染结果并自动修复。


---

## Q: CI/CD 流水线怎么搭建？做了哪些卡控？

### 一条典型的大前端 CI/CD 流水线

```
代码提交（git push）
    ↓ 触发 CI
Stage 1: 静态检查（秒级）
  ESLint / TypeScript 类型检查 / Commit Message 校验 / 敏感信息扫描
    ↓
Stage 2: 构建（分钟级）
  依赖安装（npm ci）→ 编译构建 → 产物归档
    ↓
Stage 3: 测试（分钟级）
  单元测试 → 集成测试 → 覆盖率检查
    ↓
Stage 4: 质量门禁（卡控点）
  包体积检查 / 性能基线对比 / 安全扫描 / Code Review 通过
    ↓
Stage 5: 部署/发布
  灰度发布（1%→10%→50%→100%）→ 监控告警 → 自动回滚
```

### 卡控点设计

| 卡控点 | 阶段 | 阻断/告警 | 说明 |
|--------|------|----------|------|
| ESLint 不通过 | 提交时（Git Hooks） | 阻断 | 本地拦住，不进 CI |
| Commit Message 格式错 | 提交时 | 阻断 | Conventional Commits |
| TypeScript 类型错误 | CI Stage 1 | 阻断 | 编译不过不让合 |
| 单测失败 | CI Stage 3 | 阻断 | 测试不过不让合 |
| 覆盖率低于阈值 | CI Stage 3 | 告警/阻断 | 新代码必须有测试 |
| 包体积超标 | CI Stage 4 | 告警 | 超过基线需审批 |
| 性能回归 | CI Stage 4 | 告警 | 启动耗时/帧率劣化 |
| 安全漏洞 | CI Stage 4 | 阻断（高危） | 依赖漏洞扫描 |
| Code Review 未通过 | CI Stage 4 | 阻断 | 至少 1 人 approve |
| 灰度期间崩溃率上升 | 发布后 | 自动回滚 | 监控联动 |

### 全链路卡控

```
编码时：IDE 插件实时提示（ESLint/Prettier）
    ↓
提交时（Git Hooks）：pre-commit lint-staged + commit-msg commitlint
    ↓
推送时（CI）：全量 lint + 类型检查 + 单测 + 覆盖率
    ↓
合并时：Code Review 人工审批 + 自动化检查全部通过
    ↓
发布时：灰度 + 监控 + 自动回滚
```

### 我的经验映射

| 做过的 | 对应阶段 |
|--------|---------|
| MT 脚手架 CLI | 项目初始化标准化 |
| MT CI/CD 流程建设 | Stage 2-5 全流程 |
| MT 发布插件（KeyPerson 审批） | Stage 4 人工审批卡控 |
| XT 全链路代码质量治理 | 编码时 → Git Hooks → CI 全链路 |
| XM 性能分析平台 CI/CD | Stage 5 一键部署 + 灰度 |
| XM 快应用 CI 构建修复 | Stage 2 构建环境维护 |


---

## Q: 大文件上传优化怎么做的？

### 背景

线上最大数据包 11.4G，原方案（业务服务器直写 JuiceFS 挂载目录）在 5G+ 时失败，且大文件上传耗时过长。

### 方案选型

| 方案 | 说明 | 问题 |
|------|------|------|
| 业务服务器直写（原方案） | 前端流式上传到 BFF，BFF 写入 JuiceFS | 大文件慢，11.4G 失败 |
| 自定义分片上传 | 前端切片 → 逐片上传到业务服务器 → 服务端合并 | IO 处理耗时高（频繁切片读写），比整传还慢 |
| S3 整传 | 前端直传 S3（预签名 URL） | 单次上传限制 5G |
| **S3 MPU 分片并发上传（选）** | 前端切片 → 并发 PUT 到 S3 → 合并 | 无大小限制，速度最快 |

### 核心数据

| 文件大小 | 原方案（直写） | S3 MPU 并发 | 提速 |
|---------|-------------|------------|------|
| 1.3G | 30.8s | 12.7s | ~2.4x |
| 2G | 41.8s | 17.9s | ~2.3x |
| 5.7G | 155.8s | 51.7s | ~3x |
| 11.4G | 失败 | 100.1s | 突破上限 |

### 实现要点

- 分片大小：64MB（2 的幂次对齐）
- 并发数：6（S3 支持乱序并发上传）
- 流程：后端一次请求返回所有 URL（init + presign + completeUrl）→ 前端并发 PUT → 前端直接 POST completeUrl 合并
- 按文件大小分流：< 4GB 走原有单次 PUT，≥ 4GB 走 MPU

### 为什么自定义分片方案反而更慢？

耗时分析（2G 文件，总耗时 129s）：
- 服务端 IO 处理：70.8s（占 55%）— 频繁切片文件读写
- 切片网络请求：34.5s（占 27%）— 串行逐片上传
- 合并耗时：22.5s（占 17%）

根因：业务服务器做中转，每个切片要写临时文件再合并，IO 开销巨大。S3 MPU 直接传到对象存储，不经过业务服务器，省掉了中转 IO。


---

## Q: BFF + GraphQL 是什么？解决什么问题？

### BFF（Backend For Frontend）

在前端和后端微服务之间加一层中间层，专门为前端服务。什么语言都可以写（Node.js/Java/Go），通常前端团队用 Node.js 维护。

### 解决的问题

1. 前端一个页面要调 4-5 个微服务接口，串行慢并行复杂
2. 每个接口返回一大坨数据，前端只用几个字段，浪费流量（移动端敏感）
3. 后端改接口，所有前端都要改
4. 不同端（App/Web/小程序）需要的数据不一样，后端不想为每个端写专用接口

### GraphQL 在 BFF 里的作用

- **聚合**：一个查询同时从多个微服务拿数据，前端一次请求搞定
- **裁剪**：前端只要什么字段就返回什么字段（按需查询），减少传输量

### 为什么用 GraphQL 而不是 REST 聚合

GraphQL 的优势是前端自定义返回字段（按需裁剪），REST 聚合接口返回固定结构，改字段要改后端。

### 在 XC 机酒频道的场景

机酒页面一屏展示酒店信息、价格、库存、用户优惠券，数据来自不同微服务。BFF + GraphQL 一次请求聚合所有数据，按需裁剪减少流量。

### 后端需要做什么

不需要做什么。后端正常提供微服务接口，BFF 是前端自己加的一层，对后端透明。BFF 本质是前端的事——谁用谁维护，不求人。

### 架构图

```
前端（RN App）
  ↓ 一个 GraphQL 查询
BFF 层（Node.js + GraphQL）
  ↓ 并行调用
酒店服务 / 价格服务 / 库存服务 / 用户服务
  ↓ 聚合 + 裁剪
返回前端需要的精确数据
```


---

## Q: R8 混淆能带来内存优化吗？

R8 做三件事，其中两件能减少内存：

| R8 能力 | 做什么 | 内存影响 |
|---------|--------|---------|
| Shrinking（裁剪） | 删除未使用的类、方法、字段 | ✅ 减少加载到内存的类数量，直接降低内存占用（大头） |
| Obfuscation（混淆） | 缩短类名/方法名 | ✅ 字符串常量池变小，元数据占用减少（效果较小） |
| Optimization（优化） | 内联方法、移除空方法、简化控制流 | ✅ 减少方法栈帧、减少对象分配 |

准确说是 R8 的 shrinking + optimization 带来内存优化，混淆本身收益很小。但大家习惯把 R8 整套叫"混淆"，实际裁剪才是大头。

快应用框架 dex 44.4MB → 27MB，主要是 shrinking 删了没用的类——这些类不加载了，运行时内存自然减少。
