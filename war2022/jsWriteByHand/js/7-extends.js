/**
 * 继承
 * 2022-5-6
 * 继承的目的：代码复用，复用属性和方法
 * 属性继承：一般通过在自身构造函数中调用父类的构造函数实现
 * 方法继承：一般通过原型链进行继承，例如new实例 或者 生成一个父类的原型副本，和子类的构建函数互相指定：constructor 和 prototype
 * ES5:
 *  - 组合继承
 *  - 寄生组合式继承
 * ES6:
 *  - extends
 * 
 * 参考：
 * 《js高级程序设计》第四版
 * 《ES6标准入门》
 */

/**
 * ES5：组合继承
 * - 使用最多的继承，但是父类构造函数会调用2次 有一定损耗
 * 1. 继承属性：在子类构造函数中通过apply调用父类构造函数，将父的属性挂载到实例this上
 * 2. 继承方法：
 *   - 方法一般都是在原型上，则通过建立原型链来可以调用到父类的方法：
 *   - SubClass.prototype.__proto__ = SuperClass.protoType 
 *            => subClass.protoType = new SuperClass();
 */
(function() {
  function SuperType(name){
    this.name = name;
    this.colors = ["red", "blue", "green"];
  }

  SuperType.prototype.sayName = function() {
    console.log(this.name);
  };    


  // 继承属性
  function SubType(name, age) {
    // 调用父类构造函数 注入当前this 将父类的属性挂载到当前的this上
    SuperType.call(this, name); // 父类构造函数第二次调用

    this.age = age;
  }

  // 继承方法
  SubType.prototype = new SuperType(); // 父类构造函数第一次调用
})()

/**
 * ES5：寄生组合式继承
 * - 引用类型的最佳继承方式，避免了对父构造函数的2次调用
 * 1. 继承属性：在子类构造函数中通过apply调用父类构造函数，将父的属性挂载到实例this上
 * 2. 继承方法：
 *   - 方法一般都是在原型上，则通过建立原型链来可以调用到父类的方法：
 *   - SubClass.prototype.__proto__ = SuperClass.protoType 
 *            => subClass.protoType = new SuperClass();
 * 这里采用的方式 不是通过new来建立隐式原型链接，而是通过一个继承方法
 * 但是最终是要建立子类构造函数的原型到父类原型的原型链
 */
 (function() {
  function SuperType(name){
    this.name = name;
    this.colors = ["red", "blue", "green"];
  }

  SuperType.prototype.sayName = function() {
    console.log(this.name);
  };    


  // 继承属性
  function SubType(name, age) {
    // 调用父类构造函数 注入当前this 将父类的属性挂载到当前的this上
    SuperType.call(this, name); // 父类构造函数第二次调用

    this.age = age;
  }

  // 继承方法 - 这里是和组合继承不同的地方,这里有个工具方法
  const inheritPrototype = (subConstructor, superConstructor) => {
    // object将给定的值包装为一个新对象-如果给定值是一个已经存在的对象，则会返回这个已经存在的值（相同地址）
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/Object
    //js高程上 这里写的这个 const proto = object(superConstructor.prototype);
    // 应该用Object.create创建父类原型的一个副本
    const proto = Object.create(superConstructor.prototype);
    // 这个原型和当前子类构造函数互相连接
    subConstructor.prototype = proto;
    proto.constructor = subConstructor;
  }

  // 继承
  inheritPrototype(SubType, SuperType);
})()


/**
 * ES6
 * 1. 注意 子类一定在constructor中执行super(); 这样在extends下子类才会获得this(父类提供的)
 */
(() => {
  class subClass extends superClass {
    constructor(...args) {
      super(...args);

      super.superMethod(); // super还可以调用父类的静态方法
    }
  }
})()