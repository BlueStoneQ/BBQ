# 记录
## http
1. 默认情况下，data事件会提供Buffer对象，这是Node版的字节数组。而对于文本格式的待 办事项而言，你并不需要二进制数据，所以最好将流编码设定为ascii或utf8;这样data事件 会给出字符串。这可以通过调用req.setEncoding(encoding)方法设定
2. 为了提高响应速度，如果可能的话，应该在响应中带着Content-Length域一起发送。对于 事项清单而言，响应主体很容易在内存中提前构建好，所以你能得到字符串的长度并一次性地将 整个清单发出去。设定Content-Length域会隐含禁用Node的块编码，因为要传输的数据更少， 所以能提升性能。
```js
res.set('Content-Length', Buffer.byteLength(body)) 
// 当然 我们也可以用stat.size来设置content-length
res.set('Content-Length', stat.size) 
res.end(body)
```
你可能想用body.length的值设定Content-Length，但Content-Length的值应该是字 节长度，不是字符长度，并且如果字符串中有多字节字符，两者的长度是不一样的。为了规避这 个问题，Node提供了一个Buffer.byteLength()方法
3. 所有继承了EventEmitter的类都可能会发出error事件:可以在error事件中返回Browser错误：
```js
res.statusCode = 500;
res.end("server error")
```
4. 基于文件的存储虽然易用，但并不是所有程序都适合。比如说，一个多用户程序如果把记 录保存在一个文件中，可能会碰到并发问题。两个用户可能会同时加载相同的文件进行修改。 保存一个版本会覆盖另外一个，导致其中某个用户的修改丢失。对于多用户程序而言，数据库 管理系统是更合理的选择，因为它们就是为应对并发问题而生的。
5. me: 监听并处理error事件，是node很重要的一环
## Connect
1. 当一个组件不调用next()时，命令链中的后续中间件都不会被调用。
2. 为了向开发人员提供可配置的能力，中间件通常会遵循一个简单的惯例:用函数返回另一个 函数(这是一个强大的JavaScript特性，通常称为闭包)。这种可配置中间件的基本结构看起来 是这样的:
```js
function setUp(options) {
    return function(req, res, next) {}
}
```
3. 因为程序里中间件的数量没有限制，中间件组件使用的次数也没有限制，所以在一个程序中 有可能会定义几个路由器。这样可能更有利于组织。比如你既有跟用户相关的路由，也有跟管理 员相关的路由。则可以把它们分到不同的模块文件中，在路由器组件中分别引入, 一般router-middleWare注册在组件队列的最后
4. 所有程序都有错误，不管在系统层面还是在用户层面。为错误状况，甚至是那些你没预料到 的错误状况而未雨绸缪是明智之举
5. 但在任何实际的程序中，你很可能都会对那些错误做些特殊的 处理，比如将它们发送给一个日志守护进程。
6. 路由中间件设计：
    1. 防御：防止无效路由，无效 -> next()
    2. route: 从url中解析出route
    3. 利用route在route-config中找到该路由对应的处理程序(一般是嵌套路由 或者 handler函数list)
    4. 从url中解析出参数，生成格式化参数，调用该路由匹配的handlers, 并且传入参数
7. 构建大量微小的、模块化的、可重用的中间件组件， 合起来搭成你的程序。保持中间件的小型化和专注性真的有助于将复杂的程序逻辑分解 成更小的组成部分。
8. 关于错误处理中间件
### session
- 从默认的内存存储到基于Redis、MongoDB、CouchDB和cookies的存储
    - 在开发和生产期间，最好有一个持久化的、可扩展的数据存放你的会话数据。
- 核心概念：
    - 会话有效期
### 认证 basicAuth
- 认证方法：
    - 用户名 + 密码
    - 注册一个回调(认证函数)
        - 在请求过来的时候 走到basic这里 会执行该认证函数 确认是否通过认证
        - 认证函数返回 true / false
        - 剩下的交给basicAuth处理
    - 异步回调
        - 注册的认证函数 通过认证后 可以调用认证函数通过pramas注入的callback方法 表示注册
        - 认证失败：callback(err)
        - 认证成功：callback(unll, user)
### csrf()
- csrf()会生成一个包含24个字符的唯一ID，认证令牌，作为req.session._csrf附到用户 的会话上。然后这个令牌会作为隐藏的输入控件_csrf出现在表单中，CSRF在提交时会验证这个令牌。这个过程每次交互都会执行。
### errorHandler
### compress():压缩静态文件
- compress()组件通过请求头域Accept-Encoding自动检测客户端可接受的编码。如果请求 头中没有该域，则使用相同的编码，也就是说不会对响应做处理。如果请求头的该域中包含gzip、 deflate或两个都有，则响应会被压缩。
## Express
### 根据环境变量设置
```js
// 所有环境
expressApp.configure(function() {
    expressApp.use()
})
// dev环境
expressApp.configure('dev', function() {
    expressApp.use()
})
```
### 认证
### 分页
### RestApi
### 内容协商
### 错误处理
- 通常来说，不应该把错误细节透漏给客户端，因为可能会暴露安全漏洞
- 方案1: 错误中间件一般放在洋葱的核心，或者注册在中间件队列的队尾，其他组件的err都是通过next传递下去？
    - 官方推荐：在洋葱内侧处理：https://www.expressjs.com.cn/zh-cn/guide/error-handling.html
    - Express 随附一个内置的错误处理程序，负责处理应用程序中可能遇到的任何错误。这个缺省的错误处理中间件函数添加在中间件函数集的末尾。
        - 如果将错误传递到 next() 且未在错误处理程序中进行处理，那么该错误将由内置的错误处理程序处理；错误将写入客户机的堆栈跟踪内。堆栈跟踪不包含在生产环境中。
        - 如果在开始写响应之后调用 next() 时出错（例如，如果在以流式方式将响应传输到客户机时遇到错误），Express 缺省错误处理程序会关闭连接并使请求失败。
- 方案2: error-middleware放在洋葱外层，通过try catch 在catch中收集到里层中间件throw出来的err并做统一处理？
    - 这个方案适合koa: https://demopark.github.io/koa-docs-Zh-CN/error-handling.html
        - 因为koa使用了async await, 所以可以使用try catch来捕获冒泡上来的错误
- 方案3: koa错误处理：
    - 错误事件侦听器可以用 app.on('error') 指定。如果未指定错误侦听器，则使用默认错误侦听器。错误侦听器接收所有中间件链返回的错误，如果一个错误被捕获并且不再抛出，它将不会被传递给错误侦听器。如果没有指定错误事件侦听器，那么将使用 app.onerror，除非 error.expose 为 true 或 app.silent 为 true 或 error.status 为 404，否则只简单记录错误。
#### 404错误
- 404中间件函数就 是用在其他所有中间件函数之后的普通函数。如果到它那里了，你可以肯定不会有其他任何东西 想要给出响应了，所以你可以继续向前，渲染一个模板，或者以你喜欢的方式响应。
```js
// express 
res.render('404')
```
- 关于res.render:
```js
//设计模板引擎   ejs
app.set("views","mb");//设置需要渲染的目录下模板文件
// 在mb/下有一个404.ejs模版文件
app.set("view engine","ejs");
app.get("/",function(req,res){
    res.render("404",{
        news:['1','2']
    });
    app.listen(3000)
```
### express.logger
- 程序的需求取决于它所运行的环境。比如说，当你的产品处于开发环境中时，你可能想要详 尽的日志，但在生产环境中，你可能想要精简的日志和gzip压缩
## Redis
1. 关系型DBMS为可靠性牺牲了性能，但很多NoSQL数据库把性能放在了第一位。因此， 对于实时分析或消息传递而言，NoSQL数据库可能是更好的选择。NoSQL数据库通常也不需要 预先定义数据schema，对于那种要把数据存储在层次结构中，但层次结构却会发生变化的程序而 言，这很有帮助。
2. Redis非常适合处理那些不需要长期访问的简单数据存储，比如短信和游戏中的数据。Redis 把数据存在RAM中，并在磁盘中记录数据的变化。这样做的缺点是它的存储空间有限，但好处 是数据操作非常快。如果Redis服务器崩溃，RAM中的内容丢了，可以用磁盘中的日志恢复数据。
3. 信道：
    - Redis超越了数据存储的传统职责，它提供的信道是无价之宝。信道是数据传递机制，提供 了发布/预定功能，其概念如图5-7所示。对于聊天和游戏程序来说，它们很实用
    - Redis客户端可以向任一给定的信道预订或发布消息。预订一个信道意味着你会收到所有发 送给它的消息。发布给信道的消息会发送给所有预订了那个信道的客户端。
## MongoDB
1. MongoDB是一个通用的非关系型数据库，使用RDBMS的那类程序都可以使用MongoDB
2. 
## 命令行
1. 跟所有终端程序一样，你可以用引号把中间有空格的参数合成一个参数
2. 打印彩色：console.log('\033[32mhello\033[39m')
# children_process
## 主进程和子进程通信
1. **主进程监听子进程的 'message' 事件**：子进程可以通过 `process.send()` 方法发送消息给主进程，主进程可以通过监听 `process.on('message')` 事件来接收这些消息。


```javascript
// 子进程
process.send('Hello from child process!');

// 主进程
process.on('message', (message) => {
  console.log(`Received message from child: ${message}`);
});
```
2. **使用 `child_process` 模块**：可以使用 `child_process` 模块创建子进程，并使用它的 `stdin`、`stdout` 和 `stderr` 属性进行通信。例如：


```javascript
const { spawn } = require('child_process');
const subprocess = spawn('node', ['child.js']);

subprocess.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

subprocess.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

subprocess.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
```
在上面的例子中，我们创建了一个子进程来运行 `child.js` 文件。子进程的标准输出和错误输出被连接到主进程的相应事件监听器上，这样主进程就可以读取子进程的输出。当子进程结束时，主进程会接收到一个 'close' 事件。
3. **使用 `net` 模块建立 TCP 连接**：如果你需要在主进程和子进程之间传输更复杂的数据，比如大文件或者实时数据，可以考虑使用 `net` 模块建立 TCP 连接。这需要更多的编程工作，但是可以实现更复杂的通信需求。
4. **使用 `ipc` 模块**：在主进程和渲染进程之间可以使用 `ipc` 模块进行通信。渲染进程可以通过 `ipc` 模块发送同步或异步消息给主进程，主进程也可以通过 `ipc` 模块发送消息给渲染进程。这种方式主要用于在主进程和渲染进程之间共享一些数据或者进行一些同步操作。
5. **使用 `SharedArrayBuffer` 和 `postMessage`**：这是一种更现代的方式，可以在主进程和子进程之间传递更复杂的数据类型。通过 `SharedArrayBuffer` 可以共享一块内存，然后通过 `postMessage` 和 `on('message')` 可以在不同的进程之间传递消息。这种方式需要更多的编程工作，但是可以实现更复杂的通信需求。
## process
1. 因为stderr通常是调试时用的，不会用来发送结构化数据，也不会构建管道，所以一般都不会直接访问process.stderr，而是使用console.error()
## npm
1. 引入一个未发布的私有库：
```json
// package.json
"dependence" : {
    "my-npm-package": "git://github.com/my-npm-package/my-npm-package.git"
}
```
```js
# node args.js "aa is qq"
// 得到参数 process.args[2] === "aa is qq"
```
# 问题驱动
## exec 和 execFile 的 区别？
1. 有时候你需要缓冲命令的输出，但希望Node可以自动帮你转义参数，这时可以用execFile() 函数。
## IPC通道？ fork ?
## http.get ?
## stdin.resume & pause ?