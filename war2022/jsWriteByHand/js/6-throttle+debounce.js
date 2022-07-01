/**
 * throttle 和 debounce 本质上都是 高阶函数
 * 2022-2-28
 * 1. 方法1：时间间隔
 * 2. 方法2：使用定时器
 * - 闭包 + 高阶函数（对fn进行包裹后返回一个新函数）
 * - 也就是对要执行的函数，例如onscroll的回调进行包裹后 处理
 * window.addEventListener('scroll', throttle(imgLazyLoad));
 * - [这里还有一个更全面的的节流实现-综合了时间戳 + 定时器 2种方案](https://github.com/mqyqingfeng/Blog/issues/26)
 * 
 * 也要理解：时间戳差 和 防抖的实现方案 各自的特点
 */


/**
 * throttle
 * 时间戳差实现
 */
const throttle1 = (fn, delay = 300) => {
  let start = 0; // 这里应该初始值为 0, 这样节流的第一次 总会立刻先执行一次，接下来节流执行
  // 这里为0的话 now - start = now - 0 = 自1970年的计算机时间起点到现在的时间 是计算机系统中的最大时间 绝对>deley 自然不会return

  return function (...args) {
    // init data
    const now = Date.now();
    // defend
    if (now - start < delay) return;
    
    const context = this;
    // 放行 执行
    fn && fn.apply(context, args);
    start = now;
  }
}

/**
 * throttle
 * 基于定时器实现
 */
const throttle2 = (fn, delay = 300) => {
  let timer = null;

  return function (...args) {
    // defend
    if (timer) return;

    // init data
    const context = this;

    timer = setTimeout(() => {
      fn && fn.apply(context, args);
      // 本次执行结束 重置timer
      clearTimeout(timer);
      timer = null;
    }, delay);
  }
}


/**
 * debounce 防抖
 * @param {function} fn 
 * @param {number} delay 
 * @return {function}
 */
function debounce(fn, delay = 300, immediate = true) {
  let timer = null;

  return function() {
    // init data
    const context = this, args = arguments;
    
    // 有需要的话-可以第一次立即执行
    if (immediate && !timer) {
      fn && fn.apply(context, args);
    }

    // 清除之前的timer 从新开始计时
    if (timer) {
      clearTimeout(timer)
      timer = null; // 需要手动将timer值赋值为null clearTimeout不会做这件事 
    };

    // 设置计时器
    timer = setTimeout(function() {
      fn && fn.apply(context, args);
      // 清除定时器
      clearTimeout(timer)
      timer = null; // 需要手动将timer值赋值为null, 要不然下一次timer还是有值的，就永远进不来了
    }, delay);
  }
}


/**
 * 高阶函数 - 我们真正使用的是 它生成的新函数
 * debounce 的问题在于它“太有耐心了”。试想，如果用户的操作十分频繁——他每次都不等 debounce 设置的 delay 时间结束就进行下一次操作，
 *  于是每次 debounce 都为该用户重新生成定时器，回调函数被延迟了不计其数次。频繁的延迟会导致用户迟迟得不到响应，用户同样会产生“这个页面卡死了”的观感。
 * 为了避免弄巧成拙，我们需要借力 throttle 的思想，打造一个“有底线”的 debounce
 *  ——等你可以，但我有我的原则：delay 时间内，我可以为你重新生成定时器；但只要delay的时间到了，我必须要给用户一个响应。
 * 这个 throttle 与 debounce “合体”思路，已经被很多成熟的前端库应用到了它们的加强版 throttle 函数的实现中：
 * 
 * 实现：time + setTimeout思想合体
 */

function throttleDebounce(fn, delay) {
  let startTime = 0; // 这里应该初始值为 0, 这样节流的第一次 总会立刻先执行一次，接下来节流执行
  let timer = null;

  return function(...args) {
    const context = this; // 这个this就是这个函数调用的时候的this
    const nowTime = new Date().getTime();

    if (nowTime - startTime < delay) {
      // 在deley内 继续防抖
      // 如果时间间隔小于我们设定的时间间隔阈值，则为本次触发操作设立一个新的定时器
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn && fn.apply(context, args);  
      }, delay);
    } else {
      //  超过delay 必须给个响应
      startTime = new Date().getTime();
      // 到达或者超过delay 必须执行一次
      fn && fn.apply(context, args);
    }
  }
}

