import Vue from 'vue';
import ElementUI from 'element-ui';
// 注意引入css文件后 一定要配置css-loader+style-loader的处理
import 'element-ui/lib/theme-chalk/index.css';
import App from './App';
import router from './router/index';

Vue.use(ElementUI);

new Vue({
  el: '#app',
  router,
  // 这里的入参App 是vue-loader使用vue-template-compiler处理过后的产物
  render: h => h(App), // https://segmentfault.com/a/1190000016417861 + https://juejin.cn/post/6989409063595425828
  // components: { App },
  // template: '<App/>' // template属性需要runtime中有compiler支持 但是 引进带编译器版本的vue-runtime会体积变大
});