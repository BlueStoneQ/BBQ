## koa-server
-  默认地址：http://localhost:3000
### 路由处理
```js
// 目录设计
// controller 统一有index导出
handler1 = async ctx => {
  ctx.body = 'response';
}
// route 统一有index导出
// 配置
module.exports = {
  path: '/a',
  method: 'get',
  controller: handler1
}
// 统一导出 - 在index中批量注册到koa-router中
const KoaRouter = require('kao-router');
const router = new KoaRouter();
const routes = require('../routes');

routes.forEach(route => {
  const { method, path, controller } = route;
  router[method](path, controller);
});

module.exports = router;
// app 
app.use(router);
```
### 参数处理
#### ctx
- ctx.req: Node 的 request 对象.
- ctx.res: Node 的 response 对象.
- ctx.app 
#### get请求参数
```js
ctx.request.query.xxx
```
#### post请求参数:koa-body
- 使用
```js
// koa-body: 能支持到文件上传,而koa-bodyparser比较局限
// 1. bodyParser 为了处理每个 Request 中的信息，要放到路由前面先让他处理再进路由
// 
var koaBody = require('koa-body');
app.use(koaBody());
// 在controller中获取参数
ctx.request.body.xxx
```
- 原理和背景
  - post的参数部分在http的body部分传递，而body部分在传递时是二进制数据流的形式
  - 需要从header:content-type中获取该数据流的编码方式（一般为utf-8）
  - NodeJS中获取请求报文主体二进制数据流主要通过监听request对象的data事件完成
  ```js
  const http = require('http');
  http.createServer((req, res) => {
    const bodyData = [];

    res.on('data', chunk => {
      bodyData.push(chunk);
    });

    res.on('end', () => {
      const chunks = Buffer.concat(bodyData);

      res.end(chunks.toString());
    });

  }).listen(3000);
  ```
  - koa-body基本就是以上的封装 获取到数据后 挂载ctx.request.body
#### 文件上传处理 & 大文件上传
```js
const koaBodyCreate = require('koa-body');

const koaBody = koaBodyCreate({
  multipart: true // 支持文件上传
  formidable: {
    // 其他配置 设置上传目录 文件大小等
    keepExtensions: true, // 保持文件的后缀,必须开启，否则上传不会成功
  }
});
// 在controller中获取文件信息，其中有path 指向上传后存储的本地，可以通过这个路径用fs读取文件
ctx.request.files // Array
```
### 统一响应体 & 错误处理
- 为了方便处理错误，最好使用try...catch将其捕获。但是，为每个中间件都写try...catch太麻烦，我们可以让最外层的中间件，负责所有中间件的错误处理
```js
/*
  响应体：
  ctx.body = {
    code: 0, // 业务码
    data: ctx.body,
    msg
  }
*/
```
#### set-header
### 参数校验
### 静态资源
- koa-static
  - 使用：
  ```js
  // app.js
  const staticServe = require('koa-static');

  app.use(staticServe('public'));
  // 静态文件目录
  - public
    - 123.jpg
  // 请求 koa-static对请求路径进行了判断，发现是文件就映射到服务器的public目录下面，这样可以防止外部使用者探知服务器目录结构
  http://localhost:3001/123.jpg
  ```
  - 原理
    - 返回静态文件的流程
      1. 通过请求路径取出正确的文件地址
      2. 通过地址获取对应的文件
      3. 使用Node.js的API返回对应的文件，并设置相应的header
    - 具体原理：
      - koa-send取文件时使用了fs模块的API创建了一个可读流，并将它赋值给ctx.body，同时设置了ctx.type。
      - 通过ctx.type和ctx.body返回给请求者并不是koa-send的功能，而是Koa本身的功能。由于http模块提供和的res本身就是一个可写流，所以我们可以通过可读流的pipe函数直接将ctx.body绑定到res上，剩下的工作Node.js会自动帮我们完成。
    ```js
    // koa中
    // 如果body是个流，直接用pipe将它绑定到res上
    if (body instanceof Stream) return body.pipe(res);
    // 在koa-static中
    ctx.body = fs.createReadStream(path)
    ```
### 日志
### 配置跨域:koa-cors
### 鉴权
#### cookies&session
#### token方案
### 数据库操作
- service + model中操作 供controller调用
### nodemon
- Nodemon是一个实用程序，它将监视源中的任何更改并自动重新启动服务器。是开发阶段node的替代品
### 守护进程pm2 


## koa原理
### koa中间件原理
### koa-compose
### node:http模块等

## node-cli
### 要懂得不使用commander等的最基本的方法-徒手写实现原理
### 开发cli
- [开发cli](https://www.chenliqiang.cn/post/node-js-cli-start-up.html)
- #!/usr/bin/env node
### npm link
- npm link test-npm-link(模块包名，即：package.json中name)
- npm link原理？
### #!
- #! 表示要指定脚本文件的解析程序，/usr/bin/env 表示要去哪里找解析程序，node 是解析程序的名字