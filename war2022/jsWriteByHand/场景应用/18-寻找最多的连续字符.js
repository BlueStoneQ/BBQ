/**
 * 比如有一个字符串: ‘aaaabbbbbcccccccccccccdddddd’ 这里边连续重复出现次数最多的是 c 共出现了 13 次，我们要想办法使用js找出来
 * 关键词：连续 + 字母 + 最多：
 * 方法：双指针 + 前后指针
 * https://blog.csdn.net/shi851051279/article/details/113839617
 */

const findMaxCountChar = (s) => {
  // defend
  // init data
  const result = {
    maxCountChar: '',
    maxCount: 0
  };
  const len = s.length;
  let slowIndex = 0, fastIndex = 1;
  // algo
  while (fastIndex < len) {
    // 当前字符和之前的重复字符不一致了 就等于到了一段重复字母的末尾了 （fastIndex这时候指向的事重复字符串末尾的nextChar）
    if (s[slowIndex] !== s[fastIndex]) {
      const repeatCount = fastIndex - slowIndex;

      if (result.maxCount < repeatCount) {
        result.maxCountChar = s[slowIndex];
        result.maxCount = repeatCount;
      }

      // 已经发现一段重复字符，slowIndex移到下一段字符的起点
      slowIndex = fastIndex;
    }
    // 快指针报纸步进 直到字符末尾
    fastIndex++;
  }
  // return
  return result.maxCountChar === '' ? undefined : result;
}

// test
const testArray = [
  {
    s: 'aaaabbbbbcccccccccccccdddddd',
    expect: {
      maxCountChar: 'c',
      maxCount: 13
    }
  },
];

/**
 * 这个test可以单独出来 再加一个compareFn即可
 * @param {*} testArr 
 * @param {*} func 
 */
const test = (testArr, func) => {
  for (const testItem of testArr) {
    const { expect } = testItem;
    const result = func(testItem.s);

    if (result.maxCountChar === expect.maxCountChar && result.maxCount === expect.maxCount) {
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

test(testArray, findMaxCountChar);