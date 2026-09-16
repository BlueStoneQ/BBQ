
/**
 * 【题目 2.1】手写实现函数柯里化（curry）
 * 要求：实现 curry(fn)，将多参函数转为可分步接收参数的形式；
 *      当累计参数达到原函数形参个数时执行，否则继续返回柯里化函数。
 */

/**
 * 函数柯里化
 * 2022-3-1
 * 本质上还是一个高阶函数 
 * https://github.com/mqyqingfeng/Blog/issues/42
 */


/**
 * ES5实现
 * 注意:arguments的处理：https://juejin.cn/post/6844904151680286734
 * 当然 也可以使用...restParams
 * @param {*} fn 
 * @returns 
 */
const curry = (fn, ...exitArgs) => {
    // defend fn必须是函数
    if (typeof fn !== 'function') {
        throw new TypeError(`curry need function to be params`);
    }

    const needsParamsCount = fn.length

    return function(...args) {
        const combineArgs = [...exitArgs, ...args]
        if (combineArgs.length >= needsParamsCount) return fn.apply(this, combineArgs)
        return curry(fn, ...combineArgs)
    }
}

// test
const testF = (a, b, c) => {
  return [a, b, c];
}

var fn = curry(testF);


console.log('fn("a", "b", "c"): ', fn("a", "b", "c")) // ["a", "b", "c"]
console.log('fn("a", "b")("c"): ', fn("a", "b")("c")) // ["a", "b", "c"]
console.log('fn("a")("b")("c"): ', fn("a")("b")("c")) // ["a", "b", "c"]
console.log('fn("a")("b", "c"): ', fn("a")("b", "c")) // ["a", "b", "c"]


const testFn1 = (a, b, c) => {
  return a + b + c;
}

const curryFn1 = curry(testFn1);

console.log(curryFn1(1, 2, 3));
console.log(curryFn1(1)(2)(3));




