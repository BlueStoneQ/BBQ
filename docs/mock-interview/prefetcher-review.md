# PreFetcher 模拟面试复盘

> 记录模拟面试中回答不够好的问题，方便后续针对性复习。

---

## 1. 项目背景描述过于简短

**问题**：介绍项目背景

**你的回答**：为了优化页面的启动速率

**改进建议**：用"业务场景 → 具体痛点 → 解决思路 → 实际效果"的结构回答。例如：
- 场景：小程序页面加载
- 痛点：页面渲染依赖多个接口，串行请求导致白屏时间长，秒开率低
- 思路：路由跳转时提前发起下一个页面的数据请求，串行变并行
- 效果：秒开率提升 X%（要有数据）

---

## 2. 页面加载全链路描述不完整

**问题**：页面从点击到可见经历了哪些阶段？

**你的回答**：路由跳转 → manifest路由映射 → 加载JS → 渲染成web/native组件（说不清）

**完整链路**：
```
用户点击 → 路由跳转 → 页面初始化（WebView创建/复用）→ 加载页面JS → 执行onLoad
→ 发起数据请求（网络IO）→ 返回数据 → setData → 渲染层更新 → 用户可见
```

**关键理解**：数据请求是在页面JS执行之后才发起的，预请求就是把这一步提前到路由跳转时刻，利用页面初始化的时间窗口并行请求数据。

---

## 3. AOP 路由拦截实现记不清

**问题**：AOP 具体怎么实现路由拦截？

**你的回答**：想不起来具体实现

**核心实现**：保存原函数引用 → 替换为新函数 → 新函数里先增强再调原函数
```javascript
const originalNavigateTo = wx.navigateTo;
wx.navigateTo = function(options) {
  preFetcher.emit(options.url);
  return originalNavigateTo.call(this, options);
}
```

**不同框架**：
- Vue Router：`router.beforeEach` 导航守卫
- React Router：`history.listen` 监听路由变化
- 小程序：手动劫持 API（猴子补丁），因为没有路由钩子

---

## 4. 手写：带指数退避的重试函数

**问题**：手写 retryWithBackoff(fn, maxRetries, baseDelay)

**你的问题**：
- sleep 语法错误（const fn = async () => {} 箭头函数语法）
- catch 里的边界判断逻辑有误，`maxRetries === 0` 永远不会触发
- 术语注意：间隔重试不叫"节流"，叫**退避策略（Backoff）**，业界标准是**指数退避（Exponential Backoff）**

**正确实现要点**：
- 先执行 fn，失败后再 sleep 再递归（第一次不等待）
- 边界判断放在 catch 里：`if (maxRetries <= 1) throw err`
- 递归调用要 return
- throw 原始 err，不要丢失错误信息
