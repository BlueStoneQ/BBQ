/**
  * 2023-3-23
  * 一道字节问过2次的题：+ 这个问题还要配合防抖对点击后的handler进行一次HOF的包裹处理（防抖避免过多无效请求）
  * 搜索框选项联想：
    1. 如何避免还未输入完关键词就频繁请求？（防抖）
    2. 如何避免多次关键词联想请求，每个请求返回时机不统一，造成关键词和联想不匹配？
      me：后端接口返回的时候，字段设计上，带上请求的关键词，我们要将该关键词进行setState渲染的时候，先比较下当前input中的值和关键词是否一致，一致的话，进行渲染：
      resData: {
        ketyWords: '西安',
        resultList: [
          '西安大雁塔',
          '西安兵马俑'
        ]
      }
 */