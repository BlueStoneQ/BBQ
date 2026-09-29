/**
 * 【题目 7.2】快手（商业化 6-27）
 * 要求：前端有 100 个数字，后端 add 接口每次只接收两个数返回其和且 QPS 不限，
 *      设计最快（并发两两相加、逐轮归并）的方式求出 100 个数之和。
 */

/**
 * 1、前端：100个数字，没有add操作的。
 * 2、后端有个add 接口，每次接收2个参数，返回2个数字的和
 * 3、后端接口QPS不限，最快的方式获得100个数的和。
 */

// 并发版：主体思路（分层异步并发+收集结果）：每一轮同时计算相邻数字的和，等待这一轮全部完成，再进入下一轮。
const fetchAdd = async () => {
    // let numList = [1..100]
    let numList = Array.from({ length: 100 }, (_, i) => i + 1)

    while(numList.length > 1) {
        const taskQueue = []

        for (let i = 0; i < numList.length; i += 2) {
            if (i + 1 < numList.length) {
                // 这里不用await，不用等待，并发请求
                taskQueue.push(add(numList[i], numList[i + 1]))
            } else {
                // 单下来的最后一个元素
                taskQueue.push(numList[i])
            }
        }

        // task并发 发出请求，并加入到taskQueue，
        // 这里就会收集上一轮的异步接口计算结果到numList，
        // 进入下一轮循环，直到numList.length成为1，这样就是收集到最后一层的结果了
        numList = await Promise.all(taskQueue)
    }

    return numList[0]
}

// 调用
(async () => {
    const res = await fetchAdd()
})()

// 串行版：这个方法是实现了，但是还是串行，不是并发
(async () => {
  let numList = [1..100]

  while (numList.length > 0) {
      const num1 = numList.shift()
      const num2 = numList.shift()

      numList.push(await add(num1, num2))
  }
})()