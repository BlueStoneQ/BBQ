/**
 * 函数备忘录（缓存）
 * 2022-3-2
 * https://github.com/mqyqingfeng/Blog/issues/46
 * 1. 采用闭包实现
 * 2. 采用挂载到函数句柄上实现
 */

/**
 * 备忘录采用闭包实现
 */
const memoize = (fn) => {
  // 这里可以采用对象字面量 也可以直接使用Map
  const memo = new Map(); // 或者也可以挂载到函数句柄上 memoize.memo = new Map()

  return (...args) => {
    // 生成key ： 这里的算法 采用将所有args进行序列化
    const key = JSON.stringify(args);
    // 缓存中有 就返回缓存值
    if (memo.has(key)) return memo.get(key);
    // 缓存中没有 调用函数逻辑 
    const result = fn(...args);
    // 返回值进入缓存
    memo.set(key, result);
    // 返回调用后的结果
    return result;
  }
}

// test 对斐波那契作备忘录处理
let count = 0; // 调用次数计数

const fabonaci = (n) => {
  count++;
  if (n < 2) return n;
  return fabonaci(n - 1) + fabonaci(n - 2);
}


for (var i = 0; i <= 10; i++) {
  fabonaci(i)
}

console.log('memo before: ', count);

count = 0; // reset 

const memoFab = memoize(fabonaci);

for (var i = 0; i <= 10; i++) {
  memoFab(i)
}

console.log('memo after: ', count);