<a name="Wpwsc"></a>
### 查找表
消除一些特别长的分支case:
```javascript
// 数组查找表 适用：条件语句是数值
const results = [result0,result1,result2,result3,result4,result5,result6,result7,result8,result9,result10,result11]

return results[index]

// 对象查找表：适用：如果条件语句不是数值而是字符串
const map = {
  red: result0,
  green: result1,
}

return map[color]


```
<a name="UTCKd"></a>
#### 函数入参一般为var

1. 我们要知道，一般函数的入参，我们可以看做let/var的处理，也就是可以改变其值；引用类型的，可以改动到外部调用的地方的入参。（函数内改了，外部的引用类型的集合的内容也会变）
<a name="l0Hy8"></a>
### if&switch
从可读性来说，使用 switch 是比较好的（js 的 switch 语句不是基于哈希实现，而是循环判断，所以说 if-else、switch 从性能上来说是一样的）
<a name="JKeCw"></a>
### RegExp
<a name="ARKV8"></a>
#### 获取匹配好的捕获组
<a name="j1UDs"></a>
#### match

1. 使用命名的捕获组：
```javascript
const paragraph = 'The quick brown fox jumps over the lazy dog. It barked.';

const capturingRegex = /(?<animal>fox|cat) jumps over/;
const found = paragraph.match(capturingRegex);
console.log(found.groups); // {animal: "fox"}
```

2. 通过RegExp引用子匹配：
```javascript
// 第二种解法,通过全局的$1...$9读取 引用的括号数据
let reg = /(\d{4})-(\d{2})-(\d{2})/
let string = '2021-08-14'

reg.test(string)

console.log(RegExp.$1) // 2021
console.log(RegExp.$2) // 08
console.log(RegExp.$3) // 14

作者：前端胖头鱼
链接：https://juejin.cn/post/7021672733213720613
来源：稀土掘金
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。
```

3. 匹配xml中的属性：
```javascript
let regex = /\d{2,5}/g
let string = '123 1234 12345 123456'
// 贪婪匹配
// string.match(regex) // [ 123, 1234, 12345, 12345 ]

// 惰性匹配
let regex2 = /\d{2,5}?/g
// string.match(regex) // [ 12, 12, 34, 12, 34, 12, 34, 56  ]

```

4. 反向引用：\数字，复用前面第几个子分组的正则：

除了通过js引用分组的内容，也可以通过正则来引用分组内容
```javascript
/*
    写一个正则支持以下三种格式
  2016-06-12
  2016/06/12
  2016.06-12
*/
let regex = /(\d{4})([-/.])\d{2}\2\d{2}/
															//\2就是前面第二个分组（-/.）															

var string1 = "2017-06-12";
var string2 = "2017/06/12";
var string3 = "2017.06.12";
var string4 = "2016-06/12";

console.log( regex.test(string1) ); // true
console.log( regex.test(string2) ); // true
console.log( regex.test(string3) ); // true
console.log( regex.test(string4) ); // false

作者：前端胖头鱼
链接：https://juejin.cn/post/7021672733213720613
来源：稀土掘金
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。
```
<a name="AnbYq"></a>
### Array
<a name="2oNxG"></a>
#### Array.from

1. 看到一个序列生成器的实现，比较有意思：
```javascript
/**
* @param start {number} 序列起点
* @param stop {number} 序列终点
* @param step {number} 序列的间隔/步长
*/
const range = (start, stop, step) => {
  return Array.from({
    length: (stop - start) / step + 1
  }, 
  (_, i) => start + (i * step));
}


// usage
range(0, 4, 1);
// [0, 1, 2, 3, 4]
range(1, 10, 2);
// [1, 3, 5, 7, 9]
```
<a name="qOye2"></a>
### Object
<a name="ORVA6"></a>
#### Object.create

1. 关于Object.create(null)，这里的有个说法比较清晰：[https://juejin.cn/post/6844903589815517192](https://juejin.cn/post/6844903589815517192)
   1. Object.create(null) 生成的 对象比较纯净，没有Object上面那么多属性。
   1. 也就是，定制性 掌控性 纯净性更高。这里我们把这种对象，可以定义一个概念描述：纯净对象。

<a name="Object.defineProperty"></a>
#### Object.defineProperty

1. get set实现自存档对象：
```javascript
function Archiver() {
  var temperature = null;
  var archive = [];
  Object.defineProperty(this, 'temperature', {
    get: function() {
      console.log('get!');
      return temperature;
    },
    set: function(value) {
      temperature = value;
      archive.push({ val: temperature });
    }
  });
  this.getArchive = function() { return archive; };
}
var arc = new Archiver();
arc.temperature; // 'get!'
arc.temperature = 11;
arc.temperature = 13;
arc.getArchive(); // [{ val: 11 }, { val: 13 }]
```

<a name="c2Wpr"></a>
#### [event loop](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/EventLoop)

1. 函数 `[setTimeout](https://developer.mozilla.org/zh-CN/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout)` 接受两个参数：待加入队列的消息和一个时间值（可选，默认为 0）。这个时间值代表了消息被实际加入到队列的最小延迟时间。如果队列中没有其它消息并且栈为空，在这段延迟时间过去之后，消息会被马上处理。但是，如果有其它消息，`setTimeout` 消息必须等待其它消息处理完。因此第二个参数仅仅表示最少延迟时间，而非确切的等待时间。
1. 一个 web worker 或者一个跨域的 `iframe` 都有自己的栈、堆和消息队列。两个不同的运行时只能通过 `[postMessage](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/postMessage)` 方法进行通信。如果另一个运行时侦听 `message` 事件，则此方法会向该运行时添加消息。
<a name="KaA9E"></a>
#### js的执行

1. 当javascript代码执行的时候会将不同的变量存于内存中的不同位置：堆（heap）和栈（stack）中来加以区分。其中，堆里存放着一些对象。而栈中则存放着一些基础类型变量以及对象的指针。

[setImediate](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/setImmediate)

1. **JS异步的实现靠的就是浏览器的多线程，当他遇到异步API时，就将这个任务交给对应的线程，当这个异步API满足回调条件时，对应的线程又通过事件触发线程将这个事件放入任务队列，然后主线程从任务队列取出事件继续执行**。
1. requestAnimationFrame处于渲染阶段，不在微任务队列，也不在宏任务队列
1. <br />
