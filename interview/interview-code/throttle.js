/**
 * 节流函数
 * https://www.cxymsg.com/guide/jsWritten.html#实现节流函数（throttle）
 * 1. 相比于防抖 节流更多是执行次数的控制 
 * 2. 通过标志量
 * 3. 可以使得一次操作成功后 后续的操作才有被执行的可能 减少执行频次
 */
function throttle(fn, delay) {
  let flag = true; // 节流阀是关闭的吗？？
  return function(...arg) {
    if (!flag) return; // 其实是一种函数内短路
    flag = false;
    setTimeout(function(){
      fn.apply(this, arg);
      flag = true;
    }, delay);
  }
}
