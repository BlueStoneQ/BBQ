## HTML
## CSS
### 场景应用
#### 画0.5px的线
- tansform: scale(0.5, 0.5)
- <meta name="viewport" content="width=device-width, initial-scale=0.5, minimum-scale=0.5, maximum-scale=0.5"/>
## 1px问题
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
#container[data-device="2"] {
    position: relative;
}
#container[data-device="2"]::after{
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
