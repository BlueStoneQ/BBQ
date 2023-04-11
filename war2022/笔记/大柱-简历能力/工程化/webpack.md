
## 参考
- [webpack教程](https://juejin.cn/post/7023242274876162084#heading-14)
- [webpack考点](https://juejin.cn/post/7023242274876162084)
- [webpack打包原理](https://segmentfault.com/a/1190000021494964)
  - [本地:min-webpack](min-project/mini-webpack)
- [loader-写的很好的blog-清晰准确](https://ufresh2013.github.io/2021/08/05/Webpack-loader/)
- [webpack-面试题](https://juejin.cn/post/6844904094281236487)
- [webpack高阶使用](https://segmentfault.com/a/1190000020320871)
- [gitbook-深入浅出webpack](https://webpack.wuhaolin.cn/)
  - [深入浅出webpack-优化](https://webpack.wuhaolin.cn/4%E4%BC%98%E5%8C%96/)

# 核心概念
## module，chunk 和 bundle 的区别是什么？
- [webpack易混淆概念](https://juejin.cn/post/6844904007362674701#heading-0)
- module，chunk 和 bundle 其实就是同一份逻辑代码在不同转换场景下的取了三个名字：
我们直接写出来的是 module，webpack 处理时是 chunr'r'r'rk，最后生成浏览器可以直接运行的 bundle。

## hash chunkhash contentHash
hash 计算与整个项目的构建相关；

chunkhash 计算与同一 chunk 内容相关；

contenthash 计算与文件内容本身相关。

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

## hush vs chunkhush vs contenthush
- [hush vs chunkhush vs contenthush](https://juejin.cn/post/6844903998944706574)
- hush: 整个项目
- chunkHush: 以entry Point为分割点，该文件属于的chunk变化 就会影响
- contentHash: 当前文件变化才会使用
- 场景与使用：
  - production
    - 只需要contenthash就可以了，修改哪个文件才改变哪个文件的hash。其它的hash不变可以继续从缓存里读取，以加快访问速度
  - development环境
    - 不需要hash直接展示名称，毕竟生成hash也需要消耗一定资源，cache还会影响开发体验。

# loader
## CDN与publicpath
- 在构建过程中，将引⽤的静态资源路径修改为CDN上对应的路径。可以利⽤webpack对于 output 参数和各loader的 publicPath 参数来修改资源路径
- 其实这里说的所有资源的基础路径是指项目中引用css，js，img等资源时候的一个基础路径，这个基础路径要配合具体资源中指定的路径使用，所以其实打包后资源的访问路径可以用如下公式表示：
  - 静态资源最终访问路径 = output.publicPath + 资源loader或插件等配置路径
  - 在dev模式下：publicpath: ''; prod模式下：publicPath: CDNPath
## url-loader file-loader
- 使用url-loader, 必须安装file-loader，url-loader会使用file-loader
  - 虽然代码没有配置 file-loader，但还是需要使用 npm i file-loader -D 安装
- file-loader在Webpack中的作用是，处理文件导入地址并替换成其访问地址，并把文件输出到相应位置。 其中导入地址包括了JavaScript和CSS等导入语句的地址，例如JS的import和CSS的url()
  - 引用路径的问题
    - 举例：拿 background 样式用 url 引入背景图来说，众所周知，webpack 最终会将各个模块打包成一个文件，因此我们样式中的 url 路径是相对入口 html 页面的，而不是相对于原始 css 文件所在的路径。这就会导致图片引入失败。
    - webpack 将会在打包输出中自动重写文件路径为正确的 URL。- file-loader 可以解析项目中的 url 引入（不仅限于 css），根据我们的配置，将图片拷贝到相应的路径，修改打包后文件引用路径，使之指向正确的文件。


## vue-style--loader vs style-loader
- vue-style-loader 跟 style-loader 基本用法跟功能是一样的，都是往 dom 里面插入一个 style 标签去让样式生效的，但是 vue-style-loader 支持 vue 中的 ssr（服务端渲染），所以如果需要支持服务端渲染的 vue 项目，就需要用到 vue-style-loader了，如果一般的 vue 项目的话，推荐使用 style-loader，毕竟 style-loader 支持的功能还是丰富些，比如可以懒注入、可以指定位置插入标签等等。

# 常见场景
## dev-server
### proxy
- proxy: 在dev-server启动时，所有请求都可以通过proxy中的配置进行代理转发，例如可以配置target,等于是给加上baseUrl:
```js
devserver: {
  proxy: {
    'xxxapi': {
      target: 'http:xxx.com',
      changeOrigin: true
    }
  }
}
```

### dev-server解决前端history路由的访问404问题
- history路由下，当刷新访问一个非index.html路径时，不配置的话，服务器找不到对应的静态文件，
  - 需要配置将所有的路径请求达到index.html spa单文件的访问上
- prod环境下：需要配置服务器环境，配置redirect,所有请求都重定向到index.html
- dev环境下：[dev-server解决前端history路由的访问404问题](https://blog.csdn.net/Riona_cheng/article/details/100660065)
```js
// webpack.dev.config.js
{
  devserver: {
    historyApiFallback: true, // 等同于下面的配置：就是所有的请求都重写成index.html
    // historyApiFallback: {
    //   rewrites: [{
    //     from: //,
    //     to: 'index.html'
    //   }]
    // }
  }
}
```
## 多入口 MPA
- 配置2个地方：entry + html-pugin：
```js
// webpack.config.js
module.exports = {
  entry: {
    index1: './index-1.js',
    index2: './index-2.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist')
  },
  plugins: [
    // 因为2个entry 这里一般也对应配置2个html
    new HtmlWebpackPlugin({
      template: './src/template/index1.html',
      filename: 'index1.html',
      chunks: ['index1'], // 这个html要引入的js的chunk名称（更准确是bundle名称）,这里引入index1.js
    }),
    new HtmlWebpackPlugin({
      template: './src/template/index2.html',
      filename: 'index2.html',
      chunks: ['index2'], // 这个html要引入的js的chunk名称（更准确是bundle名称）,这里引入index2.js
    })
  ]
}
```
## css处理
```js

// webpack.config.js
module.exports = {
  module: {
    rules: [{
      test: /\.(css|sass)$/,
      loader: [
        'style-loader', // 将css的内容以<style>的形式添加到html中
        'css-loader', // css文件处理为webpack可以处理的module，就是模块化处理 - 默认在css-loader中是不开启css modules功能的，要开启可以设置modules: true即可
        'postcss-loader', // 2. 对css中使用到的新属性进行兼容性处理 - 例如加上-webkit之类的前缀，另外，post-css需要单独配置下postcss.config.js, 其中使用到了autoprofixer
        'sass-loader', // 1. 将scss语法转为css语法
      ]
    }]
  }
}
// postcss.config.js
module.exports = {
  plugins: [
    require('auto-prefixer') // 支持postcss-loader去给样式添加兼容性前缀
  ]
}
```
## 静态文件处理
- 原理：一般都是loader在处理，file-loader和url-loader,一般会把静态资源拷贝到dist中，然后把这个资源的路径作为模块的导出，这样webpack就能以js.module的形式引用这个静态文件了
### 处理图片
- 开发环境配置
  - 直接使用file-loader即可
- 生产环境配置
  - 使用url-loader (但是必须安装file-loader，因为url-loader底层使用了file-loader)
  - 同时配置下limt属性： 8 * 1024 // 8kb以下的图片都转为base64, 减少http请求

### 兼容性：打包的IIFE函数 不使用箭头函数
- 目的：以适配更低阶的不支持箭头函数的浏览器
- 配置:
```js
output: {
  environment: {
    arrowFunction: false  // 告诉webpack 打包的IIFE函数(模块化函数) 不使用箭头函数
  }
}
```

## 请求dist
- clean-webpack-plugin
```js
new cleanWebpackPlugin()
```

# plugin
## 常用的plugin
1. 功能补全型的：
  - html-Plugin
  - [define-plugin](https://webpack.docschina.org/plugins/define-plugin/)
    - 一般主要用来给运行时代码传递构建时的信息，最常用的是告诉运行时代码NODE_ENV是prod还是test环境
    ```js
    // webpack.config.js 运行在node下 构建时
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    });
    // 运行在browser中 运行时 
    console.log(process.env.NODE_ENV); // 'production'
    ```
    - 关于这里为什么要用JSON.stringify()包裹，是因为define-plugin是直接进行的字符串替换（处理的是code-str），所以，是这样的：
    ```js
      // webpack.config.js 运行在node下 构建时
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': process.env.NODE_ENV, // 
      });
      // 运行在browser中 运行时 
      console.log(process.env.NODE_ENV); // production 注意，这里不是一个字符串，而是一个标识符（变量），识别不了这个变量production，这里实际输出是undefined
    ```
  - [MiniCssExtractPlugin](https://webpack.docschina.org/plugins/mini-css-extract-plugin/)
    - 需要webpack5
      - webpack4中可以使用text-extract-pugin
    - 将css抽取出来作为单独文件
    - 一般只用在prod环境下
    - 在test、dev环境下 一般使用style-loader
  - clean-webpack-plugin
2. 性能优化方面的
  - [CssMinimizerWebpackPlugin](https://webpack.docschina.org/plugins/css-minimizer-webpack-plugin/)
    - 可以代替optimize-css-assets-webpack-plugin
  - uglifyjs-webpack-plugin
  - happyPack
    - 多线程打包
    - 建议：thread-loader可以代替
    - 补充： 由于对mini-css-extract-plugin,url-loader,file-loader的支持度的问题，所以，不建议使用HappyPack。
    - 原理:
  - cache-loader
  - purifycss-webpack
# 高频考点
## source-map
- 线上问题的定位到代码行的方案：
  - 在生产环境，除了这些选择外，我们还可以使用服务器白名单策略。我们仍然打包出完整的source map文件上传，但只有白名单的用户才可以看到source map文件。
- 类型选择：一般是打包速度 vs 打包质量（包含的信息多寡：定位到行+列）的平衡：
  - dev环境：eval-cheap-module-source-map
  - prod环境：成熟做法是生成一份mao上传 + 白名单的人员可以拉取到map在error中定位到行+列
## HMR
- [政采云-HMR](https://www.zoo.team/article/webpack)
- dev-server是如何实现无刷新更新的呢？
  - me: 就是通过hash确认文件发生改变后，请求到新的文件（文件名有新的hash）,将这个新文件替换到<script>.src上
  1. 通过 Json 请求结果获取热更新文件，以及下次热更新的 Hash 标识，并进入热更新准备阶段
  2. HotCheck 确认需要热更新之后进入 hotAddUpdateChunk 方法，该方法先检查 Hash 标识的模块是否已更新，如果没更新，则通过在 DOM 中添加 Script 标签的方式，动态请求js： /fileChunk.hash.hot-update.js，获取最新打包的 js 内容；
  3. 
## public-path
## source-map
## define-plugin

# webpack优化
- [webpack配置-优化篇](https://xieyufei.com/2020/07/30/Webpack-Optimize.html)
- [深入浅出webpack-优化](https://webpack.wuhaolin.cn/4%E4%BC%98%E5%8C%96/)
- [webpack4打包优化](https://juejin.cn/post/6911519627772329991)
## 总纲
1. 优化输出质量
  1. 压缩：uglyfile
  2. scope-hosting（内置）
  3. tree-shaking（内置）
  4. post-css:auto-prefixer
  5. splitChunks
  6. 按需加载（懒加载）
  8. 图片压缩
    - url-loader
2. 优化开发体验
  1. 缩小文件搜索范围
  2. happyPack/thread-loader
    - 对指定的loader分配多线程
  3. cache-loader/bable-loder的cacheDirectory
  4. dll-plugin
  5. dev-server & HMR
## 衡量
### 速度分析
- speed-measure-webpack-plugin
  - 分析整个打包总耗时
  - 每个插件和loader的耗时情况
### 体积分析
- webpack-bundle-analyzer
## 打包结果优化
### splitChunks
  - [bili:webpack-split-chunk](https://www.bilibili.com/video/BV1By4y177gX?p=7&vd_source=9365026f6347e9c46f07d250d20b5787)
  - 利好：首屏 或者 页面启动性能：
  ```js
  // webpack.prod.config.js
  module.exports = {
    optimization: {
      splitChunks: {
        // “all”, "initial" - 同步加载的包 import lodash from 'lodash';, "async" - 异步加载的包 import('lodash');
        chunks: 'all',
        cacheGroups: {
          /**
           * 1. 这里的vender common不影响什么，自定义即可，一般和name属性保持一致
           * 2. vender 一般约定 打包第三方库（一般是node_modules下的）, common一般约定打共工代码
           */
          vender: {
            // 设置打包规则，一个module需要同事满足这里的所有条件，才会被splitChunk
            name: 'vender', // 这里的name值决定了打包后bundle.js的名称
            priority: 2, // 优先级，当一个module同时满足2个以上的splitChunk规则时，优先级值越高的规则优先使用
            test: /node_modules/, // 限定该规则生效的目录范围
            minSize: 5 * 1024, // 至少5kb的包才会被splitChunk, 太小的话，需要多一次http请求，不划算
            minChunks: 2, // 这个module被引用了几次，第三方代码被引用一次就可以splitchunks
          },
          common: {}
        }
      }
    }
  }
  ```
### 按需加载 - 其实是spitchunk的一种：
- [深入浅出webpack-按需加载](https://webpack.wuhaolin.cn/4%E4%BC%98%E5%8C%96/4-12%E6%8C%89%E9%9C%80%E5%8A%A0%E8%BD%BD.html)
- babel支持import() ？？
  - 如果您使用的是 Babel，你将需要添加 babel-plugin-syntax-dynamic-import (opens new window)插件，才能使 Babel 可以正确地解析语法。
  - .babelrc
  ```json
  {
    "presets": [
      "env",
      "react"
    ],
    "plugins": [
      "syntax-dynamic-import"
    ]
  }
  ```
- eg：
```js
// 这里有个魔法注释 可是在打包时指定该chunk的名称,方便我们追踪和调试代码，不指定的话，默认名称将会是 [id].js
import(/* webpackChunkName: "show" */ './show').then((show) => {
  show('Webpack');
})
// webpack.config.js
module.exports = {
  // JS 执行入口文件
  entry: {
    main: './main.js',
  },
  output: {
    // 为从 entry 中配置生成的 Chunk 配置输出文件的名称
    filename: '[name].js',
    // 为动态加载的 Chunk 配置输出文件的名称, 如果没有这行，分割出的代码的文件名称将会是 [id].js
    chunkFilename: '[name].js',
  }
};
```
#### vue-懒加载
- [vue-路由懒加载](https://v3.router.vuejs.org/zh/guide/advanced/lazy-loading.html)
- 一般来说，对所有的路由都使用动态导入是个好主意。
```js
const UserDetails = () => import(/* webpackChunkName: "group-user" */ './UserDetails.vue');
const router = createRouter({
  routes: [{ path: '/users/:id', component: UserDetails }],
})
```
### 抽离css
- 默认情况下，style-loader会将css文件全部使用<style>标签注入到html中
- prod下，我们更希望把css抽离到单独的文件中：
  - mini-css-extract-plugin:
    - 这个插件暂时不支持HMR,所以我们只能配置在prod中
  ```js
  // webpack.prod.config.js
  // 抽离css到单独的文件中
  const MiniCssExtractPlugin = require('mini-css-extract-plugin');
  // 压缩css代码
  const OptimizeCssAssetsWebpackPlugin = require('optimize-css-assets-webpack-plugin');

  module.exports = {
    mode: 'production',
    module: {
      rules: [{
        test: /\.css$/,
        loader: [
          MiniCssExtractPlugin.loader, // 在dev环境下可以使用style将css通过<style>标签插入到html中，在prod环境中使用MiniCssExtractPlugin提供的loader将css文件通过<link>插入到html中
          'css-loader',
          'postcss-loader'
        ]
      }]
    },
    optimization: {
      minimizer: [
        // 压缩css
        new OptimizeCssAssetsWebpackPlugin()
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'css/main.[contentHash:8].css' // 输出的单独的css文件名称
      })
    ]
  }
  ```
### 缩小文件搜索范围
- loader配置
- resolve.modules // 配置去哪里寻找第三方模块
  - 当安装的第三方模块都放在项目根目录下的 ./node_modules 目录下时，没有必要按照默认的方式去一层层的寻找，可以指明存放第三方模块的绝对路径，以减少寻找
```js
resolve: {
    // 使用绝对路径指明第三方模块存放的位置，以减少搜索步骤
    // 其中 __dirname 表示当前工作目录，也就是项目根目录
    modules: [path.resolve(__dirname, 'node_modules')]
  },
```
## 构建过程优化(开发体验优化)
### DLL优化
- [你真的需要dll吗](https://blog.csdn.net/xiaoyaGrace/article/details/106328441)
  - 结论：webpack4以上,dll已经性价比不高了，开发成本+维护成本可能会比较高
### cache-loader
- 一般配在loder的栈底（最左边）
- 缓存在磁盘
- 注意：保存和读取缓存也会产生额外的性能开销，因此cache-loader适合用于对性能消耗较大的loader，否则反而会增加性能消耗
### hapy-pack
- [深入浅出:happy-pack](https://webpack.wuhaolin.cn/4%E4%BC%98%E5%8C%96/4-3%E4%BD%BF%E7%94%A8HappyPack.html)
  - [使用thread-loader代替happy-pack](https://juejin.cn/post/7052240512593428494#heading-5)
    - 由于HappyPack作者对js的兴趣逐步丢失，所以之后维护将变少，webpack4及之后推荐使用thread-loader

