## 数据类型
### null 与 undefined的区别
- undefined 代表的含义是未定义，null 代表的含义是空对象。一般变量声明了但还没有定义的时候会返回 undefined，null主要用于赋值给一些可能会返回对象的变量，作为初始化。
- undefined 在 JavaScript 中不是一个保留字，这意味着可以使用 undefined 来作为一个变量名，但是这样的做法是非常危险的，它会影响对 undefined 值的判断。我们可以通过一些方法获得安全的 undefined 值，比如说 void 0。
### typeof null的原因
- 历史遗留：null的类型标签（部分bit位来描述数据类型）也是000，和Object的类型标签一样，所以会被判定为Object
### 0.1+0.2!==0.3 
- 为何
  - 相加其实是2个数字的二进制相加
  - 小数的二进制表示是无限循环小数
  - 截取：浮点数：64位,存储时会对无限循环小数发生截取（52位）
  - 这样： 0.1 + 0.2 加出来的结果的二进制 !== 0.3的二进制
- 如何让其相等：
  - 2个数的差值小于机器精度（设置的一个误差范围）
  - Math.abs(arg1 - arg2) < Number.EPSILON
### isNaN和Number.isNaN的区别
- isNaN：
  - 会尝试将这个参数转换为数值，任何不能被转换为数值的的值都会返回 true，因此非数字值传入也会返回 true ，会影响 NaN 的判断
- Number.isNaN：
  - 会首先判断传入参数是否为数字，如果是数字再继续判断是否为 NaN ，不会进行数据类型的转换，这种方法对于 NaN 的判断更为准确。
### ==的强制转换规则（意义不大）
### 包装类型 - 叙述不太清楚
- 基本类型是没有属性和方法的，但是为了便于操作基本类型的值，在调用基本类型的属性或方法时 JavaScript 会在后台隐式地将基本类型的值转换为对象
- 在访问'abc'.length时，JavaScript 将'abc'在后台转换成String('abc')
- 显示转换：
  - 基本类型 -> 包装类型：Object(a) // String {"abc"}
  - 包装类型 -> 基本类型：
  ```js
  var a = 'abc'
  var b = Object(a)
  var c = b.valueOf() // 'abc'
  ```
- 一个判断输出的case:
  ```js
  var a = new Boolean( false );
  if (!a) {
    console.log( "Oops" ); // never runs
  }
  // 什么都不会打印，因为虽然包裹的基本类型是false，但是false被包裹成包装类型后就成了对象，所以其非值为false
  ```
### [⭕️-多杂-性价比低-但需要熟悉]隐式类型转换 - 太多了点 整理下即可
- 隐式类型转换主要发生在+、-、*、/以及==、>、<这些运算符之间。而这些运算符只能操作基本类型值
### bigint 提案 原因
- Number的范围:Number.MAX_SAFE_INTEGER: 安全存储 -(2^53 - 1) 到 2^53 - 1 之间的数值（包含边界值）。
- 目的：解决大数计算的不准确问题：
  - ⼀旦超过这个范围，js就会出现计算不准确的情况，这在⼤数计算的时候不得不依靠⼀些第三⽅库进⾏解决，因此官⽅提出了BigInt来解决此问题。
## 基础
### [⭕️]常用正则[手写]
- [正则专项训练-不能错过](https://juejin.cn/post/7021672733213720613)
  - 里面的题都得做一遍 写到BBQ/手写/data-handle/Reg训练.js中
### js内置对象-实际意义也不大 读一下即可
- BOM
- 各种类型：Date Regexp等
- Math等
### [⭕️]常见的位运算符与规则
- & |
- ^ 
- ~
- << 左边的二进制位丢弃 - 若左移时舍弃的高位不包含1，则每左移一位，相当于该数乘以2。
- >> 正数左补0，负数左补1，右边丢弃 - 每右移一位，相当于该数除以2。
### 类数组 与 转换 + 遍历
- 概念：一般而言是一个对象，属性是数字(字符串), 有一个length属性
  - eg:  {'1':'gg','2':'love','4':'meimei',length:5};
- 有哪些类数组？
  - arguents DOM方法返回结果
- 类数组如何调用数组方法：
  1. 数组方法通过call来调用
  2. 转化为数组
### [⭕️]编码:ascll unicode utf-8 utf-16 utf-32的区别
- ascll：奇偶校验位 + 7bit,主要表示英语
- unicode 万国码
  - utf-8，可变长，1-4个字节
  - utf-16
  - utf-32
### escape encodeURI encodeURIComponent的区别
- escape不熟 已经不推荐了？没必要深究 性价比不高
### [⭕️]ajax手写
### 为什么要变量提升，导致了什么问题
- 本质原因是 js 引擎在代码执行前有一个解析的过程，创建了执行上下文，初始化了一些代码执行时需要用到的对象。当访问一个变量时，会到当前执行上下文中的作用域链中去查找，而作用域链的首端指向的是当前执行上下文的变量对象，这个变量对象是执行上下文的一个属性，它包含了函数的形参、所有的函数和变量声明，这个对象的是在代码解析的时候创建的。
首先要知道，JS在拿到一个变量或者一个函数的时候，会有两步操作，即解析和执行。
  - 解析阶段
    - 解析的时候会先创建一个全局执行上下文环境，先把代码中即将执行的变量、函数声明都拿出来，变量先赋值为undefined，函数先声明好可使用。
  - 执行阶段
- 为什么会进行变量提升呢
  1. 提高性能
  2. 容错性更好
- [这里也讲得比较清晰](https://juejin.cn/post/6940945178899251230#heading-62)
### 尾调用优化
ES6的尾调用优化只在严格模式下开启，正常模式是无效的。
这是因为在正常模式下，函数内部有两个变量，可以跟踪函数的调用栈。
arguments：返回调用时函数的参数。
func.caller：返回调用当前函数的那个函数。
尾调用优化发生时，函数的调用栈会改写，因此上面两个变量就会失真。严格模式禁用这两个变量，所以尾调用模式仅在严格模式下生效。

### weakMap weakSet与垃圾回收机制
- weakMap的key必须为引用类型
- weakset的val必须为引用类型
### 原型与继承
### 异步编程
### 执行上下文+作用域链+闭包
- [video:执行上下文+作用域链+闭包](https://www.bilibili.com/video/BV1nb411P7tQ?p=18&vd_source=9365026f6347e9c46f07d250d20b5787)
- 变量提升：
  - 在执行之前有一个预编译，会发生变量提升（而变量提升只是创建执行上下文的一部分动作）：
  - 变量提升：var定义的变量 会被提升到程序最开头 并赋值为undefined
  - 函数提升：function声明的函数 会被提升到开头 所以可以在定义前调用：
  ```js
  fn()
  function fn() {}
  ```
- 执行上下文 
  - 在预编译阶段会创建执行上下文：这部分会包括3部分工作：
    1. 创建变量对象
      - 收集：变量 函数+函数形参
      - window
      - 局部：无明确指向 但存在
    2. 确认this指向
      - 全局环境下 - window
      - 局部环境下 - 局部调用这段代码的对象
    3. 创建作用域链
      - 父级的作用域链 + 当前变量对象
- 执行上下文：
  - 可以理解为一个对象 该对象记录了以下信息：
  ```js
  {
    变量对象：{变量 函数+函数形参}, 
    scopeChain: 父级的作用域链 + 当前的变量对象
    this: 全局window || 局部调用这段代码的对象
  }
  ```
### 面向对象
## DOM
### 常见的DOM操作
- [常见DOM操作](https://juejin.cn/post/6844903604445249543)
#### 增删改查
1. 增：创建元素 
  - document.createELement(tagName)
  - document.createTextNode()
  - document.cloneNode(isDeep)
  - document.createDocumentFragment()
2. 增：挂载元素
  - parentNode.appendChild
    - 添加到调用该方法的节点的子元素的末尾
  - parentNode.insertBefore(newNode, oldNode)
  - parentNode.replaceChild(newNode, oldNode)
3. 删：删除元素
  - parentNode.removeChild(childNode)
4. 改：更改元素
5. 查：获取DOM
  1. 获取根元素: document.documentElement
    -  对于任何非空 HTML 文档，调用 document.documentElement 总是会返回一个 <html> 元素，且它一定是该文档的根元素。借助这个只读属性，能方便地获取到任意文档的根元素。
  2. 
    - id: document.getElementById()
    - class: document.getElementsByCLass()
    - Tag：document.getELementsByTagName()
    - css选择器：
      - document.querySelector(css选择器) - 返回第一个匹配的元素
      - document.querySelectorAll(css选择器) - 返回所有匹配的元素，NodeList
6. [new]节点关系型：
  - 父
    - el.parentNode
      - 父节点可能是Element，Document或DocumentFragment
    - parentElement
      - 与parentNode的区别在于，其父节点必须是一个Element，如果不是，则返回null
  - 子
    - el.childNodes()
    - el.children()
    - el.firstChild()
    - el.lastChild() // 无子节点 则会返回null
    - el.hasChildNodes() // 仅仅判断当前节点是否有子节点
  - 兄弟
    - 前驱节点：
      - el.previousSibling
        - Gecko内核的浏览器会在源代码中标签内部有空白符的地方插入一个文本结点到文档中.因此,使用诸如Node.firstChild和Node.previousSibling之类的方法可能会引用到一个空白符文本节点, 而不是使用者所预期得到的节点
      - el.previousElementSibling
        - 和上面的差异：element型的节点一定是element，不会是其他空白节点等东西
    - 后驱节点：
      - el.nextSibling
      - el.nextElementSibling
7. 属性的增删改查
  - el.setAttribute('name', 'xxx')
  - el.getAttribute('name')
  - el.removeAttribute('name')
8. 样式
  - window.getComputedStyle()
  - el.getBoundingCLientRect()
  - 直接设置样式
  ```js
  el.style.color = 'red';
  el.style.setProperty('font-size', '16px');
  el.style.removeProperty('font-size');
  ```
  - 动态添加样式规则-style
  ```js
  const styleEl = document.createElement('style');
  styleEl.innerHtml = "body { color: red }";
  document.head.appendChild(styleEl);
  ```
### 遍历DOM
- 其实本质上就是nodeList是类数组，就是类数组的遍历
### 元素位置
- offsetTop
- scrollTop
### 元素尺寸与位置
```
1. 画个图描述下
- 元素尺寸
- 文档（网页）尺寸
- 元素距离文档的定位位置
- 视口的尺寸
- 注意：这几个族的尺寸属性都是只读的，每次访问都会重新计算，所以要减少查询它们的次数，例如用一个变量存起来
```
- offset族:
  - 尺寸：el.offsetWidth + el.offsetHeight
    - border + padding + content，即：元素的可见部分
  - 位置：
    - el.offsetTop + el.offsetLeft
      - 这个值是相对于el.offsetParent的
      ```js
      // 这个才是最稳妥的 获取元素距离文档顶部body元素的top值的，可以用来做图片懒加载中是否进入视口的判断 - 当然这个值其实在固定的文档中只需要求一次，距离文档顶部的距离一般是不会变的
      const getOffsetTop = (el) => {
        let offsetTop = el.offsetTop;
        let curEl = el.offsetParent;

        while (curEl !== null) {
          offsetTop += curEl.offsetTop;
          curEl = curEl.offsetParent;
        }

        return offsetTop;
      }
      ```
- scroll族：
  - 尺寸：el.scrollWidth + el.scrollHeight
    - 获取文档的尺寸：document.documentElement.scrollHeight
    - 在文档尺寸 <= 视口尺寸的时候，el.scrollHeight === el.clientHeight
    - 文档尺寸 > 视口尺寸，el.scrollHeight === 文档本身的尺寸，el.clientHeight === 视口的尺寸
  - 位置：
    - el.scrollTop + el.scrollWidth
      - 其实就是代表元素滚动了多少
      ```js
      // 检测元素是否在顶部 如果不是 则将其滚回顶部
      function scroll2Top(el) {
        if (el.scrollTop !== 0) {
          el.scrollTop = 0;
        }
      }
      ```
- client族：
  - 尺寸：el.clientWidth + el.clientHeight
    - padding + content
    - 经常用来获取视口的尺寸：document.documentElement.clientHeight
  - 无位置属性
- [el.getBoundingClientRect](https://developer.mozilla.org/zh-CN/docs/Web/API/Element/getBoundingClientRect)
  - 坐标原点：视口的左上角，而不是文档的左上角 
  - 该方法返回的 DOMRect 对象中的 width 和 height 属性是包含了 padding 和 border-width 的，而不仅仅是内容部分的宽度和高度。
    在标准盒子模型中，这两个属性值分别与元素的 width/height + padding + border-width 相等。
    而如果是 box-sizing: border-box，两个属性则直接与元素的 width 或 height 相等。
### 访问元素的尺寸位置信息会不会引起回流或者重绘？为什么？
- [关于浏览器的回流和重绘机制](https://segmentfault.com/a/1190000017329980#item-3)
- 访问这些属性和方法都需要返回最新的布局信息，因此浏览器不得不清空队列，触发回流重绘来返回正确的值。因此，我们在修改样式的时候，最好避免使用上面列出的属性，他们都会刷新渲染队列。如果要使用它们，最好将值缓存起来。
### [⭕️-掌握有限]mutationObserver
- [参考:mutationObserver](https://blog.fundebug.com/2019/01/10/understand-mutationobserver/)
- 观察 DOM 元素，并在检测到更改时触发回调。
- DOM 的任何变动，比如节点的增减、属性的变动、文本内容的变动，这个 API 都可以得到通知。
- 它与事件有一个本质不同：事件是同步触发，也就是说，DOM 的变动立刻会触发相应的事件；Mutation Observer 则是异步触发，DOM 的变动并不会马上触发，而是要等到当前所有 DOM 操作都结束才触发。
这样设计是为了应付 DOM 变动频繁的特点。
### [⭕️-待学]shadowDOM
- shadowDOM 属于 web component的一部分
### ajax+axios+fetch的区别
## BOM
### BOM概念
- 就是浏览器对象模型，也就是用对象来代表浏览器
### BOM包括哪几种对象
- window
- navigator
- screen
- history
### 如何用for...of遍历对象
### 创建执行上下文
- 下面这个答案写的很好，解释了一部分js运行的机制：
```
简单来说执行上下文就是指：
在执行一点JS代码之前，需要先解析代码。解析的时候会先创建一个全局执行上下文环境，先把代码中即将执行的变量、函数声明都拿出来，变量先赋值为undefined，函数先声明好可使用。这一步执行完了，才开始正式的执行程序。
在一个函数执行之前，也会创建一个函数执行上下文环境，跟全局执行上下文类似，不过函数执行上下文会多出this、arguments和函数的参数。

全局上下文：变量定义，函数声明
函数上下文：变量定义，函数声明，this，arguments

```

--- 
## 原型与继承
### 原型链的终点
- null
- Object.getPrototypeOf(Object.prototype)
```js
  const findEndOfProto = (obj) => {
      while (obj) {
          obj = Object.getPrototypeOf(obj);
          console.log(obj);
          
      }
  }
  findEndOfProto([])
```

--- 
## ES6
### 严格模式
- [es6-严格模式](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Strict_mode)
### 如果new一个箭头函数会怎么样？
- 报错: Uncaught TypeError: a is not a constructor
- 箭头函数：无prototype + 无自己的this指向
### proxy vs Object.defineProperty
- vue使用proxy代替defineProperty的原因:
  - Proxy 无需一层层递归为每个属性添加代理，一次即可完成以上操作，性能上更好，并且原本的实现有一些数据更新不能监听到，但是 Proxy 可以完美监听到任何方式的数据改变，唯一缺陷就是浏览器的兼容性不好。
### proxy可以实现什么功能
### 获取嵌套很深的对象属性
- lodash.get
- ?. ?[index]
- 解构： { a: { b: { c } } } = obj；
### ESM和commonjs的区别
- 参考：《ES6标准入门》-阮一峰-章23.2
1. 输出拷贝 & 输出引用
  - 
2. esm import的read-only属性
3. esm存在export/import提升

### UMD实践
- [UMD实践-理念](https://segmentfault.com/a/1190000020226119)
- [webpack设置导出为umd-libraryTarget: 'umd'](https://gapgao.github.io/2020/02/23/%E6%90%9E%E6%87%82CJS&UMD&ESM/#webpack-%E9%85%8D%E7%BD%AE)
  - [Prefer to use output.library.type: 'umd'](https://webpack.docschina.org/configuration/output/#type-umd)
  - 不过我们实际开发并不会打包成umd格式的文件，因为umd格式的包文件很大。
    - 一般会分开打包一个cjs包和一个es包。然后把cjs包写进package.json的main属性，
    - 把es包写进package.json的module属性
      - [关于pkg.module](https://loveky.github.io/2018/02/26/tree-shaking-and-pkg.module/) 
        - 主要就是为了：假如我们是一个 npm 包的开发者，我们该如何发布我们的包以便于使用者在使用我们包的时候也可以利用 Tree Shaking 机制呢？
        - TreeShaking基于ES6 发布在pkg.module时 对方项目shaking的时候 就可以shake我们这个包
        - 那么 我们这个包就打一个ESM的版本 入口挂在pkg.module上
        - 一般给库打包用的rollUp-config.output.format = 'es'之类的设置 打出包的module方案
        - 我们的源码一般就用ESM写
## 垃圾回收与内存泄露
### 垃圾回收的方式
1. 引用计数
2. 标记清除
### 内存泄露的case
### [迁移到手写]使用requestAnimationFrame实现setTimeOut/setInterval
- 其实 整体实现很像轮询：requestAnimationFrame每隔一段时间看下时间到了没有，到了的话，执行下对应函数，然后继续设置下一个requestAnimationFrame
```js
function setInterval(callback, interval) {
  let timer
  const now = Date.now
  let startTime = now()
  let endTime = startTime
  const loop = () => {
    timer = window.requestAnimationFrame(loop)
    endTime = now()
    if (endTime - startTime >= interval) {
      startTime = endTime = now()
      callback(timer)
    }
  }
  timer = window.requestAnimationFrame(loop)
  return timer
}
let a = 0
setInterval(timer => {
  console.log(1)
  a++
  if (a === 3) cancelAnimationFrame(timer)
}, 1000)
```

## 高阶
### eval和new Function的区别
- 两者都可以用来执行代码，但它们在作用域上有一些区别。

- 在 JavaScript 中，`eval` 和 `new Function` 都可以用来创建新的代码执行环境，但它们在作用域上有一些区别。

`eval` 函数会将传入的字符串作为代码执行，它使用当前执行上下文的变量作用域。也就是说，如果在 `eval` 中定义的变量，它们在全局作用域中可见。例如：

```javascript
let a = 1;
eval("let b = 2;");
console.log(a, b); // 1 2
```

在这个例子中，我们在全局作用域中定义了一个变量 `a`，然后使用 `eval` 执行了一段代码，定义了一个变量 `b`。当我们输出 `a` 和 `b` 时，可以看到它们都在全局作用域中。

而 `new Function` 创建的函数，它的作用域是创建函数时所在的词法环境。也就是说，如果在 `new Function` 中定义的变量，它们只能在创建函数的作用域中可见。例如：

```javascript
let a = 1;
let func = new Function("let b = 2;");
func();
console.log(a, b); // ReferenceError: b is not defined
```

在这个例子中，我们在全局作用域中定义了一个变量 `a`，然后使用 `new Function` 创建了一个函数，该函数内部定义了一个变量 `b`。当我们调用这个函数时，变量 `b` 只在函数的作用域中可见，变量 `a` 仍然是全局作用域中的变量。

总结一下，`eval` 的作用域是全局作用域，而 `new Function` 的作用域是创建函数时所在的词法环境。

### 性能指标
前端性能指标主要包括以下几个方面：

1. First Paint (FP)：首次绘制时间，即页面中可见部分的第一个像素出现在屏幕上的时间。
2. First Contentful Paint (FCP)：页面中开始呈现内容的第一个时间。
3. First Meaningful Paint (FMP)：页面中开始呈现有意义的内容的第一个时间。
4. Largest Contentful Paint (LCP)：页面中最大内容元素绘制完成的时间。
5. Time to First Interactive (TTI)：页面中开始交互的时间。

这些指标的计算方式如下：

1. FP：使用 Performance 对象中的 `firstPaint` 属性得到。
2. FCP：使用 Performance 对象中的 `firstContentfulPaint` 属性得到。
3. FMP：使用 Performance 对象中的 `firstMeaningfulPaint` 属性得到。
4. LCP：使用 Performance 对象中的 `largestContentfulPaint` 属性得到。
5. TTI：使用 Performance 对象中的 `timeToFirstInteractive` 属性得到。

常规值如下：

1. FP：通常在 100ms 内，但某些情况下可能会达到数秒。
2. FCP：通常在 500ms 内，但某些情况下可能会达到数秒。
3. FMP：通常在 1000ms 内，但某些情况下可能会达到数秒。
4. LCP：通常在 2000ms 内，但某些情况下可能会达到数秒。
5. TTI：通常在 500ms 内，但某些情况下可能会达到数秒。

需要注意的是，这些指标的计算方式可能会受到浏览器版本、网络速度、设备性能等因素的影响，因此不能一概而论。同时，这些指标并不能完全代表页面性能的好坏，只能提供一定的参考。在实际开发中，需要根据具体需求进行相应的优化和调整。

### ESM 与 commonJs区别
- import命令是编译阶段执行的，在代码运行之前。因此这意味着被导入的模块会先运行，而导入模块的文件会后执行。这是CommonJS中require（）和import之间的区别
  - 也就是说import很像一个动态链接，使用的时候，链接到这个模块，当然这个模块肯定早早执行过
- require('a.js') 是运行时同步加载，每次加载都会执行a.js, 其实相当于调用require('a.js')这样一个函数

### nodejs中如何使用ESM
- ESM文件的后缀设置为.mjs