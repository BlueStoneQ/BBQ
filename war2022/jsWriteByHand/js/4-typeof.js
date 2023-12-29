/**
 * 2022-3-1
 * 实现一个比较通用的全面的类型判断函数
 * - 不是实现一个typeof哦
 */

/**
 * 类型的静态常量，可以挂载到_typeof 例如：_typeof([]) === _typeof.TYPE.array, 统一比较
 * 另外 可以设计：例如：_typeof([]).isArray() 这样判断具体类型的函数
 * 当然整个写成class 也可以
 */
const TYPE = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  symbol: 'Symbol',
  undefined: 'undefined',
  _null: 'null', // null是关键字
  object: 'object',
  array: 'array', 
  _function: 'function', // function 是关键字 
  regexp: 'regexp',
  date: 'date',
  map: 'map',
  set: 'set'
};

/**
 * 判断类型
 * @param {*} value 
 * @return {string} 最好有一个常量表 统一查询
 */
const _typeof = (value) => {
  // defend
  // case1 null: 其实 null 也可以用下面的方法获取
  if (value === null) return 'null';
  // case2 引用类型
  if (typeof value === 'object') {
    // 也可以用正则抠出具体类型 match(/(\w+)\]/)[1]， 如下：🔥
    return Object.prototype.toString.call(value).match(/(\w+)\]/)[1].toLowerCase();
    // 方法2：传统split的方法 专业度低
    // const protoTypeStr = Object.prototype.toString.call(value);
    // return protoTypeStr.split(' ')[1].split(']')[0].toLowerCase(); // 抠出array 等等真正的类型字符串
  }
  // case3 基础类型
  return typeof value;
}


/**
 * 封装一个对象模式
 */
class Typeof {
  constructor() {
    const {
      string,
      number,
      boolean,
      symbol,
      undefined,
      _null,
      object,
      array,
      _function,
      map,
      set,
      regexp,
      date
    } = TYPE;

    this.TYPE = TYPE;
    
    // 非引用类型列表
    this.NO_REF_TYPE_LIST = [
      string,
      number,
      boolean,
      symbol,
      undefined,
      _null
    ];

    // 引用类型列表
    this.REF_TYPE_LIST = [
      object,
      array,
      _function,
      map,
      set,
      regexp,
      date
    ];
  }
 
  _typeof (value) {
    return _typeof(value);
  }

  /**
   * 是否为基础类型（非引用类型）
   */
  isNoRefType (value) {
    const type = this._typeof(value);

    return this.NO_REF_TYPE_LIST.includes(type);
  }

  /**
   * 是否为引用类型
   * @param {*} value 
   */
  isRefType (value) {
    const type = this._typeof(value);

    return this.REF_TYPE_LIST.includes(type);
  }

  typeInlcudes (typeList, value) {
    const type = this._typeof(value);

    return typeList.includes(type);
  }

  typeOf (value) {
    return this._typeof(value);
  }
}



module.exports = {
  _typeof,
  TYPE,
  typeofInstance: new Typeof() // 这里最好提供一个单例模式
}