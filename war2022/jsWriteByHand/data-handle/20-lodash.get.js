/**
 * 【题目 3.5】手写实现 lodash.get
 * 要求：实现 get(source, path, defaultValue)，按 'a[0].b.c' 形式的路径安全取值，
 *      路径不存在时返回默认值。
 */

Object.prototype.$get = function(pathStr, defaultValue = undefined) {
    // 1. 解析pathStr
    const pathArr = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
    // 2. 遍历path节点，逐层访问
    let res = this

    for (const key of pathArr) {
        res = res && res[key]

        if (!res) {
            return defaultValue
        }
    }

    return res
}


/** **************************************************************************************************************** */

/**
 * 手写lodash.get()
 * 2023-3-29
 * 参考: https://juejin.cn/post/6844903966992498696
 */

const myGet = (source, path, defaultValue = undefined) => {
  // 格式化path: a[3].b -> a.3.b -> [a,3,b]
  const keyList  = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let res = source

  for (const key of keyList) {
    res = res && res[key]

    if (!res) {
      return defaultValue
    }
  }

  return res
}

// test
const source = {
  a: [
    0, 1, 2, { b: 5 }
  ]
}

console.log(myGet(source, 'a[3].b')) // expect 5
console.log(myGet(source, 'a[5].b')) // expect undefined