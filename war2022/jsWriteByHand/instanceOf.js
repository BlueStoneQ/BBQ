/**
 * 2022-2-28
 */

/**
 * instanceof 运算符用来检测 constructor.prototype 是否存在于参数 object 的原型链上。
 */
function _instanceof(obj, constructor) {
  // defend
  // init data
  const proto = Object.getPrototypeOf(obj);
  const constructorProto = constructor.prototype;
  // algo
  while (proto) {
    // 判断 
    if (proto === constructorProto) return true;
    // 步进 本质其实是链表遍历
    proto = Object.getPrototypeOf(proto);
  }
  // return 
  return false;
}