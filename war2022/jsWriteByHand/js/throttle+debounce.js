/**
 * throttle 和 debounce 本质上都是 高阶函数
 * 2022-2-28
 * 1. 方法1：时间间隔
 * 2. 方法2：使用定时器
 */


/**
 * throttle
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
 * throttle
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


/**
 * debounce 防抖
 * @param {function} fn 
 * @param {number} delay 
 * @return {function}
 */
 function debounce(fn, delay = 300) {
  let timer = null;

  return function() {
    // 清除之前的timer 从新开始计时
    if (timer) {
      clearTimeout(timer)
      timer = null; // 需要手动将timer值赋值为null clearTimeout不会做这件事 
    };

    // init data
    const context = this, args = arguments;

    // 设置计时器
    timer = setTimeout(function() {
      fn && fn.apply(context, args);
    }, delay);
  }
}