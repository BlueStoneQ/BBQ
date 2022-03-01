/**
 * 2022-3-1
 */


const call = (...args) => {
  // 防御
  if (typeof this !== 'function') {
    console.error('type error');
    return;
  }

  // 获取context
  const context = args.shift() || window;
  // 获取当前函数 并挂载到context上 这样就完成了this的绑定
  context.fn = this;
  // 执行当前函数 
  const result = context.fn(...args);
  // 卸载该属性
  delete context.fn;
  // 返回函数返回值
  return result;
}


const apply = (...args) => {
  // defend
  if (typeof this !== 'function') {
    error('type error');
    return;
  }
  
  // 获取context
  const context = args[0] || window;
  // 获取当前函数 挂载到context上
  context.fn = this;
  // 获取当前参数
  const args1 = args[1] || [];
  const result = context.fn(...args1);
  // 卸载该函数从context上
  delete context.fn;
  // return 该函数返回值
  return result;
}