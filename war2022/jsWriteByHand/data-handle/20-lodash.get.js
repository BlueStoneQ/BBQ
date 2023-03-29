/**
 * 手写lodash.get()
 * 2023-3-29
 * 参考: https://juejin.cn/post/6844903966992498696
 */

const myGet = (source, path, defaultValue = undefined) => {
  // 格式化path: a[3].b -> a.3.b -> [a,3,b]
  const keyList  = path.replace(/\[(\d+)\]/, '.$1').split('.')
  let res = source

  for (const key of keyList) {
    // 之所以要包一层Object，因为null 与 undefined 取属性会报错，所以使用 Object 包装一下
    res = Object(res)[key]

    if (res === undefined) {
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