/**
 * 手写new
 * author: qiaoyang
 * date: 2021-3-14
 */
const new2 = (parent, ...params) => {
  // 1. 创建一个新对象
  const newObj = Object.create(parent.prototype);
  // 2. 调用parent 构造函数
  const result = parent.apply(parent, params);
  // 3. 返回结果 - 构造函数返回对象的情况下 则new的返回值应为构造函数的返回值
  return typeof result === 'object' ? result : newObj;
}

export {
  new2
}
