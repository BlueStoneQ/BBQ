/**
 * 本地通过插件自定义的接口
 */
module.exports = [{
  method: 'get',
  path: '/local/dev/getCompList',
  handlerCreate: pluginCtx => async (ctx, next) => {
    try {
      ctx.body = {
        code: 1,
        data: 'local/dev/getCompList'
      };
    } catch(err) {
      ctx.body = {
        code: 1,
        error: err,
        message: 'local/dev/getCompList 接口报错'
      }
    }
  }
}, {
  method: 'get',
  path: '/local/dev/getPageInfo',
  handlerCreate: pluginCtx => async (ctx, next) => {
    ctx.body = 'local/dev/getPageInfo';
  }
}, {
  method: 'post',
  path: '/local/dev/savePageInfo',
  handlerCreate: pluginCtx => async (ctx, next) => {
    // 保存线上搭建好的页面到本地
    ctx.body = 'local/dev/savePageInfo';
  }
}]