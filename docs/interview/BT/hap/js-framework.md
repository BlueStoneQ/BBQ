## JS framework 做什么、提供什么
把这些rpk中的东西变成有状态、能响应事件、能更新界面的运行实例。

| 提供的入口/能力 | 本质 |
|---|---|
| `$app_define$` | 执行工厂，保存导出的应用/组件定义 |
| `$app_bootstrap$` | 启动入口；页面入口创建根 `pageVM` |
| `$app_require$` | 取得框架提供的能力模块，如路由 |
| Native 调用的页面入口 | 创建、销毁页面，接收事件和生命周期通知 |
| 内部 VM、响应式、DOM、调度 | 创建状态与 JS DOM，建立依赖，批量提交变化 |


## runtime方法
1. 内存中的模块表
2. define 如何登记 factory
3. bootstrap 如何消费定义创建 pageVM
4. require 如何从模块表取依赖
5. 最小调用示例
### 核心数据结构：moduleRegistryMap
- 模块注册表
```ts
// moduleId 是从 modulePath产生的
const moduleRegistryMap = new Map<moduleId, moduleInfo>()
```
### $app_define$
- rpk 执行时，如何把 factory 产出的页面/组件定义登记到 JS framework（具体就是moduleRegistryMap）
```js
// 定义
const $app_define$ = function(moduleId, deps, factory) {
    // 生成页面的module，该module可以传入到factory中完成proxy的响应式等处理,并把响应式处理后的页面信息挂载到module上，这就是运行时的module化，本质上还是利用来函数的访问域隔离
    const module = { export: {} }

    // module传入到页面的factory中完成挂载等，响应式化是此刻处理吗？
    factory(
        $app_require$,
        module.exports,
        module
    )

    // 
    moduleRegistryMap.set(moduleId, module)

// 调用

//  factory 把静态编译产物和脚本定义组装成一个可被 pageVM 消费的页面定义。
}
```
### $app_bootstrap$
- 从 moduleRegistry 取出页面定义，创建根 pageVM并消费，启动页面
```js
const $app_bootstrap$ = function(moduleId, config) {
    const module = moduleRegistry.get(moduleId)
    const pageDefinition = module.export

    const pageVM = new PageVM()

    
}
```
### $app_require$
- factory 执行期间，如何按模块 ID 取依赖模块,其实就是查取moduleRegistryMap
```js
const $app_require$ = function(moduleId) {
  return moduleTable.get(moduleId).exports
}
```