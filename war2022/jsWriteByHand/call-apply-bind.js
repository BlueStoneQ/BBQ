/**
 * 2022-3-1
 */


const call = (...args) => {
  // 防御
  if (typeof this !== 'function') {
    return;
  }

  // 获取context
  const context = args.shift() || window;
  // 获取当前函数 并挂载到context上 这样就完成了this的绑定
  context.fn = this;
  // 执行当前函数 并返回函数返回值
  const result = context.fn(...args);
  // 卸载该属性
  delete context.fn;
  
  return result;
}