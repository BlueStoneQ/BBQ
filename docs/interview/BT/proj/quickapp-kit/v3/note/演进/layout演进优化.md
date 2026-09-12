## 现状
- 时间原因，目前yoga layout 是全量从runtime tree 给yoga构造（set）yoga input tree
- 然后 yoga全量 生成新的 layout tree

## 演进方向：局部update
核心判断：**要做局部布局，必须常驻 Yoga Layout Tree；但不必每次遍历整棵 Runtime Tree 找节点。**Core 在建树时保存 `RuntimeNode ↔ YogaNode` 映射（通常是指针、句柄或实例 ID），RenderIntent 按 ID 直接定位节点。

最小链路：

```text
RenderIntent
→ Core 按 NodeID 找 RuntimeNode/YogaNode
→ 更新布局属性
→ 标记 YogaNode dirty（Core 也可维护 dirty 集合）
→ 向上找到最近的布局边界/受影响祖先
→ 对该 YogaNode 子树调用 calculateLayout
→ 回写受影响节点几何值
→ 比较旧值并生成 MountCommand
```

不一定要临时构造子树；Yoga 可以从某个 root 计算，但子树的结果受父节点约束，所以通常从**最近布局边界**计算，而不是任意叶节点。Yoga 输入主要是父子关系、width/height、padding、margin、flexDirection、justify/align 等布局属性；输出是每个节点的几何结果。