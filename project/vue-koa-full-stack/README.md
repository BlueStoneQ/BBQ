## 一个小型的全栈项目
## 目录设计
- server部分可以单独出去，前后端可以分离
## 命令设计
- npm run build 
生成打包后的静态文件到dist中
- npm run deply
将dist中的文件部署到server中的static中
- npm run server
启动服务

## note
1. vue 和 vue-template-compiler 需要版本保持一致
2. [vue-loader和webpack不兼容，导致TypeError: Cannot read property vue of undefined](https://blog.csdn.net/u010616713/article/details/106966772)
3. vue-loader内在还依赖了：css-loader, 所以必须安装
