/**
 * 和调度器的题很像 
 * 值得一看 且 实用
 * 20226-17
 * [异步控制并发数](https://juejin.cn/post/7031322059414175774#heading-6)
 * 这里其实相当于把promise调度器中的startRun和run写在了一起
 */
const limitRequest = (urlList, maxTaskCount = 3, callback) => {
  return new Promise((resolve, reject) => {
    const taskTotalCount = urlList.length; // 任务的总体数量
    let taskDoneCount = 0;// 当前执行了的任务数量

    // 最开始同时启动maxCount个任务
    while (maxTaskCount > 0) {
      runTask(); // 一个启动器开启 通过回调 可以源源不断地调用下一个任务 直到所有任务执行完 这个任务调度器的手法 很实用 很经典
      maxTaskCount--;
    }
  
    function runTask () {
      if (urlList.length === 0) {
        // me: 其实 也可以在这里resolve 代表着整个promise状态的凝结 逻辑结束
        return;
      }
      // 获得队列头部的任务
      const nowUrl = urlList.shift();
      // 执行任务
      axios.post(nowUrl).then(res => {
        // 成功的操作
        // TODO: 装填结果
        }).catch(err => {
          // 失败的操作
        }).finally(() => {
          taskDoneCount++; // 又一个任务执行完了 执行结束的任务数量+1
          if (taskDoneCount >= taskTotalCount) {
            // 已经执行的任务数量等于大于总体的任务数量时 整个promise的任务可以结束了（或者任务队列为空时都可） - 任务已经执行完了 
            // resolve();
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