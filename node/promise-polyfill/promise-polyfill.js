const STATUS = {
  PENDING: 'pending',
  FULFILLED: 'fullfilled',
  REJECT: 'reject'
};

class myPromise {
  constructor(fn) {
    this.status = STATUS.PENDING;
    this.value = null;
    this.reason = null;

    this.resolve = (value) => {
      if (this.status === STATUS.PENDING) {
        this.status = STATUS.FULFILLED;
        this.value = value;
      }
    }

    this.reject = (reason) => {
      if (this.status === STATUS.REJECT) {
        this.status = STATUS.REJECT;
        this.reason = reason;
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

    if (this.status === STATUS.FULFILLED) {
      onFulfilled(this.value);
    }

    if (this.status === STATUS.REJECT) {
      onrejected(this.reason);
    }
  }
}