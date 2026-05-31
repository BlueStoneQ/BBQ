## 一、JavaScript 基础



## 目录

- [1.1 Object.create 实现](#11-object.create-实现)
- [1.2 new 操作符实现](#12-new-操作符实现)
- [1.3 instanceof 实现](#13-instanceof-实现)
- [1.4 call / apply / bind 实现](#14-call-apply-bind-实现)
- [1.5 节流（throttle）](#15-节流throttle)
- [1.6 防抖（debounce）](#16-防抖debounce)
- [1.7 节流 + 防抖结合](#17-节流-+-防抖结合)
- [1.8 深拷贝（deepClone）](#18-深拷贝deepclone)
- [1.9 浅拷贝（shallowCopy）](#19-浅拷贝shallowcopy)
- [1.10 继承（extends）](#110-继承extends)
- [1.11 Promise 实现](#111-promise-实现)
- [1.12 typeof 实现](#112-typeof-实现)
- [1.13 元编程（Proxy & Reflect）](#113-元编程proxy-reflect)

---

### 1.1 Object.create 实现

⭐⭐⭐
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

### 1.2 new 操作符实现

⭐⭐⭐
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

### 1.3 instanceof 实现

⭐⭐⭐
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

### 1.4 call / apply / bind 实现

⭐⭐⭐
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

### 1.5 节流（throttle）

⭐⭐⭐
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

### 1.6 防抖（debounce）

⭐⭐⭐
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

### 1.7 节流 + 防抖结合

⭐⭐
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

### 1.8 深拷贝（deepClone）

⭐⭐⭐
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

### 1.9 浅拷贝（shallowCopy）

⭐⭐
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

### 1.10 继承（extends）

⭐⭐⭐
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

### 1.11 Promise 实现

⭐⭐⭐
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

### 1.12 typeof 实现

⭐⭐
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

### 1.13 元编程（Proxy & Reflect）

⭐⭐⭐
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

