/**
 * event bus
 * 1. 发布/订阅模式
 * 2. 前端/node 核心机制
 */

 /**
  * 简易版
  * 1- 一个event对应一个handler, 在Map中：event： handler (正式版的handler应该是一个队列)
  * 2- 这里我们选用的是Map作为基础数据结构，再根据功能需要定制
  */
 (function() {
   // 实现
   // EventEmitter对象的构造函数
   const EventEmitter = function() {
    // 构造event属性
    this._events = this._events || new Map();
    this._maxListeners = this._maxListeners || 10;
   }
   // EventEmitter方法
   // 触发
   EventEmitter.prototype.emit = function(event, ...args) {
     // 这里不用...args我们也可以使用：let args = arguments.slice(1);
     const handler = this._events.get(event);
     // 在参数少时 call的性能优于applay
     if (args.length > 0) {
      handler.apply(this, args);
     } else {
       handler.call(this);
     }
   }
   // 订阅/监听某event的方法 - 落地：实际上就是把相应的事件添加到事件里，或者把对应事件的handler添加到对应event的handlers队列中
   EventEmitter.prototype.addListener = function(type, handler) {
     if (!this._events.get(type)) {
      // 这里的机制是一种事件的handler一旦注册 就不能更改了
      this._events.set(type, handler);
     }
   }
   // 测试
   const eventObj = new EventEmitter();
   eventObj.addListener('type', (e) => {
    console.log('type e: ', e);
   });
   eventObj.emit('type', '开始');
 })()

  /**
   * 正式版
   */