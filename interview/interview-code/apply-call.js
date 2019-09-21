/**
 * 模拟实现call 和 apply
 * 1. 参考：https://github.com/mqyqingfeng/Blog/issues/11
 * 2. 核心原理：将函数this作为属性挂载到传入的对象context上，并以context.fn去调用函数 则函数中的this自然就是context;
 * 2. 记住：一定要delete context上的fn属性 程序一定不要有污染
 * 3. call 和 apply 两大作用
 *  1）改变函数的this指向
 *  2）给函数传入参数并执行函数 返回函数返回值
 */

 /**
  * 模拟实现call
  * @param {object} context fn.call(this)给函数绑定的this
  */
Function.prototype.call2 = function(context) {
  // context === null的处理
  context = context || window;
  // 通过this拿到函数本身，并挂载到context上
  context.fn = this;
  // 拿到参数
  var args = [];
  for (var i = 1, len = arguments.length; i < len; i++) {
    args.push(arguments[i]);
  }
  // 执行函数 es6的写法是 context.fn(...args);
  var result = eval('context.fn(' + args + ')');
  // [重要] 删除context.fn 清理污染
  delete context.fn;
  return result;
}

/**
 * 模拟实现apply
 */
Function.prototype.apply2 = function(context) {
  context = context || window;
  context.fn = this;
  var args = [];
  for (var i = 1, len = arguments.length; i < len; i++) {
    args.push(arguments[i]);
  }
  var result = context.fn(...arg);// 这里用es6的扩展符
  delete context.fn;
  return result;
}

/**
 * 测试
 */
function a () {
  console.log('开始了： v1: ', this.v1, 'v2: ', this.v2);
  for (let i = 0, len = arguments.length; i < len; i++) {
    console.log(arguments[i]);
  }
}

const obj1 = {
  v1: 1,
  v2: '234'
};

/**
 * 正常值测试
 */
a.call2(obj1);
a.apply(obj1);
/**
 * 异常值测试
 */
a.apply();
a.apply(null);
