/**
 * 数组去重
 * 2022-3-25
 */

/**
 * 方法1： ES6: Set + Array.from
 */
const uniqueArray1 = (arr) => {
  return Array.from(new Set(arr));
}

/**
 * 方法2： ES5: 使用Obj的key不重复去重
 */
const uniqueArray2 = (arr) => {
  const map = {}; // Map也可以
  const res = [];

  for (const item of arr) {
    if (map[item]) continue;
    res.push(item);
    map[item] = true;
  }

  return res;
}

/**
 * [必须得掌握]算法中使用双指针去重
 * 1. 但是需要先排序 让重复的相邻在一起
 * 2. 参见：[26-删除有序数组中的重复项](https://github.com/BlueStoneQ/algorithm/blob/main/Array/easy/26-%E5%88%A0%E9%99%A4%E6%9C%89%E5%BA%8F%E6%95%B0%E7%BB%84%E4%B8%AD%E7%9A%84%E9%87%8D%E5%A4%8D%E9%A1%B9/26-removeDuplicates.js)
 */

// test
const arr = [1, 2, 3, 1, 2, 3, 5, 6];

console.log('uniqueArray1: ', uniqueArray1(arr));

console.log('uniqueArray2: ', uniqueArray2(arr));
