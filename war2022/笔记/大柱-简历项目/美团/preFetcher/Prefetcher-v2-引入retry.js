/**
 * 预请求
 */
class PreFetch {
  constructor () {
    this.map = new Map();
  }

  register (path, taskMap, injectParams = {}) {
    this.map.set(path, {
      taskMap,
      injectParams
    });
  }

  emit (path) {
    if (!this.map.has(path)) return;

    const item  = this.map.get(path);
    const { taskMap, injectParams } = item;
    item.mergedParams = this._mergeParams(injectParams, queryParams);
    
    for (const taskItem of taskMap) {
      taskItem[1].resPromise = taskItem[1].task(mergedParams);
    }
  }

  getResult (path, taskKey) {
    const pageTaskMap = this.map.get(path);
    const { resPromise } = pageTaskMap.taskMap.get(taskKey);

    return new Promise((resolve, reject) => {
      resPromise
      .then(res => resolve(res))
      .catch(err => {
        this._retry(pageTaskMap, taskKey, resolve, reject)
      })
    });
  }

  _retry(pageTaskMap, taskKey, resolve, reject) {
    const { task } = pageTaskMap.get(taskKey);

    task()
  }
}



