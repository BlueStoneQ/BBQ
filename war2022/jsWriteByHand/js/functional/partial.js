/**
 * 偏函数
 * 
 * 固化一部分参数在某个函数调用中
 * 
 * 本质上还是高阶函数，再返回的包装函数中把预置的参数在原来函数调用时内置进去
 * 
 * 2022-3-2
 * 可以使用bind 传入预先的参数 但是 bind会造成this的改变
 * 这里的实现 是不改变this
 * https://github.com/mqyqingfeng/Blog/issues/43
 * TODO: 占位的实现 ？
 * 
 * 其实 偏函数 是一个比较细分的柯里化，通过内置函数，可以产生一个可以随处移动的函数
 */

const partial = (fn, ...args) => {
  return function(...restArgs) {
    fn.apply(this, [...args, ...restArgs])
  }
}

