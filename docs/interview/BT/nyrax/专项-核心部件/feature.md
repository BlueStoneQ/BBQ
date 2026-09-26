## 现状
设计：一个feature 对应一个 external func
实现：AI偷懒，时间紧没有check到，后续升级external func feature
对比：设计比当前实现（类hapz这种序列化统一分发）更优的点：
    - 同步能力真同步(直返)
    - 异步靠直接持有的回调句柄(而非 id 查表)
    - 粒度是对象/方法级直接暴露,没有统一分发器这层。 
这正是 TurboModule/JSI 相对老式 bridge 的进步——nyrax 本该是这个,被 AI 退回成了统一分发。