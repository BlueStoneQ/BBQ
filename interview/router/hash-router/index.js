/**
 * hash 路由
 */
class Router {
  // 路由基本数据结构
  constructor () {
    this.routes = {};
    this.currentUrl = '';
  }
  // 订阅：用相应的回调函数callback订阅对应的path
  route(path, callback) {
    this.routes[path] = callback || function() {};
  }
  // 功能：刷新
  refresh() {
    // 获取当前路径中的hash路径
    this.currentUrl = location.hash.slice(1) || '/';
    // 用该hash为索引去触发routes中对应的回调
    this.routes[currentUrl]();
  }
}
