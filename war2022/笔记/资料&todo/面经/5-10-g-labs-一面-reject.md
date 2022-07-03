```
觉得不是资深
想找一个更资深的
```
## 手写
1. fetch的超时处理封装
```js
const getData = fetch(url).then().catch();

const addTime = (fn, time) => {
  // const startTime = new Date().getTime();

  return new Promise((resolve, reject) => {

    const timer = setTimeout(() => {
      reject(new Error());
    }, time);

    return fn.then(res => {
      clearTimeout(timer);
      resolve(res)
    }).catch(err => {
      reject(err)
    });
  });
}
```
## 问答
1. web安全和防御
2. vue3的composition-api和React hooks的区别
3. 页面启动优化方案
4. vue的常用复用手段
5. vue:v-for为何用key的好处
  - 提高新旧vNode diff的速度