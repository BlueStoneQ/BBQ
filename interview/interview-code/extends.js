/**
 * 类的继承
 * 1. 首先我们不管多少种继承方法，我们要理解继承的本质：
 * 2. 不是来学茴香豆的四种写法：避免走入这样的误区，学习不是用来炫耀，而是用的；
 * 这里实现2种写法：
 * 1. es5 继承的最佳实践；
 * 2. es6 继承的实现；
 * 类继承的本质：
 * 1. 子类的构造函数会调用父类的构造函数；
 * 2. 原型链继承：子类的prototype通过__proto__连接上父类的__proto__,利用原型链实现继承
 *  1）子类原型prototype连接的应该是父类原型的副本
 *  2）子类.prototype.__proto__ = 父类.prototype的副本
 */

 /**
  * es5 继承的实现
  */
  (function() {
    // 父类
    // 构造函数
    function Parent(name) {
      this.parent = name;
    }

    // 原型属性/方法
    Parent.prototype.say = function() {
      console.log(`${this.parent}是父类！`);
    }

    // 子类
    // 构造函数 - 内部调用父类构造函数
    function Child(name, parent) {
      // 以当前实例调用父类构造函数 - 其实这种内置写法，存在一种强耦合，这里能不能找找一些设计模式来解决这个问题
      Parent.call(this, parent);
      this.child = name;
    }
    // 子类原型继承父类原型链
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.say = function() {
      console.log(`${this.parent}是${this.child}的爸爸！`);
    };
    // 子类原型链prototype.constructor指回本身
    Child.constructor = Child;

    //  测试
    var p = new Parent('小头爸爸');
    p.say();
    var c = new Child('大头儿子', '小头爸爸');
    c.say();
  })()

  console.log('----------------------------');

  /**
   * es6 继承的实现
   */
