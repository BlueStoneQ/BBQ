## 参考
- [webpack教程](https://juejin.cn/post/7023242274876162084#heading-14)
- [webpack考点](https://juejin.cn/post/7023242274876162084)
- [webpack打包原理](https://segmentfault.com/a/1190000021494964)

# 核心概念
## module，chunk 和 bundle 的区别是什么？
- [webpack易混淆概念](https://juejin.cn/post/6844904007362674701#heading-0)
- module，chunk 和 bundle 其实就是同一份逻辑代码在不同转换场景下的取了三个名字：
我们直接写出来的是 module，webpack 处理时是 chunk，最后生成浏览器可以直接运行的 bundle。

### 配置
- [webpack配置案例](https://segmentfault.com/a/1190000007972133?utm_source=sf-similar-article)
### 核心概念
- loader: 本质上,webpack loader 将所有类型的文件,转换为应用程序的依赖图（和最终的 bundle）可以直接引用的模块。
- plugin：在 hooks 回调内部可以通过修改状态、调用上下文 api 等方式对 webpack 产生 side effect。
### 原理
- [参考](https://zhuanlan.zhihu.com/p/363928061) 
- [webpack打包原理-清晰](https://segmentfault.com/a/1190000021494964)
- [webpack核心原理](https://juejin.cn/column/6978684601921175583)
  - 依赖是怎么找到的？
    - 是解析成AST, 然后通过分析AST得到一个依赖图
    - 然后 在打包的时候 依据这个依赖图 
### 过程
- 初始化阶段
  - 收集参数
  - 初始化compiler对象
  - 初始化编译环境：
  - 开始编译
  - 确定入口：entry
- 构建阶段
  - entry - loader - 递归处理：
    - 根据 entry 对应的 dependence 创建 module 对象，调用 loader 将模块转译为标准 JS 内容，调用 JS 解释器将内容转换为 AST 对象，从中找出该模块依赖的模块，再 递归 本步骤直到所有入口依赖的文件都经过了本步骤的处理
    - babel.parser + babel.traverse: （从require语句中）得到module的依赖关系
    - 依赖映射关系：文件路径：文件内容
  - 依赖关系图
    - 上一步递归处理（也就是不断执行上一步）所有能触达到的模块后，得到了每个模块被翻译后的内容以及它们之间的 依赖关系图
    ```js
    // 文件依赖图：本质是个对象，记录文件路径 到 文件依赖+code的映射关系
    {
      fileName1: {
        dependecies,
        code
      },
      fileName2: {
        dependecies,
        code
      },
    }
    // 而这个依赖图对象 是要在打包阶段，作为立即执行函数的输入
    ```
- 生成阶段
  - 输出资源：
    - 依赖关系 -> 组装成一个个包含多个模块的chunk -> 每个chunk转换成一个单独的文件加入到输出列表（可以修改内容的最后机会）
  - 写入文件系统
### 常见配置
#### 单页
#### 多页

### 优化型配置
#### 打包结果优化
- uglyfyjs
- treeShaking
- splitChunk
#### 构建速度优化
- 缩小编译的范围：module中使用include 和 exclude
- 多进程打包：happyPack
- DDLPlugin
### 插件编写
上述代码块编写了一个叫 HelloWorldPlugin 的类，它提供了一个叫apply的方法，在该方法中我们可以从外部获取到 Webpack 执行全过程中单一的compiler实例，通过compiler实例，我们可以在 Webpack 的生命周期的done节点（也就是上面我们提到的hook）tap 一个监听事件，也就是说当 Webpack 全部流程执行完毕时，监听事件将会被触发，同时stat统计信息会被传入到监听事件中，在事件中，我们就可以通过stat做一系列我们想要做的数据分析。
Webpack 循环遍历了一遍 plugins，并分别调用了他们的 apply 方法
### 常见loader
```
loader执行顺序：右 -> 左
```
- 图片处理：
  - file-loader
  - url-loader
  - 二者功能相似，url-loader实际是在file-loader的基础上进行封装，并且对于设定 limit 大小的图片和字体文件，自动进行base64的转换
- es6处理：
  - babel-loader
  - ts-loader
- css处理：
  - style-loader
  - css-loader
  - less-loader
### 常见插件
[webpack常用插件](https://interview.html5.wiki/section/6-%E5%89%8D%E7%AB%AF%E8%87%AA%E5%8A%A8%E5%8C%96%E5%B7%A5%E7%A8%8B%E5%8C%96.html#_9-webpack-%E5%B8%B8%E7%94%A8%E6%8F%92%E4%BB%B6%E6%80%BB%E7%BB%93)
- html模板处理：
  - html-webpack-plugin
- 环境变量：
  - [webpack.DefinePlugin](https://juejin.cn/post/6844903458974203911)
    - 在打包的时候，被打包的代码会做这些替换，处理dev和prod环境的不同
    - 注意：key: JSON.stringify('123'); // 因为替换的时候 一层str 会直接作为codeStr插入，也就是作为代码了

# loader
## CDN与publicpath
- 在构建过程中，将引⽤的静态资源路径修改为CDN上对应的路径。可以利⽤webpack对于 output 参数和各loader的 publicPath 参数来修改资源路径
## url-loader file-loader
- 使用url-loader, 必须安装file-loader，url-loader会使用file-loader
  - 虽然代码没有配置 file-loader，但还是需要使用 npm i file-loader -D 安装

