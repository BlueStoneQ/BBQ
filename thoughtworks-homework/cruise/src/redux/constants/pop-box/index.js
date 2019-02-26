/**
 * 对应组件pop-box的redux中的常量存储
 */
const defaultState = {
  visible: false // orderSelct是否下拉 - 默认不下拉
};

const actionTypes = {
   TOGGLE_VISIBLE: 'TOGGLE_VISIBLE' // toggle是否下拉的state
}

export {
  defaultState,
  actionTypes
};