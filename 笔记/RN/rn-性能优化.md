## 参考
1. https://supercodepower.com/react-native-performance-js

## js-bundle优化
### 1. 减小js0-bundle体积
1. 使用 react-native-bundle-visualizer 查看包体积
    - https://github.com/IjzerenHein/react-native-bundle-visualizer
2. moment.js 替换为 day.js
3. ，babel-plugin-lodash 这个 babel 插件，可以在 JS 编译时操作 AST 做如下的自动转换：
```js
import { join, chunk } from 'lodash'
// ⬇️
import join from 'lodash/join'
import chunk from 'lodash/chunk'
```
使用方式也很简单，首先运行 yarn add babel-plugin-lodash -D 安装，然后在 babel.config.js 文件里启用插件即可：
```js
// babel.config.js

module.exports = {
  plugins: ['lodash'],
  presets: ['module:metro-react-native-babel-preset'],
};
```
4. babel-plugin-import，基本上它可以解决所有按需引用的问题
我们现在业务代码中引入：
```js
import { useInterval } from 'ahooks'
```
然后运行 yarn add babel-plugin-import -D 安装插件，在 babel.config.js 文件里启用插件：
```js
// babel.config.js
module.exports = {
  plugins: [
    [
      'import',
      {
        libraryName: 'ahooks',
        camel2DashComponentName: false, // 是否需要驼峰转短线
        camel2UnderlineComponentName: false, // 是否需要驼峰转下划线
      },
    ],
  ],
  presets: ['module:metro-react-native-babel-preset'],
};
```
启用后就可以实现 ahooks 的按需引入：
```js
import { useInterval } from 'ahooks'
// ⬇️
import useInterval from 'ahooks/lib/useInterval'
```
### 使用inline require
- 尝试用inline require
- 大家不要用 export default 这个语法，感兴趣的可以了解一下：

### 🔥js bundle分包加载
```
这个方向值得调研 也甚至可以抽出开源的方案出来：

1. 在ctrip这边，我们的解决方案思路是：
    - 得找机票整个前端去推，提供成熟的解决方案, 提供工具和方案到研发各个环节，当然最好做成自动化的，无感知的，程序代替一切手工负担
    - 蛋糕要大家一起吃，我这边提供工具和正套技术方案，每个团队都可以出人接入，享受到分包带来的size和性能提升的红利
```
1. 我们的拆包步骤只会在 Serialization 这一步。我们只要借助 Serialization 暴露的各个方法就可以实现 bundle 分包了
2. Metro 暴露了 createModuleIdFactory 这个函数，我们可以在这个函数里覆盖原来的自增 number 逻辑
3. metro.common.config.js
    - 第二步的关键在于过滤公有模块的 moduleId，Metro 提供了 processModuleFilter 这个方法，借助它可以实现模块的过滤
4. metro提供了什么扩展能力：？？
5. 分包后的加载：
    - React Native 不像浏览器的多 bundle 加载，直接动态生成一个 ```<script />``` 标签插入 HTML 中就可以实现动态加载了。我们需要结合具体的 RN 容器实现来实现 business.bundle 加载的需求。
    - 我们的答案是 common.bundle 加载完成后再加载 business.bundle
        - 我的计划是：懒加载 + common的合理分开：
        - 预加载 + 入口bundle可以和common
        - 做到配置化
    - 加载需要native侧的能力：
        - android: me
        - ios: 成龙
    - 可以参考的分包仓库：
        - https://github.com/smallnew/react-native-multibundler
### NetWork
### render
我们可以在代码里开启 MessageQueue 监视，看看 APP 启动后 JS Bridge 上面有有些啥：
```js
// index.js

import MessageQueue from 'react-native/Libraries/BatchedBridge/MessageQueue'
MessageQueue.spy(true);
```

## Native端优化
既然初始化耗时最长，我们在正式进入 React Native 容器前提前初始化不就好了？
这个方法非常的常见，因为很多 H5 容器也是这样做的。正式进入 WebView 网页前，先做一个 WebView 容器池，提前初始化 WebView，进入 H5 容器后，直接加载数据渲染，以达到网页秒开的效果。
RN 容器池这个概念看着很玄乎，其实就是一个 Map，key 为 RN 页面的 componentName（即 AppRegistry.registerComponent(appName, Component) 中传入的 appName），value 就是一个已经实例化的 RCTRootView/ReactRootView。
APP 启动后找个触发时机提前初始化，进入 RN 容器前先读容器池，如果有匹配的容器，直接拿来用即可，没有匹配的再重新初始化。


### 增量的实现方案
参考：https://juejin.cn/post/7051490517346943007
1. 如何减小下发包体积
#### 补丁式更新 diff_match_patch
1、diff 补丁
js复制代码const diffMatchPatch = require('diff-match-patch')
```js
const dmp = new diffMatchPatch();

const pre = "线上运行的资源包"
const next = "新资源包"

const diff = dmp.diff_main(pre, next)
const patches = dmp.patch_make(diff)
```
patches 就是补丁内容，压缩之后只有几kb大小
2、客户端下载补丁并更新
js复制代码const diffMatchPatch = require('diff-match-patch')
```js
const dmp = new diffMatchPatch()

const pre = "线上运行的资源包"
const patches = "下发的补丁文件"

const result = dmp.patch_apply(patches, pre)
```

result就是我们打好补丁的最新资源包。

### JSI
- JSI 的全名是 JavaScript Interface，一个用 C++ 写的框架，作用是支持 JS 直接调用 Native 方法，而不是现在通过 Bridge 异步通讯。
- 借助 JSI，我们可以用 JS 直接获得 C++ 对象的引用（Host Objects），进而直接控制 UI，直接调用 Native Modules 的方法，省去 bridge 异步通讯的开销。
- JSI 实现 JS 和 Native 的同步调用，耗时更少，效率更高。



