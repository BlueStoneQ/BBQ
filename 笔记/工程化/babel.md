# 资料
- 小册：https://juejin.cn/book/6946117847848321055?scrollMenuIndex=1

# 概览
# 原理概览
# plugin定义范式
```js

```
# plugin使用范式
```js
const { transformFromAstAsync } = require('@babel/core');
const parser = require('@babel/parser');

const sourceCode = fs.readFileSync(path.join(__dirname, 'sourceCode.js'), {
    encoding: 'utf-8'
});

const ast = parser.parse(sourceCode, {
    sourceType: 'unambiguous' // https://babeljs.io/docs/options#sourcetype
});

const { code } = transformFromAstAsync(ast, sourceCode, {
    plugins: [[
        plugin1, { // 注册插件1
            option1: xxx
        }
    ], [
        plugin2, { // 注册插件2
            option2: xxx
        }
    ]]
});
```
# 核心包:结构
## @babel-core
## @babel-parser
## helper
# 核心概念
## path
### 增删改
## scope
## binding
## template
## node
## this
# babel-plugin能够做到一些什么 使用场景 和 想象力
- 类webpack等打包工具中构建依赖图谱