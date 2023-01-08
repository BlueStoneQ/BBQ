Promise.prototype._all = (promises) => {
  // defend
  const promiseCount = promises.length;
  const result = [];
  let fullfilledCount = 0;
  return new Promise((resolve, reject) => {
    promises.map((promise, index) => {
      promise.then(res => {
        result[index] = res;
        fullfilledCount++;
        if (promiseCount === fullfilledCount) {
          resolve(result);
        }
      }).catch(err => {
        reject(err);
      });
    });
  });
}