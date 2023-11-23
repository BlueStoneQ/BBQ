# cluster
- Node.js 的 cluster 模块允许创建一组进程，其中一个进程作为主进程（Master），其余进程作为工作进程（Slave）。工作进程可以创建多个，每个进程都可以处理不同的任务，从而提高了应用程序的性能。
下面是一个简单的多 Slave 进程的 Slave-Master 模型的例子：
```js
// 引入 cluster 模块  
const cluster = require('cluster');  
const numCPUs = require('os').cpus().length; // 获取 CPU 核心数  
  
if (cluster.isMaster) { // 如果当前进程是 Master 进程  
    console.log(`Master ${process.pid} is running`);  
  
    // 监听 SIGINT 信号，当 master 进程接收到这个信号时，会先通知所有的 worker 进程关闭，然后再关闭 master 进程自身  
    process.on('SIGINT', () => {  
        console.log(`Caught interrupt signal, but I will still exist until all workers are gone.`);  
        cluster.disconnect(() => { 
            process.exit(0);
        });  
    });  
  
    // 创建 numCPUs 个 Slave 进程  
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork(); // fork() 方法用于创建新的工作进程，并返回该进程的 id
    }
  
    cluster.on('exit', (worker, code, signal) => { // 当一个 Slave 进程退出时，重新创建它
        console.log(`worker ${worker.process.pid} died`);  
        cluster.fork(); // fork() 方法用于创建新的工作进程，并返回该进程的 id  
    });
} else { // 如果当前进程是 Slave 进程  
    console.log(`Slave ${process.pid} started`);  
    // 在这里添加你的应用程序代码，比如监听特定的端口等  
}
// 这个例子中，我们首先通过 require('os').cpus().length 获取 CPU 的核心数，然后创建相应数量的 Slave 进程。Master 进程主要负责创建 Slave 进程和管理它们的状态。当一个 Slave 进程退出时，Master 进程会重新创建一个新的 Slave 进程。这样可以保证始终有相应数量的 Slave 进程在工作。当 Master 进程接收到 SIGINT 信号时，它会先通知所有的 Slave 进程关闭，然后再关闭自身。在Slave 进程中，你可以添加你的应用程序代码，比如监听特定的端口等
```

## 如何用cluster处理高并发
使用集群（cluster）来处理高并发是一种常见的方法，它可以提高服务器的处理能力，降低响应时间。下面是一个使用Node.js的cluster模块来处理高并发的简单示例。
```javascript
// 这里配合koa
const cluster = require('cluster');  
const Koa = require('koa');  
const app = new Koa();  
const http = require('http');  
const numCPUs = require('os').cpus().length;  
  
if (cluster.isMaster) {  
  console.log(`Master ${process.pid} is running`);  
  
  // Fork workers.  
  for (let i = 0; i < numCPUs; i++) {  
    cluster.fork();  
  }  
  
  cluster.on('exit', (worker, code, signal) => {  
    console.log(`worker ${worker.process.pid} died`);  
  });  
} else {  
  // Workers can share any TCP connection  
  // In this case, it is an HTTP server.  
  http.createServer(app.callback()).listen(8000);  
  
  console.log(`Worker ${process.pid} started`);  
}
}
```
- 这个例子中，我们首先通过 `require('os').cpus().length` 获取到服务器的CPU数量，然后通过 `cluster.fork()` 创建相应数量的子进程。在每个子进程中，我们创建一个HTTP服务器，监听8000端口。当有HTTP请求到达时，子进程会处理请求并返回 "Hello world" 的响应。
- 在master进程中，我们监听子进程的 'exit' 事件，以便在子进程退出时进行相应的处理。这样，master进程和子进程协同工作，可以有效地处理高并发请求。
- 注意：这只是一个简单的例子，实际生产环境中可能还需要处理更多的情况，例如错误处理、负载均衡等。另外，集群只能解决CPU密集型的高并发问题，如果是I/O密集型的高并发问题，可能需要使用其他的方法，例如使用异步I/O库，或者使用消息队列等。

## 一般我们在cluster的exit事件中处理什么问题
在Node.js的cluster模块中，'exit'事件是在worker进程退出时由master进程触发的事件。在'exit'事件的处理程序中，我们通常进行一些资源清理和记录工作，例如：记录日志、关闭数据库连接、清理临时文件等。

以下是一个示例：


```javascript
cluster.on('exit', (worker, code, signal) => {
  console.log(`worker ${worker.process.pid} died`);
  // 在这里进行资源清理和记录工作
});
```
在上面的代码中，当worker进程退出时，master进程会触发'exit'事件，并将worker对象、退出码和信号传递给事件处理程序。我们可以使用这些信息来记录一些有用的信息，例如worker进程的PID、退出码和信号等。

另外，我们还可以在'exit'事件的处理程序中进行一些资源清理工作，例如关闭数据库连接、清理临时文件等。这些操作可以确保在worker进程退出时，不会留下任何未清理的资源，从而避免资源泄漏和不必要的内存占用。

需要注意的是，在'exit'事件的处理程序中，我们应该避免执行任何阻塞性的操作，因为这可能会导致master进程无法快速地处理其他事件，从而影响服务器的性能。

# fs
## 判断路径为目录 stat + isDir
```js
fs.lstatSync(path).isDirection()
```

## 递归遍历目录
```js
// 同步版: traverse + visitor设计
const fs = require('fs');
const path = require('path');

const walk = (curPath, visitor) => {
    if (!fs.lstatSync(curPath).isDirectory()) {
        visitor.visitNode(curPath);
        return;
    }
    
    fs.readdirSync(curPath).forEach((childPath) => {
        walk(path.join(curPath, childPath), visitor);
    });
}

walk(process.cwd(), {
    visitNode(curPath) {
        console.log(curPath)
    }
});
```

## try catch block & return
```js
try {
// block1
} catch(err) {   
    return;
}

try {
// block2
} catch(err) {   
    return;
}
```