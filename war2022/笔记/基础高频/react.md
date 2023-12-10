
# hooks
## useEffect模拟生命周期
```js
useEffect(() => {  
  // 这里的代码在组件首次渲染后运行一次 componentDidMount 
  return () => {  
    // 这里的代码在组件卸载时运行 componentWillUnmount
  };  
}, []);  // 空数组表示这个副作用只会在首次渲染和更新后运行，以及在卸载时运行

useEffect(() => {  
  // 不传递这个数组，那么组件每次渲染时都会执行副作用函数 componentDidUpdate
});
```
## useReducer+useContext来代替redux管理状态
- https://juejin.cn/post/6995105000523317278
- https://juejin.cn/post/6844904153773244429
- initState
```js
export default {
  count: 0
}
```
- reducer
```js
import { useReducer } from 'react'
import initState from './initState'

const reducer = (state, action) => {
  const { type, ...payload } = action

  swicth(type) {
    case "increment": 
      return state.count + 1;
    default:
      return state;
  }
}

export default [ state, dispatch ] = useReducer(reducer, initState)
```
- context
```js
import React from 'react';

export const Context = React.createContext({});
```
- rootComponent进行provider
```js
import Context from './context'
import [ state, dispatch ] from './reducer'

// contextProvider
export default (children) => <Context.Provider value={ state, dispatch }>{ children }</Context.Provider>
```
- 子组件中使用context中的reducer, 一般我们把当前组件子树的root节点作为provider的第一子节点
```js
import React, {useContext} from 'react'
import { context } from './context'
import ConextProvider from './contextProvider'

const SubRoot = () => {
  const { state, dispatch } = useContext(context);

  return (
    <>
      <div>{ state.count }</div>
      <button onClick={() => {dispatch("increment")}}></button>
    </>
  )
}

export ConextProvider(SubRoot)
```
## useRef+forwardRef
## 优化：useMemo + useCallback

# 常用自定义hook
- https://juejin.cn/post/6844904074433789959

# 考点
## react hooks原理 为什么不能再循环 条件 和嵌套函数中使用
React Hooks的设计原则之一是在任何函数组件的最顶层使用它们，并且避免在循环、条件和嵌套函数中使用。这是为了确保每次渲染时，Hook的调用顺序都保持一致。

在React中，每次组件渲染时，所有的Hook都会按照它们出现的顺序被调用。如果你在循环、条件或嵌套函数中使用Hook，那么它们可能会在每次渲染时被不同的Hook调用，这可能会导致不可预测的行为和错误。

另外，React在每次渲染之间保留并重用Hook的调用结果，以确保在多次渲染之间保持状态的一致性。如果你在循环、条件或嵌套函数中使用Hook，那么每次渲染时Hook的调用顺序可能会改变，这可能会导致状态的不一致。

因此，为了确保React Hooks的正常工作和正确性，我们应该始终在函数组件的最顶层使用它们，并且避免在循环、条件和嵌套函数中使用。