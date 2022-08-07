const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  context: path.resolve(__dirname, '../'),
  entry: {
    app: './src/main.js'    
  },
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.vue', '.json'],
    // alias: {
    //   'vue$': 'vue/dist/vue.esm.js', // https://segmentfault.com/a/1190000016417861，也可以在给定对象的键后的末尾添加 $，以表示精准匹配
    // }
  },
  module: {
    rules: [{
      test: /\.vue$/,
      loader: 'vue-loader'
    }, {
      test: /\.js$/,
      loader: 'babel-loader'
    }, {
      test: /\.css$/,
      loader: [
        'vue-style-loader', // 在style的基础上，为vue的SSR做了些工作，在vue项目中 可直接代替style-loader使用 https://blog.csdn.net/vv_bug/article/details/109260358
        'css-loader'
      ]
    }, {
      test: /\.(woff|ttf)$/,
      loader: 'url-loader',
      options: {
        limit: 8192
      }
    }]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'public/index.html',
      inject: 'body'
    }), // html-webpack-plugin 默认将会在 output.path 的目录下创建一个 index.html 文件， 并在这个文件中插入一个 script 标签，标签的 src 为 output.filename。
  ]
}