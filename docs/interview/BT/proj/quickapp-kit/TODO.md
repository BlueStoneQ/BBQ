内核稳定、外围可裁剪、移动端能力完整、嵌入式运行时轻量

## 总述
```
QuickApp Kit 是基于稳定 Contract 的平台无关运行时：以可裁剪外围围绕稳定内核组织，C++ Core 维护唯一 Runtime Tree，将核心状态、布局和渲染算法下沉，通过 NodeId 等 typed ID 驱动渲染，并以 external function 形式完成 JS 与 Core 的低开销通信，避免传统 Bridge 的重复序列化和 Diff 成本。
```
1. 核心特征：
    - Contract 定边界
    -> 稳定 Core 定语义
    -> 单一 Runtime Tree 定状态
    -> ID 定位节点
    -> Core 下沉算法
    -> Platform Adapter 做执行
    -> 外围模块按设备裁剪

2. 核心特征me：
- 基于contract 平台无关
- 稳定内核
- 外围可裁剪
- 单一runtime tree
- 核心基座算法下沉到core
- bridge走externalfunc，避免传统bridge的序列化等开销
- 渲染管线：基于id驱动渲染，避免大范围diff开销

- QuickApp Kit 不维护传统意义上的新树/旧树，因此没有传统的整树 Diff；更新本质是“按 ID 定位已有节点，执行显式操作”。

## 大纲路线

1. 核心组件
2. 核心feature
3. 样式对齐
    - 核心布局：flex布局
    - 核心样式
4. example
    - android/IOS
        - 更像小程序，面向C端
    - 嵌入式
        - 时钟 表盘之类的
        - 优先看下表盘 手环的形状
4. AI专题：应用 + 组件 + feature
5. 包装


1. 一致性最小门禁
2. Input 三端收口
3. Switch
4. Slider
5. Picker
6. List + Scroll
7. prompt/fetch/fileAI-EXECUTION-PLAN.md
8. Android/iOS Video
9. openUrl + system.webview
10. 三端 capability RPK 验收与包装


## 核心组件
https://doc.quickapp.cn/widgets/list.html
1. Input 三端最终验证
2. Switch
2. list
3. Slider
4. 基础 Picker
5. video（android/IOS）
6. webview


## 核心feature
https://doc.quickapp.cn/features/system/fetch.html
- prompt
- fetch
- file
- openUrl
    - 可以配置跳转到 外部默认浏览器 还是 内置的webview， （android/ios）， 或者deeplink



## AI专题：
融入AI，很重要：
- 例如AI组件：chat组件 语音chat组件
- feature：获取录音，获取摄像头，获取相册，网络，这几个feature比较重要
- AI agent引擎，但是这个引擎后续会用rust作为外围，用so或者a来集成，走feature（bridge），内核我认为管的事情应该就是我们现在的，bridge feature 渲染管线核心等


- 提供service + surfaceView：服务于后续ai chat card：对话中生成
- AI Feature：平台无关 typed API，Provider 可插拔。
- Chat 组件：基于标准组件组合实现，后续再判断是否需要原生 Host Component。
- AI Chat Card：将 QuickApp Surface 作为 AI Chat 中可嵌入、可交互、可管理生命周期的卡片形态。
- AI Skills：面向 Agent 暴露 QuickApp Kit 的 build、inspect、run、observe 能力。
- MCP Interface：以 typed Tool 暴露 QuickApp Kit 构建、检查、运行和观测能力。
- Toolkit Skill/MCP：作为 Toolkit Application Service 的薄适配，只暴露 build、inspect、run。
- VS Code 插件与 Agent 应用生态：扩展 create、validate、debug、bench、能力发现和应用生成。
- Release 安全：RPK 签名、PackageOpenPolicy、信任链和分发治理。
- 完整 Benchmark：统一数据集、统计模型和外部框架公平对比。
- 完整 Capability/插件体系：权限策略、IDL/Codegen、动态 Provider、版本协商和运行时卸载。
- 高级恢复：多级 Surface 恢复、进程级容灾和完整故障组合矩阵。
- 扩展渲染能力：动画、复杂文本、完整字体排版、Widget/Card 和更多 Host Component。
- 页面栈资源策略：V1 主链跑通后再冻结公开语义、内部上限、错误映射与平台容量配平。
