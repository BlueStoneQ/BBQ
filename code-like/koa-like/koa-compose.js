/**
 * koa-compose-like
 * 手写koa-compose 体会这种流程控制的方案
 */

/**
* 同步compose
*/
// compose_test.js
function fn1() {
  console.log('fn1')
  console.log('fn1 end')
}

function fn2() {
  console.log('fn2')
  console.log('fn2 end')
}

function fn3() {
  console.log('fn3')
  console.log('fn3 end')
}

// compose_test.js
// 想把三个函数组合成一个函数且按照顺序来执行
// fn3(fn2(fn1()))

/**
 * compose的实现核心方案：值记录法
 * @returns {Function} 高阶函数, 该返回值函数的返回值才是真正的值
 */
const compose = (middlewares) => () => {
  const [firstFn, ...otherFns] = middlewares;
  // 用一个值记录上一个函数执行的结果 并作为参数传给队列下一个函数
  let ret = firstFn();
  otherFns.forEach(itemFn => {
    // 执行并更新记录值
    ret = itemFn(ret);
  });
  // 注意这个值是内部子函数的返回值，也是整个middlewares队列执行完的最后一个返回值
  return ret;
}



/**
 * ***************************************************************************************
 */

/**
 * test 异步函数组合
 */
const fnA1 = async (next) => {
  console.log('fnA1')
  next && await next();
  console.log('fnA1 end')
}

const fnA2 = async (next) => {
  console.log('fnA2')
  next && await next();
  console.log('fnA2 end')
}

const fnA3 = async (next) => {
  console.log('fnA3')
  // await本质上就是调用next的then方法
  next && await next();
  console.log('fnA3 end')
}

/**
 * compose的实现核心方案：
 *    Promise对于异步流程的控制
 *    + disPatch的递归调用（实现原理是：迭代器，不断指向新的middleware，有一个现成的reduce实现迭代器，这里的遍历实现利用的还是递归） 
 *    + （i作为index去遍历,可以理解为游标法）
 *    + 体会下包装函数的作用：经过包装的函数 可以被我们按照我们需要的方式处理 在最后只需要return原函数即可
 * promise.resolve的作用就是把里面的东西放到了then中（处理链式调用，或者异步调用），也就是await的后面：dispatch其实就是做了这个工作
 * 体会递归对于嵌套遍历调用和流程控制的意义
 * @returns {Function} 高阶函数, 该返回值函数的返回值才是真正的值, 该高阶函数就是这里中间件队列调用的启动器（就像导火索一样）
 */
const composeAsync = (middlewares) => () =>  {
  // 嵌套遍历器入口-启动
  return dispatch(0);
  /**
   * 构造一个dispatch函数
   * 这个dispatch函数就是把中间件包装为一个高阶函数，中间件作为返回值（被包裹在了promise.resolve中），同时利用递归遍历（嵌套）执行中间件
   * @param {Number} i 中间件队列的游标
   */
  function dispatch(i) {
    let fn = middlewares[i];
    // 终止递归条件
    if (!fn) return Promise.resolve();
    return Promise.resolve(fn(function next() {
      return dispatch(i + 1);
    }));
  }
}

/**
 * test
 */
// test 同步函数组合
const middlewares = [fn1, fn2, fn3];
const finalFn = compose(middlewares);
// 启动了遍历执行middleware的过程
finalFn();

// test 异步函数组合
const asnycMiddlewares = [fnA1, fnA2, fnA3];
const finalFnAsync = composeAsync(asnycMiddlewares);
// 启动了遍历执行middleware的过程
finalFnAsync();