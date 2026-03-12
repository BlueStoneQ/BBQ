# JavaScript 手写题汇总

> 基于 BBQ 项目中的手写题整理，按类别系统梳理常见的 JavaScript 手写题

## 目录

- [一、JavaScript 基础](#一javascript-基础)
  - [1.1 Object.create 实现 ⭐⭐⭐](#11-objectcreate-实现-)
  - [1.2 new 操作符实现 ⭐⭐⭐](#12-new-操作符实现-)
  - [1.3 instanceof 实现 ⭐⭐⭐](#13-instanceof-实现-)
  - [1.4 call / apply / bind 实现 ⭐⭐⭐](#14-call--apply--bind-实现-)
  - [1.5 节流（throttle）⭐⭐⭐](#15-节流throttle)
  - [1.6 防抖（debounce）⭐⭐⭐](#16-防抖debounce)
  - [1.7 节流 + 防抖结合 ⭐⭐](#17-节流--防抖结合-)
  - [1.8 深拷贝（deepClone）⭐⭐⭐](#18-深拷贝deepclone)
  - [1.9 浅拷贝（shallowCopy）⭐⭐](#19-浅拷贝shallowcopy)
  - [1.10 继承（extends）⭐⭐⭐](#110-继承extends)
  - [1.11 Promise 实现 ⭐⭐⭐](#111-promise-实现-)
  - [1.12 typeof 实现 ⭐⭐](#112-typeof-实现-)
  - [1.13 元编程（Proxy & Reflect）⭐⭐⭐](#113-元编程proxy--reflect)
- [二、函数式编程](#二函数式编程)
  - [2.1 函数柯里化（curry）⭐⭐⭐](#21-函数柯里化curry)
  - [2.2 函数组合（compose）⭐⭐⭐](#22-函数组合compose)
  - [2.3 偏函数（partial）⭐⭐](#23-偏函数partial)
  - [2.4 AOP 面向切面编程 ⭐⭐](#24-aop-面向切面编程-)
  - [2.5 惰性函数（lazyCall）⭐⭐](#25-惰性函数lazycall)
  - [2.6 记忆函数（memoize）⭐⭐⭐](#26-记忆函数memoize)
- [三、数据处理](#三数据处理)
  - [3.1 数组扁平化（flat）⭐⭐⭐](#31-数组扁平化flat)
  - [3.2 数组去重（unique）⭐⭐⭐](#32-数组去重unique)
  - [3.3 扁平对象转树（flatObj2Tree）⭐⭐⭐](#33-扁平对象转树flatobj2tree)
  - [3.4 树转扁平对象（treeFlat）⭐⭐⭐](#34-树转扁平对象treeflat)
  - [3.5 lodash.get 实现 ⭐⭐](#35-lodashget-实现-)
  - [3.6 数组 API 实现 ⭐⭐⭐](#36-数组-api-实现-)
  - [3.7 日期格式化 ⭐⭐](#37-日期格式化-)
  - [3.8 数字千分位分隔 ⭐⭐](#38-数字千分位分隔-)
  - [3.9 大数相加 ⭐⭐⭐](#39-大数相加)
  - [3.10 URL 参数解析 ⭐⭐⭐](#310-url-参数解析-)
  - [3.11 数字转汉字 ⭐⭐](#311-数字转汉字-)
  - [3.12 循环有序数组查找 ⭐⭐⭐](#312-循环有序数组查找-)
- [四、场景应用](#四场景应用)
  - [4.1 每隔一秒打印 1234 ⭐⭐](#41-每隔一秒打印-1234-)
  - [4.2 sleep 函数 ⭐⭐⭐](#42-sleep-函数-)
  - [4.3 retry 重试函数 ⭐⭐⭐](#43-retry-重试函数-)
  - [4.4 异步任务队列 ⭐⭐⭐](#44-异步任务队列)
  - [4.5 异步并发控制 ⭐⭐⭐](#45-异步并发控制)
  - [4.6 红绿灯问题 ⭐⭐⭐](#46-红绿灯问题)
  - [4.7 setTimeout 实现 setInterval ⭐⭐⭐](#47-settimeout-实现-setinterval)
  - [4.8 Promise 加载图片 ⭐⭐](#48-promise-加载图片-)
  - [4.9 Promise.cancel 实现 ⭐⭐⭐](#49-promisecancel-实现-)
  - [4.10 循环引用检测 ⭐⭐](#410-循环引用检测-)
  - [4.11 HTML 标签校验 ⭐⭐](#411-html-标签校验-)
  - [4.12 寻找最多的连续字符 ⭐⭐⭐](#412-寻找最多的连续字符)
  - [4.13 搜索框结果匹配 ⭐⭐](#413-搜索框结果匹配-)
  - [4.14 HTML 模板替换 ⭐⭐](#414-html-模板替换-)
  - [4.15 小孩报数问题 ⭐⭐](#415-小孩报数问题-)
  - [4.16 路由实现（Hash/History）⭐⭐⭐](#416-路由实现hashhistory)
  - [4.17 虚拟 DOM Diff ⭐⭐⭐](#417-虚拟-dom-diff)
  - [4.18 Vue 懒加载指令 ⭐⭐](#418-vue-懒加载指令-)
- [五、CSS 布局](#五css-布局)
  - [5.1 三栏布局 ⭐⭐⭐](#51-三栏布局)
  - [5.2 上中下布局 ⭐⭐](#52-上中下布局-)
  - [5.3 CSS 特殊场景 ⭐⭐](#53-css-特殊场景-)
- [六、设计模式](#六设计模式)
  - [6.1 单例模式 ⭐⭐](#61-单例模式-)
- [七、面试真题](#七面试真题)
  - [7.1 字节跳动 ⭐⭐⭐](#71-字节跳动)
  - [7.2 快手 ⭐⭐⭐](#72-快手)
  - [7.3 得物 ⭐⭐⭐](#73-得物)
  - [7.4 九坤 ⭐⭐⭐](#74-九坤)
  - [7.5 云账户 ⭐⭐](#75-云账户-)
  - [7.6 IDG ⭐⭐](#76-idg-)
- [八、补充知识点](#八补充知识点)
  - [8.1 AJAX 封装 ⭐⭐⭐](#81-ajax-封装)
  - [8.2 数组乱序（洗牌算法）⭐⭐](#82-数组乱序洗牌算法)
  - [8.3 交换两个变量（不使用临时变量）⭐⭐](#83-交换两个变量不使用临时变量)
  - [8.4 获取数组总和 ⭐⭐](#84-获取数组总和-)
  - [8.5 发布订阅模式 vs 观察者模式 ⭐⭐](#85-发布订阅模式-vs-观察者模式-)
- [九、学习建议](#九学习建议)
  - [9.1 学习路径](#91-学习路径)
  - [9.2 练习建议](#92-练习建议)
  - [9.3 面试技巧](#93-面试技巧)
  - [9.4 常见问题](#94-常见问题)
- [十、参考资料](#十参考资料)
  - [10.1 在线资源](#101-在线资源)
  - [10.2 书籍推荐](#102-书籍推荐)
  - [10.3 源码学习](#103-源码学习)
  - [10.4 刷题平台](#104-刷题平台)

---

## 一、JavaScript 基础

### 1.1 Object.create 实现 ⭐⭐⭐

**考点**：原型链、构造函数

**实现思路**：
- 创建一个临时构造函数
- 将构造函数的 prototype 指向传入的对象
- 返回该构造函数的实例

```javascript
if (typeof Object.create !== 'function') {
  Object.create = function (proto) {
    // 防御
    if (typeof proto !== 'object' && typeof proto !== 'function') {
      throw new TypeError('Object prototype may only be an Object: ' + proto);
    }

    // 构造一个临时的 constructor，并让其 prototype 指向入参 proto
    function F() {}
    F.prototype = proto;

    return new F();
  }
}
```

**总结**：
- **核心思路**：创建临时构造函数，将其 prototype 指向目标对象，返回该构造函数的实例
- **关键点**：
  1. 使用中间构造函数建立原型链
  2. 新对象的 `__proto__` 指向传入的 proto
  3. 需要对参数类型进行防御性检查

---

### 1.2 new 操作符实现 ⭐⭐⭐

**考点**：new 的执行过程、this 绑定

**new 的作用**：
1. 创建一个新对象
2. 将新对象的 `__proto__` 指向构造函数的 prototype
3. 将构造函数的 this 绑定到新对象
4. 如果构造函数返回对象，则返回该对象；否则返回新对象

```javascript
function _new() {
  // 获取构造函数
  const constructor = Array.prototype.shift.call(arguments);
  
  // 防御
  if (typeof constructor !== 'function') {
    throw new TypeError('type error');
  }
  
  // 创建新对象，建立原型链
  const newObj = Object.create(constructor.prototype);
  
  // 执行构造函数，绑定 this
  const res = constructor.apply(newObj, arguments);
  
  // 判断构造函数是否有返回值
  const flag = res && (typeof res === 'object' || typeof res === 'function');
  
  // 返回结果
  return flag ? res : newObj;
}
```

**总结**：
- **核心思路**：创建新对象 → 绑定原型 → 执行构造函数 → 返回对象
- **关键点**：
  1. 使用 `Object.create` 建立原型链
  2. 使用 `apply` 绑定 this 并执行构造函数
  3. 判断构造函数返回值，如果是对象则返回该对象，否则返回新对象

---

### 1.3 instanceof 实现 ⭐⭐⭐

**考点**：原型链查找

**作用**：判断实例是否在构造函数的原型链上

```javascript
function _instanceof(obj, constructor) {
  // 获取对象的原型
  let proto = Object.getPrototypeOf(obj);
  const constructorProto = constructor.prototype;
  
  // 沿着原型链查找
  while (proto) {
    if (proto === constructorProto) return true;
    proto = Object.getPrototypeOf(proto);
  }
  
  return false;
}
```

**总结**：
- **核心思路**：沿着原型链向上查找，直到找到匹配的 prototype 或到达原型链终点
- **关键点**：
  1. 原型链的终点是 `null`
  2. 使用 `Object.getPrototypeOf()` 获取对象的原型
  3. 循环查找直到找到匹配或返回 false

---

### 1.4 call / apply / bind 实现 ⭐⭐⭐

**考点**：this 绑定、高阶函数

#### 1.4.1 call 实现

```javascript
Function.prototype._call = function(...args) {
  // 防御
  if (typeof this !== 'function') {
    throw new TypeError('call should be called by function');
  }

  // 获取 context
  const context = args.shift() || window;
  
  // 将当前函数挂载到 context 上
  context.fn = this;
  
  // 执行函数
  const result = context.fn(...args);
  
  // 删除临时属性
  delete context.fn;
  
  return result;
}
```

#### 1.4.2 apply 实现

```javascript
Function.prototype._apply = function(...args) {
  // 防御
  if (typeof this !== 'function') {
    throw new TypeError('apply should be called by function');
  }

  // 获取 context
  const context = args[0] || window;
  
  // 将当前函数挂载到 context 上
  context.fn = this;
  
  // 获取参数数组
  const params = args[1] || [];
  const result = context.fn(...params);
  
  // 删除临时属性
  delete context.fn;
  
  return result;
}
```

#### 1.4.3 bind 实现

```javascript
Function.prototype._bind = function() {
  // 防御
  if (typeof this !== 'function') {
    throw new TypeError('bind should be called by function');
  }

  // 保存原始 context 和参数
  const originalContext = arguments[0] || window;
  const originalParams = Array.prototype.slice.call(arguments, 1) || [];
  const fn = this;
  
  // 返回新函数
  function F() {
    // 合并参数
    const params = [...originalParams, ...arguments];
    
    // 判断是否为 new 调用
    const _this = this instanceof F ? this : originalContext;
    
    return fn.apply(_this, params);
  }
  
  // 维护原型关系
  const fNOP = function() {};
  fNOP.prototype = fn.prototype;
  F.prototype = new fNOP();
  
  return F;
}
```

**总结**：
- **核心思路**：将函数作为对象的临时方法，调用后删除
- **关键点**：
  1. call 和 apply 的区别在于参数传递方式（单个 vs 数组）
  2. bind 返回新函数，支持柯里化和作为构造函数使用
  3. 需要维护原型关系，处理 new 调用的情况

---

### 1.5 节流（throttle）⭐⭐⭐

**考点**：闭包、定时器

**作用**：限制函数在一定时间内只执行一次

#### 1.5.1 时间戳实现

```javascript
const throttle1 = (fn, delay = 300) => {
  let start = 0;

  return function(...args) {
    const now = Date.now();
    
    // 时间间隔小于 delay，不执行
    if (now - start < delay) return;
    
    // 执行函数
    fn && fn.apply(this, args);
    start = now;
  }
}
```

#### 1.5.2 定时器实现

```javascript
const throttle2 = (fn, delay = 300) => {
  let timer = null;

  return function(...args) {
    // 如果定时器存在，不执行
    if (timer) return;

    timer = setTimeout(() => {
      fn && fn.apply(this, args);
      clearTimeout(timer);
      timer = null;
    }, delay);
  }
}
```

**总结**：
- **核心思路**：通过时间戳或定时器控制函数执行频率
- **关键点**：
  1. 时间戳方式：第一次立即执行，通过时间差判断
  2. 定时器方式：第一次延迟执行，通过定时器状态判断
  3. 使用闭包保存状态变量

---

### 1.6 防抖（debounce）⭐⭐⭐

**考点**：闭包、定时器

**作用**：延迟执行函数，如果在延迟期间再次触发，则重新计时

```javascript
function debounce(fn, delay = 300, immediate = true) {
  let timer = null;

  return function() {
    const context = this;
    const args = arguments;
    
    // 立即执行
    if (immediate && !timer) {
      fn && fn.apply(context, args);
    }

    // 清除之前的定时器
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    // 设置新的定时器
    timer = setTimeout(function() {
      fn && fn.apply(context, args);
      clearTimeout(timer);
      timer = null;
    }, delay);
  }
}
```

**总结**：
- **核心思路**：延迟执行函数，每次触发都重新计时
- **关键点**：
  1. 每次触发都清除之前的定时器
  2. 支持立即执行模式（immediate 参数）
  3. 使用闭包保存定时器引用

---

### 1.7 节流 + 防抖结合 ⭐⭐

**考点**：综合应用

**作用**：在 delay 时间内防抖，超过 delay 必须执行

```javascript
function throttleDebounce(fn, delay) {
  let startTime = 0;
  let timer = null;

  return function(...args) {
    const context = this;
    const nowTime = Date.now();

    if (nowTime - startTime < delay) {
      // 在 delay 内，继续防抖
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn && fn.apply(context, args);  
      }, delay);
    } else {
      // 超过 delay，必须执行
      startTime = Date.now();
      fn && fn.apply(context, args);
    }
  }
}
```

**总结**：
- **核心思路**：结合节流和防抖的优点，在 delay 内防抖，超过 delay 必须执行
- **关键点**：
  1. 使用时间戳判断是否超过 delay
  2. 未超过则继续防抖
  3. 避免用户操作频繁导致长时间无响应

---

### 1.8 深拷贝（deepClone）⭐⭐⭐

**考点**：递归、类型判断、循环引用

**实现思路**：
1. 基本类型直接返回
2. 引用类型递归拷贝
3. 使用 WeakMap 解决循环引用

```javascript
const deepClone = (obj) => {
  // 使用 WeakMap 解决循环引用
  const memo = new WeakMap();

  const _deepClone = (_obj) => {
    // 基本类型直接返回
    if (typeof _obj !== 'object' || _obj === null) {
      return _obj;
    }

    // 处理 Date
    if (_obj instanceof Date) {
      return new Date(_obj);
    }

    // 处理 RegExp
    if (_obj instanceof RegExp) {
      return new RegExp(_obj);
    }

    // 处理函数
    if (typeof _obj === 'function') {
      return new Function('return ' + _obj.toString())();
    }

    // 检查循环引用
    if (memo.has(_obj)) {
      return memo.get(_obj);
    }

    // 处理 Array 和 Object
    const _newObj = Array.isArray(_obj) ? [] : {};
    memo.set(_obj, _newObj);

    for (const key in _obj) {
      if (_obj.hasOwnProperty(key)) {
        _newObj[key] = _deepClone(_obj[key]);
      }
    }

    return _newObj;
  }

  return _deepClone(obj);
}
```

**总结**：
- **核心思路**：递归拷贝所有属性，使用 WeakMap 解决循环引用
- **关键点**：
  1. 使用 WeakMap 而不是 Map，避免内存泄漏
  2. 处理多种数据类型：Date、RegExp、Function、Array、Object
  3. 递归处理嵌套对象，检查循环引用

---

### 1.9 浅拷贝（shallowCopy）⭐⭐

**考点**：浅拷贝的实现方式

**实现方式**：

**1. Object.assign**：
```javascript
const obj = { a: 1, b: { c: 2 } };
const copy = Object.assign({}, obj);
```

**2. 扩展运算符**：
```javascript
const obj = { a: 1, b: { c: 2 } };
const copy = { ...obj };
```

**3. 手动实现**：
```javascript
function shallowCopy(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const copy = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = obj[key];
    }
  }

  return copy;
}
```

**总结**：
- **核心思路**：只复制第一层属性，嵌套对象仍然是引用
- **关键点**：
  1. 可使用 Object.assign、扩展运算符或手动遍历
  2. 只复制第一层，嵌套对象仍是引用
  3. 需要使用 hasOwnProperty 过滤原型链属性

---

### 1.10 继承（extends）⭐⭐⭐

**考点**：JavaScript 继承的实现方式

#### 1.10.1 组合继承

```javascript
function SuperType(name) {
  this.name = name;
  this.colors = ["red", "blue", "green"];
}

SuperType.prototype.sayName = function() {
  console.log(this.name);
};

function SubType(name, age) {
  // 继承属性
  SuperType.call(this, name);
  this.age = age;
}

// 继承方法
SubType.prototype = new SuperType();
SubType.prototype.constructor = SubType;
```

**缺点**：父类构造函数会调用两次

#### 1.10.2 寄生组合式继承（最佳）

```javascript
function SuperType(name) {
  this.name = name;
  this.colors = ["red", "blue", "green"];
}

SuperType.prototype.sayName = function() {
  console.log(this.name);
};

function SubType(name, age) {
  // 继承属性
  SuperType.call(this, name);
  this.age = age;
}

// 继承方法
function inheritPrototype(subType, superType) {
  const prototype = Object.create(superType.prototype);
  prototype.constructor = subType;
  subType.prototype = prototype;
}

inheritPrototype(SubType, SuperType);
```

**优点**：
- 只调用一次父类构造函数
- 原型链保持不变
- 能够正常使用 instanceof 和 isPrototypeOf

**总结**：
- **核心思路**：寄生组合式继承 = 构造函数继承属性 + Object.create 继承原型
- **关键点**：
  1. 使用 call 在子类中调用父类构造函数继承属性
  2. 使用 Object.create 继承父类原型方法
  3. 修正子类 prototype 的 constructor 指向

#### 1.10.3 ES6 Class 继承

```javascript
class SuperType {
  constructor(name) {
    this.name = name;
  }

  sayName() {
    console.log(this.name);
  }
}

class SubType extends SuperType {
  constructor(name, age) {
    super(name);
    this.age = age;
  }
}
```

**关键点**：
- 子类必须在 constructor 中调用 super()
- super 可以调用父类的静态方法

---

### 1.11 Promise 实现 ⭐⭐⭐

**考点**：Promise 的核心原理

**简化版实现**：

```javascript
const STATUS = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
};

class MyPromise {
  constructor(executor) {
    this.status = STATUS.PENDING;
    this.value = null;
    this.reason = null;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.status === STATUS.PENDING) {
        this.status = STATUS.FULFILLED;
        this.value = value;
        this.onFulfilledCallbacks.forEach(fn => fn(value));
      }
    };

    const reject = (reason) => {
      if (this.status === STATUS.PENDING) {
        this.status = STATUS.REJECTED;
        this.reason = reason;
        this.onRejectedCallbacks.forEach(fn => fn(reason));
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    // 参数默认值
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason };

    const promise2 = new MyPromise((resolve, reject) => {
      if (this.status === STATUS.FULFILLED) {
        setTimeout(() => {
          try {
            const x = onFulfilled(this.value);
            resolve(x);
          } catch (error) {
            reject(error);
          }
        }, 0);
      }

      if (this.status === STATUS.REJECTED) {
        setTimeout(() => {
          try {
            const x = onRejected(this.reason);
            resolve(x);
          } catch (error) {
            reject(error);
          }
        }, 0);
      }

      if (this.status === STATUS.PENDING) {
        this.onFulfilledCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onFulfilled(this.value);
              resolve(x);
            } catch (error) {
              reject(error);
            }
          }, 0);
        });

        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onRejected(this.reason);
              resolve(x);
            } catch (error) {
              reject(error);
            }
          }, 0);
        });
      }
    });

    return promise2;
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  static resolve(value) {
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((resolve, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let count = 0;

      promises.forEach((promise, index) => {
        Promise.resolve(promise).then(value => {
          results[index] = value;
          count++;
          if (count === promises.length) {
            resolve(results);
          }
        }, reject);
      });
    });
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(promise => {
        Promise.resolve(promise).then(resolve, reject);
      });
    });
  }
}
```

**总结**：
- **核心思路**：三种状态 + 回调队列 + then 链式调用
- **关键点**：
  1. 状态只能从 pending 转换，且不可逆
  2. then 方法返回新的 Promise 支持链式调用
  3. 使用回调队列处理异步情况

---

### 1.12 typeof 实现 ⭐⭐

**考点**：类型判断的实现

```javascript
function myTypeof(value) {
  // null 特殊处理
  if (value === null) {
    return 'null';
  }

  // 基本类型
  const type = typeof value;
  if (type !== 'object') {
    return type;
  }

  // 引用类型
  const typeString = Object.prototype.toString.call(value);
  const typeMap = {
    '[object Object]': 'object',
    '[object Array]': 'array',
    '[object Date]': 'date',
    '[object RegExp]': 'regexp',
    '[object Function]': 'function',
    '[object Map]': 'map',
    '[object Set]': 'set'
  };

  return typeMap[typeString] || 'object';
}
```

**总结**：
- **核心思路**：使用 Object.prototype.toString 精确判断类型
- **关键点**：
  1. null 需要特殊处理
  2. 基本类型直接用 typeof
  3. 引用类型用 Object.prototype.toString.call()

---

### 1.13 元编程（Proxy & Reflect）⭐⭐⭐

**考点**：Proxy、Reflect、元编程

**作用**：拦截和自定义对象的基本操作

#### 1.13.1 Proxy 基本使用

```javascript
const target = {
  name: 'John',
  age: 30
};

const handler = {
  // 拦截属性读取
  get(target, prop, receiver) {
    console.log(`读取属性: ${prop}`);
    return Reflect.get(target, prop, receiver);
  },
  
  // 拦截属性设置
  set(target, prop, value, receiver) {
    console.log(`设置属性: ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
  
  // 拦截 in 操作符
  has(target, prop) {
    console.log(`检查属性: ${prop}`);
    return Reflect.has(target, prop);
  },
  
  // 拦截 delete 操作
  deleteProperty(target, prop) {
    console.log(`删除属性: ${prop}`);
    return Reflect.deleteProperty(target, prop);
  }
};

const proxy = new Proxy(target, handler);

proxy.name; // 读取属性: name
proxy.age = 31; // 设置属性: age = 31
'name' in proxy; // 检查属性: name
delete proxy.age; // 删除属性: age
```

#### 1.13.2 实现响应式数据（Vue 3 原理）

```javascript
function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      // 依赖收集
      track(target, key);
      const result = Reflect.get(target, key, receiver);
      
      // 如果是对象，递归代理
      if (typeof result === 'object' && result !== null) {
        return reactive(result);
      }
      
      return result;
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      
      // 触发更新
      if (oldValue !== value) {
        trigger(target, key);
      }
      
      return result;
    }
  };
  
  return new Proxy(target, handler);
}

// 依赖收集和触发更新的简化实现
const targetMap = new WeakMap();
let activeEffect = null;

function track(target, key) {
  if (!activeEffect) return;
  
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  
  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }
  
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => effect());
  }
}

function effect(fn) {
  activeEffect = fn;
  fn();
  activeEffect = null;
}
```

**使用示例**：
```javascript
const state = reactive({
  count: 0,
  user: {
    name: 'Alice'
  }
});

effect(() => {
  console.log('count:', state.count);
});

state.count++; // 自动触发 effect，输出: count: 1
```

#### 1.13.3 Object.defineProperty 实现响应式（Vue 2 原理）

```javascript
function defineReactive(obj, key, value) {
  const dep = [];
  
  Object.defineProperty(obj, key, {
    get() {
      // 依赖收集
      if (activeEffect) {
        dep.push(activeEffect);
      }
      return value;
    },
    set(newValue) {
      if (newValue === value) return;
      value = newValue;
      
      // 触发更新
      dep.forEach(effect => effect());
    }
  });
}

function observe(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  
  Object.keys(obj).forEach(key => {
    defineReactive(obj, key, obj[key]);
  });
}
```

**Proxy vs Object.defineProperty**：
- Proxy 可以拦截更多操作（13 种）
- Proxy 可以监听数组变化，无需重写数组方法
- Proxy 是懒代理，性能更好
- Object.defineProperty 兼容性更好

**总结**：
- **核心思路**：Proxy 拦截对象操作，Reflect 执行默认行为
- **关键点**：
  1. Proxy 可以拦截 get、set、has、deleteProperty 等 13 种操作
  2. 配合 Reflect 实现响应式数据（Vue 3 原理）
  3. 需要递归代理嵌套对象

---

## 二、函数式编程

### 2.1 函数柯里化（curry）⭐⭐⭐

**考点**：函数柯里化的实现

**作用**：将多参数函数转换为单参数函数的序列

**实现**：

```javascript
function curry(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('curry need function to be params');
  }

  const needArgsLength = fn.length;
  const originalArgs = Array.prototype.slice.call(arguments, 1);

  return function() {
    const combineArgs = originalArgs.concat(Array.prototype.slice.call(arguments));

    if (combineArgs.length >= needArgsLength) {
      return fn.apply(this, combineArgs);
    }

    return curry.call(this, fn, ...combineArgs);
  };
}

// ES6 实现
const curryES6 = (fn, ...args) => {
  if (args.length >= fn.length) {
    return fn(...args);
  }

  return curryES6.bind(null, fn, ...args);
};
```

**使用示例**：
```javascript
const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

curriedAdd(1, 2, 3); // 6
curriedAdd(1)(2)(3); // 6
curriedAdd(1, 2)(3); // 6
```

**总结**：
- **核心思路**：利用闭包保存参数，递归调用直到参数足够
- **关键点**：
  1. 判断已收集的参数是否达到函数所需参数个数
  2. 使用闭包保存已收集的参数
  3. 递归返回新函数继续收集参数

---

### 2.2 函数组合（compose）⭐⭐⭐

**考点**：函数组合的实现

**作用**：将多个函数组合成一个函数，从右向左执行

**实现**：

```javascript
const compose = (...fnList) => {
  const startIndex = fnList.length - 1;

  return function(...args) {
    let i = startIndex;
    let result = fnList[i](...args);

    while (i--) {
      result = fnList[i](result);
    }

    return result;
  };
};

// 使用 reduce 实现
const composeReduce = (...fns) => {
  return fns.reduce((a, b) => (...args) => a(b(...args)));
};
```

**使用示例**：
```javascript
const add = (x) => x + 1;
const multiply = (x) => x * 2;
const subtract = (x) => x - 3;

const calculate = compose(subtract, multiply, add);
calculate(5); // (5 + 1) * 2 - 3 = 9
```

**总结**：
- **核心思路**：从右向左依次执行函数，前一个函数的返回值作为后一个函数的参数
- **关键点**：
  1. 从右向左执行（与数学中的函数组合一致）
  2. 每个函数的返回值作为下一个函数的参数
  3. 可以使用 reduce 简化实现

---

### 2.3 偏函数（partial）⭐⭐

**考点**：偏函数的实现

**作用**：固定函数的部分参数，返回一个新函数

**实现**：

```javascript
function partial(fn, ...fixedArgs) {
  return function(...remainingArgs) {
    return fn.apply(this, fixedArgs.concat(remainingArgs));
  };
}
```

**使用示例**：
```javascript
const add = (a, b, c) => a + b + c;
const add5 = partial(add, 5);

add5(10, 15); // 30
```

---

### 2.4 AOP 面向切面编程 ⭐⭐

**考点**：AOP 的实现

**作用**：在函数执行前后插入逻辑

**实现**：

```javascript
Function.prototype.before = function(beforeFn) {
  const self = this;
  return function() {
    beforeFn.apply(this, arguments);
    return self.apply(this, arguments);
  };
};

Function.prototype.after = function(afterFn) {
  const self = this;
  return function() {
    const result = self.apply(this, arguments);
    afterFn.apply(this, arguments);
    return result;
  };
};
```

**使用示例**：
```javascript
const func = function() {
  console.log('执行核心逻辑');
};

const newFunc = func
  .before(() => console.log('执行前'))
  .after(() => console.log('执行后'));

newFunc();
// 执行前
// 执行核心逻辑
// 执行后
```

---

### 2.5 惰性函数（lazyCall）⭐⭐

**考点**：惰性函数的实现

**作用**：函数第一次执行后，重写自身，避免重复判断

**实现**：

```javascript
function addEvent(element, type, handler) {
  if (element.addEventListener) {
    addEvent = function(element, type, handler) {
      element.addEventListener(type, handler, false);
    };
  } else if (element.attachEvent) {
    addEvent = function(element, type, handler) {
      element.attachEvent('on' + type, handler);
    };
  }

  addEvent(element, type, handler);
}
```

---

### 2.6 记忆函数（memoize）⭐⭐⭐

**考点**：函数记忆化

**作用**：缓存函数的计算结果

**实现**：

```javascript
function memoize(fn) {
  const cache = new Map();

  return function(...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
```

**使用示例**：
```javascript
const fibonacci = memoize(function(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
});

fibonacci(40); // 快速计算
```

---

## 三、数据处理

### 3.1 数组扁平化（flat）⭐⭐⭐

**考点**：递归、数组方法

#### 2.1.1 递归实现

```javascript
const flat1 = (arr) => {
  let result = [];

  for (const item of arr) {
    result = result.concat(
      Array.isArray(item) ? flat1(item) : item
    );
  }

  return result;
}
```

#### 2.1.2 reduce 实现

```javascript
const flat2 = (arr) => {
  return arr.reduce((pre, cur) => {
    return Array.isArray(cur) 
      ? pre.concat(flat2(cur)) 
      : pre.concat(cur);
  }, []);
}
```

#### 2.1.3 toString 实现

```javascript
const flat3 = (arr) => {
  return arr.toString().split(',').map(item => +item);
}
```

**总结**：
- **核心思路**：递归处理嵌套数组，将所有元素展开到一维数组
- **关键点**：
  1. 递归处理嵌套数组
  2. reduce 方法更简洁
  3. toString 方法有局限性（只适用于数字数组）

---

### 3.2 数组去重（unique）⭐⭐⭐

**考点**：Set、Map、对象

#### 2.2.1 Set 实现

```javascript
const uniqueArray1 = (arr) => {
  return Array.from(new Set(arr));
}
```

#### 2.2.2 Map 实现

```javascript
const uniqueArray2 = (arr) => {
  const map = new Map();
  const res = [];

  for (const item of arr) {
    if (map.has(item)) continue;
    res.push(item);
    map.set(item, true);
  }

  return res;
}
```

**总结**：
- **核心思路**：使用 Set 或 Map 记录已出现的元素
- **关键点**：
  1. Set 是最简洁的方式
  2. Map 可以处理更复杂的去重逻辑
  3. 注意对象和 NaN 的去重处理

---

### 3.3 扁平对象转树（flatObj2Tree）⭐⭐⭐

**考点**：数据结构转换、Map

**实现思路**：
1. 构建 id -> item 的映射表
2. 遍历数组，根据 pid 找到父节点
3. 将当前节点添加到父节点的 children 中

```javascript
const flatObj2Tree = (data) => {
  const result = [];
  const id2Objmap = new Map();

  // 构建映射表
  for (const item of data) {
    const { id, pid } = item;

    // 处理当前节点
    if (!id2Objmap.has(id)) {
      id2Objmap.set(id, item);
    } else {
      id2Objmap.set(id, { ...item, ...id2Objmap.get(id) });
    }

    // 处理根节点
    if (pid === null) {
      delete item.pid;
      result.push(item);
      continue;
    }

    // 处理非根节点
    if (!id2Objmap.has(pid)) {
      id2Objmap.set(pid, {});
    }

    const parentItem = id2Objmap.get(pid);
    if (!parentItem.children) {
      parentItem.children = [];
    }

    delete item.pid;
    parentItem.children.push(item);
  }

  return result;
}
```

**总结**：
- **核心思路**：使用 Map 构建 id 到节点的映射，一次遍历完成转换
- **关键点**：
  1. 使用 Map 构建 id -> item 的映射表
  2. 根据 pid 找到父节点，添加到父节点的 children 中
  3. 处理根节点（pid 为 null）和非根节点

---

### 3.4 树转扁平对象（treeFlat）⭐⭐⭐

**考点**：树结构的扁平化

**实现思路**：递归遍历树，删除 children 属性

**方法一：递归实现**：

```javascript
const flatTree = (tree) => {
  let result = [];

  for (const item of tree) {
    if (item.children && item.children.length) {
      result = result.concat(flatTree(item.children));
    }

    delete item.children;
    result.push(item);
  }

  return result;
}
```

**方法二：reduce 实现**：

```javascript
const flatTree = (tree) => {
  return tree.reduce((lastRes, item) => {
    const { children = [], ...otherItem } = item;
    return lastRes.concat(
      otherItem,
      children && children.length ? flatTree(children) : []
    );
  }, []);
}
```

**测试**：
```javascript
const tree = [
  {
    id: 1,
    name: '1',
    pid: 0,
    children: [
      { id: 2, name: '2', pid: 1, children: [] },
      {
        id: 3,
        name: '3',
        pid: 1,
        children: [
          { id: 4, name: '4', pid: 3, children: [] }
        ]
      }
    ]
  }
];

flatTree(tree);
// [
//   { id: 1, name: '1', pid: 0 },
//   { id: 2, name: '2', pid: 1 },
//   { id: 3, name: '3', pid: 1 },
//   { id: 4, name: '4', pid: 3 }
// ]
```

---

### 3.5 lodash.get 实现 ⭐⭐

**考点**：字符串处理、递归

**作用**：根据路径获取对象属性值

```javascript
const myGet = (source, path, defaultValue = undefined) => {
  // 格式化 path: a[3].b -> a.3.b -> [a,3,b]
  const keyList = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let res = source;

  for (const key of keyList) {
    res = res && res[key];

    if (!res) {
      return defaultValue;
    }
  }

  return res;
}
```

**使用示例**：
```javascript
const source = {
  a: [0, 1, 2, { b: 5 }]
};

myGet(source, 'a[3].b'); // 5
myGet(source, 'a[5].b'); // undefined
```

**关键点**：
- 使用正则处理数组索引
- 递归访问嵌套属性
- 支持默认值

---

### 3.6 数组 API 实现 ⭐⭐⭐

**考点**：数组常用方法的实现

#### 3.6.1 Array.prototype.map

```javascript
Array.prototype.myMap = function(callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }

  const result = [];
  const arr = this;

  for (let i = 0; i < arr.length; i++) {
    result.push(callback.call(thisArg, arr[i], i, arr));
  }

  return result;
};
```

#### 3.6.2 Array.prototype.filter

```javascript
Array.prototype.myFilter = function(callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }

  const result = [];
  const arr = this;

  for (let i = 0; i < arr.length; i++) {
    if (callback.call(thisArg, arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }

  return result;
};
```

#### 3.6.3 Array.prototype.reduce

```javascript
Array.prototype.myReduce = function(callback, initialValue) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }

  const arr = this;
  let accumulator = initialValue !== undefined ? initialValue : arr[0];
  const startIndex = initialValue !== undefined ? 0 : 1;

  for (let i = startIndex; i < arr.length; i++) {
    accumulator = callback(accumulator, arr[i], i, arr);
  }

  return accumulator;
};
```

#### 3.6.4 Array.prototype.push

```javascript
Array.prototype.myPush = function(...items) {
  const arr = this;
  const len = arr.length;

  for (let i = 0; i < items.length; i++) {
    arr[len + i] = items[i];
  }

  return arr.length;
};
```

---

### 3.7 日期格式化 ⭐⭐

**考点**：日期处理

```javascript
function dateFormat(date, format = 'yyyy/MM/dd') {
  if (!date) return '';
  if (Object.prototype.toString.call(date) !== '[object Date]') return '';

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return format
    .replace(/yyyy/, year)
    .replace(/MM/, month < 10 ? '0' + month : month)
    .replace(/dd/, day < 10 ? '0' + day : day);
}
```

**使用示例**：
```javascript
dateFormat(new Date('2020-12-01'), 'yyyy/MM/dd'); // 2020/12/01
dateFormat(new Date('2020-04-01'), 'yyyy年MM月dd日'); // 2020年04月01日
```

---

### 3.8 数字千分位分隔 ⭐⭐

**考点**：正则表达式、字符串处理

**实现**：

```javascript
function splitWithDot(num) {
  const numStr = num.toString();

  // 有小数点
  if (/\./.test(numStr)) {
    return numStr.replace(/(?!^)(?=(\d{3})+\.)/g, ',');
  }

  // 无小数点
  return numStr.replace(/(?!^)(?=(\d{3})+$)/g, ',');
}
```

**使用示例**：
```javascript
splitWithDot(12345678.12345); // 12,345,678.12345
splitWithDot(12345678); // 12,345,678
```

**关键点**：
- 使用正则的正向预查 `(?=pattern)`
- 区分整数和小数的处理

---

### 3.9 大数相加 ⭐⭐⭐

**考点**：大数运算、字符串处理

**实现**：

```javascript
function bigNumSum(numStr1, numStr2) {
  if (typeof numStr1 !== 'string' || typeof numStr2 !== 'string') {
    throw new TypeError('入参必须是字符串');
  }

  // 逆序，从个位开始加
  const num1Arr = numStr1.split('').reverse();
  const num2Arr = numStr2.split('').reverse();

  const result = [];
  const maxLen = Math.max(num1Arr.length, num2Arr.length);
  let carry = 0; // 进位

  for (let i = 0; i < maxLen; i++) {
    const n1 = num1Arr[i] ? +num1Arr[i] : 0;
    const n2 = num2Arr[i] ? +num2Arr[i] : 0;
    const sum = n1 + n2 + carry;

    result[i] = sum % 10;
    carry = sum > 9 ? 1 : 0;
  }

  // 最高位还有进位
  if (carry) {
    result.push(carry);
  }

  return result.reverse().join('');
}
```

**使用示例**：
```javascript
bigNumSum('13132132132199', '9'); // '13132132132208'
```

**关键点**：
- 使用字符串避免精度丢失
- 从个位开始逐位相加
- 处理进位

---

### 3.10 URL 参数解析 ⭐⭐⭐

**考点**：字符串处理、URL 解析

**实现**：

```javascript
function parseParam(url) {
  const resObj = {};
  const query = url.split('?')[1];

  if (!query) return resObj;

  const queryList = query.split('&');

  for (let item of queryList) {
    const [key, val] = item.split('=');
    let value = val ? decodeURIComponent(val) : true;

    // 转换数字类型
    if (/^\d+$/.test(value)) {
      value = +value;
    }

    // 处理重复的 key
    if (resObj.hasOwnProperty(key)) {
      resObj[key] = [].concat(resObj[key], value);
    } else {
      resObj[key] = value;
    }
  }

  return resObj;
}
```

**使用示例**：
```javascript
const url = 'http://www.domain.com/?user=anonymous&id=123&id=456&city=%E5%8C%97%E4%BA%AC&enabled';
parseParam(url);
// {
//   user: 'anonymous',
//   id: [123, 456],
//   city: '北京',
//   enabled: true
// }
```

**关键点**：
- 使用 decodeURIComponent 解码
- 处理重复参数
- 类型转换

---

### 3.11 数字转汉字 ⭐⭐

**考点**：数字转换、算法

**实现**：

```javascript
function num2hanzi(num) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千', '万', '十万', '百万', '千万', '亿'];

  if (num === 0) return digits[0];

  let result = '';
  let unitIndex = 0;

  while (num > 0) {
    const digit = num % 10;

    if (digit !== 0) {
      result = digits[digit] + units[unitIndex] + result;
    } else if (result && result[0] !== '零') {
      result = digits[0] + result;
    }

    num = Math.floor(num / 10);
    unitIndex++;
  }

  return result;
}
```

---

### 3.12 循环有序数组查找 ⭐⭐⭐

**考点**：二分查找、旋转数组

**题目**：在一个循环有序的列表中查找指定的值。比如 `[6,7,8,1,2,3,4,5]` 就是一个循环有序数组。

#### 3.12.1 暴力解法

```javascript
function searchInRotatedArray(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) {
      return i;
    }
  }
  return -1;
}
```

**时间复杂度**：O(n)

#### 3.12.2 二分查找优化

```javascript
function searchInRotatedArray(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    }

    // 判断哪一半是有序的
    if (arr[left] <= arr[mid]) {
      // 左半部分有序
      if (target >= arr[left] && target < arr[mid]) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    } else {
      // 右半部分有序
      if (target > arr[mid] && target <= arr[right]) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  return -1;
}
```

**使用示例**：
```javascript
const arr = [6, 7, 8, 1, 2, 3, 4, 5];
searchInRotatedArray(arr, 3); // 5
searchInRotatedArray(arr, 8); // 2
searchInRotatedArray(arr, 10); // -1
```

**时间复杂度**：O(log n)

**关键点**：
- 旋转数组至少有一半是有序的
- 判断 target 在有序的那一半还是无序的那一半
- 根据判断结果调整搜索范围

---

## 四、场景应用

### 4.1 每隔一秒打印 1234 ⭐⭐

**考点**：闭包、块级作用域

#### 3.1.1 闭包实现

```javascript
const test1 = () => {
  for (var i = 1; i < 5; i++) {
    ((ii) => {
      setTimeout(() => {
        console.log(ii);
      }, 1000 * ii);
    })(i);
  }
}
```

#### 3.1.2 let 实现

```javascript
const test2 = () => {
  for (let i = 1; i < 5; i++) {
    setTimeout(() => {
      console.log(i);
    }, 1000 * i);
  }
}
```

**总结**：
- **核心思路**：使用闭包或 let 块级作用域保存每次循环的变量
- **关键点**：
  1. var 没有块级作用域，需要闭包保存变量
  2. let 为每次循环创建独立的块级作用域
  3. 理解闭包和作用域的区别

---

### 4.2 sleep 函数 ⭐⭐⭐

**考点**：Promise、async/await

**作用**：延迟执行

```javascript
const sleep = (delay = 0) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

// 使用示例
const log = async () => {
  for (let i = 0; i <= 10; i += 2) {
    await sleep(1000);
    console.log(i);
  }
}

log();
```

**总结**：
- **核心思路**：返回一个 Promise，在 setTimeout 中 resolve
- **关键点**：
  1. 返回 Promise 对象
  2. 使用 setTimeout 实现延迟
  3. 配合 async/await 使用更优雅

---

### 4.3 retry 重试函数 ⭐⭐⭐

**考点**：Promise、递归

**作用**：失败后自动重试

```javascript
const retry = (fn) => {
  return new Promise((resolve, reject) => {
    const _retry = () => {
      fn()
        .then(res => resolve(res))
        .catch(err => _retry());
    }

    _retry();
  })
}

// 使用示例
const fnCreator = (params) => () => {
  return fetch(params);
}

const fn = fnCreator(params);
retry(fn);
```

**总结**：
- **核心思路**：递归调用，失败后继续重试
- **关键点**：
  1. 使用递归实现重试逻辑
  2. 可以添加最大重试次数限制
  3. 可以添加延迟重试功能

---

### 4.4 异步任务队列 ⭐⭐⭐

**考点**：Promise、队列

**题目**：实现一个 arrange 函数，可以进行时间和工作调度

```javascript
function Arrange(name) {
  this.name = name || '';
  this.taskQueue = [
    () => new Promise((resolve) => {
      console.log(`${name} is notified`);
      resolve();
    })
  ];
}

Arrange.prototype._addTask = function(task) {
  this.taskQueue.push(task);
}

Arrange.prototype._addFirstTask = function(task) {
  this.taskQueue.unshift(task);
}

Arrange.prototype.do = function(command) {
  this._addTask(() => new Promise(resolve => {
    console.log('Start to', command);
    resolve();
  }));

  return this;
}

Arrange.prototype.wait = function(delay = 0) {
  this._addTask(() => new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, delay * 1000);
  }));

  return this;
}

Arrange.prototype.waitFirst = function(delay = 0) {
  this._addFirstTask(() => new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, delay * 1000);
  }));

  return this;
}

Arrange.prototype.execute = function() {
  this._run();
  return this;
}

Arrange.prototype._run = function() {
  if (this.taskQueue.length === 0) return;
  
  const task = this.taskQueue.shift();

  task().then(() => {
    this._run();
  }).catch(() => {
    this._run();
  });
}

function arrange(name) {
  return new Arrange(name);
}
```

**使用示例**：
```javascript
arrange('William').execute();
// > William is notified

arrange('William').do('commit').execute();
// > William is notified
// > Start to commit

arrange('William').wait(5).do('commit').execute();
// > William is notified
// 等待 5 秒
// > Start to commit

arrange('William').waitFirst(5).do('push').execute();
// 等待 5 秒
// > William is notified
// > Start to push
```

**总结**：
- **核心思路**：使用队列管理任务，支持链式调用和延迟执行
- **关键点**：
  1. 使用队列管理任务
  2. 支持链式调用（返回 this）
  3. 支持延迟执行（wait、waitFirst）
  4. 递归执行队列中的任务

---

### 4.5 异步并发控制 ⭐⭐⭐

**考点**：Promise、并发控制

**题目**：实现一个异步任务调度器，最多同时执行 limit 个任务

#### 4.5.1 基础版本

```javascript
class Scheduler {
  constructor(limit) {
    this.limit = limit;
    this.queue = [];
    this.running = 0;
  }

  add(promiseCreator) {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        promiseCreator()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.running--;
            this.run();
          });
      });

      this.run();
    });
  }

  run() {
    while (this.running < this.limit && this.queue.length) {
      const task = this.queue.shift();
      this.running++;
      task();
    }
  }
}
```

**使用示例**：
```javascript
const scheduler = new Scheduler(2);

const timeout = (time) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

const addTask = (time, order) => {
  scheduler.add(() => timeout(time)).then(() => console.log(order));
};

addTask(1000, '1');
addTask(500, '2');
addTask(300, '3');
addTask(400, '4');

// 输出顺序：2 3 1 4
```

#### 4.5.2 高级版本（带状态机和结果收集）

```javascript
const STATUS = {
  NOT_START: 'notStart',
  RUNNING: 'running',
  STOPPED: 'stopped'
};

class AdvancedScheduler {
  constructor(maxRunningCount = 1) {
    this.maxRunningCount = maxRunningCount;
    this.taskQueue = [];
    this.taskCount = 0;
    this.endTaskCount = 0;
    this.isStop = false;
    this.results = [];
    this.status = STATUS.NOT_START;
    
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  /**
   * 注册任务
   * @param {Function} task 返回 Promise 的函数
   */
  register(task) {
    // 只有在未开始状态下才能添加任务
    if (this.status !== STATUS.NOT_START) {
      console.warn('调度器已启动，无法添加新任务');
      return;
    }

    this.taskCount++;
    this.taskQueue.push({
      task,
      index: this.taskQueue.length
    });
  }

  /**
   * 执行单个任务
   */
  _runTask() {
    // 判断是否应该继续执行
    if (!this._shouldRun()) {
      return;
    }

    const { task, index } = this.taskQueue.shift();

    task()
      .then(res => {
        this.results[index] = {
          status: 'fulfilled',
          value: res
        };
        this.endTaskCount++;

        if (this._isFinished()) {
          this.status = STATUS.STOPPED;
          this.resolve(this.results);
          return;
        }

        this._runTask();
      })
      .catch(err => {
        this.results[index] = {
          status: 'rejected',
          error: err
        };
        this.endTaskCount++;

        if (this._isFinished()) {
          this.status = STATUS.STOPPED;
          this.resolve(this.results);
          return;
        }

        this._runTask();
      });
  }

  /**
   * 启动调度器
   */
  run() {
    if (this.status !== STATUS.NOT_START) {
      console.warn('调度器已启动');
      return;
    }

    this.status = STATUS.RUNNING;

    if (!this._shouldRun()) {
      return;
    }

    // 启动最大并发数的任务
    let count = Math.min(this.maxRunningCount, this.taskQueue.length);
    while (count > 0) {
      this._runTask();
      count--;
    }
  }

  /**
   * 停止调度器
   */
  stop() {
    this.isStop = true;
    this.status = STATUS.STOPPED;
  }

  /**
   * 判断是否应该继续执行
   */
  _shouldRun() {
    return this.taskQueue.length > 0 && !this.isStop;
  }

  /**
   * 判断是否所有任务都已完成
   */
  _isFinished() {
    return this.taskCount === this.endTaskCount;
  }

  /**
   * 获取所有任务的执行结果
   */
  async getResults() {
    return this.promise;
  }
}
```

**使用示例**：
```javascript
const scheduler = new AdvancedScheduler(2);

// 注册任务
scheduler.register(() => {
  return new Promise(resolve => {
    setTimeout(() => resolve('Task 1'), 1000);
  });
});

scheduler.register(() => {
  return new Promise(resolve => {
    setTimeout(() => resolve('Task 2'), 500);
  });
});

scheduler.register(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject('Task 3 failed'), 300);
  });
});

// 启动调度器
scheduler.run();

// 获取结果
scheduler.getResults().then(results => {
  console.log(results);
  // [
  //   { status: 'fulfilled', value: 'Task 1' },
  //   { status: 'fulfilled', value: 'Task 2' },
  //   { status: 'rejected', error: 'Task 3 failed' }
  // ]
});
```

**总结**：
- **核心思路**：维护运行中任务数量，达到上限时暂停，有任务完成时继续执行
- **关键点**：
  1. 使用队列存储待执行任务
  2. 维护当前运行任务数量
  3. 任务完成后自动执行下一个任务
  4. 高级版支持状态机、结果收集和错误处理

---

### 4.6 红绿灯问题 ⭐⭐⭐

**考点**：Promise、async/await

**题目**：红灯 3 秒亮一次，绿灯 1 秒亮一次，黄灯 2 秒亮一次，如何让三个灯不断交替重复亮灯？

**实现**：

```javascript
function red() {
  console.log('red');
}

function green() {
  console.log('green');
}

function yellow() {
  console.log('yellow');
}

function light(timer, cb) {
  return new Promise((resolve) => {
    setTimeout(() => {
      cb();
      resolve();
    }, timer);
  });
}

async function step() {
  await light(3000, red);
  await light(2000, green);
  await light(1000, yellow);
  step(); // 递归调用
}

step();
```

**总结**：
- **核心思路**：使用 async/await 控制异步流程，递归调用实现循环
- **关键点**：
  1. 使用 Promise 包装定时器
  2. async/await 控制执行顺序
  3. 递归调用实现无限循环

---

### 4.7 setTimeout 实现 setInterval ⭐⭐⭐

**考点**：定时器、递归

**原因**：setInterval 的问题
- 可能会导致任务堆积
- 无法保证执行间隔

**实现**：

```javascript
function mySetInterval(callback, delay) {
  const timer = {
    enable: true
  };

  const interval = () => {
    if (timer.enable) {
      callback && callback();
      setTimeout(interval, delay);
    }
  };

  setTimeout(interval, delay);

  return timer;
}

// 使用
const timer = mySetInterval(() => {
  console.log('执行');
}, 1000);

// 停止
timer.enable = false;
```

**总结**：
- **核心思路**：使用递归调用 setTimeout，避免 setInterval 的任务堆积问题
- **关键点**：
  1. setInterval 可能导致任务堆积
  2. 使用递归 setTimeout 保证执行间隔
  3. 返回控制对象用于停止执行

---

### 4.8 Promise 加载图片 ⭐⭐

**考点**：Promise、图片加载

**实现**：

```javascript
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };

    img.src = url;
  });
}
```

**使用示例**：
```javascript
loadImage('https://example.com/image.jpg')
  .then(img => {
    document.body.appendChild(img);
  })
  .catch(err => {
    console.error(err);
  });
```

**总结**：
- **核心思路**：使用 Promise 包装图片加载事件
- **关键点**：
  1. 监听 onload 和 onerror 事件
  2. 在事件回调中 resolve 或 reject
  3. 设置 img.src 触发加载

---

### 4.9 Promise.cancel 实现 ⭐⭐⭐

**考点**：Promise、取消机制

**实现**：

```javascript
function cancelablePromise(promiseCreator) {
  let cancel;

  const wrappedPromise = new Promise((resolve, reject) => {
    cancel = () => {
      reject(new Error('Promise cancelled'));
    };

    promiseCreator()
      .then(resolve)
      .catch(reject);
  });

  return {
    promise: wrappedPromise,
    cancel
  };
}
```

**使用示例**：
```javascript
const { promise, cancel } = cancelablePromise(() => {
  return fetch('https://api.example.com/data');
});

promise
  .then(data => console.log(data))
  .catch(err => console.error(err));

// 取消请求
cancel();
```

**总结**：
- **核心思路**：包装 Promise，提供 cancel 方法主动 reject
- **关键点**：
  1. 返回包装后的 Promise 和 cancel 方法
  2. cancel 方法调用 reject
  3. 原 Promise 仍会执行，只是不处理结果

---

### 4.10 循环引用检测 ⭐⭐

**考点**：对象遍历、循环引用

**实现**：

```javascript
function isCycleObject(obj, parent = []) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === 'object' && value !== null) {
        // 检查是否已经遍历过
        if (parent.includes(value)) {
          return true;
        }

        // 递归检查
        if (isCycleObject(value, [...parent, value])) {
          return true;
        }
      }
    }
  }

  return false;
}
```

**使用示例**：
```javascript
const a = { b: 1 };
const b = { a };
a.b = b;

isCycleObject(a); // true
```

**总结**：
- **核心思路**：递归遍历对象，使用数组记录已访问的对象
- **关键点**：
  1. 使用数组记录遍历路径
  2. 检查当前对象是否在路径中
  3. 递归检查嵌套对象

---

### 4.11 HTML 标签校验 ⭐⭐

**考点**：正则表达式、回溯引用

**实现**：

```javascript
function isValidHtmlTag(str) {
  // 使用回溯引用 \1 匹配开始标签
  return /<([^>]+)>[^<|>]*<\/\1>/g.test(str);
}
```

**使用示例**：
```javascript
isValidHtmlTag('<div>123</div>'); // true
isValidHtmlTag('<div>123</d>'); // false
isValidHtmlTag('<div>123></div>'); // false
```

**总结**：
- **核心思路**：使用正则表达式的回溯引用匹配开始和结束标签
- **关键点**：
  1. 使用 `\1` 回溯引用匹配相同的标签名
  2. 正则表达式：`/<([^>]+)>[^<|>]*<\/\1>/`
  3. 只能匹配简单的标签结构

---

### 4.12 寻找最多的连续字符 ⭐⭐⭐

**考点**：双指针、字符串处理

**题目**：找出字符串中连续重复出现次数最多的字符

**实现**：

```javascript
function findMaxCountChar(s) {
  const result = {
    maxCountChar: '',
    maxCount: 0
  };

  const len = s.length;
  let slowIndex = 0;
  let fastIndex = 1;

  while (fastIndex < len) {
    // 字符不一致，说明到了一段重复字符的末尾
    if (s[slowIndex] !== s[fastIndex]) {
      const repeatCount = fastIndex - slowIndex;

      if (result.maxCount < repeatCount) {
        result.maxCountChar = s[slowIndex];
        result.maxCount = repeatCount;
      }

      slowIndex = fastIndex;
    }

    fastIndex++;
  }

  // 处理最后一段
  const repeatCount = fastIndex - slowIndex;
  if (result.maxCount < repeatCount) {
    result.maxCountChar = s[slowIndex];
    result.maxCount = repeatCount;
  }

  return result.maxCountChar === '' ? undefined : result;
}
```

**使用示例**：
```javascript
findMaxCountChar('aaaabbbbbcccccccccccccdddddd');
// { maxCountChar: 'c', maxCount: 13 }
```

**关键点**：
- 使用快慢指针
- 记录当前最大值

**总结**：
- **核心思路**：使用快慢指针遍历字符串，记录最大重复次数
- **关键点**：
  1. 使用快慢指针标记重复字符的起止位置
  2. 字符不一致时计算重复次数
  3. 记录最大值和对应字符

---

### 4.13 搜索框结果匹配 ⭐⭐

**考点**：防抖、异步处理

**实现**：

```javascript
function searchMatch(keyword, dataSource) {
  return dataSource.filter(item => {
    return item.toLowerCase().includes(keyword.toLowerCase());
  });
}

// 配合防抖使用
const debouncedSearch = debounce((keyword, dataSource, callback) => {
  const results = searchMatch(keyword, dataSource);
  callback(results);
}, 300);
```

**总结**：
- **核心思路**：使用 filter 和 includes 进行模糊匹配，配合防抖优化性能
- **关键点**：
  1. 使用 toLowerCase 实现不区分大小写
  2. 配合防抖避免频繁搜索
  3. 可以扩展支持拼音搜索等高级功能

---

### 4.14 HTML 模板替换 ⭐⭐

**考点**：正则表达式、字符串替换

**实现**：

```javascript
function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : '';
  });
}
```

**使用示例**：
```javascript
const template = '<div>{{name}} is {{age}} years old</div>';
const data = { name: 'Alice', age: 18 };

render(template, data);
// '<div>Alice is 18 years old</div>'
```

**总结**：
- **核心思路**：使用正则表达式匹配模板变量，替换为数据对象中的值
- **关键点**：
  1. 正则表达式：`/\{\{(\w+)\}\}/g`
  2. 使用 replace 的回调函数获取匹配的 key
  3. 从数据对象中取值替换

---

### 4.15 小孩报数问题 ⭐⭐

**考点**：约瑟夫环问题

**题目**：n 个小孩围成一圈，从第一个开始报数，报到 m 的小孩出列，求最后剩下的小孩编号

**实现**：

```javascript
function josephus(n, m) {
  const children = Array.from({ length: n }, (_, i) => i + 1);
  let index = 0;

  while (children.length > 1) {
    index = (index + m - 1) % children.length;
    children.splice(index, 1);
  }

  return children[0];
}
```

**总结**：
- **核心思路**：约瑟夫环问题，使用数组模拟循环报数
- **关键点**：
  1. 使用取模运算实现循环
  2. 每次删除报到 m 的元素
  3. 循环直到只剩一个元素

---

### 4.16 路由实现（Hash/History）⭐⭐⭐

**考点**：前端路由原理

#### 4.16.1 Hash 路由

```javascript
class HashRouter {
  constructor() {
    this.routes = {};
    this.currentUrl = '';

    window.addEventListener('load', this.refresh.bind(this));
    window.addEventListener('hashchange', this.refresh.bind(this));
  }

  route(path, callback) {
    this.routes[path] = callback || function() {};
  }

  refresh() {
    this.currentUrl = location.hash.slice(1) || '/';
    this.routes[this.currentUrl] && this.routes[this.currentUrl]();
  }
}
```

#### 4.16.2 History 路由

```javascript
class HistoryRouter {
  constructor() {
    this.routes = {};
    this.currentUrl = '';

    window.addEventListener('load', this.refresh.bind(this));
    window.addEventListener('popstate', this.refresh.bind(this));
  }

  route(path, callback) {
    this.routes[path] = callback || function() {};
  }

  push(path) {
    history.pushState(null, null, path);
    this.routes[path] && this.routes[path]();
  }

  refresh() {
    this.currentUrl = location.pathname;
    this.routes[this.currentUrl] && this.routes[this.currentUrl]();
  }
}
```

**总结**：
- **核心思路**：Hash 路由监听 hashchange，History 路由使用 pushState 和 popstate
- **关键点**：
  1. Hash 路由：监听 hashchange 事件，通过 location.hash 获取路由
  2. History 路由：使用 pushState 改变 URL，监听 popstate 事件
  3. Hash 路由兼容性好，History 路由需要服务器配置

---

### 4.17 虚拟 DOM Diff ⭐⭐⭐

**考点**：虚拟 DOM、Diff 算法

**简化版实现**：

```javascript
function diff(oldVNode, newVNode) {
  // 节点类型不同，直接替换
  if (oldVNode.tag !== newVNode.tag) {
    return {
      type: 'REPLACE',
      newVNode
    };
  }

  // 文本节点
  if (typeof newVNode === 'string') {
    if (oldVNode !== newVNode) {
      return {
        type: 'TEXT',
        text: newVNode
      };
    }
    return null;
  }

  // 对比属性
  const propsPatches = diffProps(oldVNode.props, newVNode.props);

  // 对比子节点
  const childrenPatches = diffChildren(oldVNode.children, newVNode.children);

  return {
    type: 'UPDATE',
    props: propsPatches,
    children: childrenPatches
  };
}

function diffProps(oldProps, newProps) {
  const patches = [];

  // 找出修改和新增的属性
  for (const key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      patches.push({
        type: 'SET_PROP',
        key,
        value: newProps[key]
      });
    }
  }

  // 找出删除的属性
  for (const key in oldProps) {
    if (!(key in newProps)) {
      patches.push({
        type: 'REMOVE_PROP',
        key
      });
    }
  }

  return patches;
}

function diffChildren(oldChildren, newChildren) {
  const patches = [];
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    patches.push(diff(oldChildren[i], newChildren[i]));
  }

  return patches;
}
```

**总结**：
- **核心思路**：对比新旧虚拟 DOM，生成最小化的更新操作
- **关键点**：
  1. 节点类型不同直接替换
  2. 对比属性差异
  3. 递归对比子节点
  4. 实际应用中需要 key 优化

---

### 4.18 Vue 懒加载指令 ⭐⭐

**考点**：Vue 自定义指令、IntersectionObserver

**实现**：

```javascript
Vue.directive('lazy', {
  inserted(el, binding) {
    const imageSrc = binding.value;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.src = imageSrc;
        observer.unobserve(el);
      }
    });

    observer.observe(el);
  }
});
```

**使用**：
```html
<img v-lazy="imageUrl" />
```

**总结**：
- **核心思路**：使用 IntersectionObserver 监听元素是否进入视口
- **关键点**：
  1. 使用 IntersectionObserver API
  2. 元素进入视口时设置 src 属性
  3. 加载完成后取消监听

---

## 五、CSS 布局

### 5.1 三栏布局 ⭐⭐⭐

**考点**：CSS 布局、Flex、Grid、浮动、定位

**需求**：实现左右固定宽度，中间自适应的三栏布局

#### 5.1.1 Flex 布局

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .container {
      display: flex;
      height: 200px;
    }
    .left {
      width: 200px;
      background: #f00;
    }
    .center {
      flex: 1;
      background: #0f0;
    }
    .right {
      width: 200px;
      background: #00f;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="left">左侧</div>
    <div class="center">中间</div>
    <div class="right">右侧</div>
  </div>
</body>
</html>
```

#### 5.1.2 Grid 布局

```html
<style>
  .container {
    display: grid;
    grid-template-columns: 200px 1fr 200px;
    height: 200px;
  }
  .left {
    background: #f00;
  }
  .center {
    background: #0f0;
  }
  .right {
    background: #00f;
  }
</style>
```

#### 5.1.3 浮动布局

```html
<style>
  .container {
    height: 200px;
  }
  .left {
    float: left;
    width: 200px;
    height: 100%;
    background: #f00;
  }
  .right {
    float: right;
    width: 200px;
    height: 100%;
    background: #00f;
  }
  .center {
    margin: 0 200px;
    height: 100%;
    background: #0f0;
  }
</style>
<div class="container">
  <div class="left">左侧</div>
  <div class="right">右侧</div>
  <div class="center">中间</div>
</div>
```

#### 5.1.4 绝对定位布局

```html
<style>
  .container {
    position: relative;
    height: 200px;
  }
  .left {
    position: absolute;
    left: 0;
    width: 200px;
    height: 100%;
    background: #f00;
  }
  .center {
    margin: 0 200px;
    height: 100%;
    background: #0f0;
  }
  .right {
    position: absolute;
    right: 0;
    width: 200px;
    height: 100%;
    background: #00f;
  }
</style>
```

#### 5.1.5 圣杯布局

```html
<style>
  .container {
    padding: 0 200px;
    height: 200px;
  }
  .center {
    float: left;
    width: 100%;
    height: 100%;
    background: #0f0;
  }
  .left {
    float: left;
    width: 200px;
    height: 100%;
    margin-left: -100%;
    position: relative;
    left: -200px;
    background: #f00;
  }
  .right {
    float: left;
    width: 200px;
    height: 100%;
    margin-left: -200px;
    position: relative;
    right: -200px;
    background: #00f;
  }
</style>
<div class="container">
  <div class="center">中间</div>
  <div class="left">左侧</div>
  <div class="right">右侧</div>
</div>
```

**总结**：
- **核心思路**：左右固定宽度，中间自适应
- **关键点**：
  1. Flex 和 Grid 是现代布局的首选
  2. 浮动布局需要注意清除浮动
  3. 圣杯布局利用负 margin 实现

---

### 5.2 上中下布局 ⭐⭐

**考点**：CSS 布局、Flex

**需求**：实现上下固定高度，中间自适应的布局

#### 5.2.1 Flex 布局

```html
<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .header {
    height: 60px;
    background: #f00;
  }
  .main {
    flex: 1;
    background: #0f0;
  }
  .footer {
    height: 60px;
    background: #00f;
  }
</style>
<div class="container">
  <div class="header">头部</div>
  <div class="main">主体</div>
  <div class="footer">底部</div>
</div>
```

#### 5.2.2 Grid 布局

```html
<style>
  .container {
    display: grid;
    grid-template-rows: 60px 1fr 60px;
    height: 100vh;
  }
  .header {
    background: #f00;
  }
  .main {
    background: #0f0;
  }
  .footer {
    background: #00f;
  }
</style>
```

**总结**：
- **核心思路**：上下固定高度，中间自适应
- **关键点**：
  1. Flex 布局使用 flex: 1 实现中间自适应
  2. Grid 布局使用 1fr 实现自适应
  3. 需要设置容器高度为 100vh

---

### 5.3 CSS 特殊场景 ⭐⭐

#### 5.3.1 CSS 三角形

```html
<style>
  .triangle {
    width: 0;
    height: 0;
    border-left: 50px solid transparent;
    border-right: 50px solid transparent;
    border-bottom: 100px solid #f00;
  }
</style>
<div class="triangle"></div>
```

**原理**：利用 border 的特性，将宽高设为 0，只显示一个方向的 border

#### 5.3.2 1px 边框问题

**问题**：在高清屏（Retina）上，1px 的边框会显得很粗

**解决方案**：

```html
<style>
  /* 方案一：transform scale */
  .border-1px {
    position: relative;
  }
  .border-1px::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: #000;
    transform: scaleY(0.5);
    transform-origin: 0 0;
  }

  /* 方案二：viewport + rem */
  @media (-webkit-min-device-pixel-ratio: 2) {
    html {
      font-size: 50px;
    }
  }
  @media (-webkit-min-device-pixel-ratio: 3) {
    html {
      font-size: 33.33px;
    }
  }
</style>
```

#### 5.3.3 等比伸缩的矩形

**需求**：实现一个宽高比固定的矩形，宽度自适应

```html
<style>
  /* 方案一：padding-top */
  .box {
    width: 100%;
    padding-top: 56.25%; /* 16:9 = 9/16 = 0.5625 */
    background: #f00;
    position: relative;
  }
  .content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  /* 方案二：aspect-ratio（现代浏览器）*/
  .box {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #f00;
  }
</style>
```

**总结**：
- **核心思路**：利用 CSS 特性实现特殊效果
- **关键点**：
  1. 三角形：利用 border 特性，宽高设为 0
  2. 1px 边框：使用 transform: scaleY(0.5) 或 viewport 方案
  3. 等比伸缩：padding-top 百分比相对于宽度，或使用 aspect-ratio

---

## 六、设计模式

### 6.1 单例模式 ⭐⭐

**考点**：闭包、设计模式

**作用**：确保一个类只有一个实例

```javascript
const Singleton = (function() {
  let instance;

  function createInstance() {
    return {
      name: 'singleton',
      getName() {
        return this.name;
      }
    };
  }

  return {
    getInstance() {
      if (!instance) {
        instance = createInstance();
      }
      return instance;
    }
  };
})();

// 使用
const instance1 = Singleton.getInstance();
const instance2 = Singleton.getInstance();

console.log(instance1 === instance2); // true
```

**总结**：
- **核心思路**：使用闭包保存唯一实例，懒加载模式
- **关键点**：
  1. 使用闭包保存实例
  2. 懒加载：第一次调用时创建实例
  3. 后续调用返回同一实例

---

## 七、面试真题

### 7.1 字节跳动 ⭐⭐⭐

**面试时间**：2024-1-29  
**部门**：本地生活  
**轮次**：1 面

**题目**：实现 `add(1, 2, 3)(4, 5).toSum()`

```javascript
const add = function(...args) {
  const _args = [...args];

  const fn = function(...args2) {
    _args.push(...args2);
    return add(..._args);
  }

  fn.toSum = () => _args.reduce((a, b) => +a + +b, 0);

  return fn;
}

// 测试
console.log(add(1, 2, 3)(4, 5).toSum()); // 15
console.log(add(1)(2)(3)(4).toSum()); // 10
```

**考点**：
- 函数柯里化
- 闭包
- 链式调用
- 高阶函数

**总结**：
- **核心思路**：使用闭包保存参数，返回新函数继续收集，在 toSum 方法中计算总和
- **关键点**：
  1. 闭包保存所有参数
  2. 返回新函数支持链式调用
  3. 在函数对象上挂载 toSum 方法

---

### 7.2 快手 ⭐⭐⭐

**面试时间**：2022-6-27  
**部门**：商业化  

**题目**：100 个数字，后端有个 add 接口，每次接收 2 个参数，返回 2 个数字的和。后端接口 QPS 不限，最快的方式获得 100 个数的和。

#### 7.2.1 串行方案（较慢）

```javascript
(async () => {
  let numList = [1, 2, 3, ..., 100];

  while (numList.length > 1) {
    const num1 = numList.shift();
    const num2 = numList.shift();

    numList.push(await add(num1, num2));
  }

  console.log(numList[0]); // 最终结果
})();
```

**时间复杂度**：O(n)，需要调用 99 次接口

#### 7.2.2 并行方案（最快）

```javascript
async function fastSum(numbers) {
  let arr = [...numbers];

  while (arr.length > 1) {
    const promises = [];
    const nextArr = [];

    // 两两配对，并行调用
    for (let i = 0; i < arr.length; i += 2) {
      if (i + 1 < arr.length) {
        promises.push(add(arr[i], arr[i + 1]));
      } else {
        // 奇数个，最后一个直接放入下一轮
        nextArr.push(arr[i]);
      }
    }

    // 等待所有并行请求完成
    const results = await Promise.all(promises);
    arr = [...nextArr, ...results];
  }

  return arr[0];
}

// 使用
fastSum([1, 2, 3, ..., 100]).then(result => {
  console.log(result); // 5050
});
```

**优化分析**：
- 第 1 轮：50 个并行请求（100 → 50）
- 第 2 轮：25 个并行请求（50 → 25）
- 第 3 轮：12 个并行请求（25 → 13）
- ...
- 总共约 log₂(100) ≈ 7 轮

**考点**：
- 异步并发控制
- Promise.all 的使用
- 算法优化思维

**总结**：
- **核心思路**：使用二分思想，每轮将数组两两配对并行求和
- **关键点**：
  1. 串行方案：O(n) 时间复杂度，需要 99 次调用
  2. 并行方案：O(log n) 时间复杂度，约 7 轮完成
  3. 使用 Promise.all 实现并行

---

### 7.3 得物 ⭐⭐⭐

**面试时间**：2023-1-9  
**部门**：国际化  
**轮次**：1 面

**题目**：实现一个 arrange 函数，可以进行时间和工作调度

**需求**：
```javascript
arrange('William').execute();
// > William is notified

arrange('William').do('commit').execute();
// > William is notified
// > Start to commit

arrange('William').wait(5).do('commit').execute();
// > William is notified
// 等待 5 秒
// > Start to commit

arrange('William').waitFirst(5).do('push').execute();
// 等待 5 秒
// > William is notified
// > Start to push
```

**考点**：
- Promise 链式调用
- 任务队列
- 异步流程控制
- 设计模式（建造者模式）

**总结**：
- **核心思路**：使用任务队列 + 链式调用 + Promise 实现异步任务调度
- **关键点**：
  1. 队列管理任务
  2. 支持 do、wait、waitFirst 等方法
  3. execute 启动执行，递归处理队列

---

### 7.4 九坤 ⭐⭐⭐

**题目 1**：实现 curry 函数（见 2.1）

**题目 2**：实现 lodash.get（见 3.5）

**题目 3**：获取数组指定项（支持负数索引）

```javascript
function getArrayItem(arr, index) {
  // 支持负数索引
  if (index < 0) {
    return arr[arr.length + index];
  }
  return arr[index];
}

// 测试
const arr = [1, 2, 3, 4, 5];
getArrayItem(arr, 0); // 1
getArrayItem(arr, -1); // 5
getArrayItem(arr, -2); // 4
```

**考点**：
- 数组索引
- 负数索引的处理
- 边界条件

**总结**：
- **核心思路**：负数索引从数组末尾开始计算
- **关键点**：
  1. 负数索引：`arr.length + index`
  2. 正数索引：直接访问
  3. 注意边界条件处理

---

### 7.5 云账户 ⭐⭐

**题目**：实现一个简单的发布订阅模式

```javascript
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        callback(...args);
      });
    }
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}
```

**使用示例**：
```javascript
const emitter = new EventEmitter();

emitter.on('test', (data) => {
  console.log('test event:', data);
});

emitter.emit('test', 'hello'); // test event: hello
```

---

### 7.6 IDG ⭐⭐

**题目 1**：数组去重（见 3.2）

**题目 2**：实现 Promise.all

```javascript
Promise.myAll = function(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      return reject(new TypeError('arguments must be an array'));
    }

    const results = [];
    let count = 0;

    if (promises.length === 0) {
      return resolve(results);
    }

    promises.forEach((promise, index) => {
      Promise.resolve(promise).then(
        value => {
          results[index] = value;
          count++;

          if (count === promises.length) {
            resolve(results);
          }
        },
        reason => {
          reject(reason);
        }
      );
    });
  });
};
```

**题目 3**：实现 Promise.race

```javascript
Promise.myRace = function(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      return reject(new TypeError('arguments must be an array'));
    }

    promises.forEach(promise => {
      Promise.resolve(promise).then(resolve, reject);
    });
  });
};
```

---

## 八、补充知识点

### 8.1 AJAX 封装 ⭐⭐⭐

**考点**：XMLHttpRequest、Promise

```javascript
function ajax(options) {
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data = null,
      headers = {},
      timeout = 0
    } = options;

    const xhr = new XMLHttpRequest();

    // 设置超时
    if (timeout) {
      xhr.timeout = timeout;
    }

    // 打开请求
    xhr.open(method, url, true);

    // 设置请求头
    Object.keys(headers).forEach(key => {
      xhr.setRequestHeader(key, headers[key]);
    });

    // 监听状态变化
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(xhr.statusText));
        }
      }
    };

    // 超时处理
    xhr.ontimeout = function() {
      reject(new Error('Request timeout'));
    };

    // 错误处理
    xhr.onerror = function() {
      reject(new Error('Network error'));
    };

    // 发送请求
    xhr.send(data ? JSON.stringify(data) : null);
  });
}
```

**使用示例**：
```javascript
ajax({
  url: 'https://api.example.com/data',
  method: 'POST',
  data: { name: 'Alice' },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000
})
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

---

### 8.2 数组乱序（洗牌算法）⭐⭐

**考点**：算法、随机数

**Fisher-Yates 洗牌算法**：

```javascript
function shuffle(arr) {
  const result = [...arr];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
```

**使用示例**：
```javascript
const arr = [1, 2, 3, 4, 5];
shuffle(arr); // [3, 1, 5, 2, 4]
```

---

### 8.3 交换两个变量（不使用临时变量）⭐⭐

**考点**：位运算、解构赋值

**方法一：解构赋值**：
```javascript
let a = 1, b = 2;
[a, b] = [b, a];
```

**方法二：算术运算**：
```javascript
let a = 1, b = 2;
a = a + b; // a = 3
b = a - b; // b = 1
a = a - b; // a = 2
```

**方法三：位运算**：
```javascript
let a = 1, b = 2;
a = a ^ b;
b = a ^ b;
a = a ^ b;
```

---

### 8.4 获取数组总和 ⭐⭐

**考点**：数组方法

**方法一：reduce**：
```javascript
function getArraySum(arr) {
  return arr.reduce((sum, num) => sum + num, 0);
}
```

**方法二：递归**：
```javascript
function getArraySum(arr) {
  if (arr.length === 0) return 0;
  return arr[0] + getArraySum(arr.slice(1));
}
```

---

### 8.5 发布订阅模式 vs 观察者模式 ⭐⭐

**考点**：设计模式

**观察者模式**：
- 观察者直接订阅主题
- 主题直接通知观察者
- 耦合度较高

```javascript
class Subject {
  constructor() {
    this.observers = [];
  }

  addObserver(observer) {
    this.observers.push(observer);
  }

  notify(data) {
    this.observers.forEach(observer => observer.update(data));
  }
}

class Observer {
  update(data) {
    console.log('收到通知:', data);
  }
}
```

**发布订阅模式**：
- 发布者和订阅者通过事件中心通信
- 解耦度更高

```javascript
class EventBus {
  constructor() {
    this.events = {};
  }

  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  publish(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}
```

---

## 九、学习建议

### 9.1 学习路径

1. **基础篇**（1-2 周）
   - Object.create、new、instanceof
   - call、apply、bind
   - 深拷贝、浅拷贝
   - 继承的实现

2. **函数式编程篇**（1 周）
   - 柯里化
   - 函数组合
   - 偏函数
   - AOP

3. **数据处理篇**（1 周）
   - 数组方法实现
   - 树和数组的转换
   - 字符串处理
   - 数字处理

4. **场景应用篇**（2 周）
   - Promise 实现
   - 异步任务调度
   - 防抖节流
   - 路由实现

5. **CSS 布局篇**（1 周）
   - 三栏布局
   - 上中下布局
   - 特殊场景

6. **设计模式篇**（1 周）
   - 单例模式
   - 发布订阅
   - 观察者模式

### 9.2 练习建议

1. **理解原理**
   - 不要死记硬背代码
   - 理解每个实现背后的原理
   - 知道为什么这样写

2. **动手实践**
   - 每个题目至少写 3 遍
   - 第一遍：看着答案写
   - 第二遍：不看答案写
   - 第三遍：优化和扩展

3. **举一反三**
   - 思考如何优化
   - 考虑边界情况
   - 尝试不同实现方式

4. **总结归纳**
   - 整理自己的代码模板
   - 记录易错点
   - 建立知识体系

5. **定期复习**
   - 每周复习一次
   - 面试前集中复习
   - 保持手感

### 9.3 面试技巧

1. **先说思路**
   - 不要上来就写代码
   - 先和面试官沟通思路
   - 确认需求和边界条件

2. **考虑边界**
   - 参数校验
   - 空值处理
   - 异常处理

3. **代码规范**
   - 命名要有意义
   - 注意缩进和格式
   - 适当添加注释

4. **测试验证**
   - 写完后自己测试
   - 考虑各种情况
   - 主动说明测试用例

5. **优化讨论**
   - 讨论时间复杂度
   - 讨论空间复杂度
   - 提出优化方案

### 9.4 常见问题

**Q1：手写题需要写得多完美？**
- 核心逻辑正确即可
- 不需要处理所有边界情况
- 重点是展示思路

**Q2：记不住怎么办？**
- 理解原理比记代码重要
- 多写几遍自然就记住了
- 建立自己的代码模板

**Q3：面试时紧张写不出来？**
- 平时多练习
- 面试前集中复习
- 深呼吸，放松心态

**Q4：需要掌握多少题目？**
- 本文档的核心题目（标 ⭐⭐⭐ 的）
- 大约 30-40 道
- 重点是理解，不是数量

---

## 十、参考资料

### 10.1 在线资源

- [MDN Web Docs](https://developer.mozilla.org/) - 最权威的 Web 技术文档
- [JavaScript.info](https://javascript.info/) - 现代 JavaScript 教程
- [ES6 标准入门](https://es6.ruanyifeng.com/) - 阮一峰的 ES6 教程
- [冴羽的博客](https://github.com/mqyqingfeng/Blog) - 深入系列文章

### 10.2 书籍推荐

- 《JavaScript 高级程序设计》（第 4 版）- 红宝书
- 《你不知道的 JavaScript》（上中下）- 深入理解 JS
- 《JavaScript 设计模式与开发实践》- 设计模式
- 《ES6 标准入门》- ES6 特性

### 10.3 源码学习

- [lodash 源码](https://github.com/lodash/lodash) - 工具函数库
- [underscore 源码](https://github.com/jashkenas/underscore) - 函数式编程
- [jQuery 源码](https://github.com/jquery/jquery) - DOM 操作
- [Vue 源码](https://github.com/vuejs/vue) - 响应式原理

### 10.4 刷题平台

- [LeetCode](https://leetcode.cn/) - 算法题
- [牛客网](https://www.nowcoder.com/) - 前端面试题
- [力扣](https://leetcode-cn.com/) - 中文版 LeetCode

---

## 附录：快速查找索引

### A. 按难度分类

**简单（🔥）**：
- Object.create、new、instanceof
- 浅拷贝、数组去重
- 日期格式化、URL 解析

**中等（🔥🔥）**：
- call/apply/bind、深拷贝
- 防抖节流、柯里化
- Promise 实现、异步控制

**困难（🔥🔥🔥）**：
- 继承的实现、虚拟 DOM Diff
- 异步任务调度器
- 完整的 Promise 实现

### B. 按频度分类

**高频（⭐⭐⭐）**：
- call/apply/bind
- 深拷贝、防抖节流
- 数组扁平化、去重
- Promise 相关
- 柯里化、compose

**中频（⭐⭐）**：
- 继承、浅拷贝
- 数组 API 实现
- 路由实现
- CSS 布局

**低频（⭐）**：
- typeof 实现
- 数字转汉字
- 特殊场景题

### C. 按公司分类

**字节跳动**：
- 函数柯里化
- Promise 相关
- 异步控制

**快手**：
- 异步并发
- 数据处理

**得物**：
- 异步任务队列
- Promise 相关

**九坤**：
- 柯里化
- lodash.get
- 数组处理

---

**文档版本**：v3.0  
**最后更新**：2024-03  
**题目总数**：80+  
**覆盖公司**：字节、快手、得物、九坤、云账户、IDG 等  
**新增内容**：
- 元编程（Proxy & Reflect）
- 高级异步调度器（带状态机）
- 循环有序数组查找
- 完善的 CSS 布局方案
- 更详细的面试真题解析

---

> 💡 **提示**：本文档持续更新中，建议收藏并定期查看。如有问题或建议，欢迎反馈！
