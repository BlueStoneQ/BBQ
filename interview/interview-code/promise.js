/**
 * wirte a Promise
 * 1. 完成链式调用
 * 2. 完成异步处理
 * 3. 完成值的多个then穿透
 * 这个可以作为一个面试版的 去掉resolvePromise的版本
 */

const STATUS = {
  PENDING: 'pending',
  FULLFILLED: 'fullfiled',
  REJECT: 'reject'
};

class MyPromise {
  constructor(excutor) {
    // init
    this.status = STATUS.PENDING;
    this.value=undefined;
    this.reson=undefined;

    // 观察者模式：存放excutor成功和失败后回调的队列
    this.resolveHandlers = [];
    this.rejectHandlers = [];

    // 内置方法
    const resolve = (value) => {
      // 1. 修改status
      this.status = STATUS.FULLFILLED;
      // 1. 修改value
      this.value = value;
      // 2. 作为观察者执行所有在then中注册的方法（其实就是原来的回调）
      this.resolveHandlers.forEach(handler => handler(this.value));
    }
    const reject = (reason) => {
      // 1. 修改status
      this.status = STATUS.REJECT;
      // 1. 修改value
      this.reason=reason;
      // 2. 作为观察者执行所有在then中注册的方法（其实就是原来的回调）
      this.rejectHandlers.forEach(handler => handler(this.reson));
    }
    // 执行excutor
    try {
      excutor(resolve, reject);
    } catch(err) {
      reject(err);
    }
  }
  then(resolveHandler, rejectHandler) {
      // status1: pending状态下进入各自的队列
      if (this.status === STATUS.PENDING) {
        this.resolveHandlers.push(resolveHandler);
        this.rejectHandlers.push(rejectHandler);
      }
      // status2: fullfiled状态下立刻执行
      if (this.status === STATUS.FULLFILLED) {
        resolveHandler(this.value);
      }
      // status3: reject状态下立刻执行
      if (this.status === STATUS.REJECT) {
        rejectHandler(this.reason);
      }
  }
}