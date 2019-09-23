/**
 * 实现一个json.parse();
 * 也就是把json的字符串（序列化）转换成js字面量形式
 * 1. 我们能不能也实现下序列化呢
 * 2. 参考：https://zhuanlan.zhihu.com/p/28049617
 */

 /**
  * 利用eval实现JSON.parse
  */
function jsonParse(jsonStr) {
  return eval(jsonStr);
}

/**
 * 测试
 */
const jsonStr = '{"a":"123", "b":"678"}';

console.log(jsonParse("(" + jsonStr + ")"));