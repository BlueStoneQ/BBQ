# Vue 3 响应式原理

> 解决什么问题：数据变了 → UI 自动更新。怎么做到的？
> 本质：Proxy 拦截读写 + 依赖收集 + 派发更新。和 React 的根本区别：Vue 精确知道谁依赖了什么，React 不知道。
> 场景：面试高频（DD/Vast 都会问），也是理解 Vue 性能特性的基础。

---

## 目录

- [本质模型](#本质模型)
- [Vue 3 vs Vue 2 响应式对比](#vue-3-vs-vue-2-响应式对比)
- [Proxy 响应式核心流程](#proxy-响应式核心流程)
- [依赖收集（Track）](#依赖收集track)
- [派发更新（Trigger）](#派发更新trigger)
- [ref vs reactive](#ref-vs-reactive)
- [computed 原理](#computed-原理)
- [watch / watchEffect 原理](#watch--watcheffect-原理)
- [和 React 的根本区别](#和-react-的根本区别)
- [常见面试问题](#常见面试问题)

---

## 本质模型

```
Vue 响应式 = 三步：

1. 创建响应式数据：reactive(obj) → 返回 Proxy 代理对象
2. 依赖收集（Track）：组件渲染时读取数据 → Proxy get 拦截 → 记录"谁用了这个数据"
3. 派发更新（Trigger）：数据修改 → Proxy set 拦截 → 通知所有依赖者重新执行

= 发布-订阅模式，Proxy 是"中间商"
```

---

## Vue 3 vs Vue 2 响应式对比

| | Vue 2 | Vue 3 |
|---|---|---|
| 实现方式 | `Object.defineProperty` | `Proxy` |
| 数组监听 | 需要 hack（重写 push/pop 等方法） | 天然支持 |
| 新增属性 | 监听不到（需要 `Vue.set`） | 天然支持 |
| 删除属性 | 监听不到（需要 `Vue.delete`） | 天然支持 |
| 性能 | 递归遍历所有属性（初始化慢） | 惰性代理（访问时才递归） |
| 嵌套对象 | 初始化时递归全部转化 | 访问到才代理（lazy） |

**为什么换 Proxy？** `Object.defineProperty` 只能拦截已有属性的 get/set，对新增/删除/数组下标修改无能为力。Proxy 代理整个对象，什么操作都能拦截。

---

## Proxy 响应式核心流程

```ts
// 简化版 reactive 实现
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);           // 依赖收集：记录谁在读这个 key
      const result = Reflect.get(target, key, receiver);
      if (isObject(result)) {
        return reactive(result);    // 惰性代理：嵌套对象访问时才代理
      }
      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      if (oldValue !== value) {
        trigger(target, key);       // 派发更新：通知所有依赖者
      }
      return result;
    }
  });
}
```

---

## 依赖收集（Track）

**问题：怎么知道"谁"在读这个数据？**

答案：用一个全局变量 `activeEffect` 标记当前正在执行的副作用函数（组件渲染函数 / computed / watchEffect）。

```ts
// 数据结构：targetMap → depsMap → dep（Set）
// targetMap: WeakMap<target, Map<key, Set<effect>>>

const targetMap = new WeakMap();
let activeEffect = null;

function track(target, key) {
  if (!activeEffect) return;  // 没有副作用函数在执行，不收集
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);  // 收集当前副作用
}

// 组件渲染时：
activeEffect = 组件的渲染函数;
render();  // 渲染过程中读取 state.count → 触发 get → track → 收集到 dep 中
activeEffect = null;
```

**数据结构**：
```
targetMap (WeakMap)
  └── state 对象 → depsMap (Map)
        ├── "count" → dep (Set) → [渲染函数A, computed函数B]
        └── "name"  → dep (Set) → [渲染函数C]
```

---

## 派发更新（Trigger）

```ts
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (!dep) return;
  dep.forEach(effect => {
    if (effect.scheduler) {
      effect.scheduler();  // 调度器：组件更新走异步队列（不是立即同步渲染）
    } else {
      effect.run();
    }
  });
}
```

**组件更新不是同步的**：trigger 后不会立即重渲染，而是把更新任务放入微任务队列（`queueJob`），同一 tick 内多次修改只触发一次渲染（和 React batching 类似）。

---

## ref vs reactive

| | ref | reactive |
|---|---|---|
| 用于 | 基本类型（number/string/boolean）+ 任意值 | 对象/数组 |
| 访问方式 | `.value` | 直接访问属性 |
| 实现 | 对象包裹 `{ value: xxx }` + getter/setter | Proxy |
| 解构 | 不丢失响应式（本身就是引用） | ❌ 解构后丢失响应式（需要 `toRefs`） |

```ts
const count = ref(0);       // { value: 0 }，修改 count.value 触发更新
const state = reactive({ count: 0 });  // Proxy 代理，修改 state.count 触发更新

// 解构陷阱
const { count } = reactive({ count: 0 });
// count 是普通数字 0，不是响应式的！
// 需要：const { count } = toRefs(state);
```

---

## computed 原理

**computed = 有缓存的副作用函数（lazy + dirty flag）**

```
1. 创建 computed → 不立即执行
2. 第一次读取 .value → 执行计算函数 → 缓存结果 → dirty = false
3. 依赖没变 → 再次读取直接返回缓存（不重新计算）
4. 依赖变了 → dirty = true → 下次读取时重新计算
```

```ts
const fullName = computed(() => `${first.value} ${last.value}`);
// first/last 没变 → fullName.value 返回缓存
// first 变了 → dirty = true → 下次读 fullName.value 重新计算
```

---

## watch / watchEffect 原理

| | watchEffect | watch |
|---|---|---|
| 依赖 | 自动收集（执行时读了什么就依赖什么） | 显式指定 source |
| 执行时机 | 立即执行一次 | 默认不立即执行（`immediate: true` 可改） |
| 旧值 | 拿不到 | `(newVal, oldVal) => {}` |
| 类比 React | 类似无依赖数组的 useEffect | 类似有依赖数组的 useEffect |

---

## 和 React 的根本区别

| | Vue（响应式） | React（不可变 + 全量 diff） |
|---|---|---|
| 更新检测 | Proxy 精确知道哪个字段变了 | 不知道，从根 diff 整棵树 |
| 更新范围 | 只更新依赖该字段的组件 | 默认父组件更新 → 子组件全部跟着 |
| 优化方式 | 不需要手动优化（天然精准） | 需要 memo/useCallback/useMemo |
| 数据修改 | 直接修改（`state.count++`） | 必须不可变（`setState(count + 1)`） |
| 心智模型 | 可变数据 + 自动追踪 | 不可变数据 + 手动优化 |

**Vue 不需要 Fiber/时间切片**：因为它精确知道谁依赖了什么数据，更新范围本来就小，不需要遍历全树，不会阻塞主线程。

---

## 常见面试问题

| 问题 | 一句话答案 |
|------|-----------|
| Vue 3 为什么用 Proxy 替代 defineProperty？ | Proxy 能拦截新增/删除/数组下标，defineProperty 不行 |
| 响应式的核心流程？ | 读取 → track 收集依赖，修改 → trigger 派发更新 |
| 为什么 ref 需要 .value？ | 基本类型不能用 Proxy（只能代理对象），需要包一层对象 |
| computed 和 method 的区别？ | computed 有缓存（依赖不变不重算），method 每次调用都执行 |
| reactive 解构为什么丢失响应式？ | 解构出来是基本值的拷贝，不是 Proxy 对象 |
| Vue 更新是同步的吗？ | 不是，修改后放入微任务队列（nextTick），同一 tick 合并 |
| 和 React 渲染机制的根本区别？ | Vue 精确追踪依赖只更新相关组件；React 不知道谁变了从根 diff 全树 |
