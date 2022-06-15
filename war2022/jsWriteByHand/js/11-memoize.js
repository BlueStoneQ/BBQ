/**
 * 函数备忘录（缓存）
 * 高阶函数 - 给函数结果加缓存
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

let fabonaci = (n) => {
  count++;
  if (n < 2) return n;

  // 已经不推荐使用arguments.callee 因为arguments是个很大的参数 比较耗能，我们可以在内部给一个函数名 - 用一个高阶函数处理
  return fabonaci(n - 1) + fabonaci(n - 2);
}


for (var i = 0; i <= 10; i++) {
  fabonaci(i)
}

console.log('memo before: ', count); // 453 

count = 0; // reset 

fabonaci = memoize(fabonaci); // 这里必须赋值给 fabonaci ， 因为内部递归的时候 是用的 fabonaci

for (var i = 0; i <= 10; i++) {
  fabonaci(i)
}

console.log('memo after: ', count); // 11