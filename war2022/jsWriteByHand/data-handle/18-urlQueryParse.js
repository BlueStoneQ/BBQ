/**
 * 【题目 3.10】URL 参数解析
 * 要求：解析 URL 的 query 部分为对象，正确处理同名参数、解码等情况。
 */

/**
 * url的参数解析
 * 2022-6-16
 * https://juejin.cn/post/6946136940164939813#heading-49
 */
// 方法1：更紧凑的写法, 算法和方法2一样，这里写得更紧凑，更体现代码功力
const formatVal = (value) => {
    if (/^\d+$/.test(value)) {
        return +value
    }

    return value
}

const parseUrlParams = (url) => {
    const resObj = {}

    // 分割出参数 - 为数组 [{k1, v1}, {k2, v2}....], ps: 这里如果为了找到更准确的分割点？ - 可以使用/.+\?(.+)$/ + match, 
    const queryStr = url.split('?')[1]
    if (!queryStr) return resObj // 没有query，直接返回空对象

    queryStr.split('&').map(kv => {
        const [ kRaw, vRaw ] = kv.split('=')
        return {
            k: decodeURIComponent(kRaw),
            v: formatVal(decodeURIComponent(vRaw ?? '')) // 应该在这里进行format
        }
    }).forEach(({ k, v }) => {
        // 如果resObj中已经有这个key 了 则以数组的形式 将这个值加进去
        resObj[k] = resObj.hasOwnProperty(k) ? [].concat(resObj[k], v) : v
    })

    return resObj
}

// --------------------------------------------------------------------------------------------------

// 方法2： 原始写法
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
