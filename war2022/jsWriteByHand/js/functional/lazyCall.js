/**
 * 懒求值（伪柯里化）
 * 2022-6-15
 * 有些面试会问add(1)(2)(3) 都不会执行 只有add(1)(2)(3)()
 * 这个其实 也可以用curry的思想解决 比curry还要简单一些 简单而言：
 * 1. 只要有参数传入 就一直return 高阶函数调用,
 * 2. 当没有参数的时候 这时候调用就直接调用原来的函数
 * 有的称这个为懒求值，我这里称伪柯里化 - 实现一下：同样也是高阶函数
 * 下面这个实现是我自己实现的 应该是不容易找到参照
 */
 function _lazyCall (fn, ...args) {
  // defend: throw TypeError 

  // ！！！注意这里的赋值
  const originalArgs = args || [];

  return function (...args) {
    // case1: 有参数传入 调用高阶函数 返回值还是一个函数
    if (args.length !== 0) {
      // 利用闭包 将参数记录下来 供后面真正调用的时候使用
      originalArgs.push(...args);

      return _lazyCall.call(this, fn, ...originalArgs); // ！！！注意这里传参
    }
    // case2: 没有参数传入 调用原函数
    return fn.call(this, ...originalArgs);
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