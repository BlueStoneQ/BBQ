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
  const params = args[1] || [];
  const result = context.fn(...params);
  // 卸载该函数从context上
  delete context.fn;
  // return 该函数返回值
  return result;
}

/**
 * bind是高阶函数 需要返回一个函数
 * 一般借助于apply实现
 * @param  {...any} args 
 */
Function.prototype.bind = function() {
  // defend
  if (typeof this !== 'function') {
    throw new TypeError('bind should be called by function');
  }

  // init data
  const originalContext = arguments[0] || window;
  const originalParams = arguments[1] || [];
  const fn = this;
  
  // 定义返回的函数 这里要用ES5函数 因为bind后的函数 依然可以用作构造函数 且构造函数的this为其实例
  function F () {
    // 合并参数
    const params = [...originalParams, ...arguments];
    // 这里需要判断调用方式 常规调用 还是 new调用 并采用不同的context
    const _this = this instanceof F ? this : originalContext;
    return fn.apply(_this, params);
  };

  // 维护原型关系
  const fNOP = function() {};
  fNOP = this.prototype;
  F.prototype = new fNOP();

  // return
  return F;
}