/**
 * 【题目 1.13】元编程（Proxy & Reflect / Object.defineProperty）
 * 要求：掌握 JS 元编程能力，用 Object.defineProperty 与 Proxy 拦截对象的
 *      读写等操作，实现属性劫持 / 代理。
 */

/**
 * 2024-1-29
 * js元编程：
 * 1. Object.defineProperty
 * 2. proxy
 */

/**
 * proxy
 */
const target = {
  name: 'John',
  age: 30,
};

const targetProxy = new Proxy(target, {
  get: function (target, prop) {
    return target[prop];
  },
  set: function (target, prop, value) {
    target[prop] = value;
  },
});