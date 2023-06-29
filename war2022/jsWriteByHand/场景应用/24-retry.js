/**
 * 2023-6-29
 */

/**
 * 
 * @param {PromiseCreator} fn 
 * @returns 
 */
const retry = (fn) => {
    return new Promise((resolve, reject) => {
        // 定义
        const _retry = () => {
            fn().then(res => resolve(res)).catch(err => _retry())
        }

        // 启动
        _retry()
    })
}

const fnCreater = (params) => () => {
    return fetch(params)
}
const fn = fnCreater(params)