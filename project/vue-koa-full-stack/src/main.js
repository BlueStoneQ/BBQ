import Vue from 'vue';
import App from './App';
import router from './router/index';

new Vue({
  el: '#app',
  router,
  // 这里的入参App 是vue-loader使用vue-template-compiler处理过后的产物
  render: h => h(App), // https://segmentfault.com/a/1190000016417861 + https://juejin.cn/post/6989409063595425828
  // components: { App },
  // template: '<App/>' // template属性需要runtime中有compiler支持 但是 引进带编译器版本的vue-runtime会体积变大
});