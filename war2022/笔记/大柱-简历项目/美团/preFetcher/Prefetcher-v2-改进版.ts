
/**
 * 预请求定义
 * v3: changeLog: 
 *      1. 引入retry机制
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

interface ITaskItem {
    task: (IParams) => Promise<any>;
    resPromise: Promise<any>;
}

interface IParams {
    [prop: string]: any;
}

interface IPageInfo {
    taskMap: TTaskMap;
    injectParams: IParams;
    mergedParams: IParams;
}

type TTaskMap = Map<string, ITaskItem>
type TPagePath2InfoMap = Map<string, IPageInfo>

class PreFetcher {
    private pagePath2InfoMap: TPagePath2InfoMap;
    
    constructor() {
        this.pagePath2InfoMap = new Map<string, IPageInfo>();
    }

    register(pagePath: string, taskMap: TTaskMap, injectParams: IParams = {}) {
        this.pagePath2InfoMap.set(pagePath, {
            taskMap,
            injectParams,
            mergedParams: {},
        });
    }

    emit(pagePath: string) {
        if (!this.pagePath2InfoMap.has(pagePath)) throw new Error('The pageUrl is invalid');

        const pageInfo  = this.pagePath2InfoMap.get(pagePath);
        const { taskMap, injectParams } = pageInfo as IPageInfo;
        // @ts-ignore
        const queryParams = _getQueryParams(pagePath);
        // @ts-ignore
        (pageInfo as IPageInfo).mergedParams = this._mergeParams(injectParams, queryParams);
        
        for (const taskItem of taskMap) {
        taskItem[1].resPromise = taskItem[1].task((pageInfo as IPageInfo).mergedParams);
        }
    }

    getResult(pagePath, taskKey) {
        const pageInfo = this.pagePath2InfoMap.get(pagePath);
        const taskItem = (pageInfo as IPageInfo).taskMap.get(taskKey);

        return new Promise((resolve, reject) => {
            (taskItem as ITaskItem).resPromise
                .then(res => resolve(res))
                .catch(err => {
                    this._retry(pageInfo, taskItem, resolve, reject);
                })
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

const preFetcherInstance = new PreFetcher()

// Usage: 
// 1. 定义预请求任务
const pagePath = 'path/buyPage';
export enum ETaskKey {
    task1 = 'task1',
    task2 = 'task2',
}

const task1 = (mergedParams) => {
    // @ts-ignore
    return _fetch(url1, mergedParams);
}

const task2 = (mergedParams) => {
    // @ts-ignore
    return _fetch(url2, mergedParams);
}

const taskMap = new Map([
    [ETaskKey.task1, { task: task1 }],
    [ETaskKey.task2, { task: task2 }],
]);

// 2. 注册端, app.js中注册 
// @ts-ignore
preFetcherInstance.register(pagePath, taskMap, { globalParam1: 1, globalParam2: 2 })

// 3. 触发端, 一般在路由中注入
// @ts-ignore
const originalRouteGo = routeGo;
// @ts-ignore
routeGo = function(url) {
    // @ts-ignore
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
