/**
 * 2022-3-3
 * 1. JSON.stringify() => JSON.parse() // 属性值为函数 Symbol undefined等 该属性会消失; 试试 Reg呢？
 * 2. lodash.cloneDeep()
 * 3. 手写实现
 */


/**
 * 手写的完全版deepCopy
 * 核心思路：其实深拷贝可以拆分成 2 步，浅拷贝 + 递归，浅拷贝时判断属性值是否是对象，如果是对象就进行递归操作，两个一结合就实现了深拷贝。
 * @param {*} obj 
 * @returns 
 */
const deepClone = (obj) => {
  // 提供memo 解决循环引用问题
  const memo = new Map();
  // 定义递归拷贝函数
  const _deepClone = (_obj) => {
    const _newObj = Array.isArray(_obj) ? [] : {};
    // 记录到缓存中
    memo.set(_obj, true);
    // 遍历属性
    for (const key in _obj) {
      if (_obj.hasOwnProperty(key)) {
        const curProperty = _obj[key];
        // 引用类型 递归拷贝
        if (typeof curProperty === 'object') {
          // 查memo 有的话 直接返回 不用拷贝了
          if (memo.has(curProperty)) {
            _newObj[key] = curProperty;
            continue;
          };

          // 缓存没有查到 则递归拷贝
          _newObj[key] = _deepClone(curProperty);
          continue;
        }

        // 非引用类型 直接拷贝
        _newObj[key] = curProperty;
      }
    }

    return _newObj;
  }
  // 调用递归拷贝函数
  return _deepClone(obj);
}

/**
 * 用json实现 有局限性
 * @returns
 */
const deepCloneByJson = (obj) => JSON.parse(JSON.stringify(obj));

const e = {}

var a = [
  {
    a: () => {},
    b: undefined,
    c: Symbol('c'),
    d: e
  }
];

e.a = a;


const a1 = deepClone(a);

console.log('a1: ', a1);

