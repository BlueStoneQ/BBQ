/**
 * 实现Array的flat()
 * 2022-3-25
 */

/**
 * 方法1：递归法
 * @param {*} arr 
 * @param {*} depth 
 */
const _flat = (arr, depth = 0) => {
  // base case
  if (!Array.isArray(arr) || depth <= 0) {
    return arr;
  }

  let result = [];
  // 遍历递归
  for (const item of arr) {
    result = result.concat(Array.isArray(item) ? _flat(item, depth - 1) : item);
  }

  return result;
}

/**
 * 方法2(优先)：reduce（代替了遍历） + 递归
 */
const _flat2 = (arr, depth = 0) => {
  // base case
  if (!Array.isArray(arr) || depth === 0) {
    return arr;
  }
  // 利用reduce遍历 + 遇到item为Array的情况 就需要递归处理
  return arr.reduce((pre, cur) => {
    return pre.concat((Array.isArray(cur) && depth !== 0) ? _flat2(cur, depth - 1) : cur);
  }, []);
}


/**
 * test
 */

const arr = [1, 2, [3, 4, [5, 6, [7, 8]]]];

console.log(_flat(arr, Infinity)); 
console.log(_flat2(arr, Infinity)); 