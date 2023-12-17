/**
 * 数组元素求和
 * 2022-3-23
 */
// 增加到Prototype上 建议用这个, 注意要用ES5的function写法 因为需要再调用时确认this为当前调用的array
Array.prototype.$getSum = function() {
  return this.reduce((preReturnVal, curVal) => +preReturnVal + +curVal, 0)
}

// 方法1：reduce
const getSum = (arr = []) => arr.reduce((preReturnVal, curVal) => +preReturnVal + +curVal, 0)