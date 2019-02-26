/**
 * 对应组件popBox的redux中的action
 */
import { actionTypes } from '../../constants/pop-box';

const TOGGLE_VISIBLE = actionTypes.TOGGLE_VISIBLE;

/**
 * action - 切换弹窗是否显示的状态
 */
const toggleVisible = () => {
  return {
    type: TOGGLE_VISIBLE
  };
}

export { toggleVisible };