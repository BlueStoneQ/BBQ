<!-- vscode-markdown-toc -->
* 1. [原理](#)
	* 1.1. [工作流程](#-1)
	* 1.2. [核心模块](#-1)
* 2. [主要场景](#-1)
	* 2.1. [支持ES6](#ES6)
	* 2.2. [支持ES7](#ES7)
	* 2.3. [polyfill](#polyfill)
	* 2.4. [支持JSX](#JSX)
	* 2.5. [[❌]支持TS](#TS)
	* 2.6. [babel插件开发](#babel)
		* 2.6.1. [几个辅助库：](#-1)
		* 2.6.2. [编写的最小格式-本质上是一个函数：](#-)
		* 2.6.3. [如何注册进babel中：](#babel-1)
* 3. [原理](#-1)
* 4. [eslint配置](#eslint)
* 5. [自定义eslint规则](#eslint-1)
* 6. [自定义规则引入-自定义插件](#--1)
* 7. [原理](#-1)
* 8. [merge & rebase](#mergerebase)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->
# babel
##  1. <a name=''></a>原理
###  1.1. <a name='-1'></a>工作流程
- codeStr -parser-> AST -transform-> new-AST -generater-> new codeStr
###  1.2. <a name='-1'></a>核心模块
@babel/core，@babel/parser，@babel/traverse 和 @babel/generator
##  2. <a name='-1'></a>主要场景
###  2.1. <a name='ES6'></a>支持ES6
- 使用 Babel 必须先安装 @babel/core 和 @babel/preset-env 两个模块，
  1. @babel/core 是 Babel 的核心存在，Babel 的核心 api 都在这个模块里面，比如：transform。
  2.  @babel/preset-env 是一个智能预设，允许您使用最新的 JavaScript，而无需微观管理您的目标环境需要哪些语法转换（以及可选的浏览器polyfill）
  ```json
  /** .babelrc */
  {
    "presets": [
      "@babel/preset-env"
    ]
  }
  ```
    - @babel/preset-env的参数：
      - modules:
        这个参数项的取值可以是"amd"、"umd" 、 "systemjs" 、 "commonjs" 、"cjs" 、"auto" 、false。在不设置的时候，取默认值"auto"。
        该项用来设置是否把ES6的模块化语法改成其它模块化语法。
        我们常见的模块化语法有两种：（1）ES6的模块法语法用的是import与export；（2）commonjs模块化语法是require与module.exports。
        在该参数项值是'auto'或不设置的时候，会发现我们转码前的代码里import都被转码成require了。
        如果我们将参数项改成false，那么就不会对ES6模块化进行更改，还是使用import引入模块。
        使用ES6模块化语法有什么好处呢。在使用Webpack一类的打包工具，可以进行静态分析，从而可以做tree shaking 等优化措施。
  3. babel-loader: 这里使用的打包工具是 Webpack，所以还需要安装 babel-loader 插件。
###  2.2. <a name='ES7'></a>支持ES7
###  2.3. <a name='polyfill'></a>polyfill
###  2.4. <a name='JSX'></a>支持JSX
```js
// webpack.config.js
 test: /\.jsx?$/,
  use: {
      loader: 'babel-loader',
      options: {
          presets: ['@babel/preset-env']
      }
  },
// .babelrc
{ "presets":[
  "@babel/react",
  "@babel/env"]
}
```
###  2.5. <a name='TS'></a>[❌]支持TS
- npm i typescript + tsc xxx.ts 就可以输出编译后的js文件
###  2.6. <a name='babel'></a>babel插件开发
- 访问者模式
- [babel插件开发](https://segmentfault.com/a/1190000021246622)
####  2.6.1. <a name='-1'></a>几个辅助库：
- babylon
  - 解析步骤接收代码并输出 AST
- babel-traverse
  - ast的遍历器
- babel-generator
  - ast生成代码
- babel-types
  - 构造、验证AST节点的方法
- bable-template
  - 以模版化的方式生成ast节点
####  2.6.2. <a name='-'></a>编写的最小格式-本质上是一个函数：
```js
module.exports = function ({ types: t }) {
  return {
    visitor: {
      Identifier (path, state) {
        // 这里的path 其实就是dfs中的一条路径，这就是ast中的一个节点
        path.remove(); // 删除了节点
      }
    }
  };
}
```
####  2.6.3. <a name='babel-1'></a>如何注册进babel中：
1. 代码中：
```js
// 导入自己写的插件
const myPlugin = require('xxxx')
const babel = require('@babel/core');
const content = 'let a = 5';
// 通过你编写的插件输出的代码
const { code } = babel.transform(content, {
    plugins: [
        myPlugin
    ]
});
```
2. 可以编写好后发为npm包，然后配置到.babelrc.plugins中

--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- 

# eslint
##  3. <a name='-1'></a>原理
通过静态的分析，寻找有问题的模式或者代码。默认使用 Espree 解析器将代码解析为 AST 抽象语法树，然后再对代码进行检查。
##  4. <a name='eslint'></a>eslint配置
```json
{
    "rules": {
        "semi": ["error", "always"],
        "quotes": ["error", "double"]
    }
}
/**
"off" or 0 - 关闭规则
"warn" or 1 - 将规则视为一个警告（不会影响退出码）
"error" or 2 - 将规则视为一个错误 (退出码为1)
 */
```
##  5. <a name='eslint-1'></a>自定义eslint规则
- [政采云-eslint自定义规则编写](https://www.zoo.team/article/eslint-rules)
```js
module.exports = {
  meta: {
    docs: {
      description: "最多参数允许参数",
    },
  },
  create(context) {
    return {
      FunctionDeclaration: (node) => {
        if (node.params.length > 3) {
          context.report({
            node,
            message: "参数最多不能超过3个",
          });
        }
      },
    };
  },
};
```
##  6. <a name='--1'></a>自定义规则引入-自定义插件
- 使用自定义的 ESLint 规则，你需要自定义一个 ESLint 的插件，然后将规则写到自定义的 ESLint 插件中，然后在业务代码中添加 ESLint 配置，引入 ESLint 插件。
```json
// .eslintrc
{
    "plugins": [
        "zoo" // 你的 ESLint plugin 的名字
    ],
    {
    "rules": {
        "zoo/rule-name": 2 // rules 中再将 plugin 中的规则导入
    }
}
}
// 
```

--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- 

# style-lint
- [style-lint](https://segmentfault.com/a/1190000023049289)

--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- 

# lint卡控
- githooks:husky + lint-staged
- 为什么使用husky?
  - Git Hooks 就是在 Git 执行特定事件（如commit、push、receive等）时触发运行的脚本，类似于“钩子函数”，没有设置可执行的钩子将被忽略。
    在项目的 .git/hooks 目录中，有一些 .sample 结尾的钩子示例脚本, 去掉xxxx.sample文件的.sample后缀，它就是一个可执行的shell文件。你可以在里面写上eslint 的校验命令，在commit之前校验代码的格式和质量。（删除某一个 hook 的后缀 .sample 即可启用该 hook 脚本，默认是不启用的。）【但是，我们一般不去改动 .git/hooks 里面的文件，因为我们使用 husky 】
- 为什么使用lint-staged？
  lint-staged 是一个在 git 暂存文件上（也就是被 git add 的文件）运行已配置的 linter（或其他）任务。lint-staged 总是将所有暂存文件的列表传递给任务。
- 配置示例：
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged", // 在commit之前先执行npm run test命令
    }
  },
  "lint-staged": {
    // 在 git 的待提交的文件中，在 src 目录下的所有 .js .vue 都要执行三条命令(这里lint-staged就是把符合条件的在暂存区的文件作为输入传给了下面3条命令)
    "src/**/*.{js,vue}": [
      "prettier --write",
      "eslint --cache --fix",
      "git add"
    ]
  }
}
```
- 关于prittier:
  - rettier 是一个很好的格式化代码的插件，但对已经有一定迭代完成度的代码不推荐使用。使用该插件后，它会将原有的代码也进行格式化，造成很多不可知的问题，我就是前车之鉴，使用 prettier 后，原本已经没有 eslint 问题的代码，又多出了更多的不知道什么原因的报错，只能将代码回退处理。所以，这也就是我们为什么在 lint-staged 中，执行 prettier 的原因。

--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- 

# git
##  7. <a name='-1'></a>原理
- [git原理-图文](https://www.jiqizhixin.com/articles/2019-12-20)
- [bilibili-git原理](https://www.bilibili.com/video/BV1RJ411X7kh?spm_id_from=333.337.search-card.all.click&vd_source=9365026f6347e9c46f07d250d20b5787)
##  8. <a name='mergerebase'></a>merge & rebase
- [bilibili-merge&rebase-很清晰了](https://www.bilibili.com/video/BV1cv411u7wd/?vd_source=9365026f6347e9c46f07d250d20b5787)
