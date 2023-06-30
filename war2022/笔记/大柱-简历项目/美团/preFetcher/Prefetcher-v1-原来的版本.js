/**
 * 预请求
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