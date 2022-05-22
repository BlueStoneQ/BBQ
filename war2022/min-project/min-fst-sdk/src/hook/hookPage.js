/**
 * 这里其实有更好的初始化方案 我们姑且用这种 先定义 然后再require的时候 执行将最终的导出的pageBase进行动态定义
 * 1. 这里的hook拦截方法 都是使用的AOP方法：
 *  - 先存下原来的方法 然后新定义一个方法 在其中调用原来的方法 + 自己的注入的逻辑 并挂在到原来的生命周期上
 */
import FSTConfig from '../config';
import Sampling from '../sampling';
import hookSetData from '../utils/hookSetData';
import hookLifetime from '../utils/hookLifetime';

let pageBase = null;

const init = function () {

    const isPageFSTEnable = function (pageRoute) {
        const FSTConfigInstance = FSTConfig.getSingleInstance();
        return FSTConfigInstance.isPageFSTEnable(pageRoute);
    }

    /**
     * @param {Object} pageObj 页面配置
     */
    pageBase = function (pageObj) {
        // this上的属性
        // 属性1：采样实例
        this.samplingInstance = null;
        // 在pageObj上挂在属性
        pageObj.__fstEnable = false; // 当前页面是否开启了fst测速上报，在onLoad中开启
        // 在pageObj上挂在方法
        // pageObj上挂在监听回调：定义onInteractive方法：监听touchstart事件
        pageObj.__fstBindCaptureTouchStart = function () {
            // 这里其实会判断当前route如果是开启了FST测速上报的 就会进行后续测速
            if (!pageObj.__fstEnable) return;
            // 调用测速模块定义好的 用户交互时的逻辑
            this.samplingInstance.onUserInteractive(); 
        }

        // 上报数据方法 + 重置上报方法
        pageObj.reportFST = function () {
            this.samplingInstance.reportFST();
            this.samplingInstance = null; // ?
        }

        // hook
        /**
         * hook - onLoad 
         * 1. 初始化工作在这里进行：例如 this.samplingInstance 
         */
        // 要注入的逻辑
        const hookOnload = function () {
            // 初始化sampling实例 - 这里的this 实际上就是onLoad在调用的this 也就是页面的pageInstance = pageObj 页面实例
            this.samplingInstance = new Sampling(this);
            // 1. 开始采样
            this.samplingInstance.stopRecord();

            // hook setData 在页面的setData.callback中 进行采样
            hookSetData(this, () => {
                this.samplingInstance && this.samplingInstance.sampling(this);
            });
        }
        const originalOnLoad = pageObj.onLoad;
        pageObj.onLoad = function (...args) {
            // 执行注入的 fst测速相关逻辑
            try {
                this.__fstEnable = isPageFSTEnable(this.route);
                // 这里的pageObj 就是 this 都是页面实例
                if (this.__fstEnable) {
                    hookOnload.call(this);
                }
            } catch (error) {
                console.log();
            }
            // 执行原来的逻辑
            originalOnLoad && originalOnLoad.call(this, ...args);
        }
        // 剩下的2个生命周期 我用统一的方法进行hook 上面onLoad只是为了更直观理解这里采用的AOP的手法
        // hook - onHide
        const hookHide = function () {
            if (this.__fstEnable) {
                this.samplingInstance && this.samplingInstance.tryComputeFST();
                this.samplingInstance.stopRecord();
                this.reportFST && this.reportFST();
            }
        }
        hookLifetime(pageObj, 'onHide', (...args) => {
            hookHide.call(this, ...args);
        });

        // hook - onUnload：如果直接退出页面 不会走onHide 会触发onUnload
        const hookOnUnload = hookHide; // onHide 和 onUnload的逻辑是一致的
        hookLifetime(pageObj, 'onUnload', (...args) => {
            hookOnUnload.call(this, ...args);
        });

        // 重要: pageObj进行挂载加强后 必须return 才符合PageBase的定义
        return pageObj;
    }
}

init();

export default pageBase;