/**
 * 2022-2-28
 * new 作用：根据constructor生产一个对象实例
 * 
 * 至于: new 和 Object.create的区别：其实new的入参是 constructor, 而Object.create()的入参是 constructor.prototype
 */

function _new () {
  // init data
  const constructor = Array.prototype.shift.call(arguments);
  // defend
  if (typeof constructor !== 'function') {
    // 一般使用throw TypeError('xxx');
    console.error('type error');
    return;
  }
  const newObj = Object.create(constructor.prototype);
  // algo
  // 1. 执行constructor 将context作为this注入到constrctor中 这样 内部的一些属性就挂载到了newObj上了 
  const res = constructor.apply(newObj, arguments);

  // 2. 计算flag： constructor是否有返回值，且该返回值类型为对象或者函数
  const flag = res && (typeof res === 'object' || typeof res === 'function');
  
  // 3. constructor 有有效返回值 则直接使用该返回值 否则 使用我们构建的对象作为实例
  return flag ? res : newObj; 
}


/**
 *  如果考虑到 Object.create中也使用了new 那么 我们可以使用这个工厂方法实现一个new 代替原来的new
 */
function _new2 () {
  // new一个新对象
  var obj = {};
  // 拿到Constructor - （因为arguments不是数组，而是类数组，所以自身不能直接调用shift
  var Constructor = [].prototype.shift.call(arguments);
  // 实现新对象和构造函数之间的原型链继承
  obj.__proto__ = Constructor.prototype;
  // 通过apply将Constructor中的this绑定为obj, 运行constructor(工厂生产), 拿到构造函数的返回值
  var res = Constructor.call(obj, arguments); 

  const flag = res && (typeof res === 'object' || typeof res === 'function');
  // 根据new的特性和构造函数返回值 确定最终new的返回值: ret为基本类型 就返回obj,忽略基本类型的返回值；ret为对象时，返回ret本身
  return flag ? res : obj; 
}