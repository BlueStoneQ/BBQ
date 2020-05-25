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
 * test
 */
// test 同步函数组合
const middlewares = [fn1, fn2, fn3];
const finalFn = compose(middlewares);
// 启动了遍历执行middleware的过程
finalFn();
// test 异步函数组合