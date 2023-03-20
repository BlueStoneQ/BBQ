/**
 * 判断 DOM 标签的合法性，
 * 1. 标签的闭合，
 * 2. span 里面不能有 div，
 * 3. 写一个匹配 DOM 标签的正则
 * 2022-6-22
 * https://interview.html5.wiki/experience.html#%E4%B8%AD%E5%A4%A7%E5%8E%82%E9%9D%A2%E8%AF%95%E6%80%BB%E7%BB%93
 * 
 *答案：
 https://segmentfault.com/a/1190000023783535?sort=newest

 请参考：《正则表达式必知必会》章8：回溯引用
 */

const isValidHtmlTag = (str) => {
  // defend

  return /<([^>]+)>[^<|>]*<\/\1>/g.test(str);
}

// test
const testStrs = [
  '<div>123</div>',
  '<div>123></div>',
  '<div>123</d'
];

testStrs.forEach(str => {
  console.log(str, ' : ', isValidHtmlTag(str), '\n');
});