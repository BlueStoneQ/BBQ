/**
 * 对应组件order-select的redux中的常量存储
 */
const defaultState = {
  isDropDown: false // orderSelct是否下拉 - 默认不下拉
};

const actionTypes = {
   TOGGLE_DROP: 'TOGGLE_DROP' // toggle是否下拉的state
};

export {
  defaultState,
  actionTypes
};