## 简介
- 九坤笔试题：实现一个login表单
## 特点
- 采用配置化的方式实现表单 避免逻辑零散
- promise化的
- 函数式调用的弹窗
- 使用原生node实现了一个静态文件服务器 + post接口
- 采用IIFE包裹逻辑 避免全局变量污染等问题
## 调试测试
```bash
node server.js
```
- 浏览器访问：http://127.0.0.1:?3000/form.html


## me
1. 表单数据的获取：
  - 除了使用
  ```js
  const formEl  = document.getElementById('myForm');
  const formData = new FormData(formEl);
  ```
  - 还可以使用在每个元素的change事件中 将值set到一个from对象，然后最后用json去提交
  ```js
  this.form = {};

  inputEl.oninput(e => {
    this.form.name = e.target.name;
  });

  // 提交的时候 设置header为 application/json
  ```
2. 几个关键的样式：
  ```css
  input:focus {
    outline: none;
    border: 2px solid #07F;
  }
  /** 用div实现button */
  .btn:hover {
    cursor: pointer;
    user-select: none;
  }
  ```