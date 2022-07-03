## 面经
- [牛客-字节面经](https://www.nowcoder.com/discuss/experience?tagId=644&order=1&companyId=665&phaseId=3)
- [前端面试百科-字节](https://interview.html5.wiki/experience.html#%E6%8A%80%E6%9C%AF%E9%97%AE%E9%A2%98)
  - 面试官问的问题都是引导性的，而不是死扣一个具体的知识点叫你填空，通常给一个非常宽泛的话题，让你去发挥，因此给了自己非常大的发挥空间，不过这也和自己前期充分的准备有关系。 面试官尝试去问你一些更加深入的问题，直到把你问住，这是好事情，因为他的水平一般在你之上，能问出深度来，说明他很重视你。

## 算法
- [滑动窗口]// 给定一个字符串，请你找出其中不含有重复字符的 最长子串 的长度。lengthOfLongestSubstring('babcaacbd') = 4
// 实现一个 flat 函数，函数的作用是可以拍平一个数组，如 flat([1, [2, [3,4], [5]]
- 112 路径总和@Tree
- 组合 排列@DFS
  - [DFS:全排列]第三道 leetcode 46 原题
- 给数组中的字符串编号，f(['ab', 'c', 'd', 'ab', 'c']) => ['ab1', 'c1', 'd', 'ab2', 'c2']，写完后问了一下时间和空间复杂度。
- [双指针]实现一个复杂度o(n)的数组去重，返回去重后的元素个数，不能使用任何数组相关的方法
- 实现一个斐波那契数列，时间复杂度、空间复杂度
- 洗牌算法
- [双指针]2数之和
- [DP:序列]leet 53 找出数组中最大的连续子数组和
- [二叉树]找到二叉树路径和为n的路径
- 给定一个整数数组 a，其中1 ≤ a[i] ≤ n （n为数组长度）, 其中有些元素出现两次而其他元素出现一次。【编程】
找到所有出现两次的元素。你可以不用到任何额外空间并在O(n)时间复杂度内解决这个问题吗？(限时5分钟)
[](https://www.nowcoder.com/discuss/397639?source_id=discuss_experience_nctrack&channel=-1)
- 寻找两个二叉树节点的第一个公共父节点。先说思路再写代码，写完之后问了我下复杂度
- [DP-easy-leet-70-爬楼梯]n级台阶，从0开始走起，一次可以走一步或者两步，那么走完n级台阶一共有多少种走法？先讲思路再写代码。
- [DP]主要聊了我做的项目，然后问了个 dp，
基本就是0对应a，1对应b。。。z对应25，问你一串数字 12322 会有几种情况
讲了下解题思路，时间原因，没具体写。
- [组合@DFS](https://cloud.tencent.com/developer/article/1493609)
 - [括号生成](https://leetcode.cn/problems/generate-parentheses/)
- 最长子串@滑动窗口





## 手写
- 碰撞检测：写一道题：给两个矩形，有每个矩形点坐标以及长宽高，判断是否相交（包含也算相交）
- sleep函数
- 输出
```js
window.data=5
var foo={
  data:6,
  click(){
  console.log(this.data)
}
}
div.addEventListener('click',foo.click)
// 点击div写出控制台的打印值
// 如何输出5，如何输出6
```
- 有并发限制的调度器
- css3写一个环形进度条
- array-flat: n维数组转换成1维数组，比如:[1,[2,3],[[4],[5,6]]]变成[1,2,3,4,5,6]
- [setTimeOut@相关手写题]// const repeatFunc = repeat(console.log, 4, 3000);
// repeatFunc("hellworld"); // 会输出 4次 helloworld, 每次间隔3秒

## 问答
### 基础 知识型问答
```
好题
查漏补缺的题
不要关注偏题 或者 实际意义不大的题
```
- 说说Https@b站
- bind如果第一次传入了this我再bind传入一次this，他如果执行的是哪个this
- 说说Promise.race，Promise.all，如果 Promise.all有一个异常了，其他Promise还会继续执行么？（会）
- 如何捕获async await的异常，如果不写await promise报错了你的try catch 能捕获到错误么
- 所有Css3的动画都能用GPU加速么
- 为什么top、offsetTop能引起回流
- 说一下所有你知道前端优化方案
- url输入到页面展现
- 前端新技术
- 了解哪些设计模式
- 宏任务、微任务的区别是什么，除了执行流程还有什么区别
  - postMessage、fetch是宏任务还是微任务，小程序调用JS Bridge 是宏任务还是微任务，区别微任务宏任务的标准是什么？
- CDN原理 - 优化的一部分
- 对Node.js有多少了解（后来才发现简历中写了Node所以每次都会问）
- 小程序元素尺寸位置信息获取 web尺寸位置信息获取@SDK中涉及到计算
- npm如何只publish部分文件
- token放在cookie localstorage sessionStorage中有什么不同吗
- cookie存在哪些安全问题 - 如何预防？
- 移动端适配？
  ```js
  (function () {
    var html = document.documentElement;
    function onWindowResize() {
      html.style.fontSize = html.getBoundingClientRect().width / 20 + 'px';
    }
    window.addEventListener('resize', onWindowResize);
    onWindowResize();
  })(); 
  ```
- 假设有两个子项目，他们需要共用同一个用户体系如何保证关掉页面之后打开另一个项目用户还是登录状态？
Cookie跨站点访问就可以解决。把用户每次登录获取到的Token存储在Cookie中，因为Cookie是可以同站传输的。

### 场景&解决方案
- 让你实现一个微信扫码登录掘金会怎么实现，微信、掘金、客户端这三方的通信流程是怎样的？
- 登录 单点登录从前端到后台应该怎么实现 扫码登录
- 移动端适配解决方案