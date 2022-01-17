import MyPromise from '../promise-polyfill';
import request from 'request';
import babel from 'babel-register';

let promise1 = new MyPromise((resolve) => {
  request('https://www.baidu.com', (error, response) => {
      if(!error && response.statusCode === 200) {
          resolve('request1 success');
      }
  });
});

promise1.then((value) => console.log(value));

let promise2 = new MyPromise((resolve, reject) => {
  request('https://www.baidu.com', (error, response) => {
      if(!error && response.statusCode === 200) {
          reject('request2 failed');
      }
  });
});

promise2.then((value) => {
  console.log(value);
}, (reason) => {
  console.log(reason);
});