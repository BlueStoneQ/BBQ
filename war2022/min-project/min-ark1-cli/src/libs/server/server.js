const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-body');
const router = require('./routes/index');

const startServer = async (cliContext) => {
  const app = new Koa();

  // 这里插一个插件的hooks: beforeRouteRegister
  await cliContext.pluginDriver.runHooks('beforeRouteRegister', { router });

  app.use(cors());
  app.use(bodyParser());
  // 按一定顺序注册koa中间件
  app.use(router.routes());
  app.use(router.allowedMethods());
  /*
  * router.allowedMethods()作用： 这是官方文档的推荐用法,我们可以
  * 看到 router.allowedMethods()用在了路由匹配 router.routes()之后,所以在当所有
  * 路由中间件最后调用.此时根据 ctx.status 设置 response 响应头 
  */

  // 打开http://127.0.0.1:3000 可以访问该服务
  app.listen(3000);
}

// 调用方：使用startServer 当然 这里用单例模式处理下最好 避免重复起服务
module.exports = startServer;