/**
 * 猿辅导-2面：10-16
 * 
 * 实现一个请求控制函数

 

// 一次性输入多个 url 要求实现按照给定的最大的值并发请求，完成一个请求后自动发送下一个，请求全部结束后调用回调函数

 

const urls = ['http://1', 'http://2', 'http://3', 'http://4', 'http://5'];

const requestControl = function(urls, max, callback){
    // your code

}
 */

class TaskManager {
  constructor (maxParalCount = 1) {
      this.taskQueue = [];
      this.taskCount = 0;
      this.maxParalCount = maxParalCount;
      this.result = [];
  }
  
  register (task) {
      this.taskQueue.push(task);
      this.taskCount++;
  }
  
  run () {
      // defend
      if (this.taskQueue.length <= 0) {
          return;
      }
      
      const task = this.taskQueue.shift();
      const context = this;
      // defend
      task().then(res => {
          context.result.push(res);
          if (this.ifEmit()) {
              return;
          }
          context.run();
      }).catch(err => {
          // handle err
      });
  }
  
  action () {
      let count = this.maxParalCount;
      
      while (count > 0) {
          this.run();
          count--;
      }
  }
  
  ifEmit () {
      if (this.result.length === this.taskCount) {
          this.this._getResults();
          return true;
      }
      
      return false;
  }
  
  
  getResults () {
      return new Promise((resolve, reject) => {
          this._getResults = function() {
              resolve(this.result);
          };
      });
  }
}

const createRequest = (url) => {
  // task
  return function () {
      return axios.post(url);
  }
}

const requestControl = function(urls, max, callback){
  // defend
  // init data
  const taskManager = new TaskManager(max);
  // algo
  urls.map(url => createRequest(url))
      .forEach(task => {
          taskManager.register(task);
      });
  
  taskManager.action();

  // return 
  taskManager.getResults().then(res => {
      callback && callback(res);
  });
}

// 


// test
const urls = ['http://1', 'http://2', 'http://3', 'http://4', 'http://5'];