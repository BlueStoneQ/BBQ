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