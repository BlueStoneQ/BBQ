- 请迁移到掘金中保存
## 体悟
0. 注册机制：
  1. 注册的本质就是把函数等push到我们设计的数据结构中，例如队列，栈等，来作统一处理
1. 将分支用状态表的数据结构管理起来
2. 自己设计的数据结构，注册机制就是一个很有用的机制。提供注册接口，把使用者的逻辑等记录到我们的管理用的数据结构中，例如这里的状态表。然后，我们内部给出管理方案。
3. 链式调用设计：例如在对象中的实现，一般就是在方法中返回this，保证方法之间的链式调用
5. 每一个路由匹配到的方法，会被管理在数组中，而执行的流程则是中间件机制执行。也就是在router里，每一个路由都内嵌了一个中间件机制。
6. 数据结构设计 + 结构操作设计（算法设计)
7. 阅读计划：
  1. blog提纲挈领
  2. package.json: main + depandence
  2. 看看常规用法：然后沿着用法去阅读整个流程
  3. 工程架构设计
  4. 编码血肉细节营养：对你目前的编程能力有很大帮助
8. 试着从作者的角度去思考，假如你是作者，你要解决这样的问题，你会怎么考虑，怎么设计处理

## 细节血肉
1. 关于函数注释，例如对象参数内部设计的注释：
```js
/**
 * @param {Object=} options
 * @param {Boolean=} options.throw throw error instead of setting status and header
 * @param {Function=} options.notImplemented throw the returned value in place of the default NotImplemented error
 * @param {Function=} options.methodNotAllowed throw the returned value in place of the default MethodNotAllowed error
 * @returns {Function}
 */

Router.prototype.allowedMethods = function (options) {}
```
2. 函数参数的默认值：
```js
// 当然 es6有更好的写法
Router.prototype.register = function (path, methods, middleware, opts) {
  opts = opts || {};
}
```
3. 语义化处理，提高可读性，读代码就像在读英文文章一样，只不过这篇文章按照语言规则告诉计算机我要做什么
```js
// 某函数内
var router = this;
var stack = this.stack;
```
4. 对象中的方法保持链式调用：
```js
// 返回当前实例
return this;
```
5. 思考下Router 和 Layer的职能划分 好处呢
  1. Layer其实管理着一个路由，一个路由的概念就是 path + method: middlewares的映射
  ```js
    this.path/this.regexp + this.methods: this.stack
  ```
  2. Router在register时会生成Layer
  3. router里则有多对路由关系 - 这些路由关系各自的内部管理就由layer管理
  ```js
    // 数据模型
    this.stack = { Layer1, Layer2, ... }
  ```
6. koa-compose返回的其实是一个启动器，也就是所谓类链式调用的第一链，第一链调用后才会调用第二链, 第三链...
7. 关于Router.protoType.routes:
   1. routes的目的是生成koa中间件，也就是把router包装成koa中间件（该中间件就是dispatch,中间件的作用就是利用参数ctx + next参与每一次http通信）
   2. 中间件：就是把ctx + Router实例结合使用

## 参考
1. [koa-router原理解析](https://juejin.im/post/5ddbf911e51d4523485eeac9)