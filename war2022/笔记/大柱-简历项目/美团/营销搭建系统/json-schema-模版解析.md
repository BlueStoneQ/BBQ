## 使用小程序template + 递归 + 循环 对json-schema进行解析
- https://developers.weixin.qq.com/m iniprogram/dev/reference/wxml/template.html
- 拿到json-shema后，通过data注入到渲染容器组件，渲染容器组件通过：循环渲染出原生组件 + 递归渲染自定义组件
```xml
<!-- A模版 定义 -->
<template name="a">
  <!-- render json-schema -->
  <view style="{{style}}">
    <!--这里使用循环+递归 + template.b交叉 ：渲染子组件-->
    <block wx:for="{{children}}">
      <template is="b" data="{{...item}}" />  
    </block>
  </view>
</template>              

<!-- b模版 定义 -->
<template name="b">
  <template is="a" data="{{...item}}" />
</template>

<!--模版入口-->
<template is="a" data="{{...jsonSchema}}" />
```
- 数据在page.js中注入
```js
Page({
  data: {
    jsonSchema: {
      type: 'view',
      style: 'color: 77f; font-size: 12'
      props: {
        a: [],
        b: []
      },
      children: [
        {
          type: 'image',
          value: 'xxx.jpg',
          style: 'color: 77f; font-size: 12'
        }
      ]
    }
  }
})
```