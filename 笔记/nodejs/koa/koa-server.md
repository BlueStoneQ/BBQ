# 中间件注册结构
- koa-error-middleware
- koa-favicon
- koa-logger
- koa-cookie
- koa-session
- koa-limit
- koa-bodyparser
- koa-query
- koa-router

# koa自定义中间件
## 异常处理中间件: koa中间件中异常的处理
- https://segmentfault.com/a/1190000023327434
- 这里还有一个更进阶版
```js
// middlewares/catcherror.js
// 定义处理异常的中间件
const createErrCatchMiddleWare  = (ops, app) => {
  return async(ctx, next) => {
    try{
        await next();
    }catch(error){
        if(error.errorCode){
            console.log("捕获到异常")
            return ctx.body = errror.msg;
        }
    }
  }
}

// 中间件放在洋葱的最外层：注册在最前面, 这样利用洋葱模型可以捕获到接下来的错误
koaApp.use(createErrCatchMiddleWare())
```

# 案例1: 
- https://juejin.cn/post/6844903855772303367
- https://github.com/bayi-lzp/koa-template
## router设计
### publicRouter
### privateRouter
- 会有jwt: router.use(jwtMiddleware)
## middle-ware
### koa-jwt
### jsonwebtoken
### koa-views
- koa的模版能力，类似express.app.render()
### koa-helmet
- 设置安全相关http-head： https://juejin.cn/post/6844903699584647175