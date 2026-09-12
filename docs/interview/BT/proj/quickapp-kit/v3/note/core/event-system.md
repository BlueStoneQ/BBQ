## 事件寻址
Platform View 点击
-> 上报 SurfaceId + NodeId + EventType + Payload
-> Core EventRouter 查找 NodeId 的事件绑定
-> 得到 HandlerId
-> Core 提交 EventDispatch 给 JS Runtime
-> JS 侧 Map<HandlerId, Function>
-> JS Engine Call(Function, EventPayload)