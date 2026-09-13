/**
 * 【题目 3.6】手写实现数组 API（map 等）
 * 要求：在 Array.prototype 上手写实现 map（及 forEach/filter/reduce/push 等）方法。
 */

/**
 * 实现数组的map方法
 * 2022-3-25
 */

Array.prototype._map = function() {
  const fn = arguments[0];

  if (typeof fn !== 'function') {
    throw new Error('参数必须是函数');
  }

  const result = [];

  const curArray = this;

  for (const item of curArray) {
    result.push(fn(item));
  }

  return result;
}



// test

const arr = [1, 2, 3 ,4 ,5];

console.log(arr._map(item => item + '哈哈'));
console.log(arr._map(1));