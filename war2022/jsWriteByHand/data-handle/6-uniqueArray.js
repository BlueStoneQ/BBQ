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
  const map = {};
  const res = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (map[item]) continue;
    res.push(item);
    map[item] = true;
  }

  return res;
}

// test
const arr = [1, 2, 3, 1, 2, 3, 5, 6];

console.log('uniqueArray1: ', uniqueArray1(arr));

console.log('uniqueArray2: ', uniqueArray2(arr));
