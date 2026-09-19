/**
 * 【题目 3.1】手写实现数组扁平化（flat）
 * 要求：将任意嵌套深度的数组拉平为一维数组，掌握递归 / reduce / 栈等多种实现。
 */

/**
 * 数组的扁平化
 * 2022-3-25
 * - 官方有一个array.flat函数
 * - 更多是一种编程训练 熟悉常用api
 * - [统一以这个实现为准](data-handle/7-arrayFlatApi.js)
 */

// 递归版
Array.prototype.flat = function() {
    const res = []

    // this 就是当前数组
    for (const item of this) {
        if(Array.isArray(item)) {
            // 这里递归：用item.flat来调用
            res.push(...item.flat())
            continue
        }

        res.push(item)
    }

    return res;
}


// reduce版，核心也是递归 cur.flat
Array.prototype.flat = function() {
  return this.reduce((pre, cur) => {
    // 注意：push返回的是数组长度，不是数组本身，所以要提前push
    Array.isArray(cur) ? pre.push(...cur.flat()) : pre.push(cur)
    return pre
  }, [])
}

/**
 * ******************下面的方法不再看了*****************************
 */


/**
 * [掌握这个即可]方法1：递归法
 * 创建一个新数组 在递归中 将拉平元素填充到当期元素中
 */
const flat1 = (arr) => {
  let result = [];

  for (const item of arr) {
    result = result.concat(Array.isArray(item) ? _flat(item, depth - 1) : item);
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
 */
const flat4 = (arr) => {
  return arr.reduce((pre, cur) => {
    return Array.isArray(cur) ? pre.concat(flat4(cur)) : pre.concat(cur)
  }, []);
}








// test
const input = [[1, 2, 3 , 4], 5, 6, [7, [ 8, 9]]];

console.log('flat1', flat1(input));

console.log('flat2', flat2(input));

console.log('flat3', flat3(input));

console.log('flat4', flat4(input));

console.log('Array.flat', input.flat(Infinity));

