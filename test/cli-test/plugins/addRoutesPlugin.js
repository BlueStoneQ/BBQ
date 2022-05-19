const api = require('../server/api');
const apiList = require('../server/api');
/**
 * 在cli的dev-server上注册新的路由
 */
module.exports = () => ({
  name: 'addRoutesPlugin',
  async beforeRouteRegister(context) {
    const router = context;
    // 遍历 注册
    apiList.forEach(item => {
      const { method, path, handlerCreate } = item;
      // 这里的this 就是插件调用的时候的上下文 传入的pluginCtx 一些暴露的方法 可以通过pluginCtx获得
      router[method](path, handlerCreate(this));
    });
  }
})