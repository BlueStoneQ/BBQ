# 参考
- https://cloud.tencent.com/developer/article/2228412

# 实现载体
- taro-plugin
- taroXRN组件库
- metro-config

# 动作时机
- metro build过程中

# 产物
- target 可以跑在XRN容器中

# 核心实现
- 样式文件 -> style transformer(rm-style-transform + babel-plugin-transform-react-jsx-ro-rn-stylesheet)
- 代码文件 -> code transform(babel)

# 临时笔记
攻坚：提前ready => Xtaro: 启动：
    - 概要：
        - 一码多端 + 适配企业：
            - react-dsl =xtaro> CRN + NFES:H5 + 小程序（taro天然支持）
            - 静态编译 + 运行时注入
        - 从 core -> 企业级解决方案:一定要比较全量的吸收整个方案
    - taro快速打底：运行时：先理解是一个什么 管道的input+output
    - 配合代码：结构 核心实现：打通自己梳理的方案
        - 入口：调度者：xtaro-cli
        - core: xtaro-plugin-platform-crn
            - 载体: taro-plugin
        - metro: packages/xtaro-metro-crn
            - 载体：metro-plugin ?
            - 不修改任何xTaro代码可以启动 CRN 服务靠的是@ctrip/xtaro-metro-crn
            - 功能：
                - 解析：scss成为RN.createStyle(),并联系到RN.jsx文件
        - css2RN.createStyle : xtaro-crn-style-transformer
            - post-css-plugin
        - 运行时：xtaro-components-crn
            - 使用 CRN 的原生API实现了@tarojs/components，@tarojs/taro，@taro/runtime大部分组件和API
    - taro:
        - DSL: React
        - 编译能力： babel + postCss
        - 运行时：taro组件库 @tarojs/components，@tarojs/taro @taro/runtime
        - plugin系统
    
# 系统打底
- [taro:插件编写](https://docs.taro.zone/docs/2.x/plugin#%E5%A6%82%E4%BD%95%E7%BC%96%E5%86%99%E4%B8%80%E4%B8%AA%E6%8F%92%E4%BB%B6)
- [xtaro跨端实践](https://mp.weixin.qq.com/s/1ufn4jIIRH0Ba665UOsKrw)
# build
- XXtaro cli build --type xrn -> taro build ...args -> 模版项目中：taro中配置+注册了taro-plugin
    -> taro调用:taro-plugin-xrn -> taro-output: crn-code
        => taro产出的代码在dist下，而这个事xrn-cli的input (dist下的是标准的xrn源码)
    -> 手动: xrn-cli:build -> metro-plugin -> rn-output:rn-bundles
        - 替换了dist:xrn代码中的运行时库:组件库别名替换:
            - 替换@tarojs/components + @tarojs/taro + @tarojs/runtime 为 @ctrip/xtaro-components-crn
        - 支持部分平台文件：index.xrn.jsx index.xrn.scss
        - 支持scss样式文件: @tarijs/rn-style-transformer
        - 支持CSSModule样式: babel-plugin-transform-react-jsx-to-rn-stylesheet

# taro-plugin-xrn
- ctx.registerPlatform // 对编译平台进行扩展
- 职能：
    - build crn
        1. 在output的文件中利用模版+配置注入以下文件（本质: 注入crn工程需要的一些文件）：
            1. main.js ， 继承了crn.APP + 路由等
            2. index.ios.js + index.android.js 
            3. 相关CRN-proj需要的配置：
                - metroConfig
                    - import: xtaro-metro-crn
                    - resolver: xtaro-metro-crn.resolver
                    - transformer: xtaro-metro-crn.transformer
                - babelConfig
                    - preset: metro-react-native-babel-preset
                    - plugin: 
                        - @babel/plugin-proposal-decorators
                        - babel-plugin-dynamic-import-node
            4. 根据taro-input源码 + 模版：批量生成页面：
                - 生成源码路径
                - 源码 + 模版：批量生成业务页面
    - build mp
# metro-plugin-xrn
- 职能：

# 范式积累

## taro-plugin
## metro-plugin

## taro:v3.5.x
- 