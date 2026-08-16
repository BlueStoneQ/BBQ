# Alliance Toolkit 与 RPK 产物管线研究

## 目录

- [1. 结论](#1-结论)
- [2. 研究对象与证据边界](#2-研究对象与证据边界)
- [3. Case 001 基线](#3-case-001-基线)
- [4. Toolkit 输入](#4-toolkit-输入)
- [5. 编译过程](#5-编译过程)
- [6. JS 产物形态](#6-js-产物形态)
- [7. RPK 结构](#7-rpk-结构)
- [8. RPKS 结构](#8-rpks-结构)
- [9. Runtime 最小加载合同](#9-runtime-最小加载合同)
- [10. 架构约束](#10-架构约束)
- [11. 已验证事实、合理推断与待验证项](#11-已验证事实合理推断与待验证项)
- [12. Case 001 验收基线](#12-case-001-验收基线)
- [13. 关键决策与重点吸收点](#13-关键决策与重点吸收点)

## 1. 结论

联盟 Toolkit 2.1.0 在 Case 001 中采用以下产物模型：

```text
.ux / JS / Less / Manifest / Assets
  -> 拆分并编译 script、template、style
  -> 将业务 VM、Template Descriptor、Style Object 打进 JS 模块
  -> 生成 app.js、页面/卡片 index.js、manifest.json 和资源
  -> 签名并封装为 RPK
  -> 可进一步拆分并封装为 RPKS
```

Case 001 直接证明：

1. 标准页面产物是可执行 `index.js`，不是独立模板二进制文件。
2. 页面 `index.js` 同时包含业务 VM、Template Descriptor、Style Object，并通过 `$app_define$` 注册、通过 `$app_bootstrap$` 启动。
3. `app.js` 包含应用 VM、Manifest 和全局样式入口，也使用 `$app_define$` 与 `$app_bootstrap$`。
4. 源码中的 `@system.*` import 被转换为 `$app_require$("@app-module/system.*")`。
5. 模板数据绑定在该版本产物中表现为 JS 函数，例如 `value: function () { return this.title }`；事件表现为事件名到 VM 方法名的映射。
6. RPK 是 ZIP 容器；RPKS 也是 ZIP 容器，其成员是主包、基础分包和卡片包等内部包。
7. Runtime V1 应以联盟 Toolkit 生成的标准 RPK 为正式输入，以 Case 001 为首个 Golden Case；不能预设联盟产物包含 `artifact.json`、`templates.bin`、`BindingId` 或 `BlockId`。

对 QuickApp Kit 的直接约束是：

```text
JS Framework 必须兼容标准 $app_* 模块协议并解释标准 template/style/VM；
C++ Core 不依赖标准 JS bundle 的 Webpack 内部模块编号；
RPK Loader 按 Manifest 和稳定模块入口加载，不按 Case 001 路径写死；
Toolkit V1 先 inspect/validate/run 标准 RPK，自有优化产物必须是后续可选路径。
```

## 2. 研究对象与证据边界

### 2.1 研究对象

本研究只基于以下本地样本，不以未观察到的联盟实现细节作为事实：

```text
quickapp-examples/quickapp-code-test1/
├── src/
├── build/
└── dist/
    ├── com.example.case1.debug.1.0.0.rpk
    ├── com.example.case1.release.development.1.0.0.rpk
    ├── com.example.case1.debug.1.0.0.rpks
    └── com.example.case1.release.development.1.0.0.rpks
```

Manifest 的 `packageInfo` 表明该产物由以下环境产生：

| 字段 | Case 001 值 |
|---|---|
| `originType` | `quickapp-ide` |
| `toolkit` | `2.1.0` |
| `node` | `v22.17.0` |
| `platform` | `darwin` |
| `arch` | `arm64` |

### 2.2 证据等级

本文使用三个等级：

| 等级 | 含义 |
|---|---|
| 已验证事实 | 可从 Case 001 的源码、build 文件或包内容直接观察 |
| 合理推断 | 由产物结构可以支持，但仍需源码、规范或运行 Trace 进一步确认 |
| 待验证项 | Case 001 未覆盖，不能据此形成实现合同 |

### 2.3 研究边界

本文不预设以下文件或标识存在：

```text
artifact.json
templates.bin
BindingId
BlockId
```

如果 QuickApp Kit 后续设计这些内容，它们属于自有优化产物或内部数据模型，不属于本研究已经证明的联盟 RPK 合同。

## 3. Case 001 基线

### 3.1 基线定义

`quickapp-code-test1` 正式定义为：

> **Case 001：联盟 Toolkit 2.1.0 基础 RPK/RPKS 编译与 Runtime 兼容基线。**

它覆盖：

- App VM；
- Page VM；
- 静态模板；
- 简单文本数据绑定；
- 编译样式；
- 点击事件；
- `system.router`；
- `system.prompt`；
- 页面路由；
- Card/Widget 分包；
- debug/release 两类产物。

它不覆盖：

- `if/show`；
- `for + key`；
- 动态 class/style；
- 自定义组件 props 与 slot；
- 双向绑定；
- 事件捕获、冒泡和停止传播；
- 高频输入事件；
- 动态组件；
- 完整验签与证书链验证。

### 3.2 Golden Artifact 哈希

| 文件 | SHA-256 |
|---|---|
| debug RPK | `889496f65db92262e391b16628d4f29871f40a25aa5f15deaf7b6cb7d7d9ce80` |
| release RPK | `0923f82af7ceeedc1852e4b06550263a0f8df53e347c2faf789e33979cf585df` |
| debug RPKS | `06e7659f13514d533761128b615b4dfe6a641abcb45b0ad813c09e74f7fc845e` |
| release RPKS | `1e5aa10694b691fcfb5ee929c31beb6c4a1674d952ddc35d200b1937f97694e3` |

哈希用于锁定当前研究基线，不代表联盟格式版本标识。

## 4. Toolkit 输入

### 4.1 已验证输入

Case 001 的源码输入为：

```text
src/
├── app.ux
├── manifest.json
├── sitemap.json
├── CardDemo/index.ux
├── pages/Demo/index.ux
├── pages/DemoDetail/index.ux
├── helper/*.js
└── assets/
    ├── images/logo.png
    └── styles/*.less
```

`.ux` 同时承载：

```text
<template>  页面/组件声明结构
<script>    VM、数据、方法和生命周期
<style>     CSS/Less 样式
```

`package.json` 的构建命令为：

```text
hap build
hap release
hap debug
```

### 4.2 Manifest 输入作用

源码 Manifest 至少描述：

- package、版本和最低平台版本；
- feature 与 permission；
- 应用入口路由；
- 页面到 component 的映射；
- widget/card；
- 页面显示配置。

Runtime 不能根据文件扫描猜入口。Case 001 的入口定位规则是：

```text
router.entry = pages/Demo
router.pages[pages/Demo].component = index
=> pages/Demo/index.js
```

## 5. 编译过程

### 5.1 已验证的阶段结果

源码与 build 的映射为：

| 源码 | build 产物 |
|---|---|
| `src/app.ux` + helper JS + Manifest | `build/app.js` |
| `src/pages/Demo/index.ux` | `build/pages/Demo/index.js` |
| `src/pages/DemoDetail/index.ux` | `build/pages/DemoDetail/index.js` |
| `src/CardDemo/index.ux` | `build/CardDemo/index.js` |
| `src/manifest.json` | `build/manifest.json` |
| `src/sitemap.json` | `build/sitemap.json` |
| `src/assets/images/logo.png` | `build/assets/images/logo.png` |

`build/` 中未观察到独立模板文件或独立样式文件。

### 5.2 Loader 证据

debug 页面 JS 保留了构建 Loader 名称，可直接观察到：

```text
fragment-loader
template-loader
style-loader
less-loader
```

因此可以确认 `.ux` 至少被拆分为 script、template 和 style 三部分分别处理，再合入页面 JS。

### 5.3 合理推断的完整过程

```text
1. Parse UX
   拆分 template / script / style

2. Transform Script
   转换 ES module 和 @system.* import
   打包应用 helper 依赖

3. Compile Template
   将标签、属性、class、事件和绑定表达式编译为 JS 对象

4. Compile Style
   执行 Less 编译
   将 selector 与声明编译为 JS Style Object

5. Bundle Module
   生成 Webpack 风格模块容器
   通过 $app_define$ 暴露稳定应用模块

6. Emit Build Directory
   输出 app.js、页面/卡片 JS、Manifest、资源

7. Sign and Package
   写入 META-INF/CERT、META-INF/build.txt
   生成 RPK，并可进一步生成 RPKS
```

其中第 1、3、4、6 步有直接文件证据；具体 Babel/Webpack 插件顺序、优化 passes 和签名算法仍属于待验证项。

## 6. JS 产物形态

### 6.1 页面 `index.js` 的四部分

Case 001 的页面 JS 可以拆成四个语义部分：

```text
1. Bundle Module Runtime
2. Page VM / Script Module
3. Template Descriptor + Style Object
4. $app_define$ + $app_bootstrap$
```

debug 与 release 使用不同可读性和压缩级别，但语义结构一致。

### 6.2 VM 产物

页面 script 的默认导出成为 Page VM 定义，例如：

```js
{
  private: {
    title: '欢迎体验快应用开发'
  },

  onInit() {
    this.$page.setTitleBar({ text: '欢迎体验快应用开发' })
  },

  onDetailBtnClick() {
    router.push({ uri: '/pages/DemoDetail' })
  }
}
```

产物还把 `private/public/protected` 规范化到 `data` 与 `_descriptor`。这是 Toolkit 生成逻辑，说明 JS Framework 需要理解最终 VM 形态和访问级别语义，但不应依赖某个压缩后的局部变量名。

### 6.3 Template Descriptor

模板被编译为 JS 对象：

```js
{
  type: 'div',
  attr: {},
  classList: ['wrapper'],
  children: [
    {
      type: 'text',
      attr: {
        value: function () { return this.title }
      },
      classList: ['title']
    },
    {
      type: 'input',
      attr: {
        type: 'button',
        value: '跳转到详情页'
      },
      classList: ['btn'],
      events: {
        click: 'onDetailBtnClick'
      }
    }
  ]
}
```

已验证事实：

- 静态节点使用 `type/attr/classList/children`；
- 简单表达式绑定被编译为 JS 函数；
- 事件值是 VM 方法名字符串；
- Template Descriptor 作为 `module.exports.template` 挂到页面模块。

不能从 Case 001 推导：

- 所有绑定函数如何建立依赖；
- `if/for/show` 的 Descriptor 结构；
- 节点是否在 JS 层拥有稳定 Runtime NodeId；
- Toolkit 是否在不可见元数据中生成绑定编号。

### 6.4 Style Object

Less 被求值并编译为 JS 对象，例如：

```js
{
  '.wrapper': {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  '.wrapper .title': {
    fontSize: '40px',
    textAlign: 'center',
    color: '#000000',
    _meta: { ruleDef: [] }
  }
}
```

样式对象通过 `module.exports.style` 挂到页面模块。`_meta.ruleDef` 表明 Toolkit 保留了 selector 结构信息；selector 匹配、优先级、继承和运行时 style resolve 的完整算法仍需验证。

### 6.5 `$app_define$`

页面模块使用稳定名称注册：

```js
$app_define$('@app-component/index', [], function (
  $app_require$,
  $app_exports$,
  $app_module$
) {
  // 执行业务模块
  // 赋值 template 与 style
})
```

最低语义要求是：

- 按模块名注册 factory；
- 为 factory 提供 require、exports 和 module；
- 缓存或返回模块导出；
- 允许模块导出附带 `template`、`style`、`manifest`。

依赖数组在 Case 001 页面中为空，不能据此断言该参数永远为空。

### 6.6 `$app_bootstrap$`

页面和应用 JS 末尾分别调用：

```js
$app_bootstrap$('@app-component/index', {
  packagerVersion: '2.1.0'
})
```

```js
$app_bootstrap$('@app-application/app', {
  packagerVersion: '2.1.0'
})
```

已验证它标记当前 bundle 的启动模块并携带 packager 版本。它是立即创建 VM、返回定义，还是向 Runtime Host 注册 bootstrap 请求，需要通过真实 Runtime Trace 或参考实现继续确认。

### 6.7 `$app_require$`

源码：

```js
import router from '@system.router'
```

产物：

```js
$app_require$('@app-module/system.router')
```

Case 001 的 `app.js` 还使用：

```text
@app-module/system.fetch
@app-module/system.prompt
```

因此 `$app_require$` 至少跨越两类命名空间：

| 命名空间 | 预期来源 |
|---|---|
| 应用已注册模块 | JS Module Registry |
| `@app-module/system.*` | Runtime Capability Registry |

对于系统模块，JS Framework 应返回符合快应用调用模型的 JS Proxy；C++ Capability System 和 Platform Provider 承担实际实现。

### 6.8 `app.js`

`app.js` 不是简单入口文件。Case 001 中它包含：

- App VM；
- helper JS 的 bundle；
- 系统能力引用；
- 编译后的 Manifest；
- 全局 style 入口；
- `$app_define$('@app-application/app', ...)`；
- `$app_bootstrap$('@app-application/app', ...)`。

release `app.js` 还向 `global.manifest` 写入 Manifest。Runtime 应以正式应用模块导出与独立 `manifest.json` 为合同，不应只依赖这个兼容性全局变量。

## 7. RPK 结构

### 7.1 已验证结构

Case 001 的 RPK 是 ZIP archive。release RPK 内容为：

```text
META-INF/
├── CERT
└── build.txt
manifest.json
app.js
pages/Demo/index.js
pages/DemoDetail/index.js
CardDemo/index.js
assets/images/logo.png
sitemap.json
```

### 7.2 Debug 与 Release

| 项目 | Debug | Release |
|---|---:|---:|
| RPK 文件大小 | 42,445 bytes | 17,992 bytes |
| `app.js` 解压大小 | 36,188 bytes | 4,842 bytes |
| `pages/Demo/index.js` 解压大小 | 29,230 bytes | 2,470 bytes |
| Manifest debug 标记 | `true` | `false` |
| JS 可读性 | Loader 路径和模块名可见 | 压缩 |

两类产物拥有相同的稳定 `$app_*` 协议和应用语义。Runtime Loader 不应依赖 debug bundle 的 Loader 路径或 Webpack 内部模块 ID。

### 7.3 RPK 注释与构建元数据

RPK ZIP comment 包含构建环境 JSON；Manifest 还包含 `packageInfo`。这两处信息可以用于 inspect、诊断和兼容性报告，但是否属于强制标准字段需要规范或更多样本确认。

### 7.4 签名边界

RPK 中存在 `META-INF/CERT`，证明包包含签名相关数据。Case 001 本身不足以确定：

- CERT 的编码合同；
- 被签名的精确字节范围；
- 摘要和签名算法；
- debug 与 release 的信任策略；
- 证书链、吊销和厂商校验机制。

V1 RPK Loader 应保留 `PackageVerifier` 接口，但不能在没有证据时自行发明联盟验签规则。

## 8. RPKS 结构

### 8.1 已验证结构

RPKS 是一个 ZIP 容器，其成员仍是可独立展开的包。

Debug RPKS：

```text
com.example.case1.base.srpk
com.example.case1_CardDemo.rpk
```

Release RPKS：

```text
com.example.case1.rpk
com.example.case1.base.srpk
com.example.case1_CardDemo.rpk
```

release RPKS 中的 `com.example.case1.rpk` 与外部 release RPK 字节完全一致。

### 8.2 Base SRPK

`base.srpk` 包含：

```text
META-INF/
manifest.json
app.js
pages/Demo/index.js
pages/DemoDetail/index.js
assets/images/logo.png
sitemap.json
```

它不包含 `CardDemo/index.js`。

### 8.3 Card RPK

Card 包包含裁剪后的 Manifest、Card 页面 JS 和资源：

```text
META-INF/CERT
manifest.json
CardDemo/index.js
assets/images/logo.png
sitemap.json
```

Card Manifest 只保留与 Widget 相关的 router 信息，并未观察到 `app.js`。

### 8.4 尚不能确定的 RPKS 语义

Case 001 不能证明：

- `.srpk` 的正式生命周期与安装语义；
- debug RPKS 为什么不包含完整主 RPK；
- Host 如何选择主包、base 包和 Card 包；
- 分包依赖、升级、签名和版本一致性规则；
- RPKS 是否是所有 Runtime 必须直接支持的输入。

因此 V1 Runtime 正式输入先锁定单一标准 RPK；RPKS 由 Toolkit inspect/validate 支持，直接安装和分包加载列为后续合同。

## 9. Runtime 最小加载合同

### 9.1 V1 正式输入

```text
RuntimeInput = Standard RPK bytes/path
```

Case 001 release RPK 是首个 Golden Artifact。Runtime 必须在不修改包内容的前提下运行它。

### 9.2 最小加载状态机

```text
OpenPackage
  -> ReadPackageMetadata
  -> VerifyOrRecordVerificationStatus
  -> ParseManifest
  -> CheckRuntimeCompatibility
  -> ResolveAppModule(app.js)
  -> InitializeJsRuntime
  -> InstallHostBindings
  -> LoadJsFramework
  -> EvaluateAppModule
  -> ResolveEntryRoute
  -> EvaluatePageModule
  -> CreatePageVm
  -> InstantiateTemplateAndStyle
  -> MountInitialSurface
  -> DispatchLifecycle
```

### 9.3 加载顺序约束

必须先安装以下 JS Framework 全局入口，再执行 RPK JS：

```text
$app_define$
$app_require$
$app_bootstrap$
```

系统能力 Proxy 也必须在业务模块请求时可解析。推荐顺序：

```text
1. Create QuickJS Runtime/Context
2. Register C++ External Functions
3. Evaluate built-in JS Framework
4. Evaluate app.js
5. Read router.entry from parsed Manifest
6. Resolve pages/<route>/<component>.js
7. Evaluate page bundle
8. Obtain page module exports: VM + template + style
9. Create Page VM and run initial bindings
10. Submit typed initial render data to C++ Core
```

第 8 步的具体模块提取 API 依赖 `$app_bootstrap$` 实际行为，仍需 PoC 验证；状态机顺序不因此改变。

### 9.4 Loader 必须提供的能力

```cpp
class RpkPackage {
 public:
  virtual Result<Bytes> read(std::string_view path) const = 0;
  virtual bool exists(std::string_view path) const = 0;
  virtual Result<std::vector<std::string>> list(
      std::string_view prefix) const = 0;
};
```

RPK Loader 至少需要：

- 安全 ZIP 读取；
- 路径规范化和 traversal 防护；
- 解压大小、文件数和压缩比限制；
- Manifest JSON 解析与 schema 校验；
- 模块路径解析；
- 资源读取；
- PackageVerifier 扩展点；
- 构建元数据 inspect；
- 结构化错误。

### 9.5 Runtime 不得依赖的细节

```text
Webpack numeric module ID
debug Loader absolute path
release 压缩变量名
Case 001 的 package 名
pages/Demo 固定入口
Toolkit 2.1.0 的局部函数布局
global.manifest 作为唯一 Manifest 来源
```

## 10. 架构约束

### 10.1 对 JS Framework 的约束

JS Framework 必须：

1. 在 RPK JS 之前加载；
2. 实现 `$app_define$/$app_require$/$app_bootstrap$` 的兼容语义；
3. 创建 App/Page VM 并处理 data/private/public/protected；
4. 解释标准 Template Descriptor 与 Style Object；
5. 以正确 `this` 执行绑定函数和 VM 方法；
6. 管理 Binding Watcher、事件 Handler 和生命周期；
7. 将一次 Runtime Task 内的状态变化批量提交给 Core；
8. 将 `@app-module/system.*` 映射到 Capability Proxy；
9. 不把 QuickJS `JSValue` 跨线程传递；
10. 不依赖 bundle 内部 numeric module ID。

Case 001 证明 JS Framework 必须存在，但没有证明它必须维护一棵跨帧动态 DOM Tree。

### 10.2 对 C++ Core 的约束

C++ Core 必须：

1. 接收 JS Adapter 规范化后的 owned typed data；
2. 维护平台无关 Runtime Tree、NodeId、style/layout 和 mount 状态；
3. 不解析 Webpack bundle 内部结构；
4. 不保存 `JSValue`、VM 方法字符串对应的 JS 函数对象；
5. 不包含 Android、UIKit 或 LVGL 类型；
6. 通过 RenderBackend、TextMeasurer、TaskRunner 等 Port 访问平台；
7. 输出 typed `MountTransaction`；
8. 接收 normalized `PlatformEvent` 并路由到 JS Handler；
9. 允许未来优化输入，但不要求标准 RPK 预先包含自有 IR。

### 10.3 对 Toolkit 的约束

QuickApp Kit Toolkit V1 应优先提供：

```text
inspect <rpk|rpks>
validate <rpk|rpks>
run <rpk>
```

V1 不需要先重写联盟 `.ux -> RPK` 编译器。Toolkit 必须能够展示：

- 包结构；
- Manifest、入口和页面模块解析结果；
- Toolkit/packageInfo；
- 签名状态；
- feature/permission；
- RPKS 内部分包；
- 文件大小与安全限制；
- Runtime 兼容性诊断。

如果后续生成自有优化产物，必须满足：

```text
标准 RPK兼容路径 ─┐
                  ├─> 同一个 JS Framework/Core/Backend 语义
优化产物路径 ─────┘
```

不能让优化产物替代标准 RPK 合同，也不能把尚未验证的自有字段写成联盟事实。

### 10.4 对 RPK Loader 的约束

RPK Loader 的职责是包与资源访问，不是 JS Framework：

| RPK Loader 负责 | RPK Loader 不负责 |
|---|---|
| ZIP 安全读取 | 执行 JS |
| Manifest 解析 | 创建 Page VM |
|模块路径解析 | 求值绑定函数 |
|资源读取 | Style Resolve/Layout |
|验签接口 | Host View 创建 |
|包限制和结构化错误 | Capability 业务实现 |

RPKS Loader 后续可以建立在同一 PackageReader 抽象上，但不能在没有完整分包合同前与 RPK Loader 强行合并生命周期。

## 11. 已验证事实、合理推断与待验证项

### 11.1 已验证事实

| ID | 事实 |
|---|---|
| F-001 | Toolkit 版本为 2.1.0，Case 001 同时有源码、build、debug/release RPK 和 RPKS |
| F-002 | `.ux` 包含 template、script、style |
| F-003 | build 产物没有独立模板和样式文件 |
| F-004 | 页面 JS 导出 VM、template 和 style |
| F-005 | 简单绑定编译为以 Page VM 为 `this` 的 JS 函数 |
| F-006 | 点击事件编译为事件类型到 VM 方法名的映射 |
| F-007 | 页面和应用模块使用 `$app_define$/$app_bootstrap$` |
| F-008 | `@system.*` import 转换为 `$app_require$("@app-module/system.*")` |
| F-009 | `app.js` 包含 App VM、Manifest、helper bundle 和全局样式入口 |
| F-010 | RPK 与 RPKS 都是 ZIP archive |
| F-011 | RPK 包含 CERT、Manifest、JS 模块、资源和构建元数据 |
| F-012 | RPKS 包含 base.srpk、Card RPK，release 还包含与外部 release RPK 相同的完整主 RPK |

### 11.2 合理推断

| ID | 推断 | 仍需的证据 |
|---|---|---|
| I-001 | JS Framework 在执行 RPK JS 前由 Runtime 内置加载 | 真实 Runtime 启动 Trace 或参考实现 |
| I-002 | `$app_define$` 建立模块注册表，`$app_bootstrap$` 提交当前启动模块 | JS Framework 源码或行为 PoC |
| I-003 | 数据响应式系统重新执行受影响的绑定函数并产生增量更新 | VM/Watcher 源码与状态更新 Trace |
| I-004 | Style Object 在 Runtime 中执行 selector 匹配并形成 computed style | Style Runtime 源码或 Trace |
| I-005 | `base.srpk` 与 Card RPK 用于主应用和卡片的分包安装/加载 | RPKS 规范与设备端 Loader 实现 |

### 11.3 待验证项

| ID | 待验证问题 | 推荐样本/方法 |
|---|---|---|
| V-001 | `$app_define$/$app_require$/$app_bootstrap$` 的精确合同 | 最小 QuickJS 行为 PoC + 参考 Framework |
| V-002 | `if/show/for/key` 的模板 JS 形态 | 新建 Dynamic Case 002 并用同版 Toolkit 编译 |
| V-003 | 自定义组件、props、slot 的产物形态 | Component Case 003 |
| V-004 | Binding Watcher 的依赖收集与 flush 边界 | Runtime Trace/Framework 源码 |
| V-005 | Style selector、继承、优先级和动态样式 | Style Case + Runtime 对照 |
| V-006 | 事件冒泡、捕获、参数和销毁语义 | Event Case + Runtime 对照 |
| V-007 | `META-INF/CERT` 的验签协议 | 联盟签名规范/官方实现 |
| V-008 | RPKS/SRPK 安装、升级和分包加载合同 | 联盟规范/官方设备行为 |
| V-009 | QuickJS 对该 Toolkit JS 语法和内建 API 的完整兼容差异 | 在 QuickJS 中逐 bundle 执行 |
| V-010 | debug 与 release bundle 在不同联盟 Toolkit 版本中的兼容边界 | 多版本 Golden Matrix |

## 12. Case 001 验收基线

### 12.1 Runtime 验收

Case 001 release RPK 必须未经修改完成：

1. 打开 RPK 并执行安全检查；
2. 读取验证状态和构建元数据；
3. 解析 Manifest；
4. 解析入口 `pages/Demo/index.js`；
5. 初始化 QuickJS 与内置 JS Framework；
6. 执行 `app.js`；
7. 执行入口页面 JS；
8. 获得 VM、template 和 style；
9. 显示首页标题和按钮；
10. 点击按钮执行 `onDetailBtnClick`；
11. 通过 `system.router.push` 进入详情页；
12. 点击详情页按钮，通过 `system.prompt` 显示提示；
13. 生命周期、JS、Core、Layout、Mount、Event 和 Capability 有 Trace。

### 12.2 Toolkit 验收

Toolkit 至少能够：

- inspect debug/release RPK；
- inspect debug/release RPKS 及内部分包；
- validate Manifest 与模块路径；
- 定位应用入口和页面 bundle；
- 报告 Toolkit 版本和 debug 标记；
- 输出安全限制与验证状态；
- 调用 Android Runtime Host 运行 release RPK。

### 12.3 基线使用规则

- Case 001 文件哈希变化必须显式更新研究记录；
- Runtime 不允许为 Case 001 写 package/path 特判；
- Case 001 通过只证明基础静态模板链路，不代表完整联盟兼容；
- 新增语法能力必须先增加对应 Golden Case，再扩展合同。

## 13. 关键决策与重点吸收点

### KD-ATR-001：标准 RPK 是 V1 Runtime 输入

QuickApp Kit V1 以联盟 Toolkit 生成的标准 RPK 为正式输入。Case 001 是首个 Golden Case，不是完整标准的替代品。

### KD-ATR-002：兼容标准 JS 产物

V1 直接兼容页面 JS 中的 VM、Template Descriptor 和 Style Object，不要求标准包包含自有 Template IR 或绑定编号。

### KD-ATR-003：稳定协议优先于 Bundle 实现细节

Runtime 依赖 `$app_define$/$app_require$/$app_bootstrap$`、Manifest、模块导出语义，不依赖 Webpack numeric ID、Loader 路径和压缩变量名。

### KD-ATR-004：JS Framework 与 C++ Core 分工

JS Framework 负责标准 JS 模块、VM、绑定函数、事件 Handler 和 Capability Proxy；C++ Core 接收规范化 typed data，维护平台无关动态渲染状态并输出 MountTransaction。

### KD-ATR-005：优化产物是可选演进路径

未来可以设计自有优化产物，但必须与标准 RPK 兼容路径汇入同一运行语义，且不能倒推为联盟 Toolkit 的已验证事实。

### 重点吸收点

1. **先研究 Runtime 的真实输入，再设计 Runtime。** 标准产物不是源码，也不是假设中的二进制 IR，而是包含 VM、模板和样式描述的可执行 JS bundle。
2. **静态 Template Descriptor 不等于跨帧 VDOM。** 它可以作为初始化和绑定描述；动态权威状态仍可由 C++ Core 维护。
3. **JS Framework 是标准兼容层。** 没有 `$app_*` 模块、VM、绑定和事件语义，标准 RPK 无法运行。
4. **Loader、Framework、Core 必须分层。** 包读取、JS 语义和平台无关渲染状态是三个不同问题。
5. **Case 驱动合同。** Case 001 锁定基础链路；动态结构、组件、事件和分包必须用后续 Case 补证后再定案。
