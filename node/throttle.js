/**
 * 节流函数 - 定时器版
 * @param {*} fn 
 * @param {*} delay 
 */
const throttle = (fn, delay = 300) => {
  let timer = null;
  return (...args) => {
    const context = this;
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      fn && fn.apply(context, args);
      timer = null;
    }, delay);
  }
}


/***
 * 节流函数 - 时间戳版
 */
const throttle_time = (fn, delay = 300) => {
  // 这里应该初始值为 0, 这样节流的第一次 总会立刻先执行一次，接下来节流执行
  let preTime = 0;
  // let preTime = null;
  return (...args) => {
    const context = this;
    let nowTime = new Date().now();
    if (nowTime - preTime > delay) {
      fn && fn.apply(context, args);
      preTime = new Date().now();
    }
  }
}

/**
 * 防抖函数
 * @param {*} fn 
 * @param {*} delay 
 */
const debounce = (fn, delay = 300) => {
  let timer = null;
  return (...args) => {
    const context = this;
    if (timer) {
      // 清除之前的定时器 重新开始定时
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn && fn.apply(context, args);
      timer = null;
    }, delay);
  }
}

/**
 * 至少可以执行一次的防抖函数 - 实用：防抖 + 节流函数
 */
const debounceThrottle = () => {}
