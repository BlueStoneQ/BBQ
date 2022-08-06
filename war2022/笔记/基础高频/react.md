## 资料
- [在React中使用TS](https://juejin.cn/post/6844903684422254606)
- [在React-hooks中fetch数据](https://juejin.cn/post/6844903807000772621)
- [react-router-dom中文官网](https://react-router.docschina.org/web/example/basic)

## 摘录
- 当一个组件不需要管理自身状态时，也就是无状态组件，应该优先设计为函数组件。

## 原理
### React渲染
一个 React 组件的渲染主要经历两个阶段：
- 调度阶段（Reconciler）：用新的数据生成一棵新的树，然后通过 Diff 算法，遍历旧的树，快速找出需要更新的元素，放到更新队列中去，得到新的**更新队列**
- 渲染阶段（Renderer）：遍历更新队列，通过调用宿主环境的 API，实际更新渲染对应的元素。宿主环境如 DOM，Native 等。
### fiber
- [Reac-Fiber的作用和原理](https://febook.hzfe.org/awesome-interview/book2/frame-react-fiber)
### diff
- 更新的最小粒度是原始标签

## 类组件
### this指向问题
- [react-this指向问题](https://www.bilibili.com/video/BV1wy4y1D7JT?p=15&vd_source=9365026f6347e9c46f07d250d20b5787)
- ES6类中的方法都严格开启严格模式，this不会默认指向window， 所以 不处理的React类中的this为undefined
- 在onClick之类注册的回调函数 不是通过组件实例调用的 而是直接调用的

## hooks
### 关于createRefs 和 useRef
- [Ref总结](https://juejin.cn/post/6992019421363453960)
- 相同：都是调用React的内部方法，然后都是将返回值赋值给组件内部某元素的ref属性，而且二者好像都能用在函数组件中。
- 区别：在组件每次重新渲染时，createRef生成的都是一个全新的对象，那么也就不会保存上一次的current属性值； 而useRef自始自终生成的都是同一个对象，或者说自始自终操作的的都是指向同一个对象的内存地址值

## 代码复用
### HOC
- 优点∶ 逻辑服用、不影响被包裹组件的内部逻辑。
- 缺点∶ hoc传递给被包裹组件的props容易和被包裹后的组件重名，进而被覆盖
### render-props
```js
class MouseTracker extends React.Component {
  render() {
    return (
      <div>
        <h1>移动鼠标!</h1>
        <Mouse render={mouse => (
          <Cat mouse={mouse} />
        )}/>
      </div>
    );
  }
}
```
- 优点：数据共享、代码复用，将组件内的state作为props传递给调用者，将渲染逻辑交给调用者。
- 缺点：无法在 return 语句外访问数据、嵌套写法不够优雅
### 自定义hooks
- 其实很简单，就是一个函数，这个函数里面使用hook的api
- 局限：hook只能在组件顶层使用，不可在分支语句中使用

