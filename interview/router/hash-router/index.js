/**
 * hash 路由
 * 1. 理解路由模型的组成/本质：
 *  1）routes - 对象
 *  2） currentUrl - 字符串
 *  3） history - 数组
 */
class Router {
  // 路由基本数据结构
  constructor () {
    this.routes = {};
    this.currentUrl = '';
    this.histroty = []; // 模拟H5的history：用一个数组记录出现过的hash
    // 用来读取/操作history的指针（下标），根据前进/后退来指定history中的不通hash
    this.currentIndex = this.histroty.length - 1; 
    // 初始化 
    // 监听浏览器部分事件：增加与浏览器行为的联动
    window.addEventListener('load', this.refresh, false);
    window.addEventListener('hashchange', this.refresh, false);
  }
  // 订阅：用相应的回调函数callback订阅对应的path
  route(path, callback) {
    this.routes[path] = callback || function() {};
  }
  // 功能：刷新
  refresh() {
    // 获取当前路径中的hash路径
    this.currentUrl = location.hash.slice(1) || '/';
    // 对history的同步
    this.histroty.push(currentUrl);
    this.currentIndex++;
    // 用该hash为索引去触发routes中对应的回调
    this.routes[currentUrl]();
  }
  // 后退功能
  backOff() {
    // 同步this.currentIndex
    this.currentIndex = this.currentIndex <= 0 ? 0 : this.currentIndex - 1;
    this.currentUrl = this.histroty[this.currentIndex];
    // 同步location.hash
    location.hash = `#${this.currentUrl}`;
    // 触发对应路由订阅的事件
    this.route[this.currentUrl]();
  }
}
