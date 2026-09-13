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

(async () => {
  let numList = [1..100]

  while (numList.length > 0) {
      const num1 = numList.shift()
      const num2 = numList.shift()

      numList.push(await add(num1, num2))
  }
})()