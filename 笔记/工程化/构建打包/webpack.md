# 配置
- 参考 akfun：https://github.com/wibetter/akfun/tree/masters
    - src/webpack
## base.config
### module.rules
- .vue
    - 'vue-loader',
- tsx?
    - babel-loder
    - ts-loader
- jsx?
    - babel-loader
- /\.(png|jpe?g|gif|svg)(\?.*)?$/
    - url-loader
- /\.svg$/,
    - url-loader
- /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
    - url-loader
- /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
    - url-loader
- /\.(js|ts|tsx|jsx|vue|css|html)$/,
    - params-replace-loader
- /\.(html)$/,
    - html-loader
### plugins
- webpack.DefinePlugin
- MiniCssExtractPlugin
- CopyWebpackPlugin // 判断是否有public目录，如果有需要转移到dist目录下
- CompressionWebpackPlugin
## dev.config
## prod.config
### target
- ['web', 'es5']
### mode
- curEnvConfig.NODE_ENV
### output
### devtool
- sourceMap
### module.rules.sourceMap
### optimization.splitChunks
- vendor
- common
### splitChunk.chunks
- https://juejin.cn/post/6992887038093557796#heading-4
#### hush
- [hush、chunkhush、contentHush](https://juejin.cn/post/6971987696029794312)
- 在生产环境下，我们对 output 中打包的文件名一般采用 chunkhash，对于 css 等样式文件，采用 contenthash，这样可以使得各个模块最小范围的改变打包 hash 值。
#### target
- Webpack中的target属性指定了打包后的代码将运行的环境，以便Webpack能够将代码输出为符合该环境的代码。 它的作用是告诉Webpack打包后的代码要运行在哪个环境下，并且为该环境提供必要的功能和支持。
- 在Webpack中，target属性的默认值为"web"，即打包后的代码将在Web浏览器环境下运行。除此之外，Webpack还支持其他多种target，如"node"、"electron-main"、"electron-renderer"等，可以用来打包运行在不同环境下的代码。

当我们需要将代码打包成可以在Node.js环境中运行的代码时，可以将target属性设置为"node"。这样，Webpack将不会提供一些在Web浏览器中才有的全局变量，例如window和document对象，而是提供一些只有在Node.js环境中才有的全局变量，例如process和global对象。

除了target属性，Webpack还有一些其他的属性，例如output.libraryTarget属性，可以用来指定打包后的代码是以何种方式暴露出去的，以及module.target属性，可以用来指定特定的模块加载器的编译目标。这些属性的作用都是为了让Webpack能够更好地适应不同的运行环境，并生成符合该环境要求的代码。
## dev.config
## library.config
### output.libraryTarget + output.library
- https://www.cnblogs.com/h2zZhou/p/12986221.html
- 这2个属性要一起使用:
- output.libraryTarget的值：
    var // 默认值
    assign
    this
    window
    global
    commonjs
    commonjs2
    amd
    umd
    jsonp
## module.target
- 