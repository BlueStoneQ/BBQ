# desc
A router based on history that is originate from H5.
用h5 history实现一个前端Router.

# 原理
1. 前端路由的一个特点就是：无刷新，也就是页面内的跳转是无刷新的（也就是SPA的原理);
2. h5 history的popstate事件，天然地为我们实现了对路由变化的监听，不需要我们自己实现事件监听模式了,但是基于路由变化的回调需要我们自己去实现并在popstate的监听中实现;
3. 因为SPA来来回回有很多跳转，所以，对history的需求很多；
3. history 也使得我们不需要自己实现history了；
3. 其实关于路由的功能设计应该有统一的接口层，让hash router和h5 router提供同样的使用；
4. **hash的改变不会引起浏览器刷新，同样，h5 history提供的pushState/replaceState 也提供无刷新地改变地址栏（非协议、域名、端口部分）的作用**
