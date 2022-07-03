## vue
- vue：扩展合并：mixin-extends的用法
- vue-具名插槽 + 传参
- vue：发生路由跳转的时候发生了什么-生命周期变化是怎样的？
- vue2:如何实现对数组操作的拦截？AOP? 是只对被响应式化的数据这样处理的吗？
  - [参考](https://juejin.cn/post/6919373017218809864#heading-20)
- vue: keep-alive原理 + 配合：动态组件 router-view
- 自定义指令
- vue懒加载[重要]
  - 实战：需要babel配置 应该是？
- [√]vue-router原理
- vue-router:history配置+服务端配置
- vue-router导航守卫
- vue-router:动态路由
- 具名slot+slot传递参数
- vue-route的导航守卫顺序


## node
### 参考
- [node世界](https://hejialianghe.github.io/node/koa.html#_2-1-nodejs-web%E6%A1%86%E6%9E%B6%E5%8F%8Akoa)
## 标记list
- nodemon？
- 编码
- Buffer.concat()
- node-1中常用模块的学习 stream buffer process children_process fs
- npm link
- koa-router.allowedMethods()
- fs使用流处理文件
- 多个核心模块的了解：系统学习
- koa-server继续
### fs
- fs:stream操作

## js
- 垃圾回收机制
- form对象 - 表单解决方案 文件上传全栈方案

## 浏览器原理
- 安全几个攻击+全称



# 待分类
## 2022-6-8
- HMR原理 和 实现方案, --hot 和 hot:true有什么区别 为什么会这样
- axios fetch怎么选
- vue的按需引入

## 2022-6-7
- vue render函数 入参可以是一个组件实例？
- webpackDefinePlugin
- webpack source-map类型 和 原理
- 关于publicPath: 其实就是在最终构建结果中引入对应静态资源的时候 在src路径前面加上publicPath, 这个publicPath一般我们设置为CDN的值


## 2022-5-31
- 国际化方案

## 2022-5-21
- dom操作：增删改查几种基本操作

## 2022-5-20
- [一份前端工程化教程-很系统-强烈推荐](https://q.shanyue.tech/engineering/)
- axios中的拦截
- 模块方案 UMD
- 常见链式调用的实现：return this 或者 new Constructor
- npm yarn pnpm的区别 和 适用场景
  - lock的作用 和 相关
- lodash按需加载 使用 + 实现
- UMD - 模块方案实现
- 为github主页写一下README.md
  - 将比较好的项目给罗列下
- 图片防盗链原理

## 2022-5-4
- 骨架屏：解决方案 + 原理
- 虚拟列表
- node:核心几个模块的经典使用 + 系统学习
- koa中间件原理
- BFC GPU:will change
- axios: 拦截器
- promise手写专题
- npm-cli：检查更新@ark-cli
- koa-static原理
- onLoad onContentLoadx

## 2022-5-13
- webpack:splitChunk + vender
- webpack:DDLPlugin
- js垃圾回收机制
- koa中间件原理
- 鉴权&token&SSO
- 标记list
- node常见模块使用
- 虚拟列表 
  - 视口 元素的位置信息@小程序
- 骨架屏
- H5常见样式问题
- H5常见问题
- web安全和攻击
- https
- promise
### 项目list-fix
1. 搭建端
2. 秒开 & 性能优化
### 能力list-fix
1. vue & vue-router & vuex & SSR
2. git
3. node & koa-server & cli
4. 工程化 & webpack & rollup
5. 性能指标 & 优化 & SDK
6. [拟新增]设计模式 + 原则
7. [拟新增]TS
8. [拟新增]-有一定的react开发经验
  - 高频-react
  - react官网
### 面经-fix
- 白龙马
- 云粒
- 九坤
- 米哈游
- umu
### 高频
### 手写-专项
### algo
- [链表环入口](https://juejin.cn/post/6994086214617792543)

### 毒牙拔除计划
- 项目-三期:
  - [45min*2]cli + 打包方案
  - [45min*2]fst-sdk + rollUp打包
  - [45min]搭建端解决方案
  - [45min]调试中心：WS部分 - 全景描绘 - HMR原理
    - 自己再本地写一个ws+http的koa服务器 + 客户端用socket.io 打通这个能力
  - [45min]preFetcher：最小模型
- [30min]凑单页优化-相关小程序页面优化方案
- [45min*2]性能指标:系统学习+衡量+SDK设计
- [45min*4]nodejs：koa-server + 常用模块：吸收