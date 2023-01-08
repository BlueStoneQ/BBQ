/**
 * LRU
 */

const _addRecently = Symbol('_addRecently');

class LRU {
  constructor(maxLen) {
    this.maxLen = maxLen;
    this.cache = new Map();
  }

  get (key) {
    if (!this.cache.has(key)) return;

    const val = this.cache.get(key);

    this[_addRecently](key, val);
    return val;
  }

  put (key, val) {
    if (this.cache.has(key)) {
      this[_addRecently](key, val);
      return;
    }

    if (this.cache.size > this.maxLen) {
      // 删除最旧的 cache头部的
      const delKey = this.cache.keys().next().value;
      this.cache.delete(delKey);
    }

    this.cache.set(key, val);
  }

  [_addRecently] (key, val) {
    this.cache.delete(key);
    this.cache.set(key, val);
  }
}