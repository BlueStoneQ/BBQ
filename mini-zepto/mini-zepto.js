/**
 * 我们自己手写一个zepto 
 * 1- 第一版可以简易些 不那么全面那么细节： 1- 五脏俱全  2- 可用 3- 实现经典的方法 到后面的版本：可以陆续在里面添加剩下的方法
 * 2- 这里呢，我们也就不适用分号了 -- 和zepto源码保持一致风格
 * 3- zepto官网中文文档：http://www.css88.com/doc/zeptojs_api/
 */

// 这里产生我们的Zepto -- 工厂类/方法
var ZeptoMin = (function() {
  /*---------------------------（一）变量的定义------------------------------ */
  var $, zepto = {}, emptyArray = []

  /*---------------------------（二）$()------------------------------------ */
  /**
   * 这里可以简单地看作是$对象的一个构造方法 -- 用来构造实例$('p')等的 -- 而这个实例$('p')的实质是一个集合/类数组
   */
  zepto.Z = function(dom, selector) {
    // 打印 -- 用来检测$('p')执行中调用的顺序
    console.log('执行：zepto.Z()')
    // 这个操作感觉不是那么保险 不过还好不是暴露出去的外部方法 不会有dom未传进来的情况
    dom = dom || []
    // 实列来继承对象的一些方法 -- 原型链
    dom.__proto__ = $.fn
    // 实例其他一些属性的添加
    dom.selector = selector || ''
    // 返回加工后的实例 -- 这里应该就是$()整个程序的出口
    return dom
  }

  /**
   * 这里算是整个程序真正的入口函数定义
   */
  zepto.init = function(selector, context) {
    // 打印 -- 用来检测$('p')执行中调用的顺序
    console.log('执行：zepto.init()')
    var dom
    // 伪：对dom的各种情况的判断及适配/适配器
    // 返回工程生产的实例 既我们平时$()的返回值
    return zepto.Z(dom, selector)
  }

  /**定义$ -- 请参考文档中中$()
   * @param {any}  selector 选择器入参  
   * @param {any} me:在创建虚拟dom时给插入的属性 
   * 
  */
  $ = function(selector, context) {
    // 打印 -- 用来检测$('p')执行中调用的顺序
    console.log('执行：$()')
    // 整个工程的入口--这里执行
    return zepto.init(selector, context)
  }

  /*---------------------------（三）$.fn(一些内部业务需要的方法)------------- */

  /*---------------------------（四）$(selector).fn() （对外暴露的一些关于元素的方法）--------------------------------- */
  $.fn = {
    /*========= (1)继承一部分js原有的方法 特别是Array的 ==========*/
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    /*========= (2)自定义方法 ==========*/
    // 用来测试一下 $(selector).test() 是否可以成功调用
    test: function () {
      console.log('可以调用哦')
    }
  }
  /*---------------------------（五）整个匿名函数（工厂方法）返回值（还是个工厂方法）原型链的构建----------------------------- */

  // 把zepto作为$的成员 -- 一并返回
  $.zepto = zepto
  // 该匿名工厂方法返回值(就是我们平时用的$--本身就是一个)
  return $
})()

// 定义两个全局变量
window.ZeptoMin = ZeptoMin
// 起一个简易的别名$ 考虑命名冲突/污染的问题
window.$$ === undefined && (window.$$ = ZeptoMin)