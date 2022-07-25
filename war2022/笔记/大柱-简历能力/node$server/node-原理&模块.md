
# NODE

## 核心原理
```
《深入浅出node》
- 模块化
- 事件循环
- buffer
- web应用

先自己思考 遇到了阻塞 在去找答案
打通 激活 知识活起来
按计划 坚持去做
```

## 参考资料
- [nodejs系列系统教程-掘金](https://juejin.cn/post/7095713577209692168)
- [gitbook:koa-server实践](https://chenshenhai.github.io/koa2-note/note/route/koa-router.html)

### nodejs基本架构理解
1. IO调用流程：js -> node核心模块（js） -> c++内建模块 -> libuv进行系统调用（跨平台是libuv实现的）
2. 笔记本画个架构图
  js - v8 - 核心模块 - libuv - 系统调用
3. node高性能原因：
  - 事件驱动，适合IO密集型：
    - 每线程/每请求的方式目前还被Apache所采用。Node通过事件驱动的方式处理请求，无须为 每一个请求创建额外的对应线程，可以省掉创建线程和销毁线程的开销，同时操作系统在调度任 务时因为线程较少，上下文切换的代价很低。这使得服务器能够有条不紊地处理请求，即使在大量连接的情况下，也不受线程上下文切换开销的影响，这是Node高性能的一个原因。

### libuv
- 本质上就是对于各种操作系统的IO操作处理为了异步（事件驱动）的api
  - 讲阻塞 和 非阻塞的api 都通过event-loop处理为异步api 
  - nodejs本身的架构：事件驱动架构

### event-loop
1. [event-loop](https://zhuanlan.zhihu.com/p/87684858)
1. 概念：
  - 同步和异步任务分别进入不同的执行环境，同步的进入主线程，即主执行栈，异步的进入任务队列 (Event Queue，机制为先进先出)。主线程内的任务执行完毕为空，会去任务队列读取对应的任务，推入主线程执行。 上述过程的不断重复就是我们说的 Event Loop (事件循环)。
2. 分类：
  宏任务主要包含：script( 整体代码)、setTimeout、setInterval、I/O、UI 交互事件、setImmediate(Node.js 环境)
  微任务主要包含：Promise、MutaionObserver、process.nextTick(Node.js 环境)
3. 执行规律是：
  - 在一个**宏任务队列全部**执行完毕后，去清空一次微任务队列，然后到下一个等级的宏任务队列，以此往复。一个宏任务队列搭配一个微任务队列。
4. node端微任务也有优先级先后：
  process.nextTick;
  promise.then 等;
  清空微任务队列时，会先执行process.nextTick，然后才是微任务队列中的其他。
5. event-loop是异步的底层运行逻辑：最后的最后，记住，JavaScript 是一门单线程语言，异步操作都是放到事件循环队列里面，等待主执行栈来执行的，并没有专门的异步执行线程。

1. 区分于浏览器的event-loop,node的有6个环节
2. 事件循环是指Node.js执行非阻塞I/O操作，尽管==JavaScript是单线程的==,但由于大多数==内核都是多线程==的，Node.js会尽可能将操作装载到系统内核。因此它们可以处理在后台执行的多个操作。当其中一个操作完成时，内核会告诉Node.js，以便Node.js可以将相应的回调添加到轮询队列中以最终执行。
  - 那么这里 我们知道：加入到轮询队列的是回调，像microTask每次都是要清空的。如果一个任务没有完成，是不会把相关的事件观察者（里面有事件的回调）放在任务队列（microTask quque）中的。
  - 事件循环、观察者、请求对象、I/O线程池这四者共同构成了Node异步I/O模型的基本要素。
3. node的event-loop有6个宏任务事件队列 + 1个微任务事件队列 - 每个队列都存放的是回调: 
  - timers
  - pending callbacks: 执行操作系统的回调
  - idle/prepare ：只在系统内部调用
  - poll：IO相关操作的回调 例如读取文件等
  - check
    - setImmediate中的回调
    - [!!]process.nextTick 是 微任务，而且执行时机**早于**promise.then
  - chlose callbacks: 执行close事件的回调
4. IO调用流程：js -> node核心模块（js） -> c++内建模块 -> libuv进行系统调用（跨平台是libuv实现的）
5. 非IO异步API
  - 定时器
    - 调用setTimeout()或者 setInterval()创建的定时器会被插入到定时器观察者内部的一个红黑树中。每次Tick执行时，会 从该红黑树中迭代取出定时器对象，检查是否超过定时时间，如果超过，就形成一个事件，它的 回调函数将立即执行。
    - 问题：定时器的问题在于，它并非精确的(在容忍范围内)。尽管事件循环十分快，但是如果某一 次循环占用的时间较多，那么下次循环时，它也许已经超时很久了。
    - 定时器动作本质：在时间到了后，会把回调加到宏任务队列中，等待宏队列处理

  - process.nextTick
    - 本质就是加一个回调到微任务中，等待目前的宏任务结束后，执行该微任务队列。
    - 用途：立即执行一个异步任务，而定时器因为需要红黑树，较为浪费性能。
      - 用于控制代码执行顺序，为了实现异步的api,保证用户的代码一定可以异步调用
      - 例如一些用户的callBack, 同步执行的话 会在我们的任务还没结束的时候就已经调用了，也就是说 需要等我们目前这一遍js执行结束后，再调用callBack
      ```js
      const server = net.createServer(() => {}).listen(8080);
      server.on('listening', () => {});
      // 当我们传递一个端口号进去时，端口号会被立刻绑定。所以'listening' callback可以被立即调用。问题是.on('listening');这个callback可能还没设置呢？这要怎么办?  为了做到在精准无误的监听到listen的动作，将对‘listening’事件的监听操作，队列到nextTick()，从而可以允许代码完全运行完毕
      ```
      - process.nextTick()的意思就是定义出一个动作，并且让这个动作在下一个事件轮询的时间点上执行
      ```js
      let bar;

      // 这个方法用的是一个异步签名，但其实它是同步方式调用回调的
      function someAsyncApiCall(callback) { callback(); }

      // 回调函数在`someAsyncApiCall`完成之前被调用
      someAsyncApiCall(() => {
        // 由于`someAsyncApiCall`已经完成，bar没有被分配任何值
        console.log('bar', bar); // undefined
      });

      bar = 1;
      // callback 此时是一个同步回调，因为someAsyncApiCall()实际上并没有异步执行任何事情。结果这个同步执行的回调当然得到 undefined，因为脚本尚未运行到给 bar 赋值。
      ```
      - 有阻止事件循环继续的优势，适用于在事件循环继续之前，提醒用户有错误发生。
    - 同时注册的多个nextTick回调 会在一个tick中一次同批执行完
    - 与 setImmediate() 对比
        process.nextTick() 在当前tick同一个阶段立即执行。
        setImmediate() 在事件循环的下一次迭代或tick时触发。
        实际上，这两个名称应该互换，因为 process.nextTick() 比 setImmediate() 触发得更早，但这是历史遗留问题，暂时无法改变，即使会令人感到困惑。
        我们建议开发人员在所有情况下都使用 setImmediate()，因为它更容易理解。
  - setImmediate()
    - 执行时机：setImmediate() 将在当前事件轮询的末尾处执行
    - 用途：
    - 而setImmediate同时注册的多个事件，在一个tick中按照顺序只会执行一个，下一个到下一个tick的check阶段继续执行

#### node中js如何调用c++模块
- Node.js 调用C++方法，其实是调用 C++ 代码生成的动态库，可以使用require() 函数加载到Node.js中，就像使用普通的Node.js模块一样。

### 模块化 + require
0. 流程：
  - 路径分析
  - 文件定位
  - 编译执行
1. 模块类型
  - 核心模块
  - 文件模块
  - 自定义模块：例如我们安装的npm包 最耗时的一种
2. 加载顺序
  1. 核心模块加载
    - 部分会作为二进制直接加载进内存，没有路径分析和文件定位
  2. 文件模块加载
    - 缓存优先
      - Node对引入过的模块都会进行缓存，以减少二次引入时的开销
    - 路径分析
    - 文件定位
      - 不含扩展名：会按js json .node 分析
      - 找到的是一个目录：会将这个目录当做一个包来处理：
    - 编译执行
      - 其实 就是require()的时候 就会执行加载的这个依赖的代码
  3. npm包加载
    - 当前文件目录下的node_modules目录。
    - 父目录下的node_modules目录。
    - 父目录的父目录下的node_modules目录。 
    - 沿路径向上逐级递归，直到根目录下的node_modules目录。

## 常用模块

### 全局对象和变量
- 常见全局变量
  - __filename
  - __dirname
  - timer类函数
  - process
  - require module exports

### fs
#### 概述
- 如果想要操作文件系统中的二进制数据需要使用fs模块提供的API，这个过程中Buffer和Stream又是密不可分的。
- open + close存在的意义：
  - 前面我们使用了fs实现了文件的读写操作，既然已经读写了就证明已经实现了文件的打开，为什么Node还要单独的提供打开关闭的api呢？
    因为readFile和writeFile的工作机制是将文件里的内容一次性的全部读取或者写入到内存里，而这种方式对于大体积的文件来讲显然是不合理的，因此需要一种可以实现边读编写或者边写边读的操作方式，这时就需要文件的打开、读取、写入、关闭看做是各自独立的环节，所以也就有了open和close。
- fd: 文件标识符
#### 基本操作类
- stat
- write
- read
- watcher
  - watchFile
  - unwatchFile
#### 常用方法
- 权限
- 增删改查
  - 打开/关闭
  - 读取 
  - 写入
    - writeFile
      - [flag](http://nodejs.cn/api-v12/fs.html#fs_file_system_flags)
    - appendFile
    - copyFile
  - 删除
- 工具类
#### 大文件读写
#### 操作目录
- access
- stat
  - size: 文件字节数
  - isFile
  - isDirectory
- mkdir
  - 一般默认创建的是最后一级目录，例如'a/b/c', 就是在a/b/ 下创建c/
  - 一般创建多级目录：使用options.recursive: true
- rmdir
  - 一般默认情况下 只能删除空目录
  - 一般默认删除的是最后一级目录，例如'a/b/c', 就是在a/b/ 下删除c/
  - 一般删除多级、非空目录：使用options.recursive: true
- readdir
- unlink

### path
- path.sep 系统的路径分隔符 / \

### stream
#### 概述
- 所有的流都继承自EventEmiter
#### 分类-抽象类
- readable
- writeable
- duplex
- transform
#### Readable
- 流动模式
- 暂停模式

### process 
- 全局模块
- 可以获得很多执行环境（进程）信息
1. 用法
  - cpu 内存使用情况
    - process.memoryUsage()
    - process.cpuUsage()
  - 运行环境：
    - cwd()
    - version versions
    - env 
      - env.NODE_ENV
      - env.PATH
      - USERPROFILE 本机管理员目录
    - platform
      - 系统平台 例如输出：win32
  - 运行状态：
    - argv argv0 execArgvs
    - pid ppid
    - uptime() // 当前脚本的执行时间
  - process相关事件
    - 继承了event模块
    - exit 事件
      - code === 0 process正常退出
    - beforeExit
    - process.exit() // 主动退出进程
  - 标准输入 输出 错误 流
    - 根据os.cpus().length 来衍生出多个子线程
    - stdin
      - process.stdin.setEncoding('utf-8')
    - stdout
    ```js
    fs.createReadStream('text.txt').pipe(process.stdout); // 读取文件输出到标准输出
    ```

### emiter

### child_process
- [blog-系统学习](https://www.cnblogs.com/chyingp/p/node-learning-guide-child_process.html)
- nodejs执行命令行

### Buffer
#### 概述
- Buffer是NodeJS中的一个全局变量，无需require就可以直接使用。一般配合stream流使用，充当数据的缓冲区。
- 让js可以操作二进制
- IO操作就是操作二进制
- 流 + 管道技术
- 本质上是一个独立于V8的内存空间
  - 申请 不是由V8申请的，但是分配是由js通过buffer模块去控制的
  - 空间回收：还是由v8的GC进行回收
- buffer创建的时候 大小就固定了
#### 创建buffer
- alloc // 创建以字节为单位指定大小的buffer
- allocUnsafe
- from
#### 在http的网络IO中使用buffer
- 场景就是：当data还未到end事件的时候 我们需要一块内存来暂存我们的数据，等待end后拼接：
```js
http.createServer((req, res) => {
  const bufferList = []; // 这个数组用来存放每个buffer的引用（类似于地址）
  let result = null;
  req.on('data', data => {
    const buffer = Buffer.from(data); // 每个数据块都申请buffer内存来暂存 将引用地址放到数组中
    bufferList.push(buffer);
  });

  req.on('end', () => {
    result = Buffer.concat(bufferList);
  });
});
```
### 实例方法
- fill
  - 填充数据不足，则反复填满buffer
  - 填充数据超出buffer，
- write
- toString
- slice
- indexOf
- copy
### 静态方法
- concat
- isBuffer
### 自定义buffer split
- 非原生的api，返回一个数组，数组的每个元素是一段buffer，利用SEP分割符分割出来的
```js
/**
 * @param seq 分隔符
 */
Buffer.prototype.split = function (sep) {
  // defend
  // init data
  const ret = [];
  const sepLen = Buffer.from(sep).length;
  let start = 0, offset = this.indexOf(sep);
  // algo
  while (offset !== -1) {
    // 处理
    ret.push(this.slice(start, offset));
    // 步进
    start = offset + sepLen;
    offset = this.indexOf(sep);
  }
  // return
  return ret;
}
```

### stream 

#### 大文件的处理 读取 上传？
 ```JS
 var reader = fs.createReadStream('in.txt'); 
 var writer = fs.createWriteStream('out.txt');
 reader.on('data', function() {
   writer.write(chunk); 
 });
 reader.on('end', function() { write.end() });
 ```
  也可以借助管道如下写作：
 ```js
 var reader = fs.createReadStream('in.txt'); 
 var writer = fs.createWriteStream('out.txt'); 
 reader.pipe(writer);
 ```
#### 分类：
  - readable
  - writable
  - duplex
  - transform
#### 事件
  - data
  - end
  - error
  - finish: 写入完成
#### 流的读写
1. 方法1： 通过可读流的‘data’和‘end’事件读取
2. 方法2： 通过管道方法：pipe读取并写入

### http
#### 获取请求参数
- 获取body中的参数：
  - post请求的数据在body中，通过流+事件的方式获取：body中的数据是以二进制+流的形式传递过来的：
  ```js
  let arr = Buffer.alloc();
  req.on('data', (data) => {
    // 存入到buffer
  })
  req.on('end', () => {
    // 数据拼接收集齐了
  });
  ```
- 获取url.query
  - 通过url.parse(req.url) 来获取到query 获取到其中的参数

#### req res
- req: 可读流
- res: 可写流

## 常用的api： 保证一个熟练


## 常用npm 过一下 系统梳理下：结构化知识


## 常见场景-经典问题

### nodejs执行命令行
- [参考](https://juejin.cn/post/6844903612842246157)
- child_process
  - exec/execSync
  - execFile
    ```js
    const { execFile } = require('child_process');
    const path = require('path');

    execFile(path.resolve(__dirname, 'test.sh'), [], (err, stdout, stderr) => {
      if (err) {
        // 执行该命令出错
        console.log(err)
        return;
      }

      console.log('stdout: ', stdout);

      // 执行该命令 该命令执行过程中本身的错误
      console.log('stderr: ', stderr);
    });
    ```
  - spawn - 底层，配置参数最全
    - spawn 会返回一个带有stdout和stderr流的对象。你可以通过stdout流来读取子进程返回给Node.js的数据。stdout拥有'data','end'以及一般流所具有的事件
    - 当你想要子进程返回大量数据给Node时，比如说图像处理，读取二进制数据等等，你最好使用spawn方法
    - 其实也就是流，处理大数据
    ```js
    const { spawn } = require('child_process');

    const spwanObj = spawn('ping', ['127.0.0.1']);

    spwanObj.stdout.on('data', (chunk) => {
      console.log(chunk.toString());
    });

    spwanObj.stderr.on('data', (chunk) => {
      console.log(chunk.toString());
    });
    // 在进程已结束并且子进程的标准输入输出流已关闭之后，则触发 'close' 事件。 这与 'exit' 事件不同，因为多个进程可能共享相同的标准输入输出流。 'close' 事件将始终在 'exit' 或 'error'（如果子进程衍生失败）已经触发之后触发。
    spwanObj.on('close', (code) => {
      console.log(`child process close all stdio with code ${code}`);
    });
    ```
- shellJs
  - 兼容性更好 更好用 - 工程中推荐
  - shell.exec()
  - 使用promise
- simple-git： 专门执行git

### 串并行
- 串行异步
  - next()
  - for await (const task of taskList) {}
```js
// next()实现串行 类似于koa中间件
// 串行控制分为：按执行顺序注册任务 - start任务
const tasks = [];

const task1 = function(result) {
  return Promise.resolve().then(() => {
    console.log('1', result);
    next(null, 2);
  });
}

const task2 = function(result) {
  return Promise.resolve().then(() => {
    console.log('2', result);
    next(null, 2); // 2是传参
  });
}

// 按顺序注册任务
tasks.push(task1);
tasks.push(task2);

// 串行任务执行控制器 其实就是next一直调用当前任务的next任务 next调用时机在当前任务的异步callback中
function next(err, result) {
  if (err) throw err;

  const curTask = tasks.shift();

  if (curTask) {
    curTask(result);
  }
}


// 启动串行任务
next();
```
- 并行异步
  - for + 计数器
  - promise.all
```js
// 注册任务
// 并行控制分为：按任意顺序注册任务 - start任务
const tasks = [];
let completedTasks = 0; // 计数器 - 已经完completedTasks === tasks.length务数量

const task1 = function(result) {
  return Promise.resolve().then(() => {
    console.log('1', result);
    checkIfCompleted();
  });
}

const task2 = function(result) {
  return Promise.resolve().then(() => {
    console.log('2', result);
    checkIfCompleted();
  });
}

// 按顺序注册任务
tasks.push(task1);
tasks.push(task2);
// 确定任务数量
// 校验：得到结果数量是否 === 任务数量 则全部任务完成
function checkIfCompleted() {
  completedTasks++;
  if (completedTasks === tasks.length) {
    console.log('并行任务完成');
  }
}

// 遍历任务队列 触发任务
for (const task of tasks) {
  task();
}
```

### 实时请求：长连接 ws等 降级方案

### 流的使用

### promiseify + async + TS的引入方案

### webApp + koa原理 + koa常用中间件核心原理
- [koa-server](https://hejialianghe.github.io/node/koa.html#_2-1-2-koa%E6%A6%82%E8%A7%88)
- koa的server写法
  - router的批量注册
  ```js
  // router.js
  const koaRouter = require('koa');
  const router = new koaRouter();
  const routes = require('../route.js');

  routes.forEach(route => {
    const { method, path, handler } = route;
    router[method](path, handler);
  });

  module.exports = router;

  // app.js
  koaApp.use(router);
  ```
  - 参数解析
    - get ctx.request.query.xxx
    - post koa-bodyParser ctx.request.body.xxx
  - 批量注册middleware
  ```js
  // middleware.js
  export {
    middleware1,
    middleware2,
    middleware3
  }
  // app.js
  const compose = require('koa-compose');

  app.use(compose(middlewareList));
  ```
- koa中的中间件写法 
- 常用中间件 作用 + 核心原理
  - koa-router
  - koa-cors
  - koa-bodyparser
  - koa-static
  ```js
  // app.js
  app.use(koaStatic('public')); // 放置一张图片(静态资源) public/test.jpg
  // 浏览器 访问 http://localhost:8080/test.jpg koa-static会自己判断 将jpg文件映射到public目录下
  ```
 - 异常处理
 ```js
 const md = async (ctx, next) => {
   try {
     // xxxx
     await next();
   } catch(err) {
     ctx.status = 500; // http状态码
     ctx.code = 1; // 业务码
     ctx.body = err.msg;
   }
 }
 ```

### koa中间件原理
- [km-中间件原理](https://km.sankuai.com/page/62586005)
  - 其实核心原理 你要理解 在await next()后面的内容，其实等于在next().then()中，也就是洋葱模型的回流执行是resolve中的逻辑在执行：
  ```js
  // async写法的middleware
  const md1 = async (ctx, next) => {
    // 前置逻辑
    await next();
    // 后置逻辑,其实是在next的then中
  }

  // 以上等同于
  const md1 = (ctx, next) => {
    // 前置逻辑
    next().then(() => {
      // 后置逻辑,其实是在next的then中
    });
  }
  ```
- next要求调用队列中下一个middleware，当达到最后一个的时候resolve。这样最后面的promise先resolve，一直到第一个，这样就是洋葱模型的顺序了。
- 注册：use
  - this.middleware.push(md-fn1);
  - return this;
- 启动时机：http.callback中注册一个this.callback(), 所有的请求 都会触发this.callback() 的返回值 this.handleRequest
  在this.handlerequest()中 会start middleware
```js
listen() {
  http.createServer(this.callback());
}

// 实际这里展开是这样的
http.createServer((req, res) => {
  const ctx = this.createContext(req, res);

  // 这里的fn其实就是下面的dispatch(0),就是链式调用的起点
  const fn = this.compose();
  

  return (
    (ctx, fn) => {
      // 省略无关代码...
      const onerror = err => ctx.onerror(err);
      const handleResponse = () => respond(ctx);
      // 省略无关代码...
      // 本质：const fn(ctx) = Promise.resolve(fn(ctx, dispatch(i + 1))); 这里的dispatch(i+1)就是next, 本质上就是Promise.resolver()
      return fn(ctx).then(handleResponse).catch(onerror);
    }
  )();
});

// compose参考如下

// this.callback 中 启动了中间件 

```
- compose: 中间件调度核心：其实就是正向执行结束后 就要执行resolve中的逻辑了，整个过程很像递归，下一层返回了，这一层接着执行
  - 递归的结束条件是：fn是用户传入的：
  ```js
  function compose(middlewares = []) {
    return function(ctx, next) {
      return dispatch(0);

      function dispatch(i) {
        const fn = middleware[i];

        // 到达遍历的终点
        if (i === middleware.length) fn = next; // 其实就是 最后一个middleware的next本身就是undefined 所以 就可以终止了 接下来程序会自己将所有的then执行完
        if (!fn) return Promise.resolve();

        try {
          // 注意 这里返回的是promise 而在中间件中 await next()后的逻辑 实际上就是这个promise.then()中的逻辑
          return Promise.resolve(fn(ctx, dispatch(i + 1)));
        } catch(err) {
          return Promise.reject(err);
        }
      }
    }
  }
  ```
- 关于then的执行 可以这样理解：
```js
md1().then(() => {
  md2().then( () => {
    md3().then( () => {
      // 逆流时 第一个执行 - next()之后的逻辑
    })    
    // 逆流时 第二个执行 - next()之后的逻辑
  })
  // 逆流时 第三个执行 - next()之后的逻辑
})
```

### 日志系统+log4js
  - log4js
    - 配置：日志生成规则 存储目录 命名规则
    - 包装为koa中间件：使用koa-log4

### 解码方案
- 获取编码方式：header.Content-Encoding
- URL编码方式适合处理简单的键值对数据，并且很多框架的Ajax中的Content-Type默认值都是它，但是对于复杂的嵌套对象就不太好处理了，这时就需要JSON编码方式大显身手了。
  客户端发送请求主体时，只需要采用JSON.stringify进行编码。服务器端只需要采用JSON.parse进行解码即可

### node下载一个文件

### node作为客户端发出请求等

### node作为BFF


## 其他
- allowedMethods的作用是？
  - router.allowedMethods()作用： 这是官方文档的推荐用法,我们可以
 * 看到 router.allowedMethods()用在了路由匹配 router.routes()之后,所以在当所有
 * 路由中间件最后调用.此时根据 ctx.status 设置 response 响应头
- 为什么用Chokidar监听文件变化？

## 参考
- [node入门教程-值得一读](http://nodejs.cn/learn/nodejs-buffers)

