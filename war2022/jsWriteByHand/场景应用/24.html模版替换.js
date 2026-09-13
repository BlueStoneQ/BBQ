/**
 * 【题目 4.14】HTML 模板替换
 * 要求：实现字符串模板替换，将 '{key}' 占位符替换为对象中对应的值。
 */

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