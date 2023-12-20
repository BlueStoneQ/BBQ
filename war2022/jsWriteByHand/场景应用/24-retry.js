/**
 * 2023-6-29
 */

/**
 * 也可以加入timeout等控制因素
 * @param {PromiseCreator} fn , fn的参数可以通过函数式编程中的partial进行预设： const fecthCreator = (...params) => () => fn(...params), 利用返回出的结构函数作为retry的入参
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