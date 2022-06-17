const STATUS = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECT: 'reject'
};

class MyPromise {
  constructor(fn) {
    this.status = STATUS.PENDING;
    this.value = null;
    this.reason = null;
    this.onFullfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    this.resolve = (value) => {
      if (this.status === STATUS.PENDING) {
        this.status = STATUS.FULFILLED;
        this.value = value;
        // 执行队列中的方法
        this.onFullfilledCallbacks.forEach(callback => {
          callback(this.value);
        });
      }
    }

    this.reject = (reason) => {
      if (this.status === STATUS.PENDING) {
        this.status = STATUS.REJECT;
        this.reason = reason;
        // 执行队列中的方法
        this.onRejectedCallbacks.forEach(callback => {
          callback(this.reason);
        });
      }
    }

    // 执行fn
    try {
      fn(this.resolve, this.reject);
    } catch(error) {
      this.reject(error);
    }

    this.then = this.then.bind(this);
  }

  then(onFulfilled, onrejected) {
    // 入参防御：必须为fn
    // 为防止入参不是fn，我们不直接使用入参，而是使用一个处理后的变量代替，使用realOnFulfilled作为后续的处理参数
    if (typeof onFulfilled !== 'function') {
      onFulfilled = value => value;
    }

    if (typeof onrejected !== 'function') {
      onrejected = reason => {
        throw reason;
      };
    }

    // 未到执行时机 先压入队列
    if (this.status === STATUS.PENDING) {
      // this.onFullfilledCallbacks.push(onFulfilled);
      // this.onRejectedCallbacks.push(onrejected);
      let promise2 = new MyPromise((resolve, reject) => {
        this.onFullfilledCallbacks.push(() => {
          // 这里其实是用setTimeout将then中的函数 执行放到了下一次eventLoop之中，用宏任务代替promise的微任务
          setTimeout(() => {
            try {
              const x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch(error) {
              reject(error);
            }
          }, 0);
        });
        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onrejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch(error) {
              reject(error);
            }
          }, 0);
        });
      });
      return promise2;
    }

    if (this.status === STATUS.FULFILLED) {
      // onFulfilled(this.value);
      let promise2 = new MyPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            const x = onFulfilled(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch(error) {
            reject(error);
          }
        }, 0);
      });
      return promise2;
    }

    if (this.status === STATUS.REJECT) {
      // onrejected(this.reason);
      let promise2 = new MyPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            const x = onrejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch(error) {
            reject(error);
          }
        }, 0);
      });
      return promise2;
    }
  }
}


function resolvePromise(promise, x, resolve, reject) {
  // x 是 this的情况
  if (promise === x) {
    return reject(new TypeError('chaing circle'));
  }

  // 避免重复调用的标记
  let called = false;

  if ((x !== null && typeof x === 'object') || typeof x === 'function') {
    try {
      const then = x.then;
      // thenable型的话
      if (typeof then === 'function') {
        // x.then为函数 则使用x作为this进行调用
        const resolve2 = y => {
          // 防止重复调用
          if (called) return;
          called = true;
          // 若是是嵌套的promise那么须要递归遍历到普通值为止
          resolvePromise(promise, y, resolve, reject);
        }
        const reject2 = r => {
          // 防止重复调用
          if (called) return;
          called = true;
          reject(r);
        }
        then.call(x, resolve2, reject2);
      } else {
        resolve(x);
      }
    } catch(error) {
      if (called) return;
      called = true;
      // 在取x.then时报错 则以该报错进行reject
      return reject(error);
    }
  } else {
    //如果x为普通值，则作为参数传给下一个promise（在promise2的then中使用）
    resolve(x);
  }
}

MyPromise.resolve = (param) => {
  // promise类型/thenable类型 则直接返回对象本身
  if (param instanceof MyPromise) {
    return param;
  }
  // 非promis类型 则包装为一个promise 且状态触发未fulfilled
  return new MyPromise((resolve) => {
    resolve(param);
  });
}

MyPromise.reject = (reason) => {
  return new MyPromise((resolve, reject) => {
    reject(reason);
  });
}

// 增添其他方法
MyPromise.all = (promiseList) => {
  return new MyPromise((resolve, reject) => {
    // 通过resolve给then提供入参
    const result = [];
    const promiseLen = promiseList.length;
    let count = 0; // 执行成功的promise数量

    if (!promiseLen) {
      return resolve(result);
    }

    // all的实现 底层是一个并发操作
    promiseList.forEach((promise, index) => {
      // 确保处理的类型统一
      MyPromise.resolve(promise).then(value => {
        count++;
        result[index] = value;
        if (count === promiseLen) {
          return resolve(result);
        }
      }, reason => {
        // 在promise中 程序的终结 是resolve reject的调用
        return reject(reason);
      });
    });
  });
}

// 第一个出来的结果 不论fulfilled 还是 reject，就是返回的值
MyPromise.race = (promiseList) => {
  return new MyPromise((resolve, reject) => {
    const promiseLen = promise.length;

    if (!promiseLen) {
      return resolve();
    }

    promiseList.forEach(promise => {
      MyPromise.resolve(promise).then(value => {
        return resolve(value);
      }, reason => {
        return reject(reason);
      });
    });
  });
}

// catch只是then的一种别名
MyPromise.catch = (onrejected) => {
  return this.then(null, onrejected);
}

// 调用一遍，this.then保持value reason的透传 callback被执行一遍 继续返回promise 以保持链式调用，并保持callBack前后的参数不变
MyPromise.finally = (callback) => {
  // 再调用了一遍then
  return this.then(
    value => MyPromise.resolve(callback()).then(() => value),
    reason => MyPromise.resolve(callback()).then(() => { throw reason })
  );
}

//只有当所有的promise实例都返回结果（不管是resolve还是reject）才会结束
//只会被resolve，不会被reject
MyPromise.allSettled = (promiseList) => {
  return new MyPromise((resolve, reject) => {
    let count = 0;
    const result = [];
    const promiseLen = promiseList.length;

    if (!promiseLen) {
      return resolve(result);
    }

    promiseList.forEach((promise, index) => {
      return MyPromise.resolve(promise).then(value => {
        count++;
        result[index] = {
          status: STATUS.FULFILLED,
          value
        };
        if (count === promiseLen) {
          return resolve(result);
        }
      }, reason => {
        count++;
        result[index] = {
          status: STATUS.REJECT,
          reason
        };
        if (count === promiseLen) {
          return resolve(result);
        }
      });
    });
  });
}

// 只要参数实例有一个变成fulfilled状态，包装实例就会变成fulfilled状态；如果所有参数实例都变成rejected状态，包装实例就会变成rejected状态。 是一个关于fulfilled和reject不对等的逻辑
MyPromise.any = (promiseList) => {
  return new MyPromise((resolve, reject) => {
    let count = 0;
    const promiseLen = promiseList.length;
    const result = [];
  
    if (!promiseLen) {
      return resolve(result);
    }
    promiseList.forEach((promise, index) => {
      MyPromise.resolve(promise).then(value => {
        return resolve(value);
      }, reason => {
        count++;
        result[index] = reason;
        if (promiseLen === count) {
          return reject();
        }
      });
    });
  });
}

// 测试需要
MyPromise.deferred = () => {
  let result = {};
  result.promise = new MyPromise((resolve, reject) => {
      result.resolve = resolve;
      result.reject = reject;
  });

  return result;
}

module.exports = MyPromise;