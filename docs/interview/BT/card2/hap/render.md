**结论**

HAP Toolkit 的本质是：

> **把 `.ux` 编译成 Runtime 可直接注册执行的 JS 模块，再连同 Manifest 和资源封装成 RPK。**

HAP Runtime 加载后：

> **执行 `app.js` 和页面 `index.js`，JS Framework 根据其中的 template/style/VM 创建 Android View；原生点击再反向调用页面 VM 方法。**

## 1. Toolkit 构建后是什么

Case 001 的构建目录：

```text
build/
├── manifest.json
├── app.js
├── pages/
│   ├── Demo/index.js
│   └── DemoDetail/index.js
├── CardDemo/index.js
├── assets/images/logo.png
└── sitemap.json
```

然后封装为：

```text
dist/
├── com.example.case1.debug.1.0.0.rpk
├── com.example.case1.debug.1.0.0.rpks
├── com.example.case1.release.development.1.0.0.rpk
└── com.example.case1.release.development.1.0.0.rpks
```

### 页面 JS 里面有什么

源码：

```html
<template>
  <div class="wrapper">
    <text class="title">{{ title }}</text>
    <input type="button"
           value="跳转到详情页"
           onclick="onDetailBtnClick"/>
  </div>
</template>
```

编译后，页面 `index.js` 同时包含三部分：

```js
// VM
{
  private: { title: '欢迎体验快应用开发' },

  onDetailBtnClick() {
    router.push({ uri: '/pages/DemoDetail' })
  }
}

// Template
{
  type: 'div',
  children: [
    {
      type: 'text',
      attr: {
        value: function () {
          return this.title
        }
      }
    },
    {
      type: 'input',
      attr: {
        type: 'button',
        value: '跳转到详情页'
      },
      events: {
        click: 'onDetailBtnClick'
      }
    }
  ]
}

// Style
{
  '.wrapper': { ... },
  '.wrapper .title': { fontSize: '40px', ... },
  '.wrapper .btn': { width: '450px', ... }
}
```

最后注册：

```js
$app_define$('@app-component/index', [], factory)
$app_bootstrap$('@app-component/index', {
  packagerVersion: '2.1.0'
})
```

所以页面产物不是普通业务 JS，而是：

```text
VM + Template + Style + 模块注册/启动代码
```

### 三个全局函数

| 函数 | 本质 |
|---|---|
| `$app_define$` | 向 Runtime 注册 App/Page 模块 |
| `$app_bootstrap$` | 告诉 Runtime 启动这个模块 |
| `$app_require$` | 获取 Runtime 提供的系统能力模块 |

例如：

```js
$app_require$('@app-module/system.router')
```

返回的是 Android Runtime 提供的路由能力，不是 RPK 内的 npm 模块。

## 2. RPK 加载后怎么运行

### 启动

```text
Android Runtime 打开 RPK
-> 校验包和 Manifest
-> 读取 router.entry = pages/Demo
-> 创建 JS Runtime
-> 注入 $app_define$ / $app_bootstrap$ / $app_require$
-> 执行 app.js
-> 注册并启动 App VM
-> 加载 pages/Demo/index.js
-> 注册并启动 Page VM
```

`$app_define$` 将模块定义放入 Runtime 模块表：

```text
@app-application/app -> App Module
@app-component/index -> Page Module
```

`$app_bootstrap$` 再创建对应的应用或页面实例。

## 3. 首次渲染

页面模块导出：

```text
Page VM
Template
Style
```

JS Framework 执行：

```text
创建 Page VM
-> 初始化 title
-> 执行 onInit
-> 读取 Template
-> 执行动态表达式 value()
-> 得到 "欢迎体验快应用开发"
-> 匹配 Style
-> 请求 Android Runtime 创建原生控件
```

Android 侧最终形成：

```text
Container View
├── Text View("欢迎体验快应用开发")
└── Button/Input View("跳转到详情页")
```

这里应谨慎描述为：

> JS Framework 根据 Template 生成原生节点操作，Android Runtime 执行 View 创建和更新。

目前产物能证明存在 `template/style/VM` 和事件定义；**不能仅凭 Toolkit 源码确认 HAP 内部存在一个正式命名、批量化的 `MountTransaction` 指令集。**

## 4. 点击怎么运行

编译产物已经保存：

```js
events: {
  click: 'onDetailBtnClick'
}
```

完整链路：

```text
用户点击 Android Button
-> Android View Listener 捕获 click
-> Android Runtime 找到该节点的 click 绑定
-> 通过 J2V8 调用 JS Framework 的事件入口
-> JS Framework 在当前 Page VM 查找 onDetailBtnClick
-> 执行该方法
```

页面方法：

```js
onDetailBtnClick() {
  router.push({
    uri: '/pages/DemoDetail'
  })
}
```

继续：

```text
JS 调用 system.router.push
-> $app_require$ 获取 Native Router Module
-> Bridge 调用 Android Runtime
-> Runtime 根据 Manifest 找到 pages/DemoDetail
-> 创建新页面容器
-> 加载 pages/DemoDetail/index.js
-> 重复 Page VM + Template + Style 渲染流程
```

## 一条完整主链路

```text
.ux 源码
-> Toolkit 编译
-> app.js + 页面 index.js + Manifest + Assets
-> RPK
-> Android Runtime 解包并读取 Manifest
-> JS Runtime 执行 app.js
-> 加载入口页面 JS
-> $app_define$ 注册 VM/Template/Style
-> $app_bootstrap$ 创建页面
-> JS Framework 计算模板动态值
-> Android Runtime 创建原生 View
-> 用户点击
-> Native Listener
-> JS 页面 Handler
-> router.push
-> 加载并渲染下一页面
```

一句话记忆：

> **HAP 的页面 JS 是可执行的页面描述包：VM 管逻辑，Template 管结构，Style 管外观，Runtime 把它落成 Android View。**