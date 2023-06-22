## 资料
- [React入门-阮一峰](https://www.ruanyifeng.com/blog/2019/09/react-hooks.html)
  - [react-hooks教程-写的比官网易懂](https://github.com/puxiao/react-hook-tutorial)
- [React-hooks-官网](https://zh-hans.reactjs.org/docs/hooks-intro.html)
- [掘金-React高频考点-hooks](https://juejin.cn/post/6940942549305524238#heading-2)
- [剑指前端-React-hooks原理](https://febook.hzfe.org/awesome-interview/book3/frame-react-hooks)

## 常用hooks
### useState
#### useState的函数参数
- 如果新的 state 需要通过使用先前的 state 计算得出，那么可以将函数传递给setState。该函数将接收先前的 state，并返回一个更新后的值。
### useEffect
- 函数签名
- 一般是用来处理副作用
- 作用
  - 模拟生命周期
  1. componentDidMount
  ```js
  useEffect(() => {
    //无论是第一次挂载还是以后每次组件更新，修改网页标题的执行代码只需要在这里写一次即可
    document.title = `${a} - ${Math.floor(Math.random()*100)}`;
  }, []) // 这里第二个参数给空，就是只执行一次，这个useEffect不依赖任何变量的更新所引发的组件重新渲染
  ```
  2. componentDidUpdate
  ```js
    useEffect(() => {
      //无论是第一次挂载还是以后每次组件更新，修改网页标题的执行代码只需要在这里写一次即可
      document.title = `${a} - ${Math.floor(Math.random()*100)}`;
    }) // 这里第二个参数不给值 就是监听所有state/props变化
  ```
  3. componentWillUnmount
  ```js
  useEffect(()=>{
	return()=>{
      // componentWillUnmount 逻辑
    }
  })
  ```
### useRef
### useContext
- React.createContext();
### useReducer
- 勾住”某些自定义数据对应的dispatch所引发的数据更改事件。useReducer可以替代useState，实现更为复杂逻辑的数据修改。
- 在React 16.8版本以前，通常需要使用第三方Redux来管理React的公共数据，但自从 React Hook 概念出现以后，可以使用 useContext + useReducer 轻松实现 Redux 相似功能。
- useReducer是useState的升级版(实际上应该是原始版)，可以实现复杂逻辑修改，而不是像useState那样只是直接赋值修改。
  - 1、在React源码中，实际上useState就是由useReducer实现的，所以useReducer准确来说是useState的原始版。
  - 2、无论哪一个Hook函数，本质上都是通过事件驱动来实现视图层更新的。
- 疑问
1、为什么看上去使用useReducer后代码变得更多？
答：因为使用useReducer，我们将修改数据拆分为2个部分，即“抛出修改事件和事件修改处理函数”。虽然代码增多了，但是逻辑更加清晰。

2、为什么不使用useState，同时把它对应的变量也做成一个obj，就像useReducer的initralData那种？
答：单纯从1次ajax请求很难看出使用useState或useReducer的差异，但是试想一下多次且ajax返回值在结构类型上容易发生变更，那么使用useReducer这种更加利于代码阅读、功能扩展。
#### 什么时候用useState？什么时候用useReducer？
本人的建议是：组件自己内部的简单逻辑变量用useState、多个组件之间共享的复杂逻辑变量用useReducer。
### useMemo
- useMemo 主要是对组件的重新渲染有影响。一旦组件重新渲染，它将从缓存中提取值，而不必一次又一次地循环数组或着处理数据。
- me: 可以类比：Vue.compute 和 函数式中的 memo HOF
  - 相同参数进来 第二次就直接走缓存 而不是再计算了
- 首先要理解什么是缓存？缓存就是当依赖项和之前某一次一样的时候，这个时候会直接走缓存，而不是再次计算，类似函数式中的memo HOF
- https://juejin.cn/post/7122027852492439565
- [其实：要理解usememo和usecallback带来的优化-一定要先了解React.memo](https://juejin.cn/post/6844903954539626510)
- 目的：减少组件重新渲染时不必要的函数计算: - 用来缓存函数、组件、变量，以避免两次渲染间的重复计算
  - 1. 防止不必要的 effect
    - 如果一个值被 useEffect 依赖，那它可能需要被缓存（如果之前计算过的值，这次还出现，就不会变化了，会直接走缓存），这样可以避免重复执行 effect
    - 当变量(这里一般指对象和数组等引用类型的值,直接走缓存而不是一个新的引用地址)直接或者通过依赖链成为 useEffect 的依赖项时，那它可能需要被缓存。
    - 什么是不必要的effect?
    ```js
    const Component = () => {
      // 在 re-renders 之间缓存 a 的引用
      const a = useMemo(() => ({ test: 1 }), []);

      useEffect(() => {
        // 只有当 a 的值变化时，这里才会被触发
        doSomething();
      }, [a]);

    // the rest of the code
    };
    ```
  - 2. 防止不必要的 re-render。
    - 当使用 setState 改变 state 时，App 会 re-render，作为子组件的 Page 也会跟着 re-render
      - 但是 这里 useCallback 是完全无效的，它并不能阻止 Page 的 re-render。
      - 所以 组件级的re-render阻止:是 同时缓存 callback 和 组件本身（React.memo）
  - 3. 防止不必要的重复计算。
- 至于为什么不给所有的组件都使用 useMemo，上文已经解释了。useMemo 是有成本的，它会增加整体程序初始化的耗时，并不适合全局全面使用，它更适合做局部的优化
  - 缓存是有成本的，小的成本可能会累加过高。
- 默认缓存无法保证足够的正确性。
- 对应的是：useEffect， 也可以对应Vue中的compute
- b的变化由state.a引起，则b就使用用memo
- 总结：
  - 大部分的 useMemo 和 useCallback 都应该移除，他们可能没有带来任何性能上的优化，反而增加了程序首次渲染的负担，并增加程序的复杂性。
  - 使用 useMemo 和 useCallback 优化子组件 re-render 时，必须同时满足以下条件才有效。
  - 子组件已通过 React.memo 或 useMemo 被缓存
  - 子组件所有的 prop 都被缓存
  - 不推荐默认给所有组件都使用缓存，大量组件初始化时被缓存，可能导致过多的内存消耗，并影响程序初始化渲染的速度
### useCallback
- 勾住”组件属性中某些处理函数，创建这些函数对应在react原型链上的变量引用。useCallback第2个参数是处理函数中的依赖变量，只有当依赖变量发生改变时才会重新修改并创建新的一份处理函数。
  - 这个一般用在组件之间通过props传递的函数，例如onClick函数，其实就是将父组件这个函数的句柄挂在了React.prototype上，这样只要依赖state没有改变的时候，这个函数不会在每次re-render的时候 重复创建
  - 如果，依赖项是[], 则就是这个函数只创建一次，后面所有re-render都不会再重新创建该函数
- 目的：useCallback是通过获取函数在react原型链上的引用，当即将重新渲染时，用旧值的引用去替换旧值，配合React.memo，达到“阻止组件不必要的重新渲染”。
  - 因为callback型的props本质上，就是一个函数的引用，如果重新定义的话，相当于props发生改变，则子组件必然要改变
- 用法：签名：useCallback(callback,deps)
  - useCallback中的第2个依赖变量数组和useEffect中第2个依赖变量数组，作用完全不相同。
  ```
  useEffect中第2个依赖变量数组是真正起作用的，是具有关键性质的。而useCallback中第2个依赖变量数组目前作用来说仅仅是起到一个辅助作用。
  仅仅是辅助？辅助什么了？甚至你还可能会有一个疑问，既然处理函数中所有的依赖变量都需要做为第2个参数的内容，为啥React不智能一些，让我们不传第2个参数，省略掉这一步？
  在React官方文档中，针对第2个参数有以下这段话：
  注意：依赖项数组不会作为参数传给回调函数。虽然从概念上来说它表现为：所有回调函数中引用的值都应该出现在依赖项数组中。未来编译器会更加智能，届时自动创建数组将成为可能。
  ```

## 优化
### useMemo useCallback React.memo 优化函数式组件
- https://juejin.cn/post/6844903954539626510
- 首先这3个都优化的是不必要的re-render  
  - 不必要的re-render: 一般父组件update也会带着子组件update
- React.memo会优化一个组件 将其变成类似于PureComponent
```js
const childM = React.memo(child)

const parent = () => {
  return (<childM>)
}
```
- 但是, 当父组件传递给子组件状态（props)的时候，子组件还是会被re-render
```js
const childM = React.memo(child)

const parent = () => {
  return (<childM name={name}>)
}
```
- 所以 针对这种情况引起的re-render我们该怎么优化呢？这时候需要useMemo和useCallback了
- 总结：
  1. 在子组件不需要父组件的值和函数的情况下，只需要使用memo函数包裹子组件即可。
  2. 而在使用函数的情况，需要考虑有没有函数传递给子组件使用useCallback。
  3. 而在值有所依赖的项，并且是对象和数组等值的时候而使用useMemo
  4. 当返回的是原始数据类型如字符串、数字、布尔值，就不要使用useMemo了。
  5. 不要盲目使用这些hooks。
  6. 而useCallback useMemo优化re-render的前提就是使用了React.memo
    - useCallback useMemo 是在父组件中传递给Child组件props的时候使用
    - React.memo是用来包裹子组件的


## 具体问题
### 自定义hooks vs HOC vs render-props
## hooks原理