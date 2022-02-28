/**
 * 2022-2-28
 */

function _new () {
  // init data
  const newObj = Object.create(null);
  const constructor = Array.prototype.shift.apply(arguments);
  // defend
  if (typeof constructor !== 'function') {
    console.error('type error');
    return;
  }
  // algo
  // 1. 调用constructor 将context作为this注入到constrctor中 这样 内部的一些属性就挂载到了context上了 
  const res = constructor.apply(newObj, arguments);

  // 2. 计算flag： constructor是否有返回值，且该返回值类型为对象或者函数
  const flag = flag && (typeof flag === 'object' || typeof flag === 'function');
  
  // 3. constructor 有有效返回值 则直接使用该返回值 否则 使用我们构建的对象作为实例
  return flag ? res : newObj; 
}