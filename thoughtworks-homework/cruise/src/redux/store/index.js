/**
 * 导出redux的store
 */
import { createStore } from 'redux';
import reducers from '../reducers';

// 创建store实例
let store = createStore(reducers);

export default store;