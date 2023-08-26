# taro
- DSL： react ts/js
- 插件系统
    - [平台插件规范](https://docs.taro.zone/docs/platform-plugin/how/)
    - [插件编写](https://docs.taro.zone/docs/plugin-custom/)
- 运行时:组件库
    - 我们开发taro项目时，引用的是taro库下面的api和组件，调用类似微信原生的api
    - Taro制定了一套运行时的标准组件库和api，通过对原生api进行拓展和配合编译时已经抹平了状态、事件绑定、页面配置和生命周期等的差异，完成了框架的适配工作
    - Taro3自己实现了一套类似浏览器的BOM/DOM那一套API，通过webpack的plugin注入到小程序的逻辑层，打包编译后，你最终的代码都是基于BOM/DOM这几个API来实现你的具体功能（相当于BOM/DOM都是一组标准设计，每个平台按照这个标准，实现运行时）
    - 有个关键点：既然Taro3自己实现了BOM/DOM这一套api，而react的中的渲染器，如react-dom中调用的是浏览器的BOM/DOM的api，那taro肯定会有自己一套渲染器来链接react的协调器（reconciler，diff算法所在阶段）和taro-runtime 的 BOM/DOM api。源码路径：@tarojs/react,description里面的描述如下："like react-dom, but for mini apps."（也就是说taro自己实现了一个taro-runtime替换了-reactdom部分，该taro-runtime目前来看是render到小程序平台中）