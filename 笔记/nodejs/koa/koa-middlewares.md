# koa-session
- [koa-session的使用:写得更清晰系统](https://blog.csdn.net/weixin_41258881/article/details/104419480)
- [koa-session的使用](https://juejin.cn/post/6948780829921247269)
- https://segmentfault.com/a/1190000019086415
- 源码解读: https://juejin.cn/post/6844904181799583752
## 场景：登录状态管理
- cookie-id + session的模型：
- jwt
## 设计实现
- 采用挂载的手法，在app.context上挂载CONTEXT_SESSION属性，该属性的值为：ContextSession 的实例:
- 挂载在app上，是否是为了着session在整个app中是唯一的, 并不是每次请求都创建一个session对象
  - extendContext 只在ctx上挂载一次session，该session是用一个symbol生产的私有属性key
  - session属性是在该私有属性上二次封装的，只暴露了一些 get set方法
- session的本质是服务端存储，存储管理：ContextSession
  - get
  - set(val)
- session: 默认存储在什么地方呢
  - 存储模式：
    1. 客户端模式：默认模式：cooie模式：常用的JWT之类的token形式 可以采用这种，优点是不占用是
    2. store模式：存储在服务端的session策略，这个需要提供store或者ContextStore选项，来接入各种各样的服务端session存储策略


# koa-body
- 关于TS 使用 type来获取类型：
```ts
import type { Context, Middleware, Next } from 'koa';
export function koaBody(options: Partial<KoaBodyMiddlewareOptions> = {}): Middleware {}
```
- 判断request.header.content-type
```js
koa.ctx.is('application/json')
```
## 处理数据类型：
- json
- urlencode
- text
- multiPart
## 整体架构
- 管道式
```js
raw-body: ctx.req.on('data') -> str[buffer] =>
    - 注意：这里的data + end：是stream的事件
    - 监听流的 data 事件来获取数据，然后在数据结束时调用一次流的 end 事件
co-body: 按照四种主要的content-type: 对str[buffer]进行不同的处理
    - json: JSON.parse(str[buffer])
    - form/urlEncode: qs.parse(str)
    - text: 直接就返回str本身
    - multipart: 这个不实用co-body解析，这个类型使用 formidable 来处理（我们这里只是将其由事件封装为了promiseify）
        - 这个formidable可以涉及到文件二进制数据的处理细节
        - [multipart的处理可以看这个](https://juejin.cn/post/7130909218042806280)
        - 上传的文件可以通过ctx.request.files
koa-body: 中间件职能：负责收集options,预处理或传递ctx,调用next等
    - 这里就是根据不同的content-type: 使用不同的处理方案
```

- 一个使用koa-body处理文件上传的案例：
```js
// app.js或者自己的路由文件
const fs = require("fs");
const path = require("path");
const koaBody = require("koa-body"); // npm i koa-body
const { format } = require("date-fns"); // npm i date-fns

// POST@/upload
router.post(
  "/upload",
  koaBody({
    multipart: true, // 支持多文件上传
    encoding: "gzip", // 编码格式
    formidable: {
      uploadDir: path.join(__dirname, "/public/upload/"), // 设置文件上传目录
      keepExtensions: true, // 保持文件的后缀
      maxFieldsSize: 10 * 1024 * 1024, // 文件上传大小限制
      onFileBegin: (name, file) => {
        // 无论是多文件还是单文件上传都会重复调用此函数
        // 最终要保存到的文件夹目录
        const dirName = format(new Date(), "yyyyMMddhhmmss");
        const dir = path.join(__dirname, `public/upload/${dirName}`);
        // 检查文件夹是否存在如果不存在则新建文件夹
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
          }
        // 文件名称去掉特殊字符但保留原始文件名称
        const fileName = file.name
          .replaceAll(" ", "_")
          .replace(/[`~!@#$%^&*()|\-=?;:'",<>\{\}\\\/]/gi, "_");
        file.name = fileName;
        // 覆盖文件存放的完整路径(保留原始名称)
        file.path = `${dir}/${fileName}`;
      },
      onError: (error) => {
        app.status = 400;
        log4js.error(error);
        // 这里可以定义自己的返回内容
        app.body = { code: 400, msg: "上传失败", data: {} };
        return;
      },
    },
  }),

  async (ctx) => {
    try {
      // 获取上传文件
      const files = ctx.request.files;
      // 正则 替换掉文件原始路径中不需要的部分
      const reg = new RegExp(".*/upload/", "g");
      for (const fileKey in files) {
        ctx.uploadpaths = ctx.uploadpaths ? ctx.uploadpaths : [];
        ctx.uploadpaths.push({
          name: files[fileKey].name,
          url: files[fileKey].path.replace(reg, ""),
        });
      }
      ctx.body = { code: 200, msg: "", data:{ uploadpaths: ctx.uploadpaths }};
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, msg: "上传失败", data: {} };
    }
  }
);

```

# koa-static
1. 从其他中间件返回后 如果什么都没有携带 则证明没有命中其他路由 则走静态资源的检查：静态资源检查是在接口之后  整个洋葱的最外层，兜底的时候发挥作用
2. 作为依赖型中间件 错误不应自己处理 应该抛出(throw) 由调用层决定如何处理
  - koaApp.on('error', () => {})
  - process.on('error', () => {})
3. 在这里只是决定了next()的调用时机，确定了自己的调用时机
```js
app.use(koaStaticServer('public'));
// 访问地址 localhost:3000/test.jpg
// 注意上面这个路径请求的是/test.jpg，前面并没有public，说明koa-static对请求路径进行了判断，发现是文件就映射到服务器的public目录下面，这样可以防止外部使用者探知服务器目录结构。
```
# koa-send
- koa-static的核心功能实现
- 掌握吸收一个middleware的思路：
    - 核心功能
    - 边界功能
    - 错误处理
    - 防御
    - 工业化:健壮性
- 结构:
    - 参数初始化
    - 防御
    - 核心功能处理
    - 兜底处理
- 静态文件从server到client 核心实现：
```js
// 因为nodejs中的res本身就是一个stream
ctx.body = fs.createReadStream(path)
// res其实是http.ServerResponse类的一个实例，而http.ServerResponse本身又继承自Stream类：
// koa中对于ctx.body的处理：
const res = ctx.res; 
const body = ctx.body; 

// 如果body是个流，直接用pipe将它绑定到res上
if (body instanceof Stream) return body.pipe(res);

return res.end(body); 
```
- 缓存处理

## 子能力吸收
- promiseify:
const stat = util.promisify(fs.stat)
- 判定文件是否目录：
stats.isDirectory()
