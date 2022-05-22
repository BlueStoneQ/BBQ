/**
 * config的初始化是在register中
 * 同样 config其实是个单例 这里的实现方式不是单例模式 也可以用单例模式实现config部分
 * 接受register的入参 生成fst-SDK的配置
 * 1. 同样 这里的配置 还有一部分是在云上的k:v配置 需要读取 整合 逻辑处理后输出
 */
// 线上k:v存储 sdk
import KV from 'KV';

let FSTConfig = null;

(function() {
    FSTConfig = function() {
        // 定义一堆属性
        this.KVInstance = null;
        this.configInstance = null;
    }

    /**
     * 
     * @param {*} KVKey 云上K:V存储 的访问 key 
     */
    FSTConfig.init = function({ KVKey }) {
        this.configInstance = new FSTConfig();
        // 初始化init
        this.KVInstance = KV.init(KVkey);
        
        return this.configInstance;
    }

    /**
     * 结合local、remote几个配置 来确定pageRoute是不是要进行fst测速
     * @param {*} pageRoute 
     * @returns {Boolean}
     */
    FSTConfig.isPageFSTEnable = function (pageRoute) {
        if (!pageRoute || !pageRoute.length) return false;

        // 本地开关检查优先 
        // 远程开关检查
        return localEnable(pageRoute) && this.KVInstance.fstEnabled(pageRoute);
    }

    /**
     * 一个提供单例模式的方法
     * @param  {...any} args 
     * @returns 
     */
    FSTConfig.getSingleInstance = function (...args) {
        if (this.configInstance) return this.configInstance;

        this.configInstance = this.init(...args);

        return this.configInstance;
    }
})()

export default FSTConfig;