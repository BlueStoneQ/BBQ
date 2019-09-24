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
    this.history = []; // 模拟H5的history：用一个数组（栈）记录出现过的hash
    // 用来读取/操作history的指针（下标），根据前进/后退来指定history中的不通hash
    this.currentIndex = this.history.length - 1; 
    // 开关：标识是否为后退行为: 默认操作不是后退行为
    this.isBack = false;
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
    if (!this.isBack) {
      // 非后退行为
      if(this.currentIndex < this.history.length - 1) {
        // 并且currentIndex没有指向history的栈顶
        // 我们把以currentIndex为界限把history进行截取并更新到this.history上
        // 此操作来避免当点击后退按钮之后,再进行正常跳转,指针会停留在原地,而数组添加新hash路由
        this.history = this.history.slice(0, this.currentIndex + 1);
      }
      // 对history的同步 - 如果是后退行为 就不用history入栈这个操作了
      this.history.push(currentUrl);
      this.currentIndex++;
    }
    // 用该hash为索引去触发routes中对应的回调
    this.routes[currentUrl]();
    // 恢复开关 迎接下一轮操作
    this.isBack = false;
  }
  // 后退功能
  backOff() {
    // 同步this.currentIndex - 这里之所以移动指针读取history给current,而不是直接对history进行出栈操作：因为除了后退，还有前进哈哈
    this.currentIndex = this.currentIndex <= 0 ? 0 : this.currentIndex - 1;
    // 同步location.hash
    location.hash = `#${this.history}`;
    // 后退标志打开
    this.isBack = true;
    // 刷新
    this.refresh();
  }
}
