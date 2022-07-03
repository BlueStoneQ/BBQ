## 跨端
### jsBridge[❓]
- [jsBridge原理](https://libin1991.github.io/2018/08/28/JSBridge%E7%9A%84%E5%8E%9F%E7%90%86/)
- web调用Native:
  - 方式: 注入 API 和 拦截 URL SCHEME 。
  - 设计schema（url）向native发起请求
- Native 调用 JavaScript：其实就是执行拼接 JavaScript 字符串，从外部调用 JavaScript 中的方法，因此 JavaScript 的方法必须在全局的 window 上。