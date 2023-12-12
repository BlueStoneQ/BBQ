/**
 * - HOC拦截器
 * - 拦截props驱动的react弹窗组件
 */
import taskManager from '../调度中心/弹窗异步任务管理器'
import { taskType } from '../策略中心/策略配置中心'

export const PopHOC = function(wrappedComponent) {
  // 返回一个新的组件
  return function(props) {
    // 这里对props进行拦截 封装一个触发弹窗任务传递过去
    const { show, ...otherProps } = props

    const [ _show, setShow ] = useState(false)

    const popTask = {}

    // 弹窗调度器需要的task: promiseCreator
    const task = () => {
      // 该promise会在弹窗调度器中被return并执行
      return new Promise((resolve, reject) => {
        setShow(true) // 触发弹窗显示
        popTask.resolve = resolve // 通过props.task将resolve和reject传递到wrapComp中 在弹窗确认/关闭的时候 调用resolve， 来通知倒调度中心
        popTask.reject = reject
      })
    }

    if (show) {
      delete props.show
      taskManager.addTask({
        task,
        type: taskType.引导弹窗 // 该type用来在调度中心去根据策略映射出priority
      })
    }

    // 不是用show的弹窗组件，可以配置项props的映射关系，或者再包一层，用show作为props来映射到组件真正管理是否显示的props上
    return <wrappedComponent show={_show} popTask { ...otherProps }></wrappedComponent>
  }
}