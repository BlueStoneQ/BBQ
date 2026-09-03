## 示例
- [page.js](example/case1/tk-s12-lvgl-p0/pages/pages/Detail/index.js)

## 状态拦截：基于proxy
`target` 就是页面原始对象，也就是 `.ux` 中 `<script>` 导出的页面定义实例。

```js
{
  title: "首页",
  onInit() {},
  onBack() {
    router.back();
  }
}
```

`Proxy` 不创建另一套业务对象，而是包住它：

```js
proxy = new Proxy(target, handler)
```

因此调用：

```js
pageVm.onBack()
```

实际读取的是：

```text
Proxy
-> target.onBack
-> 执行 router.back()
```

`target` 同时包含两类内容：

- 页面状态：`title`、`count`；
- 页面行为：`onInit`、`onBack`、点击处理函数。

Proxy 主要拦截状态属性写入；函数本身仍存放在 `target` 上。最终返回的 `proxy` 就是外部使用的 Page VM。

## __qak_reactive_page_vm__ 返回 proxy
- 这个proxy就是代理了整个页面的js实例，就是页面的script部分，是一个js对象，就是proxy了这个对象
- 后续对于这个js对象的读写都是经过proxy对象，就能拦截到set动作，知道哪个state变化了