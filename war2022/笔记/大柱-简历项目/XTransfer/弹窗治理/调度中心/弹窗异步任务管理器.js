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
    this.queue = new PriorityQueue((a, b) => a.priority - b.priority) // 因为弹窗的数量一般都非常有限 所以优先级队列
    this.status = status.NO_RUN_ING
  }

  /**
   * 
   * @param {func} task promiseCreator
   */
  addTask(taskObj) {
    // 配合状态机：一旦开始执行就会变成“running”状态 不能再填入队列任务了
    if (this.status === status.RUN_ING) return;

    const { type, task } = taskObj
    // 根据最新策略 + 为每个任务根据策略配置找到对应的priority， 排序发生在每次添加task
    this.queue.push({
      task,
      priority: getPriority(type) 
    })

    // 执行时机，是在对应的策略配置中，所有的弹窗都被填入任务队列后 立刻执行，所以，每一次填入一步任务，都会做一次检查，是不是对应策略中的弹窗任务都已经填满了，填满了，立刻开始run
    this._isShouldStart() && this.run()

    // ❌当前队列只有刚刚加入的一个任务 && 当前没有任务执行 => 则执行新填入的任务
    // if (this.queue.size() === 1 && this.status === status.NO_RUN_ING) {
    //   this.run()
    // }
  }

  // 需要一个timeout，每次填入也会检查timeout, 如果超过timeout，则会立刻执行队列，按照已有顺序执行
  run() {
    // 更改状态机状态
    if (this.status !== status.RUN_ING) this.status = status.RUN_ING
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

  _isShouldStart() {
    return this._isTimeout || this.queue.size() === this.strategy.length;
  }
}

export default new TaskManager()