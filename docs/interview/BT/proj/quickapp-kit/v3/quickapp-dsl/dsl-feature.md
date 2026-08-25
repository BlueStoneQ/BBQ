1. **组件**
   - [快应用组件参考文档](https://doc.quickapp.cn/widgets/)
   - 组件按容器、基础、表单、媒体、画布等分类。
   - 常用组件包括：
     - 容器：`div`、`list`、`list-item`、`stack`、`scroll`、`swiper`
     - 基础：`text`、`image`、`a`、`progress`、`marquee`
     - 表单：`input`、`label`、`picker`、`slider`、`switch`
     - 媒体/扩展：`video`、`audio`、`web`、`canvas`、`popup`、`drawer`
   - 官方组件索引也包含通用属性、事件、方法和样式。[组件文档](https://doc.quickapp.cn/widgets/common-events.html)

2. **框架和 DSL**
   - [框架参考文档](https://doc.quickapp.cn/framework/)
   - [UX 文件](https://doc.quickapp.cn/framework/source-file.html)
   - [Template 模板](https://doc.quickapp.cn/framework/template.html)
   - [Style 样式](https://doc.quickapp.cn/framework/style-sheet.html)
   - 重点看：
     - `template`
     - `style`
     - `script`
     - 数据绑定
     - `if / elif / else`
     - `show`
     - `for + tid`
     - 事件绑定
     - 页面生命周期
     - 路由

3. **Feature / 系统接口**
   - [系统接口总览](https://doc.quickapp.cn/features/)
   - [路由 router](https://doc.quickapp.cn/features/system/router.html)
   - [网络 fetch](https://doc.quickapp.cn/features/system/fetch.html)
   - [存储 storage](https://doc.quickapp.cn/features/system/storage.html)
   - [媒体 media](https://doc.quickapp.cn/features/system/media.html)
   - [设备 device](https://doc.quickapp.cn/features/system/device.html)
   - [分享 share](https://doc.quickapp.cn/features/system/share.html)
   - [文件与下载 request](https://doc.quickapp.cn/features/system/request.html)
   - [弹窗 prompt](https://doc.quickapp.cn/features/system/prompt.html)

对我们最重要的联盟基线是：

```text
组件：
View/Text/Button/Image/Input/List/Scroll/Swiper

框架：
数据绑定
if / elif / else
show
for + tid
事件
页面生命周期
路由

Feature：
router
fetch
storage
media
prompt
request/file
camera/recorder/album
```

需要注意：联盟文档里的 **组件** 和 **Feature** 是两类东西。

- 组件：进入 Runtime 渲染管线，最终对应 Core Runtime Tree 和平台 Host View。
- Feature：通过 JS API 调用，经 Bridge 到 Core Feature Registry，再由 Android/iOS/LVGL 等平台 Provider 执行。

联盟文档明确说明：快应用使用数据驱动视图更新，组件包括 `div`、`a`、`input` 以及 `switch`、`slider`、`list` 等；系统接口采用 `manifest.json` 声明，并通过 JS 模块导入调用。[框架简介](https://doc.quickapp.cn/framework/)

对 QuickApp Kit 来说，当前不应该一次性照搬全部目录。建议按这个顺序吸收：

```text
第一批组件：
View/Text/Button/Image/Input/List/Scroll

第一批框架能力：
state
if
for + tid
click
router.push/back
页面生命周期

第一批 Feature：
router
prompt
fetch
storage

第二批 Feature：
media
camera
recorder
album
request/file

后续：
share
webview
map
video/audio
canvas
animation
AI
```

其中联盟 `router.push()` 官方定义为页面栈跳转，`router.back()` 返回上一页或指定已打开页面；`fetch`、`storage`、`media` 等接口都采用 `manifest` 声明加 JS 模块调用的模式。[router](https://doc.quickapp.cn/features/system/router.html)、[fetch](https://doc.quickapp.cn/features/system/fetch.html)、[media](https://doc.quickapp.cn/features/system/media.html)