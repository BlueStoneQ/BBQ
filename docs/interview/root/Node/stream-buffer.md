# Stream 与 Buffer

> 解决什么问题：大文件/大数据不能一次性全部加载到内存，怎么办？一段一段处理。
> 本质：Stream = 数据流水线（生产者-消费者模型），Buffer = 二进制数据容器。
> 和前端的关系：SSR 流式渲染（renderToNodeStream）、文件上传、日志处理、CI 构建日志推送。

---

## 目录

- [为什么需要 Stream](#为什么需要-stream)
- [四种 Stream 类型](#四种-stream-类型)
- [pipe 与背压](#pipe-与背压)
- [Buffer 本质](#buffer-本质)
- [实际场景](#实际场景)
- [和 SSR 的关系](#和-ssr-的关系)

---

## 为什么需要 Stream

```
❌ 不用 Stream：
  fs.readFile('2GB.log') → 2GB 全部加载到内存 → 内存爆了

✅ 用 Stream：
  fs.createReadStream('2GB.log') → 每次读 64KB → 处理 → 读下一块 → 内存始终只占 64KB
```

**本质**：Stream 把"一次性操作"变成"分块流水线操作"，内存使用恒定，不随数据量增长。

---

## 四种 Stream 类型

| 类型 | 作用 | 例子 |
|------|------|------|
| Readable | 数据来源（生产者） | `fs.createReadStream`、`http req` |
| Writable | 数据去向（消费者） | `fs.createWriteStream`、`http res` |
| Duplex | 双向（既读又写） | `net.Socket`、TCP 连接 |
| Transform | 转换（读入 → 处理 → 写出） | `zlib.createGzip()`、加密 |

```ts
// 流水线：读文件 → 压缩 → 写文件
fs.createReadStream('input.log')
  .pipe(zlib.createGzip())           // Transform：压缩
  .pipe(fs.createWriteStream('input.log.gz'));  // Writable：写入
```

---

## pipe 与背压

**问题：生产者太快、消费者太慢怎么办？**

```
生产者（读磁盘 100MB/s）→→→→ 消费者（写网络 10MB/s）
                              ↑ 数据堆积 → 内存爆了

背压（Backpressure）= 消费者通知生产者"慢点"：
  当 writable 的内部缓冲区满了 → write() 返回 false → readable 暂停读取
  等 writable 消化完 → 触发 'drain' 事件 → readable 继续读

pipe() 自动处理背压，不用手动管。
```

```ts
// 手动处理背压（理解原理）
readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);
  if (!canContinue) {
    readable.pause();  // 消费者忙，暂停生产
  }
});

writable.on('drain', () => {
  readable.resume();  // 消费者空了，继续生产
});
```

---

## Buffer 本质

```
Buffer = Node 中处理二进制数据的容器（固定大小的内存块）

JS 原生只有字符串（UTF-16），处理 TCP 包/文件字节/图片二进制需要 Buffer。
Buffer 是 Uint8Array 的子类，直接操作内存，不经过 V8 GC。
```

```ts
// 创建
const buf = Buffer.from('hello', 'utf8');     // 字符串 → Buffer
const buf2 = Buffer.alloc(1024);              // 分配 1KB 空间

// 转换
buf.toString('utf8');    // Buffer → 字符串
buf.toString('base64');  // Buffer → base64

// 拼接（Stream 常用）
const chunks: Buffer[] = [];
stream.on('data', chunk => chunks.push(chunk));
stream.on('end', () => {
  const result = Buffer.concat(chunks);  // 合并所有 chunk
});
```

---

## 实际场景

| 场景 | 怎么用 Stream/Buffer |
|------|---------------------|
| SSR 流式渲染 | `renderToNodeStream(app).pipe(res)` — 边渲染边返回 |
| 大文件上传 | `req.pipe(fs.createWriteStream(path))` — 不占内存 |
| 日志处理 | `readline` + Stream 逐行读取 |
| 文件压缩 | `readable.pipe(gzip).pipe(writable)` |
| CI 构建日志推送 | `child.stdout.pipe(webSocket)` — 实时推送 |

---

## 和 SSR 的关系

```
renderToString：等整个页面渲染完 → 一次性返回（TTFB 慢）
renderToNodeStream / renderToWebStream：边渲染边返回 → TTFB 快

底层就是 Node Stream：
  const stream = renderToNodeStream(app);
  stream.pipe(res);  // res 是 http.ServerResponse，也是 Writable Stream
  
浏览器边收边渲染（chunked transfer encoding）→ 用户更早看到首屏内容
```

---

## 面试问题

| 问题 | 一句话 |
|------|--------|
| Stream 解决什么问题？ | 大数据分块处理，内存使用恒定 |
| 什么是背压？ | 消费者处理不过来时通知生产者暂停 |
| pipe 做了什么？ | 连接 readable → writable + 自动处理背压 |
| Buffer 是什么？ | 二进制数据容器，Uint8Array 子类，不走 V8 GC |
| Stream 和 SSR 什么关系？ | renderToNodeStream 边渲染边返回，降低 TTFB |
