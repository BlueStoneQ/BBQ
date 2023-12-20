/**
 * 2023-4-13
 * 模版替换：参考：https://blog.csdn.net/qq_52722885/article/details/118447712
 */

String.prototype.replaceTPL = function (kvObj) {
    // 注意：要使用this就不要使用箭头函数 箭头函数的this是从定义环境向上捕获的 不指向当前字符串
    return this.replace(/\{([^\{|\}]+)\}/g, (match, p1) => {
        return kvObj[p1] || ''
    });
}