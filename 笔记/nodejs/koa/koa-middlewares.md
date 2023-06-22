# koa-static
1. 从其他中间件返回后 如果什么都没有携带 则证明没有命中其他路由 则走静态资源的检查：静态资源检查是在接口之后  整个洋葱的最外层，兜底的时候发挥作用
2. 作为依赖型中间件 错误不应自己处理 应该抛出 由调用层决定如何处理
3. 在这里只是决定了next()的调用时机，确定了自己的调用时机
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
ctx.body = fs.createReadStream(path)
```
- 缓存处理

## 子能力吸收
- promiseify:
const stat = util.promisify(fs.stat)
- 判定文件是否目录：
stats.isDirectory()
