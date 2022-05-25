/**
 * 2022-5-25
 * 2. fn(1)(2)(3) = fn(1, 2, 3)
 */

const curry = function (fn) {
  // defend fn必须是函数
  if (typeof fn !== 'function') {
      throw new TypeError(`curry need function to be params`);
  }
  // init data
  const needArgslength = fn.length; // 该函数的形参格式利用闭包进行记录
  const originalArgs = [].slice.call(arguments, 1); // arguments 数组化  并从中剥离出参数部分

  // return new function 
  return function() {
      // 合并参数
      const combineArgs = originalArgs.concat([...arguments]);

      // 判断参数是否满足length个
      if (combineArgs.length >= needArgslength) {
      return fn.apply(this, combineArgs);
      }

      // 参数不足length个时 返回柯里化函数: 这里的this 来自于当前新函数调用时的this(包括这个函数的this可以被其他bind之类的改变) 箭头函数不用考虑该问题  其this始终指向其定义时向上捕获的this
      return curry.call(this, fn, ...combineArgs);
  }
}


/**
 * test
 */
const testFn1 = (a, b, c) => {
    return a + b + c;
}

const curryFn1 = curry(testFn1);

console.log(curryFn1(1, 2, 3));
console.log(curryFn1(1)(2)(3));