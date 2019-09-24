/**
 * H5 router
 */
class Router {
  constructor() {
    this.routes = {};
    this._bindPopstate();
  }

  // 初始化路由 - 类似refresh
  init(path) {
    // 地址栏path更新
    history.replaceState({path: path}, null, path);
    // 执行对应path的路由变化监听函数
    this.routes[path] && this.routes[path]();
  }

  // 订阅：将路由和对应的路由变化监听函数存储在一起
  route(path, callback) {
    this.routes[path] = callback || function() {};
  }

  // 触发：触发path对应路由回调
  go(path) {
    // 地址栏变化
    history.pushState({path: path}, null, path);
    this.routes[path] && this.routes[path]();
  }

  // 私有方法
  _bindPopstate() {
    window.addEventListener('popstate', e => {
      let path = e && e.path;
      this.routes[path] = this.routes[path]();
    });
  }
}