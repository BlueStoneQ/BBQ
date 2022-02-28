/**
 * throttle 和 debounce 本质上都是 高阶函数
 * 2022-2-28
 * 1. 方法1：时间间隔
 * 2. 方法2：使用定时器
 */


/**
 * 时间差实现
 */
const throttle1 = (fn, delay = 300) => {
  let start = 0; // 这里应该初始值为 0, 这样节流的第一次 总会立刻先执行一次，接下来节流执行

  return (...args) => {
    // init data
    const now = Date.now();
    // defend
    if (now - start < delay) return;
    // 放行 执行
    fn && fn(args);
    start = now;
  }
}

/**
 * 基于定时器实现
 */
const throttle2 = (fn, delay = 300) => {
  let timer = null;

  return (...args) => {
    // defend
    if (timer) return;

    // init data
    const context = this;

    timer = setTimeout(() => {
      fn && fn.apply(context, args);
      // 本次执行结束 重置timer
      timer = null;
    }, 300);
  }
}