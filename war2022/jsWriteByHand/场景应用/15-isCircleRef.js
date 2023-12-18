/**
 * 判断对象是否存在循环引用
 * 2022-6-17
 * https://juejin.cn/post/6946136940164939813#heading-68
 */

/**
 * 首先这还是一个json-tree的遍历问题 利用递归遍历 - 需要一个Set来判断值是不是存在重复
 * 可以用一个闭包设置一个map 来查重，遇到已经遇到的重复key 则认为发生了循环引用？
 * @param {*} obj 
 */
const isCycleObject = (obj) => {
  
}

// test
const a = 1;
const b = {a};
const c = {b};
const o = {d:{a:3},c}
o.c.b.aa = a;

console.log(isCycleObject(o))