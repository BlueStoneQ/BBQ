    /**
 * 【题目 4.3】retry 重试函数
 * 要求：实现 retry(fn, times)，对返回 Promise 的异步任务失败后自动重试若干次，
 *      全部失败才最终 reject。
 */

/**
 * 2023-6-29
 */

/**
 * 也可以加入timeout等控制因素，这里是一个mvp或者核心算法
 * @param {PromiseCreator} fn , fn的参数可以通过函数式编程中的partial进行预设： const fecthCreator = (...params) => () => fn(...params), 利用返回出的结构函数作为retry的入参
 * @param {number} maxTime, 尝试的次数 
 * @returns 
 */
const retry = (fn, maxTime) => {
    return new Promise((resolve, reject) => {
        const _retry = (time) => {
            if (time === 0) {
                reject(new Error(`beyond maxTime: ${maxTime}`))
                return 
            }

            fn().then(res => resolve(res)).catch(err => _retry(time - 1))
        }

        _retry(maxTime)
    })
}

const fnCreate = (params) => fetch(params)

const fn = () => fnCreate(1)

retry(fn, 3).then().catch()