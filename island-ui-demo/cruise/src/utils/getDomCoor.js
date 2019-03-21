/**
 * 获取元素的位置信息
 * 1- 例如一些兼容性处理/计算处理 可以在这里封装
 */

/**
 * 
 * @param {obj} domObj 元素实例 
 */
const getDomCoor = (domObj) => {
  return domObj.getBoundingClientRect();
}

export { getDomCoor };