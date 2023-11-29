

## 参考
- 《深入浅出vue》
- [掘金小测-vue运行机制](https://juejin.cn/book/6844733705089449991)
- [剑指前端](https://github.com/HZFE/awesome-interview)

## 原理

### 依赖收集
- 依赖收集时机：一个Vue实例创建时 - 变成响应式对象 - 在getter被触发的时候 就会触发收集依赖的逻辑

### 双向绑定原理
- Vue本质是单向数据流
- 双向数据流：只是v-model语法糖

### 核心原理：运作流程
1. Vue 会遍历 data 所有的 property，并使用 Object.defineProperty 把这些 property 全部转为 getter/setter，每个组件实例都对应一个 watcher 实例，它会在组件渲染的过程中把“接触”过的数据 property 记录为依赖。之后当依赖项的 setter 触发时，会通知 watcher，从而使它关联的组件重新渲染。
  - 渲染是以组件为单位的，一个组件对应一个watcher
  - 依赖收集：是在渲染时，会把接触过的数据记录为依赖，每个data被set时，会触发它对应的Dep对象，所以，Dep是和data对应的。Dep中有收集到的Watcher,就是对应的依赖，也就是对应的组件。watcher会进行update,这个过程就会通知这个组件进行更新，这个更新过程就是patch了，在这个过程中，会进行diff算法，对组件的新旧vNode进行比对，从而精准地进行DOM操作。
  - 其实，diff和patch的动作，就都封装在了watcher.update中了，或者update也只是通知的作用，真正的动作在订阅了update的回调中
  - 总结：状态变化后,会通知到组件，组件会使用vNode进行比对。
2. 关于依赖收集的时机：
  - 1、既然模板渲染需要用到某个数据，那么一定会对这个数据进行访问，所以只要拦截getter，就有时机做出处理,所以在getter里，我们进行依赖收集（所谓依赖，就是这个组件所需要依赖到的数据）
  - 所有通过 new 操作符调用 Watcher 生成新对象的行为都会产生依赖收集，比如computed，watch，模板文本 {{obj.a}} ,v-bind,v-model 等都会产生依赖收集行为。
当有新的Watcher实例生成时会执行get方法，而get方法内的代码是这样的：
  - 依赖：是什么？Dep Watcher 又是怎样的一个数据结构？
  - 发生的时机：在初始化 Vue 的每个组件时，会对组件的 data 进行初始化，就会将由普通对象变成响应式对象，在这个过程中便会进行依赖收集的相关逻辑
3. 依赖收集在Dep中, 依赖就是Watcher（其实一个组件就对应一个Watcher），一般一个data对应一个Dep, 一个组件对应一个Watcher

### 关于响应式：Watcher Dep
- 既然模板渲染需要用到某个数据，那么一定会对这个数据进行访问，所以只要拦截getter，就有时机做出处理,所以在getter里，我们进行依赖收集（所谓依赖，就是这个组件所需要依赖到的数据）
- 依赖收集：Watcher订阅者是Observer和Compile之间通信的桥梁，主要做的事情是: ①在自身实例化时往属性订阅器(dep)里面添加自己 ②自身必须有一个update()方法 ③待属性变动dep.notice()通知时，能调用自身的update()方法，并触发Compile中绑定的回调，则功成身退。
- 一个组件对应一个Watcher（自身有一个update方法），一个属性有自己的dep队列，当属性变化时，会触发自身dep队列中的每个Watcher.update()
- 所以 vue的渲染粒度是组件

### vue2 简易响应式处理方案
- [bilibili-vue2响应式处理](https://www.bilibili.com/video/BV1VA411x76D?p=3&vd_source=9365026f6347e9c46f07d250d20b5787)
```js
const data = {
  name: '小米',
  color: {
    red: '1'
  }
}

// 将data处理为响应式的数据
observer(data);

/**
 * 构造数组的响应式原型
 * 用AOP切入响应式逻辑的一个数组原型,这个原型上的push之类的方法都切入了响应式的逻辑
 */
const _ArrayProto = ObserverArrayProto();

function ObserverArrayProto () {
  const ArrayMethods = ['push', 'pop'];

  const oldArrayProto = Array.prototype;
  // 利用实例简历原型链 - newArrayProto可以找到其他所有的原来数组的方法属性,这里我们会对需要进行相应式的方法在新原型上进行重新定义
  const newArrayProto = Object.create(oldArrayProto); 

  ArrayMethods.forEach((method) => {
    // 缓存旧数组操作方法
    const oldMethod = oldArrayProto[method];
    // 重新定义新的数组操作方法
    newArrayProto[method] = function (...args) {
      // 缓存本应的返回值
      const result = oldMethod.apply(this, args); 
      // 切入的逻辑：响应式的逻辑
      console.log('这里触发响应式逻辑：需要重新diff-patch');
      // 返回数组本来的返回值
      return result;
    }
  });

  return newArrayProto;
}


// 将一个对象处理为响应式对象
function observer (target) {
  // 处理基础类型
  if (typeof target !== 'object' || target === null) {
    return target;
  }
  // 处理数组:数组这里是对需要响应式的数组 替换其隐式原型 - 原型走我们用AOP切入响应式逻辑的一个数组原型,这个原型上的push之类的方法都切入了响应式的逻辑
  if (Array.isArray(target)) {
    // 响应式数组的原型需要替换为响应式原型 这样找方法优先找到的是响应式原型AOP改写后的方法
    target.__proto__ = _ArrayProto;
  }
  // 处理object 递归处理每一个属性 （基础类型在Observer函数入口处处理了）
  for (let key in target) {
    if (target.hasOwnProperty(key)) {
      defineReactive(target, key, target[key]);
    }
  }
}

// 这里为数据增加响应式 - 通过defineProperty增加响应式
function defineReactive (target, key, val) {
  // 深度观察 - 基础类型在Observer函数入口处处理了，主要处理target是一个对象的情况(这里是color) 需要递归观察
  observer(target);

  Object.defineProperty(target, key, {
    get (val) {
      // 这里一般是依赖收集的动作
      return val;
    },
    set (newVal) {
      // 这里也需要一次深度观察 凡是对象都需要深度观察：这里有可能设置的值是一个对象 这个对象就需要被observer起来
      observer(target);

      if (newVal !== val) {
        console.log('这里触发响应式逻辑：需要重新diff-patch');
        this[key] = newVal;
      }
    }
  });
}

// data 新增/删除 属性 需要开发者需要手动调用 Vue.set() 和 Vue.delete() 来手动监听
```

### [code]vue3的响应式处理方案


### diff算法
- [bilibili-哈默-diff](https://www.bilibili.com/video/BV1dV411a7mT/?p=3&vd_source=9365026f6347e9c46f07d250d20b5787)
  - 同层比较
  - tagName不一样，则直接删除，不会进行深度比较
  - tagName + key都一致，则认为是相同节点，不进行深度比较
1. 关于vNode的操作：增 删 改
  - 更新节点：这个过程会发生diff
  - 通过对比找出新旧2个节点不一样的地方 针对不一样的地方 进行更新：通层比较
    - 相同节点：新旧node对象完全一样 停止更新
    - 静态节点：停止更新(因为内容和data等动态数据无关，所以不会变化，无需更新)
    - 新虚拟节点：（渲染以新节点为准，old节点作为比对来精确确定渲染dom的动作）
      - 有文本属性
        - 文本新旧不同,直接更改文本
      - 无文本属性
        - 无children的情况
          - 则说明新节点是空节点，则对旧节点对应的dom：进行清空：删除子节点或者文本
        - 有children的情况
          - 旧节点没有子节点
            - 将新接地那的children创建成真实的dom 并插入到视图的DOM节点下
          - 旧节点有子节点
            - 更新子节点 看看下一个段落 详细描述：
2. 更新子节点（列表）：
  - 主要操作：更新 新增 删除 移动
  - 通过循环比对，循环遍历newChildren，每循环到一个新子节点，就去oldChildren中找下和当前节点相同的节点
    - 找不到 则说明当前子节点是新增的 进行新增操作
    - 找到了 更新操作
      - 找到了 但是位置不一样 需要做移动操作
  - 更新的策略：
    - 创建
      - 场景：在oldChidren中未找到本次循环所指向的新节点
      - 插入位置: 创建节点 并将新节点插入到oldchildren中所有未处理节点的前面
    - 更新
      - 场景：当一个节点同时存在于newChildren和oldChildren中, 是同一个节点，位置也相同
      - 插入位置: 位置不变，这里的操作就和我们之前的更新节点是一样的：是否静态啊之类的 参见上一节
    - 移动
      - 场景：节点相同 但是位置不同
      - 插入位置: 以新节点的位置为准，因为对比2新旧2个子节点列表是从左向右循环遍历的，所以新节点的左边都是已经处理过后的，那么当前节点需要移动到的位置就是所有未经处理的节点的左边（前面）。也就是在dom中找到这个节点，将它移动到所有未处理的节点的前面即可。
    - 删除
      - 场景：在oldChildren中存在 但是newChildren中不存在的节点。也就是newChildren已经被遍历结束了，但是oldChildren中还有未被处理过的节点，这些节点就是需要删除的节点
      - 插入位置：就地删除

2. key的作用
  - 用来标记一个节点：是否一样，也就是标记节点的唯一性
  - index不能唯一标识一个节点 节点的index会因为顺序的改变，也就是顺序变了后，原来的index不一定指向原来的节点了
  - Key 值来判断该元素是新近创建的还是被移动而来的元素，从而减少不必要的元素重渲染此外，
  - key是用于追踪哪些列表中元素被修改、被添加或者被移除的辅助标识。在开发过程中，我们需要保证某个元素的 key 在其同级元素中具有唯一性。

3. 为什么不要使用index作为key?
  - https://juejin.cn/post/6844904113587634184#heading-9
  - 例如这个场景，2个节点完全不一样，但是排序后index一样，其实 就是key + tagName一致的话 会判定为sameNode(这里就失真了，本来就不是同一组件，应该在这一层就处理掉),然后接下来就会递归进行对比子组件，结果子组件完全不一样，造成很大的性能开销

### Vue异步更新策略 
- 异步更新：
  - 当我们使用 Vue 或 React 提供的接口去更新数据时，这个更新并不会立即生效，而是会被推入到一个队列里。待到适当的时机，队列中的更新任务会被批量触发。这就是异步更新。
  - 其实就是批量更新，例如多次setData,但是更新在异步，那么，会以setData的最终结果为准：
  ```js
  // 任务一
  this.content = '第一次测试'
  // 任务二
  this.content = '第二次测试'
  // 任务三
  this.content = '第三次测试' 
  // 我们在三个更新任务中对同一个状态修改了三次，如果我们采取传统的同步更新策略，那么就要操作三次 DOM。但本质上需要呈现给用户的目标内容其实只是第三次的结果，也就是说只有第三次的操作是有意义的——我们白白浪费了两次计算。但如果我们把这三个任务塞进异步更新队列里，它们会先在 JS 的层面上被批量执行完毕。当流程走到渲染这一步时，它仅仅需要针对有意义的计算结果操作一次 DOM——这就是异步更新的妙处。

  // Vue异步执行DOM更新。只要观察到数据变化，Vue将开启一个队列，并缓冲在同一事件循环中发生的所有数据改变。如果同一个watcher被多次触发，只会被推入到队列中一次。这种在缓冲时去除重复数据对于避免不必要的计算和DOM操作上非常重要。然后，在下一个的事件循环“tick”中，Vue刷新队列并执行实际 (已去重的) 工作
  ```
- vue.nextTick
  - 批量setData -> 进入队列 -> 批量渲染DOM -> Vue.nextTick
  - 在nextTick中的逻辑 可以保证当前同步逻辑执行完成后再执行
  - 降级策略： promise.then -> setImmediate -> MessageChannel -> setTimeout.
  - this.$nextTick(fn)只是把传入的fn置入callbacks之中。也就是说，在tick中，当flush完所有的渲染后，会执行我们通过this.$nextTick注册的函数
  - 那么，Vue￥nextTick本质上是一个回调函数注册器，不是真正的nextTick


### vue.$mount
- 默认情况下我们的模版 index.html 里面有一个 id 为 app 的 div 元素。我们最终的应用程序代码会**替换**掉这个元素，也就是 <div id="app"></div>；对，我们 Vue 渲染出来的内容是替换掉它，而不是插入在这个节点中。

### defineProperty的缺陷
- 以下情况无法触发：
  - 数组
    - 下标修改数据，数组的长度改变
    - 一些方法执行：push pop等
  - 对象
    - 新增和删除属性

### 如何拦截数组的操作？？
- 为什么vue不使用Object.defineProperty来完成对数组的监听呢？通过网上查阅，发现使用Object.defineProperty监听数组性能很差，方便性得到的好处小于性能带来的损失，得不偿失。
- 其实 就是 在ArrayPrototype和数组之间增加一个原型，在这个原型上重写了原来的数组方法（根据方法沿着原型链访问，就等于在到达数组之前的先访问了中间层原型的方法，本质就是拦截了），并用AOP的方式植入了响应式的逻辑。
- 中间层我们给他起个名字middleLayer, 我们让数组实例array的__proto__属性指向middleLayer, middleLayer的__proto__属性指向Array.prototype，这样，当我们通过实例去访问数组的变异方法时，根据原型链的查找规则，会先在middleLayer对象中查找， 这样，我们就实现了对数组变异方法的拦截， 代码如下
```js
// 数组的变异方法
const variationMethods = ['splice', 'sort', 'push', 'pop', 'reverse', 'shift', 'unshift']
// 缓存数组的原型对象
const tmpArrayPrototype = Array.prototype
// middLayer继承数组的原型对象，即middleLayer.__proto__ = Array.prototype
const middleLayer = Object.create(Array.prototype)
variationMethods.forEach(method => {
  // 变异方法全部在middleLayer对象上实现一遍
  middleLayer[method] = function(...args) {
    // 实际执行的还是Array.prototype对象上的方法
		const result = tmpArrayPrototype[method].apply(this, args)
    console.log(`拦截到了${method}方法的执行`)
    // 在这里做一些vue响应式的额操作 例如 Dep.update()
    return result
  } 
})

// 更改下数组实例的原型链指针 指向，这样优先查找到的就是 middLayer上重写的方法
const arr = []
arr.__proto__ = middleLayer
// 由于_proto__不是每个浏览器都支持 所以 下面直接将方法挂载到实例上
const arr = []
const arrayKeys = Object.getOwnPropertyNames(middleLayer)
arrayKeys.forEach(method => {
  Object.defineProperty(arr, method, {
    enumerable: false, // 不允许枚举出来 也就是不污染数组实例的枚举属性
    writable: true,
    configurable: true,
    value: middleLayer[method]
  })
})
```

### 虚拟DOM
- [bilibili-vue:v-dom和diff](https://www.bilibili.com/video/BV1dV411a7mT/?vd_source=9365026f6347e9c46f07d250d20b5787)

### vNode的优点
- 减少频繁的DOM操作，符合MVVM模型
- 利于跨平台，跟平台耦合度较低
- 相比于DOM直接操作，保证了性能下限

### patch过程
- tempalte -> renderFn -> DOM
- 更新：
  - new VNode Tree -> old VNode Tree ,比对后记录下两棵树的差异
  - 将记录的2棵树的差异应用到真正的DOM中去

### key的作用
1. 用来标记唯一元素，当diff中，tagName一致，并且key一致时，会人为是同一元素，采用复用的策略，跟踪元素身份，实现高效复用
2. index作key的话，不能保证key唯一标记对应的元素，排序后，key和元素会对不上

### 依赖收集
- [bilibili-依赖收集原理](https://www.bilibili.com/video/BV1W34y197UB?spm_id_from=333.337.search-card.all.click&vd_source=9365026f6347e9c46f07d250d20b5787)
- data每个属性对应一个dep，dep里会存放依赖于这个属性的watcher
- 依赖收集的过程：在页面渲染的时候，会访问属性，会触发属性相关的get钩子,在get中会dep.depend(),会收集依赖（就是把watcher加入到dep中）。
- watcher应该是以组件为粒度，也就是一个组件对应一个watcher,当属性被set时，会dep.notify(),会让通知订阅的watcher都发生渲染（diff-patch）;

## 生命周期

### 生命周期hook
- create: 创建vue实例
  - beforeCreade:
  - created: 实例创建完成，data等可以访问,可以ajax了哦
    - 如果要访问DOM, 可以将访问DOM的代码放在vue.$nexttick中
    - 建议将ajax请求放在这个时机中哦
- mount: 将实例渲染成html + 挂载到页面上
  - beforeMounted: 实例 -> html，但还未挂载到页面上
  - mounted: 挂载到页面中，可以访问vm.$el
- update:
  - beforeUpdate: 响应式数据已经改变，但是DOM还未改变
  - updated：DOM已经更新，避免在此更新data,容易导致无限循环
    - 服务端渲染期间不会调用
- destroy:
  - beforeDestroy：实例仍可用，this可获取到实例
  - destroyed

keep-alive：
  - deactivated:当组件被换掉时，会被缓存到内存中、触发
  - activated: 当组件被切回来时，再去缓存里找这个组件、触发

### 父子组件生命周期函数执行顺序
- 加载
  - 父：created -> beforeMounted
  - 子：...beforeMounted -> mounted
  - 父：mounted
- 更新
  - 父：beforeUpdate
  - 子：beforeUpdate -> updated
  - 父：updated
- 销毁
  - 父：beforeDestroy
  - 子：beforeDestroy - updated
  - 父：destroyed

## 高频考点

### keep-alive
- 当组件在keep-alive内被切换时组件的activated、deactivated这两个生命周期钩子函数会被执行 被包裹在keep-alive中的组件的状态将会被保留
- 原理：
  - 内部cache的淘汰算法用的是：LRU

### v-if&&v-show
- v-if是动态的向DOM树内添加或者删除DOM元素；
  - v-if值为false时，在该位置创建一个注释节点，用来标识元素在页面中的位置。在值发生改变的时候，通过diff，新旧组件进行patch，从而动态显示隐藏。
- v-show是通过设置DOM元素的display样式属性控制显隐；
  - v-show值为false时，通过设置元素的css，display:none来控制元素是否展示。
- v-if有更高的切换消耗；v-show有更高的初始渲染消耗；
#### 为什么v-show底层使用display:none?
- [为什么v-show底层使用display:none](https://juejin.cn/post/7005850379011227678)
```
简单的来说就是
display:none; 元素将会从DOM树中移除，而且其所有的子元素都不会显示，我们不能在这里进行事件或者DOM操作。
visibility:hidden; 元素会被隐藏，并且会占据原来的位置，整体布局不会改变，我们可以操作DOM，子元素设置为visible还是可以显示。
看到这里实际上我还是有点疑惑的，因为v-show适合频繁切换的场景，但是这里操作display:none会带来回流的问题呀。
实际上，如果v-show用visibility:hidden;的话，相当于此元素变成透明，还是会占据原来的位置。这里v-show的应用场景是不能占用原来的位置的，所以这里用了display:none;
```

#### 基础类型的响应式方案

### v-model
- value + input的语法糖
```html
<input
  v-bind:value="searchText"
  v-on:input="searchText = $event.target.value"
>
```
### $nexttick
- nextTick 不仅是 Vue 内部的异步队列的调用方法，同时也允许开发者在实际项目中使用这个方法来满足实际应用中对 DOM 更新数据时机的后续逻辑处理

### vue复用方案
- [官网-复用专题](https://cn.vuejs.org/v2/guide/mixins.html)
- 复用的方案：
  - mixin
  - 自定义指令
  - 渲染函数 & jsx
  - 插件
  - 过滤器
  - extends

### $set的用法
```js
data () {
  return {
    student: {
      name: '',
      sex: ''
    }
  }
}
mounted () { // ——钩子函数，实例挂载之后
  // this.student.age = 24 // 不触发响应式
  this.$set(this.student,"age", 24) // 触发响应式
}
```

### computed vs watch
- 总结：
  - computed 计算属性 : 依赖其它属性值，并且 computed 的值有缓存，只有它依赖的属性值发生改变，下一次获取 computed 的值时才会重新计算 computed 的值。
  - watch 侦听器 : 更多的是观察的作用，无缓存性，类似于某些数据的监听回调，每当监听的数据变化时都会执行回调进行后续操作。
- 运用场景：
  - 当需要进行数值计算,并且依赖于其它数据时，应该使用 computed，因为可以利用 computed 的缓存特性，避免每次获取值时都要重新计算。
  - 当需要在数据变化时执行异步或开销较大的操作时，应该使用 watch，使用 watch 选项允许执行异步操作 ( 访问一个 API )，限制执行该操作的频率，并在得到最终结果前，设置中间状态。这些都是计算属性无法做到的。
  - computed 的使用场景可以被 watch 覆盖这一结论。但在具体的使用上还是优先考虑 computed，因为相同场景下 watch 所需的代码量和性能开销一般来说会比 computed 大

## 组件通信
```
因为父组件->子组件： props是现成的主流方案
其实组件通信主要是考察：
父组件获取子组件信息
兄弟组件的互相通信
```
- props+$emit （父子）
- eventBus: $emit / $on （兄弟组件通信）
  - eventBus可以自己开发 也可以使用用new Vue()
  ```js
  // compA
  eventBus.$emit('eventName', { a: 1 })
  // compB
  eventBus.$on('eventName', (param) => {
    this.b = param.a;
  })
  ```
- provide / injext （隔代通信）
  - 注意：有一个通信方案：状态提升，提升到父组件 然后向下派发：
  - 本质上是2个hook:
  ```js
  // 祖先节点 
  // provide很像data
  provide() { 
    return {     
        num: this.num,
        app: this // 传递所有属性
    };
  }
  // 子孙节点
  inject: ['num', 'app']
  console.log(this.num);
  console.log(this.app.num);
  ```
- ref/$refs
  - 获取当前子组件数据
  ```vue
  <template>
    <comp1 ref="child"></comp1>
  </template>
  <script>
    export default {
      console.log(this.$refs.child.data1);
      console.log(this.$refs.child.method1());
    }
  </script>
  ```
- $parent/$root $children （对各个层级的实例引用）
  - this.$children[0].message = 'JavaScript'
- 借助vuex 统一管理状态

## vue-router

### 前端路由原理
  - 目的：为了SPA能够无刷新地更改url-history
  - 借助hash 或者 H5 history-api，
    - 监听：url的变化
    - 设置: push replace
      - 注意：push会引起监听事件
      - replace不会引起监听事件
    - ？？那么 render是放在哪儿呢？
- vue-router的实现?
- 经典使用场景?
- hash 和 history模式的区别
  - History 直接修改浏览器 URL，用户手动刷新页面，后端接受到是不同的地址，需要后端做处理跳转到统一的html页面。
    - 具体：但倘若我们手动刷新，或输入URL直接进入页面的时候， 服务端是无法识别这个 URL 的。因为我们是单页应用，只有一个 html 文件，服务端在处理其他路径的 URL 的时候，就会出现404的情况。 所以，如果要应用 history 模式，需要在服务端增加一个覆盖所有情况的候选资源：如果 URL 匹配不到任何静态资源，则应该返回单页应用的 HTML 文件
  基于hash的路由：
    看起来比较丑
    会导致锚点功能失效
  但：
    兼容性更好
    无需服务器配合
- hash
  - URL 中 hash 值只是客户端的一种状态，也就是说当向服务器端发出请求时，hash 部分不会被发送。
  - hash 值的改变，都会在浏览器的访问历史中增加一个记录。因此我们能通过浏览器的回退、前进按钮控制hash 的切换
  - hash中的replace实现：
    - window.locationl.replace(this.getUrl(path)) // 这里根据hash path生成新的完整url 然后replace location
- history 
  - history.pushState() 或 history.replaceState() 不会触发 popstate 事件，这时我们需要手动触发页面渲染；
  - [关于state](https://www.tangshuang.net/2287.html)
    - 说白了，state就是我们用于保存到history序列中的一个数据集合。我们可以在pushState之前，先构建自己的state，里面可以存放很多我们在监听window.popstate事件时所需要的东西。
    ```js
    // 注册与该history url对应的state 在onHashPop中可以获得该数据
    var state = {
      title: title,
      url: url,
      content: $('body').html(),
      prev: window.location.href,
      time: (new Date()).getTime()
    };
    history.pushState(state, title, url);
    // 获取数据
    window.onpopstate = function(event) {
      var state = history.state; // 等价于 
      var state = event.state;
      if(state && state.content) $('body').html(state.content);
    };
    ```

### 懒加载？
- 需要webpack配合？
  - 是的 webpack会根据分割点进行分割打包，分割点：
    - webpack.splitchunk的配置
    - vue-router懒加载 - 动态加载的依赖会单独打包
    - vue组件懒加载-动态加载-单独打包
- 懒加载：
  - 路由懒加载
  - 组件懒加载
  ```js
  const comp = () =>  import('./comp')

  // vue config
  {
    'comp': comp
  }
  ```
- 路由懒加载三种方式：
```js
new Router({
 routes: [{
   path: '/a',
   name: 'hello',
   // （主流）形式1 ES import，- 需要配置巴格莱：打开babel.config.js文件，将@babel/plugin-syntax-dynamic-import配置到plugins数组当中
   component: () => import(/* webpackChunkName: "chunk-1" */'@components/Hello');
   // 形式2 require动态加载
   component: resolve => require(['@components/Hello'], resolve)
   // 形式3 webpack require.ensure - require.ensure这个方式就不记了
   component: r => require.ensure([],() =>  r(require('@/components/HelloWorld')), 'home')
 }] 
})
```

### hash & history
- hash
```js
hash & window.onhashchange(event) {
  event.oldURL
  event.newURL
}
```
- history:
  - 需要后端配置支持 否则 会404
    - hash & window.onhashchange(event) {}
  - api:
    - 修改历史状态：pushState() replaceState()
    - 切换历史状态: forward() back() go()console.log('', )

### 路由参数传递？动态路由
参数传递：
- 动态路由
```js
// js 跳转
this.$router.push({
  path: `/describe/${id}`,
})
// 路由配置
{
  path: '/describe/:id'
}
// 获取参数
this.$route.params.id
```
- params:
  - url中不显示，传值
  - 刷新会丢失携带的数据
  ```js
  // 上一页
  this.$route.push({
    name: 'Describe',
    params: {
      id: id
    }
  })
  // 路由配置 可以加：id 也可以不加，加的话 会在url中显示
  // 下一页
  this.$route.params.id
  ```
- query
  - url中携带，相当于拼接在url中
  - 刷新不会丢失携带的数据
  ```js
  // 传递
  this.$router.push({
    path: '/xxx',
    query: {
      id: id
    }
  })
  // 获取
  this.$route.query.id
  ```
- 直接手动拼接到url中
获取参数：
- this.$router.query

### js跳转
- <router-link>底层也是调用这2个api
- this.$router.push()
  - <router-link to="xxx">
- this.$router.replace()
  - <router-link to="xxx" replace>
  - this.push()
- this.$router.go()

### 导航守卫
- 其实就是拦截器
- 全局钩子：（一般全局before优先， after垫后）
  - router.beforeEach
  - router.beforeResolve - beforeRouteEnter之后调用
  - router.afterEach
- 单个路由钩子：
  - beforeEnter: 配置在route中
- 组件内钩子：
  - beforeRouteEnter:进入组件之前会被调用
  - beforeRouteUpdate：例如：在 /foo/1 和 /foo/2 之间跳转的时候，由于会渲染同样的foa组件，这个钩子在这种情况下就会被调用
  - beforeRouteLeave：离开组件被调用

### 动态路由
- router.addRoute()
- router.removeRoute()

### 嵌套路由
- route配置中增加children配置
- 组件中可以用<vue-router>对渲染位置进行占位

### vue-router前端路由原理
```
前端路由其实就是感知路由现在走到了哪儿
然后映射到相关的组件渲染
渲染就交给vue了 自己确认渲染的组件和地方
（<router-view>更像个占位符）
```
- [参考](https://www.hepengfei.net/vue/122.html)
- 核心：
  - VueRouter核心是，通过Vue.use注册插件，在插件的install方法中获取用户配置的router对象。当浏览器地址发生变化的时候，根据router对象匹配相应路由，获取组件，并将组件渲染到视图上。
- url变化，但是不能刷新，不能向服务器请求
- 浏览器默认展示history最上面的url
- 2大场景：
  - 代码中跳转：
    - hash: 
      - push = window.location.hash = xxx
      - replace = window.location.replace(xxx)
    - hostory:
      - push = history.pushstate
      - replace = history.replaceState
  - 地址栏输入url后刷新：
    - hash:
      - 监听：window.hashchange,在该事件回调中，直接调用this.replace()
    - hostory:
      - 监听：popstate事件，在该事件中，直接调用this.replace()
- 渲染流程：
```js
this.$router.push(path)
 -->  
HashHistory.push() 
--> 
History.transitionTo() 
--> 
const  route = this.router.match(location, this.current)会进行地址匹配，得到一个对应当前地址的route(路由信息对象)
-->
History.updateRoute(route) 
 -->
 app._route=route (Vue实例的_route改变)   由于_route属性是采用vue的数据劫持，当_route的值改变时，会执行响应的render( )
-- >
vm.render()   具体是在<router-view></router-view> 中render
 -->
window.location.hash = route.fullpath (浏览器地址栏显示新的路由的path)
```

### hash 和 history模式的比较
- pushState设置的新URL可以是与当前URL同源的任意URL；而hash只可修改#后面的部分，故只可设置与当前同文档的URL。
  - 其实就是设置hash的动作是这样的：window.location.hash = xxx,比较有局限性
  - 后面的路由都是：url#a/b/c 这样的
- pushState设置的新URL可以与当前URL一模一样，这样也会把记录添加到栈中；而hash设置的新值必须与原来不一样才会触发记录添加到栈中。
- pushState通过stateObject可以添加任意类型的数据到记录中；而hash只可添加短字符串。
- pushState可额外设置title属性供后续使用。

### hitory模式的配置
- 需要在后端进行额外配置
- 原因：如果没有适当的服务器配置，用户在浏览器中直接访问 https://example.com/user/id，就会得到一个 404 错误（其实就是在地址栏直接输入url会导致404）
- 解决方案：要解决这个问题，你需要做的就是在你的服务器上添加一个简单的回退路由。如果 URL 不匹配任何静态资源，它应提供与你的应用程序中的 index.html 相同的页面（后端将url定位到index.html，返回整个SPA的index.html,然后你在popstate#callback中进行前端路由加载）

## vuex

### 使用
```js
// 定义store 可以分模块
const store = new Vuex.Store({
  state: {
    count: 0
  },
  mutations: {
    increment (state) {
      state.count++
    }
  },
  actions: {
    increment (context) {
      context.commit('increment')
    }
  }
})


// 注册
new Vue({
  el: '#app',
  store
})

// 组件中使用
this.$store.commit('increment') // 直接触发mutation
// 通过action触发
this.$store.dispatch('increment');

```

### vuex的模块化
```js
const moduleA = {
  state: () => ({ ... }),
  mutations: { ... },
  actions: { ... },
  getters: { ... }
}

const moduleB = {
  state: () => ({ ... }),
  mutations: { ... },
  actions: { ... }
}

const store = new Vuex.Store({
  modules: {
    a: moduleA,
    b: moduleB
  }
})

store.state.a // -> moduleA 的状态
store.state.b // -> moduleB 的状态
```

### mutation为甚不能做异步操作
- Vuex中所有的状态更新的唯一途径都是mutation
- 每个mutation执行完成后都会对应到一个新的状态变更，这样devtools就可以打个快照存下来，然后就可以实现 time-travel 了。如果mutation支持异步操作，就没有办法知道状态是何时更新的，无法很好的进行状态的追踪，给调试带来困难。

### vuex严格模式
- 状态更改必须由matation引起，否则将抛出错误
```js
new Vuex.Store({
  strict: true
})
```

### getter + mapGetters
```js
import {mapGetters} from 'vuex'
export default{
    computed:{
        ...mapGetters(['total','discountTotal'])
    }
}
```

### 将mutation映射到method上
```js
import { mapMutations } from 'vuex'

export default {
  // ...
  methods: {
    ...mapMutations({
      add: 'increment' // 将 `this.add()` 映射为 `this.$store.commit('increment')`
    })
  }
}
```

## vue3.0

### vue3.0 Vs 2.0
- 监测机制：proxy -> defineProperty
- 使用TS实现 对TS支持较好

### defineProperty和proxy的区别
- [defineProperty和proxy的区别](https://segmentfault.com/a/1190000041084082)
- defineProperty的缺陷：
  - 增加 删除对象属性 监测不到
    - 需要手动使用：vue.set vue.delete去处理（会触发响应式）
  - 数组下标、长度变化 + 数组的api 监测不到
    - 使用AOP对数组的方法进行重写，将响应式的逻辑切入进去
  - 会改变原始数据
  - 需要对每个属性进行遍历监听，如果嵌套对象，需要深层监听，造成性能问题
- proxy优点：
  - roxy的监听是针对一个对象的，那么对这个对象的所有操作会进入监听操作，这就完全可以代理所有属性了
    - 其实就是不用遍历属性，利好性能 
  - 全方位监测 对象 数组的变化
  - 不会改变原始数据 会提供一个代理对象
  - 支持Map Set WeakMap WeakSet
- Proxy和defineProperty的一个共同特性，不支持对象嵌套。需要递归去实现。
  - 关于proxy的实现：
  - [Vue3.0里为什么要用 Proxy API 替代 defineProperty API ？](https://github.com/febobo/web-interview/issues/47)
  ```js
  function reactive(obj) {
      if (typeof obj !== 'object' && obj != null) {
          return obj
      }
      // Proxy相当于在对象外层加拦截
      const observed = new Proxy(obj, {
          get(target, key, receiver) {
              const res = Reflect.get(target, key, receiver)
              console.log(`获取${key}:${res}`)
              // 关键语句：如果属性是个对象 需要递归设置代理
              return isObject(res) ? reactive(res) : res;
          }
        }
      )
      return observed
  }
  ```

## vue vs React
- 参考：
  - [剑指前端-diff](https://febook.hzfe.org/awesome-interview/book3/frame-diff#1-diff-%E7%AE%97%E6%B3%95)
  - [剑指前端-vue和React的区别](https://febook.hzfe.org/awesome-interview/book4/frame-react-vs-vue)
- 更新DOM时机：
  - Vue基于snabbdom库，它有较好的速度以及模块机制。Vue Diff使用双向链表，边对比，边更新DOM。
  - React主要使用diff队列保存需要更新哪些DOM，得到patch树，再统一操作批量更新DOM。
- Vue 的 Diff 算法和 React 的类似，只在同一层次进行比较，不进行跨层比较。
  - 这一句的话理解是：也就是判定2个节点的是否异同，不会去考量其子节点的异同。当前节点考量的无非就是tagName key 之类的。
  - 这就是 所谓的同层比较
  - 如果两个元素被判定为不相同，则不继续递归比较

# vuex
## vuex中为什么把把异步操作封装在action，把同步操作放在mutations？
- [vuex中为什么把把异步操作封装在action，把同步操作放在mutations？](https://www.zhihu.com/question/48759748/answer/112823337)
  - 尤雨溪：
    - 区分 actions 和 mutations 并不是为了解决竞态问题，而是为了能用 devtools 追踪状态变化。
    - 同步的意义在于这样每一个 mutation 执行完成后都可以对应到一个新的状态（和 reducer 一样），这样 devtools 就可以打个 snapshot 存下来，然后就可以随便 time-travel 了。
    - 事实上在 vuex 里面 actions 只是一个架构性的概念，并不是必须的，说到底只是一个函数，你在里面想干嘛都可以，只要最后触发 mutation 就行。异步竞态怎么处理那是用户自己的事情。vuex 真正限制你的只有 mutation 必须是同步的这一点
  - 其实就是做了代码隔离
    不非受控的代码集中到 action
    mutation只做纯函数的状态改变
    mvvm一般强调的就是直接面对view的那层不要做复杂的逻辑