/**
 * 实现Array的flat()
 * 2022-3-25
 */

/**
 * 递归法
 * @param {*} arr 
 * @param {*} depth 
 */
const _flat = (arr, depth = 1) => {
  // base case
  if (!Array.isArray(arr) || depth <= 0) {
    return arr;
  }

  let result = [];
  // 遍历递归
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (Array.isArray(item)) {
      result = result.concat(_flat(item, depth - 1));
    } else {
      result.push(item);
    }
  }

  return result;
}


/**
 * test
 */

const arr = [1, 2, [3, 4, [5, 6, [7, 8]]]];

console.log(_flat(arr, Infinity));