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