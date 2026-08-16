# Runtime Core 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. 合同级验收](#3-合同级验收)
- [4. Case 验收](#4-case-验收)
- [5. 平台无关验收](#5-平台无关验收)
- [6. 证据](#6-证据)

## 1. 结论

Core 的完成标准不是“能生成一棵树”，而是：**同一份 Core 在 Android 与 LVGL/SDL 上，把合法 Artifact、JS 意图和平台输入闭环为一致状态、行为与 Trace。**

## 2. 总 Spec 通过条件

- Package、Lifecycle、Surface、Tree、Render、Layout、Mount、Event、Navigation、Capability 均有唯一所有者。
- 每个公共输入和输出都被一个分 Spec 接住，没有平台类型泄漏。
- 失败路径覆盖“提交前失败、提交后 Mount 失败、Present 失败、销毁中晚到消息”。
- Core 与 JS/Platform 之间没有同步跨线程等待。
- LVGL/SDL 首集成不向 Core 泄漏平台类型；Android 随后复用同一 Core，证明其独立工程归属与平台无关性。

## 3. 合同级验收

| 合同 | 必须证明 |
|---|---|
| Artifact | 非法路径、版本、关系、IR、哈希在 JS 执行前失败；只有 verified module bytes 可交付，expected export 与 loaded/failed Result 可关联 |
| Runtime Composition | 固定 Kernel 六模块始终存在；Profile 缺少 Page IR Component 或 Manifest Capability 时，在 JS 执行前返回 `RUNTIME_PROFILE_INCOMPATIBLE` |
| Lifecycle | AppContext、VmInitializationDispatch/Result、LifecycleDispatch/Result、Host Control 均为 typed message；初始化失败立即闭环，`onReady` 早于 Present，`onShow` 晚于 Present；前后台请求串行，background 固定为 Host hidden -> Core commit -> Page/App `onHide`，foreground 固定为 Host visible -> Core commit -> App/Page `onShow`，忙时返回 `LIFECYCLE_BUSY` |
| Render | Revision 原子、无完整树 Diff、非法操作不部分提交 |
| Mount | full/incremental 语义正确，Move/Remove 保持身份和递归清理 |
| Event | 点击只路由到 live Handler，冒泡目标正确；Render 删除回滚恢复 Handler，提交后晚到事件被丢弃 |
| Navigation | push 失败不隐藏 source，成功后才提交栈；close 只接受非 Root 栈顶且 Host 成功后才 pop/reveal |
| Capability | not-declared/unsupported/failure/success 可区分；权限 deny 后置 |
| Measure | 同步 measured/failed、generation 变化与非法 metrics 可验证；不等待 UI Thread，失败不产生部分 Mount |
| Destroy | JS、Core、Host、Handler 和在途请求全部终止或释放 |
| Observation | Noop/Recording Sink 行为等价；整数纳秒单调；Bridge/主链路/错误/降级 Marker 与 Node/Handler/Surface/Queue 计数符合公共 Schema |

## 4. Case 验收

### 4.1 Case 001

- App/Page 生命周期顺序符合全局合同。
- 首屏 Runtime Tree revision 为 `0`，full Mount 后 Present 才成功。
- Click 经 `NodeId -> HandlerId` 只分发一次。
- Router push 原子提交目标 Surface。
- prompt 和 Page Control 使用 typed 路由。
- 页面销毁后所有关联映射和请求清零。

### 4.2 Case 002

- `count` 只更新目标 prop。
- `if` 正确 Instantiate/Remove Block。
- keyed reorder 保持 BlockInstanceId、NodeId 和 NativeHandle 身份，并生成 Move。
- 同步状态写入合并；同一 Surface 保持单在途 Revision。

### 4.3 BLOCK-001

- keyed add/remove 只修改唯一 Runtime Tree 的目标 Block；remove 递归清理 Node/EventBinding。
- 提交前失败保持旧 Block/EventBinding，提交后旧 BlockInstanceId/NodeId 不可再寻址。

### 4.4 CAP-DEVICE-001

- 独立 fixture 通过 Manifest declaration、Registry descriptor 和 typed Invoker 调用 `system.device.getInfo`。
- success Result 保留 required fields、物理像素/density 语义且无设备唯一标识。
- not-declared/unsupported/failed 可区分；Surface/App 销毁取消 pending request 并丢弃晚到 Result。

## 5. 平台无关验收

1. Core 公共构建无需 Android、UIKit、LVGL 或 SDL 头文件。
2. 使用 Fake Platform 可完整运行首屏、更新、事件、导航和失败恢复状态机。
3. Android 与 LVGL/SDL 链接同一 Core 工程和同一 Runtime ABI。
4. 两个平台行为差异只能存在 Host 映射和 metrics，不得改变 Core 状态机。
5. Core 依赖图不指向 Platform、Backend、可选 Provider 或诊断实现；Kernel 代码无外围条件编译分支。

## 6. 证据

- Core 单元和状态机负例报告。
- Fake JS/Platform 的合同集成测试。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 三平台 Trace。
- Runtime Tree/Handler/Surface 销毁前后资源计数。
- Mount 失败与 full rebuild 的注入记录。
- Noop/Recording TraceSink 等价性、OOM/队列溢出/full rebuild Marker 和计数器 snapshot 记录。
- Runtime Composition Schema 正负例、Kernel 依赖检查和 `PROFILE-MISSING-001` 预检记录。
