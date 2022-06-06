const path = require('path');

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
      loader: 'css-loader'
    }]
  },
}