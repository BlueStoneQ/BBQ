const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const baseWebpackConfig = require('./webpack.base.config');

module.exports = webpackMerge(baseWebpackConfig, {
  devServer: {
    hot: true,
    quiet: true, // 不输出打包过程
    open: true, // 自动打开浏览器
    compress: true, // 开启gzip压缩
  },
  plugins: [
    new webpack.DefinePlugin({
      // https://cn.vuejs.org/v2/guide/deployment.html
      // 当使用 webpack 或 Browserify 类似的构建工具时，Vue 源码会根据 process.env.NODE_ENV 决定是否启用生产环境模式，默认情况为开发环境模式
      'process.env.NODE_ENV': JSON.stringify('test')
    })
  ]
});