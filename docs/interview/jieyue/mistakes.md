# JY Prep — Mistakes & Corrections

> 面试前快速扫一遍，不要再犯。

---

## 1. Streaming 前端消费

**⚠️ 注意点**：不能用 EventSource 接收 LLM 流式响应

**✅ 正确答案**：用 fetch + ReadableStream

**为什么错**：
- EventSource 只支持 **GET** 请求，不能带 request body
- LLM 对话需要 **POST**（body 里带 messages 数组），所以 EventSource 用不了
- EventSource 适合的场景是：服务端主动推送通知（不需要客户端发复杂数据的场景）

**正确的前端消费代码**：
```javascript
// 1. 发 POST 请求
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [...] })
});

// 2. 拿到 ReadableStream（响应体是流）
const reader = res.body.getReader();
const decoder = new TextDecoder();
```

**核心对象解释**：

**`res.body` → ReadableStream**：
- `fetch()` 返回的 Response 对象有个 `body` 属性，它是一个 `ReadableStream`
- ReadableStream 是 Web Streams API 的一部分，代表"一个可以逐块读取的数据源"
- 普通用法 `res.json()` / `res.text()` 会等全部数据到齐才返回
- `res.body` 让你能边接收边处理（流式消费）
- `.getReader()` 返回一个 `ReadableStreamDefaultReader`，它有 `.read()` 方法
- `.read()` 返回 `{ done: boolean, value: Uint8Array }`：done=true 表示流结束，value 是这一块的原始字节

**`TextDecoder`**：
- Web API，把 `Uint8Array`（原始字节）解码为字符串
- 因为 `reader.read()` 返回的 value 是 `Uint8Array`（二进制），不是字符串
- `new TextDecoder()` 默认 UTF-8 编码
- `decoder.decode(value, { stream: true })`：`stream: true` 表示后面还有数据，不要把不完整的多字节字符截断（比如中文是 3 字节，可能被切在中间）

**类比**：
```
ReadableStream = 水管（数据一点一点流过来）
getReader()    = 接上水龙头（获得读取能力）
read()         = 接一杯水（读一块数据，Uint8Array 格式）
TextDecoder    = 翻译器（把字节翻译成人能看懂的字符串）
```

```javascript
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // 4. 字节 → 字符串
  const chunk = decoder.decode(value, { stream: true });
  
  // 5. 解析 SSE 格式（每行 data: {...}\n\n）
  // 提取 delta.content，追加到页面
  const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
  for (const line of lines) {
    const json = JSON.parse(line.slice(6)); // 去掉 "data: " 前缀
    const token = json.choices[0].delta.content;
    if (token) appendToUI(token);
  }
}
```

**完整链路图**：
```
用户输入
  → 前端 fetch POST（带 messages）
  → 后端收到请求
  → 后端调 LLM API（OpenAI/Claude，也是 SSE 流）
  → 后端设置响应头：
      Content-Type: text/event-stream
      Transfer-Encoding: chunked
  → 后端逐块 res.write('data: {...}\n\n') 转发给前端（不 res.end()）
  → 前端 res.body 是 ReadableStream
  → getReader().read() 循环读取每一块
  → TextDecoder 把 Uint8Array 解码为字符串
  → 解析 JSON 提取 delta.content（每次只有几个字）
  → 追加到 DOM（逐字显示效果）
  → LLM 输出完毕，后端发 data: [DONE]\n\n 并 res.end()
  → reader.read() 返回 { done: true }
  → 循环结束
```

**后端转发代码（Node.js）**：
```javascript
app.post('/api/chat', async (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 调 LLM API（stream: true）
  const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify({ messages: req.body.messages, stream: true })
  });

  // 逐块转发
  const reader = llmRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(new TextDecoder().decode(value)); // 直接转发原始 SSE 数据
  }
  res.end();
});
```

**面试话术**：
> "前端消费 LLM 流式响应不能用 EventSource，因为 EventSource 只支持 GET。LLM 对话需要 POST 带 messages，所以用 fetch 拿到 ReadableStream，然后 getReader().read() 循环读取，TextDecoder 解码，解析 SSE 格式的 JSON 提取 delta.content 逐字追加到 DOM。"

**记忆口诀**：fetch → body → reader → decode → parse → append

---
