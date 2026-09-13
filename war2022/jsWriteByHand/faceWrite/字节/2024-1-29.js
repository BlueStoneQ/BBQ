/**
 * 【题目 7.1】字节跳动（本地生活 1 面）
 * 要求：实现 add(1, 2, 3)(4, 5).toSum()——可连续调用收集参数，最后调用 toSum() 求和。
 */

/**
 * 2024-1-29 本地生活 1面
 * 题目：
 * 实现 add(1, 2, 3)(4, 5).toSum()
 */

const add = function(...args) {

  const fn = function(...args2) {
    args.push(...args2);
    return add(..._args);
  }

  fn.toSum = () => args.reduce((a, b) => +a + +b, 0);

  return fn;
}