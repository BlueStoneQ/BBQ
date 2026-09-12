1. hap布局采用了 yoga的官方AAR
2. 采用了 yoga本身内建的增量：
    布局 diff（谁的尺寸/位置要重算）：这个避不掉，Yoga 内部自己做。Yoga 有 dirty 标记机制——改了某节点的 style，markDirty 那条链上的节点重算，没脏的跳过。hap 靠的是 Yoga 自带的脏标记增量布局（Yoga 库本身支持）。所以 hap 的布局不是全量，是 Yoga 内建的增量。
3. nyrax 相对 hap 的核心架构进步：把这棵权威树从"平台内"抽到了"平台无关 Core"。hap 是"每个平台各有一棵和自己 View 绑的树"，nyrax 是"一棵平台无关的树 + 各平台薄镜像"。
4. hap 的 Yoga 增量为什么天生就有：因为它的 VDocument/Component 树本来就常驻在 Android 里、和 View 生命周期绑着，Yoga 节点挂在这棵常驻树上，自然能跨帧复用拿到增量。nyrax 把树抽到无状态 Core，代价就是丢了这份"天然常驻"，得自己补 Yoga 常驻——这就是上一题说的那个演进工作量的根源。