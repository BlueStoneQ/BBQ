/**
 * 数组的扁平化
 * 2022-3-25
 * - 官方有一个array.flat函数
 * - 更多是一种编程训练 熟悉常用api
 * - [统一以这个实现为准](data-handle/7-arrayFlatApi.js)
 */


/**
 * [掌握这个即可]方法1：递归法
 * 创建一个新数组 在递归中 将拉平元素填充到当期元素中
 */
const flat1 = (arr) => {
  let result = [];

  for (const item of arr) {
    if (Array.isArray(item)) {
      // 是数组 递归处理成
      result = result.concat(flat1(item));
      continue;
    }
    // base case 
    result.push(item);
  }

  return result;
}

/**
 * 方法2： arr.toString + split
 */
const flat2 = (arr) => {
  return arr.toString().split(',').map(item => +item);
}

/**
 * 方法3: JSON.stringify + 正则替换掉所有中括号 + JSON.parse
 */
const flat3 = (arr) => {
  const str = JSON.stringify(arr).replace(/[\[|\]]/g, '');
  return JSON.parse('[' + str + ']');
}

/**
 * reduce方法 
 * es6的flat方法
 * 
 * 
 */








// test
const input = [[1, 2, 3 , 4], 5, 6, [7, [ 8, 9]]];

console.log('flat1', flat1(input));

console.log('flat2', flat2(input));

console.log('flat3', flat3(input));

console.log('Array.flat', input.flat(Infinity));

