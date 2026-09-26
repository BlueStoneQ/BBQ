## QA
### feature的结果 怎么给到js侧 给到应用
```js
JS 侧（inst = Page/module 实例，持有 callbackId2FuncMap: Map<callbackId, Function>）

  应用调 system.xxx.yyy(params, onSuccess)
   → 生成 callbackId: string（如 "1","2"… 实例内自增）
   → inst.callbackId2FuncMap.set(callbackId, onSuccess/包装函数)   // 登记：id → 回调
   → invoke(name: string, action: string, params: object, callbackId: string) 过 J2V8
        │
Native 侧
   → ExtensionManager.onInvoke → Request{ action: String, rawParams: Object, jsCallback: String(=callbackId), instanceId: int }
   → Feature 异步干完 → Response{ code: int, content: String/Object }
        · code: 同步 / CODE_ASYNC / CODE_CALLBACK
   → 带着 jsCallback(callbackId: String) 回 JS：post 到 JsThread 执行 execCallback
        │
JS 侧（回到 JS 线程）
   → invoke(inst, callbackId: string, data: any)
   → const callback: Function = inst.callbackId2FuncMap.get(callbackId)   // 按 id 取回调
   → callback(data) → resolve 应用的 Promise
   → 非 keepAlive 则 inst.callbackId2FuncMap.delete(callbackId)   // 一次性清除；keepAlive 保留(监听类多次回调)
```

## quickjs
- C↔JS 之间传递的一切都是 JSValue 句柄
C 侧要读/调 JS 的任何东西，前提是手里有那个东西的 JSValue。怎么拿到句柄，有几条路
- 从 global 拿（最常用的入口）：JS_GetGlobalObject(ctx) 拿到全局对象，再 JS_GetPropertyStr(ctx, global, "xxx") 往下取