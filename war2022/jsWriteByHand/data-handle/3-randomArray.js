/**
 * 实现数组的乱序输出 
 *  - 也就是将一个数组进行乱序
 * 2022-3-23
 */

/**
 * 一般思路都是遍历该数组 
 * 根据当期那下标index产生一个randomIndex
 * 然后交换index 和 randomIndex 2个元素
 */
const randomArray = (arr) => {
  const len = arr.length;

  for (let i = 0; i < len; i++) {
    // 产生random是核心 randomIndex 只要保证是在[0, len - 1]范围内 并且 不是i即可
    // 其实算法就是 i + 在i剩余的区间[0, len - 1 - i)内取一个下标 2个下标相加 一定在[0, len - 1]中 并且不为i
    const randomIndex = Math.round(Math.random() * (len - 1 - i)) + i;

    const temp = arr[i];
    arr[i] = arr[randomIndex];
    arr[randomIndex] = temp;
  }

  return arr;
}

// test
(() => {
  const arr = [0, 1, 2, 3, 4, 5];

  randomArray(arr);

  console.log(arr);
})()