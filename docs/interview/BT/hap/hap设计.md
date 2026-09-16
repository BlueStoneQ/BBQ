## 总述
【总】一句话结论
hap 是"JS 算、Java 建"的双线程架构：应用 JS 跑在独立 JS 线程的 V8 里，通过 J2V8 同步 bridge 把增量 DOM 动作下发到主线程，主线程把动作应用成 Android View 树。JS 出意图，Java 是渲染权威。

【分】五个部分，按数据流顺序
【分】按数据流顺序五段
1. JS 引擎与线程（js独立线程） —— V8 在独立线程 JsThread（HandlerThread）里跑 V8（J2V8）。框架 infras.js 和页面 JS 都在这线程执行，createPage 经 v8.executeVoidFunction 起页面。JS 全在 JS 线程，不碰 UI 线程。

Q： 线程架构：几个线程？通信方案？
A：  - 线程架构 —— 三个线程 + 消息队列通信
    - hap 是三线程（我之前说双线程漏了中间那个）：
        - JS 线程（JsThread extends HandlerThread）：跑 V8/J2V8，应用 JS 全在这。
        - RenderAction 线程（RenderActionThread）：解析 DOM 动作、维护 RenderAction 树、组包。JS 下来的动作先在这加工。
        - UI 主线程：RootView.applyActions 把动作应用成真实 Android View。
    - 通信方案 —— 全靠 Handler 消息队列（HandlerThread 那套），不是共享内存

Q： 拆分js在一个独立线程的收益和代价？一句话说清？
A：收益：JS 执行（用户逻辑、响应式计算）不阻塞 UI 渲染，反之亦然，各跑各的不互相卡顿；
代价：JS↔渲染从同线程直调变成跨线程消息投递，多了排队/异步延迟和"JS 引擎必须始终单线程访问"的约束。

Q： 多线程架构收益和成本？
A：收益：把 JS、布局/渲染加工、UI 应用拆到不同线程并行流水，任一环的重活不拖垮其他环，吞吐和响应更好；
成本：跨线程消息带来延迟和时序复杂度、每个状态必须锁定单一 owner 线程（靠线程断言强制）、调试和一致性维护更难——本质是拿"复杂度和延迟"换"不互相阻塞"。

2. Bridge（类JSI） —— J2V8 同步直调 JsBridge 向 V8 注册同步方法 callNative。JS 改界面就调它，把一批 DOM 动作传下来。同步、免 JSON——V8 对象直接过，不字符串化。

3. 渲染指令 —— 增量动作流 RenderActionManager 收 callNative 的动作 → RenderActionParser 解析成 VDomChangeAction（createBody/addElement/updateAttrs/removeElement 这类增删改动作）→ 打包成 RenderActionPackage 投递给主线程。JS 侧算好增量，下发的是动作，不是整棵树。

- 增量渲染意图是在js侧产生的吗？

4. 消费与建树 —— 主线程应用动作 RootView 在主线程 applyActions，把动作作用到 VDocument（那棵权威节点文档树）。VDocument 里每个节点是一个 Component，Component.createViewImpl 产出真实 Android View。Yoga（YogaLayout ViewGroup）挂在这棵常驻树上算 flex 布局。

5. 能力 —— Feature/Bridge ExtensionManager / FeatureBridge 反射注册系统能力（网络/存储/设备），同样经 bridge 暴露给 JS 调。

- 这里必须使用反射吗？怎么使用的？一个最小例子？

【总】收束
一条链：JS 线程 V8 跑应用 → 响应式（js侧？）算出增量 → callNative 同步下发 VDomChangeAction → 主线程 RootView 应用到 VDocument → Component 建 Android View + Yoga 布局。 两个关键定性：双线程（JS 算 / 主线程渲染）、权威在 Java 侧（VDocument + Component + View 都在 Android，一平台一套）。这正是 nyrax 后来把"权威树下沉到平台无关 C++ Core"所针对的起点。

## note
1. hap布局采用了 yoga的官方AAR
2. 采用了 yoga本身内建的增量：
    布局 diff（谁的尺寸/位置要重算）：这个避不掉，Yoga 内部自己做。Yoga 有 dirty 标记机制——改了某节点的 style，markDirty 那条链上的节点重算，没脏的跳过。hap 靠的是 Yoga 自带的脏标记增量布局（Yoga 库本身支持）。所以 hap 的布局不是全量，是 Yoga 内建的增量。
3. nyrax 相对 hap 的核心架构进步：把这棵权威树从"平台内"抽到了"平台无关 Core"。hap 是"每个平台各有一棵和自己 View 绑的树"，nyrax 是"一棵平台无关的树 + 各平台薄镜像"。
4. hap 的 Yoga 增量为什么天生就有：因为它的 VDocument/Component 树本来就常驻在 Android 里、和 View 生命周期绑着，Yoga 节点挂在这棵常驻树上，自然能跨帧复用拿到增量。nyrax 把树抽到无状态 Core，代价就是丢了这份"天然常驻"，得自己补 Yoga 常驻——这就是上一题说的那个演进工作量的根源。