/**
 * 【题目 2.2】手写实现函数组合（compose）
 * 要求：实现 compose(...fns)，将多个函数从右向左组合成一个函数，
 *      前一个函数的返回值作为后一个函数的入参。
 */

/**
 * compose：
 * 本质上还是高阶函数 返回一个包装函数（定义）
 * 解决多个函数按顺序链式调用的问题
 * 返回的这个函数就像启动器 调用它后 就会开始执行这一串函数
 * Koa中间件实现中 有个compose函数 基本就是这种作用
 * 
 * 利用 compose 将两个函数组合成一个函数，让代码从右向左运行，而不是由内而外运行，可读性大大提升。这便是函数组合。
 * d(c(b(a()))) => compose(d, c, b, a)
 * 2022-3-2
 * https://github.com/mqyqingfeng/Blog/issues/45
 * 
 * 相对而言：任务从左向右执行 就是 pipe， startIndex 从 fnList左侧0开始即可
 */
const compose = (...fnList) => {
    return function(...args) {
        if (fnList.length === 0) {
            return args[0]
        }
        // 因为我们设计的执行顺序是从右向左执行 所以这里的startIndex是末尾的index
        let i = fnList.length - 1
        // 动态记录每个函数的结果
        let res = fnList[i--].apply(this, args) // 这里的args是启动函数的参数 也就是右边第一个函数的参数

        while(i >= 0) {
            res = fnList[i--].call(this, res)
        }

        return res
    }
}


// test
const a = (a) => a;
const b = (a) => 'b +' + a;
const c = (a) => 'c +' + a;
const d = (a) => 'd +' + a;

const startFn = compose(d, c, b, a);

console.log(startFn('a'))


