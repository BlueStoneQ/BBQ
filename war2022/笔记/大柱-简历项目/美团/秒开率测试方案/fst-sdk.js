// 简易手写一个秒开测速sdk 可以放到工程里测一测
// 在小程序app初始化阶段app.js中调用
const register = function() {
  // 初始化元信息：bundleId + 配置数据：采样率samplingRate
  // hook Component
  const originalComponent = Comment;

  Comment = function(compObj) {
    // 1. 定义：hookSetData : 在Component中 hook setDat
    const hookSetData = function() {
      const originalSetData = this.setData;
      this.setData = function(data, callback) {
        originalSetData.call(this, data, (...args) => {
          const curPage = getCurrentPage() // 🟥具体api需要查微信小程序的文档可以确定
          curPage.fst.sampling()
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
    // 停止测速
    this.fst.stopRecord();
    // 获取结果 + 上报
    this.fst.getResult().then(res => this.fst.report(res))
    originalOnHide.call(this, ...args)
  }
}

// 采样触发时机一般在setData的callback中
class Fst {
  constructor(page) {
    this.page = page || this._getCurPage()
    // 核心数据
    this.startTime = 0
    this.endTime = 0
    // 将当前fst实例挂载在页面对象上
    this.page.fst = this
    this.recordList = [] // 采样点记录
    this.status = 'wait' // 有限状态机设计：wait sampling stop
    // 用来获取结构的promise 取得fst后就会resolve 失败或者异常会reject
    this.resultPromise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    });
  }

  startRecord() {
    this.startTime = Date.now()
    this.windowHeight = this._getWindowHeight() // 获取屏幕高度
    this.status = 'sampling'
  }

  stopRecord() {
    this.status = 'stop'
  }

  // addRecord 测速：targetView距离页面顶部的距离
  sampling() {
    // 状态机判断
    if (this.status !== "sampling") return;

    this._getTargetViewTop().then(targetTop => {
      this.recordList.push({
        targetTop,
        timeStamp: Date.now()
      })
      // 追溯启动条件：当前记录距离上次超过100ms 则表示该节点可能比较稳定了，这个时候，从record中倒序去找最近的一个稳定记录点(稳定记录点就是连续间隔小于20px的最早记录)
      let curRecord = this.recordList[i]
      let preRecord = this.recordList[i - 1] // 倒序到第二个元素, 因为每次要取2个元素做比较

      if (curRecord.timeStamp - preRecord.timeStamp < 100) return;

      // 倒序向上追溯：找寻最早的稳定振幅时机
      for (let i = this.recordList.length - 1; i > 1;i--) {
        curRecord = this.recordList[i]
        preRecord = this.recordList[i - 1] // 倒序到第二个元素, 因为每次要取2个元素做比较
        if (curRecord.targetTop - preRecord.targetTop >= 20) {
          // 遇到了大于20px的间隔（振幅），则停止寻找，证明还未达到稳定的判定的判定标准
          break
        } else {
          // 持续更新stop记录：间隔小于20px的 则持续向上找 找到最早的一个记录的时间戳 就是稳定的开始，选作endTime
          this.status = 'stop'
          this.endTime = preRecord.timeStamp
        }
      }

      this._tryComputeFst()
    })
  }

  // 靶点view是否触底
  _isReachedBottom() {
    return new Promise((resolve, reject) => {
      this._getTargetViewTop().then(viewTop => {
        resolve(viewTop === this._getWindowHeight())
      })
    })
  }

  _getWindowHeight() {
    return this.windowHeight || wx.getSystemInfoSync().windowHeight
  }

  // 获取靶点元素的top
  _getTargetViewTop() {
    return new Promise((resolve, reject) => {
      // https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.boundingClientRect.html
      const query = wx.createSelectorQuery()
      query.select("target-view").boundingClientRect() // res[0]
      query.selectViewport().scrollOffset()
      query.exec(res => { // 一个经典的命令模式
          // 靶点view到屏幕顶部的距离 + 页面发生滚动的距离
          resolve(res[0].top + res[1].scrollTop)
      })
    }) 
  }

  // 获取当前页面对象
  _getCurPage() {
    if (this.page) return this.page

    const pages = getCurrentPages()
    return pages[pages.length - 1]
  }

  // 主要是让resultPromise状态resolve
  _tryComputeFst() {
    if (this.status === 'stop') {
      this.resolve(this.endTime - this.startTime)
    }
  }

  // 用户可以通过fst.getResult().then(fstData => report(fstData))
  getResult() {
    return this.resultPromise
  }
  // static 方法: getInstance

  report() {
    (new Image()).src=`xxx/xxx.img?fst=${this.endTime - this.startTime}`
  }
}

// 采样率阀门算法,采样率算法一般用在整个测速startRecord之前，会判定是否进行测速，如果没有命中测速，则就不会启动后续流程
const isSampling = (samplingRate = 1) => {
  return Math.random() < samplingRate
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

