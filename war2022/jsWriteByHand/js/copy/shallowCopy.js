/**
 * 2022-3-3
 * 1. Object.assign()
 * 2. 扩展运算符
 * 3. Array 
 *  - slice()
 *  - concat()
 * 4. 手写实现
 */

/**
 * 手写
 */
const shallowCopy = (obj) => {
  // 只拷贝对象
  if (typeof obj !== 'object') return;
  // 对象和数组要区别初始化
  const newObj = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      newObj[key] = obj[key];
    }
  }

  return newObj;
}

// test
const o = { a: 1, b: 2};
const a = [1, 2, 3];
const o1  = shallowCopy(o);
const a1 = shallowCopy(a);

console.log('o1: ', o1);
console.log('a1: ', a1);