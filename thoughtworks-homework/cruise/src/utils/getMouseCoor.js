/**
 * 工具 - 获取鼠标指针在屏幕上的位置坐标等数据
 * 1- 包括兼容性处理
 * 2- 可能需要节流/防抖的处理 - 优化
 */

 /**
  * 获取鼠标
  * @param { obj } e 
  */
 const getClientCoor = (e1, e2) => {
  return { clientX: e1.clientX, clientY: e1.clientY, e1, e2 }
 }

 /**
  * 绑定鼠标事件
  */
 const addMouseListener = (document) => {
   document.addEventListener('mousemove', getClientCoor);
 }

  /**
   * 解除事件绑定
   */
const removeMouseListener = (document) => {
  document.removeEventListener('mousemove', getClientCoor);
}

 export { getClientCoor, addMouseListener, removeMouseListener };