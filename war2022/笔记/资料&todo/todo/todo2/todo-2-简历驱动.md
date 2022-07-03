## 4-8 二期简历todo


## 4-1 todo
```
TODO的设计考虑：
是否必须保留
学习成本的高低
优先级
大部分都是梳理 巩固
而不是你完全不懂 

这里收集的是你的弱点 
让你觉得惴惴不安的点

很重要 因为这一部分代表着你的疑惑 或者一些似是而非的点
解决能带来实实在在的进步感

理解 是最好的记忆
问题 是最好的导师
思考 是最好的武器

活的知识 才是能力
活的知识 才是力量
活的知识 才最牢固

真才实学 
态度：专业 I can
定位：前端架构师 + 全栈开发
```
### 参考
- [前端面试百科](https://interview.html5.wiki/)
### 基础：45-60min
- [2do]正则：单项训练：边界 小组 js相关的api使用
  - [2do]js api过一遍，对于捕获的掌握
  - 之前阅读的正则小文过一遍
  - 元字符过一遍
- [√]css布局
- [√]动画 以及动画优化
- [√]nodejs执行命令行
- [√]http缓存
- [√]cookie session
- [2do][8大排序-algo中](https://interview.html5.wiki/section/17-%E6%8E%92%E5%BA%8F%E7%AE%97%E6%B3%95.html#%E5%AE%9E%E7%8E%B0%E4%B8%80)
  - [剩余]：计数 桶 希尔 基数 堆排序 查找：区间想清楚[)
- [√]eventLoop
  - [2fix]node的event-loop模型
- [√]跨域 和 解决方案
- [√]箭头 以及箭头函数 和 传统函数的差异 用途差异
- [2do]为什么要用img进行数据上报
- [√]e.target e.currentTarget 事件委托
- [√]节流 防抖 
- [√]对象专题：对象 和 继承 ES5 ES6，再次理解原型链 create - new API
- 从url中拆出参数
- [2do]1px问题 mobile适配 像素单位rem 动态设置html.font-size
- 点击+滑动穿透
- [2do]几个常见的对api梳理：过一下：object Array string Regexp Date
- [2do]过书籍目录：梳理系统知识 + 产生新的todo:
  - js高程
  - es6
  - pick其中部分章节 看一下
- 转义 + encodeURI等
- 如何捕捉promise中的错误 - 探针SDK设计
- restFul的理解
- lodash.get
- lodash的按需加载：使用 + 实现？
- vue的事件机制
- 常见插件设计-编写：webpack babel eslint koa
- 常考的http code码： 301 302 304 1XX
- flex布局梳理复习
- css选择器-过一遍即可 记住常用的即可
- 图标和文字对齐
- H5常见问题 样式问题
- window和元素的一系列尺寸位置信息获取
- 设计模式：事件订阅模式
- vue官网阅读-系统化知识
- vue keep-alive原理
- vue路由 路由懒加载
- 变量提升 strict ES6中是否还有
- [2fix]垃圾回收 
- [2fix]如何造成内存泄露
- cookie的http-only
- git-hook + husky
- 深浅拷贝：考虑正则 Date对象
- 元素交换：基于数组扩展符的交换
- tree型json的遍历 + visitor设计
- 尾递归调用 
- 遍历专项：object 和 Array string的遍历方案
- 执行js代码str: new function 和 eval()
- weakMap weakSet 以及应用（例如在深拷贝中的应用）
- xss CSRF的全称
- Map和object的区别，用途
- 数组 - Set - Map等的互相转化：Array.from()
- 盒子模型
- 手写：从url中拆出参数 + 将参数拼接到url中
- get和post的区别

### 专项-mid: 120min-180min
- webpack 应用
  - ark cli中用到了 一定要能理解 和 说上
- [webpack系统专题](https://juejin.cn/post/7023242274876162084)
- koa的中间件原理 + 中间件写法 + 经典中间件实现：static router - 知道核心实现原理
- node
  - 执行命令行的方案
- 鉴权：SSO（单点登录） token cookie等
- git的常见场景 和 基本原理 面试问题：tricky的点
- [√]即时通信方案：轮询 长轮询(comet) 长连接 ws
- [promise：周边方法实现 + 主方法实现框架](/Users/qiaoyang/code/github/BBQ/war2022/jsWriteByHand/js/promise-polyfill)
  - [√]all race
  - [√]resolve reject 
  - catch finally
  - [√]allSettled any
  - promise本身：过一遍实现：几个核心点 过于tricky的就说记不太清了 展现到某一层即可
- node的require 
- npm包管理 package.lock yarn等区别 使用场景 - lock解决了什么问题
- [√]js对象 和 继承
- 前端router原理-必会
- [√]vue nextTick的实现 和 作用
- 链式调用的实现方案 promise的链式调用实现
- jsBridge-JS环境和native等其他的通信方案
- H5移动端如何适配 还原设计稿方案 那个等比公式 
  - window.devicePixelRatio
- 了解iframe
- 各个标签页之间如何通信+数据共享
- node实现websocket
- [60%][函数式：手写：柯里化 偏函数 AOP compose](/Users/qiaoyang/code/github/BBQ/war2022/jsWriteByHand/js/functional)
- jsBridge - sdk设计
- js中内置对象 浏览器中呢
- node koa 中 使用websocket
- 一些经典组件的实现@vue
  - 跑马灯/轮播图实现
- 前端web安全
- 为什么用rollup打包Fst-sdk？对比webpack？
- web-worker + service-worker
- 拖曳解决方案 - 搭建系统中的拖曳
- vuex - 搭建系统中的数据管理
- 工程化-eslint+husky等
- 工程化中的各种拦截方案：pre-commit等等
- vue深度解决方案：vue-api: refs extends use+中间件
- vue工程化-在vue中使用TS 
- 在nodejs中使用TS
- eval newFunction: 用途 + 缺点漏洞
- 元素可编辑：富文本编辑器的原理之一
- XSS防御方案



### 提升质感的专项: 240min-360min
- SSR
- 微前端
  - 了解iframe
- monoRepo: 组件库适合 - 提供按需加载 单独调试等
- 设计原则和设计模式：巩固自己学过的 常见的几个 => add: 了解常见的设计模式和原则
- 虚拟列表
- 骨架屏原理
- 懒加载
- 按需加载
- 性能优化专项：二次阅读
- [挑着结合简历读下这个专栏哦-写得很不错](http://dennisgo.cn/)
  - [这个大前端写的也不错](https://fairyly.github.io/interview/5.1.3%20koa%20%E4%B8%AD%E9%97%B4%E4%BB%B6%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86.html#koa%E4%B8%AD%E9%97%B4%E4%BB%B6%E7%9A%84%E8%AE%BE%E8%AE%A1)
- BFF
- [性能探针SDK设计](https://segmentfault.com/a/1190000040796868#item-4)
- 常见插件机制：webpack babel eslint koa

### nodejs
```
node最好是以koa-server + cli为2个应用出发点
系统化所有解决方案
```
- stream + pipe
- process
- child_process
  - fork
- stream
- buffer
- 编码问题

#### nodejs-cli开发专题

#### koa
- 如何用koa开发一个server
  - 请求参数 + 响应 + header设置
  - 日志
  - 常用中间件

### webpack
- splitchunk + 按需加载方案
- DDLPlugin

### git相关-梳理
- 分区 及 互相转化的操作
- 和 远程的通信
- 常见场景
- 原理解析

## 手写
```
挑着看下 有些比较经典的掌握下
```
- [常见手写1](https://juejin.cn/post/6875152247714480136)
- [常见手写2](https://juejin.cn/post/6855129007852093453#heading-21)

## 标记list
```
一刷有些没弄太明白但是优先级不是很高的
可以放到这里再下一个循环中处理
- 15-30-45min 3个档次的任务：势大力沉 掷地有声 学会学习 学会面试：
一件一件去做，学会孤独
学会有效学习 学会长效学习 一步一个脚印
```
- 快速排序的第二种方法：原地排序的方法
- [插入排序优化：折半插入](https://interview.html5.wiki/section/17-%E6%8E%92%E5%BA%8F%E7%AE%97%E6%B3%95.html#%E4%BC%98%E5%8C%96-2)
- koa中间件原理
- 鉴权&token&SSO
- 标记list
- node常见模块使用
- 虚拟列表 
- 骨架屏
- H5常见样式问题
- H5常见问题
- 继续提高简历质量：list+do
- web安全和攻击
- https

## 拟新增
```
谨慎扩张
克制 
注意精力时间的评估
先保证目前这一版简历和algo
  - 深度 和 高度优先
  - 设计模式 可以试试看 也许可以加上 也会增色不少 冲击p6+ p7的一个武器
```
### 了解常见的设计模式和设计原则
- 设计原则
- 单例模式
- 订阅模式
- 工厂模式
- 策略模式
- 代理模式
- 装饰器模式
- 责任链模式
### 有一定的H5移动端开发经验
```
@打车-H5营销页面开发
```
- 还原设计稿 rem适配
- 点击穿透 滑动穿透
- 1px问题
- jsBridge
- 响应式：布局
- 瀑布布局 流式布局
- 虚拟列表
### 有一定的小程序开发开发经验
```
@优选-微信小程序客户端开发
```
- 原理
