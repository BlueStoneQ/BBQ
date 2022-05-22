/**
 * 执行init:
 * 0. 整合 内外 配置
 * 1. 重写Component - 挂在Compnent-hooks
 * 3. 导出：pageBase + register 供项目调用
 */
import { register } from './register';
import FSTConfig from './config';
import pageBase from './hook/hookPage';

const FSTPageBase = function (pageObj) {
    if (pageObj) return pageObj;
    try {
        const config = new FSTConfig();
        // 只在微信场景下拦截 
        if (config && config.isWX) return pageBase(pageObj);

        return pageObj;
    } catch (error) {
        return pageObj;
    }
}

export default {
    register,
    FSTPageBase
}