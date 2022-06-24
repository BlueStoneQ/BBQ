/**
 * 自己写的建议测试辅助函数（代替测试框架）
 * 2022-6-24
 */

/**
 * 这个test可以单独出来 再加一个compareFn即可
 * @param {*} testArr [{}]
 * @param {*} func 
 * @param {Function} compareFn 用来比较每组测试用例如何和函数执行结果比较，true为该组测试用例通过
 */
 const test = (testArr, func, compareFn) => {
  for (const testItem of testArr) {
    const { expect } = testItem;
    const result = func(testItem.input);

    if (compareFn(expect, result)) {
      console.log(`
        [success!!!]
        case: ${JSON.stringify(testItem, 2)}
        result: ${JSON.stringify(result, 2)}
      `);
    } else {
      console.log(`
      [failed!!!]
      case: ${JSON.stringify(testItem, 2)}
      result: ${JSON.stringify(result, 2)}
    `);
    }
  }
}

// test-case-example
// const testArray = [
//   {
//     input: 'aaaabbbbbcccccccccccccdddddd', // 测试用例的输入
//     expect: {
//       maxCountChar: 'c', // expect的内容可以自定义
//       maxCount: 13
//     }
//   },
// ];

module.exports = test;