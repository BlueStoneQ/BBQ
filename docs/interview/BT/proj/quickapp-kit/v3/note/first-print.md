# 首帧渲染：rpk和core互动方案
## 主链路
首帧渲染可按这条链路理解：

1. **RPK 加载**：Platform/宿主读取 RPK，解析 `manifest.json`，确定入口 `pages/Home`。
2. **模块启动**：JS Framework 注册并执行 `app.js`、页面 JS；`$app_bootstrap$` 请求启动页面。
3. **Page VM**：JS Framework 调用 `createPageVm(context)`，创建响应式 Proxy 页面对象。
4. **读取 Page IR**：C++ Core 加载对应 `index.ir.json`，获得节点、静态属性、Binding、动态 Block 和稳定 ID，即生成静态模版树。
5. **首帧求值**：JS Framework 计算初始 Binding，执行 `reconcileBlocks(true)`，生成初始块实例操作。
6. **提交意图**：JS Framework 将初始属性和块操作封装为 `RenderIntentTransaction`，提交给 C++ Runtime Service/Core。
7. **构建 Runtime Tree**：Core 按 ID 创建唯一 Runtime Tree，绑定节点属性和事件处理器。
8. **布局与挂载**：Core 运行 Yoga/Layout，生成 `MountTransaction`。
9. **平台渲染**：LVGL/Android/iOS 后端消费 MountTransaction，创建原生控件并设置属性，首帧显示。