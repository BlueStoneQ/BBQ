/**
 * url的参数解析
 * 2022-6-16
 * https://juejin.cn/post/6946136940164939813#heading-49
 */

const parseParam = function(url) {
  // defend

  const resObj = {};

  // 分割出参数 - 为数组
  const query = url.split('?')[1]; // 这里如果为了找到更准确的分割点？ - 可以使用/.+\?(.+)$/ + match
  const queryList = query.split('&');
  // 参数按照键值对挂在对象上 - 注意：需要decode + 部分类型需要处理 
  for (let item of queryList) {
    const [ key, val ] = item.split('=');
    let value = decodeURIComponent(val);
    // [这一块逻辑可拆分出去]这里一般要判断下value的类型：现在统一是字符串 例如判断下是不是数字
    if (/^\d+$/.test(value)) {
      value = +value;
    }

    if (resObj.hasOwnProperty(key)) {
      // 如果resObj中已经有这个key 了 则以数组的形式 将这个值加进去
      resObj[key] = [].concat(resObj[key], value);
    } else {
      resObj[key] = value;
    }
  }
  // 返回挂载了键值对的对象
  return resObj;
}


// test
let url = 'http://www.domain.com/?user=anonymous&id=123&id=456&city=%E5%8C%97%E4%BA%AC&enabled';
console.log(parseParam(url));
/* 结果
{ user: 'anonymous',
  id: [ 123, 456 ], // 重复出现的 key 要组装成数组，能被转成数字的就转成数字类型
  city: '北京', // 中文需解码
  enabled: true, // 未指定值得 key 约定为 true
}
*/
