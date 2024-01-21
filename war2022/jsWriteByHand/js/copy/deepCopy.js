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
 *              参考1：https://blog.csdn.net/cc18868876837/article/details/114918262
 *             [参考2](https://github.com/yygmind/blog/issues/29)
 *             [颜海镜-深拷贝的终极探索](https://segmentfault.com/a/1190000016672263)
 *                - https://yanhaijing.com/javascript/2018/10/10/clone-deep/
 *                - 这里提出了一个问题：叫递归爆栈 - 主要是递归对内存的消耗造成的
 *                  - 解决方案有：1. 尾递归优化 2. 递归变遍历 
 * 
 */

/**
 * [递归版]-以这个为准: 已经通过测试了：
 * 我更倾向于实现一个通用的类型检测函数 + 将五花八门的类型检测剥离，
 *  - 然后只留下主体逻辑框架：基础类型-直接赋值, 引用类型-递归调用返回值赋值
 *    + 各个类型的处理：初始化 + 赋值
 * 
 * 然后 一定要遵循单一职能,遵循一个清晰的架构：
 *  - 一个渐进增强的框架，每个类型的处理 都像插件一些 插进来，也符合对扩展开放，框架内部对修改封闭的 开闭原则
 *  - 主体框架一定要清晰
 *  - 框架只负责 类型判断 + 不同类型下的函数调用（甚至可以试试访问者模式）
 * 
 * TODO:这个写好 可以写一篇blog - 掘金，讲下这个实现 清晰 健壮：
 * TODO: 使用class + 访问者模式实现一下 - 掘金上分享下这2种实现
 * 
 * TODO: 如何解决递归爆栈问题：
 *  - https://juejin.cn/post/6960494038193537055#heading-10
 */
(() => {
  const { typeofInstance, TYPE } = require('../4-typeof'); // 这里类型判断使用自己封装的一个类型检测程序

  const {
    object,
    array,
    _function,
    map,
    set,
    date,
    regexp
  } = TYPE;

  /**
   * 重构的职能模块清晰版
   * 按照这个架构 我越发觉得class更适合组织这个代码
   * @param {*} arg
   * @returns
   */
  const myDeepClone = (arg) => {
    // defend

    // 备忘录memo 解决循环引用：- 这里采用闭包来确保递归过程中 始终可以访问这一个memo
    // ES6可以使用Map WeakMap, ES5可以使用数组，每个item = { kay, val }, memo.find(key) 需要自己实现下
    // 循环引用中的key一般推荐使用_myDeepClone中的入参_arg
    // 其实弱引用的好处就是可以在任何时刻被回收，提高性能，map 虽然可以进行手动释放提高性能，但是在某些情况下，是无法进行手动清除的。
    // 另外，关于是否可以使用object作为memo,个人觉得是可以的，但是在生成key的时候，需要注意将原来引用类型的key变成字符串，toString作为key,但可能仍有key重复发生碰撞的风险
    // 注意：memo的key - 一般是一个引用值，就是原来的key本身，因为循环引用，本身就是引用的重复（指向同一块堆内存的一般都是同一个引用值哈）
    // 其实 就是有的时候 我们的map的key是个引用类型，这样的话，在map中这个key一直存在的话，这个引用类型内存是无法回收的，而使用weakMap的话，这个引用类型在这里的key其实是不作为引用计数的，当该引用类型被销毁的时候，weapMap中以这个引用类型作为的key不会阻碍该引用类型的内存回收
    // 其实就是避免某种程度的内存泄露
    const memo = new WeakMap();

    /**
     * 主体逻辑:类型判断 + 调用各种类型的处理方案
     * @param {*} _arg
     * @returns
     */
    const _myDeepClone = (_arg) => {
      // defend
      // case1 arg是基础类型
      if (typeofInstance.isNoRefType(_arg)) {
        return _arg;
      }
      // case2 arg是引用类型
      // case2-1 不可以迭代的引用类型：RegExp Date function
      if (typeofInstance.typeOf(_arg) === _function) {
        return _copyFunction(_arg);
      }

      if (typeofInstance.typeInlcudes([date, regexp], _arg)) {
        return _copyDateOrRegExp(_arg);
      }
      // case2-2 可以迭代（遍历）的引用类型：Object Array Map Set
      // 可以迭代的类型（具有属性的类型） - 一般循环引用都是在可迭代类型的属性中
      if (memo.has(_arg)) {
        return memo.get(_arg);
      }

      if (typeofInstance.typeInlcudes([object, array], _arg)) {
        return _copyObjectOrArray(_arg);
      }

      if (typeofInstance.typeOf(_arg) === map) {
        return _copyMap(_arg);
      }

      if (typeofInstance.typeOf(_arg) === set) {
        return _copySet(_arg);
      }
    }

    /**
     * 为了使用闭包，这里定义各个类型的copy函数
     */
    function _copyDateOrRegExp (_arg) {
      return new _arg.constructor(_arg); // 重新生成一个实例，引用会生成一个新的-引用类型复制的意义 重要的是生成新的引用和对应堆内存中的实例
    }

    function _copyFunction (_arg) {
      // 这里其实 是一个高阶函数 执行 返回（return）了一个新的函数（被拷贝好的新函数- _obj.toString()从字符串被return 后成为一个新函数(注入内存的活的函数)）
      // 关于这里为什么不用 eval, 而是使用 new Function:
      // eval能够影响当前作用域及所有的父作用域的变量， 而new Function 它是运行在一个独立的function内， 并且他的父作用域是window而不是当前作用域, 另外，new function还可以传参 
      // 1. [new function 更安全, ](https://juejin.cn/post/6960499386384121892)
      // 2. [](https://juejin.cn/post/6844903624091369485)
      return new Function('return ' + _arg.toString())(); // 注意 return 后面有空格哦
    }

    function _copyObjectOrArray (_arg) {
      const _newArg = Array.isArray(_arg) ? [] : {};
      //在这里位置调用 memo需要在下一次可能调用_deepClone之前set 避免循环引用
      memo.set(_arg, _newArg);

      for (const key in _arg) {
        const val = _arg[key];

        if (_arg.hasOwnProperty(key)) {
          if (typeofInstance.isRefType(val)) {
            _newArg[key] = _myDeepClone(val);
          } else {
            _newArg[key] = val;
          }
        }
      }

      return _newArg;
    }

    function _copyMap (_arg) {
      const _newArg = new Map();

      memo.set(_arg, _newArg);

      _arg.forEach((val, key) => {
        if (typeofInstance.isRefType(val)) {
          _newArg.set(key, _myDeepClone(val));
        } else {
          _newArg.set(key, val);
        }
      });

      return _newArg;
    }

    function _copySet (_arg) {
      const _newArg = new Set();

      memo.set(_arg, _newArg);

      _arg.forEach(val => {
        if (typeofInstance.isRefType(val)) {
          _newArg.add(_myDeepClone(val));
        } else {
          _newArg.add(val);
        }
      });

      return _newArg;
    }


    return _myDeepClone(arg);
  }

  /**
   * 用json实现 有局限性
   * @returns
   */
  

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

  // json-stringify:TypeError: Converting circular structure to JSON
  // json-stringify也无法处理循环引用
  // const deepCloneByJson = (obj) => JSON.parse(JSON.stringify(obj));

  // console.log('deepCloneByJson: ', deepCloneByJson(a));


  const a1 = myDeepClone(a);


  console.log('a1 myDeepClone: ', a1);
  console.log('a1[0].d myDeepClone: ', a1[0].d);

})()




/************************************************************************************************************************************ */

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
  const memo = new Map(); // 这里一般建议使用weakMap 

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
          _newObj.set(key, _deepClone(val)); // FIXME: 这里的set的key应该是val本身 ?
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

