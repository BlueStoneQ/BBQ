/**
 * - AOP拦截器
 * - 拦截android运行时权限申请弹窗
 * - 该AOP函数执行时机：在整个项目启动的时候执行， 只在android环境下执行（IOS无运行时权限申请弹窗）
 */
import { PermissionsAndroid } from 'react-native'
import taskManager from '../调度中心/弹窗异步任务管理器'
import { taskType } from '../策略中心/策略配置中心'

const originalRequest = PermissionsAndroid.request
PermissionsAndroid.request = (permisstionType, config = {}) => {
  // 如果要拦截的弹窗type不在对应策略中 则会直接调用弹窗
  if (!this.getStrategy().includes(permisstionType)) {
    return originalRequest(permisstionType, config)
  }

  // 定义该任务
  const task = () => {
    // 拉起弹窗
    return new Promise((resolve, reject) => {
      // 触发弹窗显示
      originalRequest(permisstionType, config).then(res => {
        if (res === PermissionsAndroid.RESULTS.GRANTED) return resolve(res)
        reject() // 该task结束，调度中心会取队列中下一个任务进行执行
      }).catch(err => {
        reject()
      })
    })
  }

  // 将该任务注册到弹窗调度中心
  taskManager.addTask({
    task,
    type: taskType.permisstion // 该type用来在调度中心去根据策略映射出priority
  })
}