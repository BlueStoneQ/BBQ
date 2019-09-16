/**
 * 笔试-js-实现函数防抖
 * https://www.cxymsg.com/guide/jsWritten.html#实现防抖函数（debounce）
 * 1. 本质上是一个工厂，或者高阶函数
 * 2. 相比于节流 防抖更多是时间纬度上的控制：
 * 3. 防抖更像一种延迟机制 每当有操作 就回使得回调延迟，向后推delay时间
 * 4. 经典应用场景：input字符输入接收统计
 */
function debonce(fn, delay) {
  var timer = null;
  return function(...arg) {
    clearTimeout(timer);
    timer = setTimeout(function() {
      fn.apply(this, arg);
    }, delay);
  }
}

