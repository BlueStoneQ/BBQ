/**
 * 2022-6-25
 * hash实现前端路由
 * https://danielxuuuuu.github.io/2020/02/23/%E5%89%8D%E7%AB%AF%E8%B7%AF%E7%94%B1%E7%9A%84%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86
 * 
 * https://juejin.cn/post/6844903906024095751#heading-5
 * 
 * 设计：
 * 1. 这里的path都是 #后面的部分，不包括#
 * 2. 防御不一定足够 主要是为了用代码描述前端路由的核心实现
 */

class HashRouter {
  constructor () {
    // route 到 callback的映射
    this.route2Callback = {}; 
    // 监听 load 和 hashchange事件，在这2个事件中需要默认执行 当前route对应的callBack (callBack的emit实就在这2个事件中)
    window.addEventListener('DOMContentLoaded', this._handle); // load事件在这也可以的
    window.addEventListener('hashChange', this._handle);
  }

  routeRegister (path, callback) {
    if (callback) {
      this.route2Callback[path] = callback;
    }
  }

  // 其实 浏览器会默认渲染history栈顶的url，所以push就是跳转 
  push (path) {
    window.location.hash = path; // 自己会自动在url中加上#
    // 这里会自动触发hashchange
  }

  replace (path) {
    window.location.replace(this._hash2location(path));
    // 这里会自动触发hashchange
  }

  // 根据hash 和 当前的url 拼出新的完整location url
  _hash2location (path) {
    const baseUrl = window.location.href.split('#')[0];
    return baseUrl + '#' + path;
  }

  _handle () {
    // 触发注册的相关路由对应的callback
    const callback = this.route2Callback[this._getRoute()];
    callback && callback();
  }

  _getRoute () {
    const hash = window.location.hash;
    return hash ? hash.split('#')[1] : '/';
    // const extractHashPath = url => (/#(.*)$/g.exec(url) || ["", ""])[1];
  }
}