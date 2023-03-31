export const taskType = {
  广告弹窗: '广告弹窗',
  用户协议弹窗: '用户协议弹窗',
  引导弹窗: '引导弹窗',
  permisstion: 'permisstion' // android运行时权限
}

export default {
  // 策略1
  "env=android&isLogin=true&isFirstLogin=true": [
    taskType.用户协议弹窗,
    taskType.permisstion,
    taskType.广告弹窗,
    taskType.引导弹窗
  ],
  "env=ios&isLogin=true&isFirstLogin=true": [
    taskType.用户协议弹窗,
    taskType.广告弹窗,
    taskType.引导弹窗
  ]
}