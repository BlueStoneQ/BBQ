/**
 * 交换2个数 不用中间变量
 * 2022-3-17
 */

const swapNumWithoutTemp = (a,  b) => {
  a = a + b;
  b = a - b; // a + b - b = a
  a = a - b; // a + b - a = b
}