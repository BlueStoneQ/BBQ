/**
 *  2022-6-16
 *  https://juejin.cn/post/6946136940164939813#heading-51
 *  下面来看一道比较典型的问题，通过这个问题来对比几种异步编程方法：红灯 3s 亮一次，绿灯 1s 亮一次，黄灯 2s 亮一次；如何让三个灯不断交替重复亮灯？
 *  me: 最好有一个通用的解决方法：其实就是一个异步的串行执行方案，可以参考koa中间件模型
 */

/**
 * 通用解决方案：异步中间件串行执行
 * 测试通过
 */
class PipeLine {
  /**
   * @param {Boolean} isCircle  任务队列是否循环执行, 默认不循环执行
   */
  constructor (isCircle = false) {
    this.isCircle = isCircle;
    this.taskQueue = []; // 任务队列
    this.isStop = false; // 是否停止任务执行
  }

  /**
   * 可以理解为koa的use，就是往队列中加入一个任务
   * @param {function} task 是一个函数 返回值必须是一个promise
   */
  register (task) {
    this.taskQueue.push(task);
  }

  // 从任务队列中取出队头的任务 执行
  run () {
    // 任务队列：结束 （队列空了 或者 被外界停止）
    if (this.taskQueue.length === 0 || this.isStop === true) return;

    const curTask = this.taskQueue.shift();
    // 任务队列如果需要循环执行, 则执行过（此时其实还未执行，但已经确定执行）的任务加入到队尾
    if (this.isCircle) {
      this.taskQueue.push(curTask);
    }
    // 执行任务
    curTask().then(() => {
      this.run(); // 继续执行下一个任务
    }).catch(() => {
      // catch中 就不执行了run了 停止执行
    });
  }

  // 停止执行
  stop () {
    this.isStop = true;
  }
}

// test
/**
 * HOF（高阶函数）
 * 返回一个promise creator， 这是一个函数, 返回值为promise
 * 其实这个函数还可以拆分：promiseIfy是一个，内部的setTimeout是一个逻辑
 * @param {*} fn 
 * @param {*} delay 
 * @returns { function } 
 */
const taskPromiseify = (fn, delay) => {
  return () => new Promise((resolve, reject) => {
    setTimeout(() => {
      fn && fn();
      resolve();
    }, delay);
  });
}

const task1Creater = taskPromiseify(() => { console.log('red'); }, 3000);
const task2Creater = taskPromiseify(() => { console.log('green'); }, 2000);
const task3Creater = taskPromiseify(() => { console.log('yellow'); }, 1000);

// const pipeLine = new PipeLine(true);
// pipeLine.register(task1Creater);
// pipeLine.register(task2Creater);
// pipeLine.register(task3Creater);

// pipeLine.run();

// 使用外部定义的通用解决方案
const PipeLine1 = require('./通用版解决方案.js');
const pipeLine1 = new PipeLine1(true);
pipeLine1.register(task1Creater);
pipeLine1.register(task2Creater);
pipeLine1.register(task3Creater);

pipeLine1.run();


/** ------------------------------------------------------------------------------------------------------------ */
// 要有task包装器的概念

const LIGHT = {
  red: 'red',
  green: 'green',
  yellow: 'yellow'
};

const method = {
  red: red,
  green: green,
  yellow: yellow
}

// callback实现
const callBackTest = () => {
  const task = (delay, type, callback) => {
    setTimeout(() => {
      // 执行对应的方法
      method[type]();
      
      callback && callback();
    }, delay);
  }

  const step = () => {
    task(3000, LIGHT.red, () => {
      task(1000, LIGHT.green, () => {
        task(2000, LIGHT.yellow, step); // 递归step 重新开启下一个循环
      });
    });
  }

  step();
}

// promise实现
const promiseTest = () => {
  const task = (delay, type) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        method[type]();
        resolve();
      }, delay);
    });
  }

  const step = () => {
    task(3000, LIGHT.red).then(() => {
      return task(1000, LIGHT.green);
    }).then(() => {
      return task(2000, LIGHT.yellow);
    }).then(() => step());
  }

  step();
}

// async实现
const asyncTest = () => {
  const task = (delay, type) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        method[type]();
        resolve();
      }, delay);
    });
  }

  const step = async () => {
    await task(3000, LIGHT.red);
    await task(1000, LIGHT.green);
    await task(2000, LIGHT.yellow);
    step(); // 重新开启下一个循环
  }

  step();
}

// // test
// function red() {
//   console.log('red');
// }
// function green() {
//   console.log('green');
// }
// function yellow() {
//   console.log('yellow');
// }


// // callBackTest();

// // promiseTest();

// asyncTest();



