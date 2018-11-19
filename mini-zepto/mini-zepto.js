/**
 * 我们自己手写一个zepto 
 * 1- 第一版可以简易些 不那么全面那么细节： 1- 五脏俱全  2- 可用 3- 实现经典的方法 到后面的版本：可以陆续在里面添加剩下的方法
 * 2- 这里呢，我们也就不适用分号了 -- 和zepto源码保持一致风格
 * 3- zepto官网中文文档：http://www.css88.com/doc/zeptojs_api/
 * 4- 理解其中几个量： dom 其实就是我们平时$(selector)的返回值，是个对象的集合；$就是我们平时用的$,本身是个工厂函数，因为函数也是对象，所以也有自己的方法，就是$.调用（例如$.map()）
 * 4-1 然后这几个量就是用原型链：__proto__ 和 prototype实现继承/粘合的 最后就是我们无所不能的$了哈哈
 * 4-2 因为js中没有类的概念，所以对象的继承等实际上是一种克隆模式
 */

// 这里产生我们的Zepto -- 工厂类/方法
var ZeptoMin = (function() {
  /*---------------------------（一）变量的定义------------------------------ */
  var $, zepto = {}, emptyArray = [],
  // 有的对象方法我们可以用变量接出来 方便使用
  slice = emptyArray.slice, filter = emptyArray.filter,
  // 正则 -- 都用RE结尾
  // （利用() + RegExp.$n）取出html代码中的第一个html标签/注释，如取出<p>123</p><div>23</div> 中的<p>
  fragmentRE = /^\s*<(\w+|!)[^>]*>/,
  /**
   * 单纯标签 -- 匹配<img /> <p></p> 不匹配<img src=""> <p>123</p>
   * 这里的\1 实际上相当于我们用的$1 存储的是
   */   
  singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
  /**
   * 对所有的写成单标签的双标签进行替换，格式化为双标签的正规写法
   * 例如： <p /> 替换为 <p></p>
   * 当然对于area 等单标签是不会匹配的（不会变成双标签）
   */
  tagExpanderRE = /<(?!area|br|col|embed|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
  // 特殊的属性存放在这个数组中 -- 对特殊情况要学会枚举并特殊处理
  methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],
  // 判断document.readyState的情况
  readyRE = /complete|loaded|interactive/,
  // 匹配一个纯字符 （字母/下划线/数字/-）
  simpleSelectorRE = /^[\w-]*$/,
  // 在创建元素时 - 指定特殊元素(table类的元素)的容器
  containers = {
    'tr': document.createElement('tbody'),
    'tbody': table,
    'thead': table,
    'tfoot': table,
    'td': tableRow,
    // 除以上特殊情况外 其他所有元素容器为div
    '*': document.createElement('div')
  },
  //class2type 应该是用来存储一些特殊类型的 -- 在下文的脚本中遍历定义的
  class2type = {},
  // 常用的方法 -- 摘取出来（挂载在当前函数的变量域）
  toString = class2type.toString,
  // 判断是否为Array
  isArray = Array.isArray || function(object) { return object instanceof Array }

  /*---------------------------（二）$()------------------------------------ */
  
  /**
   * 利用闭包定义的一系列内部工具方法
   * 1- 并不直接暴露， 只是供内部逻辑使用
   */
  /**
   * 判断是否为函数
   * @param {any} value 
   */
  function isFunction(value) {
    return type(value) === 'function'
  }
  /**判断obj是否为document对象 这里感觉也可以用9或者document.nodeType或者document.document_node代替obj.document_node
   */
  function isDocument(obj) {
    return obj !== null && obj.nodeType === obj.DOCUMNET_NODE
  }
  /**
   * 判断是否类数组（数组/对象数组）
   */
  function likeArray(obj) {
    return typeof obj.length === 'number'
  }

  /**
   * 数组清洗 -- 剔除null 和 undefined等无效情况 (这里用不严格判等 !=)
   * @param {Array} array
   */
  function compact(array) {
    return filter.call(array, function(item) { return item != null })
  }

  function type(obj) {
    return obj  === null
            ?
            String(obj)
            : // 下面的先是在class2type种查找相应的类型
            class2type[toString.call(obj) || "object"]
  }

  function isObject(obj) {
    return type(obj) === 'object'
  } 

  /**
   * 判断是否最基本的object (object.getPrototypeOf(obj) === Object.prototype)
   * @param {obj} obj 
   */
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) === Object.prototype 
  }

  /**
   * 处理函数/非函数两种情况
   * 1- arg是函数 则 改变函数的执行环境和参数
   * 2- arg不是函数 则 直接返回
   * @param {*} context 
   * @param {*} arg 
   * @param {*} idx 
   * @param {*} payload 
   */
  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  /**
   * 设置属性
   */
  function setAttribute(node, name, value) {
    // 只是加了一层对参数有效性的检验和处理
    // 这里核心实现还是用的原生的两个属性操作方法处理的
    value === null
    ?
      node.removeAttribute(name)
    : 
      node.setAttribute(name, value)
  }

  /**
   * 根据slecter选择/查找元素
   * @param element 容器
   * @param selector 选择器
   */
  zepto.qsa = function(element, selector) {
    /**
     * me: 把一些表达式中的判断量 用变量封装起来 可以使后面的逻辑清晰优雅
     * 1- 注意这里对选择器各个情况的划分和处理
     */
    var found, // 返回值就是dom元素（的数组）  -- 父层函数取得后用zepto.Z使其可以使用其他zepto的方法
        maybeID = selector[0] === '#', // 判断量 -- 选择器是id
        maybeClass = !maybeID && selector[0] === '.', // 选择器 是 class
        // 这里是 如果是id/class 则取出#/.后面的字符内容 否则就是纯标签处理 取出整个字符
        nameOnly = maybeID || mqybeClass ? slector.slice(1) : slector,
        // 这里就是对上面取出的nameOnly校验  是否含有一些特殊符号 还是只包含字母/下划线/数字的纯字符
        isSimple = simpleSelectorRE.test(nameOnly)

    // dom对象要考虑document对象的
    return (isDocument(element) && isSimple && maybeID) ?
            ( (found = element.getElementById(nameOnly)) ? // 用id获取
              [found] :
              []
            ) : 
            (element.nodeType !== 1 && element.nodeType !== 9) ?
              // 容器不是普通元素/document时 证明这个查询条件无效 返回[]  -- 判断一定要优先判断该条件下的无效的情况
              [] :
              slice.call(
                isSimple && !maybeID
                ?
                maybeClass ?
                  // element有效的情况下 判断selector的情况 -- class查询
                  element.getElementByClassName(nameOnly) // if it's simple, it could be class
                  :
                  element.getElementByTagName(selector) // or a tag
                :
                element.querySelectorAll(selector) // Or it's not simple, and we need to query all -- element有效的情况下--终极大杀器
              )
  }
  /**
   * 利用selector生成真实的dom节点 -- 这个dom元素就是$元素 不是原生的
   * 其实在zepto编程的理念中，一切操作都是围绕$()生成的对象元素 而不是真实的dom
   * @param {string} html 用来生成dom的html字符串
   * @param {string} name 用来生成的dom元素的标签名称
   * @param {string} properties 生成元素的属性
   */
  zepto.fragment = function(html, name, properties) {
    // 首部变量定义
    var dom, nodes, container
    // 1- html是单纯标签（无内容和属性等） -- 直接用单纯的标签创建元素 -- 这是一个优化 略去了后面的部分处理
    if (singleTagRE.test(html)) {
      // 这里的dom是用取出的标签名创建的一个
      dom = $(document.createElement(RegExp.$1))
      console.log('单纯标签的dom：' + JSON.stringify(dom))
    }
    // 2- html不是单纯标签
    if (!dom) {
      // 2-1 对html的格式化处理
      if (html.replace) {
        html = html.replace(tagExpanderRE, "<$1></$2>")
        console.log('格式化处理后的html：' + html)
      }
      // 处理第二个参数 name
      // 2-2 如果name未传入 则用html第一个标签的名称作为name -- 和之前的name取值方式一致
      if (name === undefined) {
        name = fragmentRE.test(html) && RegExp.$1
      }
      // 2-3 指定特殊元素的容器 一般为<div> 其他情况都有各自对应情况 这些对应情况保存在公共变量 containers
      if (!(name in containers)) {
        name = '*'
      }
      // html的容器处理（给html外面包上相应的标签作为容器）
      container = containers[name]
      container.innerHTML = '' + html
      dom = $.each(slice.call(container.childNodes), function() {
        container.removeChild(this)
      })
    }
    // 处理第三个参数 properties:将属性加在实际的dom元素上
    // 这里当然需要对入参进行一个校验 -- 不符合标准的自然就不作处理（不加在生成的dom元素）
    if (isPlainObject(properties)) {
      // 先把dom转换为zepto对象 -- 我们可以用$(dom)来使用zepto的一些方法
      nodes = $(dom)
      $.each(properties, function(key, value) {
        // 这里的key实际上就是属性的名字 -- 利用indexOf在methodAttributes中查取是否存在
        if (methodAttributes.indexOf(key) > -1) {
          // 这里其实相当于nodes.key(value) -- 但是key在这里是变量 -- 所以用[]这种方式调用
          nodes[key](value)
        } else {
          // 这里还是调用$()提供的方法
          nodes.attr(key, value)
        }
      })
    }
    // 最终返回的dom可能有两种形式
    // 第一，如果 html 是单标签，则dom被赋值为一个zepto对象 dom = $(document.createElement(RegExp.$1))
    // 第二，如果 html 不是单标签，则dom被赋值为一个DOM节点的数组
    return dom
  }
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
   * '$.zepto.isZ' should return 'true' if the given object is a Zepto 
   * collection. This method can be overriden in plugins.
   * 判断是不是Z对象 -- 其实判断是不是
   */
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  /**
   * 这里算是整个程序真正的入口函数定义
   * 1- 这里我们要生成$()要返回的那个对象集合
   */
  zepto.init = function(selector, context) {
    // 打印 -- 用来检测$('p')执行中调用的顺序
    console.log('执行：zepto.init()')
    var dom
    // selector的多种情况处理--对dom的各种情况的判断及适配/适配器
    // 1. selector 是 空 -- 判空
    if (!selector) return zepto.Z()
    // 2. selector 是 string (这里面又有多种情况了)
    if (typeof selector === 'string') {
      // 格式化selector -- 去掉空格
      selector = selector.trim()
      // 1- string情况1：selector为一串html代码 -- 来生成一个dom元素
      if (slector[0] === '<' && fragmentRE.test(selector)) {
        // 利用RegExp.$1取出fragmentRE的第一个()中的内容 既<p></p><div></div>中的‘p’
        dom = zepto.fragment(selector, RegExp.$1, context), // 用, 则就是一条语句 可以把外面的{}去掉
        selector = null // 清理选择器 -- 防止变量污染
      } else if (context !== undefined) {
        // contetx的情况处理 -- context是创建元素时带有的属性
        // $().find(): 在当对象前集合内查找符合CSS选择器的每个元素的后代元素。
        return $(context).find(slector)
      } else {
        // 2- string情况2：seletcor是用来查询的 -- 类似与css选择器
        dom = zepto.qsa(document, selector)
      }
    }
    // 3. selector 是 function
    else if(isFunction(selector)) return $(document).ready(selector)
    // 4. selector 是 要生成的Z对象 -- 直接返回
    else if(zepto.isZ(selector)) return selector
    // 5. 其他多种非典型的情况（就是以上（细分）分支情况都不符合的情况下）
    else {
      // 5-1 selector是数组
      if (isArray(selector)) {
        dom = compact(selector)
      }
      // 5-2 selector是对象
      else if (isObject(selector)) {
       // 及时清空selector, 不妨碍下面的判断 -- 下面zepto.Z还使用了selector
       dom = [slector], slector = null 
      }
      // 5-3 selector是字符串 -- 是以html开头的
      else if (fragmentRE.test(selector)) {
        dom = zepto.fragment(slector.trim(), RegExp.$1, context),
        selector = null
      }
      // 5-4 context不是undefined
      else if (context !== undefined) {
        return $(context).find(selector)
      }
      // 5-5  以上都不符合，则slector作为Css选择器看待，则直接使用zepto.qsa查询出dom
      // And last and least, if it's a CSS selector, use it to select nodes.
      else {
        dom = zepto.qsa(document, selector)
      }
    }
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
  /**
   * 遍历elements所有元素， 并执行callback, 返回值还是elements
   * 函数的使用请参考zepto文档 - $.each
   */
  $.each = function(elements, callback) {
    var i, key
    // 遍历执行callback
    if (likeArray(elements)) {
      // 如果elements是类数组
      for (i = 0; i < elements.length; i++) {
        if (callback.call(elements[i], i, elements) === false) {
          return elements
        }
      }
    } else {
      // 如果elements不是类数组 而是对象之类的 不能用i来进行遍历的
      for (key in elements) {
        if (callback.call(elements[i], i, elements[i])) {
          return elements
        }
      }
    }
    return elements
  }

  /*---------------------------（三) 程序中除了函数定义 还有一些脚本语句在执行------------------------------------ */
  // 遍历定义class2type
  $.each('Boolean Number String Function Array Date RegExp Object Error'.split(' '), function(i, name) {
    class2type["[object" + name + "]"] = name.toLowerCase()
  });
  
  /*---------------------------（四）$(selector).fn() （对外暴露的一些关于元素的方法）--------------------------------- */
  $.fn = {
    /*========= (1)继承一部分js原有的方法 特别是Array的 ==========*/
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    /*========= (2)自定义方法 ==========*/
    // 用来测试一下 $(selector).test() 是否可以成功调用
    test: function () {
      console.log('可以调用哦')
    },
    /**
     * 读取/设置元素的属性
     * 不会就去查 不要抖动哆嗦 浪费时间 拖泥带水
     * 新增点：
     * 1- Arguments
     * 2- nodeType
     * 根据doc可知：
     * 1- 当只传入一个参数时，是用来读取该name的属性值的 -- 当然要对name的情况做一系列的分流
     * 2- 当传入2个参数时  就是把value设置在this的各个节点（遍历）的属性name上
     */
    attr: function(name, value) {
      var result
      // 当只传入一个参数时 读取属性值
      // 当name为字符串 && 第二个参数未传入时
      (typeof name === 'string' && !(1 in arguments))
        ? // this(实际上就是调用attr()的$())长度为0 || this[0] 不是一个节点元素  ==> 就是无效的查询参数
        (!this.length || this[0].nodeType !== 1)
          ?
          undefined
          : // 尝试通过getAttribute()获取attr -- 获取成功就返回这个attr(这里其实也是一个赋值的过程)
            //&& name是否为this(0)对象的属性 -- 是就返回这个属性值
          (!(result = this[0].getAttribute(name)) && name in this[0] ) 
            ?
            this[0][name]
            :
            result
        :
      // 当传入有第二个参数时 设置属性值
      // 2- 遍历节点
      this.each(function() {
        // 2-1  当前节点不是元素节点时  无效值 返回
        if (this.nodeType !== 1) return 
        // 2-2 name是一个对象 用来描述属性的键值对关系
        if (isObject(name)) {
          for (key in name) {
            setAttribute(this, key, name[key])
          }
        }
        // 2-3 设置单一属性  -- 要注意value是函数和非函数两种情况
        else {
          setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        }
      })
    },
    // 添加一个事件侦听器，当页面DOM加载完毕 “DOMContentLoaded” 事件触发时触发。建议使用 $()来代替这种用法
    ready: function(callback) {
      // 这里是关于document对象 在Ie中的兼容处理
      // need to check if document.body exists for IE as that browser reports
      // documnet ready when it hasn't yet created the body element

      // 下文定义： readyRE = /complete|loaded|interactive/,
      if (readyRE.test(document.readyState) && document.body) callback($)
        else document.addEventListener('DOMContentLoaded', function() {
          callback($)
        }, false)
      // 返回当前对象 就是调用者 $(selector)
      return this
    }
  }
  /*---------------------------（五）整个匿名函数（工厂方法）返回值（还是个工厂方法）原型链的构建----------------------------- */

  // me； 这里应该是一种补充，当我们没有使用$()生成Z对象时，此时$中的Z.prototye没有指向$.fn 所以这里补充一下
  zepto.Z.prototype = $.fn

  // 把zepto作为$的成员 -- 一并返回
  $.zepto = zepto
  // 该匿名工厂方法返回值(就是我们平时用的$--本身就是一个)
  return $
})()

// 定义两个全局变量
window.ZeptoMin = ZeptoMin
// 起一个简易的别名$ 考虑命名冲突/污染的问题
window.$$ === undefined && (window.$$ = ZeptoMin)