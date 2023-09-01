# 原理
- [taro进阶](https://docs.taro.zone/docs/dynamic-import)
- [taro原理](https://segmentfault.com/a/1190000041340251)
- 我们通过 @tarojs/plugin-http 插件，在小程序环境下 runtime 注入模拟实现的 XMLHttpRequest , 从而支持在小程序环境中使用 web 生态下的各种网络请求库。至此，你可以在 h5、小程序、react native 中畅快使用 axios 库作为请求库。理论上， 任何底层基于 XMLHttpRequest 开发的 web 库你都可以自由使用。
- 在 H5 开发时，我们能够使用动态 import 语法实现异步加载等功能。但在小程序环境是不支持动态 import 的，因此 Taro 默认会把动态 import 语法转换为普通 require 语法。感谢 @JiyuShao 同学贡献的插件 taro-dynamic-import-weapp，让我们能够在微信小程序环境中使用上动态 import。
- Taro3自己实现了一套类似浏览器的BOM/DOM那一套API，通过webpack的plugin注入到小程序的逻辑层，打包编译后，你最终的代码都是基于BOM/DOM这几个API来实现你的具体功能，比如：不管什么平台，都有自己一套元素dom的规则，都有各自平台的类似bom的全局api规则，Taro3做的就是整合这些厂家的规则封装为类似BOM/DOM的思想去用，也就是说，我不管你开发时用的什么框架，我只要保证你运行时能帮你适配到各个平台即可。
- Taro的核心原理是在编译构建时通过注入自定义配置，将原本的小程序组件和API替换为适应不同平台的组件和API，从而实现多端能力
- 插件：
    - 编译时插件
    - 运行时插件
# 架构