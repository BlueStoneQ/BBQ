/**
 * 深拷贝
 */
/**
 * 深拷贝 - 简单版
 */
function deepCloneMin(obj) {
  return JSON.parse(JSON.stringify(obj)); 
}

/**
 * 深拷贝 - 面试版
 */
function deepClone() {}

/**
 * 测试 - 慢慢养成写测试用例的习惯 
 */
var objMin = {
  arr1: [1, 2, 3],
  obj1: {
    c: 1
  }
}

var obj = Object.assign({}, objMin, {
  f1: function() {
    console.log(fghjkl);
  },
  reg1: new RegExp(/[1-9]*/)
});

console.log('deepCloneMin(objMin): ', deepCloneMin(objMin));
console.log('deepCloneMin(obj): ', deepCloneMin(obj)); 