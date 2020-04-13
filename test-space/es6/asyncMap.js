/**
 * 测试异步遍历相关
 * 参考：
 *  1. https://zhuanlan.zhihu.com/p/31000936
 *  2. 阮一峰《es6标准入门》 - async - 异步遍历
 */


 /**
  * 异步函数模拟
  */
 function delay() {
   return new Promise(resolve => setTimeout(resolve, 300));
 }

 async function delayLog(item) {
   await delay();
   console.log(item);
   return item;
 }

/**
 * 不等待异步完成的情况
 * 1. 回调就是另一个函数了，所以其中的异步await不会阻碍回调外部的执行顺序
 */
async function processArray (arr) {
  const res = [];
  arr.forEach(async (item, i) => {
    // forEach回调函数内部是异步的
    const a = await delayLog(item);
    res.push(a);
    console.log('a: ', a);
    console.log(`res${i}: `, res[i]);
  });
  console.log('Done');
}

/**
 * 串行 - 等待所有的结果返回
 */
async function processArraySerial(arr) {
  for (const item of arr) {
    await delayLog(item);
  }
  console.log('Done');
}

 /**
  * 并行 - 等到所有的结果返回再执行后面的
  */
 async function processArrayParallel(arr) {
   // 并行还是利用map/forEach等借助回调实现
   // 这里其实并没有执行 只是
   const promises = arr.map(delayLog);
   console.log('promise: ', promises);
   const res = await Promise.all(promises);
   console.log('res: ', res);
   console.log('Done');
 }



/**
 * test
 */
// processArray([1, 2, 3]);
// processArraySerial([1, 2, 3]);
processArrayParallel([1, 2, 3]);