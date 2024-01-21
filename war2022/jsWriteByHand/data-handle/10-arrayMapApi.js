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