### app.js

`rpk` 本质是 ZIP。实际样例 `Helloworld.rpk` 解压后只有：

```text
app.js
Hello/hello.js
manifest.json
icon.png
```

`app.js` 不是业务页面，而是应用入口：webpack 包装业务模块，调用 `$app_define$` 注册应用，再调用 `$app_bootstrap$` 启动应用。它把 `manifest` 放进应用导出对象，供框架读取。

最小化后，核心可以理解成：

```js
// app.js
const manifest = {
  router: { entry: 'Hello', pages: { Hello: { component: 'hello' } } }
}

$app_define$('@app-application/app', [], (_, exports, module) => {
  module.exports = { manifest }
})
$app_bootstrap$('@app-application/app')
```

### page.js

真实文件路径是 `Hello/hello.js`。它也有 webpack 外壳，但业务核心只有三块：`template`、`style`、`script`。模板和样式在打包时已经变成 JS 对象，运行时不再解析原始标签和 CSS 文本。

```js
// Hello/hello.js
const template = {
  type: 'div',
  children: [{ type: 'text', attr: { value() { return this.title } } }]
}
const style = { '.root': { flex: 1 } }
const script = {
    data: () => ({ title: 'Hello' }),
    onInit() {
        this.title = 'Hi'
    }
}

// 本质上 是注册在一个js侧的map
// define：把组件的模板、样式、状态和方法登记成一份可复用的组件定义
$app_define$('@app-component/hello', [], (_, exports, module) => {
  module.exports = { ...script, template, style }
})
// 根据path来找到对应的页面/组件定义（就是上面app_define的）
// bootstrap：找到入口组件定义，创建根 VM，进而实例化整棵页面 DOM。
$app_bootstrap$('@app-component/hello')
```

运行时链路只有一条：

```text
app.js → 创建 App
Hello/hello.js → 创建 Page/Component
template 对象 → 实例化 JS DOM
data.title 被读取 → 建立 watcher 依赖
data.title 修改 → 修改 DOM 属性 → 批量通知 Native
```

## QA
1. Q: 如果是一个组件
- 组件可能会被多个地方使用，也就是会有多个实例
- 那么 每个实例加载的时候 都会执行一次 define + bootstrap吗

A:
不会。
- `$app_define$`：组件代码加载时执行一次，把组件定义注册到表里；多个实例共享这份定义。
- `$app_bootstrap$`：页面入口执行一次，用来创建页面根 VM；普通子组件不会为每个实例执行。
- 每次使用组件时，框架直接从注册表取定义，执行 `new XVm(...)` 创建独立实例；每个实例各自拥有状态和生命周期。

本质：**定义只登记一次，实例可以创建多次。**