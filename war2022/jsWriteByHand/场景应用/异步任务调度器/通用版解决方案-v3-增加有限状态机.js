/**
 * 异步任务调度器-通用版解决方案
 * 2023-12-19
 * 
 * 1. 考虑异步的结果怎么获取 提供获取接口 + 并且要考虑结果和输入的taskList的顺序保持相同的有序性
 * changeLog:
 * 1. 提供获取结果的方法
 * 2. 因为时间关系，暂时拆除掉循环执行的功能，最终正式版可以提供
 * 3. 增加有限状态机，管理整个调度器的状态
 */

// 参考
const status = {
  notStart: 'notStart',
  running: 'running',
  stop: 'stop'
}

class PipeLine {
  /**
   * @param {number} maxRunningCount 最多可以并发执行的任务数量
   */
  constructor (maxRunningCount = 1) {
    this.maxRunningCount = maxRunningCount;
    this.taskQueue = []; // 任务队列
    this.taskAllCount = 0; // 任务总个数
    this.endTaskCount = 0; // 任务完成个数
    this.isStop = false; // 是否停止任务执行，通过this.stop()暴露在外面来控制是否继续执行task
    this.results = [];
    this.promise = new Promise((resolve, reject) => {
      // 等到任务队列获取到后 可以直接调用挂载在this上的resolve函数 然后使用await getResult()拿到任务队列执行的结果
      this.resolve = resolve
      this.reject = reject
    })
    this.status = status.notStart;
  }

  /**
   * 任务注册器
   * @param {function} task 是一个函数 返回值必须是一个promise
   */
  register (task) {
    // 只有在notStart状态下 可以添加task, 因为执行开始后，task的数量就需要确定下来，以确定任务完成的时机（taskQueue中的任务被执行完）
    if (this.status !== status.notStart) return;

    this.taskCount++
    this.taskQueue.push({
      task,
      index: this.taskQueue.length - 1 // 任务所在队列的下标，用来和results对应
    });
  }

  /**
   * 执行单个任务
   */
  _runTask () {
    // 判断是否要继续执行下去
    if (!this._isShouldRun()) {
      return
    }
    // 取出队列顶部的任务
    const { task, index } = this.taskQueue.shift();

    task().then(res => {
      this.results[index] = {
        status: 'fullfilled',
        value: res
      }

      this.endTaskCount++

      if (this._isFinishAllTask()) {
        this.status = status.stop;
        this.resolve(this.results) // 改变结果this.promise的状态，将结果传递给this.promise
        return
      }

      this._runTask(); // [⭕️]继续执行下一个任务, 甚至这里还可以传递上一个任务得到的结果，形成一个中间件的执行效果
    }).catch(err => {
      this.results[index] = {
        status: 'rejected',
        error: err
      }

      this.endTaskCount++
      if (this._isFinishAllTask()) {
        this.status = status.stop;
        this.resolve(this.results) // 改变结果promise的状态
        return
      }

      this._runTask(); // [⭕️]继续执行下一个任务,catch中可以继续执行 也可以停止执行
    }); 
  }

  // 启动器
  run () {
    // 更改状态机状态
    this.status = status.running;
    // 判断是否要继续执行下去
    if (!this._isShouldRun()) return;
    // 按照最大并发量取出要执行的任务
    while (this.maxRunningCount > 0) {
      this._runTask();
      this.maxRunningCount--;
    }
  }
  // 停止执行
  stop () {
    this.isStop = true;
  }

  _isShouldRun () {
    // 判断是否要继续执行下去: 1. 任务队列为空 || 2. 信号量isStop = true 则停止执行
    return !(this.taskQueue.length === 0 || this.stop === true);
  }

  _isFinishAllTask () {
    return this.taskCount === this.endTaskCount
  }

  // await instance.getResults() 能够拿到我们的任务队列每个任务的结果this.results
  getResults() {
    return this.promise
  }
}

module.exports = PipeLine;