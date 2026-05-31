## 五、CSS 布局



## 目录

- [5.1 三栏布局](#51-三栏布局)
- [5.2 上中下布局](#52-上中下布局)
- [5.3 CSS 特殊场景](#53-css-特殊场景)

---

### 5.1 三栏布局

⭐⭐⭐
**考点**：CSS 布局、Flex、Grid、浮动、定位

**需求**：实现左右固定宽度，中间自适应的三栏布局

#### 5.1.1 Flex 布局

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .container {
      display: flex;
      height: 200px;
    }
    .left {
      width: 200px;
      background: #f00;
    }
    .center {
      flex: 1;
      background: #0f0;
    }
    .right {
      width: 200px;
      background: #00f;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="left">左侧</div>
    <div class="center">中间</div>
    <div class="right">右侧</div>
  </div>
</body>
</html>
```

#### 5.1.2 Grid 布局

```html
<style>
  .container {
    display: grid;
    grid-template-columns: 200px 1fr 200px;
    height: 200px;
  }
  .left {
    background: #f00;
  }
  .center {
    background: #0f0;
  }
  .right {
    background: #00f;
  }
</style>
```

#### 5.1.3 浮动布局

```html
<style>
  .container {
    height: 200px;
  }
  .left {
    float: left;
    width: 200px;
    height: 100%;
    background: #f00;
  }
  .right {
    float: right;
    width: 200px;
    height: 100%;
    background: #00f;
  }
  .center {
    margin: 0 200px;
    height: 100%;
    background: #0f0;
  }
</style>
<div class="container">
  <div class="left">左侧</div>
  <div class="right">右侧</div>
  <div class="center">中间</div>
</div>
```

#### 5.1.4 绝对定位布局

```html
<style>
  .container {
    position: relative;
    height: 200px;
  }
  .left {
    position: absolute;
    left: 0;
    width: 200px;
    height: 100%;
    background: #f00;
  }
  .center {
    margin: 0 200px;
    height: 100%;
    background: #0f0;
  }
  .right {
    position: absolute;
    right: 0;
    width: 200px;
    height: 100%;
    background: #00f;
  }
</style>
```

#### 5.1.5 圣杯布局

```html
<style>
  .container {
    padding: 0 200px;
    height: 200px;
  }
  .center {
    float: left;
    width: 100%;
    height: 100%;
    background: #0f0;
  }
  .left {
    float: left;
    width: 200px;
    height: 100%;
    margin-left: -100%;
    position: relative;
    left: -200px;
    background: #f00;
  }
  .right {
    float: left;
    width: 200px;
    height: 100%;
    margin-left: -200px;
    position: relative;
    right: -200px;
    background: #00f;
  }
</style>
<div class="container">
  <div class="center">中间</div>
  <div class="left">左侧</div>
  <div class="right">右侧</div>
</div>
```

**总结**：
- **核心思路**：左右固定宽度，中间自适应
- **关键点**：
  1. Flex 和 Grid 是现代布局的首选
  2. 浮动布局需要注意清除浮动
  3. 圣杯布局利用负 margin 实现

---

### 5.2 上中下布局

⭐⭐
**考点**：CSS 布局、Flex

**需求**：实现上下固定高度，中间自适应的布局

#### 5.2.1 Flex 布局

```html
<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .header {
    height: 60px;
    background: #f00;
  }
  .main {
    flex: 1;
    background: #0f0;
  }
  .footer {
    height: 60px;
    background: #00f;
  }
</style>
<div class="container">
  <div class="header">头部</div>
  <div class="main">主体</div>
  <div class="footer">底部</div>
</div>
```

#### 5.2.2 Grid 布局

```html
<style>
  .container {
    display: grid;
    grid-template-rows: 60px 1fr 60px;
    height: 100vh;
  }
  .header {
    background: #f00;
  }
  .main {
    background: #0f0;
  }
  .footer {
    background: #00f;
  }
</style>
```

**总结**：
- **核心思路**：上下固定高度，中间自适应
- **关键点**：
  1. Flex 布局使用 flex: 1 实现中间自适应
  2. Grid 布局使用 1fr 实现自适应
  3. 需要设置容器高度为 100vh

---

### 5.3 CSS 特殊场景

⭐⭐
#### 5.3.1 CSS 三角形

```html
<style>
  .triangle {
    width: 0;
    height: 0;
    border-left: 50px solid transparent;
    border-right: 50px solid transparent;
    border-bottom: 100px solid #f00;
  }
</style>
<div class="triangle"></div>
```

**原理**：利用 border 的特性，将宽高设为 0，只显示一个方向的 border

#### 5.3.2 1px 边框问题

**问题**：在高清屏（Retina）上，1px 的边框会显得很粗

**解决方案**：

```html
<style>
  /* 方案一：transform scale */
  .border-1px {
    position: relative;
  }
  .border-1px::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: #000;
    transform: scaleY(0.5);
    transform-origin: 0 0;
  }

  /* 方案二：viewport + rem */
  @media (-webkit-min-device-pixel-ratio: 2) {
    html {
      font-size: 50px;
    }
  }
  @media (-webkit-min-device-pixel-ratio: 3) {
    html {
      font-size: 33.33px;
    }
  }
</style>
```

#### 5.3.3 等比伸缩的矩形

**需求**：实现一个宽高比固定的矩形，宽度自适应

```html
<style>
  /* 方案一：padding-top */
  .box {
    width: 100%;
    padding-top: 56.25%; /* 16:9 = 9/16 = 0.5625 */
    background: #f00;
    position: relative;
  }
  .content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  /* 方案二：aspect-ratio（现代浏览器）*/
  .box {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #f00;
  }
</style>
```

**总结**：
- **核心思路**：利用 CSS 特性实现特殊效果
- **关键点**：
  1. 三角形：利用 border 特性，宽高设为 0
  2. 1px 边框：使用 transform: scaleY(0.5) 或 viewport 方案
  3. 等比伸缩：padding-top 百分比相对于宽度，或使用 aspect-ratio

---

