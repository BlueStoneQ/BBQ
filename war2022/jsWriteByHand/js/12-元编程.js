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