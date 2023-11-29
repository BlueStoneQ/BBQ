/**
 * - redux middleware 拦截器
  - 拦截redux驱动的react弹窗组件
  - 中间件本质上其实是一种面向切面编程思想(AOP)的实现
 */
  import taskManager from '../调度中心/弹窗异步任务管理器'
  import { taskType } from '../策略中心/策略配置中心'

// 配置化: 需要被拦截的弹窗的action.type
const needInterceptActionTypeList = [
  'type1',
  'type2'
]

const popMiddleware = store => next => action => {
  // 判定type是否在拦截名单内: action.payload.from === 'popManager' 用来标志是否来自popManager的执行：dispatch，从popManager dispatch到这里，则直接走后面的next
  if (needInterceptActionTypeList.includes(action.type) || !action.payload.from === 'popManager') {
    // 弹窗调度器需要的task: promiseCreator
    const task = () => {
      // 该promise会在弹窗调度器中被return并执行
      return new Promise((resolve, reject) => {
        action.payload.from = 'popManager'
        action.payload.$resolve = resolve // 通过action将resolve和reject传递到对应的弹窗中 在弹窗确认/关闭的时候 调用resolve， 来通知倒调度中心
        action.payload.$reject = reject
        next(action) // 触发弹窗显示，在相关的关闭弹窗的reducer中可以调用该resolve和reject
      })
    }

    taskManager.addTask({
      task,
      type: taskType.广告弹窗 // 该type用来在调度中心去根据策略映射出priority
    })
  }

  // 不需要拦截的action 直接走下一个中间件
  next(action)
}

// 对相应的reducer也要做一定的改造
function show(state = initialState, action) {
  const { $resolve, $reject } = action.payload
  switch (action.type) {
    case 'show':
      return {
        ...state,
        show: {
          show: true,
          popTask: { $resolve, $reject }
        }
      }; // 这样 component可以通过react-redux.connect.mapStateToProps拿到这个新的状态中的resolve, 在自己弹窗关闭的函数中调用resolve/reject => 驱动调度中心任务链继续向前
    case 'hide':
      return { ...state, b: action.payload };
    default:
      return state
  }
}
