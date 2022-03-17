/**
 * object.create polyfill
 * 2022-2-28
 * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/create
 */

/**
 * 特性嗅探 和 重新定义 并挂载
 */
if (typeof Object.create !== 'function') {
  Object.create = function (proto) {
    // defend
    if (typeof proto !== 'object' || typeof proto !== 'function') {
      throw new TypeError('Object prototype may only be an Object: ', proto);
    }

    // algo
    function F() {};

    F.prototype = proto;

    return F;
  }
}