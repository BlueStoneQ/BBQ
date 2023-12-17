// reduce
const flat = (arr = []) => {
  return arr.reduce((preReturnVal, curVal) => [].concat(preReturnVal, Array.isArray(curVal) ? flat(curVal): curVal), 0)
}

// 递归法
const flat = (arr) => {
  const res = []

  for () {}

  return res
}