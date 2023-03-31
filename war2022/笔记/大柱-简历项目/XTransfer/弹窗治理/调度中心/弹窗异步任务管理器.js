import PriorityQueue from './优先级任务队列'
import { getPriority } from '../策略中心/策略中心'

/**
 * 优先状态机: 状态， 2个状态可以互相转化
 */
const status = {
  RUN_ING: 'running', // 任务执行中
  NO_RUN_ING: 'noRunning' // 无任务执行中
}

class TaskManager {
  constructor() {
    // 需要一个优先级队列(小顶堆)：每次pop出来是priority最小的（优先级数值最小的），priority的设计是：因为和数组下标对齐，所以、所以priority越小，意味着在优先级队列中越靠前，则优先级越高
    this.queue = new PriorityQueue((a, b) => a.priority - b.priority)
    this.status = status.NO_RUN_ING
  }

  /**
   * 
   * @param {func} task promiseCreator
   */
  addTask(taskObj) {
    const { type, task } = taskObj
    // 根据最新策略 + 为每个任务根据策略配置找到对应的priority
    this.queue.push({
      task,
      priority: getPriority(type)
    })

    // 当前队列只有刚刚加入的一个任务 && 当前没有任务执行 => 则执行新填入的任务
    if (this.queue.size() === 1 && this.status === status.NO_RUN_ING) {
      this.run()
    }
  }

  run() {
    // base case
    if (this.queue.isEmpty()) return 

    const curTask = this.queue.pop()

    this.status = status.RUN_ING

    curTask().then(res => {
      this.status = status.NO_RUN_ING
      this.run()
    }).catch(err => {
      this.status = status.NO_RUN_ING
      this.run()
    })
  }
}

export default new TaskManager()