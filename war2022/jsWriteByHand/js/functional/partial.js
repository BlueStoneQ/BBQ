/**
 * 偏函数
 * 2022-3-2
 * 可以使用bind 传入预先的参数 但是 bind会造成this的改变
 * 这里的实现 是不改变this
 * https://github.com/mqyqingfeng/Blog/issues/43
 * TODO: 占位的实现 ？
 */

const partial = (fn, ...args) => {
  return function(...restArgs) {
    fn.apply(this, [...args, ...restArgs])
  }
}

