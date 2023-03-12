```
1. 产生的背景 + 作用
2. 功能版块结构 + 整个闭环流程
3. 各个版块的实现
4. 部分关键实现：能够小规模code出来
```

## target
1. 吸收核心
  - 删繁就简三秋树
  - 拆分出子能力：拆分出积木
  - 提高node水平（1月 2月 3月）- 吸收实战开发能力
2. 作为npm-cli的技术base
3. 不要纠结于细节：有些低价值低水平细节 可以忽略 时时提醒自己跳出 时时抬头看目标：
  - 自己实现一个cli有成熟的思路和武器库
  - lancer-cli的设计和实现 I am yanfen
4. 设置阈值：一个问题10min没有结果 就去看答案 前期-积累武器库

# 功能架构
大的功能：
init
add
pull/publish
dev

# 功能架构图 - 数据流动
portm(后端) - local - FE
  - 后端：存储所有的组件 和 页面信息

tree.json - description:
  - 数据结构设计
- 页面描述数据结构：
```json
{
  id: 后端生成,
  name: 用来拼接出源码路径,
  label: 显示用, 
  slots: [{
    name: , // 对应的slot-name
    children: [{
      id: 后端生成, // 被使用的组件 会生成一个id
      name: ,
      slots: [], 
      props: {}
    }]
  }],
  props: {
    prop1: xxxx, // 填写组件（这里是页面组件）定义的prop
  }
}
```
- 组件描述数据结构：
```json
{
  visible: ,
  slots: [{
    name: slot-name, // 一般不命名就是
  }],
  props: {
    prop1: {
      label: ,
      type: ,
      options: , 
      default: ,
    }
  }
}
```

## 闭环流程
init
add
dev开发
publish
pull

###  闭环流程详解
1. init
  - downLoad-project-tempalte
  - downLoad-comp-tempalte: 供后面add时 直接copy
2. add
  - add-comp
    - 处理参数：comp-name
    - fs.copy 
      - from node_modules/compTemplate 
      - to process.cwd()/src
3. dev
  - 检查配置文件
  - plugin-init: 目前只是在dev阶段使用plugin
  - watch：src + mock
    - build
  - koa-server start
    - koa中间件：cors bodyParser router
    - 触发一个plugin-hook: beforeRouteRegister
    - 内置一个接口：返回本地开发的页面数据
      - caster.merge(TreeData + .ark/CompData + 后端.get组件数据) 
      - 9000
    - 启动ws:3000
      - 发送一些信号量：例如文件发生变化
4. build： 构建要publish的数据
  - 输入：读取本地src下文件 
  - caster.build -> 生成的
  - 输出：写入到本地的.ark/
5. publish
  - 输入：读取.ark/下所有数据
  - 后端.publish

## 各个主流程环节的核心实现
### cmdAllowCheker
### selfUpdateCheck
### init
- download-npm-tarball
  - 从sankuai.npm的download目录下下载 静态资源包 tgz资源 tar包资源
  - name + version
  - 模板其实是上传publish到sankuai.npm中的
  - nodejs如何实现下载一个文件到本地
    - request(url).pipe(writeStream)
    - 这是我的实现 不是download-npm-tarball的实现
### add
### build
### dev
### publish



---


## 工程模板能力（重点）
```
抽出cli模板能力
1. 模板和cli解耦：单独维护 - 下载模板到本地
2. 每个命令都有：命令权限检查 + 检查更新 + 业务动作 + process.exit(0)
```
## 各个命令的主流程
### init 初始化模块代码
#### 主流程
1. 命令检查（根据配置检查是否允许执行） - 不允许 则throw出error 流程中断进入catch中
2. 检查更新（cli的版本是否为最新）-只是提示
  - execPromise
3. 初始化模块
  - 初始化目录环境
  - 下载相关依赖（为什么动态下载-为了确保不需要每次都手动更改package.json中的模板依赖的版本，每次默认请求最新的模板包）
    - 下载运行容器
    - 下载初始模板
    - 其他:低价值细节：
      - 修改gitignore文件名，npm无法上传.gitignore
      - meat
### add 添加Lancer组件，公共组件，公共js
1. 如果用户没有填写组件名称：
  - 引导用户去完善信息
2. 如果填写了组件必要信息
  - 直接生成
    - 模板是在init的时候已经下载好了，直接根据填写的信息类型，去模板包中找对应的组件模板,copy过来


## pull&publish
### pull 拉取页面/区块或组件
1. 鉴权
  1. 从portm上拉取 - 获得token - 身份鉴权信息
  2. login
2. 获取组件信息
3. （核心本质）根据组件信息 远程download（代码）
  - 有冲突时 会报错？
4. (低价值细节)将拉取的代码meta等更新到本地
  - 遍历组件列表 一项一项和当前的组件进行对比
  - 本地文件有修改 如何处理冲突？
### publish 将模块发布到线上环境或测试环境
1. 发布环境检查
  1. 环境参数检查
  2. 线上环境分支检查
  3. 版本检查：本地版本必须>=线上版本 - 否则报错
2. build
3. 上传（portm）
### swimlane 将本地组件发布至测试泳道

## 构建开发&调试
### build 本地构建模块
1. 构建的核心用：casterCliBuild，平台提供的core
2. 写入到本地
### dev 实时监听模块变动并构建（重点）
1. 初始化
  - 鉴权：检测tocken
  - 插件初始化
  - 启动watch file - builder（watch进行防抖 200ms）
2. 启动本地server
#### 本地dev-server的设计
### debug 页面调试

## 其他
### initLibrary 初始化原生组件库
### publishLibrary 发布原生组件库





## 核心功能实现
### plugin机制设计和实现
- 插件设计
  - plugins: [xxxplugin()]
  - plugin本身是一个对象
  ```js
  {
    name: xxx,
    hookName1() {},
    hookName2() {}
    ...
  }
  ```
  - 在lancer.config文件中注入
- 开放的底层能力：通过this作为上下文共享：调用：
  - getLocalComps
  - getMockTree
  - rewriteMockTree
  - error
- 调度设计：hook机制
  - hook设计
    - before-router-register
    - beforePublish
    - beforePreview
    - beforeTransform
  - hook机制设计
  - 特点
    - handler定义支持async
    - 上下文：通过this共享
- 配合一篇blog学习下
  - https://mp.weixin.qq.com/s/z1FxacYYtTch1AofBcOfOg
  - https://mp.weixin.qq.com/s/MBUAKRQx0s6BMDRJOOBC4g
- [插件使用](https://km.sankuai.com/page/1143040224)

### component-semver-publish@yaolong

## 工具建设-积木能力实现：武器库
- 下载npm包
  - 拼接要下载的npm包的url
    - 怎么确定url ?
  - npm: download-package-tarball
- 检查更新
- 版本检查
- file watch - onchange事件 记得使用防抖：lodash.debounce，200ms
  


# 架构设计
```
1. 一个cli的通用模板设计
2. 画出架构图：用笔也可以 学会画架构图
```
底层/基础能力-标准能力：
  远程存储的读写（portm:k：v）
  本地持久化：文件
  版本校验
  鉴权
  版本检查
接口层
应用层
  命令行层

## 插件架构
```
插件机制主要包括：
注册
触发hook
```
- core
  - 核心能力（微内核，甚至多个微内核）
  - 插件调度能力
- 标准api（封装核心能力，屏蔽内在的复杂性）
- 插件（自定义能力）

- me:
  - babel中插件：多个插件有多个调用的地方，这种情况：可以通过merge-plugin的方式，合成统一的一个插件,这样就不用为了每个插件，多次调用

- constructor() 
  - 获得插件列表
  - 过滤插件列表
  - 给插件列表注入上下文：
    - 上下文：一些暴露给插件列表的方法可以挂载在上面，利用一个map维护：plugin: pluginContext之间的关系
    - 该上下文，在执行插件的时候，通过call之类的作为this注入，这样插件就可以通过this拿到插件系统给构造的context了
- 触发hooks
  - 通过调用插件实例的hook方法，可以触发相关hook
    - 入参：hookName args reduce replaceContext
    - 遍历插件列表 去执行触发hook

### 常见插件架构
#### 主流设计
- core
  - 核心功能
  - 管理插件
    - 注册
    - 卸载（可插拔）
    - 插件生命周期
- plugin-api
- plugin
#### babel插件机制
1. 目的：开发者自定义插件来实现特殊的转换需求
2. babel 是如何组织管理插件呢？
  - 我们知道，babel 会深度递归遍历 AST，代价很高，最好的方式是把插件组织起来，在一次遍历中全部执行完成
  - babel 内部为了提高效率，正是采用 merge visitors 的方式
3. 每个插件有2个时机：
  - enter
  - exit
#### webpack插件机制
1. 目的：在于解决 loader 无法实现的其他事。除了自身提供的开箱即用的插件，还支持自定义插件。
2. webpack插件机制是webpack的骨架，同时，webpack本身也是利用这套骨架构建而成的。
  webpack分为内核和插件两个部分。内核不承担任何打包编译的功能，只负责插件调度和状态记录，插件则承担具体的打包编译功能。
3. 事件流本质上：是为了保证插件的有序性。
ps：webpack为了提供基本的打包编译功能，内置了大量的内部插件。
2. hooks （事件驱动）
3. [?]Tapable - 管理事件流的机制
- webpack 的本质是处理事件流，在编译过程中会依据钩子执行不同的 plugin，如何将 plugin 与钩子对应起来正是 Tapable 要干的事，核心原理是发布订阅模式
- Tapable 就是 webpack 的一个工具库，在插件绑定对应的事件到对应的 webpack 暴露的钩子上，webapck 编译过程中触发事件，随后根据不同的 Tapable 方法执行绑定的函数。
- 当同一个事件被多个插件监听时，这些回调函数该以怎么样的顺序执行？webpack团队内部维护了独立lib——tapable，来专门处理这个问题
  - 事件驱动的运行方式，代码跟踪困难。
- Waterfall：Waterfall在英语中是瀑布的意思，在编程世界中表示顺序执行各种任务，在这里实现的效果是，当一个hook注册了多个回调方法，前一个回调执行完了才会执行下一个回调，而前一个回调的执行结果会作为参数传给下一个回调函数
- 本质上就是一个为了各种需求而复杂化的事件（发布-订阅）模式。
##### hooks和事件的区别
- hook对应执行时机
- 事件
## 工程化

## 难点
- 插件机制设计和实现
- webpack & tapable插件机制设计和实现

## TODO
- execPromise: 以promise的形式执行命令行-可以出一个npm包 - node-plus
- 思考下：管道和流水线：例如talos的设计

## 没见过的&不会的:积累-武器库建设
### npm
#### fs
  - chokidar: watch file, 看下底层怎么封装fs.watch的
  - fs-extra
    - .ensureDir
    - writeJSON
    - move
    - pathExists
    - readJSONconsole.log('', )
    - writeJSON
    - fs.copy
  - memory-fs: webpack--dev-server的依赖 写入文件到内存 频繁读写的场景
#### cli
  - commander
  - cli-select 选项
  - chalk
  - ora

#### web
  - koa
    - koa-router
    - koa-bodyparser 看下实现
    - @koa/cors 看下实现
#### others
  - empty-dir
  - npm info 拿到最新版本
    - pck.name 来自于本身的package.json
  - npm: download-package-tarball:下载npm包
  - semver 必须理解
  - prompts 提示
  - colors
### node
  - os.tmpdir()
    - linux基础知识 + 目录知识（常用的目录：bin等）
  - process.exit()
  - process.chdir


## 参考
- [从0开始开发一个命令行](https://www.chenliqiang.cn/post/node-js-cli-start-up.html)
