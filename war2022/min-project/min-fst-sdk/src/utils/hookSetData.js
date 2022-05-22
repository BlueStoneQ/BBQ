/**
 * hook setData方法
 * @param {object} instance 被hook的页面/组件实例 
 * @param {Function} injectFn 注入的方法
 */
const hookSetData = function (instance, injectFn) {
    // TODO: defend
    const originalSetData = instance.setData;
    // 重新定义setData 调用是在页面或者组件中setData时
    instance.setData = function (data, callback) {
        // this 就是是instance
        originalSetData &&
            originalSetData.call(this, data, () => {
                try {
                    injectFn && injectFn();
                } catch (error) {
                    console.log();                    
                }
                callback && callback();
            });
    }
}

export default hookSetData;