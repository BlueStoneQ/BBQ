/**
 * 渐进式实现下koa-router
 * 1. [router原理性实现](https://juejin.im/post/5ec488adf265da771b2fcded?utm_source=gold_browser_extension#heading-6)
 * 2. 该like请迁移到个人github中
 */

 /**
  * 数据结构设计：
  * 容器：
  * stack = [{
  *   path: , // ctx.url
  *   method: , // http方法
  *   middleware: // 中间件，routerHandler, 可以统一处理成数组，一个路由url+method: 可以有多个handler
  * }]
  */

 class Router {
  constructor() {
    this.stacks = [];
  }

  /**
  * 注册路由：本质就是操作数据结构（push进stack），记录url + method => middleware的映射关系
  */
  register(path, method, middleware) {
    this.stacks.push({ path, method, middleware });
  }

  /**
   * 常用方法post的注册
   */
  post(path, middleware) {
    this.register(path, 'post', middleware);
  }

  /**
   * 常用方法get的注册
   */
  get(path, middleware) {
    this.register(path, 'get', middleware);
  }

  /**
   * router中间件：用于适配到koa机制中
   * @returns {Function} koa中间件 
   */
  routes() {
    return async (ctx, next) => {
      // 获取请求的url + method (this.stack中的索引)
      const { url: u, method } = ctx;
      const url = u === '/index' ? '/': u;
      const { stacks } = this;
      let route; // 记录处理当前路由的middleware
      // 遍历stack获取到当前url+method对应的middle
      for (const stack of stacks ) {
        const { path, method:m, middleware } = stack;
        if (path === url && m === method) {
          route = middleware;
          break;
        }
      }
      // 如果route是函数 则执行； 其实可以统一处理为数组，例如在注册时 利用函数的剩余参数 或者 直接为数组
      if (typeof route === 'function') {
        // 这里的路由本质上也是中间件 在这里代替当前中间件去调用next
        await route(ctx, next);
        return;
      } 
      // 中间件调用next
      await next();
    }
  }

 }

 module.exports = Router;