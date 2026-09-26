/**
 * 【题目 3.8】数字千分位分隔
 * 要求：将数字每三位加一个逗号分隔（支持整数与小数），如 1234567.89 -> 1,234,567.89。
 */

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
 * 
   // (?) 零宽断言， 用来匹配左右是/不是什么的位置的
    //（?=pattern）当前位置后面必须跟着xxx pattern 
    // (?!pattern) 当前位置后面必须不跟着xxx pattern 
 */
Number.prototype.$splitBtDot = function() {
    const numstr = this.toString()

    // 有小数点, 整数部分需要按3位一分: 非首位, 距离. 3 6 9 等 非首位的位置，都匹配，替换成,
    if (/\./.test(numstr)) {
        return numstr.replace(/(?!^)(?=(\d{3})+\.)/g, ',')    
    }
    // 无小数点
    return numstr.replace(/(?!^)(?=(\d{3})+$)/g, ',')
}

// test
console.log('12345678.12345: ', splitWithDot(12345678.12345));
console.log('12345678: ', splitWithDot(12345678));
