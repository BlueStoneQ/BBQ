/**
 * 数字每3位加一个,分割符
 * 2022-6-16
 * 参考：https://juejin.cn/post/7021672733213720613?utm_source=gold_browser_extension#heading-15
 * 参考：https://cloud.tencent.com/developer/article/1483920?from=article.detail.1483443
 */

/**
 * 1. 利用正则进行匹配位置
 * 支持支持小数 或者 整数
 * 还有一种实现： return num.toLocalString(); // 必须得有小数点
 */
const splitWithDot = (num) => {
  const numStr = num.toString();

  // 有小数点, 整数部分需要按3位一分: 非首位,
  if (/\./.test(numStr)) {
    return numStr.replace(/(?!^)(?=(\d{3})+\.)/g, ',');
  }
  // 无小数点
  return numStr.replace(/(?!^)(?=(\d{3})+$)/g, ',');
}

// test
console.log('12345678.12345: ', splitWithDot(12345678.12345));
console.log('12345678: ', splitWithDot(12345678));
