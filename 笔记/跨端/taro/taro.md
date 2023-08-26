# 原理
- [taro进阶](https://docs.taro.zone/docs/dynamic-import)
- 我们通过 @tarojs/plugin-http 插件，在小程序环境下 runtime 注入模拟实现的 XMLHttpRequest , 从而支持在小程序环境中使用 web 生态下的各种网络请求库。至此，你可以在 h5、小程序、react native 中畅快使用 axios 库作为请求库。理论上， 任何底层基于 XMLHttpRequest 开发的 web 库你都可以自由使用。
- 在 H5 开发时，我们能够使用动态 import 语法实现异步加载等功能。但在小程序环境是不支持动态 import 的，因此 Taro 默认会把动态 import 语法转换为普通 require 语法。感谢 @JiyuShao 同学贡献的插件 taro-dynamic-import-weapp，让我们能够在微信小程序环境中使用上动态 import。
- 插件：
    - 编译时插件
    - 运行时插件