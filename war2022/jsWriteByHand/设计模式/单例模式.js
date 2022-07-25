/**
 * 2022-7-25
 * 参考: 《javascript设计模式和开发实践》
 */

/**
 * 通用惰性单例模式
 * 1. 利用闭包 + 高阶函数
 * 2. 对每个fn 都生成一个新的函数，这个函数有分配的闭包元素-instance
 */
const getSingletonFn = (fn) => {
  let instance = null;
  return function (...args) {
    if (instance === null) {
      instance = fn.apply(this, args);
    }

    return instance;
  }
}