# 原理
- [taro进阶](https://docs.taro.zone/docs/dynamic-import)
- [taro原理](https://segmentfault.com/a/1190000041340251)
- 我们通过 @tarojs/plugin-http 插件，在小程序环境下 runtime 注入模拟实现的 XMLHttpRequest , 从而支持在小程序环境中使用 web 生态下的各种网络请求库。至此，你可以在 h5、小程序、react native 中畅快使用 axios 库作为请求库。理论上， 任何底层基于 XMLHttpRequest 开发的 web 库你都可以自由使用。
- 在 H5 开发时，我们能够使用动态 import 语法实现异步加载等功能。但在小程序环境是不支持动态 import 的，因此 Taro 默认会把动态 import 语法转换为普通 require 语法。感谢 @JiyuShao 同学贡献的插件 taro-dynamic-import-weapp，让我们能够在微信小程序环境中使用上动态 import。
- Taro3自己实现了一套类似浏览器的BOM/DOM那一套API，通过webpack的plugin注入到小程序的逻辑层，打包编译后，你最终的代码都是基于BOM/DOM这几个API来实现你的具体功能，比如：不管什么平台，都有自己一套元素dom的规则，都有各自平台的类似bom的全局api规则，Taro3做的就是整合这些厂家的规则封装为类似BOM/DOM的思想去用，也就是说，我不管你开发时用的什么框架，我只要保证你运行时能帮你适配到各个平台即可。
- Taro的核心原理是在编译构建时通过注入自定义配置，将原本的小程序组件和API替换为适应不同平台的组件和API，从而实现多端能力
- taro3:
    - 模版设计：
        - 设计模版
        - publish模版
        - 下载模版: download-git-repo
        - copy模版到目标目录
        - 动态替换模版中信息: handleBars
            - 根据不同的init选项 来初始化模版 注入不同的运行时依赖和构建命令 
                - 例如：DSL选择JSX, 则注入react的相关依赖：react等
    - 构建：sourceCode(DSL:JSX) - webpack -> 
        - 通过webpack-plugin做了什么：
            - 注入运行时
                - 根据不同的构建目标（不同的小程序平台）注入不同的运行时
                - target-platform的运行时： 
                    - @taro/api
                    - @taro/component
            - 替换运行时
                - 根据不同的构建目标（不同的小程序平台）替换不同的运行时
                - 不同平台的@taro/react-dom
    - 运行时：
        - React：适配器（调用Taro提供的DOM/BOM API）-> render:mp(min-programer)
        - react 16+架构：
            - react-core
            - react-reconciler: 维护v-dom-tree, 实现了Diff/Fiber算法，决定更新时间和更新内容。
            - Render: 负责具体平台的渲染工作，提供宿主组件。处理事件等
        - react-dom: 这一部分是react 和 web平台链接的地方，现在我们要渲染到MP容器，所以，这一部分Taro进行了重写，提供了面向MP平台的taro-react
        - taro-react : 代替react-dom（相当于小程序版的react-dom）, 连接react-reconciler 和 taro-runtime的DOM/BOM API，也就是连接@tarojs/runtime的DOM实例
        - react-dom实现原理：最终React代码会运行成Taro DOM Tree， 如何更新到页面？
            1. 小程序没有动态创建节点的能力，使用相对静态的wxml来渲染Taro DOM Tree, 使用模版拼接方式，根据运行时提供的v-dom-tree, 各个template递归地互相引用，最终渲染出界面。
                1. 将小程序的所有组件进行模版化处理，从而得到小程序组件对应的模版。需要在 template 里面写上 组件 如 view，把它所有的属性全部列出来（因为小程序里面不能动态的添加属性）。
                2. 接下来遍历渲染所有子节点，基于组件的 template，动态递归渲染整棵树
                3. 具体流程为 先遍历 Taro DOM Tree 根节点的子元素，再根据每个子元素的类型选择对应的模版来渲染子元素，然后在每个模版中又会去遍历当前元素的子元素，以此把整个节点数递归遍历出来。
## TaroH5
- sourceCode:react: - webpack -> 
- 运行时：
    - 实现一个组件库，同时给到多个框架去使用。Taro 使用了 Stencil 实现了一个 基于 WebComponents 且遵循微信小程序规范的组件库。
    - 实现一个小程序规范的 API
    - 实现一个小程序规范的 路由机制
# 构建：MP
- source(react:dsl) -> webpack
    - 运行时注入
        - 注入taro-react 代替 react-dom
# 架构
- 项目管理：monorepo ： pnpm
- 项目模版
- cli
    - init
    - build
- 构建
- render: 
    - 多平台patch系统
- 插件系统：
    - 编译时插件
    - 运行时插件

# 插件机制

--- 

# taro体系化梳理
```
- 击穿xtaro/taro
    - 列出体系化的计划
    - taro总体解决方案
    - taro的插件-社区插件，解决了什么问题，怎么解决的
    - taro的官方插件-解决了什么问题，怎么解决的（编译plugin的开发）
    - xtaro总体方案
    - xtaro引用的社区插件
    - xtaro自己开发的插件
    - 脚手架-模版技术@njk@xtaro-cli
    - 各类编译plugin的开发+my-各个proj中编译的解决方案
        - 快速系统打底
        - 项目驱动：出tech-doc
        - 是不是要直接code：可以再评估总体进度
    - 其他taro/xtaro的经典问题 + 解决方案
```
# taro总体解决方案
```
me方案：
- 模版设计偏向于保留一些小程序的内容：例如app.config.js 对标page.json
- 构建时，根据不同的构建命令，去注入不同小程序平台的runtime: @taro/react-dom @taro/api @taro/component
    - 这些运行时都是遵照DOM/BOM的接口设计，在不同的宿主环境中实现了一套API, 保证源码[?]调用的是标准DOM/BOM接口
```
- 模版设计
    - 模版设计其实比较偏向于小程序, 
    - app.config.js 对标 小程序的page.json
- 模版初始化时：动态注入 + 模版插值
    - 模版插值：package.name 版本 描述
    - 注入内容：
        - React
    - 注入方式：
        - package.json中注入不同的运行时依赖：好比使用jsx-DSL, 就在dependence中增加react
- 构建流程
    - 注入运行时：内容：
    - 注入方式：
        - 通过pweback-plugin [?哪个plugin？]
        - 不同平台的taro-react（就是taro为各个平台的实现的react-dom）,或者说patch部分
- 构建时注入
# taro的运行时
- @tarojs/components
    - Taro 中可以使用小程序规范的内置组件进行开发，如 <View>、<Text>、<Button> 等
    - 使用这些组件需要统一从@tarojs/components中引入
- hooks
    - 在 Taro 中使用 Hooks API 很简单，Taro 的专有 Hooks（例如 usePageScroll, useReachBottom）从 @tarojs/taro 中引入，框架自己的 Hooks （例如 useEffect, useState）从对应的框架引入。
- 路由
    - https://docs.taro.zone/docs/router
    - 遵循微信小程序的路由规范。只需要修改全局配置的 pages 属性，配置为 Taro 应用中每个页面的路径即可。
    - Taro.navigateTo()
    - 传递参数：拼接到url.params上
    - 获取参数：componentDidMount -> this.$instance.router.params
    - 实现：
        - 在运行时库中实现了各个平台的history/location实现，以此可以支持任何使用history/location的前端路由库
        - 
- 网络
- 静态资源：
    - 样式文件：默认不能直接引用本地资源，只能通过网络地址、Base64 的方式来进行资源引用，为了方便开发，Taro 提供了直接在样式文件中引用本地资源的方式，其原理是通过 PostCSS 的 postcss-url 插件将样式中本地资源引用转换成 Base64 格式，从而能正常加载
# taro的插件-社区插件，解决了什么问题，怎么解决的
## babel-plugin
- [babel-preset-taro](https://docs.taro.zone/docs/babel-config#babel-preset-taro)
    - 根据当前项目的技术栈，选择性地使用以下的 presets 和 plugins
    - 一个babel动态配置插件，taro所有babel插件的入口
- 通用：
    - presets
        - @babel/preset-env
        - @babel/preset-typescript（TypeScript 环境）
    - plugins
        - @babel/plugin-transform-runtime
        - @babel/plugin-proposal-decorators
        - @babel/plugin-proposal-class-properties
        - babel-plugin-dynamic-import-node（小程序环境）
## post-css-plugin
## xml-parser
# taro的官方插件-解决了什么问题，怎么解决的（编译plugin的开发）
## taro-plugin
- [@tarojs/plugin-html](https://docs.taro.zone/docs/use-h5)
    - 多年以来 Web 端沉淀了大量优秀的库和组件，我们希望能直接在小程序端进行复用。此外，我们希望能减少 H5 应用迁移到小程序端的成本，甚至能够直接运行在小程序端。因此，自 v3.3 起支持使用 HTML 标签编写 Taro 应用
## babel-plugin
## post-css-plugin
## xml-parser
# taro中的经典问题+解决方案
## [设计稿和尺寸单位](https://docs.taro.zone/docs/size)
    - 规则设计：
        - 默认以 750px 作为换算尺寸标准
        - 如果设计稿不是以 750px 为标准，则需要在项目配置 config/index.js 中进行设置，例如设计稿尺寸是 640px，则需要修改项目配置 config/index.js 中的 designWidth 配置为 640
        - 750、 640 、 828 三种尺寸设计稿
        - 以750作为1，所有尺寸都会按照比例转为对应的数值
        - js中书写的行内样式，使用Taro.pxTransform(10)来转
        - PX Px 可以告知Taro忽略转换
    - 实现方案：
        - 样式文件中：post-css-plugin[??哪个plugin]
        - js文件中：运行时API Taro.pxTransform 
# xtaro总体方案
# xtaro引用的社区插件
# xtaro自己开发的插件
# 脚手架-模版技术@njk@xtaro-cli
# 各类编译plugin的开发+my-各个proj中编译的解决方案
    - 快速系统打底
    - 项目驱动：出tech-doc
    - 是不是要直接code：可以再评估总体进度
# 其他taro/xtaro的经典问题 + 解决方案