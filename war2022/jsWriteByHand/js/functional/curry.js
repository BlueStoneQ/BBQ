
/**
 * 函数柯里化
 * 2022-3-1
 * 本质上还是一个高阶函数 
 * https://github.com/mqyqingfeng/Blog/issues/42
 */


/**
 * ES5实现
 * @param {*} fn 
 * @returns 
 */
function curry (fn) {
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
 * ES6 实现
 * 这里其实主要利用了解构参数 形参会合并之前+现在的参数
 * @param {*} fn 
 * @returns 
 */
const curryES = (fn, ...args) => {
  console.log('args: ', args);
  // 这里的args 是前面所有调用的传递的参数的集合
  if (args.length >= fn.length) {
    return fn(...args);
  }

  return curryES.bind(null, fn, ...args);
}

// test
const testF = (a, b, c) => {
  return [a, b, c];
}

var fn = curry(testF);


console.log('fn("a", "b", "c"): ', fn("a", "b", "c")) // ["a", "b", "c"]
console.log('fn("a", "b")("c"): ', fn("a", "b")("c")) // ["a", "b", "c"]
console.log('fn("a")("b")("c"): ', fn("a")("b")("c")) // ["a", "b", "c"]
console.log('fn("a")("b", "c"): ', fn("a")("b", "c")) // ["a", "b", "c"]


const testFn1 = (a, b, c) => {
  return a + b + c;
}

const curryFn1 = curry(testFn1);

console.log(curryFn1(1, 2, 3));
console.log(curryFn1(1)(2)(3));




