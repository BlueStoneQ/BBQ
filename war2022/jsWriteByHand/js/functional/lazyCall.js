/**
 * 【题目 2.5】手写实现惰性函数 / 懒求值（lazyCall）
 * 要求：实现 add(1)(2)(3)() 形式的懒求值——持续传参时不断返回新函数收集参数，
 *      直到以空参数调用 () 时才真正执行并返回结果。
 */

/**
 * 懒求值（伪柯里化）
 * 其实 也就是一种参数长度最开始没有指定的柯里化
 * 2022-6-15
 * 有些面试会问add(1)(2)(3) 都不会执行 只有add(1)(2)(3)()
 * 这个其实 也可以用curry的思想解决 比curry还要简单一些 简单而言：
 * 1. 只要有参数传入 就一直return 高阶函数调用,
 * 2. 当没有参数的时候 这时候调用就直接调用原来的函数
 * 有的称这个为懒求值，我这里称伪柯里化 - 实现一下：同样也是高阶函数
 * 下面这个实现是我自己实现的 应该是不容易找到参照
 */
const lazyCall = (fn, ...originalArgs) => {
  // defend: throw TypeError 
  return function(...args) {
    // case1: 有参数传入 调用高阶函数 返回值还是一个函数 
    // - 整个结构和curry基本一样 都是高阶函数，在返回的高阶函数内判断参数情况，curry是和fn.length比较, 这里是和0比较
    if (args.length === 0) {
      // 将当前函数参数args拼接到originalArgs后面传递下去 供后面真正调用的时候使用
      return fn.apply(this, originalArgs)
    }
    // case2: 没有参数传入 调用原函数
    return lazyCall.apply(this, [fn, ...originalArgs, ...args])
  }
}

/***
 * test _lazyCall
 */
function test1 (...args) {
  return args.toString();
}

const test1_lazyCall = _lazyCall(test1);

console.log('test1_lazyCall(1)(2)(3): ', test1_lazyCall(1)(2)(3)); // expect 什么都不输出

console.log('test1_lazyCall(1)(2)(3)(4)(): ', test1_lazyCall(1)(2)(3)(4)()); // expect '1,2,3,4'