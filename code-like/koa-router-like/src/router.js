/**
 * 1. routes： 返回koa中间件
 * 2. use: 注册
 */

function Router() {
  if (!(this instanceof Router)) {
    return new Router();
  }
  // 初始化数据结构
  // 映射表: 记录path和handler之间的映射
  this.stack = {}; 
}

Router.prototype.use = function(path, handler) {
  
}


Router.prototype.routes = function() {
  return function(ctx, next) {

    next();
  }
}