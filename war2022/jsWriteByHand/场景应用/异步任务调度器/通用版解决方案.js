/**
 * 异步任务调度器-通用版解决方案
 * 2022-10-5
 * TODO: 考虑异步的结果怎么获取 提供获取接口 + 并且要考虑结果和输入的taskList的顺序保持相同的有序性
 */


class PipeLine {
  /**
   * @param {Boolean} isCircle  任务队列是否循环执行, 默认不循环执行
   * @param {number} maxRunningCount 最多可以并发执行的任务数量
   */
  constructor (isCircle = false, maxRunningCount = 1) {
    this.isCircle = isCircle;
    this.maxRunningCount = maxRunningCount;
    this.taskQueue = []; // 任务队列
    this.isStop = false; // 是否停止任务执行
  }

  /**
   * 任务注册器
   * @param {function} task 是一个函数 返回值必须是一个promise
   */
  register (task) {
    this.taskQueue.push(task);
  }

  /**
   * 执行单个任务
   */
  _runTask () {
    // 判断是否要继续执行下去
    if (!this._isShouldRun()) return;
    // 取出队列顶部的任务
    const task = this.taskQueue.shift();

    // 任务队列如果需要循环执行, 则执行过（此时其实还未执行，但已经确定执行）的任务加入到队尾
    if (this.isCircle) {
      this.taskQueue.push(task);
    }

    task().then(() => {
      this._runTask(); // [⭕️]继续执行下一个任务
    }).catch(); // catch中 就不执行了run了 停止执行
  }

  // 启动器
  run () {
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
}

module.exports = PipeLine;