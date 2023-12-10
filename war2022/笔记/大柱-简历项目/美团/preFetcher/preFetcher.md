## 分析模板
1. 产生的背景 + 作用
2. 功能版块结构 + 整个闭环流程
3. 各个版块的实现
4. 部分关键实现：能够小规模code出来

## 功能板块结构
register
1. 
getPrefetcheData

### 核心数据结构设计
```js
// Map 
{
  'pageRoute': [
    preFetchPromise1,
    preFetchPromise2,
    ...
  ]
}
```
```js
// prefetcher 设计
const preFetch = (app, query) => {
  // return [p1, p2]
  return [
    fetchPromise1(),
    fetchPromise1(),
  ];
}
```

## 闭环流程

## 各个板块的实现

## 部分关键实现：能够小规模code出来

## 经典问题
1. retry请求问题
  - retry一般是集成在我们封装的fetch中