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
  // 判定type是否在拦截名单内
  if (needInterceptActionTypeList.includes(action.type)) {
    // 弹窗调度器需要的task: promiseCreator
    const task = () => {
      // 该promise会在弹窗调度器中被return并执行
      return new Promise((resolve, reject) => {
        action.resolve = resolve // 通过action将resolve和reject传递到对应的弹窗中 在弹窗确认/关闭的时候 调用resolve， 来通知倒调度中心
        action.reject = reject
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