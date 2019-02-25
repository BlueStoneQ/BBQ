/**
 * 对应组件order-select的redux中的action
 */
import { actionTypes } from '../../constants/order-select';

const TOGGLE_DROP = actionTypes.TOGGLE_DROP;

/**
 * action - 切换下拉开关的状态
 * @param {bool} isDropDown 当前isDropDown的值 - 这样做是不是有些问题？？ 
 */
const toggleDrop = (isDropDown) => {
  return {
    type: TOGGLE_DROP
  }
};

export { toggleDrop };