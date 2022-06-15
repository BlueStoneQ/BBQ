/**
 * 2022-3-3
 * 1. Object.assign()
 * 2. 扩展运算符
 * 3. Array 
 *  - slice()
 *  - concat()
 * 4. 手写实现
 * 
 * 浅拷贝其实对于对象而言 就是只拷贝第一层属性，第二层就保持原来的引用了，所以 一般一个单层循环即可
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
    // 只拷贝自身属性 不拷贝原型链上的属性
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