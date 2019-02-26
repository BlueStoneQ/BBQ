/**
 * redux 的 reducer - 对应组件 - PopBox
 */
import { actionTypes, defaultState } from '../../constants/pop-box';

const TOGGLE_VISIBLE = actionTypes.TOGGLE_VISIBLE;

/**
 * 计算PopBox是否显示的state量-visible
 * 1- 这里的reducer函数名就是redux的store中的这一部分state的对象的key
 */
const popBox = (state = { visible: defaultState.visible }, action) => {
  switch (action.type) {
    case TOGGLE_VISIBLE:
      return { visible: !state.visible }; // 这里返回的其实是store.PopBox,而这里的state是指redux store树的一部分：popBox
    default:
      return state;
  }
}

export { popBox };