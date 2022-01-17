/**
 * AOP
 * Author: qiaoyang
 * Date: 2021-4-20
 */

/**
 * 基于函数原型的AOP实现
 */
Function.prototype.before = (beforeFn) => {
  // 被切入的当前函数
  const that = this;
  return function() {
    // 切入到 before 时间点的函数
    beforeFn.call(that, arguments);
    // 原函数执行
    that(arguments);
  }
}

Function.prototype.after = (afterFn) => {
  // 被切入的当前函数
  const that = this;
  return function() {
    // 原函数执行
    that(arguments);
    // 切入到 after 时间点的函数
    beforeFn.call(that, arguments);
  }
}