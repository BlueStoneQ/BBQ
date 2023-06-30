/**
 * 2023-3-24
 * 蚂蚁笔试：实现一个promise.cancel
 * 参考: [利用promise.race实现](https://cloud.tencent.com/developer/article/1785993)
 */

/**
 * 新解决方案：利用包装函数
 */
const wrapPromiseWithCancel = (promise) => {
  const rejectP = new Promise((resolve, reject) => {
    promise.reject = reject
  })

  return Promise.race([this, rejectP])
}

Promise.prototype.cancel = function () {
  // 原来的promise实例就是这里this
  this.reject('cancel')
}



/**
 * 旧解决方案
 */

const constructor = Promise.prototype.constructor;
Promise.prototype.constructor = function(...args) {
  constructor.apply(this, args)

  
}

Promise.prototype.cancel = function () {
  // 原来的promise实例就是这里this
  return Promise.race([this, Promise.reject()])
}

// test
var p  = new Promise((resolve)=>{
  setTimeout(()=>{
   resolve('123')
  }, 1000)
 })

p.cancel().then(res => {
  console.log('resolve1: ', res)
}).catch(err => {
  console.log('reject1: ', err)
})

p.then(res => {
  console.log('resolve2: ', res)
}).catch(err => {
  console.log('reject2: ', err)
})