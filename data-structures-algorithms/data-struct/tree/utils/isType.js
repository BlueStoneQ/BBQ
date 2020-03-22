/**
 * 判断类型的工具函数
 */

 /**
  * map: <类型: Object.prototype.toString>
  */
const TYPE = {
  array: "[object Array]",
  object: "[object Object]",
  func: "[object Function]"
}


  /**
  * 类型判断
  * @param { any } val 需要确定类型的值
  * @param { string } type TYPE中的key
  */
function isType(val, type) {
  // TODO: 防御
  return Object.prototype.toString.call(val) === TYPE[type];
}

module.exports = {
  TYPE,
  isType
}