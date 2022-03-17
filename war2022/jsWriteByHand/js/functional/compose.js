/**
 * compose：
 * d(c(b(a()))) => compose(d, c, b, a)
 * 2022-3-2
 * https://github.com/mqyqingfeng/Blog/issues/45
 */

const compose = (...fnList) => {
  const startIndex = fnList.length - 1;
  return function(...args) {
    let i = startIndex;
    let result = fnList[i](...args); // 这里的args是启动函数的参数 也就是右边第一个函数的参数

    while(i--) {
      result = fnList[i](result);
    }

    return result;
  }
}


// test
const a = (a) => a;
const b = (a) => 'b +' + a;
const c = (a) => 'c +' + a;
const d = (a) => 'd +' + a;

const startFn = compose(d, c, b, a);

console.log(startFn('a'))


