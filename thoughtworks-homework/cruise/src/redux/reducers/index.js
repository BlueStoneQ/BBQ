/**
 * redux 的 reducer、
 * 在这里把多个reducer合并成一个 映射/管理state
 */
import { combineReducers } from 'redux';
import { orderSelect } from './order-select';

// 这里注意 - combineReducers的参数是一个对象 各个reducer过来 我们必须要用{}包裹起来 因为源码中这个参数作为一个对象进行判断的
const reducers = combineReducers({orderSelect});

export default reducers;