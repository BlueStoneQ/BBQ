/**
 * 模拟实现new的功能
 * 1. 用一个工厂代替new，利用父类生成实例
 * 2. new的过程：
 *  1） 创建一个对象obj
 *  2） 将obj.__proto__ 赋值为 Constructor.prototype, 实现继承
 *  3） 将构造函数中的this赋值为obj
 *  4） 返回obj（对象）
 * 3. 观察new的行为特性：
 *  1）当构造函数返回一个基本类型时，对new出来的实例基本无影响；
 *  2）如果构造函数返回一个对象，则new出来的就是return的那个对象;
 *  3）原则总结：也就是new始终返回一个对象，不返回值基本类型；
 */
function objectFactory() {
  // new一个新对象
  var obj = new Object();
  // 拿到Constructor - （因为arguments不是数组，而是类数组，所以自身不能直接调用shift
  var Constructor = [].prototype.shift.call(arguments);
  // 实现新对象和构造函数之间的原型链继承
  obj.__proto__ = Constructor.prototype;
  // 通过apply将Constructor中的this绑定为obj, 运行constructor(工厂生产), 拿到构造函数的返回值
  var ret = Constructor.call(obj, arguments); 
  // 根据new的特性和构造函数返回值 确定最终new的返回值: ret为基本类型 就返回obj,忽略基本类型的返回值；ret为对象时，返回ret本身
  return typeof ret === 'object' ? ret : obj;
}

