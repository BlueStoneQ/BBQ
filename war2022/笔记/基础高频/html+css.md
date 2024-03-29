


## HTML
### onLoad vs DOMContentLoaded
- onLoad 事件在页面所有资源（包括 CSS、JavaScript 和图片等）都加载完成后触发
- DOMContentLoaded 事件在页面的主要 HTML 内容被解析并加载完成后触发。（script标签的defer异步加载后执行的时机就是DOMContentLoaded）

### script中的defer和async
- defer：延迟执行，在HTML解析完成后，触发DOMContentLoaded事件之前执行，只执行一次
- async：异步执行，下载完就执行，执行完后继续执行HTML，可以执行多次

## CSS

### BFC
- [高频-BFC](https://febook.hzfe.org/awesome-interview/book1/css-bfc)

#### 概念
1. 格式化上下文是一系列相关盒子进行布局的环境。不同的格式化上下文有不同的布局规则
  - me: 可以倾向于BFC描述元素作为容器的表现，也就是更强调布局
2. 当一个盒子建立一个独立格式化上下文时，它创建了一个新的独立布局环境。除了通过改变盒子本身的大小，盒子内部的后代不会影响格式化上下文外部的规则和内容，反之亦然。
3. 在 BFC 中，盒子从包含块的顶部开始，在垂直方向上一个接一个的排列。相邻盒子之间的垂直间隙由它们的 margin 值决定。在同一个 BFC 中，相邻块级盒子的垂直外边距会合并
4. BFC中布局环境的独立性：BFC内外互不影响。
  - BFC 包含内部的浮动（解决内部浮动元素导致的高度塌陷）。
  - BFC 排斥外部的浮动（触发 BFC 的元素不会和外部的浮动元素重叠）
  - 外边距折叠的计算不能跨越 BFC 的边界
5. 各自创建了 BFC 的兄弟元素互不影响（注：在水平方向上多个浮动元素加一个或零个触发 BFC 的元素可以形成多列布局）
- 通过 BFC 可以实现灵活健壮的自适应布局，在一行中达到类似 flexbox 的效果

#### 作用
1. 处理margin塌陷问题
  - 给其中一个触发BFC即可，因为之前2个box属于同一个BFC，margin值会取2者最大的
  - 属于同一个BFC的两个相邻容器的上下margin会重叠
2. 清除float引起的父元素高度塌陷（一般给父元素设置overflow:hidden就可以）
  - 计算BFC高度时浮动元素也参于计算, 其实也就是float元素本身就触发了BFC，所以父元素也触发BFC后，就可以被float元素撑起来了
3. 健壮的自适应布局
- 多列自适应布局：BFC的区域不会与浮动容器发生重叠
```css
/* 2栏布局 */
.left {
  float: left;
}

.right {
  overflow: hidden; /* 这里会自适应 */
}
```

#### 触发
所谓触发就是将当前元素变成一个BFC（也就是具有BFC特性的容器）
1. overflow非visible之外的其他属性
2. 脱离文档流：float不为none / positive 不是relative或者static
3. flex / grid 的直接子元素
4. html根元素

### CSS动画

#### Animation
- 自动可以执行的动画
```css
.loading {
  animation: circle 1s infinite linear;
}

@keyframes circle {
  0%: {
    transform: rotate(0deg);
  }
  100%: {
    tansform: rotate(360deg);
  }
}
```

- 让执行结果保留在动画停止的地方：
```css
animation-play-state: running;
animation-play-state: paused;
```

#### transform/其他触发式动画 + transition
#### transform/其他触发式动画 + transition
- transition: 一般需要:hover之类的进行触发，同一个元素，指定了transform后，当它的一些样式发生改变的时候，会遵循transition提供的渐变的策略
```css
/* property name (默认值：all) | duration | timing function | delay */
transition: margin-right        4s         ease-in-out       1s;
```
- transform:
  - 会使用GPU渲染，所以不会回流和重绘,所以 一般在样式发生改变时优先使用

### 注意：js动画
- 使用window.requestAnimationFrame()，它可以把代码推迟到下一次重绘之前执行，而不是立即要求页面重绘。
```js
const element = document.getElementById('some-element-you-want-to-animate');
let start;

// 该回调函数会被传入DOMHighResTimeStamp参数，该参数与performance.now()的返回值相同，它表示requestAnimationFrame() 开始去执行回调函数的时刻。
function step(timestamp) {
  if (start === undefined)
    start = timestamp;
  const elapsed = timestamp - start;

  //这里使用`Math.min()`确保元素刚好停在 200px 的位置。
  element.style.transform = 'translateX(' + Math.min(0.1 * elapsed, 200) + 'px)';

  if (elapsed < 2000) { // 在两秒后停止动画
    window.requestAnimationFrame(step);
  }
}

window.requestAnimationFrame(step);
```



#### 优化
- willChange
 - 如果一个元素在被点击的时候会发生变化，那么就在该元素被悬停的时候设置will-change，这样就给了浏览器足够的时间来优化
 - 建议使用JavaScript来设置和取消will-change，但是在某些情况下，在css中进行设置（并保留）是更好的选择。

### css启动GPU加速
- 并不是所有的CSS属性都能触发GPU的硬件加速，实际上只有少数属性可以，比如下面的这些：          
  - transform
  - opacity
  - filter

### 场景应用

#### 画0.5px的线
- tansform: scale(0.5, 0.5)
- <meta name="viewport" content="width=device-width, initial-scale=0.5, minimum-scale=0.5, maximum-scale=0.5"/>

## px问题
1. 0.5px
2. view-port
  - 直接写死：<meta name="viewport" content="initial-scale=0.5, maximum-scale=0.5, minimum-scale=0.5, user-scalable=no">  
  - js动态设置
  ```js
  const scale = 1 / window.devicePixelRatio;
  // 这里 metaEl 指的是 meta 标签对应的 Dom
  metaEl.setAttribute('content', `width=device-width,user-scalable=no,initial-scale=${scale},maximum-scale=${scale},minimum-scale=${scale}`);
  ```
  - 副作用：这样解决了，但这样做的副作用也很大，整个页面被缩放了。这时 1px 已经被处理成物理像素大小，这样的大小在手机上显示边框很合适。但是，一些原本不需要被缩小的内容，比如文字、图片等，也被无差别缩小掉了。
3. 利用伪元素覆盖：先放大伪元素，然后再scal:0.5
```css
.container[data-device="2"] {
    position: relative;
}
.container[data-device="2"]::after{
    position:absolute;
    top: 0;
    left: 0;
    width: 200%;
    height: 200%;
    content:"";
    transform: scale(0.5);
    transform-origin: left top;
    box-sizing: border-box;
    border: 1px solid #333;
}
```
