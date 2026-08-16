# JS Runtime 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. 合同级验收](#3-合同级验收)
- [4. Case 验收](#4-case-验收)
- [5. 资源与异常验收](#5-资源与异常验收)
- [6. 证据](#6-证据)

## 1. 结论

JS Runtime 的完成标准是：**在没有 VNode Tree 和平台对象的前提下，正确执行联盟 App/Page 动态语义，并只向 Core 发送必要、合法、可关联的增量消息。**

## 2. 总 Spec 通过条件

- Engine、Module、VM、Reactive、Handler 和 ABI 所有权唯一。
- 初始渲染、增量更新、事件、能力和销毁均有完整输入输出。
- microtask 只承担批量 flush 调度，不被误写成跨层事务成功语义。
- 每项公共 ABI 都由一个分 Spec 接住，没有通用 JSON Bridge。
- 不持有 NodeId、NativeHandle 或 Runtime Tree 镜像。
- 公共 JS 目标不依赖 Platform、Backend 或可选 Provider，外围选择不产生第二条 Bridge。
- Fake Engine 与 QuickJS Provider 通过同一 `JsEnginePort` 合同；Framework 不引用 QuickJS 类型。

## 3. 合同级验收

| 合同 | 必须证明 |
|---|---|
| Module ABI | define/bootstrap/require、moduleId、依赖和 cache 语义正确 |
| Engine Service | eval/module/call/microtask/value/exception/GC 合同一致；Engine ABI 不匹配启动失败；一个 Composition Manifest 只选择一个 Engine module |
| Verified Load | 未经 Core verified handoff 的路径/bytes 不可执行；page export 必须与 expected ID 集合一致；loaded/failed 只完成一次 |
| Lifecycle | AppContext/SurfaceContext、VmInitializationDispatch/Result、LifecycleDispatch/Result 和全部 Hook 次数与顺序正确；初始化失败不靠超时、不发送 Instantiate |
| Initial | onInit/onReady 写入并入首个 Instantiate，不提前发 Render |
| Reactive | 同步写入合并一次 flush，只求值受影响 evaluator |
| Render | Revision、单在途、Owner + Template ID 和 Result 处理正确；Binding/Handler 不提交 LogicalNodeRef，仅 Block parent 与 Event Dispatch 使用 LogicalNodeRef |
| Event | HandlerId 是绑定级身份；retiring 仍执行提交前已路由事件，rejected/cancelled 时恢复，presented/presentationFailed 时释放；released 丢弃晚到事件 |
| Capability | router push/back、prompt/device typed Facade、supports、Promise/callback 和错误映射正确 |
| Destroy | Page/App 资源、pending request 和晚到回调被安全清理 |

## 4. Case 验收

### 4.1 Case 001

- App 和页面 Bundle 正确加载且 Shared module 不重复执行。
- `system.fetch` import 可解析，`supports=false`，focused 调用立即 rejected `CAPABILITY_UNSUPPORTED` 且 Fake Core 未收到请求。
- `onDetailBtnClick` 只由对应 HandlerId 执行一次。
- router、prompt 和 Page Control 不经过通用反射 Bridge。
- 导航页面拥有独立 Page VM，销毁后无法收到旧事件。

### 4.2 Case 002

- 一次 Handler 内多次同步 state 写入只产生一次 Dirty flush。
- `count` 只产生一个必要 `updateBinding`，不携带 target/property descriptor。
- `visible` 产生正确 Block instantiate/remove。
- `[a,b] -> [b,a]` 复用 BlockInstanceId 并产生 move，不删除重建。

### 4.3 BLOCK-001

- keyed add 只创建新 BlockInstance/Handler；已有 key 身份不变。
- keyed remove 的 Handler 先 retiring，事务提交后释放；rejected/cancelled 时恢复 live。

### 4.4 CAP-DEVICE-001

- 独立 fixture 的 Manifest 声明 `system.device`，typed Facade 调用 `getInfo`；不得由 Case 001 代替。
- success Result 包含全部 required fields，尺寸/density 语义正确，不包含设备唯一标识。
- unsupported/failed 返回对应 typed error；Surface/App 销毁后 Promise、callback 和 pending request 清零。

## 5. 资源与异常验收

- evaluator 或 Handler 抛异常返回 `JS_EXCEPTION`，后续独立事件仍可执行。
- Core 拒绝 Render 后 JS 不自行假设 committed Revision 已前进。
- RemoveBlock 被拒绝或取消后旧 Handler 恢复 live；已提交后旧 Handler 永久失效。
- Surface 销毁后 Handler、Binding、Block、VM、Promise/callback 计数归零。
- AppRuntime 销毁后所选 Engine Provider 资源和 Module Cache 释放，无跨 App 泄漏；QuickJS V1 Provider 给出对应资源证据。

## 6. 证据

- Fake Core ABI 正例与负例测试。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` Runtime ABI/Render/Capability Golden。
- Lifecycle/Event/Dirty/Result Trace。
- Noop/Recording 观测运行相同输入时，JS Result、Render operations、Handler 和异常行为一致；Marker 使用单调整数纳秒。
- 销毁前后 JS heap、Registry 和 pending request 计数。
- malformed Bundle/export/typed message 的拒绝记录。
- 公共构建目标的依赖清单，证明无平台或可选外围反向依赖。
- Fake Engine/QuickJS Provider 合同结果、Engine ABI 负例和单 Engine 链接清单。
