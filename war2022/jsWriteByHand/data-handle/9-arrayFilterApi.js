/**
 * 实现数组的filter
 * 2022-3-25
 */
Array.prototype._filter = function() {
  const fn = arguments[0];

  if (typeof fn !== 'function') {
    throw new Error('参数必须是一个函数');
  }

  const result = [];

  const curArray = this;

  for (const item of curArray) {
    if (fn(item)) {
      result.push(item);
    }
  }

  return result;
}


/**
 * test
 */

const arr = [0, 1, 2, 3, 4, 5];

const fn = (item) => item > 2;

console.log(arr._filter(fn));