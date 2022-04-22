/**
 * Aop编程
 * 2022-4-22
 * 它的作用是在某个函数上进行切割，可以在函数执行前/中/后添加其他逻辑代码。
 * AOP编程的好处是遵循单一原则，不会修改原函数内部的代码就可以改变原函数的逻辑。
 * 1. 借助prototype实现 
 * 2. 不借助prototype,使用入参实现
 * https://segmentfault.com/a/1190000039752166
 */

/**
 * 1. 借助原型链实现，因为挂在了函数上，返回一个函数，顺便保证了链式调用
 * 2. 本质上是一个高阶函数
 * @param {Function} fn 切入的逻辑
 */
Function.prototype.before = function(fn) {
  // 获取被拦截的函数句柄
  const selfFn = this;
  // 返回新函数 
  return function() {
    // 调用插入的逻辑，注意this是需要当前这个新函数进行传递的（这个新函数所在的环境 才是原来的函数本来调用的地方）
    fn && fn.call(this, arguments);
    // 调用被拦截的函数
    return selfFn.call(this, arguments);
  }
}

/**
 * 在被拦截函数之后执行插入的切面逻辑 和before很像 不过就是等被拦截函数执行后 记录下其结果 然后执行插入的逻辑 之后再返回前面记录的结果
 * @param {*} fn 
 */
Function.prototype.after = function(fn) {
  const eslfFn = this;

  return function() {
    // 执行原来函数的逻辑 先把结果记录下来 一会儿返回
    const result = selfFn.call(this, arguments);
    // 执行插入的逻辑
    fn && fn.call(this, arguments);
    // 返回之前记录的结果
    return result;
  }
}





/**
 * 2. 不借助prototype,使用入参实现
 */