/**
 * 2022-3-1
 * !!! 不要用箭头函授
 */


Function.prototype._call = function (...args) {
  // 防御
  if (typeof this !== 'function') {
    throw new TypeError('call should be called by function');
  }

  // 获取context
  const context = args.shift() || window;
  // 获取当前函数 并挂载到context上 这样就完成了this的绑定
  context.fn = this;
  // 执行当前函数 
  const result = context.fn(...args); // 这里...args 其实就是把args数组变成了参数列表
  // 卸载该属性
  delete context.fn;
  // 返回函数返回值
  return result;
}


Function.prototype._apply = function (...args) {
  // defend
  if (typeof this !== 'function') {
    throw new TypeError('call should be called by function');
  }

  // 获取context
  const context = args[0] || window;
  // 获取当前函数 挂载到context上
  context.fn = this;
  // 获取当前参数
  const params = args[1] || []; // 与call的不同 这里第二个参数是数组形式的参数
  const result = context.fn(...params); // 这里...args 其实就是把args数组变成了参数列表
  // 卸载该函数从context上
  delete context.fn;
  // return 该函数返回值
  return result;
}

/**
 * bind是高阶函数 需要返回一个函数
 * 一般借助于apply实现
 * @param  {...any} args 
 * 参考：https://github.com/mqyqingfeng/Blog/issues/12
 * 参考-这一篇bind解释写的更细一些：https://github.com/sisterAn/JavaScript-Algorithms/issues/81
 */
Function.prototype._bind = function() {
  // defend
  if (typeof this !== 'function') {
    throw new TypeError('bind should be called by function');
  }

  // init data
  const originalContext = arguments[0] || window;
  const originalParams = Array.prototype.slice.call(arguments, 1) || [];
  const fn = this;
  
  // 定义返回的函数 这里要用ES5函数 因为bind后的函数 依然可以用作构造函数 且构造函数的this为其实例
  function F () {
    // 这里的this 不是上面的this哦 上面的this是函数本身 这里的this可能是实例（new的话） 或者 当前的调用环境
    // 合并参数
    const params = [...originalParams, ...arguments];
    // 这里需要判断调用方式 常规调用 还是 new调用 并采用不同的context 
    // 当使用new操作函数时候,保证this的指向 - 当 bind 返回的函数作为构造函数的时候，bind 时指定的 this 值会失效，但传入的参数依然生效
    const _this = this instanceof F ? this : originalContext;
    return fn.apply(_this, params);
  };

  // 维护原型关系
  // 这里的主要目的是为了让 F（生成的新函数） 可以和 fn（被bind的函数）原型链 链接起来 - 这样  这个方法就和原来的方法在原型链的表现傻瓜表现一致了，
  //     原来函数原型链上的属性和方法，bind生成的F 也可以同样访问了
  // 至于通过fNOP这样的一个空函数进行原型链链接 - 是为了避免F.prototype 修改 污染到原函数fn.prototype 
  // 解释：https://github.com/mqyqingfeng/Blog/issues/12
  // 如果我们直接将 F.prototype = this.prototype，我们直接修改 F.prototype 的时候，也会直接修改绑定函数的 prototype。这个时候，我们可以通过一个空函数来进行中转
  // me: 我们要理解 F 是bind返回的一个新函数 而this是我们被bind处理的函数 它们2个是独立的，this被bind处理后 本身什么也没有变 所以 这里要斩断新函数F 和 原来函数this的关系
  // 在普通面试中 如果面试官不做要求 可以不写这一步
  const fNOP = function() {};
  fNOP = this.prototype;
  F.prototype = new fNOP(); // 等于新的F的原型是原来函数的原型的实例 - 本质上就是用原型链链了起来

  // return
  return F;
}