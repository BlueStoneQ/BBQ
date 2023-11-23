# 资料
- 《koa2与Nodejs实战》
  - https://github.com/ikcamp
# 目录结构设计
```
以koa-generator生成的参考：https://zhuanlan.zhihu.com/p/150684329
```
- app.js
- bin/www
- routes
- views
- public
- controller
- model

# ctx
- ctx.request
  - method
  - url
  - query
  - queryString
  - url中参数获取: 'home/:id/:name' => ctx.params.id/name
  - post请求 -> koa-bodyparser -> ctx.request.body/rawBody
  - accepts('json') // 判断客户端request.head.Accept
- ctx.response
  - status
  - type // response.head.conten-type
  - body
    - 当 ctx.body 被赋值后，Koa 会立即将响应发送给客户端，并且停止继续调用后续的中间件。
  - ctx.state
  - ctx.cookies
  - ctx.throw
    - 当调用 ctx.throw 时，Koa 会将错误信息封装成一个 KoaError 对象，并发送给客户端。这个对象包含了一些关于错误的详细信息，例如错误状态码（status）、错误消息（msg）和错误属性（properties）。在中间件的链式调用中，如果某个中间件调用了 ctx.throw 方法，Koa 会立即中断后续中间件的执行，并将错误信息发送给客户端。因此，ctx.throw 会中断链式调用。
  - ctx.set('Content-Type', "application/json")
# 中间件
- koa-bodyparser
```js
// koa-bodyparser实现原理
app.use(async (ctx, next) => {
  let postDataStr = '';
  ctx.req.on('data', data => postDataStr += data);
  ctx.req.on('end', () => ctx.request.body = JSON.parse(postDataStr));
})
```
- 上传文件：@koa/multer multer
```js
app.use(koaMulter)
// route
router.get('home', controller.home);
// controller
controller.home = async (ctx, next) => {
  // ctx会调用之前注册好的模版nunjucks
  await ctx.render('home', {
    value1: '插入的变量1'
  });
}
```
- koa-json
```js
app.use(koaJson)
// koa-json会自动做的事情：
// ctx.set("Content-Type", "application/json")
// ctx.body = JSON.stringify(res)
ctx.body = { foo: 1 };
```
# route
# error处理
- 部分错误展示为错误页：
```js
const numjucks = require('numjucks');

koaApp.on('error', (err, ctx) => {
  ctx.response.status = err.code || 500;
  ctx.body = await numjucks.render(/**...*/);
})
```
- 部分错误直接返回(api返回错误)：status + body
```js
ctx.body = err.message;
```
- 错误的处理还有一个两种方式：
  - 使用ctx.throw(err) + app.on('error', (err, ctx) => {}) 来来作为可以预测的拦截
  - 通过在中间件的最外层注册error-handle中间件来拦截没有考虑到的或者非用ctx.throw抛出来的错误：
  ```js
  // error Middleware creator
  const errorHandlerCreator = () => {
    return async (ctx, next) => {
      try {
        await next();
      } catch(err) {
        // 响应client端
        ctx.status = err.status || 500;
        ctx.body = await nunjucks.render('errPage');
        // 将错误传递给其他监听koaApp.on('error')的中间件去处理,例如记录上报日志
        ctx.app.emit('error', err, ctx);
      }
    }
  }

  // 错误中间件注册在最前面
  koaApp.use(errorHandlerCreator());

  koaApp.on('error', (err, ctx) => {
    // handler err: 好比记录上报日志
  })
  ```
- 当一个中间件函数抛出错误时，Koa会捕获这个错误并传递给下一个中间件函数。如果下一个中间件函数没有处理错误，Koa会将错误传递给下一个中间件函数，依此类推，直到找到一个处理错误的中间件函数或者达到应用程序的末尾。
ctx.app.emit('error', err, ctx) 这行代码的作用是手动触发一个名为"error"的事件，并将错误对象和上下文对象作为参数传递给事件处理函数。这样做的目的是为了提供一种自定义错误处理机制的机会。通过监听"error"事件，可以编写自己的错误处理逻辑，例如记录错误日志、发送错误报告或者返回友好的错误页面等。
- 一般而言，ctx.app.emit('error', err, ctx) 用于处理以下场景：
  - 中间件函数发生错误：当一个中间件函数在执行过程中出现错误，可以通过抛出异常或者返回一个错误状态码来标记错误。此时，Koa会将错误传递给下一个中间件函数，直到找到一个处理错误的中间件函数或者达到应用程序的末尾。
  - 自定义错误处理：如果需要在应用程序中实现自定义的错误处理逻辑，可以使用 ctx.app.emit('error', err, ctx)
# logger
# 优化部署与云
## 性能指标
## 性能指标优化
# 单元测试
# 登录
- 小程序的登录：
  - 小程序向微信native获取code+appid -> 发起请求：开发者服务器 -> 请求微信接口服务：获得openid等账户信息
  -> 将openid存在DB: User表中，和用户关联起来 -> 生成一个自定义登录凭证：JWT （里面payload中有db.User.id+timeStamp:用来校验是不是超时）
  -> 将JWT发给小程序，小程序存在cookie或者其他storage中
# 鉴权
## cookie
在Koa.js框架中，可以使用中间件**koa-cookie-parser**来解析和设置cookie。以下是使用koa-cookie-parser中间件设置和获取cookie的示例：

- 安装koa-cookie-parser中间件：

```shell
npm install koa-cookie-parser --save
```
在应用程序中使用koa-cookie-parser中间件：

```javascript
const Koa = require('koa');  
const cookieParser = require('koa-cookie-parser');  
  
const app = new Koa();  
app.use(cookieParser());
```
- 设置cookie：
在设置cookie时，使用ctx.cookies.set()方法。该方法接受三个参数：cookie名称，cookie值和选项对象。例如，以下代码将设置一个名为session_id的cookie，其值为随机生成的字符串：
```javascript
app.use((ctx, next) => {  
  const sessionId = Math.random().toString(36).substring(7);  
  // ctx.cookies.set原生的操作cookie的方法，parser仅仅是将cookie字符串解析为对象，底层应该可以使用ctx.set("Set-Cookie")
  ctx.cookies.set('session_id', sessionId);  
  next();  
});
```
- 获取cookie：
在获取cookie时，使用ctx.cookies.get()方法。该方法接受两个参数：cookie名称和选项对象。例如，以下代码将获取名为session_id的cookie的值：
```js
app.get('/get-cookie', (ctx) => {
  // 底层：ctx.get("Cookie")
  const sessionId = ctx.cookies.get('session_id');  
  ctx.body = `Session ID cookie value: ${sessionId}`;  
});
```
在上面的示例中，ctx.cookies.get()方法将返回名为session_id的cookie的值。如果该cookie不存在，则返回undefined。
## session
- sessio是一个概念，一个方式，并不是http中有session这个东西
- session既可以使用内存变量，也可以使用redis等进行存储
  - 例如 koa-redis 和 koa-redis-session。这些库提供了将 Redis 作为会话存储后端的支持，并提供了更多的会话管理功能，例如更长时间的会话持久性、会话共享等。
- seesion一般搭配cookie来存储session—id
- 步骤：
- 安装koa-session中间件
首先，需要安装koa-session中间件。可以使用npm或yarn来安装它：
```shell
npm install koa-session
```
或者

```shell
yarn add koa-session
```
引入koa-session中间件
在你的应用程序文件中，引入koa-session中间件：
```javascript
const Koa = require('koa');  
const session = require('koa-session');  
  
const app = new Koa();  
app.keys = ['some secret hurr']; // 设置一个密钥用于签名会话ID，需要是数组形式，至少一个。  
app.use(session());
```
设置会话数据
在任何路由或中间件中，你可以通过ctx.session对象来设置和获取会话数据：
```javascript
app.use(async ctx => {  
  ctx.session.username = 'example'; // 设置会话数据  
  console.log(ctx.session.username); // 获取会话数据  
});
```
禁用会话数据自动序列化/反序列化
默认情况下，koa-session会自动序列化/反序列化会话数据，这可能会导致一些问题。因此，建议禁用这个功能：
```javascript
// 通过配置项key来指定会话ID在cookie中的键名
app.use(session({  
  key: 'myapp_session_id', // 将键名设置为'myapp_session_id',会话ID存储在cookie中的键名。默认情况下，key的值为koa:sess  
  maxAge: 86400000, // 设置会话ID存储在cookie中的过期时间为86400000毫秒  
  autoCommit: true, // 自动将会话数据提交到响应头中  
  overwrite: true, // 是否允许重写会话数据  
  signed: true, // 是否签名会话ID  
  rolling: false, // 是否每次响应时刷新会话的有效期  
}));
// 会话ID存储在cookie中的过期时间（毫秒）。可选。默认值：null（即默认cookie的过期时间）。如果需要设置特定的过期时间，也可以使用 timeout 或者 cookie 的 maxAge 配置项。如果 maxAge 是 'false'，则 cookie 将不会过期。如果 maxAge 是 'true'，则等同于默认值 'null'。如果 maxAge 是其他值，那么它将被用作 cookie 的 maxAge 值（以秒为单位）。例如：设置1小时后过期，可以设置maxAge为3600000。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null。可选。 默认值：null（无过期时间）。可选（默认为 false）。
```
通过设置key的值，可以自定义会话ID在cookie中的键名，以便更好地适应应用程序的需求。
## JWT
在Koa.js中使用JWT（JSON Web Tokens）进行身份验证和授权是一个常见的做法。下面是一个简单的示例，展示如何在Koa.js应用程序中使用JWT。
首先，确保已经安装了koa-jwt2库。你可以使用npm或yarn来安装它：
```shell
npm install koa-jwt2
```
或者
```shell
yarn add koa-jwt2
```
接下来，在你的Koa.js应用程序中引入koa-jwt2中间件，并配置它以使用你的JWT密钥和令牌。
```javascript
const Koa = require('koa');  
const jwt = require('koa-jwt2');  
  
const app = new Koa();  
  
// 配置JWT密钥和令牌  
const secretKey = 'your-secret-key'; // 替换为你的密钥  
const token = 'your-token'; // 替换为你的令牌，令牌就是jwt: head.body.signature的字符串
// 本质上 koa-jwt做的事情就是按照jwt的规则设计：将请求中携带的token中的body + server端保存的secret按照head中的算法计算得出signature2 和携带的signature比对，看是否一致，一致则是合法用户
  
// 使用JWT中间件  
app.use(jwt({ secretKey, token }));
```
现在，你可以在路由中使用JWT进行身份验证和授权。下面是一个示例路由，它使用JWT验证用户的身份：

```javascript
app.use(async (ctx, next) => {  
  // 获取存储在请求中的用户信息（如果有的话）  
  const user = ctx.state.user;  
  if (!user) {  
    // 如果用户不存在，则检查请求中是否包含令牌（token）  
    const token = ctx.request.headers['authorization']; // 从请求头中获取令牌（可选）  
    if (token) {  
      // 鉴权
      try {  
        // 解码令牌并验证其有效性  
        const decoded = jwt.verify(token, secretKey); // 使用JWT密钥解码令牌（可选）  
        if (decoded) {  
          // 如果令牌有效，则将用户信息存储在请求上下文中（ctx.state.user）  
          ctx.state.user = decoded; // 将用户信息存储在ctx.state.user中（可选）  
        } else {  
          // 如果令牌无效，返回错误响应或进行其他处理（可选）  
          ctx.status = 401; // 返回401未授权状态码（可选）  
          return; // 停止进一步处理该请求（可选）  
        }  
      } catch (error) {  
        // 处理解码令牌时发生的错误（可选）  
        console.error('Error decoding JWT:', error); // 打印错误日志（可选）  
      }  
    } else {  
      // 如果请求中没有令牌，返回错误响应或进行其他处理（可选）  
      ctx.status = 401; // 返回401未授权状态码（可选）  
      return; // 停止进一步处理该请求（可选）  
    }  
  } else {  
    // 如果用户已经存在于请求上下文中（ctx.state.user），则继续处理请求（可选）  
  }  
  await next(); // 继续处理后续中间件和路由处理函数（可选）  
});
```
- eg2:
```js 
// 鉴权中间件  
const anthMiddleware = async (ctx, next) => {  
  const token = ctx.request.headers.authorization; // 从请求头中获取token  
  
  if (!token) {  
    ctx.throw(401, 'Unauthorized'); // 没有token则返回401错误  
  } else {  
    const user = await authenticate(token); // 调用鉴权函数验证token  
    if (!user) {  
      ctx.throw(403, 'Forbidden'); // 鉴权失败则返回403错误  
    } else {  
      ctx.state.user = user; // 将鉴权成功的用户信息放入ctx.state中  
      await next(); // 继续执行下一个中间件或路由处理函数  
    }  
  }  
};
```

# 专项
## koa-static
要实现一个简单的Koa-static中间件，你需要使用Node.js和Koa框架。下面是一个基本的Koa-static中间件实现，包括错误处理、MIME类型匹配和设置大文件响应的功能。

```javascript
// 设置静态资源目录和最大文件大小  
const staticDir = path.join(__dirname, 'public');  
const maxFileSize = 1024 * 1024 * 10; // 10 MB  
  
// 定义中间件函数  
async function koaStatic(dir) {  
  return async (ctx, next) => {  
    const file = ctx.request.path;  
    const filePath = path.join(dir, file);  
  
    // 检查文件是否存在  
    try {  
      const stats = fs.statSync(filePath);  
      if (!stats.isFile()) {  
        ctx.throw(404, 'File not found');  
        return;  
      }  
    } catch (err) {  
      ctx.throw(500, 'Internal server error');  
      return;  
    }  
  
    // 检查文件大小是否超过限制  
    try {  
      const fileSize = fs.statSync(filePath).size;  
      if (fileSize > maxFileSize) {  
        ctx.throw(413, 'Request entity too large');  
        return;  
      }  
    } catch (err) {  
      ctx.throw(500, 'Internal server error');  
      return;  
    }  
  
    // 读取文件内容并设置响应头信息  
    const fileStream = fs.createReadStream(filePath);  
    ctx.set('Content-Type', getMimeType(file));  
    ctx.body = fileStream;  
  };  
}  
  
// 获取MIME类型的方法（根据文件扩展名）  
function getMimeType(file) {  
  const extname = path.extname(file).toLowerCase();  
  const mimeTypes = {  
    '.html': 'text/html',  
    '.js': 'text/javascript',  
    '.css': 'text/css',  
    '.png': 'image/png',  
    '.jpg': 'image/jpg',  
    '.gif': 'image/gif',  
  };  
  return mimeTypes[extname] || 'application/octet-stream';  
}  
  
// 错误处理中间件函数  
async function errorHandler(ctx, next) {  
  try {  
    await next();  
  } catch (err) {  
    ctx.status = err.status || 500;  
    ctx.body = `<h1>${err.message}</h1><p>Internal server error</p>`;  
    ctx.app.emit('error', err, ctx); // 将错误事件传递给其他中间件处理（例如日志记录）  
  }  
}  
  
// 配置Koa应用程序中间件顺序和路由规则（如果需要）  
app.use(errorHandler); // 将错误处理中间件放在最前面，以便捕获所有错误并统一处理。其他中间件可以根据需要添加。
```

## 文件上传
在Koa中，Multer是一个中间件，用于处理Multipart/form-data类型的表单数据，它主要用于上传文件。

Multer在内部使用formidable模块来解析multipart/form-data类型的数据。当请求包含一个或多个文件时，Multer会接管这些文件并将其保存在临时目录中，同时将文件信息存储在ctx.request.files对象中。

下面是一个简单的Multer实现示例：

```javascript
const Router = require('@koa/router');  
const bodyParser = require('koa-bodyparser');  
  
const app = new Koa();  
const router = new Router();  
  
// 创建Multer中间件并设置保存上传文件的目录  
const multer = async (ctx, next) => {  
  const file = ctx.request.files.file; // 获取上传的文件  
  const filePath = path.join(__dirname, 'uploads', file.name); // 拼接保存文件的路径  
  // 🔥在Koa中，ctx.request.files.file.path本质上是临时文件的路径。当客户端上传文件时，Koa中间件会接收这些文件，并将其保存在临时目录中。ctx.request.files.file.path就是指向这个临时文件的路径。在处理完文件之后，通常需要将文件从临时目录移动到其他位置进行存储。
  fs.createReadStream(file.path).pipe(fs.createWriteStream(filePath)); // 将文件保存到指定目录  
  ctx.body = 'File uploaded successfully.'; // 返回上传成功的信息  
};  
app.use(multer);  
  
// 创建路由以处理文件上传请求  
router.post('/upload', (ctx) => {  
  ctx.request.files = { file: [] }; // 设置ctx.request.files对象以接收上传的文件  
  ctx.body = 'Please upload a file.'; // 返回提示信息  
});  
  
app.use(router.routes());  
app.listen(3000, () => { console.log('Server started on port 3000'); });
// 在这个示例中，我们创建了一个简单的Multer中间件。当收到包含文件的POST请求时，Multer会保存文件到指定的目录，并将文件信息存储在ctx.request.files对象中。然后，应用程序会返回一个成功消息。请注意，这只是一个简单的示例，实际应用中可能需要更多的错误处理和验证步骤。
```

## 大文件断点续传
文件断点续传是一种在下载或上传过程中，如果发生中断，能够继续下载或上传文件的技术。它允许用户在上传或下载中断后恢复操作而不必重新开始。

具体来说，在下载时，如果网络中断导致下载未能完成，使用断点续传技术可以将下载任务划分为几个部分，然后重新上传已下载的部分，而不需要重新下载整个文件。同样，在上传时，如果文件过大导致上传未能完成，使用断点续传技术可以将文件划分为几个部分，然后分别上传，并在最后在服务器端合并文件。这样，即使上传过程中出现中断，也能够继续上传而不需要重新开始整个上传过程。

总之，文件断点续传是一种提高文件下载或上传效率的技术，它能够节省时间和流量，同时也提高了用户体验。

### 文件断点续传：下载
文件断点续传在下载时的工作原理如下：

1. 客户端向服务器发送支持断点续传的请求，请求中包含要下载的文件名或其他标识符。
2. 服务器响应请求，并返回一个已经上传的位置标记（position）给客户端。这个位置标记告诉客户端从哪个字节开始接收文件。
3. 客户端将接收到的文件部分与之前已经下载的部分进行合并，直到整个文件被下载完成。

在断点续传中，客户端和服务器之间需要建立一种协议来支持断点续传。例如，HTTP协议中的Range请求头和Accept-Range响应头就是一种常用的协议。客户端使用Range请求头告诉服务器要下载的文件的字节范围，而服务器则使用Accept-Range响应头告诉客户端可以接受的字节范围。这样，如果下载过程中出现中断，客户端可以重新发送请求并从之前已经下载的部分开始接收新的数据，从而实现断点续传。

此外，一些下载工具还会采用多线程下载技术来提高下载速度。这些工具会将文件划分为多个部分，并使用不同的线程同时下载不同的部分。这样可以充分利用带宽和计算机资源，从而更快地完成文件下载。

总之，文件断点续传在下载时通过协议和技术的支持，实现了在下载中断后能够继续下载而不需要重新开始整个下载过程的功能。

- Koa中的断点续传-下载的处理方案：koa-send
在Koa中实现文件断点续传可以使用`koa-send`中间件。`koa-send`中间件可以处理客户端的请求，并发送文件到客户端。它支持断点续传和浏览器端下载功能，可以根据客户端的请求信息，判断是否支持断点续传，并返回相应的文件内容。

使用`koa-send`中间件实现文件断点续传的步骤如下：

1. 安装`koa-send`中间件：使用npm或yarn安装`koa-send`中间件。


```shell
npm install koa-send
```
2. 在Koa应用中引入`koa-send`中间件：在Koa应用的文件中引入`koa-send`中间件。


```javascript
const send = require('koa-send');
```
3. 在Koa应用中使用`koa-send`中间件：在Koa应用的中间件中调用`send`函数，并传入要发送的文件路径和选项作为参数。选项可以包括`root`（指定文件根目录）、`maxage`（指定缓存时间）等。


```javascript
app.use(async (ctx, next) => {
  await next();
  if (ctx.path === '/file') {
    ctx.body = await send(ctx.req, ctx.path, { root: '/path/to/files', maxage: 86400 });
  }
});
```
在上面的示例中，当客户端请求路径为`/file`的资源时，Koa应用会使用`koa-send`中间件发送文件到客户端。`root`选项指定了文件根目录，而`maxage`选项指定了缓存时间。

通过使用`koa-send`中间件，Koa应用可以实现文件断点续传和浏览器端下载功能，提高文件上传和下载的效率和稳定性。

- 在浏览器中设置断点续传通常需要服务器和客户端的协同处理。具体步骤如下：

1. 在服务器端，需要支持断点续传功能。后端服务器需要配置断点续传支持，当接收到下载请求时，检查是否包含 Range 请求头。如果包含 Range 请求头，则解析出请求中指定的文件范围，并返回对应范围内的文件数据和正确的 Content-Range 响应头。如果不包含 Range 请求头，则正常返回整个文件内容。
2. 在客户端，需要实现请求的逻辑。当需要下载大文件时，浏览器会先发送一个只包含 Range 请求头的请求，以确定服务器是否支持断点续传。如果服务器支持断点续传，则从已经下载的部分开始继续下载；如果不支持，则直接保存整个文件。

以上信息仅供参考，可以查阅专业的技术文档获取更准确更全面的信息。
- 文件断点续传涉及到的HTTP头包括请求头和响应头。

请求头：

1. Range：用于指定请求的字节范围。例如，“Range: bytes=0-1”表示请求开头的2个字节，“Range: bytes=-200”表示请求文件结尾处的200个字节。
2. If-Range：用于比较资源的当前版本和客户端所拥有的版本，如果两者相等，则返回412（Precondition Failed），否则返回所请求的实体。

响应头：

1. Accept-Ranges：用于告诉客户端服务器是否接受范围请求，如果接受，则返回“bytes”。
2. Content-Range：用于描述所返回实体的范围和整个实体长度。例如，“Content-Range: bytes 0-1/200”表示返回了开头的2个字节，而整个实体长度为200个字节。

综上所述，文件断点续传需要使用HTTP协议的请求头和响应头来实现。客户端发送带有Range请求头的请求，而服务器则通过Accept-Ranges响应头来告诉客户端是否支持范围请求。如果服务器支持范围请求，则返回带有Content-Range响应头的实体；否则，返回整个实体。

- `Accept-Ranges: bytes` 是 HTTP 响应头，用于告诉浏览器服务器接受范围请求，即能够处理断点续传。如果服务器在响应中包含这个头，那么就意味着该服务器上的资源可以使用断点续传技术来进行传输。

当我们需要上传或下载大文件时，可能会遇到网络中断或其他问题，导致无法一次性完成传输。此时，断点续传技术就非常有用。它允许我们在网络中断或其他问题发生时，从之前已经成功传输的部分开始，继续进行传输，而不是从头开始。

具体来说，当我们在浏览器中下载或上传一个大文件时，如果网络中断，浏览器会自动保存已经下载或上传的部分，并在网络恢复后继续下载或上传剩余的部分。这就是利用了 `Accept-Ranges: bytes` 响应头实现的断点续传技术。

以上信息仅供参考，可以查阅专业的技术文档获取更准确更全面的信息。

- 断点续传中浏览器端的range的start和end如何动态确定 文件总大小如何确定：
在断点续传中，浏览器端的Range头不需要手动设置，浏览器端的Range头的start和end的确定通常是由浏览器自动完成的。当用户选择要下载的文件时，浏览器会自动计算出文件的总大小，并将Range头的start设置为0，end设置为文件的总大小减去1。这样，浏览器就可以从文件的开头开始下载，一直下载到文件的结尾。

如果文件已经部分下载了，那么浏览器会继续从已下载部分的下一个字节开始下载，而不是重新开始下载整个文件。这样可以节省时间和流量。

当服务器返回响应时，浏览器会检查响应头中的Content-Range字段，以确定已下载的字节范围和文件的总大小。这样，浏览器就可以根据这些信息动态调整Range头的start和end值，以便在后续的请求中继续下载剩余的部分。

总之，浏览器端的Range头的start和end的确定是由浏览器自动完成的，而文件总大小的确定则是由服务器返回的Content-Range响应头提供的。

- 在断点续传中，浏览器端通常会在以下情况下清空本地未下载完成的文件：

1. 文件下载中断：如果文件下载过程中出现中断，浏览器可能会清空本地未下载完成的文件，以便重新开始下载。
2. 文件大小变更：如果文件的大小发生了变更，例如文件被更新或增加了一些内容，浏览器可能会清空本地未下载完成的文件，以便重新开始下载新的文件。
3. 浏览器关闭：如果浏览器关闭或重新启动，浏览器可能会清空本地未下载完成的文件，以便下次打开浏览器时重新开始下载。

总之，浏览器端清空本地未下载完成的文件通常是为了保证下载的正确性和完整性。如果下载过程中出现了问题或者文件的大小发生了变更，浏览器会清空本地未下载完成的文件，以便重新开始下载。

### 文件断点续传：上传
- https://juejin.cn/post/6844904046436843527
文件断点续传在上传时的工作原理如下：

1. 客户端将文件划分为多个分块（chunk），并使用HTTP协议逐个上传这些分块。
2. 对于每个分块，客户端都会记录上传的进度。如果上传过程中出现中断，客户端可以重新上传未完成的部分。
3. 当所有的分块都上传完成时，客户端会通知服务器合并这些分块。服务器会根据记录的进度信息将所有的分块合并为一个完整的文件。

断点续传在上传时主要应用了分片上传的技术，因此可以使用分片上传的场景都可以使用断点续传。具体来说，客户端将文件划分为多个分片，并逐个上传这些分片。在上传过程中，如果某个分片上传失败或网络中断，客户端会记录已经上传的分片数据和当前的上传进度。当客户端重新连接到服务器后，可以继续从最后一个已上传的分片开始上传，而不需要重新上传整个文件。

为了支持断点续传，服务器端也需要提供相应的接口来查询已经上传的分片数据。这样，客户端可以知道已经上传的分片数据，从而从下一个分片数据开始继续上传。(由于当文件切片上传后，服务端会建立一个文件夹存储所有上传的切片，所以每次前端上传前可以调用一个接口，服务端将已上传的切片的切片名返回，前端再跳过这些已经上传切片，这样就实现了“续传”的效果)

总之，文件断点续传在上传时通过将文件划分为多个分块并逐个上传的方式，实现了在上传中断后能够继续上传而不需要重新开始整个上传过程的功能。

### 断点续传：总结
  - 下载：断点续传：
    - 断点续传中, 浏览器端请求会自动携带head.Range
    - 服务端会判断如果有request.head.Range, 则会返回 `Accept-Ranges: bytes` + `Content-Range: bytes 0-1/200`来告诉浏览器端可以断点续传，并告诉浏览器下载的文件的大小
  - 上传：断点续传：

# DB连接
```
其实DB是一个BS架构设计
nodeServer这边安装的各种驱动mysql/sequalize其实就是DB-client,
真正的DB-server就是在服务器上的server
```
## mysql
- mysql:SQL
- ORM:sequelize
- 提前约定的结构化的数据：User等表
- 关键概念：
  - 连接池pool
  - 定义schema
  - 生成model
  - 增
  - 删
  - 改
  - 查: find
## mongoDB
- mongodb
- ODM: mongoose
- 文档/评论
## redis
- redis
# error
- 在koa的接口route或者middlware中使用, 会触发中间件调度机制中的处理，中断流程，例如：koa.on('error')
```js
next(new Error('error info'))
```
# tips
