import Vue from 'vue';
import Router from 'vue-router';
import Home from '../pages/home/index.vue';
import Login from '../pages/login/index.vue';
import SkuList from '../pages/sku-list/index.vue';

// 加载vue-router插件，不是下面的router对象
Vue.use(Router);

// 这里注册一级路由 各子级路由嵌套注册
const routes = [{
  path: '/',
  redirect: '/home',
}, {
  path: '/home',
  component: Home
}, {
  path: '/login',
  component: Login
},  {
  path: '/sku-list',
  component: SkuList
}];

export default new Router({
  routes
});