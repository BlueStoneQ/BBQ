## deps是什么
- 就是toolkit通过依赖分析，解析出来的当前页面/模块的依赖的path/id的一个数组

## deps在哪儿
- toolkit解析出来后 就在模块/页面的 $bootstrap$的入参中，加载过程见：## deps查询和加载

## deps查询和加载
`deps` 加载通常不是先查 C++ Core 的 `Map<moduleId, Module>`，而是 **JS Framework 的模块加载器**先查 JS 侧 `moduleMap`：

```text
require(dep)
→ 查 moduleMap
→ 已缓存：直接返回 exports
→ 未缓存：向 Runtime Service 请求/读取 RPK 中对应 JS
→ QuickJS 执行 define，注册模块
→ 执行 factory
→ 缓存 exports
→ 返回依赖结果
```

C++ JS Runtime Service 负责从 RPK 取出并交给 QuickJS 执行；模块注册、缓存和依赖解析主要属于 JS 模块系统，不是 C++ Core。

## 模块隔离
同一个 QuickJS Context 下，模块的逻辑隔离来自：

- **factory 函数作用域**：每个模块执行时拥有独立的局部变量和闭包；
- **module/exports 参数**：每个模块拥有自己的导出对象；
- **exports 边界**：模块只能通过显式导出值访问其他模块；
- **局部 require**：模块通过依赖 ID 获取其他模块的 exports。

但这不是安全沙箱；如果多个 App 共用同一个 QuickJS Context，它们仍共享全局对象和引擎资源。真正强隔离需要不同 QuickJS Context 或独立进程。