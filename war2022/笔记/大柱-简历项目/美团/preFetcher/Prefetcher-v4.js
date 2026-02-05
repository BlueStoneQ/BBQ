
/**
 * 预请求定义
 * pagePath2InfoMap: {
 *      pagePath: {
 *               taskMap: {
 *                  taskKey: {
 *                      task: promiseCreator,
 *                      resPromise,
 *                  }
 *               },
                 injectParams: {},
                 mergedParams: {}
 *      }
 * }
 */
class PreFetcher {
    constructor() {
        this.pagePath2InfoMap = new Map();
    }

    register(pagePath, taskMap, injectParams = {}) {
        this.pagePath2InfoMap.set(pagePath, {
        taskMap,
        injectParams
        });
    }

    emit(pagePath) {
        if (!this.pagePath2InfoMap.has(path)) return;

        const pageInfo  = this.pagePath2InfoMap.get(pagePath);
        const { taskMap, injectParams } = pageInfo;
        const queryParams = _getQueryParams(pagePath)
        pageInfo.mergedParams = this._mergeParams(injectParams, queryParams);
        
        for (const taskItem of taskMap) {
            taskItem[1].resPromise = taskItem[1].task(mergedParams);
        }
    }

    getResult(pagePath, taskKey) {
        const pageInfo = this.map.get(pagePath);
        const taskItem = pageInfo.taskMap.get(taskKey);

        return taskItem.resPromise
            .catch(err => {
                this._retry(pageInfo, taskItem, resolve, reject);
            });
    }

    _retry(pageInfo, taskItem, resultResolve, resultReject, maxRepeatTimes = 10, maxDuration = 10000) {
        const startTime = Date.now();
        let repeatTimes = 0;

        const _isOutTime = () => Date.now() - startTime >= maxDuration;
        const _isMoreThanMaxTimes = () => ++repeatTimes > maxRepeatTimes;

        const _request = () => {
            taskItem.task(pageInfo.mergedParams)
                .then(res => resultResolve(res))
                .catch(err => {
                    if (_isMoreThanMaxTimes() || _isOutTime()) return resultReject(err);
                    _request()
                })
        }

        _request();
    }
}

export default new PreFetch()

// Usage: 
// 1. 定义预请求任务
const pagePath = 'path/buyPage';
export enum ETaskKey {
    task1 = 'task1',
    task2 = 'task2',
}

const task1 = (mergedParams) => {
    return _fetch(url1, mergedParams);
}

const task2 = (mergedParams) => {
    return _fetch(url2, mergedParams);
}

taskMap = new Map([
    [ETaskKey.task1, { task: task1 }],
    [ETaskKey.task2, { task: task2 }],
]);

// 2. 注册端, app.js中注册
preFetcherInstance.register(pagePath, taskMap, { globalParam1: 1, globalParam2: 2 })

// 3. 触发端, 一般在路由中注入
const originalRouteGo = routeGo;
routeGo = function(url) {
    preFetcherInstance.emit(url);
    originalRouteGo.apply(this, url);
}

// 4. 获取端：在被预请求的页面中，由负责该领域的同学接入
(async() => {
    try {
        const res1 = await preFetcherInstance.getResult(pagePath, ETaskKey.task1);
    } catch(err) {}

    try {
        const res2 = await preFetcherInstance.getResult(pagePath, ETaskKey.task2);
    } catch(err) {}
})()
