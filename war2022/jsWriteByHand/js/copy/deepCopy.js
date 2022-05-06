/**
 * 2022-3-3
 * 1. JSON.parse(JSON.stringify(obj)) // 属性值为函数 Symbol undefined等 该属性会消失; 试试 Reg呢？，另外 也无法处理循环引用问题 会直接报错
 * 2. lodash.cloneDeep()
 * 3. 手写实现
 * 
 * 4. 如果要考虑比较全面：则拷贝的数据类型分为2大类：
 *  1. 值是可遍历的类型：Array Object Map Set
 *  2. 值是不可遍历的：各种基本类型 function 
 * 
 * 5. 实现参考：[lodash._baseclone](https://github.com/lodash/lodash/blob/master/.internal/baseClone.js)
 */


/**
 * 手写的完全版deepCopy
 * 核心思路：其实深拷贝可以拆分成 2 步，浅拷贝 + 递归，浅拷贝时判断属性值是否是对象，如果是对象就进行递归操作，两个一结合就实现了深拷贝。
 * @param {*} obj 
 * @returns 
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


/************************************************ */

/**
 * 加强版deepClone
 * 主要支持了更丰富的类型：function RegExp
 * 参考：https://blog.csdn.net/cc18868876837/article/details/114918262
 * me: 改进 可以将各个判断类型的代码统一抽出来 封装出来 这样的话 就不会影响到主逻辑的清晰度
 * @param {*} obj 
 * @returns 
 */
const deepClonePro = (obj) => {
  // 利用闭包: 提供memo 解决循环引用问题，[key, data] = [data, data], key也是值本身
  const memo = new Map();

  // 判断是否为引用类型
  const isObject = (_obj) => {
    const type = typeof _obj;
    return _obj !== null && (type === 'object' || type === 'function');
  };

  // 定义递归拷贝函数
  const _deepClone = (_obj) => {
    // 1. 不可遍历的类型，又分为引用类型 和 非引用类型 处理
    // 1.1 非引用类型 - 值拷贝-直接返回原值（适用于复制的obj根本不是引用类型时 第一次处理）
    if (!isObject(_obj)) return _obj;
    // 1.2 引用类型-不可遍历型 枚举每种类型的拷贝： RegExp Date function
    // 1.2.1 函数类型 - 我们可以使用new Function生成一个新函数 
    if (typeof _obj === 'function') {
      // 这里newFunction return 的是_obj.toString()生成的函数定义，执行后就return出这个函数定义了，可以理解为高阶函数
      return new Function('return' + _obj.toString())(); 
    }
    // 1.2.2 Date RegExp类型 - 直接构造一个新的对象返回
    if ([Date, RegExp].includes(_obj.constructor)) {
      return new _obj.constructor(_obj);
    }
    // 2. _obj是可遍历的类型: Object Array Map Set
    // 2.1 查下缓存 避免循环引用 - 已经复制过的 避免递归复制, 这里的_obj本质上就是property
    if (memo.has(_obj)) {
      return memo.get(_obj);
    }
    // 2.2.1 _obj是Map对象
    if (_obj instanceof Map) {
      const _newObj = new Map();

      // 记录到备忘录中 - 这里设置备忘录需要前置 因为下面的遍历中的——deepClone可能会有递归 会需要memo
      memo.set(_obj, _newObj);

      _obj.forEach((val, key) => {
        // 注意：属性值为Object的时候 需要走深拷贝
        if (isObject(val)) {
          _newObj.set(key, _deepClone(val));
        } else {
          // 基础类型 直接拷贝
          _newObj.set(key, val);
        }
      });

      return _newObj;
    }
    // 2.2.2 _obj是Set对象
    if (_obj instanceof Set) {
      const _newObj = new Set();

      // 记录到备忘录中 - 这里设置备忘录需要前置 因为下面的遍历中的——deepClone可能会有递归 会需要memo
      memo.set(_obj, _newObj);

      _obj.forEach(val => {
        // 注意：属性值为Object的时候 需要走深拷贝
        if (isObject(val)) {
          _newObj.add(_deepClone(val));
        } else {
          // 基础类型 直接拷贝
          _newObj.add(val);
        }
      });

      return _newObj;
    }

    // 2.3 _obj是 Object 或者 Array
    const _newObj = Array.isArray(_obj) ? [] : {};
    // memo需要在下一次可能调用_deepClone之前set 避免循环引用
    memo.set(_obj, _newObj);

    // 遍历属性
    for (const key in _obj) {
      if (_obj.hasOwnProperty(key)) {
        const val = _obj[key];

        if (isObject(val)) {
          // 引用类型 都经过深拷贝
          _newObj[key] = _deepClone(val);
        } else {
          _newObj[key] = val;
        }
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
    d: e,
    e: /\d/,
    f: new Date()
  }
];

e.a = a;


const a1 = deepClonePro(a);

console.log('a1: ', a1);

