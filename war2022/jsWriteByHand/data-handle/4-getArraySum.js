/**
 * 数组元素求和
 * 2022-3-23
 */

// 方法1：reduce
const getSum = (arr = []) => arr.reduce((preVal, curVal) => preVal + curVal, 0)