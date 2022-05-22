import Sampling from "../sampling";
import hookLifetime from '../utils/hookLifetime';
import hookSetData from "../utils/hookSetData";

const init = function () {
    // 利用AOP的思想 重写Component 在Component 植入我们的逻辑 
    const originalComponent = Component;

    Component = function (componentObj) {
        // 工具函数：获取当前组件所在页面的pageId
        const _getPageId = function () {
            return this.getPageId() || this.__wxWebviewId__; // 当getPageId不支持的时候 可以用__wxWebviewId__这个内在属性尝试获取
        }
        // 工具函数：获得当前组件所在页面
        const _getCurrentPage = function () {
            try {
                return Sampling.getCurrentPage(_getPageId());
            } catch (error) {
                return null;
            }
        }

        const _hookSetData = function (componentObj) {
            const setDataInjectFn = function () {
                const currentPageInstance = _getCurrentPage.call(this);
                // 执行采样
                currentPageInstance.samplingInstance.sampling();
            }

            hookSetData(componentObj, setDataInjectFn);
        }
        // 在当前组件对象上 hook：attanched 在attanched中 hook - setData，为setData的callBack植入sampling逻辑
        // 1. 需要注入到attached生命周期中的逻辑
        const attanchedInjectFn = function () {
            // 这里的this 就是在生命周期中调用时的this 就是组件实例
            if (fstEnable.call(this)) {
                _hookSetData.call(this);
            }
        }
        // 2. 如果在lifetimes中定义了attanched 则会覆盖外层的attanched方法 优先级更高
        const originalLifetimesAttanched = componentObj.lifetimes && componentObj.lifetimes.attached;

        if (originalLifetimesAttanched) {
            componentObj.lifetimes.attached = function (...args) {
                // 执行注入逻辑
                try {
                    attanchedInjectFn.call(this);
                } catch(error) {
                    console.log()
                }
                // 执行原有生命周期
                originalLifetimesAttanched.call(this, ...args);
            }
        } else {
            // hook comp.attanched的话 可以直接使用我们定义好的hookLifetime
            hookLifetime(componentObj, 'attanched', attanchedInjectFn);
        }
        
        // 输出原组件对象
        return originalComponent(componentObj);
    }
}

export default { init }