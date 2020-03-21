/**
 * json数据的遍历
 * 1. 单纯只有基本类型和对象的json
 * 2. 加入数组
 * 3. 加入函数
 * 4. 注意互相引用的问题：利用标记 或者 缓存方法处理
 * 5. TODO: 给出一套遍历json型数据的方案和工具： 例如自定义校验规则 和 该规则下的处理 
 */

 const TYPE = {
   array: "[object Array]",
   object: "[object Object]",
   func: "[object Function]"
 }

 const json = {
   a: 1, 
   b: {
     c: 2,
     d: {
       e: 3,
       f: 4
     }
   },
   h: {
     i: {
       j: 5
     },
     k: 6
   }
 }

 /**
  * 遍历该json
  * @param { Object } data json数据
  * @param { func } fn 执行到每个节点会调用的回调
  */
 function traversalJson(data, fn) {
   // TODO: 防御 1. 判空 2. 是否为对象
   // 类型判断
   // 对象
   const keys = Object.keys(data);
   if (isType(data, TYPE.object)) {
    for (const key of keys) {
        const val = data[key];
        traversalJson(val, fn);
    }
   } else {
    // 如果是基础类型（非引用类型） 则执行fn
    fn && fn(data);
   }
 }

 /**
  * 类型判断
  */
 function isType(val, type) {
   // TODO: 防御
   return Object.prototype.toString.call(val) === type;
 }

 // 测试
 traversalJson(json, val => {
   console.log(val);
 })