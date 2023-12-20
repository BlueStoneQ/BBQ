/**
 * 和调度器的题很像 
 * 值得一看 且 实用
 * 2022-6-17
 * [异步控制并发数](https://juejin.cn/post/7031322059414175774#heading-6)
 * 这里其实相当于把promise调度器中的startRun和run写在了一起
 */

// HOF: 返回一个函数，该函数的返回值是fetch(url): promise
const taskCreate = (url) => () => fetch(url)

const limitRequest = (urlList = [], maxTaskCount = 3, callback) => {
  // 包装生成taskList
  const taskList = urlList.map((url, index) => ({
    task: taskCreate(url), 
    index, // 记录下当期那url的index, 为后面在res数组中填充结果确定填充index
  }))

  return new Promise((resolve, reject) => {
    const taskTotalCount = urlList.length; // 任务的总体数量
    const res = []; // 按照urlList顺序的结果
    let taskDoneCount = 0;// 当前执行了的任务数量

    // 最开始同时启动maxCount个任务
    while (maxTaskCount-- > 0) {
      runTask(); // 一个启动器开启 通过回调 可以源源不断地调用下一个任务 直到所有任务执行完 这个任务调度器的手法 很实用 很经典
    }
  
    function runTask () {
      // me: 其实 也可以在这里resolve 代表着整个promise状态的凝结 逻辑结束
      if (taskList.length === 0) return;
      
      // 获得队列头部的任务
      const { task, index } = taskList.shift();
      // 执行任务
      task().then(res => {
          // 成功的操作：记录结果
          res[index] = res;
        }).catch(err => {
          // 该任务失败的操作：记录报错
          res[index] = err;
        }).finally(() => { // 当然finally的使用要注意兼容问题，可以用bluebird之类的兼容库来处理polyfill问题
          taskDoneCount++; // 又一个任务执行完了 执行结束的任务数量+1
          if (taskDoneCount >= taskTotalCount) {
            // 已经执行的任务数量等于大于总体的任务数量时 整个promise的任务可以结束了（或者任务队列为空时都可） - 任务已经执行完了 
            resolve(res);
            callback && callback();
          } else {
            // 还未执行完任务 则调用任务启动器 执行队列中下一个任务
            // ！！！关键 所有的任务调度 都是这种在then中之类任务结束的地方 递归调用启动器 启动下一个任务
            runTask();
          }
        });
    }
  });
}



// test 
limitRequest(['http://xxa', 'http://xxb', 'http://xxc', 'http://xxd', 'http://xxe'], 3)