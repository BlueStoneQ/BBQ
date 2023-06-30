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