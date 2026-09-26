### renderAction格式
### rednerAction解析
### 事件系统
- 还是ID寻址
    - pageID + nodeID + eventName
- ID维护在js侧
```md
Native View 点击
→ View 持有 nodeId
→ RootView/页面上下文补上 pageId 和 eventName
→ 事件数据回到 JsThread
→ JS Framework 通过 pageId 找 Page
→ 通过 page.doc._nodeMap[nodeId] 找 JS 节点
→ 节点按 eventName 找 handler
→ 执行 handler
```
- HAP 事件回传也是 id → 节点 查表，不是遍历 Runtime Tree
```md
Nyrax 把这种 ID 寻址进一步提升为全局核心模型，并让节点、绑定、事务都围绕 ID 组织；HAP 只是局部在事件系统里维护 ref → node 查表，因此 Nyrax 的设计更统一、更精简,避免设计的碎片化和理念的不统一。

- HAP 事件寻址：pageId → Page → nodeId/ref → page.doc._nodeMap[ref] → JS 节点 → eventName → handler。
- 是否遍历树：不遍历 Runtime Tree；树只保存父子关系，_nodeMap 负责 O(1) 节点定位。
- 映射位置：JS Framework 的 Document 维护 ref → node 表；Native View 保存对应 nodeId。
- 本质：HAP 是局部的 ID 查表机制，主要服务事件回传。
- Nyrax 优势：把 ID 寻址提升为全局核心模型，节点、绑定、事务统一围绕 ID 组织，结构更收敛。
```
### 线程模型
- 一共几个线程在工作，一次渲染几个线程之间的数据流动flow链条是怎样的呢
- 三线程模型：
```
[JS 线程]  数据变 → 响应式(Proxy)算出增量 → 产出 DOM 动作
   │  callNative（J2V8 同步 bridge；渲染指令（renderAction）序列化成 JSON 字符串过桥）
   ▼
[RenderAction 线程]  收 JSON 字符串 → 反序列化 → RenderActionParser 转成 VDomChangeAction
                     → 入 action queue，flush 时组包成 RenderActionPackage
                     （另维护 RenderActionDocument：按 id 索引节点，供 CSS 媒体查询/样式更新用，非渲染主树）
   │  post 到主线程消息队列
   ▼
[UI 主线程]  RootView.applyActions → 作用到 VDocument（渲染权威树）
             → Component.createViewImpl 建/更新 Android View
             → Yoga 脏标记增量布局
 
```

### 路由系统
- 页面栈由 Android Runtime 的 PageManager 管理
### feature系统
- HAP 注入的是一个统一的 invoke 入口，再按 featureName + methodName 分发到具体 Feature：
- promise/async feature如何实现
    - 这里的feature就不是external func（和RN不一样） ，而是用external func invoke 分发出去的 methodName + params + callback，callback调用直接就是jsEngine.exec(js.execCallback(callback))
    - 也就是 native侧只处理callback， promise是js侧包装支持的
```
真正注入到 JS Engine 的不是每个 Feature 方法，而是统一的 external invoke 函数。
methodName + params + callbackId 是统一调用协议。
Native 回调时不是拿一个可直接执行的 JS 函数对象，而是把 callbackId 带回 JS，JsThread 再执行类似 js.execCallback(callbackId, result) 的 JS 回调入口。
Promise 由 JS 侧根据这个 callback 协议封装。
```
- 本质：一个通过 J2V8 注入的统一 external invoke 分发器，参数和回调句柄经过 JNI 传递，异步结果再回到 JS，由 JS 包装成 Promise。