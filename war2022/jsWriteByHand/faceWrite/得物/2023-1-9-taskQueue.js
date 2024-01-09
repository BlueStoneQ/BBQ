// date: 2023-1-9 得物 国际化 1面
// 实现一个 arrange 函数,可以进行时间和工作调度
// [ > ... ] 表示调用函数后的打印内容

// arrange('William').execute();
// > William is notified

// arrange('William').do('commit').execute();
// > William is notified
// > Start to commit

// arrange('William').wait(5).do('commit').execute();
// > William is notified
// 等待 5 秒
// > Start to commit

// arrange('William').waitFirst(5).do('push').execute();
// 等待 5 秒
// > William is notified
// > Start to push

// const command = {
//   COMMIT: 'commit',
//   PUSH: 'push',
// }

function defalutDo() {
  return new Promise((resolve) => {
    console.log('William is notified')
    resolve()
  })
}

function arrange(name) {
  return new Arrange(name)
}

function Arrange(name){
  this.name = name || '',
  this.taskQueue = [defalutDo]
}

Arrange.prototype._addTask = function(task) {
  this.taskQueue.push(task)
}

Arrange.prototype._addFirstTask = function(task) {
  this.taskQueue.unshift(task)
}

Arrange.prototype.do = function(command) {
  this._addTask(() => new Promise(resolve => {
    console.log('Start to ', command)
  }))

  return this
}

Arrange.prototype.wait = function(delay = 0) {
  this._addTask(() => new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, delay * 1000)
  }))

  return this
}

Arrange.prototype.waitFirst = function(delay = 0) {
  this._addFirstTask(() => new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, delay)
  }))

  return this
}

Arrange.prototype.execute = function() {
  const _run = () => {
    // defend 判空之类
    if(this.taskQueue.length === 0) return
    
    const task = this.taskQueue.shift()

    task().then(res => {
      _run()
    }).catch(err => {
      _run()
    })
  }

  _run()

  return this
}



arrange('William').execute();
// 期望输出
// > William is notified

arrange('William').do('commit').execute();
// 期望输出
// > William is notified
// > Start to commit

arrange('William').wait(5).do('commit').execute();
// 期望输出
// > William is notified
// 等待 5 秒
// > Start to commit

arrange('William').waitFirst(5).do('push').execute();
// 期望输出
// 等待 5 秒
// > William is notified
// > Start to push