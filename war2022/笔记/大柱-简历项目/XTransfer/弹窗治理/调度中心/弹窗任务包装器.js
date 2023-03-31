import { getStrategy } from '../策略中心/策略中心'

/**
 * 根据策略配置的优先级数据 给任务增加priority属性
 */
export const taskCreator = (task) => {
  const strategy = getStrategy()
  return {
    task,
    priority: strategy.indexof(task.type) // 策略的index就是优先级，index越小（靠前），则优先级越高
  }
}