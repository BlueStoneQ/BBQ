## rpk结构
- manifest.json
- app.js
- pages
    - home
        - index.js
        - index.ir.json 
    - detail
        - index.js
        - index.ir.json
- assets
- shared
- META
    - runtime-meta.json
    - source-map

## load过程
- 容器准备
- 加载次序 + 职能：
    - 签名+完整性校验
    - META/runtime-meta.json 校验runtime是否可以加载 =》校验rpk和runtime是不是匹配
    - 加载manifest？ 注册应用元信息，建立路由表
    - 加载app.js - 做什么？
    - 按照manifest中route字段，加载首页：home.ir.json 先建立静态模版树（内存中的IR映射）？
    - 加载home.js: 这个js做了什么？

## core：核心部件

## QA
### 签名校验？
确认 RPK 来自可信发布者，防止被篡改或伪造；通常验证 META-INF 中签名和证书链。属于 Loader/发布体系，不属于 Core。
### 完整性校验？为了什么？方案？
确认包内文件未被修改或损坏。Loader 根据 runtime-meta.json 中的 sha256 校验 app.js、页面 JS、IR 和资源。
签名：验证“谁发布”
哈希：验证“内容是否被改”
### 路由表：本质数据结构？
Map<Route, PageDescriptor>
### 加载应用依赖：本质动作？$import 不是走ESM吗？而是走 自定义的feature $import?
源码 import/require
-> Toolkit 编译为自定义模块系统
-> 运行时使用 $app_require$(moduleId)
-> Module Loader 查表、实例化并缓存
### appjs的作用就是注册一堆app的生命周期吗？
### 加载了pagejs后才开始创建页面PageVM， 不对吧 ，先有VM才能加载pagejs吧？
### runutime Tree是由page VM 实例管理的吗？一个页面一个page VM吗？
### Present 是干什么？
### 所以 理论上 我们js部分还有一个mvvm框架？
