/**
 * 高频：并发任务调度器
 * 很经典 也很实用 值得关注
 * 2022-6-17
 * https://juejin.cn/post/6854573217013563405
 * - 这个实现 似乎繁琐了些 下面的实现比较经典
 * 其中 最经典的手法 就是在then或者finally中 递归调用任务启动器 执行下一个任务 
 * 
 * 类似的题：
 * [异步控制并发数](https://juejin.cn/post/7031322059414175774#heading-6)
 * 
 * 
 * 题目：
 * JS实现一个带并发限制的异步调度器Scheduler，保证同时运行的任务最多有两个。完善下面代码的Scheduler类，使以下程序能够正常输出：
      class Scheduler {
        add(promiseCreator) { ... }
        // ...
      }
        
      const timeout = time => new Promise(resolve => {
        setTimeout(resolve, time);
      })
        
      const scheduler = new Scheduler();
        
      const addTask = (time,order) => {
        scheduler.add(() => timeout(time).then(()=>console.log(order)))
      }

      addTask(1000, '1');
      addTask(500, '2');
      addTask(300, '3');
      addTask(400, '4');

      // output: 2 3 1 4
 */


/**
 * promise版本
 */
 class Scheduler {
    constructor (maxRunningCount = 2) {
      this.taskQueue = []; // 任务队列
      this.maxRunningCount = maxRunningCount; // 最多可以并发执行的任务数量
      // this.doneTaskCount = 0; // 已经执行结束的任务数量
    }

    /**
     * 任务注册器
     * @param {*} promiseCreator 是一个函数 返回值必须是一个promise
     */
    add(promiseCreator) {
      this.taskQueue.push(promiseCreator);
    }

    _run () {
      // 防御
      if (this.taskQueue.length  === 0) {
        return;
      }

      // 取出当前队列头部的任务
      const task = this.taskQueue.shift();
      const that = this; // 其实这里可以不用 因为下面都是箭头函数 里面的this也是指向定义时的外面的
      // 执行当前任务
      task().then(res => {
        // 执行成功
      }).catch(err => {
        // 执行失败
      }).finally(() => {
        // 继续递归调用任务执行器 执行下一个任务
        that._run();
      });
    }

    // 一般而言 是需要这个启动器的 当然 也可以不需要 看出题人的要求 
    startRun () {
      // defend : 任务队列为空 是不能启动的 
      if (this.taskQueue.length === 0) {
        return;
      }

      // 一次并发的任务数量 需要取任务数量 和 最多并发上限maxRunningCount 的最小值，保证在任务队列数量小于maxRunningCount时 不做过度的无谓调用(虽然this._run中同样有防御)
      let workableTaskCount = Math.min(this.taskQueue.length, this.maxRunningCount);

      // !!!! 关键实现
      while (workableTaskCount > 0) {
        this._run();
        workableTaskCount--;
      }
    }
  }


/**
 * async版本
 */



/**
 * test
 */

(() => {
  // class Scheduler {
  //   add(promiseCreator) { ... }
  //   // ...
  // }
     
  const timeout = time => new Promise(resolve => {
    setTimeout(resolve, time);
  })
    
  const scheduler = new Scheduler();
    
  const addTask = (time,order) => {
    scheduler.add(() => timeout(time).then(()=>console.log(order)))
  }
  
  addTask(1000, '1');
  addTask(500, '2');
  addTask(300, '3');
  addTask(400, '4');

  scheduler.startRun();
  
  // output: 2 3 1 4
  
})()