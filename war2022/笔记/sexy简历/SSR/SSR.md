## 资料
- [SSR-React](https://youle.zhipin.com/articles/9381b2049a7d3a5cqxB73du6EQ~~.html)


### hybrate
- react-dom：hydrate
实现同构的另一个核心 API 是 React-dom 下的hydrate，该方法能在客户端初次渲染的时候去复用服务端返回的原本已经存在的 DOM 节点，于渲染过程中为其附加交互行为（事件监听等），而不是重新创建 DOM 节点。需要注意是，服务端返回的 HTML 与客户端渲染结果不一致时，出于性能考虑，hydrate 可以弥补文本内容的差异，但并不能保证修补属性的差异，而是将错就错；只在 development 模式下对这些不一致的问题报 Warning，因此必须重视 SSR HydrationWarning，要当 Error 逐个解决。