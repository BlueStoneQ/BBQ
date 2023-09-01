# target
- 最终是要产出自洽可用且专业度高的low-code方案：
    - H5
    - mp
# 资料
- [ali-low-code-engine协议规范](https://lowcode-engine.cn/site/docs/specs/lowcode-spec)
- https://juejin.cn/post/7034052451573432351
- http://www.lowcodetime.com/9979.html

# 问题
1. 事件如何解决
    - schema: 每个组件有一个events对象, 用于存储绑定事件
    - 定义事件本身：jscode
    - schema中定义事件，在配置区面板中显示出来可以配置:
    - 可以定义一些常用的eventHandler:
        - 打开链接
        - 请求某个接口
        - 订阅数据源 + 设置函数 + 将数据源映射到自己暴露的某个字段上
    - emit端：
    - 监听端：
2. 组件之间的通信
- 例子驱动：好比说Tabs组件：
- https://cloud.tencent.com/developer/article/2218089
- tabs组件切换：
- 物料schema设计：
```json
{
    "tabList": [{
        "tabLabel": "鞋子",
        "tabkey": "shoes",
        "events": [{
            "eventName": ""
        }],
        "children": [{
            "componentName": "list",
        }]
    }]
}
```
- 流程：配置tabList - 点击tab - 触发配置链接的handler, + 传入handler对应的参数 - handler对应的数据挂载到某个key（变量）上 - 配置tab容器内子组件： - 配置为list组件 - 配置list组件的listData(数据源) - 
3. 物料codeString如何传递
    - json-schema中只记录描述所有组件的cdn地址，将json-tree + 渲染器cdn都插入到html中
    - node:bff层来拼装出这份html，也即SSR
    - 发布的时候，我们的description中只记录该组件的codeStr的静态文件地址，等到最后页面拼接的时候，会拉取并注入
    - codeStr我们通过Compoent.props + common依赖runtime注入
    - runtime会提供require 会去获取codeStr进行注入
    - 每个组件会注入的js运行时
    ```json
    {
        "compoent": "pageWrap",
        "type": "custom", // 自定义组件, 只有custom组件有codeStr
        "props": [],
        "codeStr": "", // js CodeStr的静态地址，在搭建端配置成页面后，这里会注入该组件pageWrap的jsCodeStr实体字符串
        "children": [{
            "compoent": "tab",
            "props": [],
            "codeStr": "", // 这里的codeStr
        }, {
            "compoent": "div",
            "type": "div", // 非自定义组件，而是容器支持的标签，则只有style等标签特有的一些属性
            "style": "position: absolute..." 
        }, {
            "compoent": "image",
            "type": "image",
            "style": "position: absolute...",
            "src": "http://xx.xx.x/xxx.jpg"
        }]
    }
    ```
    - 在呈现端的模版解析容器中:
    - 构建的时候：[node解析xml](https://juejin.cn/post/7061867443009880101)
        - 对解析的xml.json进行transform，然后得到的
    ```xml
    if componentType === "custom" 
        <compoent codeStr="props.codeStr" ></component>
    ```
    ```js
    Component({
        onLoad(props) {
            // 相当于eval(codeStr)
            jsEngineRun(props.codeStr)
        }
    })
    ```
4. 单包组件发布如何提取依赖
    - 低代码组件的构建脚本和其他常规前端项目的构建脚本还有两点差异，
        1. 一、每一个组件需要被单独打包构建，也就是说每一个组件需要作为单独的一个入口文件，
        2. 二、在对所有组件资源进行打包构建时需要配置 optimization 来将所有组件中使用到的公共资源等抽离出来放在单独的vender、common、manifest文件中，来减少每个组件构建的体积，同时在html中也需要引入相应的公共资源
5. 引用其他组件
    - common组件会作为vendor包，并且在json.schema中注册,
        - 本地构建的时候，会将common组件打包
    - SSG/SSR: 最终生成的页面就是一个静态页面，挂载在CDN静态服务器上
        - 所有的依赖都会注入到页面中，构建后作为一个静态页面挂载在静态服务器上
6. 页面容器组件设计
- eg: 我们就梳理通一个tab+list型的活动促销页来梳理下整个low-code中的经典问题：
```json
{
    "label": "页面组件",
    "component": "pageWrap",
    "children": [{ // 其他组件可以拖曳到这里
        "label": "tab组件",
        "component": "tab",
        "props": [{
            "label": "鞋子",
            "tabKey": "shoe", // 数据源在list组件内部自己配置+获取
        }],
        "chidlren": [{
            "tabKey": "shoe", // 绑定的tabKey, 和 props[n].tabKey对应
            "compoent": "list",
        }]
    }]
}
```
7. ark全链路解决方案@me:
- 物料端构建：
    - xml -node-xml-parser-> xmlJson -> tansform(我们当ast看，提供tranverse + visitor, 来构建我们最终的组件UI-json) -> UI-json
    - js -node.fs.read-> jsCodeStr -> 将其注入到UI-json的codeStr属性中（或者将其发布到静态服务器后，将地址先挂在codeStr属性中）
    - wxss - postCss-plugin:将其注入到UI-json中的style属性中
- 运行时：
    - UI: render-engine: 模版 + 自定义组件
    - JS: eval/new Function()/jsEngine() + runtime(api+页面容器模版)
        - 页面容器模版：获取搭建好的页面str, 解析后将
            - UI-json: 通过setData传递给wxml.renderTemplate
            - codeStr: 交给当前的jsEngine.run(codeStr)
- 组件通信：
    - 参考
- 依赖common
    - 单独有common目录
    - 该目录会单独打包上报
    - 并根据搭建的页面中的dependences属性进行SSG: - 并打包注入

# my-design@ark
- 物料端
    - js + xml + css + meta.json
    - build结果是怎么样的？codeStr在哪里？如何传递？
    - build过程是怎样实现的？
- 搭建端
    - 物料区
    - 预览区
    - 配置区
- 呈现端：runtime
    - UI: json-schema解析模版（遍历+递归）
    - js: jsEngineEval(jsCodeStr) + runtime设计注入
        - rumtime: 拉取页面配置json-schema + require(依赖)
- 组件类型：
    - 容器组件

# note
- 通过组件元数据拼装成一个页面的描述信息，然后通过渲染器组件将描述信息转化页面dom元素

# 物料协议
- ali: 自动扫描代码生成物料描述文件json
# 搭建协议
# 资产包协议
# 技术方案

# 落地实现方案
- 以上设计如何真正实现