/**
 * hook 生命周期
 * @param {object} instance 被hook的页面/组件实例 
 * @param {string} lifetiumeName 需要被hook的生命周期的方法名
 * @param {Function} injectFn 注入的方法
 */
const hookLifetime = function (instance, lifetiumeName, injectFn) {
    // 暂存旧的生命周期方法
    const originalLifetime = instance[lifetiumeName];
    // 重新定义生命周期方法 在其中 执行注入的逻辑 + 原来的生命周期方法
    instance[lifetiumeName] = function (...args) {
        try {
            injectFn && injectFn.call(this, ...args);
        } catch (error) {
            console.log()
        }

        // 这个代码块中的this 其实就是页面/组件实例
        originalLifetime && originalLifetime.call(this, ...args);
    }
}

export default hookLifetime;