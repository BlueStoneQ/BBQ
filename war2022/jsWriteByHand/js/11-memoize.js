/**
 * 【题目 2.6】手写实现记忆函数（memoize）
 * 要求：实现高阶函数 memoize(fn)，缓存相同入参对应的计算结果，
 *      再次以相同参数调用时直接返回缓存值，避免重复计算。
 */

/**
 * 函数备忘录（缓存）
 * 高阶函数 - 给函数结果加缓存
 * 2022-3-2
 * https://github.com/mqyqingfeng/Blog/issues/46
 * 1. 采用闭包实现, 闭包里用一个Map<paramsStr, res>作为查表
 * 2. 采用挂载到函数句柄上实现
 */
const memoize = (fn) => {
    const memMap = new Map()

    return function(...args) {
        const key = JSON.stringify(args)

        if (memMap.has(key)) {
            return memMap.get(key)
        }

        const res = fn.apply(this, args)
        memMap.set(key, res)

        return res
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