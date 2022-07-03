/**
 * 简单实现一个Virtual DOM
 * 2022-6-22
 * https://mp.weixin.qq.com/s/w2b9Wn7QWXhy2qf2JX3Kbw
 * 
 * https://segmentfault.com/a/1190000004029168
 *  - [一个简单的diff库](https://github.com/livoras/simple-virtual-dom/blob/master/README.md)
 * 
 * 注意：
 * 1. el不能是body或者html，原因是vue在挂载是会将对应的dom对象替换成新的div，但body和html是不适合替换的。
 * 2. 这里应该是主流程
 * 3. 以vue为例：vue运行时的主流程其实有2条：
 *  - 初始化
 *  - update
 * 4. 实现顺序：element.js -> diff.js -> patch.js
 */


// test