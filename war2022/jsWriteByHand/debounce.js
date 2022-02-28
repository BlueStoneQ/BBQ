/**
 * 
 */

/**
 * 
 * @param {function} fn 
 * @param {number} delay 
 * @return {function}
 */
function debounce(fn, delay) {
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
    }, delay || 300);
  }
}