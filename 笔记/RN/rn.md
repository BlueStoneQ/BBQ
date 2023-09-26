# 资料
- 《React Native精解与实战》
# flutter Vs RN
- https://zhuanlan.zhihu.com/p/70070316
- Flutter 原生控件的接入上是仍不如 React Native 稳定。
- 在插件这一块的体验， Flutter 是略微优于 React Native 的。
- 在 React Native 同等条件下， Android 比 IOS 大很多 ，这是因为 IOS 自带了 JSCore ，而 Android 需要各类动态 so 内置支持，而且这里 Android 的动态库 so 是经过了 ndk 过滤后的大小，不然还会更大。
- Flutter 和 React Native 则是相反，因为 Android 自带了 skia ，所以比没有自带 skia 的 IOS 会小得多。
- 理论性能，在理论上 Flutter 的设计性能是强于 React Native ，这是框架设计的理念导致的，Flutter 在少了 OEM Widget ，直接与 CPU / GPU 交互的特性，决定了它先天性能的优势。
- RN 本身的局限性在于开发适配和性能上，因为平台依赖性太强导致的版本升级和痛点不断 ， 而这个Flutter 给予无法比拟的：因为flutter直接越过了系统本身，和GPU硬件打交道

# RN原理
- 框架会将我们开发 的所有 JavaScript代码，包括 React Native框架代码 、 第三方组件代码、业务逻辑 代码、 图片等资源都将打包在一个JSBundle文件中， 
# RN热更新
- RN框架本身就支持增量热更新:
  - React Native 框架一个最大的特性就是热更新的功能，用户可以在不更新 App 的情况下进行 App 的热更新，甚至支持增量热更新，服务器只需要给用户下发新增 的代码与资源文件， React Native 框架会自动进行 JS Bundle 文件的合并， App 在重 新加载了 JS Bundle 后， App 的功能与内容也进行了更新
  - react Native框架只是提供了热更新的功能基础，具体的功能需要自己去使用
代码实现 
- 热更新框架：codePush
  - 服务端的代码增 量 比较、部署以及前台下载更新的代码都自己去实现 的话，整个过程会比较复杂，而且在 App 引人热更新功能后，如果此模块不稳定的 话，可能会造成 App 完全不能打开的问题，而且还会涉及版本 的管理、更新出错后 的版本回滚等复杂操作，所以我们推荐直接选择一个既有的、稳定的第三方框架来 完成 React Native 平台下 的热更新功 能 。
  - 我们可以直接通过调用 CodePush 的 SDK 来快速 、稳定地实现 App 的热更新功能 
  - CodePush 云平台
  - iOS 平 台 的集成推荐使用 link命令进行自动的组件集成，执行的命令为: 
```bash
react-native link react-native-code-push
```

# RN性能优化
- 结构：性能问题 - 指标衡量 - 优化方案
