/**
 * redux 的 reducer - 对应组件 - order-Select
 */
import { actionTypes, defaultState } from '../../constants/order-select';

const TOGGLE_DROP = actionTypes.TOGGLE_DROP;

/**
 * reducer - 切换下拉开关的状态
 * 1- 在mapStateToProps时 这里的函数名orderSelect就会是state对象中一个属性
 * 2- 既结构就是state = { orderSelect: { state } }
 * 3- 所以 这里的返回值就是state.orderSelct这一部分
 */
const orderSelect = (state = { isDropDown: false }, action) => {
  switch (action.type) {
    case TOGGLE_DROP:
      return { isDropDown: !state.isDropDown };
    default:
      return state;
  }
}


export { orderSelect };