const STATUS = {
  pending: 'pending',
  fullfilled: 'fullfilled',
  reject: 'reject'
}

class MyPromise {
  constructor (fn) {
    this.status = STATUS.pending;
    this.fullfilledTaskStack = [];
    this.rejectTaskStack = [];

    this.resolve = (res) => {
      this.status = STATUS.fullfilled;
      for (const task of this.fullfilledTaskStack) {
        task(res);
      }
    }

    this.reject = (err) => {
      this.status = STATUS.reject;
      for (const task of this.rejectTaskStack) {
        task(err);
      }
    }

    fn && fn(this.resolve, this.reject);
  }

  then (resolveFn, rejectFn) {
    if (this.status === STATUS.pending) {
      resolveFn && this.fullfilledTaskStack.push(resolveFn);
      rejectFn && this.rejectTaskStack.push(rejectFn);
    }

    if (this.status === STATUS.fullfilled) {
      return new MyPromise((resolve, reject) => {
        resolveFn && resolveFn();
      });
    }
  }
}