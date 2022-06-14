/**
 * object.create polyfill
 * 根据prototype生成一个对象实例
 * 创建一个新对象，使用现有的对象来提供新创建的对象的__proto__
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

    // algo 构造一个临时的constructor,并让其prototype指向入参proto，通过new来生成一个该constructor的实例
    function F() {};

    F.prototype = proto;

    return new F();
  }
}