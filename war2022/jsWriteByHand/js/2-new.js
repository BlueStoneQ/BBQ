/**
 * 2022-2-28
 * new 作用：根据constructor生产一个对象实例
 * 
 * 创建实例有2种方式：
 * 1- 用new Constructor() 创建
 * 2. 用Object.create(constructor.prototype) 创建
 *    -- 当然 也可以使用隐式原型创建 {}.__proto__ = constructor.prototype;
 * 
 * 实例 constructor protoType 
 * 这是整个js对象和继承 - 原型链的 3个主角
 * 
 * 至于: new 和 Object.create的区别：其实new的入参是 constructor, 而Object.create()的入参是 constructor.prototype
 */

function _new () {
  // init data
  const constructor = Array.prototype.shift.call(arguments);
  // defend
  if (typeof constructor !== 'function') {
    // 一般使用throw TypeError('xxx');
    throw TypeError('type error');
  }
  const newObj = Object.create(constructor.prototype); // 如果不使用create，可以使用不标准的__proto__实现继承
  // algo
  // 1. 执行constructor 将context作为this注入到constrctor中 这样 内部的一些属性就挂载到了newObj上了 
  const res = constructor.apply(newObj, arguments);

  // 2. 计算flag： constructor是否有返回值，且该返回值类型为对象或者函数
  const flag = res && (typeof res === 'object' || typeof res === 'function');
  
  // 3. constructor 有有效返回值 则直接使用该返回值 否则 使用我们构建的对象作为实例
  return flag ? res : newObj; 
}


/**
 *  这里是用隐式原型 __proto__ 代替 Object.create
 *  如果考虑到 Object.create中也使用了new 那么 我们可以使用这个工厂方法实现一个new 代替原来的new
 *  这也是原始时期 没有new的时候 人们可以用工厂模式来创建一个实例
 */
function _new2 () {
  // new一个新对象
  var obj = {}; // new Object
  // 拿到Constructor - （因为arguments不是数组，而是类数组，所以自身不能直接调用shift
  var Constructor = [].prototype.shift.call(arguments);
  // 实现新对象和构造函数之间的原型链继承，这里有个隐患：__proto__ 不是js标准，是大部分浏览器的默认实现，所以，这个写法其实很不可靠
  obj.__proto__ = Constructor.prototype;
  // 通过apply将Constructor中的this绑定为obj, 运行constructor(工厂生产), 拿到构造函数的返回值
  var res = Constructor.call(obj, arguments); 

  const flag = res && (typeof res === 'object' || typeof res === 'function');
  // 根据new的特性和构造函数返回值 确定最终new的返回值: ret为基本类型 就返回obj,忽略基本类型的返回值；ret为对象时，返回ret本身
  return flag ? res : obj; 
}