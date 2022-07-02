/**
 * 大数相加
 * 2022-6-16
 * https://cloud.tencent.com/developer/article/1483443
 * https://juejin.cn/post/6946136940164939813#heading-43
 */

const bigNumSum = (numStr1, numStr2) => {
  // defend 要求传进来的2个加数 必须是字符串 - 如果是大数 不用字符串形式传 则会丢失精度 失去计算的意义
  if (typeof numStr1 !== 'string' || typeof numStr2 !== 'string') {
    throw new TypeError('入参的加数必须是字符串');
  }

  // num 格式化为数组 并逆序 从个位开始加[!!!逆序]
  const num1Arr = numStr1.split('').reverse();
  const num2Arr = numStr2.split('').reverse();

  let result = []; // 返回值也是字符串
  // 获得num1 num2 中比较长的一方作为循环的基底
  const maxLen = Math.max(num1Arr.length, num2Arr.length);
  // 记录上一位向当前位是否进1 还是 0
  let carry = 0;

  // 确保：从个位向前开始加
  for (let i = 0; i < maxLen; i++) {
    // num1当前位
    const sum = _formatNum(num1Arr[i]) + _formatNum(num2Arr[i]) + carry;
    // 生成当前位的值
    result[i] = sum % 10;
    // 更新carry 是否向下一位进1
    carry = sum > 9 ? 1 : 0;
  }

  return result.reverse().join('');
}

// 工具函数：传进来的数字（位）不存在的时候 返回0参与运算；传回字符串-转为数字参与计算
function _formatNum (numStr) {
  if (!numStr) {
    return 0;
  }

  return +numStr;
}

// test 入参一般使用字符串哈
const num1 = '13132132132199'
const num2 = '9'
console.log(bigNumSum(num1, num2)); // expect 13132132132208