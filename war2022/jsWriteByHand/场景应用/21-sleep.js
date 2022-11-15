/**
 * sleep函数
 * 2022-10-5
 * https://www.bilibili.com/video/BV1Xr4y1x7DR/?spm_id_from=333.337.search-card.all.click&vd_source=9365026f6347e9c46f07d250d20b5787
 * 题目：
 * 从0开始 每过1s钟打印一次 该数+2的值，也就是每过1s钟依次打印 0 2 4 6 8 10
 * 1. 数字打印到10为止
 * 2. 提示：使用promise + async await
 * 
 * me: 这道题可以使用我们的异步任务调度器解决 也可以使用sleep函数解决
 */

/**
 * sleep函数解决
 */

/**
 * @param {*} delay 睡眠时间
 * @returns 
 */
const sleep = (delay = 0) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

(() => {
  const log = async () => {
    for (let i = 0; i <= 10; i+=2) {
      await sleep(1000); // 睡1000ms
      console.log(i);
    }
  }

  log();
})()


