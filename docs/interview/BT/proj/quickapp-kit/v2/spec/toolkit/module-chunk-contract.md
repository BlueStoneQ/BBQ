# Module Chunk Contract

## 1. 结论

**页面是加载边界，模块是复用边界；Chunk 负责把两者解耦。**

## 2. 索引

```json
{
  "chunks": {
    "app": ["app.js"],
    "shared": ["shared.js"],
    "pages/Demo": ["pages/Demo/index.js", "shared.js"]
  },
  "modules": {
    "helper/utils": "shared.js",
    "pages/Demo/index": "pages/Demo/index.js"
  }
}
```

## 3. 加载规则

```text
Page Entry
-> 查索引
-> 加载缺失 Chunk
-> 注册 Module
-> ModuleRegistry 执行一次
-> 创建 Page Instance
```

V1 默认只支持 App、Shared、Page 三层；不要求复杂动态 Chunk LRU。

## 4. 提取规则

Shared Chunk 是否抽取由依赖图和体积策略决定，不由页面代码手工指定。提取后必须保证：

- 模块 ID 全局稳定；
- 共享模块初始化一次；
- 页面模块实例隔离；
- Chunk 缺失时构建失败或明确降级，不能静默重复执行。
