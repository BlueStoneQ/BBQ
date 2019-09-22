/**
 * 实现bind函数
 * 1. bind函数行为特点：
 *  1）返回一个函数
 *    1> 为返回的该函数绑定this
 *    2> 为返回的该函数传递预置参数
 *  2）返回函数被当作构造函数
 *    1> 也就是说在被new时，传入的this失效（替换为new出来的实例）
 *    2> 传入的预置参数依然有效
 * 2. 核心实现：依赖于apply和高阶函数
 */

Function.prototype.myBind = function (context) {
  var bindArgs = Array.prototype.slice.call(arguments, 1);
  // this代表当前函数
  var self = this;
  var fNOP = function() {};
  var fBond = function() {
    var args = Array.prototype.concat.call(bindArgs, arguments);
    // 借助apply实现context的绑定
    // 这里使用self不用this: 是因为这里的this不是上面的this了哈哈，一个函数中有一个this
    return self.apply(this instanceof fBond ? this : context, args);
  }

  // 让bind函数返回的函数fBond继承原来函数的原型链
  // 避免引用污染: 用一个新的引用fNOP.prototype来复制一份this.portotype
  fNOP.prototype = this.prototype;
  fBond.prototype = new fNOP();

  return fBond; 
}

/**
 * 测试
 */
const obj1 = {
  v: 123
}
function bar () {
  const args = Array.prototype.slice.call(arguments);
  this.bug = 'bug12';
  for (let i = 0; i < args.length; i++) {
      console.log(args[i]);
  }
}

bar.prototype.friend = 'Keiven';

bar.myBind(obj1, 4, 5, 'stage1')();
console.log('______________________________');
var Bar = bar.myBind(obj1, 4, 5, 'stage1');

var barObj = new Bar();

console.log('friend: ', barObj.friend);
console.log('bug: ', barObj.bug);
