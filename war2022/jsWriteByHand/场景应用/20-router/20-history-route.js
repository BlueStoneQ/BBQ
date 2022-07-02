/**
 * 2022-6-25
 * hash实现前端路由
 * https://danielxuuuuu.github.io/2020/02/23/%E5%89%8D%E7%AB%AF%E8%B7%AF%E7%94%B1%E7%9A%84%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86
 * 
 * https://juejin.cn/post/6844903906024095751#heading-5
 * 
 * note：
 * - hash 和 history模式的区别
  - History 直接修改浏览器 URL，用户手动刷新页面，后端接受到是不同的地址，需要后端做处理跳转到统一的html页面。
    - 具体：但倘若我们手动刷新，或输入URL直接进入页面的时候， 服务端是无法识别这个 URL 的。因为我们是单页应用，只有一个 html 文件，服务端在处理其他路径的 URL 的时候，就会出现404的情况。 所以，如果要应用 history 模式，需要在服务端增加一个覆盖所有情况的候选资源：如果 URL 匹配不到任何静态资源，则应该返回单页应用的 HTML 文件
  基于hash的路由：
    看起来比较丑
    会导致锚点功能失效
  但：
    兼容性更好
    无需服务器配合
- hash
  - URL 中 hash 值只是客户端的一种状态，也就是说当向服务器端发出请求时，hash 部分不会被发送。
  - hash 值的改变，都会在浏览器的访问历史中增加一个记录。因此我们能通过浏览器的回退、前进按钮控制hash 的切换
  - hash中的replace实现：
    - window.locationl.replace(this.getUrl(path)) // 这里根据hash path生成新的完整url 然后replace location
- history 
  - history.pushState() 或 history.replaceState() 不会触发 popstate 事件，这时我们需要手动触发页面渲染；
 */

class HistoryRouter {
  constructor () {
    // route 到 callback的映射
    this.route2Callback = {}; 
    // 监听 load 和 popstate事件，在这2个事件中需要默认执行 当前route对应的callBack (callBack的emit实就在这2个事件中)
    window.addEventListener('DOMContentLoaded', this._handle); // load事件在这也可以的
    window.addEventListener('popstate', this._handle);
  }

  routeRegister (path, callback) {
    if (callback) {
      this.route2Callback[path] = callback;
    }
  }

  push (path) {
    // [关于state](https://www.tangshuang.net/2287.html)
    // 参数1： 第一个state部分 传递参数给监听了popstate的回调
    // 参数2: title 大部分浏览器会忽略 一般传null
    // 参数3: path 在浏览器的地址栏中显示的url
    history.pushState({ path }, null, path);
    // 因为pushState不会引起popstate事件 所以 这里需要手动调用handle
    this._handle({ state: { path } });
  }

  replace (path) {
    history.replaceState({ path }, null, path);
    // 因为replaceState不会引起popstate事件 所以 这里需要手动调用handle
    this._handle({ state: { path } });
  }

  _handle (event) {
    const { path } = event.state; // 这里的path就是刚刚在push中传递的
    const callback = this.route2Callback[path];
    callback && callback();
  }
}