# 图形库
# 图像识别@AI
# cli脚手架
- https://github.com/imaoda/js-front-end-practice/blob/master/%E6%90%AD%E5%BB%BA%E4%B8%80%E4%B8%AA%E4%BC%81%E4%B8%9A%E7%BA%A7%E8%84%9A%E6%89%8B%E6%9E%B6.md
# dependence
## yeoman
## download-git-repo：下载模版
## git-clone: 也可以下载模版
## download-package-tarball: 下载模版
## handlebars
- js语义化模版库，实现项目的模版部分
## inquirer
## 必要	minimist	解析用户命令，将 process.argv 解析成对象
## 必要	fs-extra	对 fs 库的扩展，支持 promise
## 必要	chalk	让你 console.log 出来的字带颜色，比如成功时的绿色字
## 必要	import-from	类似 require，但支持指定目录，让你可以跨工程目录进行 require，比如全局包想引用工程路径下的内容
## 必要	resolve-from	同上，只不过是 require.resolve
## 必要	inquirer	询问用户并记录反馈结果，界面互动的神器
## 必要	yeoman-environment	【核心】用于执行一个「模板插件包」，后文详细描述
## 锦上添花	easy-table	类似 console.table，输出漂亮的表格
## 锦上添花	ora	提供 loading 菊花
## 锦上添花	semver	提供版本比较
## 锦上添花	figlet	console.log出一个漂亮的大logo
## 锦上添花	cross-spawn	跨平台的child_process (跨 Windows/Mac)
## 锦上添花	osenv	跨平台的系统信息
## 锦上添花	open	跨平台打开 app，比如调试的时候开打 chrome
## shelljs
# devDependence
# server
# dependence
## bcrypt
- Bcrypt是一个加盐的哈希函数，是专门用来对密码做哈希处理的第三方模块。Bcrypt特别适 合处理密码，因为计算机越来越快，而bcrypt能让破解变慢，从而有效对抗暴力攻击
# devdependence
## chokidar
- 监听文件变化 fs.watch()这样的 工业级版
## performance-now
## oauth-sign
## http-signature
## extend
## uuid
## safe-buffer
## qs
## mime-types
## crc   
- https://www.npmjs.com/package/crc
- 生成hush?
## is-type-of
- 完整的type类型判断
## request
- 核心实现：http.request(reqOptions), 利用http/https.request()
```js
self.req = self.httpModule.request(reqOptions)
```

## axios
- [axios源码解读](https://juejin.cn/post/7016255507392364557)
- @学会封装fetch：要从哪些方面封装
- 核心实现：
```js
promise = dispatchRequest.call(this, newConfig);
```
# portfinder
- 返回一个不被占用的port
# devDependence
## karma
## rimraf
## browserify
https://zhaoda.net/2015/10/16/browserify-guide/
- 职能：打包工具 - 可以把nodejs的 打包为 浏览器通过script加载的包
    - main.js和它所引用的模块会按依赖序列整体打包到bundle.js。
- 原理：
    - 理想情况下，大部分不涉及io操作的模块可以在浏览器中直接运行。
    - 部分不能直接运行的，会被打包为一些专门为browser提供的模块类型

# 工程化
# DB
## redis
