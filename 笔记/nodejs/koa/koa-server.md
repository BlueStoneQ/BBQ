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
## 一个自动会自动注册当前目录下的controller到router实例上的写法
## 自定义中间件
### loggerMiddleware
- 使用位置：洋葱最外层
- 使用到了 log4js: https://zhuanlan.zhihu.com/p/22110802
- 日志记录时机：在await next()之后
```js
// koa-middlerware
const getRemoteAddr = (ctx) => ctx.headers['x-forwarded-for']
  || ctx.ip 
  || ctx.ips 
  || (ctx.socket && (ctx.socket.remoteAddress || (ctx.socket.socket && ctx.socket.socket.remoteAddress)))

const loggerMiddleware = (ctx, next) => {
  // 收集日志信息
  // 1. 耗时
  const start = Date.now()
  await next()
  const spendTime = Date.now() - start

  // 2. 远程地址
  const remoteAddr = getRemoteAddr(ctx)
  // 拼接日志文本
  const logText = `${ctx.method} ${ctx.status} ${ctx.url} 请求参数: ${JSON.stringify(ctx.request.body)} 响应参数: ${JSON.stringify(ctx.body)} - ${remoteAddr} - ${spendTime}ms`
  // 记录日志
  logger.info(logText)
}
```
- 配置logger4js:
```js
defaultConfig = {
  appenders: [{
    type: "console",
    dateFile: {
        type: 'dateFile',
        filename: config.logPath, pattern: '-yyyy-MM-dd'
    }
  }],
  categories: {
    default: {
        appenders: ['console', 'dateFile'],
        level: 'info'
    }
  }
}
```
### errorHandler
- 中间件管道的开头：洋葱外层（仅在在logger中间件内侧）
- 对于洋葱向心的中间件中throw 的 error进行处理：format错误为统一格式 + 并将该错误信息传给客户端
```js
// 这个middleware处理在其它middleware中出现的异常
// 并将异常消息回传给客户端：{ code: '错误代码', msg: '错误信息' }
const errorHandler = (ctx, next) => {
  return next().catch(err => {
    // 运行时错误,无指定的业务码
    if (err.code === null) logger.error(err.stack)
    // 手动抛出的错误处理：format + 发送给客户端
    ctx.body = {
      code: err.code || -1, // 业务码
      data: null,
      msg: err.message.trim()
    }

    ctx.status = 200 // 保证返回状态是 200, 这样前端不会抛出异常
    return Promise.resolve()
  })
}
```
### responseHandler
- 中间件管道的尾部：洋葱核心
```js
// 这个middleware用于将ctx.result中的内容最终回传给客户端
// 回传的格式遵循这样的格式：{ code: 0, msg: any data: any }
// 也就是说 其他的中间件不会把消息自己传回给客户端 而是 经过层层中间件后 在洋葱核心的responseHandler将消息传回给客户端
const responseHandler = (ctx) => {
  if (ctx.result !== undefined) {
    // 其实就是 ctx.response.type 就是设置响应 Content-Type 通过 mime 字符串或文件扩展名
    ctx.type = 'json'
    ctx.body = {
      code: 200,
      msg: ctx.msg || '',
      data: ctx.result
    }
  }
}
```
## middle-ware
### koa-jwt
### jsonwebtoken
- 种token:
  - 发生在login阶段，在controller.login中处理：
  ```js
  // 取出 userName + passWord
  const {userName, password} = ctx.request.body
  // 校验1: 是否携带合法的 userName + passWord
  if (!userName || !password) {
    // 校验不通过 抛出错误 到错误处理中间件统一处理
    throw new InvalidQueryError()
  }
  // 校验2：通过model.User去查数据库 User表 是不是有这个注册用户
  const user = await userServices.login({
    userName: userName,
    password: password
  })
  // 判断 数据表 查询给出的结果 是不是存在并且合法
  if (!user) {
  // 数据表中没有该用户 则挂载该信息到ctx上
    ctx.result = ''
    ctx.msg = '用户不存在'
  } else {
  // 数据表中有该用户 则为该用户生成并种JWT
    ctx.result = jwt.sign({
      data: user._id, // 我们在jwt的payload中编码进的用户身份数据 是 user._id
      // 设置 token 过期时间
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 60 seconds * 60 minutes = 1 hour
    }, config.secret)
  }

  // 登录成功与否 都进入下一个中间件处理本次中间件挂载的信息
  return next()
  ```
- 校验token:
  - 在当前路由中增加一个校验中间件jwtChecker
  - 取出request.header中的token：
    - ctx.request.headers.authorization.slice(7)
  - 使用 jsonwebtoken 进行校验：
    - ctx.jwtData = jwt.verify(token, config.secret)
      - jwtData中就有我们之前的放在jwt中的payload中的一些用户数据（这里具体就是在login时种的user._id）
      - 服务端的秘钥，不能泄漏
  - 校验失败：在这个过程中如果抛出错误 则证明校验失败 token不合格：
    - throw {code: 401, message: 'no authorization'}
  - 校验通过：静默：则next()
### koa-views
- koa的模版能力，类似express.app.render()
### koa-helmet
- 设置安全相关http-head： https://juejin.cn/post/6844903699584647175