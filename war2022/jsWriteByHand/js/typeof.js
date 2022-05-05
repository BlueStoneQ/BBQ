/**
 * 2022-3-1
 */

const TYPE = {
  array: 'array', // 等等...
};

/**
 * 
 * @param {*} value 
 * @return {string} 最好有一个常量表 统一查询
 */
const _typeof = (value) => {
  // defend
  // case1 null
  if (value === null) return `${value}`;
  // case2 引用类型
  if (typeof value === 'object') {
    const protoTypeStr =  Object.prototype.toString.call(value)
    return protoTypeStr.split(' ')[1].split(']')[0].toLowerCase(); // 抠出array 等等真正的类型字符串
  }
  // case3 基础类型
  return typeof value;
}