## 四、场景应用



## 目录

- [4.1 每隔一秒打印 1234](#41-每隔一秒打印-1234)
- [4.2 sleep 函数](#42-sleep-函数)
- [4.3 retry 重试函数](#43-retry-重试函数)
- [4.4 异步任务队列](#44-异步任务队列)
- [4.5 异步并发控制](#45-异步并发控制)
- [4.6 红绿灯问题](#46-红绿灯问题)
- [4.7 setTimeout 实现 setInterval](#47-settimeout-实现-setinterval)
- [4.8 Promise 加载图片](#48-promise-加载图片)
- [4.9 Promise.cancel 实现](#49-promise.cancel-实现)
- [4.10 循环引用检测](#410-循环引用检测)
- [4.11 HTML 标签校验](#411-html-标签校验)
- [4.12 寻找最多的连续字符](#412-寻找最多的连续字符)
- [4.13 搜索框结果匹配](#413-搜索框结果匹配)
- [4.14 HTML 模板替换](#414-html-模板替换)
- [4.15 小孩报数问题](#415-小孩报数问题)
- [4.16 路由实现（Hash/History）](#416-路由实现hashhistory)
- [4.17 虚拟 DOM Diff](#417-虚拟-dom-diff)
- [4.18 Vue 懒加载指令](#418-vue-懒加载指令)

---

### 4.1 每隔一秒打印 1234

⭐⭐
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

### 4.2 sleep 函数

⭐⭐⭐
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

### 4.3 retry 重试函数

⭐⭐⭐
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

### 4.4 异步任务队列

⭐⭐⭐
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

### 4.5 异步并发控制

⭐⭐⭐
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

#### 4.5.1b TypeScript 版本

```typescript
// 1. 定义任务类型：一个返回 Promise 的函数（不是 Promise 本身！）
//    为什么是函数？因为 Promise 一创建就执行，我们需要延迟执行的能力
type PromiseCreator<T = unknown> = () => Promise<T>

// 2. 队列中存储的项：任务 + 外层 Promise 的 resolve/reject
//    为什么要存 resolve/reject？因为 add() 返回的 Promise 要等任务真正完成才 resolve
interface QueueItem {
  creator: PromiseCreator
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

class Scheduler {
  private limit: number                // 最大并发数
  private queue: QueueItem[] = []      // 等待队列
  private running: number = 0          // 当前正在执行的任务数

  constructor(limit: number) {
    this.limit = limit
  }

  // 3. add 返回 Promise<T>：调用方可以 .then() 拿到任务结果
  //    核心技巧：new Promise 把 resolve/reject 存起来，等任务执行完再兑现
  add<T>(creator: PromiseCreator<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // 存入队列（不立即执行）
      this.queue.push({
        creator,
        resolve: resolve as (value: unknown) => void,  // 类型收窄
        reject
      })
      // 尝试消费队列
      this.run()
    })
  }

  // 4. run：有空位就从队列取任务执行
  private run(): void {
    while (this.running < this.limit && this.queue.length > 0) {
      const item = this.queue.shift()!  // ! 断言非空（while 条件已保证）
      this.running++

      item.creator()
        .then(item.resolve)   // 任务成功 → 兑现外层 Promise
        .catch(item.reject)   // 任务失败 → 拒绝外层 Promise
        .finally(() => {
          this.running--      // 腾出空位
          this.run()          // 继续消费队列
        })
    }
  }
}

// 使用
const scheduler = new Scheduler(2)

const timeout = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

const addTask = (time: number, order: string): void => {
  scheduler.add(() => timeout(time)).then(() => console.log(order))
}

addTask(1000, '1')
addTask(500, '2')
addTask(300, '3')
addTask(400, '4')
// 输出顺序：2 3 1 4
```

**TS 关键点总结**：

| 模式 | 说明 |
|------|------|
| `type PromiseCreator<T> = () => Promise<T>` | 任务是"返回 Promise 的函数"，不是 Promise 本身 |
| `interface QueueItem` | 队列项 = 任务 + resolve/reject（延迟兑现） |
| `add<T>(creator): Promise<T>` | 泛型方法：返回值类型跟着任务走 |
| `private` 修饰符 | `run` / `queue` / `running` 不暴露给外部 |
| `this.queue.shift()!` | 非空断言（while 条件已保证 length > 0） |

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

### 4.6 红绿灯问题

⭐⭐⭐
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

### 4.7 setTimeout 实现 setInterval

⭐⭐⭐
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

### 4.8 Promise 加载图片

⭐⭐
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

### 4.9 Promise.cancel 实现

⭐⭐⭐
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
      .then(res => resolve(res))
      .catch(err => reject(err));
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

### 4.10 循环引用检测

⭐⭐
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

### 4.11 HTML 标签校验

⭐⭐
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

### 4.12 寻找最多的连续字符

⭐⭐⭐
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

### 4.13 搜索框结果匹配

⭐⭐
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

### 4.14 HTML 模板替换

⭐⭐
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

### 4.15 小孩报数问题

⭐⭐
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

### 4.16 路由实现（Hash/History）

⭐⭐⭐
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

### 4.17 虚拟 DOM Diff

⭐⭐⭐
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

### 4.18 Vue 懒加载指令

⭐⭐
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

