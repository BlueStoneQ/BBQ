## 资料
- [react+ts](https://jkchao.github.io/typescript-book-chinese/jsx/support.html)
- [参考：react+TS demo](https://github.com/yuyudiandian/react_typescript_demo)
- [参考：applovin笔试题](https://github.com/maoxiaoke/weather-app)
- [🟢习题: 红杉笔试](https://github.com/scdt-china/interview-assignments)
- [webpack-react-ts 构建前端项目](https://juejin.cn/post/6905320663335043086)



## 工程化配置
- webpack.config
- tsconfig
  ```json
  {
    // 想要使用JSX必须做两件事：1. 给文件一个.tsx扩展名 2. 启用jsx选项
    "jsx": "react"/"preverse" // https://www.tslang.cn/docs/handbook/jsx.html
  }
  ```
- 安装依赖：
  - 安装React相关的声明文件：
  ```bash
  npm i -D @types/react @types/react-dom
  ```
## 编码
### 类组件-使用TS
### 函数组件-使用TS
### 使用redux-使用TS