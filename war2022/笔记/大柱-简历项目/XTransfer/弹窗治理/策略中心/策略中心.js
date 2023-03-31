import strategyConfig from './策略配置中心'


/**
 * 该函数会自己收集key的各个信息
 * @param {*} obj { env:android, isLogin: true, isFirstLogin: true }
 * @returns "env=android&isLogin=true&isFirstLogin=true"
 */
export const getStrategyKey = (obj = {
  env: RN.platform.env(),
  isLogin: isLogin(),
  isFirstLogin: isFirstLogin()
}) => {
  return Object.entries(obj).sort((a, b) => a - b).join('&').replace(/,/g, '=')
}

export const getStrategy = (strategyKey = getStrategyKey()) => {
  return strategyConfig[strategyKey]
}

export const getPriority = (taskType, strategy = getStrategy()) => {
  return strategy.indexof(taskType)
}