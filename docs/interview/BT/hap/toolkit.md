## 总链路
页面定义 → pageVM → Proxy 状态 + JS DOM + 事件绑定
状态变化 → watcher 入队去重 → microtask flush
         → DOM 更新 → JsBridge.sendRenderIntentTransaction
## 构建总流程
.ux 文件
  │  ux-loader（webpack loader，总调度）
  ├─ template 段 → hap-compiler → JSON 节点树  ─┐
  ├─ style 段    → hap-compiler → 样式对象      ─┤ 拼进
  └─ script 段   → 透传+改写import              ─┘ $app_define$ 外壳
  │
  ▼
$app_define$('@app-component/x', [], factory)   // factory 里挂 template/style/script
[ + $app_bootstrap$(...) 若是页面 ]
  │  webpack 打包 + 依赖分析（管 deps）
  ▼
.hap 包（运行时 module loader 消费 $app_define$）

## 构建工具链
- 本质就是webpack来构建，构建的总工就是webpack的一个loader：ux-loder，当处理到ux文件，走ux-loader
## ux-loader
```md
ux-loader 是编译链的总装工——
1. 调 hap-compiler 拿到 template(JSON树)/style(样式对象)/script 三段产物，
2. 拼字符串包进 $app_define$(id, [], factory)，
3. factory 里把三段挂到 module.exports，
4. 页面再追加 $app_bootstrap$。
5. deps 数组写死为空，真实依赖交给 webpack 的模块依赖图分析——hap 不自己算 deps。这就是"编译产物 → 运行时可消费模块"的最后一跳。
```
## output：rpk格式
输出一个 .rpk 应用包，主要装：
manifest.json       应用配置、路由、能力声明
app.js              应用定义
Home/index.js       页面及其依赖的组件、业务代码
公共 JS chunk        配置了代码拆分时存在
图片、字体等资源
模板和样式已经编译进 JS，JS framework 由引擎提供，业务包使用它提供的方法运行。

### page.js
剥掉 webpack 包装，核心就是登记组件定义，再启动页面根组件：
```js
$app_define$('@app-component/index', [], function (
  requireModule, exports, module
) {
  module.exports = {
    data: () => ({ title: 'Hello' }),
    onInit() {},
    onClick() {
      this.title = 'Hi'
    },
    template: {
      type: 'div',
      children: [{
        type: 'text',
        attr: { value() { return this.title } },
        events: { click: 'onClick' }
      }]
    },
    style: {}
  }
})

$app_bootstrap$('@app-component/index', {})
```
它带的是状态初值、业务方法、模板对象树、样式对象；DOM 实例和响应式依赖在运行时才创建。子组件也登记定义，由页面构建时实例化。

