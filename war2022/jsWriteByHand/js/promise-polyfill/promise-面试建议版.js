/**
 * 2022-6-15
 * 面试建议版 
 * 主要是写出promise的主体框架，去掉了技术性不算强的resolvePromise
 * 在面试中 写到这个程度就可以了，如果要求写resolvePromise 就不要勉强了 可能大家的技术观不一致
 * 这一部分 基本也是promise的技术密集的部分， resolvePromnise 中 其实就是大量对promiseA+规范中的case进行处理
 * 喜欢考记忆力的面试官 就不要勉强自己去适应了
 * 之前应该写过这样一版-见当前项目：interview/interview-code/promise.js
 */

const STATUS = {
  PENDING: 'pending',
  FULFILLED: 'fullfilled',
  REJECT: 'reject'
};

class MyPromise {
  constructor (fn) {
    this.status = STATUS.PENDING;
    this.value = null;
    this.reason = null;
    this.onFullfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    this.resolve = (val) => {
      this.status = STATUS.FULFILLED;
      this.value = val;
      // 执行队列中的方法
      this.onFullfilledCallbacks.forEach(callback => {
        callback(this.value);
      });
    }

    this.reject = (reason) => {
      this.status = STATUS.REJECT;
      this.reason = reason;
      // 执行队列中的方法
      this.onRejectedCallbacks.forEach(callback => {
        callback(this.reason);
      });
    }
    
    try {
      fn(this.resolve, this.reject);
    } catch (error) {
      this.reject(error);
    }
  }

  /**
   * 始终保证返回值是一个新的promise
   * @param {*} onFullfilledFn 
   * @param {*} onRejectedFn 
   */
  then (onFullfilledFn, onRejectedFn) {
    // defend 2个入参必须是函数

    // 对3种status分别处理
    if (this.status === STATUS.PENDING) {
      let promise2 = new MyPromise ((resolve, reject) => {
        this.onFullfilledCallbacks.push(() => {
          setTimeout(() => {
            try {
              const res = onFullfilledFn(this.value);
              // 正确写法：resolvePromise(promise2, res, resolve, reject); // 调用了res的各种情况下，resolve的调用方案
              resolvePromise(promise2, res, resolve, reject);
            } catch (error) {
              reject(error);
            }
          }, 0);
        });

        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              const res = onRejectedFn(this.reason);
              // 正确写法：resolvePromise(promise2, res, resolve, reject); // 调用了res的各种情况下，resolve的调用方案
              resolvePromise(promise2, res, resolve, reject); 
            } catch (error) {
              reject(error);
            }
          }, 0);
        });
      });

      return promise2;
    }

    if (this.status === STATUS.FULFILLED) {
      let promise2 = new MyPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            const res = onFullfilledFn(this.value);
            // 正确写法：resolvePromise(promise2, res, resolve, reject); // 调用了res的各种情况下，resolve的调用方案
            resolvePromise(promise2, res, resolve, reject); 
          } catch (error) {
            reject(error);
          }
        }, 0);
      });

      return promise2;
    }

    if (this.status === STATUS.REJECT) {
      let promise2 = new MyPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            const res = onRejectedFn(this.reason);
            resolvePromise(promise2, res, resolve, reject); 
          } catch (error) {
            reject(error);
          }
        });
      });

      return promise2;
    }
  }
}