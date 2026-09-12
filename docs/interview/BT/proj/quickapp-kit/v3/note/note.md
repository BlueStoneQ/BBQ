**Toolkit 打包**

Toolkit 读取 `manifest.json`、`.ux`、JS、样式和资源；
分别解析模板、脚本、样式，再统一 Lowering。
模板生成 Page IR，包含静态节点、Binding 目标、动态 Block、Handler 和稳定 ID；
脚本生成页面模块、响应式控制器、`deps` 与 evaluator。
最后校验 Contract，将 manifest、页面 JS、Page IR、资源和 runtime metadata 封装为 RPK。

**RPK 到首帧**

宿主加载 RPK，解析 manifest，确定入口页；
JS Framework 注册 App/Page 模块并 bootstrap，创建响应式页面控制器。
C++ Core 解析 Page IR，形成 PageTemplate；
JS 计算初始 Binding 和 Block，通过 `instantiateTemplate` 提交。
Core 实例化唯一 Runtime Tree、执行 Yoga 布局并生成 MountTransaction；Platform 后端创建控件、应用属性和布局，显示首帧。

**Update**

页面 Handler 修改 state，Proxy 拦截写入；
JS Framework 根据 `deps` 找到 dirty Binding/Block，并用微任务合并同轮更新。
evaluator 重算值、Block reconcile 计算增删移动，组成 RenderIntentTransaction。
C++ Core按 Binding/Block ID 寻址并更新唯一 Runtime Tree，增量布局后生成 MountTransaction；Platform 消费指令，更新原生控件。


# 0907

todo task：

1.nyrax

三大件 + toolkit
二级部件
核心技术原理：quickjs 虚函数 FFI JNI OC桥接 yoga lvgl 嵌入式 裁剪
vela quickapp 框架
hap框架
IDE 调试工具 toolkit
负载分析平台：前后端全栈 + OS可观测体系
这是第一遍：

1. 我来主导 遇到卡点 问你
先看三大件：渲染管线：先看首帧渲染
rpk加载 - module loader： 先执行下统一的js fraework，注册一些cpp定义的函数runtime service到全局（应该是走external func 吧）
加载manifest：获得应用元信息 + 路由信息 + 注册路由表在core侧，知道首页
加载appjs：define app的依赖到js侧的依赖表中（依赖表放在cpp侧的话好吗） + bootstrap注册一些app的生命周期函数 - 还做了什么？
加载首页：
1. 根据page ir 建立 静态模版树在cpp侧内存
2. define 页面的依赖到js侧依赖表 + bootstrap：注册生命周期函数 + proxy劫持状态 + block：动态节点计算 + binding表建立：bingding表谁建立，key value是？+ flush微任务定义和注册？
3. 页面这里还做了什么？ module export了什么？什么时候export的？伴随eventloop调度， 注册到microTask的flush被执行？sendRenderTransaction 走 bridge通道，runtime service 到达core层 ？这组renderTransaction怎么得到的？里面都有什么？
4. core层收到后，根据静态模版树 + 第一次的renderIntentTransaction事务信息，建立runtime tree， 然后发送第一次mountTransaction到达平台侧
5. 平台得到指令后，按照自己的节奏来消费这批指令，平台需要给core什么反馈吗？


