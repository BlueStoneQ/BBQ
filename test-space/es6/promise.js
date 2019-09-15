/**
 * Promise的链式调用
 */
function pTest1() {
  let p1 = new Promise(function(resolve, reject) {
    console.log('构造。。。');
    reject(42);
  });
  
  p1.then(function(val) {
    console.log('then1: ', val);
  }).catch(function(val) {
    console.log('catch1: ', val);
    return val + 1;
  }).catch(function(val) {
    console.log('catch 1.1: ', val);
  }).then(function(val) {
    console.log('then2: ', val);
    return val + 1;
  }).catch(function(val) {
    console.log('catch2: ', val);
  }).catch(function(val) {
    console.log('catch3: ', val);
  });
}

/**
 * Promise.race()
 */
function pTest2() {
  let p1 = new Promise(function(resolve, reject) {
    resolve(42);
  });
  let p2 = Promise.resolve(43);
  let p3 = new Promise(function(resolve, reject) {
    resolve(44);
  });
  let p4 = Promise.race([p1, p2, p3]);
  p4.then(function(val) {
    console.log('then1: ', val);
  }).catch(function(val) {
    console.log('then2: ', val);
  });
}

// 测试区
pTest2();

