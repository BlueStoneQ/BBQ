<a name="WjDkE"></a>
# 前言
> 1. 既是读书笔记，也是对于webpack和工程化的一次梳理
> 1. 书的内容 优点是：系统性强，引导思维性强，缺点是知识点也许不是最新的，所以书能教给你知识的一个基本核心或者渔，剩下的新内容需要你以这个核心去构建、吸收并为自己所用
> 1. 请配套github示例代码，这应该是写文档和学习的一个要求标准

<a name="QagEf"></a>
# 背景
前端近些年的技术发展特点：

- 模块化
   - CommonJS
   - AMD
   - ES6模块
   - 样式文件的模块化
- 新框架
   - React
   - Vue
   - Agular
- 新语言
   - TS
   - ES6(部分新特性)
   - SCSS
   - Flow

以上的这些新的前端技术无法直接在浏览器运行，这时候需要一个工程化的打包工具，将开发阶段的代码转成可以直接在浏览器中直接运行的代码。<br />伴随着前端技术的发展，构建工具呈现的特点是：

- 流程化
- 自动化
- 可扩展化
<a name="Y7E0G"></a>
## 构建工具的基本职能
![](https://cdn.nlark.com/yuque/0/2021/jpeg/2338408/1620392182447-0e675305-cfdb-4f96-a662-c27611542cf7.jpeg)
<a name="d7s6E"></a>
# 横向对比
|  | Npm Script | Grunt | Gulp | webpack | Rollup |
| --- | --- | --- | --- | --- | --- |
| 优点 | <br />- npm内置<br /> | <br />- 灵活，可以自定义任务<br />- 有大量可复用的插件<br /> | <br />- 引入了流的概念<br />- 有大量插件<br />- 灵活，可以和其他工具搭配使用<br /> | <br />- 一切文件皆模块<br />- 专注于构建模块化项目<br />- 开箱即用<br />- 可扩展<br />- 使用场景不局限于web开发<br />- 社区庞大且活跃，紧跟新特性<br />- 良好的开发体验<br />- 有良好的维护团队<br />- 基本是一站式的解决方案<br />- 业界可以参考的教程比较多<br /> | <br />- 在打包库比webpack更有优势，打包出来的文件更小，更快<br /> |
| 缺点 | <br />- 功能过于简单<br /> | <br />- 集成度不高，配置工作量大，无法做到开箱即用<br /> | <br />- 集成度不高，配置工作量大，无法做到开箱即用<br /> | <br />- 只能用于模块化开发的项目<br /> | <br />- 生态链还不完善，体验不如webpack<br />- 功能不完善，在很多场景下都找不到现成的解决方案<br />- 很多特性都已经被webpack模仿实现<br /> |
| 底层原理 | 调用shell运行脚本命令 | 进化版的Npm Script | 可以认作：Grunt + 监听文件 + 读写文件 + 流式处理 |  | <br />- 更适合于js库<br /> |

<a name="1CQH8"></a>
# 使用
<a name="sUcBY"></a>
## 核心概念
![](https://cdn.nlark.com/yuque/0/2021/jpeg/2338408/1620392182483-59c8f161-a2d6-4f2b-b4e5-d8e3eebc1b88.jpeg)

- chunk
   - 一般一个entry对应一个chunk, 一个chunk里包括了这个entry以及该entry的所有依赖
   - 一个chunk是由多个模块组合而成，用于代码的合并和分割
- module
   - webpack中一切皆模块
   - 一个模块对应一个文件
- loader
   - 执行的次序： right -> left
<a name="VJNjb"></a>
## 经典使用-场景
<a name="aFAzN"></a>
### 构建多页应用
<a name="uE3SW"></a>
### 构建同构应用
<a name="sOAvQ"></a>
### publicPath

- [CDN与publicPath](https://webpack.wuhaolin.cn/4%E4%BC%98%E5%8C%96/4-9CDN%E5%8A%A0%E9%80%9F.html)
- 最核心的部分是通过 `publicPath` 参数设置存放静态资源的 CDN 目录 URL， 为了让不同类型的资源输出到不同的 CDN，需要分别在：
- `output.publicPath` 中设置 JavaScript 的地址。
- `css-loader.publicPath` 中设置被 CSS 导入的资源的的地址。
- `WebPlugin.stylePublicPath` 中设置 CSS 文件的地址。

设置好 `publicPath` 后，`WebPlugin` 在生成 HTML 文件和 `css-loader` 转换 CSS 代码时，会考虑到配置中的 `publicPath`，用对应的线上地址替换原来的相对地址
<a name="kAmqw"></a>
# 解决方案-原理

1. 关于js：获取js内容 + 执行文件
1. webpack构建后的输出：一个匿名自执行函数
1. 一个模块被__webpack_require__(**某个模块的相对路径**)的时候，**webpack会根据这个相对路径从modules对象中获取对应的源码并执行**，对象的属性值为**一个函数**，函数内容为**当前模块的eval(**`**源码**`**)**。
   1. 也就是说：打包的出的每一个模块都是一个匿名的自执行函数，当A模块require模块B的时候，相当于将B模块的打包后的自执行函数嵌套到了当前的A模块的自执行函数中
   1. **modules对象保存的就是入口文件及其依赖模块的路径和源码对应关系**，webpack打包输出文件**bundle.js**执行的时候就会执行匿名自执行函数中的__webpack_require__(**entryId**)，**从modules对象中找到入口文件对应的源码执行**，执行入口文件的时候，发现其依赖，又继续执行__webpack_require__(**dependId**)，**再从modules对象中获取dependId的源码执行**，直到全部依赖都执行完成。
4. 插件设计原理：编译器构造函数中还有一个非常重要的事情要处理，那就是**安装插件**，即**遍历配置文件中配置的plugins插件数组**，然后**调用插件对象的apply()方法**，apply()方法**会被传入compiler编译器对象**，可以通过传入的compiler编译器对象进行**监听编译器发射出来的事件**，插件就可以选择在特定的时机完成一些事情。
   1. 所谓插件安装：本质上就是调用插件数组的apply方法，在该方法中通过入参传入compiler编译器对象。在该方法中，插件可以通过compiler对象来注册一些事件的handler，当这些事件被调用的时候，handler被执行。
   1. <br />
<a name="5udbV"></a>
## 核心流程
<a name="0r3ud"></a>
## 模块化方案
<a name="3K7KP"></a>
### commonJS和ES6 module的差异
它们有两个重大差异：<br />**① CommonJS 模块输出的是一个值的拷贝，ES6 模块输出的是值的引用**。<br />**② CommonJS 模块是运行时加载，ES6 模块是编译时输出接口**。<br />第二个差异是因为 CommonJS 加载的是一个对象（即module.exports属性），该对象只有在脚本运行完才会生成。而 ES6 模块不是对象，它的对外接口只是一种静态定义，在代码静态解析阶段就会生成。
<a name="BVKuc"></a>
### 参考：node模块化方案

- [前端运行时的模块化设计和实现](https://alienzhou.github.io/blog/15353386669734.html)
```javascript
var test = require('./test.js');
// node: 其实就是把test.js模块的exports属性赋值给test变量。
```

- node打包的实质
<a name="34IsU"></a>
### 模块化方案实现
webpack打包出来的代码可以简单分为两类：

- 一类是webpack模块化的前端runtime，你可以简单类比为RequireJS这样的前端模块化类库所实现的功能。它会控制模块的加载、缓存，提供诸如`__webpack_require__`这样的require方法等。（runtime代码）
- 另一类则是模块注册与运行的代码，包含了源码中的模块代码。为了进一步理解，我们先来看一下这部分的代码是怎样的。（我们的业务代码）
<a name="74754adc"></a>
#### 编译

- 为了简化步骤，我希望在constructor中直接开始对文件进行编译。这里需要声明一个 `moduleWalker` 方法(这个名字是笔者取的，不是webpack官方取的)，顾名思义，这个方法将会从入口模块开始进行编译，并且顺藤摸瓜将构建过程中所有的模块递归进行编译。

编译步骤主要分为两步

1. 第一步是使用所有满足条件的loader对其进行编译并且返回编译之后的代码
1. 第二步相当于是webpack自己的编译步骤，其中最核心的目的是构建各个独立模块之间的调用关系。我们需要做的是将所有的 `require` 方法替换成webpack自己定义的 `__webpack_require__` 函数。因为所有被编译后的模块将被webpack存储在一个闭包的对象 `moduleMap` 中，当模块被引用时，都将从这个全局的 `moduleMap` 中获取代码。

在完成第二步编译的同时，会对当前模块内的引用进行收集，并且作为 `moduleWalker` 方法的回调返回到 `Compilation` 中， `moduleWalker` 方法会对这些依赖模块进行递归的编译。当然里面可能存在重复引用，我们会根据引用文件的路径生成一个独一无二的key值，在key值重复时进行跳过
<a name="dE3vK"></a>
### chunk

1. chunk 有两种形式：
- `initial(初始化)` 是入口起点的 main chunk。此 chunk 包含为入口起点指定的所有模块及其依赖项。
- `non-initial` 是可以延迟加载的块。可能会出现在使用 [动态导入(dynamic imports)](https://webpack.docschina.org/guides/code-splitting/#dynamic-imports) 或者 [SplitChunksPlugin](https://webpack.docschina.org/plugins/split-chunks-plugin/) 时。
2. <br />
<a name="wgFfR"></a>
## 插件机制

1. applay(compiler): 仔细体会这种注册机制实现的插件机制：
   1. 插件需要编写一个系统（webpack）所要求的注册方法(apply)，该方法的参数一般是系统在运作时传入的一个全局对象（compiler或者其他信息）
   1. 系统使用一个数据结构存储插件（一般使用队列）
   1. 在系统运作时，首先将插件的队列进行注册（遍历队列，调用插件定义的注册方法apply）
   1. 插件的注册一般作为系统启动时init的一部分
2. webpack的每一个生命周期钩子除了挂载我们自己的plugin,还挂载了一些官方默认需要挂载的 `plugin  `
<a name="edPFh"></a>
## 配置信息注册

1. 配置信息一般对用户而言是配置文件（eg: webpack.config.js）
1. 注册配置信息：一般就是把配置文件中的信息，经过自身默认值等一些列merge后，挂载到this(也就是compiler)上
<a name="LuFzm"></a>
# 优化方案
<a name="8X3dj"></a>
## 构建过程优化
<a name="3mUXG"></a>
## 构建结果优化

<a name="e0nUF"></a>
# 手写like
<a name="Yjnm2"></a>
# ME

1. 上下文 - 是一些大型软件设计的一个元素/概念，例如：Vue中的Vue，webpack中的compiler对象。它一般是一个对象，挂载了很多需要共享的信息（属性和方法等，以及一些全局的状态信息等）；
<a name="SHrJU"></a>
# 参考

- 《深入浅出webpack》
- [前端运行时的模块化设计和实现](https://alienzhou.github.io/blog/15353386669734.html) - 写的很好
- [webpack原理解析](https://segmentfault.com/a/1190000020353337)
- [webpack模块加载原理](https://zhuanlan.zhihu.com/p/243485307)

