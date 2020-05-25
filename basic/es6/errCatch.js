/**
 * 测试promise 和 try catch的异常捕获
 */

/**
 * 生成promise
 * @param {Boolean} isResolve true: 该promsie状态凝固为fullFilled false: 生成状态为reject的promise实例
 * @param {String} flag 本promise的标志信息
 */
const getPromise = (isResolve = true, flag = '') => new Promise((resolve, reject) => {
  if (isResolve) resolve(`resplve[ ${flag} ]`); 
  if (!isResolve) reject(`reject[ ${flag} ]`);
});

async function test() {
  const pReject1 = getPromise(false, 'pReject1');
  /**
   * case1: promise中被catch的err还会冒泡到后面的catch吗
   */
  // pReject1.then(d => console.log('t1: ', d)).catch(e => console.log('c2: ', e));

  /**
   * case2: promise中被catch的err还会冒泡到后面的try catch吗
   */
  try {
    // 不会抛到外层 未被捕获的err才会冒泡 -> 链式catch -> try catch -> 最外层：就成了UnhandledPromiseRejection
    await pReject1.then(d => console.log('t1: ', d)).catch(e => console.log('c2: ', e));
    // await pReject1.then(d => console.log('t1: ', d));
  } catch(e) {
    // 要在try catch中捕获promise的err 必须使用async + await
    console.log('c3: ', e);
  }
}

test();

