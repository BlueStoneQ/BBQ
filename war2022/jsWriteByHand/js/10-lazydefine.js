/**
 * 惰性函数：惰性定义
 * 2022-3-2
 * https://github.com/mqyqingfeng/Blog/issues/44
 */

/**
 * 举个例子 判断环境 对某个值进行初始化
 * 例如在调用的时候 才嗅探特性 确定当前函数定义
 * 这个例子是封装一个通用的 或者说 动态适应平台的 时间添加器
 */
function addEvent (type, el, fn) {
  if (window.addEventListener) {
    // 在第一次调用时 根据特征进行重新定义 
    addEvent = function(type, el, fn) {
      el.addEventListener(type, fn, false);
    }
  }

  if (window.attachEvent) {
    addEvent = function(type, el, fn) {
      el.attachEvent('on' + type, fn);
    }
  }

  // me: 我觉得应该有调用这一句，此时调用的已经是重新定义过的addEvent 不会无限递归
  addEvent(type, el, fn);
}