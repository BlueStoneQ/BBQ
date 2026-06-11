# Node.js 场景实战

> 具体业务场景中 Node 怎么用，核心代码 + 原理。

---

## 目录

- [文件上传](#文件上传)

---

## 文件上传

**Q：前端传文件到后端，Node 怎么接收？是 stream 吗？**

**本质**：HTTP 请求 body 本身就是 Readable Stream（`req` 对象）。文件上传用 `multipart/form-data` 格式，数据分 chunk 到达，不会一次性加载到内存。

**流程**：

```
前端 FormData → HTTP POST (multipart/form-data) → 网络分块传输
  ↓
Node 收到 → req 是 Readable Stream → 数据分 chunk 到达
  ↓
multer/busboy 中间件 → 解析 boundary 分隔符 → 提取文件 → 写入磁盘
  ↓
业务代码拿到 ctx.file（路径/大小/文件名）
```

**核心代码（Koa + multer）**：

```js
const multer = require('@koa/multer')
const upload = multer({ dest: './uploads/' })  // 文件存到 uploads/

router.post('/upload', upload.single('file'), (ctx) => {
  console.log(ctx.file)
  // { fieldname: 'file', originalname: 'photo.png', size: 102400, path: 'uploads/abc123' }
})
```

**底层原理（手动收 stream，理解用）**：

```js
app.use(async (ctx) => {
  const chunks = []

  // for await 是边到边读：网络上数据还在传的同时，每到一个 chunk 就 yield 一次
  // 不是"全部收完再循环"，是"来一块处理一块，等下一块到达才进入下一次循环"
  for await (const chunk of ctx.req) {
    chunks.push(chunk)                   // chunk 是 Buffer（二进制字节，如 64KB 一块）
  }
  // 循环结束 = stream end 事件 = 客户端发完了

  const body = Buffer.concat(chunks)     // ⚠️ 全量拼到内存，大文件会 OOM
  // body 是 multipart 原始二进制，需要自己解析 boundary → 所以用 multer
})
```

**⚠️ 注意**：这段代码虽然是流式接收，但 `Buffer.concat` 最终把所有数据堆到内存了。大文件场景必须用 pipe 到磁盘/OSS（边收边写），不能 concat：

```js
// 正确做法：pipe 到文件（内存里只有当前 chunk）
const fs = require('fs')
const writeStream = fs.createWriteStream('./uploads/file.bin')
ctx.req.pipe(writeStream)  // 边收边写，不堆内存
```

**关键认知**：
- 大文件不会 OOM — multer disk storage 模式边收边写磁盘，内存里只有当前 chunk
- `multipart/form-data` 的 boundary 是前端 FormData 自动生成的分隔符，multer 用它区分多个字段/文件
- 前端 `Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...` 会自动带

---
