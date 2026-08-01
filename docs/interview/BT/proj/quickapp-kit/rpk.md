# RPK 产物结构分析

## 目录

- [概述](#概述)
- [文件位置](#文件位置)
- [RPK 内部结构](#rpk-内部结构)
- [Debug vs Release 对比](#debug-vs-release-对比)
  - [文件大小对比](#文件大小对比)
  - [核心差异](#核心差异)
- [manifest.json 字段解析](#manifestjson-字段解析)
  - [Runtime 需要关心的字段](#runtime-需要关心的字段)
- [META-INF/build.txt](#meta-infbuildtxt)
- [META-INF/CERT 结构](#meta-infcert-结构)
- [页面 Bundle 结构](#页面-bundle-结构)
  - [关键观察](#关键观察)
- [app.js 结构](#appjs-结构)
- [Runtime 需要做的事](#runtime-需要做的事)
  - [1. 加载阶段](#1-加载阶段)
  - [2. 初始化阶段](#2-初始化阶段)
  - [3. 页面启动阶段](#3-页面启动阶段)
  - [4. 渲染阶段](#4-渲染阶段)
  - [5. 交互阶段](#5-交互阶段)
- [资源寻址](#资源寻址)
- [总结](#总结)

---

## 概述

RPK（Quick App Package）是快应用编译后的最终产物，本质上是一个 ZIP 压缩包。本文档分析 `quickapp-code-test1` 项目的 debug 和 release 两个 RPK 的内部结构。

---

## 文件位置

```text
quickapp-kit/quickapp-examples/quickapp-code-test1/dist/
├── com.example.case1.debug.1.0.0.rpk          (42 KB)
├── com.example.case1.release.development.1.0.0.rpk  (18 KB)
├── debug/                                      ← 解压后的 debug RPK
└── release/                                    ← 解压后的 release RPK
```

---

## RPK 内部结构

```
RPK (ZIP)
├── META-INF/
│   ├── CERT              ← 签名文件（内含 hash.json）
│   └── build.txt         ← 构建元信息
├── manifest.json         ← 应用描述、路由、display、features
├── sitemap.json          ← SEO 规则
├── app.js                ← 应用级 JS bundle
├── pages/
│   ├── Demo/index.js          ← 首页 bundle
│   └── DemoDetail/index.js    ← 详情页 bundle
├── CardDemo/
│   └── index.js               ← Widget bundle（第一阶段可忽略）
└── assets/
    └── images/logo.png        ← 静态资源
```

---

## Debug vs Release 对比

### 文件大小对比

| 文件 | Debug | Release | 压缩比 |
|---|---|---|---|
| **整体 RPK** | 42 KB | 18 KB | ~57% |
| app.js | 36 KB | 5 KB | ~86% |
| pages/Demo/index.js | 29 KB | 2.5 KB | ~91% |
| pages/DemoDetail/index.js | 31 KB | 2.9 KB | ~91% |
| CardDemo/index.js | 22 KB | 1.6 KB | ~93% |
| manifest.json | 1.5 KB | 1 KB | ~33% |
| META-INF/CERT | 3.5 KB | 3.9 KB | — |
| assets/images/logo.png | 3 KB | 3 KB | 无压缩 |

### 核心差异

| 维度 | Debug | Release |
|---|---|---|
| JS 压缩 | ❌ 未压缩，包含 webpack 调试信息 | ✅ UglifyJS 压缩 |
| 源码映射 | 包含完整 loader 路径 | 路径信息被移除 |
| manifest 格式 | 格式化 JSON | 单行压缩 JSON |
| config.debug | true | false |
| 代码可读性 | 可读 | 不可读 |

---

## manifest.json 字段解析

```json
{
  "package": "com.example.case1",        // 包名
  "name": "case1",                       // 应用名
  "versionName": "1.0.0",                // 版本名
  "versionCode": 1,                      // 版本号
  "minPlatformVersion": 1070,            // 最低平台版本
  "icon": "/assets/images/logo.png",     // 图标路径
  
  "features": [                          // 声明的系统能力
    { "name": "system.prompt" },         // Toast/Alert
    { "name": "system.router" },         // 页面路由
    { "name": "system.shortcut" },       // 快捷方式
    { "name": "system.fetch" }           // 网络请求
  ],
  
  "permissions": [                       // 权限声明
    { "origin": "*" }                    // 允许所有域名跨域
  ],
  
  "config": {
    "logLevel": "debug",
    "debug": true                        // debug=false for release
  },
  
  "router": {                            // 路由配置
    "entry": "pages/Demo",               // 入口页面
    "pages": {
      "pages/Demo": { "component": "index" },
      "pages/DemoDetail": { "component": "index" }
    },
    "widgets": { ... }                   // 卡片配置（第一阶段可忽略）
  },
  
  "display": {                           // 显示配置
    "titleBarBackgroundColor": "#f2f2f2",
    "titleBarTextColor": "#414141",
    "pages": {
      "pages/Demo": { "titleBarText": "快应用示例模版" },
      "pages/DemoDetail": { "titleBarText": "详情页" }
    }
  }
}
```

### Runtime 需要关心的字段

| 字段 | 用途 |
|---|---|
| `router.entry` | 启动时加载哪个页面 |
| `router.pages` | 页面路径 → JS 文件映射 |
| `features` | 预加载哪些 System Module |
| `display` | 默认 TitleBar 样式 |

---

## META-INF/build.txt

```
originType=quickapp-ide
toolkit=2.1.0
timeStamp=2026-07-25T15:51:37.256Z
node=v22.17.0
platform=darwin
arch=arm64
widget:CardDemo=22a01e867a68dca883b45be28b12d7c658c88846838e40783b2a445385f2bee4
app:app=680fb233f571737fa82f6abfe16b4d7c79c40bc5004d807e1b1c3e620309ff5c
```

- 记录构建环境信息
- 包含各 bundle 的 hash 值（用于增量更新）

---

## META-INF/CERT 结构

CERT 文件本身是一个嵌套 ZIP，包含 `hash.json`：

```text
CERT (ZIP)
└── hash.json    ← 各文件的 SHA256 哈希值
```

Runtime 可选择性校验签名和文件完整性。

---

## 页面 Bundle 结构（以 Demo 为例）

### Debug 版

Debug 版 `pages/Demo/index.js` 核心结构（变量名完整可读）：

```javascript
(function(){
    var createPageHandler = function() {
      return (() => { // webpackBootstrap
        var __webpack_modules__ = ({
        
          // ======= 模块 1: VM 定义（script） =======
          "script-loader!...!./src/pages/Demo/index.ux?uxType=page": ((module) => {
            module.exports = function __scriptModule__(module, exports, $app_require$) {
              var _system = $app_require$("@app-module/system.router");
              exports.default = {
                private: {
                  title: '欢迎体验快应用开发'
                },
                onInit() {
                  this.$page.setTitleBar({ text: '欢迎体验快应用开发' });
                },
                onDetailBtnClick() {
                  _system.default.push({ uri: '/pages/DemoDetail' });
                }
              };
            }
          }),
          
          // ======= 模块 2: 样式表（style） =======
          "style-loader!...!./src/pages/Demo/index.ux?uxType=page": ((module) => {
            module.exports = {
              ".wrapper": {
                "flexDirection": "column",
                "justifyContent": "center",
                "alignItems": "center"
              },
              ".wrapper .title": {
                "fontSize": "40px",
                "textAlign": "center",
                "color": "#000000",
                "_meta": { "ruleDef": [...] }
              },
              ".wrapper .btn": {
                "width": "450px",
                "height": "80px",
                "borderRadius": "40px",
                "backgroundColor": "#09ba07",
                "color": "#ffffff",
                "fontSize": "30px",
                "marginTop": "80px",
                "_meta": { "ruleDef": [...] }
              }
            }
          }),
          
          // ======= 模块 3: 模板树（template） =======
          "template-loader!...!./src/pages/Demo/index.ux?uxType=page&": ((module) => {
            module.exports = {
              "type": "div",
              "attr": {},
              "classList": ["wrapper"],
              "children": [
                {
                  "type": "text",
                  "attr": {
                    "value": function () { return this.title }
                  },
                  "classList": ["title"]
                },
                {
                  "type": "input",
                  "attr": { "type": "button", "value": "跳转到详情页" },
                  "classList": ["btn"],
                  "events": { "click": "onDetailBtnClick" }
                }
              ]
            }
          })
        });
        
        // webpack 模块缓存 + require
        var __webpack_module_cache__ = {};
        function __webpack_require__(moduleId) { ... }
        
        // ======= 入口：注册并启动组件 =======
        var $app_script$ = __webpack_require__("script-loader!...");
        
        $app_define$('@app-component/index', [], function($app_require$, $app_exports$, $app_module$) {
          $app_script$($app_module$, $app_exports$, $app_require$)
          if ($app_exports$.__esModule && $app_exports$.default) {
            $app_module$.exports = $app_exports$.default
          }
          $app_module$.exports.template = __webpack_require__("template-loader!...")
          $app_module$.exports.style = __webpack_require__("style-loader!...")
        });
        
        $app_bootstrap$('@app-component/index', { packagerVersion: "2.1.0" });
      })()
    };
    if (typeof window === "undefined") { return createPageHandler(); }
    else { window.createPageHandler = createPageHandler }
})();
```

### Release 版

Release 版 `pages/Demo/index.js`（UglifyJS 压缩，变量名被简写）：

```javascript
!function(){
  var t = function() {
    return (() => {
      var t, e = {
        100: t => {
          t.exports = function(t, e, a) {
            e.default = {
              private: { title: "欢迎体验快应用开发" },
              onInit() { ... },
              onDetailBtnClick() {
                router.push({ uri: "/pages/DemoDetail" })
              }
            }
          }
        },
        63: t => {
          t.exports = {
            ".wrapper": { flexDirection: "column", justifyContent: "center", alignItems: "center" },
            ".wrapper .title": { fontSize: "40px", textAlign: "center", color: "#000000" },
            ".wrapper .btn": { width: "450px", height: "80px", borderRadius: "40px", backgroundColor: "#09ba07", ... }
          }
        },
        764: t => {
          t.exports = {
            type: "div", attr: {}, classList: ["wrapper"],
            children: [
              { type: "text", attr: { value: function() { return this.title } }, classList: ["title"] },
              { type: "input", attr: { type: "button", value: "跳转到详情页" }, classList: ["btn"], events: { click: "onDetailBtnClick" } }
            ]
          }
        }
      };
      var a = {};
      function r(t) { ... }
      t = r(100);
      $app_define$("@app-component/index", [], function(e, a, n) {
        t(n, a, e);
        n.exports.template = r(764);
        n.exports.style = r(63);
      });
      $app_bootstrap$("@app-component/index", { packagerVersion: "2.1.0" });
    })()
  };
  if ("undefined" == typeof window) return t();
  window.createPageHandler = t;
}();
```

### Debug vs Release 对 Runtime 的影响

| 维度 | Debug 版 | Release 版 |
|---|---|---|
| 变量名 | 完整可读（`__webpack_modules__`） | 压缩简写（`t`、`e`、`a`） |
| 模块 key | webpack loader 完整路径字符串 | 数字 ID（100、63、764） |
| source map | 包含 base64 内联 | 无 |
| JS 结构 | 与 Release 完全一致 | — |
| Runtime 执行逻辑 | 完全相同 | 完全相同 |

**Runtime 对两者的处理方式完全一样** — 都是 eval 整个 bundle，等待 `$app_define$` + `$app_bootstrap$` 被调用。压缩只影响文件体积和可读性，不影响执行语义。

### Runtime 如何判断 Debug/Release

通过 `manifest.json` 的 `config.debug` 字段：

```json
{
  "config": {
    "logLevel": "debug",
    "debug": true         // true = debug, false = release
  }
}
```

Runtime 根据此字段决定：
- `debug: true` → 开启详细 console 日志、JS 异常堆栈打印
- `debug: false` → 仅记录 error 级别日志，性能优先

**我们的开发策略：** 开发阶段使用 Debug RPK（可读性好、方便调试），Runtime 两种都兼容。

### 关键观察

1. **模板已经是 JSON 对象** — 不需要解析 `.ux` 或 HTML
2. **样式已经是 JS 对象** — 不需要 CSS 解析器
3. **VM 定义清晰** — `private` 里的 data、`onInit` 等方法
4. **数据绑定是 function** — `value: function() { return this.title }`
5. **事件是字符串映射** — `click: "onDetailBtnClick"`

---

## app.js 结构

应用级 bundle，在所有页面之前加载：

```javascript
// 注册全局变量
global.$utils = { showToast: ... };
global.$apis = { getApi: ... };

// 注册应用
$app_define$("@app-application/app", [], function(o, r, n) {
  n.exports.manifest = { ... };  // manifest 副本
  n.exports.onCreate = function() { ... };
});

$app_bootstrap$("@app-application/app", { packagerVersion: "2.1.0" });

// 写入全局 manifest
global.manifest = { ... };
```

---

## Runtime 需要做的事

根据 RPK 结构，Runtime 需要实现：

### 1. 加载阶段

```text
读取 RPK → 解压 ZIP → 读取 manifest.json → 解析路由表
```

### 2. 初始化阶段

```text
创建 JS 引擎 → eval(framework.js) → eval(app.js)
```

### 3. 页面启动阶段

```text
根据 router.entry → 加载 pages/Demo/index.js → eval
→ $app_define$ 注册组件 → $app_bootstrap$ 启动
→ 拿到 template/style/VM
```

### 4. 渲染阶段

```text
遍历 template tree → 匹配 classList → 合并 style
→ 调用 Yoga 计算布局 → 生成渲染指令 → 平台渲染
```

### 5. 交互阶段

```text
用户点击 → 找到 events.click 对应的方法名
→ 在 VM 上调用该方法 → 执行 JS（可能调用 system.router）
→ 触发页面跳转或状态变更
```

---

## 资源寻址

RPK 内的资源路径是相对于 RPK 根目录的：

```javascript
// manifest.json 中
"icon": "/assets/images/logo.png"

// Runtime 解析为
rpk://assets/images/logo.png

// 或解压后的实际路径
/path/to/rpk-extracted/assets/images/logo.png
```

---

## 总结

RPK 是一个**高度结构化的产物**，已经完成了：

- 模板编译（.ux → JSON tree）
- 样式编译（CSS → JS 对象）
- 模块打包（webpack bundle）
- 资源收集
- 签名生成

Runtime 不需要实现编译器，只需要**消费这些编译好的产物**，实现宿主 ABI（`$app_define$` / `$app_bootstrap$` / `$app_require$`）和渲染即可。
