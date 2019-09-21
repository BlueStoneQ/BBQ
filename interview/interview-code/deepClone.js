/**
 * 深拷贝
 */
/**
 * 深拷贝 - 简单版
 */
function deepCloneMin(obj) {
  return JSON.parse(JSON.stringify(obj)); 
}

/**
 * 深拷贝 - 
 * 重要的是后面的思维模型
 * 递归也是一种分治思想 每一层只关心该层的逻辑 该层的出口和入口
 * 1. 特殊值处理
 * 2. 主体逻辑 {
 *  0. 辅助值定义
 *  1. 辅助函数 - 类型判断
 *  2. 辅助函数 - 递归克隆
 *  3. 循环引用问题处理 
 *  4. 主程序调用
 * }
 * @param {object} parent 需要克隆的对象
 * @return {object} 深克隆后的对象
 */
const myDeepClone = (
  function f(parent) {
    console.log('开始了： ', parent);
    // 因为严格模式下 不能使用arguments.calle,
    // 而我们有一些内部函数绑定在该命名空间下 所以 把使用的函数名myDeepClone和内部使用的函数名f解耦 
  
    let obj = {};
    if (!f.isType) {
      // 定义判断类型的函数 - 类型判断在神拷贝中很重要
      f.isType = (parent, type) => {
        // 特殊值判断
        if ( typeof parent !== 'object' ) return false;
        // 获取类型字符串
        const typeStr = Object.prototype.toString(parent);
        // 是否类型一致 bool值 
        let flag = false;
        switch(type) {
          case 'Array':
            flag = typeStr === '[Object Array]';
            break;
          case 'Date':
            flag = typeStr === '[Object Date]';
            break;
          case 'RegExp':
            flag = typeStr === '[Object RegExp]';
            break;
          default:
            // 其他
        }
        return flag;
      }
    }
    if (!f._getExp) {
      // 获得RegExp的实例中的flags： m i g
      f._getExp = function(parent) {
        let flags = '';
        if (parent.global) flags += 'g';
        if (parent.ignoreCase) flags += 'i';  
        if (parent.multiline) flags += 'm';  
        return flags;
      }
    }

    if (!f._clone) {
      // 维护两个存储循环引用的数组 - 必须在函数之外 保持为一些 不属于某个递归层次
      const parents = [];
      const children = [];
      // 定义克隆工具函数
      f._clone = (parent) => {
        // 特殊值处理
        if ( parent === null ) return null;
        if ( typeof parent !== 'object' ) return parent;  

        let child, proto;
        // 根据parent此轮循环的类型来决定要构建的本层的属性是什么 - 本层拷贝的实际动作其实就在这里：分类型拷贝，
        // 利用父子指针链接前后2个递归调用
        if (f.isType(parent, 'Array')) {
          child = []; // 拷贝发生在后面的for in中
        } else if (f.isType(parent, 'RegExp')) {
          child = new RegExp(parent.source, f._getExp(parent));
          // 这里单独继承lastIndex属性 因为它不是正则的模式标志量
          if ( parent.lastIndex ) child.lastIndex = parent.lastIndex;
        } else if (f.isType(parent, 'Date')) {
          child = new Date(parent.getTime()); 
        } else {
          // 普通对象 - 这里我们只处理原型链的剥离和继承，具有遍历性的属性的继承 都需要遍历：for in
          proto = Object.getPrototypeOf(parent);
          child = Object.create(proto);
        }

        const index = parents.indexOf(parent);
        if (index !== -1) {
          // 在之前依赖中已经递归复制过了 - 所以面对这个引用 就直接返回parent 不需要递归了
          // 如果父数组存在该对象，则证明之前已经被引用过了，则直接返回该对象即可
          return children[index];
        }
        parents.push(parent);
        children.push(child);

        for (let i in parent) {
          // 其实 一个普通对象的拷贝 包括：属性名的拷贝 + 对应值的拷贝 两部分
          // 属性名：这里的i就可以 
          // 所谓 拷贝 其实是一种工厂 构造一种和parent相同的对象
          child = f._clone(parent[i]); // 递归
        }
        // 这里就是递归跳出的点：到达了具体值
        return child;
      } 
    }
    // for () {}
    return f._clone(obj);
  }
);

/**
 * 测试1 - 慢慢养成写测试用例的习惯 
 */
var objMin = {
  arr1: [1, 2, 3],
  obj1: {
    c: 1
  }
}

var obj = Object.assign({}, objMin, {
  f1: function() {
    console.log(fghjkl);
  },
  reg1: new RegExp(/[1-9]*/),
  date1: new Date()
});

console.log('deepCloneMin(objMin): ', deepCloneMin(objMin));
console.log('deepCloneMin(obj): ', deepCloneMin(obj)); 

/**
 * 测试2
 */
function person(pname) {
  this.name = pname;
}

const Messi = new person('Messi');

function say() {
  console.log('hi');
}

const oldObj = {
  a: say,
  c: new RegExp('ab+c', 'i'),
  d: Messi,
};

// 这里是构造对循环引用的测试用例
oldObj.b = oldObj;


const newObj = myDeepClone(oldObj);
// console.log('[fn]', myDeepClone);
console.log('newObj: ', newObj);
console.log('[a: ]', '<new>: ', newObj.a, '<old>: ', oldObj.a);
console.log('[b: ]', '<new>: ', newObj.b, '<old>: ',oldObj.b);
console.log('[c: ]', '<new>: ', newObj.c, '<old>: ',oldObj.c);
console.log('[d: ]', '<new>: ', newObj.d, '<old>: ',oldObj.d);
console.log('[d.constructor: ]','<new>: ', newObj.d.constructor, '<old>: ', oldObj.d.constructor);

console.log('[fn]', myDeepClone);