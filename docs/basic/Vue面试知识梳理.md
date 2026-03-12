# Vue 面试知识梳理

> 基于 BBQ 项目中的 Vue 学习笔记整理，从面试角度系统梳理 Vue 核心知识点

## 目录

- [一、Vue 响应式原理](#一vue-响应式原理)
- [二、虚拟 DOM 与 Diff 算法](#二虚拟-dom-与-diff-算法)
- [三、Vue 异步更新与 nextTick](#三vue-异步更新与-nexttick)
- [四、生命周期](#四生命周期)
- [五、组件通信](#五组件通信)
- [六、常用指令与特性](#六常用指令与特性)
- [七、Computed vs Watch](#七computed-vs-watch)
- [八、Vue Router](#八vue-router)
- [九、Vuex 状态管理](#九vuex-状态管理)
- [十、Vue 3 新特性](#十vue-3-新特性)
- [十一、Vue vs React](#十一vue-vs-react)
- [十二、高频面试题](#十二高频面试题)
- [十三、实战技巧](#十三实战技巧)
- [十四、参考资料](#十四参考资料)
- [十五、Vue 复用方案](#十五vue-复用方案)
- [十六、Vue.$set 的使用](#十六vueset-的使用)
- [十七、Vue.$mount 挂载](#十七vuemount-挂载)
- [十八、补充知识点](#十八补充知识点)

---

## 一、Vue 响应式原理 ⭐⭐⭐ 🔥🔥🔥

### 1.1 核心运作流程 ⭐⭐⭐ 🔥🔥🔥

**考点**：Vue 响应式系统的完整流程

**核心流程**：
```
1. 数据劫持
   ↓
Vue 遍历 data 所有属性
   ↓
使用 Object.defineProperty 转为 getter/setter
   ↓
2. 依赖收集（渲染时）
   ↓
组件渲染时访问数据属性
   ↓
触发 getter，记录依赖（Watcher）
   ↓
3. 派发更新
   ↓
数据变化触发 setter
   ↓
通知 Dep 中的所有 Watcher
   ↓
Watcher 执行 update()
   ↓
4. 虚拟 DOM Diff
   ↓
新旧 VNode 对比
   ↓
Patch 更新真实 DOM
```

**关键概念**：
- **渲染粒度**：以组件为单位，一个组件对应一个 Watcher
- **Dep**：每个 data 属性对应一个 Dep，存储依赖该属性的 Watcher
- **Watcher**：订阅者，连接 Observer 和 Compile 的桥梁

### 1.2 依赖收集机制 ⭐⭐⭐ 🔥🔥🔥

**考点**：依赖收集的时机和原理

**依赖收集时机**：
- Vue 实例创建时，data 变成响应式对象
- 组件渲染时，访问数据触发 getter
- getter 中执行依赖收集逻辑

**依赖是什么**：
- 依赖就是 Watcher（组件对应的观察者）
- 一个 data 属性对应一个 Dep
- 一个组件对应一个 Watcher

**收集过程**：
```javascript
// 1. 在 getter 中收集依赖
Object.defineProperty(obj, key, {
  get() {
    // 依赖收集：将当前 Watcher 加入 Dep
    dep.depend();
    return value;
  },
  set(newVal) {
    if (newVal !== value) {
      value = newVal;
      // 通知所有依赖更新
      dep.notify();
    }
  }
});

// 2. Watcher 订阅
class Watcher {
  constructor() {
    // 实例化时往 Dep 中添加自己
  }
  
  update() {
    // 属性变动时被调用
    // 触发组件重新渲染（Diff + Patch）
  }
}
```



### 1.3 Vue 2 响应式实现 ⭐⭐⭐ 🔥🔥🔥

**考点**：手写简易响应式系统

```javascript
const data = {
  name: '小米',
  color: {
    red: '1'
  }
};

// 将 data 处理为响应式数据
observer(data);

// 将一个对象处理为响应式对象
function observer(target) {
  // 处理基础类型
  if (typeof target !== 'object' || target === null) {
    return target;
  }
  
  // 处理数组：替换原型为响应式原型
  if (Array.isArray(target)) {
    target.__proto__ = _ArrayProto;
  }
  
  // 处理对象：递归处理每个属性
  for (let key in target) {
    if (target.hasOwnProperty(key)) {
      defineReactive(target, key, target[key]);
    }
  }
}

// 为数据增加响应式
function defineReactive(target, key, val) {
  // 深度观察（递归处理嵌套对象）
  observer(val);

  Object.defineProperty(target, key, {
    get() {
      // 依赖收集
      return val;
    },
    set(newVal) {
      // 新值也需要深度观察
      observer(newVal);
      
      if (newVal !== val) {
        console.log('触发响应式：需要重新 diff-patch');
        val = newVal;
      }
    }
  });
}

// 构造响应式数组原型
function ObserverArrayProto() {
  const ArrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
  const oldArrayProto = Array.prototype;
  const newArrayProto = Object.create(oldArrayProto);

  ArrayMethods.forEach((method) => {
    const oldMethod = oldArrayProto[method];
    
    // AOP 切入响应式逻辑
    newArrayProto[method] = function(...args) {
      const result = oldMethod.apply(this, args);
      
      // 响应式逻辑
      console.log('触发响应式：需要重新 diff-patch');
      
      return result;
    };
  });

  return newArrayProto;
}

const _ArrayProto = ObserverArrayProto();
```

**注意事项**：
- data 新增/删除属性需要手动调用 `Vue.set()` 和 `Vue.delete()`

### 1.4 Object.defineProperty 的缺陷 ⭐⭐⭐ 🔥🔥

**考点**：Vue 2 响应式的局限性

**无法监测的情况**：

1. **数组**：
   - 通过下标修改数据
   - 数组长度改变
   - 部分数组方法（push、pop 等）

2. **对象**：
   - 新增属性
   - 删除属性

**解决方案**：
```javascript
// 对象新增/删除属性
Vue.set(this.obj, 'newKey', value);
Vue.delete(this.obj, 'key');

// 或使用实例方法
this.$set(this.obj, 'newKey', value);
this.$delete(this.obj, 'key');
```

**数组响应式处理**：
- 通过 AOP 重写数组原型方法
- 在中间层原型上植入响应式逻辑
- 数组实例的 `__proto__` 指向响应式原型

```javascript
// 原型链：array -> middleLayer -> Array.prototype
array.__proto__ = middleLayer;

// middleLayer 上重写了 push、pop 等方法
middleLayer.push = function(...args) {
  const result = Array.prototype.push.apply(this, args);
  // 触发响应式更新
  dep.notify();
  return result;
};
```



---

## 二、虚拟 DOM 与 Diff 算法 ⭐⭐⭐ 🔥🔥🔥

### 2.1 虚拟 DOM 的优点 ⭐⭐⭐ 🔥🔥

**考点**：为什么需要虚拟 DOM

**优点**：
1. **减少 DOM 操作**：符合 MVVM 模型，避免频繁直接操作 DOM
2. **跨平台能力**：与平台耦合度低，可以渲染到不同平台
3. **性能保证**：相比直接操作 DOM，保证了性能下限

**VNode 结构**：
```javascript
{
  tag: 'div',
  props: { id: 'app', class: 'container' },
  children: [
    { tag: 'span', props: {}, children: ['Hello'] }
  ]
}
```

### 2.2 Diff 算法原理 ⭐⭐⭐ 🔥🔥🔥

**考点**：Vue 的 Diff 策略

**核心策略**：
1. **同层比较**：只比较同一层级，不跨层比较
2. **标签名不同**：直接删除，不进行深度比较
3. **标签名 + key 相同**：认为是相同节点，进行复用

**Patch 过程**：
```
Template → Render Function → VNode Tree → Real DOM

更新时：
New VNode Tree ←→ Old VNode Tree (Diff)
         ↓
    记录差异
         ↓
    应用到真实 DOM
```

**节点对比逻辑**：

1. **相同节点**：新旧 VNode 完全一样 → 停止更新
2. **静态节点**：内容与 data 无关 → 停止更新
3. **新节点有文本**：
   - 文本不同 → 更新文本
4. **新节点无文本**：
   - 无 children → 清空旧节点（删除子节点或文本）
   - 有 children：
     - 旧节点无子节点 → 创建并插入新子节点
     - 旧节点有子节点 → 更新子节点（见下节）

### 2.3 更新子节点（列表 Diff）⭐⭐⭐ 🔥🔥🔥

**考点**：列表更新的核心算法

**主要操作**：创建、更新、移动、删除

**更新策略**：

1. **创建**
   - 场景：在 oldChildren 中未找到对应的新节点
   - 位置：插入到所有未处理节点的前面

2. **更新**
   - 场景：节点相同，位置相同
   - 操作：递归更新节点内容

3. **移动**
   - 场景：节点相同，位置不同
   - 位置：移动到所有未处理节点的前面

4. **删除**
   - 场景：newChildren 遍历完，oldChildren 还有未处理节点
   - 操作：删除这些节点

**循环对比流程**：
```javascript
// 遍历 newChildren
for (let i = 0; i < newChildren.length; i++) {
  const newNode = newChildren[i];
  
  // 在 oldChildren 中查找相同节点
  const oldNode = findSameNode(oldChildren, newNode);
  
  if (!oldNode) {
    // 创建新节点
    createNode(newNode);
  } else if (oldNode.position === newNode.position) {
    // 位置相同，更新
    updateNode(oldNode, newNode);
  } else {
    // 位置不同，移动
    moveNode(oldNode, newNode.position);
  }
}

// 删除 oldChildren 中剩余的节点
deleteRemainingNodes(oldChildren);
```

### 2.4 Key 的作用 ⭐⭐⭐ 🔥🔥🔥

**考点**：为什么需要 key，为什么不能用 index

**Key 的作用**：
- 标记节点的唯一性
- 用于判断节点是否相同
- 帮助 Diff 算法高效复用节点

**为什么不能用 index 作为 key**：

```javascript
// 原始列表
[
  { id: 1, name: 'A' },  // index: 0
  { id: 2, name: 'B' },  // index: 1
  { id: 3, name: 'C' }   // index: 2
]

// 删除第一项后
[
  { id: 2, name: 'B' },  // index: 0 (原来是 1)
  { id: 3, name: 'C' }   // index: 1 (原来是 2)
]
```

**问题**：
- index 会因为顺序改变而改变
- 原来 index=1 的节点，删除后变成 index=0
- Diff 算法会误判为同一节点（tagName + key 都相同）
- 导致不必要的递归对比和 DOM 操作

**正确做法**：
```vue
<!-- ❌ 不好 -->
<div v-for="(item, index) in list" :key="index">
  {{ item.name }}
</div>

<!-- ✅ 正确 -->
<div v-for="item in list" :key="item.id">
  {{ item.name }}
</div>
```



---

## 三、Vue 异步更新与 nextTick ⭐⭐⭐ 🔥🔥

### 3.1 异步更新策略 ⭐⭐⭐ 🔥🔥

**考点**：Vue 为什么采用异步更新

**异步更新原理**：
- 数据变化不会立即更新 DOM
- 更新任务被推入队列
- 在适当时机批量触发更新

**优势**：
```javascript
// 三次修改同一个状态
this.content = '第一次测试';
this.content = '第二次测试';
this.content = '第三次测试';

// 同步更新：操作 3 次 DOM（浪费）
// 异步更新：只操作 1 次 DOM（高效）
```

**批量更新流程**：
```
多次 setData
    ↓
进入更新队列（去重）
    ↓
批量执行更新
    ↓
渲染 DOM
    ↓
nextTick 回调执行
```

**去重机制**：
- 同一个 Watcher 被多次触发，只会被推入队列一次
- 避免不必要的计算和 DOM 操作

### 3.2 Vue.nextTick ⭐⭐⭐ 🔥🔥

**考点**：nextTick 的作用和实现原理

**作用**：
- 在下次 DOM 更新循环结束后执行回调
- 保证回调中可以访问到更新后的 DOM

**使用场景**：
```javascript
// 场景 1：修改数据后立即获取 DOM
this.message = 'Hello';
this.$nextTick(() => {
  // DOM 已更新
  console.log(this.$el.textContent); // 'Hello'
});

// 场景 2：created 中访问 DOM
created() {
  this.$nextTick(() => {
    // 此时 DOM 已挂载
    this.$refs.input.focus();
  });
}
```

**实现原理**：
- 本质是一个回调函数注册器
- 将回调函数放入 callbacks 队列
- 在 DOM 更新后执行所有回调

**降级策略**（按优先级）：
```javascript
// 1. Promise.then（微任务）
if (typeof Promise !== 'undefined') {
  timerFunc = () => {
    Promise.resolve().then(flushCallbacks);
  };
}
// 2. MutationObserver（微任务）
else if (typeof MutationObserver !== 'undefined') {
  // ...
}
// 3. setImmediate（宏任务，IE 专属）
else if (typeof setImmediate !== 'undefined') {
  timerFunc = () => {
    setImmediate(flushCallbacks);
  };
}
// 4. setTimeout（宏任务，兜底方案）
else {
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  };
}
```

**执行流程**：
```
批量 setData
    ↓
进入队列
    ↓
批量渲染 DOM
    ↓
执行 nextTick 回调
```

---

## 四、生命周期 ⭐⭐⭐ 🔥🔥

### 4.1 生命周期钩子 ⭐⭐⭐ 🔥

**考点**：各个生命周期的特点和使用场景

**创建阶段**：
- **beforeCreate**：实例初始化之后，data 和 methods 还未初始化
- **created**：实例创建完成，data 和 methods 可访问
  - 可以进行 Ajax 请求（推荐）
  - 访问 DOM 需要放在 `$nextTick` 中

**挂载阶段**：
- **beforeMount**：模板编译完成，但未挂载到页面
- **mounted**：实例挂载到页面，可以访问 `vm.$el`
  - 可以进行 DOM 操作
  - 服务端渲染期间不会调用

**更新阶段**：
- **beforeUpdate**：响应式数据已改变，但 DOM 还未更新
- **updated**：DOM 已更新
  - 避免在此更新 data，容易导致无限循环
  - 服务端渲染期间不会调用

**销毁阶段**：
- **beforeDestroy**：实例仍可用，`this` 可获取实例
  - 清理定时器、取消订阅等
- **destroyed**：实例已销毁

**Keep-alive 专属**：
- **activated**：组件被激活时调用
- **deactivated**：组件被缓存时调用

### 4.2 父子组件生命周期执行顺序 ⭐⭐⭐ 🔥🔥

**考点**：组件嵌套时的生命周期顺序

**加载渲染过程**：
```
父 beforeCreate
父 created
父 beforeMount
  子 beforeCreate
  子 created
  子 beforeMount
  子 mounted
父 mounted
```

**更新过程**：
```
父 beforeUpdate
  子 beforeUpdate
  子 updated
父 updated
```

**销毁过程**：
```
父 beforeDestroy
  子 beforeDestroy
  子 destroyed
父 destroyed
```

**记忆技巧**：
- 父组件先开始，子组件先完成
- 类似函数调用栈的执行顺序



---

## 五、组件通信 ⭐⭐⭐ 🔥🔥

### 5.1 Props + $emit（父子通信）⭐⭐⭐ 🔥

**考点**：最基础的父子组件通信方式

```vue
<!-- 父组件 -->
<template>
  <Child :message="msg" @update="handleUpdate" />
</template>

<script>
export default {
  data() {
    return { msg: 'Hello' };
  },
  methods: {
    handleUpdate(newVal) {
      this.msg = newVal;
    }
  }
};
</script>

<!-- 子组件 -->
<template>
  <div @click="updateParent">{{ message }}</div>
</template>

<script>
export default {
  props: ['message'],
  methods: {
    updateParent() {
      this.$emit('update', 'New Value');
    }
  }
};
</script>
```

### 5.2 EventBus（兄弟组件通信）⭐⭐⭐ 🔥

**考点**：跨组件通信的简单方案

```javascript
// 创建 EventBus
// 方式 1：使用 Vue 实例
const eventBus = new Vue();

// 方式 2：自己实现
class EventBus {
  constructor() {
    this.events = {};
  }
  
  $on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  $emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(...args));
    }
  }
  
  $off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}

// 组件 A：发送事件
eventBus.$emit('eventName', { a: 1 });

// 组件 B：监听事件
eventBus.$on('eventName', (param) => {
  this.b = param.a;
});

// 组件销毁时记得取消监听
beforeDestroy() {
  eventBus.$off('eventName');
}
```

### 5.3 Provide / Inject（隔代通信）⭐⭐⭐ 🔥

**考点**：祖先组件向后代组件传递数据

```javascript
// 祖先组件
export default {
  provide() {
    return {
      num: this.num,
      app: this  // 传递整个实例
    };
  },
  data() {
    return { num: 100 };
  }
};

// 后代组件
export default {
  inject: ['num', 'app'],
  mounted() {
    console.log(this.num);      // 100
    console.log(this.app.num);  // 100
  }
};
```

**注意**：
- provide/inject 不是响应式的（除非传递的是响应式对象）
- 主要用于高阶插件/组件库

### 5.4 $refs（父访问子）⭐⭐ 🔥

**考点**：父组件直接访问子组件实例

```vue
<template>
  <Child ref="child" />
</template>

<script>
export default {
  mounted() {
    // 访问子组件的数据
    console.log(this.$refs.child.data);
    
    // 调用子组件的方法
    this.$refs.child.method();
  }
};
</script>
```

### 5.5 $parent / $children（访问父子实例）⭐⭐ 🔥

**考点**：直接访问父子组件实例

```javascript
// 子组件访问父组件
this.$parent.message = 'Hello';
this.$parent.method();

// 父组件访问子组件
this.$children[0].message = 'JavaScript';
```

**注意**：
- 不推荐使用，耦合度高
- `$children` 不保证顺序

### 5.6 Vuex（全局状态管理）⭐⭐⭐ 🔥🔥

**考点**：复杂应用的状态管理方案

```javascript
// store.js
const store = new Vuex.Store({
  state: {
    count: 0
  },
  mutations: {
    increment(state) {
      state.count++;
    }
  },
  actions: {
    incrementAsync({ commit }) {
      setTimeout(() => {
        commit('increment');
      }, 1000);
    }
  },
  getters: {
    doubleCount(state) {
      return state.count * 2;
    }
  }
});

// 组件中使用
export default {
  computed: {
    count() {
      return this.$store.state.count;
    },
    doubleCount() {
      return this.$store.getters.doubleCount;
    }
  },
  methods: {
    increment() {
      this.$store.commit('increment');
    },
    incrementAsync() {
      this.$store.dispatch('incrementAsync');
    }
  }
};
```

---

## 六、常用指令与特性 ⭐⭐⭐ 🔥

### 6.1 v-if vs v-show ⭐⭐⭐ 🔥

**考点**：两者的区别和使用场景

| 对比维度 | v-if | v-show |
|---------|------|--------|
| **实现方式** | 动态添加/删除 DOM 元素 | 通过 CSS `display: none` 控制 |
| **编译过程** | 惰性渲染，条件为真才渲染 | 总是会渲染，只是切换显示 |
| **切换开销** | 较高（销毁/重建） | 较低（只改 CSS） |
| **初始开销** | 较低（可能不渲染） | 较高（总是渲染） |
| **使用场景** | 不频繁切换 | 频繁切换 |

**v-if 实现原理**：
- 值为 false 时，创建注释节点占位
- 值变化时，通过 Diff 算法动态显示/隐藏

**为什么 v-show 用 display:none**：
- `visibility: hidden` 会占据空间
- v-show 的场景是不占用原来的位置
- 虽然 `display: none` 会引起回流，但符合使用场景

### 6.2 v-model ⭐⭐⭐ 🔥

**考点**：v-model 的本质

**语法糖**：
```vue
<!-- v-model -->
<input v-model="searchText" />

<!-- 等价于 -->
<input
  :value="searchText"
  @input="searchText = $event.target.value"
/>
```

**自定义组件使用 v-model**：
```vue
<!-- 父组件 -->
<CustomInput v-model="value" />

<!-- 子组件 -->
<template>
  <input
    :value="value"
    @input="$emit('input', $event.target.value)"
  />
</template>

<script>
export default {
  props: ['value']
};
</script>
```

### 6.3 Keep-alive ⭐⭐⭐ 🔥🔥

**考点**：组件缓存机制

**作用**：
- 缓存不活动的组件实例
- 避免重复渲染，提升性能
- 保留组件状态

**使用**：
```vue
<keep-alive>
  <component :is="currentComponent" />
</keep-alive>

<!-- 配合路由 -->
<keep-alive>
  <router-view />
</keep-alive>
```

**生命周期**：
- `activated`：组件被激活时调用
- `deactivated`：组件被缓存时调用

**缓存策略**：
```vue
<!-- include：只缓存匹配的组件 -->
<keep-alive include="ComponentA,ComponentB">
  <component :is="currentComponent" />
</keep-alive>

<!-- exclude：不缓存匹配的组件 -->
<keep-alive exclude="ComponentC">
  <component :is="currentComponent" />
</keep-alive>

<!-- max：最多缓存多少组件 -->
<keep-alive :max="10">
  <component :is="currentComponent" />
</keep-alive>
```

**原理**：
- 内部使用 LRU（Least Recently Used）算法
- 超过 max 时，淘汰最久未使用的组件



---

## 七、Computed vs Watch ⭐⭐⭐ 🔥🔥

### 7.1 Computed 计算属性 ⭐⭐⭐ 🔥

**考点**：computed 的特点和使用场景

**特点**：
- 依赖其他属性值
- 有缓存，依赖不变时不重新计算
- 必须有返回值
- 不能执行异步操作

**使用场景**：
```javascript
export default {
  data() {
    return {
      firstName: 'Zhang',
      lastName: 'San'
    };
  },
  computed: {
    // 简写（只读）
    fullName() {
      return this.firstName + ' ' + this.lastName;
    },
    
    // 完整写法（可读写）
    fullName2: {
      get() {
        return this.firstName + ' ' + this.lastName;
      },
      set(newValue) {
        const names = newValue.split(' ');
        this.firstName = names[0];
        this.lastName = names[1];
      }
    }
  }
};
```

### 7.2 Watch 侦听器 ⭐⭐⭐ 🔥

**考点**：watch 的特点和使用场景

**特点**：
- 观察数据变化，执行回调
- 无缓存，数据变化就执行
- 可以执行异步操作
- 可以访问旧值和新值

**使用场景**：
```javascript
export default {
  data() {
    return {
      question: '',
      answer: ''
    };
  },
  watch: {
    // 简单监听
    question(newVal, oldVal) {
      console.log('问题变化了', newVal, oldVal);
    },
    
    // 深度监听
    obj: {
      handler(newVal, oldVal) {
        console.log('对象变化了');
      },
      deep: true,      // 深度监听
      immediate: true  // 立即执行
    },
    
    // 监听对象的某个属性
    'obj.name'(newVal, oldVal) {
      console.log('name 变化了');
    },
    
    // 异步操作
    question(newVal) {
      this.answer = 'Waiting...';
      this.debouncedGetAnswer();
    }
  },
  methods: {
    debouncedGetAnswer: _.debounce(function() {
      // 调用 API
      axios.get('/api/answer?q=' + this.question)
        .then(response => {
          this.answer = response.data;
        });
    }, 500)
  }
};
```

### 7.3 Computed vs Watch 对比 ⭐⭐⭐ 🔥🔥

**考点**：如何选择使用 computed 还是 watch

| 对比维度 | Computed | Watch |
|---------|----------|-------|
| **缓存** | 有缓存 | 无缓存 |
| **依赖** | 依赖其他属性 | 观察单个属性 |
| **返回值** | 必须有 | 不需要 |
| **异步** | 不支持 | 支持 |
| **使用场景** | 数值计算 | 异步操作、开销大的操作 |

**选择建议**：
- **优先使用 computed**：
  - 需要进行数值计算
  - 依赖多个数据
  - 需要缓存结果

- **使用 watch**：
  - 需要执行异步操作
  - 需要执行开销较大的操作
  - 需要在数据变化时执行特定逻辑

**示例对比**：
```javascript
// ✅ 适合用 computed
computed: {
  fullName() {
    return this.firstName + ' ' + this.lastName;
  }
}

// ✅ 适合用 watch
watch: {
  question(newVal) {
    // 异步 API 调用
    this.fetchAnswer(newVal);
  }
}
```

---

## 八、Vue Router ⭐⭐⭐ 🔥🔥

### 8.1 前端路由原理 ⭐⭐⭐ 🔥🔥

**考点**：前端路由的实现方式

**目的**：
- 实现 SPA 无刷新更改 URL
- 根据 URL 渲染对应组件

**两种模式**：

#### Hash 模式
```javascript
// 监听 hash 变化
window.addEventListener('hashchange', (event) => {
  console.log('旧 URL:', event.oldURL);
  console.log('新 URL:', event.newURL);
  
  // 根据 hash 渲染组件
  const hash = window.location.hash;
  renderComponent(hash);
});

// 修改 hash
window.location.hash = '/home';

// replace（不会触发 hashchange）
window.location.replace(newUrl);
```

**特点**：
- URL 中有 `#` 号，看起来不美观
- hash 部分不会发送到服务器
- 兼容性好，无需服务器配置
- 会导致锚点功能失效

#### History 模式
```javascript
// 修改 URL（不会触发 popstate）
history.pushState(state, title, url);
history.replaceState(state, title, url);

// 监听 URL 变化
window.addEventListener('popstate', (event) => {
  const state = event.state;
  console.log('状态:', state);
  
  // 根据 URL 渲染组件
  renderComponent(window.location.pathname);
});

// 前进/后退
history.forward();
history.back();
history.go(-2);
```

**特点**：
- URL 美观，没有 `#` 号
- 需要服务器配置支持（否则刷新 404）
- 可以使用 `state` 对象传递数据

**服务器配置**：
```nginx
# Nginx 配置
location / {
  try_files $uri $uri/ /index.html;
}
```

### 8.2 Hash vs History 对比 ⭐⭐⭐ 🔥🔥

**考点**：两种模式的区别和选择

| 对比维度 | Hash | History |
|---------|------|---------|
| **URL 美观度** | 有 `#` 号，不美观 | 美观 |
| **服务器配置** | 无需配置 | 需要配置 |
| **兼容性** | 好 | IE10+ |
| **锚点功能** | 失效 | 正常 |
| **刷新问题** | 无问题 | 需要服务器支持 |

**History 模式刷新 404 问题**：
- 用户手动刷新或直接输入 URL
- 服务器收到请求，但找不到对应资源
- 返回 404

**解决方案**：
- 服务器配置：所有路径都返回 `index.html`
- 前端路由接管后，根据 URL 渲染对应组件

### 8.3 路由传参 ⭐⭐⭐ 🔥

**考点**：路由参数传递的几种方式

#### 1. 动态路由参数
```javascript
// 路由配置
{
  path: '/user/:id',
  component: User
}

// 跳转
this.$router.push({ path: `/user/${userId}` });

// 获取参数
this.$route.params.id
```

#### 2. Query 参数
```javascript
// 跳转
this.$router.push({
  path: '/user',
  query: { id: 123, name: 'zhangsan' }
});

// URL: /user?id=123&name=zhangsan

// 获取参数
this.$route.query.id
this.$route.query.name
```

**特点**：
- 参数显示在 URL 中
- 刷新不会丢失

#### 3. Params 参数
```javascript
// 跳转（必须使用 name）
this.$router.push({
  name: 'User',
  params: { id: 123, name: 'zhangsan' }
});

// 获取参数
this.$route.params.id
this.$route.params.name
```

**特点**：
- 参数不显示在 URL 中
- 刷新会丢失（除非配合动态路由）

**对比**：
| 方式 | URL 显示 | 刷新保留 | 使用场景 |
|-----|---------|---------|---------|
| 动态路由 | ✅ | ✅ | RESTful 风格 |
| Query | ✅ | ✅ | 查询参数 |
| Params | ❌ | ❌ | 临时数据传递 |

### 8.4 导航守卫 ⭐⭐⭐ 🔥🔥

**考点**：路由拦截器的使用

**全局守卫**：
```javascript
// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 权限验证
  if (to.meta.requiresAuth && !isLoggedIn()) {
    next('/login');
  } else {
    next();
  }
});

// 全局解析守卫
router.beforeResolve((to, from, next) => {
  // 在 beforeRouteEnter 之后调用
  next();
});

// 全局后置钩子
router.afterEach((to, from) => {
  // 不接收 next，不能改变导航
  document.title = to.meta.title || 'App';
});
```

**路由独享守卫**：
```javascript
{
  path: '/admin',
  component: Admin,
  beforeEnter: (to, from, next) => {
    // 只在进入该路由时触发
    if (hasPermission()) {
      next();
    } else {
      next('/403');
    }
  }
}
```

**组件内守卫**：
```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // 在渲染该组件的对应路由被确认前调用
    // 不能访问 this
    next(vm => {
      // 通过 vm 访问组件实例
    });
  },
  
  beforeRouteUpdate(to, from, next) {
    // 在当前路由改变，但组件被复用时调用
    // 例如：/user/1 -> /user/2
    this.fetchData(to.params.id);
    next();
  },
  
  beforeRouteLeave(to, from, next) {
    // 导航离开该组件时调用
    const answer = window.confirm('确定要离开吗？');
    if (answer) {
      next();
    } else {
      next(false);
    }
  }
};
```

### 8.5 路由懒加载 ⭐⭐⭐ 🔥

**考点**：如何实现路由懒加载

**目的**：
- 减小首屏加载体积
- 按需加载，提升性能

**实现方式**：
```javascript
// 方式 1：ES6 import（推荐）
const Home = () => import(/* webpackChunkName: "home" */ '@/views/Home.vue');

// 方式 2：require.ensure
const About = resolve => require(['@/views/About.vue'], resolve);

// 路由配置
const routes = [
  {
    path: '/home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/about',
    component: () => import('@/views/About.vue')
  }
];
```

**Webpack 配置**：
```javascript
// babel.config.js
module.exports = {
  plugins: [
    '@babel/plugin-syntax-dynamic-import'
  ]
};
```

**分组打包**：
```javascript
// 相同 chunkName 的组件会打包到一起
const Foo = () => import(/* webpackChunkName: "group-foo" */ './Foo.vue');
const Bar = () => import(/* webpackChunkName: "group-foo" */ './Bar.vue');
```



---

## 九、Vuex 状态管理 ⭐⭐⭐ 🔥🔥

### 9.1 Vuex 核心概念 ⭐⭐⭐ 🔥

**考点**：Vuex 的组成和使用

**核心概念**：
- **State**：单一状态树，存储所有状态
- **Getters**：派生状态，类似 computed
- **Mutations**：同步修改状态的唯一方式
- **Actions**：异步操作，提交 mutation
- **Modules**：模块化，拆分 store

**基本使用**：
```javascript
// store.js
const store = new Vuex.Store({
  state: {
    count: 0,
    user: null
  },
  
  getters: {
    doubleCount(state) {
      return state.count * 2;
    },
    isLoggedIn(state) {
      return !!state.user;
    }
  },
  
  mutations: {
    increment(state) {
      state.count++;
    },
    setUser(state, user) {
      state.user = user;
    }
  },
  
  actions: {
    incrementAsync({ commit }) {
      setTimeout(() => {
        commit('increment');
      }, 1000);
    },
    async login({ commit }, credentials) {
      const user = await api.login(credentials);
      commit('setUser', user);
    }
  }
});

// 组件中使用
export default {
  computed: {
    count() {
      return this.$store.state.count;
    },
    doubleCount() {
      return this.$store.getters.doubleCount;
    }
  },
  methods: {
    increment() {
      this.$store.commit('increment');
    },
    incrementAsync() {
      this.$store.dispatch('incrementAsync');
    }
  }
};
```

### 9.2 辅助函数 ⭐⭐⭐ 🔥

**考点**：简化 Vuex 使用的辅助函数

```javascript
import { mapState, mapGetters, mapMutations, mapActions } from 'vuex';

export default {
  computed: {
    // 映射 state
    ...mapState(['count', 'user']),
    ...mapState({
      // 重命名
      myCount: 'count',
      // 使用函数
      countPlusOne: state => state.count + 1
    }),
    
    // 映射 getters
    ...mapGetters(['doubleCount', 'isLoggedIn']),
    ...mapGetters({
      // 重命名
      myDouble: 'doubleCount'
    })
  },
  
  methods: {
    // 映射 mutations
    ...mapMutations(['increment', 'setUser']),
    ...mapMutations({
      // 重命名
      add: 'increment'
    }),
    
    // 映射 actions
    ...mapActions(['incrementAsync', 'login']),
    ...mapActions({
      // 重命名
      asyncAdd: 'incrementAsync'
    })
  }
};
```

### 9.3 为什么 Mutation 必须是同步的 ⭐⭐⭐ 🔥🔥🔥

**考点**：Vuex 设计原则

**原因**：
1. **状态追踪**：每个 mutation 执行完成后对应一个新状态
2. **DevTools 支持**：可以打快照，实现 time-travel 调试
3. **可预测性**：同步操作保证状态变更的可预测性

**如果支持异步**：
```javascript
// ❌ 如果 mutation 支持异步
mutations: {
  async increment(state) {
    await someAsyncOperation();
    state.count++;  // 不知道何时执行
  }
}
```

**问题**：
- 无法确定状态何时更新
- DevTools 无法追踪状态变化
- 调试困难

**正确做法**：
```javascript
// ✅ 异步操作放在 action 中
actions: {
  async incrementAsync({ commit }) {
    await someAsyncOperation();
    commit('increment');  // 同步提交 mutation
  }
}
```

### 9.4 Vuex 模块化 ⭐⭐⭐ 🔥

**考点**：大型应用的 Vuex 组织方式

```javascript
// modules/user.js
const user = {
  namespaced: true,  // 开启命名空间
  
  state: {
    info: null,
    token: ''
  },
  
  getters: {
    isLoggedIn(state) {
      return !!state.token;
    }
  },
  
  mutations: {
    setUser(state, user) {
      state.info = user;
    }
  },
  
  actions: {
    async login({ commit }, credentials) {
      const user = await api.login(credentials);
      commit('setUser', user);
    }
  }
};

// modules/cart.js
const cart = {
  namespaced: true,
  state: { items: [] },
  mutations: { addItem(state, item) { /* ... */ } }
};

// store.js
const store = new Vuex.Store({
  modules: {
    user,
    cart
  }
});

// 组件中使用
export default {
  computed: {
    ...mapState('user', ['info', 'token']),
    ...mapGetters('user', ['isLoggedIn'])
  },
  methods: {
    ...mapMutations('user', ['setUser']),
    ...mapActions('user', ['login']),
    ...mapMutations('cart', ['addItem'])
  }
};

// 或者直接访问
this.$store.state.user.info;
this.$store.getters['user/isLoggedIn'];
this.$store.commit('user/setUser', user);
this.$store.dispatch('user/login', credentials);
```

### 9.5 Vuex 严格模式 ⭐⭐ 🔥

**考点**：如何确保状态只能通过 mutation 修改

```javascript
const store = new Vuex.Store({
  strict: true,  // 开启严格模式
  // ...
});
```

**作用**：
- 状态更改必须由 mutation 引起
- 直接修改 state 会抛出错误
- 帮助发现不规范的状态修改

**注意**：
- 严格模式会深度监测状态树，性能开销大
- 生产环境建议关闭

```javascript
const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production'
});
```

---

## 十、Vue 3 新特性 ⭐⭐⭐ 🔥🔥

### 10.1 Proxy vs Object.defineProperty ⭐⭐⭐ 🔥🔥🔥

**考点**：Vue 3 响应式系统的改进

**Object.defineProperty 的缺陷**：
1. 无法监测对象属性的新增/删除
2. 无法监测数组下标和长度变化
3. 需要遍历对象的每个属性
4. 嵌套对象需要递归监听
5. 会改变原始数据

**Proxy 的优势**：
1. 可以监听对象的所有操作
2. 可以监听数组的所有变化
3. 不需要遍历属性
4. 不会改变原始数据（返回代理对象）
5. 支持 Map、Set、WeakMap、WeakSet

**对比表格**：

| 特性 | Object.defineProperty | Proxy |
|-----|----------------------|-------|
| **监听新增属性** | ❌ 需要 Vue.set | ✅ 支持 |
| **监听删除属性** | ❌ 需要 Vue.delete | ✅ 支持 |
| **监听数组下标** | ❌ 不支持 | ✅ 支持 |
| **监听数组长度** | ❌ 不支持 | ✅ 支持 |
| **性能** | 需要遍历属性 | 整体代理 |
| **兼容性** | IE9+ | IE 不支持 |

**Proxy 实现响应式**：
```javascript
function reactive(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const observed = new Proxy(obj, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      console.log(`获取 ${key}: ${res}`);
      
      // 依赖收集
      track(target, key);
      
      // 递归处理嵌套对象
      return isObject(res) ? reactive(res) : res;
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      
      if (oldValue !== value) {
        console.log(`设置 ${key}: ${value}`);
        // 触发更新
        trigger(target, key);
      }
      
      return result;
    },
    
    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key);
      const result = Reflect.deleteProperty(target, key);
      
      if (hadKey && result) {
        // 触发更新
        trigger(target, key);
      }
      
      return result;
    }
  });
  
  return observed;
}
```

**共同特性**：
- 都不支持对象嵌套（需要递归实现）

### 10.2 Vue 3 其他改进 ⭐⭐ 🔥

**考点**：Vue 3 的主要变化

**性能提升**：
- 更快的虚拟 DOM
- 更高效的组件初始化
- 更好的 TypeScript 支持

**Composition API**：
- 更好的逻辑复用
- 更灵活的代码组织
- 更好的类型推导

**其他改进**：
- Fragment：支持多个根节点
- Teleport：传送门组件
- Suspense：异步组件加载
- 更好的 Tree-shaking

---

## 十一、Vue vs React ⭐⭐⭐ 🔥🔥

### 11.1 核心差异 ⭐⭐⭐ 🔥🔥

**考点**：Vue 和 React 的主要区别

| 对比维度 | Vue | React |
|---------|-----|-------|
| **模板语法** | Template（HTML-like） | JSX |
| **数据流** | 响应式（可变） | 不可变数据 |
| **状态管理** | Vuex（可变） | Redux（不可变） |
| **学习曲线** | 较平缓 | 较陡峭 |
| **API 风格** | Options API / Composition API | Hooks |
| **双向绑定** | v-model | 受控组件 |
| **性能优化** | 自动依赖追踪 | 手动优化（memo、useMemo） |

**更新 DOM 时机**：
- **Vue**：基于 snabbdom，边对比边更新 DOM（双向链表）
- **React**：使用 diff 队列，得到 patch 树后批量更新 DOM

**Diff 算法**：
- 都采用同层比较，不跨层比较
- 都使用 key 来优化列表渲染

### 11.2 状态管理对比 ⭐⭐ 🔥

**考点**：Vuex vs Redux

**Vuex**：
- 数据可变，直接修改 state
- mutation 必须同步
- action 可以异步

**Redux**：
- 数据不可变，每次返回新 state
- reducer 必须是纯函数
- 通过 middleware 处理异步

```javascript
// Vuex
mutations: {
  increment(state) {
    state.count++;  // 直接修改
  }
}

// Redux
function reducer(state, action) {
  return {
    ...state,
    count: state.count + 1  // 返回新对象
  };
}
```



---

## 十二、高频面试题 ⭐⭐⭐

### Q1: 说说 Vue 的响应式原理 🔥🔥🔥

**答**：
Vue 通过 Object.defineProperty（Vue 2）或 Proxy（Vue 3）实现响应式：

1. **数据劫持**：遍历 data 的所有属性，转为 getter/setter
2. **依赖收集**：组件渲染时访问数据，在 getter 中收集依赖（Watcher）
3. **派发更新**：数据变化触发 setter，通知 Dep 中的所有 Watcher
4. **更新视图**：Watcher 执行 update，通过 Diff 算法更新 DOM

核心：一个组件对应一个 Watcher，一个属性对应一个 Dep。

### Q2: Vue 的 Diff 算法是怎样的？🔥🔥🔥

**答**：
Vue 的 Diff 算法采用同层比较策略：

1. **同层比较**：只比较同一层级，不跨层比较
2. **标签名不同**：直接删除，不深度比较
3. **标签名 + key 相同**：认为是相同节点，复用
4. **更新子节点**：通过循环对比，执行创建、更新、移动、删除操作

Key 的作用是标记节点唯一性，帮助 Diff 算法高效复用节点。

### Q3: 为什么不能用 index 作为 key？🔥🔥

**答**：
因为 index 会随着数组顺序改变而改变：

- 删除第一项后，原来 index=1 的节点变成 index=0
- Diff 算法会误判为同一节点（tagName + key 都相同）
- 导致不必要的递归对比和 DOM 操作，甚至出现渲染错误

应该使用唯一且稳定的 id 作为 key。

### Q4: computed 和 watch 的区别？🔥🔥

**答**：
- **computed**：
  - 有缓存，依赖不变时不重新计算
  - 必须有返回值
  - 不能执行异步操作
  - 适合数值计算

- **watch**：
  - 无缓存，数据变化就执行
  - 不需要返回值
  - 可以执行异步操作
  - 适合异步操作、开销大的操作

优先使用 computed，需要异步操作时使用 watch。

### Q5: v-if 和 v-show 的区别？🔥🔥

**答**：
- **v-if**：
  - 动态添加/删除 DOM 元素
  - 切换开销高
  - 初始开销低（可能不渲染）
  - 适合不频繁切换

- **v-show**：
  - 通过 CSS `display: none` 控制
  - 切换开销低
  - 初始开销高（总是渲染）
  - 适合频繁切换

### Q6: Vue 组件通信有哪些方式？🔥🔥

**答**：
1. **Props + $emit**：父子通信（最常用）
2. **EventBus**：兄弟组件通信
3. **Provide / Inject**：隔代通信
4. **$refs**：父访问子
5. **$parent / $children**：访问父子实例
6. **Vuex**：全局状态管理

### Q7: Vue 的生命周期有哪些？🔥🔥

**答**：
- **创建**：beforeCreate、created
- **挂载**：beforeMount、mounted
- **更新**：beforeUpdate、updated
- **销毁**：beforeDestroy、destroyed
- **Keep-alive**：activated、deactivated

常用场景：
- created：发起 Ajax 请求
- mounted：操作 DOM
- beforeDestroy：清理定时器、取消订阅

### Q8: nextTick 的作用是什么？🔥🔥

**答**：
在下次 DOM 更新循环结束后执行回调，保证可以访问到更新后的 DOM。

Vue 采用异步更新策略，数据变化不会立即更新 DOM，而是推入队列批量更新。nextTick 的回调会在 DOM 更新后执行。

实现原理：使用微任务（Promise.then、MutationObserver）或宏任务（setImmediate、setTimeout）。

### Q9: Vuex 为什么 mutation 必须是同步的？🔥🔥🔥

**答**：
为了支持 DevTools 的状态追踪和 time-travel 调试：

- 每个 mutation 执行完成后对应一个新状态
- DevTools 可以打快照，记录状态变化
- 如果支持异步，无法确定状态何时更新，无法追踪

异步操作应该放在 action 中，最终通过同步的 mutation 修改状态。

### Q10: Vue 2 和 Vue 3 的响应式有什么区别？🔥🔥🔥

**答**：
- **Vue 2**：使用 Object.defineProperty
  - 无法监测对象属性的新增/删除
  - 无法监测数组下标和长度变化
  - 需要遍历对象的每个属性

- **Vue 3**：使用 Proxy
  - 可以监听对象的所有操作
  - 可以监听数组的所有变化
  - 不需要遍历属性，性能更好
  - 不会改变原始数据

### Q11: Hash 和 History 路由模式的区别？🔥🔥

**答**：
- **Hash 模式**：
  - URL 有 `#` 号
  - 无需服务器配置
  - 兼容性好
  - hash 部分不会发送到服务器

- **History 模式**：
  - URL 美观
  - 需要服务器配置（否则刷新 404）
  - IE10+ 支持
  - 可以使用 state 对象传递数据

### Q12: Keep-alive 的原理是什么？🔥🔥

**答**：
Keep-alive 用于缓存不活动的组件实例：

- 内部使用 LRU（最近最少使用）算法
- 缓存的组件不会被销毁，保留状态
- 提供 activated 和 deactivated 生命周期钩子
- 可以通过 include、exclude、max 控制缓存策略

### Q13: Vue 的双向绑定原理？🔥🔥

**答**：
Vue 本质是单向数据流，双向绑定是 v-model 的语法糖：

```vue
<input v-model="value" />

<!-- 等价于 -->
<input
  :value="value"
  @input="value = $event.target.value"
/>
```

实现：
- 数据 → 视图：响应式系统
- 视图 → 数据：事件监听

### Q14: Vue 如何监听数组变化？🔥🔥

**答**：
通过 AOP 重写数组原型方法：

1. 创建一个新原型，继承自 Array.prototype
2. 在新原型上重写 push、pop 等方法
3. 在重写的方法中植入响应式逻辑
4. 将数组实例的 `__proto__` 指向新原型

这样数组调用方法时，会先执行重写的方法，触发响应式更新。

### Q15: Vue 的异步更新策略是什么？🔥🔥

**答**：
Vue 采用异步批量更新策略：

- 数据变化不会立即更新 DOM
- 更新任务推入队列，去重
- 在下一个 tick 批量执行更新
- 只操作一次 DOM，提升性能

优势：避免重复计算和 DOM 操作，只以最终结果为准。

---

## 十三、实战技巧 ⭐⭐

### 13.1 性能优化

**组件层面**：
- 使用 v-show 替代 v-if（频繁切换）
- 使用 computed 缓存计算结果
- 使用 keep-alive 缓存组件
- 使用函数式组件（无状态组件）
- 合理使用 key

**代码层面**：
- 路由懒加载
- 组件懒加载
- 图片懒加载
- 第三方库按需引入

**打包层面**：
- 开启 gzip 压缩
- 使用 CDN
- 代码分割
- Tree-shaking

### 13.2 常见问题

**问题 1：修改数组/对象不更新**
```javascript
// ❌ 不会触发更新
this.arr[0] = newValue;
this.obj.newKey = value;

// ✅ 正确做法
this.$set(this.arr, 0, newValue);
this.$set(this.obj, 'newKey', value);

// 或使用 Vue 3
this.arr[0] = newValue;  // Vue 3 支持
```

**问题 2：父组件异步数据传给子组件**
```javascript
// 子组件使用 watch 监听 props 变化
watch: {
  propData: {
    handler(newVal) {
      // 处理异步数据
    },
    immediate: true
  }
}
```

**问题 3：路由切换组件不更新**
```javascript
// 使用 watch 监听路由变化
watch: {
  '$route'(to, from) {
    // 路由变化时重新获取数据
    this.fetchData();
  }
}

// 或使用 beforeRouteUpdate
beforeRouteUpdate(to, from, next) {
  this.fetchData();
  next();
}
```

---

## 十四、参考资料

- [Vue 官方文档](https://cn.vuejs.org/)
- [Vue Router 官方文档](https://router.vuejs.org/zh/)
- [Vuex 官方文档](https://vuex.vuejs.org/zh/)
- 《深入浅出 Vue.js》
- [掘金小册 - Vue 运行机制](https://juejin.cn/book/6844733705089449991)
- [剑指前端 - Vue 面试题](https://github.com/HZFE/awesome-interview)

---

**文档说明**：
- ⭐⭐⭐ 高频考点，必须掌握
- ⭐⭐ 中频考点，建议掌握
- ⭐ 低频考点，了解即可
- 🔥🔥🔥 高难度，需要深入理解
- 🔥🔥 中等难度，需要理解原理
- 🔥 基础难度，理解概念即可


---

## 十五、Vue 复用方案 ⭐⭐⭐ 🔥🔥

### 15.1 Mixin 混入 ⭐⭐⭐ 🔥🔥

**考点**：组件逻辑复用的传统方案

**基本使用**：

```javascript
// 定义 mixin
const myMixin = {
  data() {
    return {
      message: 'Hello from mixin'
    };
  },
  created() {
    console.log('Mixin created');
  },
  methods: {
    greet() {
      console.log(this.message);
    }
  }
};

// 使用 mixin
export default {
  mixins: [myMixin],
  created() {
    console.log('Component created');
    this.greet(); // 可以使用 mixin 的方法
  }
};
```

**合并策略**：

1. **data**：组件数据优先，递归合并
2. **生命周期钩子**：都会被调用，mixin 的钩子先执行
3. **methods、components、directives**：组件选项优先

```javascript
// Mixin
const mixin = {
  data() {
    return { count: 0, name: 'mixin' };
  },
  created() {
    console.log('mixin created');
  },
  methods: {
    greet() {
      console.log('Hello from mixin');
    }
  }
};

// 组件
export default {
  mixins: [mixin],
  data() {
    return { count: 1, age: 18 };  // count 会覆盖 mixin 的 count
  },
  created() {
    console.log('component created');  // mixin 的 created 也会执行
  },
  methods: {
    greet() {
      console.log('Hello from component');  // 覆盖 mixin 的 greet
    }
  }
};

// 输出：
// mixin created
// component created
```

**全局 Mixin**：

```javascript
// 全局 mixin（慎用，会影响所有组件）
Vue.mixin({
  created() {
    console.log('Global mixin created');
  }
});
```

**优缺点**：

优点：
- ✅ 简单易用
- ✅ 可以复用逻辑

缺点：
- ❌ 命名冲突风险
- ❌ 数据来源不清晰
- ❌ 多个 mixin 可能相互影响

**现代替代方案**：
- Vue 3 推荐使用 Composition API
- 更清晰的数据来源
- 更好的类型推导

### 15.2 自定义指令 ⭐⭐ 🔥

**考点**：DOM 操作的复用方案

**全局指令**：

```javascript
// 注册全局指令
Vue.directive('focus', {
  // 当被绑定的元素插入到 DOM 中时
  inserted(el) {
    el.focus();
  }
});

// 使用
<input v-focus />
```

**局部指令**：

```javascript
export default {
  directives: {
    focus: {
      inserted(el) {
        el.focus();
      }
    }
  }
};
```

**钩子函数**：

```javascript
Vue.directive('demo', {
  bind(el, binding, vnode) {
    // 只调用一次，指令第一次绑定到元素时调用
  },
  inserted(el, binding, vnode) {
    // 被绑定元素插入父节点时调用
  },
  update(el, binding, vnode, oldVnode) {
    // 所在组件的 VNode 更新时调用
  },
  componentUpdated(el, binding, vnode, oldVnode) {
    // 所在组件的 VNode 及其子 VNode 全部更新后调用
  },
  unbind(el, binding, vnode) {
    // 只调用一次，指令与元素解绑时调用
  }
});
```

**实用示例**：

```javascript
// 1. 防抖指令
Vue.directive('debounce', {
  inserted(el, binding) {
    let timer;
    el.addEventListener('click', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        binding.value();
      }, 500);
    });
  }
});

// 使用
<button v-debounce="handleClick">Click</button>

// 2. 权限指令
Vue.directive('permission', {
  inserted(el, binding) {
    const permission = binding.value;
    const hasPermission = checkPermission(permission);
    
    if (!hasPermission) {
      el.parentNode && el.parentNode.removeChild(el);
    }
  }
});

// 使用
<button v-permission="'admin'">Delete</button>

// 3. 图片懒加载指令
Vue.directive('lazy', {
  inserted(el, binding) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.src = binding.value;
        observer.unobserve(el);
      }
    });
    observer.observe(el);
  }
});

// 使用
<img v-lazy="imageUrl" />
```

### 15.3 过滤器 ⭐⭐ 🔥

**考点**：文本格式化的复用方案

**注意**：Vue 3 已移除过滤器，推荐使用方法或计算属性

**Vue 2 使用**：

```javascript
// 全局过滤器
Vue.filter('capitalize', function(value) {
  if (!value) return '';
  value = value.toString();
  return value.charAt(0).toUpperCase() + value.slice(1);
});

// 局部过滤器
export default {
  filters: {
    capitalize(value) {
      if (!value) return '';
      value = value.toString();
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
  }
};

// 使用
<div>{{ message | capitalize }}</div>

// 串联使用
<div>{{ message | filterA | filterB }}</div>

// 接收参数
<div>{{ message | filterA('arg1', 'arg2') }}</div>
```

**常用过滤器示例**：

```javascript
// 1. 日期格式化
Vue.filter('formatDate', function(value, format = 'YYYY-MM-DD') {
  return dayjs(value).format(format);
});

// 2. 货币格式化
Vue.filter('currency', function(value) {
  return '¥' + value.toFixed(2);
});

// 3. 文本截断
Vue.filter('truncate', function(value, length = 10) {
  if (value.length <= length) return value;
  return value.substring(0, length) + '...';
});
```

### 15.4 插件 ⭐⭐ 🔥

**考点**：功能扩展的复用方案

**插件定义**：

```javascript
// MyPlugin.js
const MyPlugin = {
  install(Vue, options) {
    // 1. 添加全局方法或属性
    Vue.myGlobalMethod = function() {
      console.log('Global method');
    };
    
    // 2. 添加全局资源
    Vue.directive('my-directive', {
      bind(el, binding, vnode, oldVnode) {
        // 逻辑...
      }
    });
    
    // 3. 注入组件选项
    Vue.mixin({
      created() {
        // 逻辑...
      }
    });
    
    // 4. 添加实例方法
    Vue.prototype.$myMethod = function(methodOptions) {
      // 逻辑...
    };
  }
};

export default MyPlugin;
```

**使用插件**：

```javascript
import MyPlugin from './MyPlugin';

Vue.use(MyPlugin, {
  // 可选的选项对象
  option1: 'value1'
});
```

**实用插件示例**：

```javascript
// Toast 插件
const Toast = {
  install(Vue) {
    // 创建 Toast 组件构造器
    const ToastConstructor = Vue.extend({
      template: '<div class="toast">{{ message }}</div>',
      data() {
        return { message: '' };
      }
    });
    
    // 添加实例方法
    Vue.prototype.$toast = function(message, duration = 2000) {
      const instance = new ToastConstructor({
        data: { message }
      });
      
      instance.$mount();
      document.body.appendChild(instance.$el);
      
      setTimeout(() => {
        document.body.removeChild(instance.$el);
        instance.$destroy();
      }, duration);
    };
  }
};

// 使用
Vue.use(Toast);
this.$toast('Hello World');
```

---

## 十六、Vue.$set 的使用 ⭐⭐⭐ 🔥🔥

### 16.1 为什么需要 $set ⭐⭐⭐ 🔥🔥

**考点**：Vue 2 响应式系统的局限性

**问题场景**：

```javascript
export default {
  data() {
    return {
      student: {
        name: '张三',
        sex: '男'
      }
    };
  },
  mounted() {
    // ❌ 不会触发响应式更新
    this.student.age = 24;
    
    // ✅ 触发响应式更新
    this.$set(this.student, 'age', 24);
    
    // 或使用 Vue.set
    Vue.set(this.student, 'age', 24);
  }
};
```

**原因**：
- Vue 2 使用 Object.defineProperty 实现响应式
- 只能劫持已存在的属性
- 新增属性无法被劫持，不会触发更新

### 16.2 $set 的使用场景 ⭐⭐⭐ 🔥

**1. 对象新增属性**：

```javascript
// ❌ 不会触发更新
this.obj.newKey = 'value';

// ✅ 触发更新
this.$set(this.obj, 'newKey', 'value');
```

**2. 数组通过下标修改**：

```javascript
// ❌ 不会触发更新
this.arr[0] = 'new value';

// ✅ 触发更新
this.$set(this.arr, 0, 'new value');

// 或使用数组方法
this.arr.splice(0, 1, 'new value');
```

**3. 修改数组长度**：

```javascript
// ❌ 不会触发更新
this.arr.length = 0;

// ✅ 触发更新
this.arr.splice(0);
```

### 16.3 $set 的实现原理 ⭐⭐ 🔥🔥

**简化实现**：

```javascript
function set(target, key, val) {
  // 1. 如果是数组，使用 splice 方法
  if (Array.isArray(target)) {
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val;
  }
  
  // 2. 如果 key 已存在，直接赋值（已经是响应式的）
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  
  // 3. 如果是新增属性，需要手动触发响应式
  const ob = target.__ob__;
  
  // 定义响应式属性
  defineReactive(target, key, val);
  
  // 手动触发更新
  ob.dep.notify();
  
  return val;
}
```

**核心步骤**：
1. 判断目标类型（数组/对象）
2. 如果是数组，使用 splice 方法（已被劫持）
3. 如果是对象新增属性，手动定义响应式
4. 手动触发依赖更新

### 16.4 Vue 3 的改进 ⭐⭐ 🔥

**Vue 3 使用 Proxy，不再需要 $set**：

```javascript
// Vue 3 中直接赋值即可
export default {
  data() {
    return {
      student: {
        name: '张三'
      }
    };
  },
  mounted() {
    // ✅ Vue 3 中直接赋值就会触发更新
    this.student.age = 24;
    
    // ✅ 数组下标修改也会触发更新
    this.arr[0] = 'new value';
  }
};
```

**面试要点**：
- Vue 2 需要 $set 是因为 Object.defineProperty 的局限性
- Vue 3 使用 Proxy，不再需要 $set
- 理解 $set 的实现原理和使用场景

---

## 十七、Vue.$mount 挂载 ⭐⭐ 🔥

### 17.1 $mount 的作用 ⭐⭐ 🔥

**考点**：手动挂载 Vue 实例

**基本使用**：

```javascript
// 方式 1：创建时指定 el
new Vue({
  el: '#app',
  render: h => h(App)
});

// 方式 2：使用 $mount 手动挂载
new Vue({
  render: h => h(App)
}).$mount('#app');
```

**注意事项**：
- 挂载会替换掉目标元素，而不是插入其中
- `<div id="app"></div>` 会被 Vue 渲染的内容替换

```html
<!-- 挂载前 -->
<div id="app"></div>

<!-- 挂载后 -->
<div id="app">
  <!-- Vue 渲染的内容 -->
</div>
```

### 17.2 $mount 的使用场景 ⭐⭐ 🔥

**1. 动态创建组件**：

```javascript
import Vue from 'vue';
import MyComponent from './MyComponent.vue';

// 创建组件构造器
const Constructor = Vue.extend(MyComponent);

// 创建实例
const instance = new Constructor({
  propsData: {
    message: 'Hello'
  }
});

// 挂载到 DOM
instance.$mount();
document.body.appendChild(instance.$el);

// 销毁
instance.$destroy();
document.body.removeChild(instance.$el);
```

**2. 实现 Toast/Message 组件**：

```javascript
function showToast(message) {
  const ToastConstructor = Vue.extend({
    template: '<div class="toast">{{ message }}</div>',
    data() {
      return { message };
    }
  });
  
  const instance = new ToastConstructor().$mount();
  document.body.appendChild(instance.$el);
  
  setTimeout(() => {
    document.body.removeChild(instance.$el);
    instance.$destroy();
  }, 2000);
}
```

**3. 延迟挂载**：

```javascript
const vm = new Vue({
  render: h => h(App)
});

// 等待某些条件满足后再挂载
setTimeout(() => {
  vm.$mount('#app');
}, 1000);
```

**面试要点**：
- $mount 用于手动挂载 Vue 实例
- 挂载会替换目标元素，不是插入
- 常用于动态创建组件

---

## 十八、补充知识点

### 18.1 Vue 的数据代理 ⭐⭐ 🔥

**考点**：为什么可以通过 this 直接访问 data 和 methods

**原理**：

```javascript
// Vue 内部实现（简化）
function Vue(options) {
  this._data = options.data;
  
  // 数据代理：将 _data 的属性代理到 Vue 实例上
  Object.keys(this._data).forEach(key => {
    Object.defineProperty(this, key, {
      get() {
        return this._data[key];
      },
      set(newVal) {
        this._data[key] = newVal;
      }
    });
  });
}

// 使用
const vm = new Vue({
  data: {
    message: 'Hello'
  }
});

// 可以直接访问
console.log(vm.message);  // 'Hello'
// 实际访问的是
console.log(vm._data.message);  // 'Hello'
```

### 18.2 Vue 的事件修饰符 ⭐⭐ 🔥

**考点**：常用事件修饰符

```vue
<!-- 阻止默认行为 -->
<form @submit.prevent="onSubmit"></form>

<!-- 阻止事件冒泡 -->
<div @click.stop="onClick"></div>

<!-- 只触发一次 -->
<button @click.once="onClick"></button>

<!-- 捕获模式 -->
<div @click.capture="onClick"></div>

<!-- 只当事件在该元素本身触发时才触发回调 -->
<div @click.self="onClick"></div>

<!-- 滚动事件的默认行为立即触发（不等待 onScroll 完成） -->
<div @scroll.passive="onScroll"></div>

<!-- 按键修饰符 -->
<input @keyup.enter="onEnter" />
<input @keyup.13="onEnter" />

<!-- 系统修饰键 -->
<button @click.ctrl="onClick"></button>
<button @click.ctrl.exact="onClick"></button>  <!-- 只有 Ctrl 被按下 -->

<!-- 鼠标按钮修饰符 -->
<button @click.left="onClick"></button>
<button @click.right="onClick"></button>
<button @click.middle="onClick"></button>
```

### 18.3 Vue 的 v-model 修饰符 ⭐⭐ 🔥

**考点**：v-model 的修饰符

```vue
<!-- .lazy：在 change 事件后同步（而不是 input） -->
<input v-model.lazy="message" />

<!-- .number：自动转为数字 -->
<input v-model.number="age" type="number" />

<!-- .trim：自动过滤首尾空白字符 -->
<input v-model.trim="message" />
```

---

**文档更新**: 2024-01
**补充内容**: Vue 复用方案（Mixin、自定义指令、过滤器、插件）、$set 使用、$mount 挂载、数据代理、事件修饰符
