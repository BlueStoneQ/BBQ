/**
 * 2022-6-16
 * https://juejin.cn/post/6946136940164939813#heading-55
 * - 其实就是时间循环 等到setTimeout的回调执行时 作为宏任务的i已经随着遍历从1变成了4
 */

// 使用闭包 保证i属于块级作用域
const test1 = () => {
  for (var i = 1; i < 5; i++) {
    ((ii) => {
      setTimeout(() => {
        console.log(ii);
      }, 1000 * ii);
    })(i) // 这里传入i 作为实参
  }
}

// 使用let 来保持块级作用域
const test2 = () => {
  for (let i = 1; i < 5; i++) {
      // let 为每次循环 都创建了一个块级作用域 独立的内存空间来存储i,所以 多次循环的i是独立的内存空间，
      // - 而var无法创建块级作用域，就会在遍历的时候 被改变，最后定时器拿到的都是当前函数作用域下的i 只有一个i
      setTimeout(() => {
        console.log(i);
      }, 1000 * i);
  }
}

// test
// test1();

test2();