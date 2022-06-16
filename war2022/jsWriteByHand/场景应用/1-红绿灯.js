/**
 *  2022-6-16
 *  https://juejin.cn/post/6946136940164939813#heading-51
 *  下面来看一道比较典型的问题，通过这个问题来对比几种异步编程方法：红灯 3s 亮一次，绿灯 1s 亮一次，黄灯 2s 亮一次；如何让三个灯不断交替重复亮灯？
 */

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

// test
function red() {
  console.log('red');
}
function green() {
  console.log('green');
}
function yellow() {
  console.log('yellow');
}


// callBackTest();

// promiseTest();

asyncTest();



