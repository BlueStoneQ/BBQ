## 七、面试真题



## 目录

- [7.1 字节跳动](#71-字节跳动)
- [7.2 快手](#72-快手)
- [7.3 得物](#73-得物)
- [7.4 九坤](#74-九坤)
- [7.5 云账户](#75-云账户)
- [7.6 IDG](#76-idg)

---

### 7.1 字节跳动

⭐⭐⭐
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

### 7.2 快手

⭐⭐⭐
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

### 7.3 得物

⭐⭐⭐
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

### 7.4 九坤

⭐⭐⭐
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

### 7.5 云账户

⭐⭐
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

### 7.6 IDG

⭐⭐
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

