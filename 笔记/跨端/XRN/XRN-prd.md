# 主干功能
```
优先完成prd+技术方案，将这个关键点都解决后，成竹于胸再code
此时，android的系统打底也完成差不多了，就可以开始落地了
所以重点是prd + 技术方案：一定要打磨到解决所有关键技术点
```
## 概述：版本设计
### version0.x.x
1. version0.0.1: 首先抛开远程发布+多bundle 相关概念, 先把android单边走通，我们渐进增强。我们的首先是：
    - rn-cli create a project
    - 用Android实现一个壳子, 里面先实现一个单容器_RNView：继承自ReactRootView
    - 然后：🟥：我们需要一个rn-cli中打出来的bundle，
    - 将该bundle放到该android壳子中，然后让其运行起来
2. version0.0.2: 多bundle打通:
    - 对于容器 _ReactRootView 进行模块化封装, 提供创建方法
    - 创建2个容器, 用不同的btn可以进入不同的bundle
    - 准备2个不同的bundle: 用rn-cli创建2份：然后放在wrap-app不同的dest下
3. version0.0.3: 🟥设计bundle之间互跳方案：openUrl: + 提供初步的runtime-framework:
    - 提供一个runtime-framework:基本工程:
    - 提供openUrl: 可以实现bundle之间的互跳 + 传递数据
    - 在bundle中增加可以互跳并传递数据的button + TextView: 实现互跳功能
    - openUrl: 协议初步设计，满足需求即可
4. version0.0.4: 容器创建动态化，根据bundle注册信息进行动态化创建容器
    - 设计bundle注册信息：可以先用配置文件来描述（后面的版本会放在mysql表中记录吗？）
    - 提供动态化创建容器的工厂
    - 根据注册信息，进行动态化创建容器
    - 获取指定位置的bundle加载到容器中
5. version0.0.5: xrn-cli:初版
    - build: 剥离rn-cli的proj-temp中的native部分, 单纯打包bundle部分，打包的bundle可以在容器中运行
    - start: 将容器app作为底包，放在本地 + 驱动ios模拟器：进行dev调试
    - 初步从bundle项目中抽离出bundle-proj-template
    - init: 创建bundle项目
6. version0.0.6: 在本机开发+部署 分包管理bundle-manege-server + 搭建静态服务器 + xrn-cli publish
    - 搭建静态服务器
    - 分包管理server
        - 搭建nestjs server
        - 安装mysql
        - 设计表结构：
            - 底包版本 平台（android/ios） 容器id 
            - bundle表： bundle-id bundle-version bundle静态资源地址
        - 设计：bundle注册能力+界面
    - xrn publish功能开发
7. version0.0.7： bundle-proj与分包管理budnle-manage-server进行交互
    - 启动流程
    - 获取bundle-manage-server中的bundle注册信息
    - 根据注册信息，根据容器id获取对应的bundle
    - 加载bundle + 运行
9. version0.0.8: bundle-manage-platform
    - 手动发布平台：（基于类似taro的pipe-line平台设计）
        - pipeLine 和 手动发布能力：分开，手动发布能力封装为官方中间件
9. version0.0.9: devOps流水线version1:自动化发布
    - 搭建gitlab + jenkins + dockers + k8s
    - CICD: gitpush -> npm i -> build -> publish
10. version0.0.10: CICD 和 bundle-manage-server联调
11. version0.0.11: App容器对于bundle的缓存能力设计 + bundle版本系统设计 + app版本系统设计
    - 目前缓存暂时依照版本进行缓存
    - 或者根据bundle-hush生成该bundle-id 来进行比对是否变化
12. version0.0.12: 增量包机制
    - build会根据各个上个版本生成对应的增量包
        - 打包bundle-new
        - 和线上bundle-old进行diff，生成
12. version0.0.13: bundle-manager-platform: 简单用户管理系统
13. version0.0.14: runtime-framework version2（hybrid开发）
    - APP Page ViewPort
    - APP Page 各自生命周期设计：
        - 在容器加载的各个阶段 触发生命周期（注册回调）
    - route统一和注入
### version1.x.x 稳定可用版本,主干基本已经稳定,增加各种场景的处理
1. version1.0.0 
2. 安全: bundle的防注入处理？？
3. lazyrequire
4. common-bundle: 例如组件库, 避免每个bundle都打包一份在自己的bundle中:
5. 预加载、预请求
6. 监控：异常 性能
7. 埋点：pv 等自动上报
8. 排障：sourceMap 流量回放平台
9. bundle-template进一步完善：UT/AT graphQL TS
10. XRN配套的dev-tools ? 评估是否有必要
    - 本地调试
    - 真机调试
        - cli preview生成二维码真机预览
11. hermes引入？
12. 包内路径映射本地调试
### version2.x.x 引入IOS
# xrn-cli
# xrn-runtime-framework
# xrn-proj-template
# xrn-app-warp:android
# xrn-app-warp:ios
# xrn-devOps