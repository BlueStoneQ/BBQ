/**
 * 
 */

const memo = (fn) => {
  const memo = new Map();
  return (...args) => {
    const key = Array.from(args).sort().toString();
    if (memo.has(key)) return memo.get(key);

    const result = fn(...args);

    memo.set(key, result);

    return result;
  }
}

const fn = (...args) => {
  // let result = 1;
  return Array.prototype.reduce.call(args, (val, last) => val * last, 1);
}

const fn1 = memo(fn);

console.log(fn1(1,2,3));