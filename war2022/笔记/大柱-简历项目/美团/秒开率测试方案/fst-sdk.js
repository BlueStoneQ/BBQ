// 简易手写一个秒开测速sdk 可以放到工程里测一测
const config = {}; // global
const fst = {
  records: [], // 采样点记录
};

const register = function() {}

const pageBase = function() {}


function pageHook() {}

function componentHook() {}

function report() {}

function sampling() {
  // sampling
  // isReachedBottom
  // tryComputedFst
}

// 使用方法
// 1. 小程序app启动时，进行register，内部是用AOP对全局的Component进行重写，注入测速逻辑
// 2. 采用BaseWrap的形式，对pageOpt进行: hookSetData + 生命周期拦截

