/**
 * 预请求
 * 1. retry在fetch内部封装，和预请求单独开
 * 2. 三端设计：注册端 + 触发端 + 获取端
 */
class PreFetch {
  constructor () {
    this.map = new Map();
  }

  register (path, taskQueue, injectParams = {}) {
    this.map.set(path, {
      taskQueue,
      injectParams
    });
  }

  emit (path) {
    if (!this.map.has(path)) return;

    const result = [];
    const item  = this.map.get(path);
    const { taskQueue, injectParams } = item;
    const mergedParams = this._mergeParams(injectParams, queryParams);
    
    for (const task of taskQueue) {
      result.push(task(mergedParams));
    }

    item.preFetchPromises = result;
  }

  getPreFetchPromises (path) {
    return this.map.get(path).preFetchPromises;
  }
}

// 在vue-router/react-router中在路由变化时，通过AOP之类的注入prefetch.emit()来触发预请求
// ❓：vue-router/小程序/react-router 我们要在哪些地方拦截呢

// 小程序拦截：拦截go, 当时美团做了路由的统一封装，使用go，我们使用AOP对go进行了封装
- wx.navigateTo -> this.go()