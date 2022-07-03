```
最佳实践先行
```
# js
## js 0.1+0.2 ！== 0.3
- 0.1 的二进制表示为 0.00110011... 后面将会 0011 无限循环，因此二进制无法精确的保存类似 0.1 这样的小数。那这样无限循环也不是办法，又该保存多少位呢？也就有了我们接下来要重点讲解的 IEEE 754 标准。
## 动画 以及动画优化
- 方式
  - CSS
    - animation + keyframe
    - tansform
  - JS
    - requestAnimationFramework
    ```js
    /**
     * @param {number} tocallStamp 本次动画开始执行的时间点的时间戳
    */
    function animationWidth (tocallStamp) {
      // 本次动画
      const div = document.getElementById('box');
      div.style.width - parseInt(div.style.width) + 1 + 'px';
      // 是都要执行下一次动画: 这里是width扩展到200px的时候 就不要继续执行动画了
      if (parseInt(div.style.width) < 200) {
        // 注册下一次执行动画函数
        requestAnimationFrame(animationWidth);    
      }
    }

    requestAnimationFrame(animationWidth);
    ```
    - setTimeout/setTimeinterval
- 优化
  - 提取为独立图层
  - GPU渲染加速




## [2fix]鉴权
### cookie + session
  - Session: 代表着服务器和客户端一次会话的过程。Session 对象存储特定用户会话所需的属性及配置信息。这样，当用户在应用程序的 Web 页之间跳转时，存储在 Session 对象中的变量将不会丢失，而是在整个用户会话中一直存在下去。当客户端关闭会话，或者 Session 超时失效时会话结束。
  - cookie: 添加到 request header 中是「浏览器的行为」，存储在cookie的数据「每次」都会被浏览器「自动」放在http请求中。因此，如果这些数据不是每次都要发给服务器的话，这样做无疑会增加网络流量，这也是cookie的缺点之一
  - 缺点：明文，增加流量，代销有限制
### token
- token一般在cookie中携带，这样就可以完全由后端控制，前端不用干涉
- 当然 header, body也可以存放，但是一般是在cookie中
  - head中需要前端控制 不好迁移 需要每个前端适配
  - body的问题是 get请求不会发送body




## 箭头函数
```
以及箭头函数 和 传统函数的差异 用途差异
```
- 没有自己的this，this来自于定义所在的上下文
  - 不能做构造函数
  - bind等无法改变this指向
- 没有arguments


## 对象专题
```md
对象 和 继承 ES5 ES6，再次理解原型链 create - new API
```
### 核心API
- 构造函数
- 静态方法
  - 集成(复用)相关
    - assign create
  - 元编程
    - defineProperty
      - Configurable Enumerable Writable Value set get
  - 冻结密封
    - prevnetExtentions
      - 不能增加属性
    - seal
      - prevnetExtentions + 不能删除 + 其他元编程也不可以做
      - 如果seal之前 值是可以改变的 依然保持原状-可以改变
    - freeze
      - seal + 值也不能修改 任何修改都不能做
      - 深度冻结: 如果被冻结的对象具有以对象作为值的属性，这些对象可以被更改
        - 可以使用递归深度冻结每个子属性
      - 在Vue中 如果有部分数据data你确保不会修改 可以freeze 这样的话 getter、setter就无法生效 不会引起后面的vue渲染链 会提高很多性能
  - 遍历
    - keys values entrys
    - for in
- 实例方法
  - 原型链
    - hasOwnProperty isPrototypeOf
### 原型链
constructor prototype __proto__ instance
```
instance.__proto__ => prototype
constructor.prototype => prototype
prototype.constrctor => constructor
// 继承
subPrototype.__proto__ => ParentPrototype
```
### 属性遍历
### 私有方法 属性 静态方法 静态属性
- 私有方法/属性：可以将该方法移出对象外 或者 最佳实践是用Symbol来定义方法名 不对外暴露该symbol 则外面就获取不到该方法
- 静态方法：ES6 static
- 静态属性：clssA.xxx = 1;
### 继承
#### ES5 继承
```
继承本质目标是为了复用
一般包括：继承方法 继承属性
继承属性：使用调用父的构造函数获得，使用call将自己的this传递进去，父构造函数将属性挂载到this上
继承方法：使用原型继承，子类原型用隐性原型链指向父类原型，即子类原型是父类原型的实例
```
- 组合继承
```js
function SuperClass(name) {
  this.name = name;
}

SuperClass.prototype.sayName = function() {
  // 这的this是SuperClass实例哦
  console.log(this.name);
}


function SubClass(name) {
  // 继承属性：在自身体内调用父类的构造方法
  SuperClass.call(this, name); // new的时候  第二次调用SuperClass()
}

// 所有的方法都挂在原型上哦，为了避免多次重复定义
// 继承方法: 利用prototype在原型链上继承, 其实本质上是建立原型链：subClass.prototype.__prpto__ => SuperClass.prototype
SubClass.prototype = new SuperClass(); // 第一次调用SuperClass()
```
- 寄生组合继承-最优
  - 组合集成的问题 是 存在父类构造函数的重复调用 见上面代码块
  - 本质上其实就是创造一个父类.prototype的副本作为新的prototype 然后简历和子类的关系 constructor 和 prototype
```js
function SubClass(name) {
  // 继承属性：在自身体内调用父类的构造方法
  SuperClass.call(this, name); // 只有这一次在new的时候会调用
}

// 继承方法
inheritPrototype(subClass, SuperClass);

/** 原型继承：
将父类原型副本强制替换成子类原型（1.副本constructor指向子类；2.子类prototype指向副本），使得子类原型包含父类原型中的所有属性和方法，实现了原型属性和方法的继承。
*/
function inheritPrototype(subClass, superClass) {
  // 创建父类原型的副本
  const prototype = object(superClass.prototype);
  // 按照原型链 修改该副本和子类的指向关系，将该副本作为该子类的原型
  prototype.constructor = subClass;
  subClass.prototype = prototype;
}

```
#### ES6 继承
- [?]语法糖=ES5是怎样的实现
- extends
- super，在extends的时候 在子类构造函数中必须调用，调用之后子实例才会有this
```js
class subClass extends parentClass {
  constructor(...args) {
    // 调用父类构造函数，this指向子类
    super(...args);
  }
}
```


## 正则专题
### 参考
- [正则小册](https://juejin.cn/post/7021672733213720613)
### 相关API
- RegExp
  - exec
    - 返回值：
      - 匹配失败 null
      - 匹配成功：一个数组
        - 完全匹配成功的文本将作为返回数组的第一项，从第二项起，后续每项都对应正则表达式内捕获括号里匹配成功的文本。
        - 更新lastIndex - 在字符串中匹配到的位置
  - test
    - 返回值: bool
- String
  - match
    - regexp有g的话 - 则会返回多个匹配组成的数组
    - regexp无g的话 - 会返回：
      - 第一个匹配
      - 捕获组数组（拼接在第一个匹配后面）
      - 以及多个属性
  - matchAll
    - 返回一个包含所有匹配正则表达式的结果及分组捕获组的迭代器。
  - replace
    - param1：可以是一个regexp
    - param2: 可以是一个fn，
    - 关于捕获组：
    ```js
    // 关于捕获组
    var newstr = str.replace(re, "$2, $1"); // $$ $& $n 
    // 或者函数中 使用捕获组 match = $&, pn = $n
    function replacer(match, p1, p2, p3, offset, string) {
      // p1 is nondigits, p2 digits, and p3 non-alphanumerics
      return [p1, p2, p3].join(' - ');
    }
    var newString = 'abc12345#$*%'.replace(/([^\d]*)(\d*)([^\w]*)/, replacer);
    ```
    - 关于g:
      - 如果pattern是字符串，则仅替换第一个匹配项。
      - 不加g的话 只会匹配第一个符合的字符串
  - search
    - 如果匹配成功，则 search() 返回正则表达式在字符串中首次匹配项的索引;否则，返回 -1。
  - split
### 提取数据
```js
/*
提取年月日
2021-08-14
*/

let reg = /(\d{4})-(\d{2})-(\d{2})/

console.log('2021-08-14'.match(reg))
//  ["2021-08-14", "2021", "08", "14", index: 0, input: "2021-08-14", groups: undefined]

// 第二种解法,通过全局的$1...$9读取 引用的括号数据
let reg = /(\d{4})-(\d{2})-(\d{2})/
let string = '2021-08-14'

reg.test(string)

console.log(RegExp.$1) // 2021
console.log(RegExp.$2) // 08
console.log(RegExp.$3) // 14
```
### 反向引用
```js
/*
  反向引用：其实就是在正则中引用之前匹配过的捕获组 

    写一个正则支持以下三种格式
  2016-06-12
  2016/06/12
  2016.06-12
*/
// 这里再正则中 使用\2对第二个()进行了引用 即\2 = ([-/.]), 且此刻本次匹配中,第二个捕获组已经发生了匹配
let regex = /(\d{4})([-/.])\d{2}\2\d{2}/

var string1 = "2017-06-12";
var string2 = "2017/06/12";
var string3 = "2017.06.12";
var string4 = "2016-06/12";

console.log( regex.test(string1) ); // true
console.log( regex.test(string2) ); // true
console.log( regex.test(string3) ); // true
console.log( regex.test(string4) ); // false

```
### 常用元字符 && 常用单位匹配
- . 任意字符
- \w 单词：数字 字母 下划线 = [0-9a-zA-Z_]
- \s 空白字符 = [\t\v\n\r\f]
- \n \r \t
- [abc] [^abc]
- [A-Z] [^A-Z]
### 量词
- + >= 1 ， = {1,}
- * >= 0 ,  = {0,}
- ? 0 || 1, = {0, 1}
- {n} n个
- {x,y} x <= count <= y
### 位置
- ^n 匹配开头为n的字符串
- n$ 匹配结尾为n的字符串
- ?=n 匹配后面紧跟n的字符串
- ?!n 匹配后面没有紧跟n的字符串
- ?<=n ?<!n 匹配前面（不）紧跟n的字符串
- \B \b 非单词边界 单词边界
### 匹配模式
- g: 当正则表达式使用 "g" 标志时，可以多次执行 exec 方法来查找同一个字符串中的成功匹配。
- i: 执行对大小写不敏感的匹配
- m: 执行[多行匹配](https://zh.javascript.info/regexp-multiline-mode)
### 构建方式
- 字面量: const re = /ab+c/;
- 构造函数：const re = new RegExp('ab+c');
### 经典场景
- trim()
```js
const trim = (str) => {
  return str.replace(/^\s*|\s*$/g, '');
}
```
- 匹配成对标签 - 使用反向引用
```js
const re = /<(^>)+>.*</\1>/g;
console.log(reg.test('<title>regular expression</title>')) // true
```

## 数组专题
### API
- Array
```js
// 创建一个 2 * 3 的数组
let b = new Array(3).fill(1).map(() => new Array(3).fill(2))
```
- Array.from
  - 从类数组 或者 可迭代对象创造一个数组
  ```js
  // arguments对象不是一个 Array 。它类似于Array，但除了length属性和索引元素之外没有任何Array属性。例如，它没有 pop 方法。但是它可以被转换为一个真正的Array
  var args = Array.prototype.slice.call(arguments);
  var args = [].slice.call(arguments);

  // ES2015
  const args = Array.from(arguments);
  const args = [...arguments];

  Array.from({length: 5}, (v, i) => i);
  // [0, 1, 2, 3, 4]
  ```
- 实例方法
  - flat 返回一个新的flat后的数组 
    - arr.flat(Infinity); 
  - pop 返回最后一个删除的元素的值
  - push 返回新数组的长度
  - shift 删除并返回第一个元素的值
  - unshift 添加一个新元素到数组开头 并返回新数组长度
  - reverse 返回该数组
  - sort 
    - 默认升序
    - a - b 升序
    - b - a 降序
    - 或者：
    - < 0 a会在b之前 
    - = 0 a,b相对位置不变
  - splice
    - 返回值：被删除的元素组成的一个数组，如果没有删除，则返回空数组
    - 参数： start [deleteCount] [item1,item2...]
  - 判断：some every find includes indexOf
## 字符串专题
### api
- 正则匹配相关-见正则
- 切割
  - slice  substring
  - 区别：传入正值的时候 一致；传入负值的时候：
    - slice() - 将传入的负参数与字符串长度相加；
    - substring() - 把所有的负值置为0
- 编码相关
  - charCodeAt
- 大小写转换
  - toLowerCase toUpperCase
## Map & Set

## 转义：escape encodeURI encodeURIComponent
- escape: 已经从标准被移除，无需关注
- encodeURI
  - 入参是整个uri, 不会转义对URI有意义的字符：! @ # $& * ( ) = : / ; ? + 
- encodeURIComponent
  - 入参是url.params.value 所以 可以编码以上对URI有意义的字符
  - 编码的范围更广

## 函数式：手写：柯里化 偏函数 AOP compose
- [函数式](https://github.com/BlueStoneQ/BBQ/tree/master/war2022/jsWriteByHand/js/functional)

## 前端router原理（vue-router原理）

## promise：相关方法的实现 + promise的实现也过一下 知道个大概实现思路
[promise手写相关](/Users/qiaoyang/code/github/BBQ/war2022/jsWriteByHand/js/promise-polyfill)
  - 以下方法：基本都是返回一个new Promsise()
  - [√]all race
  - [√]resolve reject 
  - catch finally
  - [√]allSettled any
  - promise本身：过一遍实现：几个核心点 过于tricky的就说记不太清了 展现到某一层即可

## 比较 Object.is === 
```js
// ===  的缺点
-0 === +0 // true
NaN === NaN // false

Object.is(-0, +0) // false
Object.is(NaN, NaN) // true
```

## vue单文件组件
```vue
<template>
</template>

<script>
  export default {}
</script>

<style scoped></style>
```

## vue生命周期
- beforeCreated
- created
- beforeMounted
- mounted
- beforeUpdate
- updated
- beforeDestroy
- destroyed

## vue:keep-alive
- 和 keep-alive 搭配使用的一般有：动态组件 和router-view
- 结合vue-router使用
```html
<keep-alive include="a,b">
    <router-view></router-view>
</keep-alive>
```

## v-if&&v-show
- v-if 是“真正”的条件渲染，因为它会确保在切换过程中条件块内的事件监听器和子组件适当地被销毁和重建。
- v-show 就简单得多——不管初始条件是什么，元素总是会被渲染，并且只是简单地基于 CSS:display进行切换。
- v-if 有更高的切换开销，而 v-show 有更高的初始渲染开销。

## vue-router:路由懒加载

## 如何获取undefined
- undefined在js中不是关键字和保留字，只是标识符，可以被赋值
- void 0; 始终返回undefined，是最保险的

# vue
## vue-direct原理
- 使用时机：当我们的methods中存在操作DOM/BOM的逻辑的时候，就该思考是否可以抽象成一个自定义指令。

# css
## 布局
### 三列布局
- [参考](https://juejin.cn/post/6905539198107942919#heading-37)
- absolute
- flex
- float：center元素需要放在最后
### flex布局
- [参考](https://zhuanlan.zhihu.com/p/25303493)
- 容器属性：
- flex-direction
- flex-wrap
- justify-content
- align-items
- align-content?
- item属性：
- order 默认为0 数值越小 排列越靠前，可以有负值
- flex-basis:？
  - 当主轴为水平方向的时候，当设置了 flex-basis，项目的宽度设置值会失效，flex-basis 需要跟 flex-grow 和 flex-shrink 配合使用才能发挥效果
- flex-grow
- flex-shrink
  - 默认值为0 不变化
- flex: none | [ <'flex-grow'> <'flex-shrink'>? || <'flex-basis'> ]
  - flex 1 ？
    = flex-grow: 1
    + flex-shrink: 1
    + flex-basis: 0%
- align-slef

# node
```
koa-server系统性 原理性深度不够
```
## koa
### koa相关中间件底层原理 - node的http部分
#### koa-body
- 报文主体部分会被转化为二进制数据在网络中传输，所以服务器端首先需要拿到二进制流数据
- post报文不一定是一次拿完的 所以是一个流的形式，通过事件daat和end获取：
- 确认编码：header.Content-Encoding
- req.on('data')
```js
// 示例一
const http = require('http')

http.createServer((req, res) => {
const body = []

req.on('data', chunk => {
  body.push(chunk)
})

req.on('end', () => {
  const chunks = Buffer.concat(body) // 接收到的二进制数据流

  // 利用res.end进行响应处理
  res.end(chunks.toString())
})
}).listen(1234)
```
- ctx.req
- 
## cli

# git
## tag
- [git-tag](https://www.runoob.com/git/git-tag.html)
- 我们想为我们的 runoob 项目发布一个"1.0"版本。 我们可以用 git tag -a v1.0 命令给最新一次提交打上（HEAD）"v1.0"的标签。-a 选项意为"创建一个带注解的标签"。 不用 -a 选项也可以执行的，但它不会记录这标签是啥时候打的，谁打的，也不会让你添加个标签的注解。 我推荐一直创建带注解的标签。
## 撤销
## rebase
## 合并多个提交
## 分支操作

# H5
## 常见样式问题
### 响应式+媒体查询
- 设置<view-port>
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  ```
- 设置媒体查询
