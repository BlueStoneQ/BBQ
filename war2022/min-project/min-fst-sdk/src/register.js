const register = (config) => {
  // 参数 防御 合并 等处理
  const { key, uuid, samplingRate } = config;
  // 将入参写入到config中
  // 初始化
  try {
    // 初始化配置: 合并传入的config和自己的默认config 得到最终的config
    // 初始化 + hook Component
  } catch(err) {
    const errMsg = 'min-fst-sdk init error';
    console.log(errMsg);
    throw new Error(errMsg);
  }
}

export default { register }