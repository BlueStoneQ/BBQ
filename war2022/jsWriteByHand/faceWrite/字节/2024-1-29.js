/**
 * 2024-1-29 本地生活 1面
 * 题目：
 * 实现 add(1, 2, 3)(4, 5).toSum()
 */

const add = function(...args) {
  const _args = [...args];

  const fn = function(...args2) {
    _args.push(...args2);
    return add(..._args);
  }

  fn.toSum = () => _args.reduce((a, b) => +a + +b, 0);

  return fn;
}