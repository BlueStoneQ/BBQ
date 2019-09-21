 /**
  * 模拟实现instanceOf - 源知识：对象的继承实质，要义就是遍历原型链
  * @param {*} L 
  * @param {*} R 
  */
function instance_Of(L, R) {
  // 不断遍历L的__proto__来找到和R的prototype进行比对
  L = L.__proto__;
  O = R.prototype;
  let i = 0; // 测试：统计计数用的
  while (L) {
    if (L === O) {
      return true;
    }
    L = L.__proto__;
    console.log(`[${i}]L`, L); // 测试：L的最后一层__proto__指向null
    i++; // 测试
  }
  return false;
}

/**
 * 测试
 */
function test(L, R, fn) {
  console.log(`${L} 是否instanceof ${R}`, instance_Of(L, R));
}

test([], Array);
test(function() {}, Array);