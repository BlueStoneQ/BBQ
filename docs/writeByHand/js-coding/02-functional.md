## 二、函数式编程



## 目录

- [2.1 函数柯里化（curry）](#21-函数柯里化curry)
- [2.2 函数组合（compose）](#22-函数组合compose)
- [2.3 偏函数（partial）](#23-偏函数partial)
- [2.4 AOP 面向切面编程](#24-aop-面向切面编程)
- [2.5 惰性函数（lazyCall）](#25-惰性函数lazycall)
- [2.6 记忆函数（memoize）](#26-记忆函数memoize)

---

### 2.1 函数柯里化（curry）

⭐⭐⭐

> **关键 API**：`fn.length`（获取函数形参个数）
>
> **核心思路**：收集参数 → 够了就执行，不够就递归返回新函数继续收集
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

### 2.2 函数组合（compose）

⭐⭐⭐
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

### 2.3 偏函数（partial）

⭐⭐
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

### 2.4 AOP 面向切面编程

⭐⭐
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

### 2.5 惰性函数（lazyCall）

⭐⭐

> **本质**：惰性定义函数——第一次调用时重新定义自身（函数自我覆盖），之后调用的是新定义的版本，不再重复判断。

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

### 2.6 记忆函数（memoize）

⭐⭐⭐
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

