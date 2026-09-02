## 页面首帧渲染

## update：状态驱动更新

## QA
### js侧渲染事务队列
- JS 侧通常有一个待提交渲染事务队列，但它不是长期队列，而是当前 EventLoop 批次内的合并缓冲区
```
- State 更新
-> 产生 BindingUpdate 等结构化指令
-> 放入 RenderIntentTransaction
-> render microtask flush
-> 一次提交给 Core
-> 清空缓冲区
```
和 MountTransaction 一样，都是结构化 typed command batch：
```
RenderIntentTransaction {
  surfaceId,
  revision,
  commands: Array<RenderIntentCommand>
}
```

跨 JS-C++ 边界时，当前实现通常通过 external function 的参数映射传递：
```
JS Object/Array
-> C++ typed struct
```
这属于边界转换，可能发生拷贝；不是把整批内容先变成字符串。只有跨进程、持久化或网络传输，才需要真正序列化。

### js-framework： 渲染事务队列
- 本质就是js侧的一个Array