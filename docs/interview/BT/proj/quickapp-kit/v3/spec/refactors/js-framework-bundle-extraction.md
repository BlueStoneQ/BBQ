# JS Framework Bundle 独立化 Spec

## 目录

- [1. 结论](#1-结论)
- [2. 已验证事实](#2-已验证事实)
- [3. 第一性边界](#3-第一性边界)
- [4. Bundle 合同](#4-bundle-合同)
- [5. Toolkit 引用合同](#5-toolkit-引用合同)
- [6. Runtime 加载合同](#6-runtime-加载合同)
- [7. 兼容与版本规则](#7-兼容与版本规则)
- [8. 实施顺序](#8-实施顺序)
- [9. 验收](#9-验收)
- [10. 评审项](#10-评审项)

## 1. 结论

采用**现有 Shared Module 合同承载版本化 JS Framework Bundle**：

```text
quickapp-runtime-js 源码
-> 生成 quickapp-framework-v1.js
-> Toolkit 校验并作为一个 sharedModules 成员写入 RPK
-> App/Page 通过 $app_require$ 使用
-> Core 现有 Module Loader 按依赖图加载且每个 AppRuntime 只执行一次
```

本方案不新增 RPK 字段、不升级 RPK 格式、不修改 Runtime ABI、不修改 Core Loader、不修改 Android/iOS/LVGL。旧 RPK 保持原样运行。

本阶段先独立现有真实 JS 语义：Proxy/Watcher、Dirty Binding、Block reconcile、RenderIntent 和 microtask flush。不得把这些语义改写进 C++。

## 2. 已验证事实

1. 当前没有独立 JS Framework Bundle。
2. Toolkit 在每个页面 Bundle 中重复生成 `__qak_reactive_page_vm__`。
3. 当前 RPK 已有 `sharedModules[]`、模块依赖、SHA-256、字节数和 MIME 合同。
4. Core Module Loader 已支持 `$app_define$`、`$app_require$`、依赖图、Bundle 校验和模块缓存。
5. 现有 App、Shared、Page 模块使用统一 `quickapp-kit-app-module-v1` ABI。
6. 旧 RPK 依赖页面内联 Framework，不能要求重新打包后才能运行。

## 3. 第一性边界

| 部件 | 唯一职责 |
|---|---|
| JS Framework | 响应式状态、Binding dirty、动态 Block、RenderIntent、microtask 批量提交 |
| Toolkit | 编译应用代码、选择确定的 Framework Artifact、写入模块依赖和 RPK |
| Core JS Host | 执行并缓存经过验证的 JS Module，不理解 Framework 内部语义 |
| RPK Loader | 校验并交付现有 Module Descriptor，不识别新的特殊包类型 |
| Platform | 消费 Core 输出；不感知 Framework 是内联还是共享模块 |

Framework 是应用执行环境的 JS 部分，不是 Core Runtime Tree、Router、Render Pipeline 或 Event Router 的替代品。

## 4. Bundle 合同

### 4.1 源码与产物

```text
quickapp-runtime-js/
  src/reactive-page-vm.js
  test/reactive-page-vm.test.mjs
  dist/quickapp-framework-v1.js
  dist/quickapp-framework-v1.json
```

Manifest 最小字段：

```json
{
  "schemaVersion": 1,
  "moduleId": "@quickapp-kit/framework-v1",
  "moduleAbi": "quickapp-kit-app-module-v1",
  "runtimeAbi": "quickapp-kit-runtime-v1",
  "path": "framework/quickapp-framework-v1.js",
  "mime": "application/javascript",
  "byteLength": 0,
  "sha256": ""
}
```

`byteLength` 和 `sha256` 由构建生成，不手写。

### 4.2 模块导出

V1 只导出：

```text
createReactivePageVm(target, context, bindings, blockDefinitions)
```

输入、输出和行为必须与当前 `__qak_reactive_page_vm__` 完全等价。Bundle 不读取文件、不访问 Platform、不持有 Core 对象，也不创建第二棵 Tree。

### 4.3 Bundle 约束

1. 纯 JavaScript，不包含 C/C++、平台代码或构建环境路径。
2. 使用现有 `$app_define$` 注册为 Shared Module，不调用 `$app_bootstrap$`。
3. 无加载期业务副作用；状态按 Page VM 实例隔离。
4. 相同源码和配置必须生成相同字节与 SHA-256。
5. 热路径不引入通用 JSON Bridge。

## 5. Toolkit 引用合同

Toolkit 不再维护 Framework 源码副本，只消费 `quickapp-framework-v1.json` 指向的确定性 Artifact。

Shared 模式输出：

```text
RPK
  app.js
  framework/quickapp-framework-v1.js
  pages/<route>/index.js
  quickapp-kit/runtime.json
```

`quickapp-kit/runtime.json` 继续使用现有结构：

1. `sharedModules[]` 增加 `@quickapp-kit/framework-v1` 描述符。
2. 使用响应式运行逻辑的 Page 在 `dependencies[]` 增加该 ModuleId；App 不声明未使用的依赖。
3. 页面 Bundle 通过 `$app_require$('@quickapp-kit/framework-v1')` 获取 `createReactivePageVm`。
4. 页面 Bundle 只保留业务 VM、Binding evaluator、Block definition 和 Handler 映射。
5. Toolkit 构建时校验 Framework Manifest 的 ABI、路径、大小和 SHA-256；不匹配立即失败。

Toolkit 不允许静默退回内联模式；模式必须由明确构建配置决定。

## 6. Runtime 加载合同

加载顺序沿用现有模块依赖图：

```text
验证 RPK
-> 加载 App Module
-> 创建 App VM
-> 加载 Page 的 Framework Shared Module 依赖
-> 加载 Page Module
-> 创建 Page VM
```

规则：

1. Framework 与普通 Shared Module 使用同一校验、求值、缓存和 teardown 机制。
2. 同一 AppRuntime 内 Framework 只求值一次；Page VM 状态不得放在模块全局共享。
3. Framework 缺失、checksum 错误、Module ABI 不匹配时按现有 Package/Module typed failure 终止加载。
4. Core 不增加 `FrameworkLoader`、特殊全局变量或第二套模块缓存。
5. Platform 不参与 Framework 选择和加载。

## 7. 兼容与版本规则

### 7.1 旧 RPK

旧 RPK 页面包含 `__qak_reactive_page_vm__`，没有 Framework Shared Module；Runtime 按原流程执行，不做转换。

### 7.2 新 RPK

新 RPK 页面依赖 `@quickapp-kit/framework-v1`；缺失该模块即为包不完整，不允许 Runtime 注入猜测版本。

### 7.3 版本

1. Framework 主版本编码在 ModuleId：`@quickapp-kit/framework-v1`。
2. Bundle Manifest 同时声明 `moduleAbi` 和 `runtimeAbi`。
3. Toolkit 在构建期选择精确 Artifact；Runtime 不做 semver 协商。
4. 兼容修改保持 ModuleId；破坏性修改发布新主版本。
5. V1 不实现运行时下载、远程更新或跨应用 Framework 缓存。

## 8. 实施顺序

| 阶段 | 工作 | 停止条件 |
|---|---|---|
| F1 | 从 Toolkit 原样提取 reactive helper 到 JS 仓库并建立纯 JS 行为测试 | 与当前内联实现不等价则停止 |
| F2 | 生成版本化 Bundle + Manifest | 构建不确定或 ABI 不明确则停止 |
| F3 | Toolkit 增加 `inline/shared` 双模式并打包 Shared Module | 现有 RPK 测试回归则停止 |
| F4 | 同一案例分别生成两种 RPK，比较行为 | JS、渲染、事件、路由或 teardown 不一致则停止 |
| F5 | 三端运行 Shared RPK；通过后将 Toolkit 默认切到 Shared | 任一平台失败则默认仍保持 Inline |

回滚只需把 Toolkit 默认模式切回 Inline；旧 RPK 和 Runtime 无需回滚。

## 9. 验收

1. `quickapp-runtime-js` 有真实源码、测试、Bundle 和 Manifest。
2. Toolkit 不再拥有 reactive helper 的第二份源码。
3. Shared 页面 Bundle 不包含 `__qak_reactive_page_vm__` 函数体。
4. 一个多页面 RPK 只包含一个 Framework Bundle。
5. Inline/Shared 两种 RPK 的首屏、Binding、`if`、keyed `for`、事件、路由、Feature 和 teardown 行为一致。
6. JsExecutorBackend 与 LibuvEventLoopBackend 均通过。
7. Android、iOS、LVGL 使用同一 Shared RPK 通过。
8. 旧 Case 001 RPK 不重新打包仍可运行。
9. 记录 RPK 大小变化、页面重复代码减少量和 Framework 单次求值证据。

## 10. 评审项

编码前只需确认以下四项：

1. Framework 复用现有 Shared Module，不新增 RPK 特殊字段。
2. Framework 随 RPK 打包一次，而不是分别内置在三个 Platform Runtime 中。
3. 旧 RPK 继续内联兼容；新 RPK 缺少指定 Framework 时明确失败。
4. F1-F5 先双模式验证，再切换 Toolkit 默认值。

状态：`READY_FOR_ARCH_REVIEW / CODE_NOT_STARTED`。
