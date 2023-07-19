log4js: https://zhuanlan.zhihu.com/p/22110802
  - 配置level dateFile
# 核心概念
## 日志分级
- ALL OFF 这两个等级并不会直接在业务代码中使用。剩下的七个即分别对应 Logger 实例的七个方法，.trace .debug .info ...。也就是说，你在调用这些方法的时候，就相当于为这些日志定了级。
```js
{
  ALL: new Level(Number.MIN_VALUE, "ALL"),
  TRACE: new Level(5000, "TRACE"),
  DEBUG: new Level(10000, "DEBUG"),
  INFO: new Level(20000, "INFO"),
  WARN: new Level(30000, "WARN"),
  ERROR: new Level(40000, "ERROR"),
  FATAL: new Level(50000, "FATAL"),
  MARK: new Level(9007199254740992, "MARK"), // 2^53
  OFF: new Level(Number.MAX_VALUE, "OFF")
}
```
## 日志分类
- 那类别有什么用呢，它比级别更为灵活，为日志了提供了第二个区分的维度，例如，你可以为每个文件设置不同的 category，比如在 set-catetory.js 中：
```js
var log4js = require('log4js');
var logger = log4js.getLogger('myCategary'); // myCategary 就是我们自定义的类别，用来过滤归类日志的第二个维度
```
## 日志落盘:Appender
1. 在没有对 log4js 进行任何配置的时候，默认将日志都输出到了控制台
```js
defaultConfig = {
  appenders: [{
    type: "console",
    dateFile: {
        type: 'dateFile',
        filename: config.logPath, pattern: '-yyyy-MM-dd'
    }
  }],
  categories: {
    default: {
        appenders: ['console', 'dateFile'],
        level: 'info'
    }
  }
}
```
2. 通过log4js.configure来设置我们想要的 appender
```js
var log4js = require('log4js');
log4js.configure({
  appenders: [{
    type: 'file',
    filename: 'default.log' // 将日志输出到了文件中
  }]
})
```
2-1. log4js 提供的 appender
- Console 和 File 都是 log4js 提供的 appender，除此之外还有：
- DateFile：日志输出到文件，日志文件可以安特定的日期模式滚动，例如今天输出到 default-2016-08-21.log，明天输出到 default-2016-08-22.log；
- SMTP：输出日志到邮件；
- Mailgun：通过 Mailgun API 输出日志到 Mailgun；
- levelFilter 可以通过 level 过滤；
等等其他一些 appender，到[这里](https://github.com/log4js-node/log4js-node)可以看到全部的列表

## 日志输出格式：Layout
- Layout 是 log4js 提供的高级功能，通过 layout 我们可以自定义每一条输出日志的格式。log4js 内置了四中类型的格式：
    - messagePassThrough：仅仅输出日志的内容；
    - basic：在日志的内容前面会加上时间、日志的级别和类别，通常日志的默认 layout；
    - colored/coloured：在 basic 的基础上给日志加上颜色，appender Console 默认使用的就是这个 layout；
    - pattern：这是一种特殊类型，可以通过它来定义任何你想要的格式。
- 