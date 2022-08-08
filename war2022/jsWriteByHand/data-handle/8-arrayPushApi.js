/**
 * 实现数组的push方法
 * 2022-3-25
 * ！！！关键：this就是这里的array实例 
 */

Array.prototype._push = function() {
  for (let i = 0; i < arguments.length; i++) {
    this[this.length] = arguments[i];
  }
  return this.length;
}


// test
const arr = [];
console.log(arr._push(1, 2, 3, 4));

console.log('arr: ', arr);