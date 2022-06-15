/**
 * Aop编程
 * 2022-4-22
 * 它的作用是在某个函数上进行切割，可以在函数执行前/中/后添加其他逻辑代码。
 * AOP编程的好处是遵循单一原则，不会修改原函数内部的代码就可以改变原函数的逻辑。
 * 
 * 本质上是一个高阶函数
 * 之前我们在SDK中对很多生命周期的拦截 采用的就是AOP的思想
 * 
 * 1. 借助prototype实现 
 * 2. 不借助prototype,使用入参实现 - 不想污染原型的情况下 可以使用这个方法
 * https://segmentfault.com/a/1190000039752166
 * 3. 还有一个around方法：在before 和 after 2个节点 都可以执行
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
    fn && fn.call(this, ...arguments);
    // 调用被拦截的函数
    return selfFn.call(this, ...arguments);
  }
}

/**
 * 在被拦截函数之后执行插入的切面逻辑 和before很像 不过就是等被拦截函数执行后 记录下其结果 然后执行插入的逻辑 之后再返回前面记录的结果
 * @param {*} fn 
 */
Function.prototype.after = function(fn) {
  const selfFn = this;

  return function() {
    // 执行原来函数的逻辑 先把结果记录下来 一会儿返回
    const result = selfFn.call(this, ...arguments);
    // 执行插入的逻辑 - 在after中 可以对result进行处理
    fn && fn.call(this, result, ...arguments);
    // 返回之前记录的结果
    return result;
  }
}





/**
 * 2. 不借助prototype,使用入参实现
 */


/**
 * 
 * @param {Function} selfFn 原本的函数
 * @param {Function} insertFn 插入的函数
 */
const before = function(selfFn, insertFn) {
  return function() {
    insertFn && insertFn.call(this, ...arguments);
    return selfFn.call(this, ...arguments);
  }
}

/**
 * 
 * @param {Function} selfFn 原本的函数
 * @param {Function} insertFn 插入的函数
 */
 const after = function(selfFn, insertFn) {
  return function() {
    const result = selfFn.call(this, ...arguments);

    insertFn && insertFn.call(this, ...arguments);
    
    return result;
  }
}