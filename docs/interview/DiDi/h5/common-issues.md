# H5 移动端常见问题

> 这些是 H5 在 WebView/移动浏览器中特有的坑，和 PC Web 不同。

---

## 目录

- [1px 问题](#1px-问题)
- [移动端适配（rem / vw）](#移动端适配rem--vw)
- [安全区域（刘海屏/底部横条）](#安全区域刘海屏底部横条)
- [键盘遮挡输入框](#键盘遮挡输入框)
- [iOS 滚动穿透](#ios-滚动穿透)
- [点击延迟 300ms](#点击延迟-300ms)
- [iOS 橡皮筋效果](#ios-橡皮筋效果)
- [图片模糊（高 DPR）](#图片模糊高-dpr)

---

## 1px 问题

**问题**：设计稿上 1px 的线，在 2x/3x 屏幕上显示为 2px/3px（因为 CSS 的 1px = 1 逻辑像素 = 多个物理像素）。

**方案对比**：

| 方案 | 原理 | 优缺点 |
|------|------|--------|
| `transform: scaleY(0.5)` | 画 1px 再缩小 | 简单，推荐；伪元素实现 |
| viewport scale | `initial-scale = 1/dpr` | 全局生效，但影响所有尺寸，需配合 rem |
| `border-image` | 用图片做边框 | 不灵活 |
| `box-shadow` | `0 0 0 0.5px` | 部分浏览器不支持小数 px |

**推荐方案（transform）**：

```css
.border-bottom-1px {
  position: relative;
}
.border-bottom-1px::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: #e5e5e5;
  transform: scaleY(0.5);            /* 2x 屏 */
  transform-origin: 0 0;
}
@media (-webkit-min-device-pixel-ratio: 3) {
  .border-bottom-1px::after {
    transform: scaleY(0.333);         /* 3x 屏 */
  }
}
```

**viewport 方案**：

```javascript
// 动态设置 viewport scale = 1/dpr
// 效果：CSS 1px = 1 物理像素（全局生效）
const dpr = window.devicePixelRatio;
const scale = (1 / dpr).toFixed(8);
const viewport = document.querySelector('meta[name=viewport]');
viewport.setAttribute('content',
  `width=device-width, initial-scale=${scale}, maximum-scale=${scale}, minimum-scale=${scale}, user-scalable=no`
);
// 需要配合 rem 做尺寸适配（否则所有元素都缩小了）
```

---

## 移动端适配（rem / vw）

**问题**：不同手机屏幕宽度不同，设计稿尺寸怎么等比缩放？

| 方案 | 原理 | 现状 |
|------|------|------|
| **rem** | 1rem = 根元素 font-size，动态设置 font-size 实现缩放 | 成熟方案，兼容性好 |
| **vw** | 1vw = 视口宽度的 1%，天然自适应 | 现代首选，简单直观 |
| **viewport scale + rem** | 配合 1px 方案一起用 | 老方案，现在少用 |

**vw 方案（推荐）**：

```css
/* 设计稿 750px 宽，一个元素 100px → 100/750*100 = 13.33vw */
.box {
  width: 13.33vw;
  font-size: 4.267vw;  /* 设计稿 32px → 32/750*100 */
}

/* 用 postcss-px-to-viewport 自动转换，开发时直接写 px */
```

**rem 方案**：

> 另一种写法参考：[1px.js](../../../war2022/jsWriteByHand/H5/1px.js)（viewport scale + rem 组合方案）

```javascript
// 动态设置 1rem = 屏幕宽度 / 10
const docEl = document.documentElement;
docEl.style.fontSize = docEl.clientWidth / 10 + 'px';

// 设计稿 750px → 1rem = 75px
// 设计稿上 100px 的元素 → 写成 100/75 = 1.333rem
// 用 postcss-pxtorem 自动转换
```

---

## 安全区域（刘海屏/底部横条）

**问题**：iPhone X+ 的刘海和底部 Home Indicator 遮挡内容。

```css
/* 使用 env() 安全区域变量 */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 固定底部按钮 */
.fixed-bottom-btn {
  position: fixed;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom);  /* 留出底部安全区 */
}

/* 需要配合 viewport-fit=cover */
<meta name="viewport" content="..., viewport-fit=cover">
```

---

## 键盘遮挡输入框

**问题**：移动端弹出键盘时，输入框被键盘遮挡。

```javascript
// 方案：监听 input focus，滚动到可视区域
input.addEventListener('focus', () => {
  setTimeout(() => {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);  // 等键盘弹出动画完成
});

// iOS 特有：键盘收起后页面不回弹
window.addEventListener('focusout', () => {
  window.scrollTo(0, 0);
});
```

---

## iOS 滚动穿透

**问题**：弹窗/遮罩出现时，背景页面仍然可以滚动。

```javascript
// 方案 1：弹窗出现时 body overflow hidden + 记录滚动位置
let scrollTop = 0;
function lockScroll() {
  scrollTop = document.scrollingElement.scrollTop;
  document.body.style.position = 'fixed';
  document.body.style.top = -scrollTop + 'px';
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.scrollingElement.scrollTop = scrollTop;
}

// 方案 2：CSS overscroll-behavior: contain（现代浏览器）
.modal {
  overscroll-behavior: contain;
}
```

---

## 点击延迟 300ms

**问题**：移动端浏览器等待 300ms 判断是否双击缩放。

```html
<!-- 现代方案：设置 viewport width=device-width 即可消除 -->
<meta name="viewport" content="width=device-width">
<!-- Chrome 32+ / iOS 9.3+ 自动取消 300ms 延迟 -->

<!-- 兼容方案：touch-action -->
<style>
  * { touch-action: manipulation; }  /* 禁止双击缩放 → 无需等 300ms */
</style>
```

---

## iOS 橡皮筋效果

**问题**：iOS WebView 滚动到顶部/底部时的弹性回弹效果，有时影响交互。

```css
/* 禁止整页橡皮筋（但会影响正常滚动体验） */
body {
  overflow: hidden;
  position: fixed;
  width: 100%;
  height: 100%;
}
/* 内部用独立滚动容器 */
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  height: 100%;
}
```

---

## 图片模糊（高 DPR）

**问题**：1x 图片在 2x/3x 屏幕上被拉伸显示，变模糊。

```html
<!-- 方案 1：srcset 提供多倍图 -->
<img src="icon.png"
     srcset="icon@2x.png 2x, icon@3x.png 3x" />

<!-- 方案 2：统一用 2x 图 + CSS 限制尺寸 -->
<img src="icon@2x.png" style="width: 24px; height: 24px;" />

<!-- 方案 3：用 SVG/iconfont（矢量，不存在模糊问题） -->
```
