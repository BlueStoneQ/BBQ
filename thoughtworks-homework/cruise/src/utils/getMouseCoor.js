/**
 * 工具 - 获取鼠标指针在屏幕上的位置坐标等数据
 * 1- 包括兼容性处理
 */

 /**
  * 获取鼠标
  * @param { obj } e 
  */
 const getClientCoor = (e) => {
  return { clientX: e.clientX, clientY: e.clientY }
 }

 /**
  * 初始化
  * 绑定鼠标事件
  */
//  function init() {}

 export { getClientCoor }