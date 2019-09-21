/**
 * event bus
 * 1. 发布/订阅模式
 * 2. 前端/node 核心机制
 */

 /* 分界线 */
getSpliteLine(40, '*', 'event bus 简易版开始');


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

 // 两个相邻的匿名函数不能连续调用
 // 分界线
getSpliteLine(40, '*', 'event bus 正式版开始');

  /**
   * 正式版
   * 1- _events 中为一个一个键值对：type： handler / [...handlers]
   */
  (function(){
  // nodejs环境不支持class哈哈
    // class EventEmitter {
    //   // 构造函数
    //   constructor () {
    //     _events: this._events || new Map();
    //     _maxListeners: this._maxListeners || 10;
    //   }
    // }
    const EventEmitter = function() {
      // 构造event属性
      this._events = this._events || new Map();
      this._maxListeners = this._maxListeners || 10;
     }
    // 公用方法
    /**
     * 注册事件/添加监听事件
     * 1. 当然一次注册一个handler
     */
    EventEmitter.prototype.addListener = function(type, fn) {
      const handler = this._events.get(type); // 获取type对应的函数清单
      if (!handler) {
        // 该事件type未被注册
        this._events.set(type, fn);
      } else {
        // 该事件type已被注册
        if (handler && typeof handler === 'function') {
          // 当该事件type对应的handler为一个函数时
          this._events.set(type, [handler, fn]);
        } else {
          // 当该事件type对应的handler超过一个时 
          handler.push(fn);
        }
      }
    }
    // 触发事件
    EventEmitter.prototype.emit = function(type, ...args) {
      const handler = this._events.get(type);
      try {
        if (!handler) {
          throw new Error('该事件未注册，请先注册再触发');
        } else {
          // 将根据args的数量来决定是使用apply还是call的逻辑封装起来
          const execute = function (handler, argsLen) {
            if (argsLen && argsLen > 0) {
              handler.apply(this, args);
            } else {
              handler.call(this);
            }
          }
          // 如果handler是数组 则循环触发
          if (Array.isArray(handler)) {
            const argsLen = args.length;
            for (let i = 0, len = handler.length; i < len; i++) {
              // if (args.length > 0) {
              //   handler[0].apply(this, args);
              // } else {
              //   handler[0].call(this);
              // }
              execute(handler[0], argsLen);
            }
          } else {
            // 如果handler是单个函数 则直接触发
            // if (args.length > 0) {
            //   handler.apply(this, args);
            // } else {
            //   handler.call(this);
            // }
            execute(handler);
          }
        }
      } catch(err) {
        console.log('【event bus: emit】', err);
      }
    }
    // 移除某事件handler， 如果一个key最后一个事件被移除 那么 该事件type本身也就被移出了_events中
    EventEmitter.prototype.removeListener = function(type, fn) {
      const handler = this._events.get(type);
      try {
        if (!handler) {
          throw new Error('您要移除的事件未注册！');
        } else {
          if (handler && typeof handler === 'function') {
            // 如果handler是一个函数的话 - 直接连同type一起移除
            this._events.delete(type);
          } else {
            let delIndex = -1; //记录要删除的函数所在队列中的下标
            // 如果handler为一个数组的话 我们只删除该数组中的fn函数即可 - 这里我们通过循环拿到要删除的fn所在下标
            for (let i = 0, len = handler.length; i < len; i++) {
              if (handler[i] === fn) {
                delIndex = i;
              }
            }
            // 删除fn 并且对handler === [fn1]的情况进行处理
            if (delIndex !== -1) {
              // 找到了要删除fn所在的index
              handler.splice(delIndex, 1);
              // 如果此时handler中只剩一个函数 则将handler直接变成该函数 而不是数组
              if (handler.length === 1) {
                this._events.set(type, handler[0]);
              }
            } else {
              return this;
            }
          }
        }
        
      } catch(err) {
        console.log('【event bus: remove】', err);
      }
    }

    // 测试
    const eventObj = new EventEmitter();
    eventObj.addListener('e1', (e) => {
      console.log('触发了e1: ', e);
    });
    const handler1 = (e) => {
      console.log('触发了e1 handle1: ', e);
    }
    eventObj.addListener('e1', handler1);
    eventObj.emit('e1', '正式版');
    eventObj.emit('e2');
    eventObj.removeListener('e1', handler1);
  })()



    /**
     * 工具函数
     */
  /**
  * 打印分界线
  * @param {string} len 打印的长度
  * @param {string} symble 用于分界的单个符号
  * @param {tring} message 说明信息
  */
  function getSpliteLine(len = 40, symble = '*', message = '') {
    let splitLine = '';
    for (let i = 0; i < len; i++) {
      if (i === Math.floor(len/2)) {
      splitLine += (symble + '【 ' + message + ' 】'); 
      }
      splitLine += symble;
    }
    console.log(splitLine);
  }