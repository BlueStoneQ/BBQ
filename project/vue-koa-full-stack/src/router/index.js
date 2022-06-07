import Vue from 'vue';
import Router from 'vue-router';
import Home from '../pages/home/index.vue';

// 加载vue-router插件，不是下面的router对象
Vue.use(Router);

const routes = [{
  path: '/',
  component: Home
}];

export default new Router({
  routes
});