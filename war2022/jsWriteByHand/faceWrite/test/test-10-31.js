/**
 * 实现一个批量请求函数 multiRequest(urls, maxNum)，要求如下：
  要求最大并发数 maxNum
  每当有一个请求返回，就留下一个空位，可以增加新的请求
  所有请求完成后，结果按照 urls 里面的顺序依次打出
 */
class TaskManage {
  constructor (maxNum = 1) {
    this.taskQueue = [];
    this.maxNum = maxNum;
    this.curIndex = 0;
    this.taskCount = this.taskQueue.length;
    this.result = new Array(this.taskCount).fill();
  }

  register (tsak) {
    this.taskQueue.push(task);
  }

  run () {
    // defend
    if (this.taskQueue.length <= 0) return;

    // algo
    const task = this.taskQueue.shift();
    const curIndex = taskCount - this.taskQueue.length - 1;

    task().then(res => {
      this.result[curIndex] = res;
      this.curIndex++;
      this.run();
    }).catch(() => {
      this.result[curIndex] = err;
      this.curIndex++;
      this.run();
    });
  }

  start () {
    if (this.taskQueue.length <= 0) return;

    this.taskCount = this.taskQueue.length;

    while (this.maxNum > 0) {
      this.run();
      this.maxNum--;
    }
  }

  getResults () {
    return new Promise((resolve, reject) => {
      if (this.curIndex === this.taskCount) resolve(this.result);
    });
  }
}

const requestUrl = (url) => {
  return Promise.race(axios.post(url), setTimeout());
}

const multiRequest = async (urls, maxNum) => {
  // defend
  // init data
  const taskManager = new TaskManage(maxNum);
  // algo
  urls.forEach(url => {
    taskManager.register(requestUrl(url));
  });

  taskManager.start();

  return await taskManager.getResults();
}
