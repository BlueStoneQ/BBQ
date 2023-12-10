// 简易手写一个秒开测速sdk 可以放到工程里测一测
// 在小程序app初始化阶段app.js中调用
const register = function() {
  // hook Component
  const originalComponent = Comment;

  Comment = function(compObj) {
    // 1. 定义：hookSetData : 在Component中 hook setDat
    const hookSetData = function() {
      const originalSetData = this.setData;
      this.setData = function(data, callback) {
        originalSetData.call(this, data, (...args) => {
          const curPage = getCurrentPage() // 🟥具体api需要查微信小程序的文档可以确定
          fst.sampling(curPage)
          callback && callback(...args)
        })
      }
    }
    // 2. 在Compoent.attached中调用hookSetData
    const originalAttached = compObj.attached
    compObj.attached = function(...args) {
      hookSetData.call(this)
      originalAttached && originalAttached.call(this, ...args)
    }
    // 3. 返回oldComponent(compObj) 最终小程序运行时框架需要的是Component的执行结果
    return originalComponent(compObj)
  }
}

// 页面的wrap 可以类比为HOC
const pageBase = function(pageObj) {
  // 1. 重写生命周期 onLoad: 用AOP注入启动测速相关逻辑
  const originalOnload = pageObj.onload
  pageObj.onload = function() {
    // 初始化fst
    this.fst = new Fst(this);
    // fst开始记录
    this.fst.startRecord();
    // 重写setData
    const originalSetData = this.setData
    this.setData = function(data, callback) {
      originalSetData.call(this, data, (...args) => {
        this.fst.sampling(this)
        callback && callback.call(this, ...args)
      })
    }
  }
  // 2. 重写生命周期 onHide/onUnload: 用AOP注入上报相关逻辑
  const originalOnHide = pageObj.onHide
  pageObj.onHide = function(...args) { // 这里的hook其实因为要复用，可以抽象出一个hook方法，来对生命周期+要注入的逻辑进行hook
    originalOnHide.call(this, ...args)
  }
}


function pageHook() {}

// 采样触发时机一般在setData的callback中
class Fst {
  constructor(page) {
    this.page = page
    this.recordList = [] // 采样点记录
    this.status = 'wait' // 有限状态机设计：wait sampling stop
    // 用来获取结构的promise 取得fst后就会resolve 失败或者异常会reject
    this.resultPromise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    });
  }

  startRecord() {
    this.status = 'sampling'
  }

  sample() {
    // sampling
    // isReachedBottom
    // tryComputedFst
  }

  getResult() {}
  // static 方法: getInstance
}

// 使用方法
// 1. 小程序app启动时，进行register，内部是用AOP对全局的Component进行重写，注入测速逻辑
register()
// 2. 每个页面的page都必须用Base进行包裹，而Base中对传入的pageObj可以采用各种Wrap，这里面就包括fst.pageBase
export Base(pageObj) // 页面中
// 3. 采用BaseWrap的形式，对pageOpt进行: hookSetData + 生命周期拦截
Base = function(pageObj) { // Base的定义，可以类比为Andorid中对Activity进行继承后，提供一个自定义后的MyActivity来继承，在MyAcitivy中就可以做各种各样的事情
  return fst.pageBase(pageObj)
}

