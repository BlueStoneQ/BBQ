# React 面试知识梳理

> 📌 **频度标识**：⭐⭐⭐ 高频 | ⭐⭐ 中频 | ⭐ 低频  
> 🔥 **难度标识**：🔥🔥🔥 困难 | �🔥 中等 | 🔥 简单

# React 面试知识梳理

> 📌 **频度标识**：⭐⭐⭐ 高频 | ⭐⭐ 中频 | ⭐ 低频  
> 🔥 **难度标识**：🔥🔥🔥 困难 | 🔥🔥 中等 | 🔥 简单

## 目录

- [一、React 基础概念](#一react-基础概念)
- [二、组件](#二组件)
- [三、React Hooks](#三react-hooks)
- [四、性能优化](#四性能优化)
- [五、代码复用模式](#五代码复用模式)
- [六、核心原理](#六核心原理)
- [七、React Router](#七react-router)
- [八、Redux](#八redux)
- [九、TypeScript + React](#九typescript--react)
- [十、高频面试题](#十高频面试题)
- [十一、React Hooks 深入](#十一react-hooks-深入)
- [十二、实战技巧](#十二实战技巧)
- [十三、学习资源](#十三学习资源)

---

## 一、React 基础概念

### 1.1 React 是什么？

**频度**: ⭐⭐⭐ | **难度**: 🔥

**核心概念**：
- React 是一个用于构建用户界面的 JavaScript 库
- 采用组件化开发模式
- 使用虚拟 DOM 提升性能
- 单向数据流

**关键特性**：
1. **声明式编程**：描述 UI 应该是什么样子，而不是如何实现
2. **组件化**：将 UI 拆分为独立、可复用的组件
3. **一次学习，随处编写**：React Native、React VR 等

---

### 1.2 JSX 是什么？

**频度**: ⭐⭐⭐ | **难度**: 🔥

**定义**：
- JSX 是 JavaScript 的语法扩展
- 允许在 JS 中编写类似 HTML 的代码
- 最终会被 Babel 编译为 `React.createElement()` 调用

**示例**：

```jsx
// JSX 写法
const element = <h1>Hello, {name}</h1>;

// 编译后
const element = React.createElement('h1', null, 'Hello, ', name);
```

**注意事项**：
- class 要写成 className
- style 要写成对象形式
- 事件名采用小驼峰命名

---

### 1.3 虚拟 DOM 是什么？

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**定义**：
虚拟 DOM 是真实 DOM 的 JavaScript 对象表示，是一个轻量级的 DOM 副本。


### 2.6 useMemo

#### 📌 性能优化 - 缓存计算结果
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐

**核心作用**：缓存计算结果，避免重复计算

```javascript
function ExpensiveComponent({ items }) {
  // ❌ 每次渲染都会重新计算
  const total = items.reduce((sum, item) => sum + item.price, 0);
  
  // ✅ 只有 items 变化时才重新计算
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price, 0);
  }, [items]);
  
  return <div>Total: {total}</div>;
}
```

**三大使用场景**：

**1. 防止不必要的 effect**
```javascript
function Component() {
  // 缓存对象引用，避免 useEffect 重复执行
  const config = useMemo(() => ({ test: 1 }), []);
  
  useEffect(() => {
    // 只有 config 真正变化时才执行
    doSomething(config);
  }, [config]);
}
```

**2. 防止不必要的 re-render**
```javascript
function Parent() {
  const [count, setCount] = useState(0);
  
  // ❌ 每次渲染都创建新对象，导致子组件重新渲染
  const data = { value: count };
  
  // ✅ 缓存对象，避免子组件不必要的渲染
  const data = useMemo(() => ({ value: count }), [count]);
  
  return <Child data={data} />;
}

const Child = React.memo(({ data }) => {
  console.log('Child render');
  return <div>{data.value}</div>;
});
```

**3. 防止不必要的重复计算**
```javascript
function SearchResults({ query, items }) {
  // 只有 query 或 items 变化时才重新过滤
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, items]);
  
  return <List items={filteredItems} />;
}
```

**使用原则**：
- ✅ 计算开销大的操作
- ✅ 引用类型作为 useEffect 依赖
- ✅ 引用类型作为子组件 props（配合 React.memo）
- ❌ 简单计算（缓存成本 > 计算成本）
- ❌ 所有组件都使用（增加内存消耗）

**面试要点**：
- useMemo 类似 Vue 的 computed
- 缓存是有成本的，不要滥用
- 必须配合 React.memo 才能优化子组件渲染

### 2.7 useCallback

#### 📌 性能优化 - 缓存函数引用
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐

**核心作用**：缓存函数引用，避免子组件不必要的重新渲染

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  
  // ❌ 每次渲染都创建新函数，导致子组件重新渲染
  const handleClick = () => {
    console.log('clicked');
  };
  
  // ✅ 缓存函数引用
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []); // 依赖为空，函数永远不变
  
  // ✅ 依赖 count，当 count 变化时才创建新函数
  const handleIncrement = useCallback(() => {
    setCount(count + 1);
  }, [count]);
  
  return <Child onClick={handleClick} />;
}

const Child = React.memo(({ onClick }) => {
  console.log('Child render');
  return <button onClick={onClick}>Click</button>;
});
```

**useCallback vs useMemo**：
```javascript
// useCallback 缓存函数
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);

// useMemo 缓存函数（等价写法）
const memoizedCallback = useMemo(() => {
  return () => doSomething(a, b);
}, [a, b]);

// useMemo 缓存计算结果
const memoizedValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
```

**优化子组件 re-render 的必要条件**：
1. ✅ 子组件使用 React.memo 包裹
2. ✅ 所有 props 都被缓存（useCallback/useMemo）
3. ❌ 只缓存函数，子组件未使用 React.memo（无效）

**面试要点**：
- useCallback 本质是 useMemo 的语法糖
- 必须配合 React.memo 才有效
- 不要盲目使用，有性能成本

### 2.8 自定义 Hooks

#### 📌 逻辑复用
**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

**核心思想**：提取组件逻辑到可复用的函数

```javascript
// 自定义 Hook：useWindowSize
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return size;
}

// 使用
function MyComponent() {
  const { width, height } = useWindowSize();
  return <div>Window size: {width} x {height}</div>;
}
```

**常见自定义 Hooks**：

```javascript
// useDebounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// usePrevious
function usePrevious(value) {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

// useLocalStorage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });
  
  const setValue = value => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };
  
  return [storedValue, setValue];
}
```

**面试要点**：
- 自定义 Hook 必须以 use 开头
- 可以调用其他 Hooks
- 用于提取组件逻辑，实现代码复用

---

## 三、React 性能优化

### 3.1 React.memo

#### 📌 组件级别优化
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

**核心作用**：类似 PureComponent，浅比较 props，避免不必要的渲染

```javascript
// 普通组件：父组件更新，子组件也会更新
function Child({ name }) {
  console.log('Child render');
  return <div>{name}</div>;
}

// 优化后：只有 props 变化时才更新
const Child = React.memo(function Child({ name }) {
  console.log('Child render');
  return <div>{name}</div>;
});

// 自定义比较函数
const Child = React.memo(
  function Child({ user }) {
    return <div>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // 返回 true 表示不更新，false 表示更新
    return prevProps.user.id === nextProps.user.id;
  }
);
```

**使用场景**：
- ✅ 纯展示组件
- ✅ props 很少变化的组件
- ✅ 渲染开销大的组件
- ❌ props 频繁变化的组件
- ❌ 简单组件（优化成本 > 渲染成本）

### 3.2 优化组合拳

#### 📌 React.memo + useMemo + useCallback
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐⭐

**完整优化示例**：

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');
  
  // 1. 缓存对象
  const user = useMemo(() => ({
    name: 'John',
    age: 30
  }), []); // 不依赖任何状态，永远不变
  
  // 2. 缓存函数
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);
  
  // 3. 缓存计算结果
  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(count);
  }, [count]);
  
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <Child 
        user={user} 
        onClick={handleClick} 
        value={expensiveValue} 
      />
    </div>
  );
}

// 4. 使用 React.memo 包裹子组件
const Child = React.memo(({ user, onClick, value }) => {
  console.log('Child render'); // 只有 props 真正变化时才打印
  return (
    <div>
      <div>{user.name}</div>
      <div>{value}</div>
      <button onClick={onClick}>Click</button>
    </div>
  );
});
```

**优化总结**：
1. **子组件不需要父组件的值和函数** → 只需 React.memo
2. **传递函数给子组件** → React.memo + useCallback
3. **传递对象/数组给子组件** → React.memo + useMemo
4. **传递原始类型** → 不需要 useMemo

**面试要点**：
- 三者必须配合使用才有效
- 不要盲目优化所有组件
- 优化是有成本的（内存、初始化时间）

### 3.3 为什么 Hooks 不能写在条件判断中

#### 📌 Hooks 规则
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐

**核心原因**：Hooks 依赖调用顺序来维护状态

```javascript
// ❌ 错误：条件判断中使用 Hook
function Component({ condition }) {
  if (condition) {
    const [count, setCount] = useState(0); // 错误！
  }
  
  const [name, setName] = useState(''); // 顺序可能错位
}

// ✅ 正确：始终在顶层调用
function Component({ condition }) {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  if (condition) {
    // 使用 count
  }
}
```

**原理解析**：

React 内部维护一个有序表来保存 Hooks 的状态：

```javascript
// 第一次渲染
useState(0)    // → 保存到位置 0: [0, false]
useState(false) // → 保存到位置 1

// 第二次渲染（正常情况）
useState(0)    // → 从位置 0 读取: 0
useState(false) // → 从位置 1 读取: false

// 第二次渲染（条件判断导致跳过第一个 useState）
// useState(0) 被跳过
useState(false) // → 从位置 0 读取: 0 ❌ 错位了！
```

**Hooks 规则**：
1. ✅ 只在函数组件顶层调用 Hooks
2. ✅ 只在 React 函数中调用 Hooks
3. ❌ 不要在循环、条件或嵌套函数中调用
4. ❌ 不要在普通 JavaScript 函数中调用

**面试要点**：
- Hooks 通过调用顺序来维护状态
- 条件判断会导致顺序错位
- 使用 eslint-plugin-react-hooks 检查

---

## 四、React 原理

### 4.1 渲染流程

#### 📌 两阶段渲染
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐

**渲染阶段**：

1. **调度阶段（Reconciler）**：
   - 用新数据生成新的虚拟 DOM 树
   - 通过 Diff 算法对比新旧树
   - 找出需要更新的元素
   - 生成更新队列

2. **渲染阶段（Renderer）**：
   - 遍历更新队列
   - 调用宿主环境 API（DOM、Native）
   - 实际更新渲染元素

**更新粒度**：
- 最小更新粒度是原生标签（div、span 等）
- 不是组件级别的更新

### 4.2 Fiber 架构

#### 📌 可中断的渲染
**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐⭐

**Fiber 的作用**：
- 将渲染工作分片，可中断和恢复
- 优先级调度，高优先级任务优先执行
- 避免长时间阻塞主线程

**Fiber 节点结构**：
```javascript
{
  type: 'div',           // 元素类型
  props: {},             // 属性
  stateNode: DOMNode,    // 真实 DOM 节点
  child: Fiber,          // 第一个子节点
  sibling: Fiber,        // 下一个兄弟节点
  return: Fiber,         // 父节点
  memoizedState: {},     // 保存的状态（Hooks 链表）
  updateQueue: []        // 更新队列
}
```

**面试要点**：
- Fiber 是 React 16 引入的新架构
- 解决了长时间渲染导致的卡顿问题
- 为 Concurrent Mode 奠定基础

### 4.3 Diff 算法

#### 📌 高效对比
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐

**三大策略**：

1. **Tree Diff**：只对比同层节点
2. **Component Diff**：同类型组件才对比
3. **Element Diff**：通过 key 优化列表对比

**key 的重要性**：
```javascript
// ❌ 使用 index 作为 key（可能导致性能问题）
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}

// ✅ 使用唯一 id 作为 key
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

**面试要点**：
- Diff 算法时间复杂度 O(n)
- key 用于优化列表渲染
- 不要使用 index 作为 key（除非列表静态）

### 4.4 Hooks 原理

#### 📌 链表结构
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐⭐

**核心原理**：Hooks 通过链表保存在 Fiber 节点的 memoizedState 上

```javascript
// Fiber 节点
{
  memoizedState: {
    // Hook 1: useState
    memoizedState: 0,
    next: {
      // Hook 2: useEffect
      memoizedState: { create: fn, deps: [] },
      next: {
        // Hook 3: useState
        memoizedState: '',
        next: null
      }
    }
  }
}
```

**执行流程**：

1. **首次渲染（Mount）**：
   - 调用 useState → 创建 Hook 节点 → 添加到链表
   - 调用 useEffect → 创建 Hook 节点 → 添加到链表
   - 按调用顺序构建链表

2. **更新渲染（Update）**：
   - 按顺序遍历链表
   - 读取对应 Hook 的状态
   - 执行对应的更新逻辑

**为什么不能在条件中使用**：
- 条件判断会改变 Hooks 调用顺序
- 导致链表节点错位
- 读取到错误的状态

**面试要点**：
- Hooks 本质是链表结构
- 依赖调用顺序维护状态
- 每个 Hook 对应链表中的一个节点

**工作原理**：
1. 初始渲染时，React 创建虚拟 DOM 树
2. 状态更新时，创建新的虚拟 DOM 树
3. 通过 Diff 算法对比新旧虚拟 DOM
4. 计算出最小变更
5. 批量更新真实 DOM

**优势**：
- 减少直接操作 DOM 的次数
- 批量更新，提升性能
- 跨平台能力（React Native）

---

### 1.4 React 渲染流程

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥🔥

**两个阶段**：

#### 1. 调度阶段（Reconciler）
- 用新数据生成新的虚拟 DOM 树
- 通过 Diff 算法对比新旧树
- 找出需要更新的元素
- 生成更新队列

#### 2. 渲染阶段（Renderer）
- 遍历更新队列
- 调用宿主环境 API（如 DOM API）
- 实际更新渲染元素

**关键概念 - Fiber**：
- Fiber 是 React 16 引入的新架构
- 将渲染工作拆分为多个小任务
- 支持任务的暂停、恢复和优先级调度
- 实现了可中断的渲染

---

## 二、组件

### 2.1 类组件 vs 函数组件

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**类组件**：

```jsx
class Welcome extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  
  render() {
    return <h1>Hello, {this.props.name}</h1>;
  }
}
```

**函数组件**：

```jsx
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}

// 或使用箭头函数
const Welcome = (props) => {
  return <h1>Hello, {props.name}</h1>;
};
```

**对比**：

| 特性 | 类组件 | 函数组件 |
|------|--------|----------|
| 状态管理 | this.state | useState Hook |
| 生命周期 | 生命周期方法 | useEffect Hook |
| this 指向 | 需要绑定 | 无 this |
| 性能 | 相对较重 | 更轻量 |
| 代码量 | 较多 | 较少 |

**最佳实践**：
- 优先使用函数组件 + Hooks
- 无状态组件应该使用函数组件

---

### 2.2 类组件的 this 指向问题

**频度**: ⭐⭐ | **难度**: 🔥🔥

**问题原因**：
- ES6 类中的方法默认开启严格模式
- 严格模式下，this 不会默认指向 window
- React 中的事件回调不是通过实例调用的，而是直接调用
- 因此 this 为 undefined

**解决方案**：

```jsx
class MyComponent extends React.Component {
  // 方案1：构造函数中绑定
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }
  
  // 方案2：箭头函数（推荐）
  handleClick = () => {
    console.log(this);
  }
  
  // 方案3：render 中使用箭头函数（不推荐，每次渲染都创建新函数）
  render() {
    return <button onClick={() => this.handleClick()}>Click</button>;
  }
}
```

---

## 三、React Hooks ⭐⭐⭐

### 3.1 Hooks 是什么？

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**定义**：
- Hooks 是 React 16.8 引入的新特性
- 让函数组件可以使用状态和其他 React 特性
- 无需编写类组件

**核心优势**：
1. 代码更简洁
2. 逻辑复用更容易
3. 避免 this 指向问题
4. 更好的代码组织

**使用规则**：
1. 只能在函数组件顶层调用 Hooks
2. 不能在循环、条件或嵌套函数中调用
3. 只能在 React 函数组件或自定义 Hook 中调用

---

### 3.2 useState

**频度**: ⭐⭐⭐ | **难度**: 🔥

**基本用法**：

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

**函数式更新**：

```jsx
// 当新状态依赖旧状态时，使用函数式更新
setCount(prevCount => prevCount + 1);
```

**初始化函数**：

```jsx
// 复杂计算时，使用函数初始化（只执行一次）
const [state, setState] = useState(() => {
  const initialState = someExpensiveComputation(props);
  return initialState;
});
```

---

### 3.3 useEffect ⭐⭐⭐

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**定义**：
用于处理副作用（side effects），如数据获取、订阅、手动修改 DOM 等。

**基本用法**：

```jsx
useEffect(() => {
  // 副作用代码
  
  return () => {
    // 清理函数（可选）
  };
}, [dependencies]);
```


---

## 五、Redux 状态管理

### 5.1 核心概念

#### 📌 三大原则
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐

1. **单一数据源**：整个应用的 state 存储在一棵 object tree 中
2. **State 只读**：唯一改变 state 的方法是触发 action
3. **使用纯函数修改**：Reducer 必须是纯函数

#### 📌 核心 API
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐

```javascript
// 1. Action - 描述发生了什么
const incrementAction = {
  type: 'INCREMENT',
  payload: 1
};

// 2. Action Creator - 创建 Action 的函数
const increment = (amount) => ({
  type: 'INCREMENT',
  payload: amount
});

// 3. Reducer - 描述如何更新 state
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + action.payload };
    case 'DECREMENT':
      return { count: state.count - action.payload };
    default:
      return state;
  }
}

// 4. Store - 保存 state
import { createStore } from 'redux';
const store = createStore(counterReducer);

// 5. 使用
store.dispatch(increment(1));  // 派发 action
store.getState();               // 获取 state
store.subscribe(() => {         // 订阅变化
  console.log(store.getState());
});
```

### 5.2 React-Redux

#### 📌 连接 React 和 Redux
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

**核心 API**：

```javascript
import { Provider, connect } from 'react-redux';

// 1. Provider - 提供 store
function App() {
  return (
    <Provider store={store}>
      <Counter />
    </Provider>
  );
}

// 2. connect - 连接组件和 store
// 容器组件
const mapStateToProps = (state) => ({
  count: state.count
});

const mapDispatchToProps = (dispatch) => ({
  increment: () => dispatch({ type: 'INCREMENT' }),
  decrement: () => dispatch({ type: 'DECREMENT' })
});

const CounterContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Counter);

// 展示组件
function Counter({ count, increment, decrement }) {
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

**Hooks 方式**：

```javascript
import { useSelector, useDispatch } from 'react-redux';

function Counter() {
  // 读取 state
  const count = useSelector(state => state.count);
  
  // 获取 dispatch
  const dispatch = useDispatch();
  
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>-</button>
    </div>
  );
}
```

### 5.3 useContext + useReducer 替代 Redux

#### 📌 轻量级状态管理
**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

```javascript
// 1. 创建 Context
const CountContext = React.createContext();

// 2. Reducer
function countReducer(state, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

// 3. Provider 组件
function CountProvider({ children }) {
  const [state, dispatch] = useReducer(countReducer, { count: 0 });
  
  return (
    <CountContext.Provider value={{ state, dispatch }}>
      {children}
    </CountContext.Provider>
  );
}

// 4. 使用
function Counter() {
  const { state, dispatch } = useContext(CountContext);
  
  return (
    <div>
      <div>Count: {state.count}</div>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>-</button>
    </div>
  );
}

// 5. App
function App() {
  return (
    <CountProvider>
      <Counter />
    </CountProvider>
  );
}
```

**Redux vs useContext + useReducer**：

| 特性 | Redux | useContext + useReducer |
|------|-------|------------------------|
| 学习成本 | 高 | 低 |
| 中间件 | 支持 | 需自己实现 |
| DevTools | 支持 | 不支持 |
| 性能 | 优化好 | 需手动优化 |
| 适用场景 | 大型应用 | 中小型应用 |

**面试要点**：
- 小型应用可以用 useContext + useReducer
- 大型应用推荐 Redux（工具链完善）
- 理解两者的优劣和适用场景

---

## 六、React Router

### 6.1 基础用法

#### 📌 路由配置
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐

```javascript
import { BrowserRouter, Route, Switch, Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/user/123">User</Link>
      </nav>
      
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/user/:id" component={User} />
        <Route component={NotFound} />
      </Switch>
    </BrowserRouter>
  );
}
```

### 6.2 路由参数和导航

#### 📌 props 注入
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

**路由组件会自动注入三个 props**：

```javascript
function User(props) {
  // 1. match - 路由匹配信息
  const { params, url, path } = props.match;
  console.log(params.id); // 路由参数
  
  // 2. location - 当前位置信息
  const { pathname, search, hash, state } = props.location;
  
  // 3. history - 导航方法
  const { push, replace, goBack, goForward, go } = props.history;
  
  return (
    <div>
      <h1>User {params.id}</h1>
      <button onClick={() => history.push('/home')}>Go Home</button>
      <button onClick={() => history.goBack()}>Go Back</button>
    </div>
  );
}
```

**编程式导航**：

```javascript
// 跳转到新路由
history.push('/home');
history.push('/user/123');
history.push({
  pathname: '/user',
  search: '?id=123',
  state: { from: 'dashboard' }
});

// 替换当前路由（不会留下历史记录）
history.replace('/home');

// 前进后退
history.goBack();
history.goForward();
history.go(-2); // 后退两步
```

**Hooks 方式**：

```javascript
import { useParams, useHistory, useLocation } from 'react-router-dom';

function User() {
  const { id } = useParams();
  const history = useHistory();
  const location = useLocation();
  
  return (
    <div>
      <h1>User {id}</h1>
      <button onClick={() => history.push('/home')}>Go Home</button>
    </div>
  );
}
```

**面试要点**：
- 理解 match、location、history 三个对象
- 掌握编程式导航的使用
- 了解 Hooks 方式的路由操作

---

## 七、React + TypeScript

### 7.1 组件类型定义

#### 📌 函数组件
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

```typescript
// 方式1: React.FC（推荐）
interface Props {
  name: string;
  age?: number;
  onClick: () => void;
}

const MyComponent: React.FC<Props> = ({ name, age = 18, onClick }) => {
  return (
    <div onClick={onClick}>
      {name} - {age}
    </div>
  );
};

// 方式2: 直接定义
function MyComponent({ name, age = 18, onClick }: Props) {
  return (
    <div onClick={onClick}>
      {name} - {age}
    </div>
  );
}
```

#### 📌 类组件
**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

```typescript
interface Props {
  name: string;
}

interface State {
  count: number;
}

class MyComponent extends React.Component<Props, State> {
  state: State = {
    count: 0
  };
  
  handleClick = () => {
    this.setState({ count: this.state.count + 1 });
  };
  
  render() {
    return (
      <div onClick={this.handleClick}>
        {this.props.name}: {this.state.count}
      </div>
    );
  }
}
```

### 7.2 Hooks 类型定义

#### 📌 常用 Hooks 的类型
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

```typescript
// useState
const [count, setCount] = useState<number>(0);
const [user, setUser] = useState<User | null>(null);

// useRef
const inputRef = useRef<HTMLInputElement>(null);
const timerRef = useRef<number | null>(null);

// useEffect
useEffect(() => {
  // 返回清理函数
  return () => {
    console.log('cleanup');
  };
}, []);

// useCallback
const handleClick = useCallback<(id: number) => void>(
  (id) => {
    console.log(id);
  },
  []
);

// useMemo
const memoizedValue = useMemo<number>(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// useContext
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

### 7.3 事件类型

#### 📌 常用事件类型
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐

```typescript
// 鼠标事件
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log(e.currentTarget);
};

// 输入事件
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value);
};

// 表单事件
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

// 键盘事件
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    console.log('Enter pressed');
  }
};
```

### 7.4 配置

#### 📌 tsconfig.json
**考点频度**: ⭐⭐⭐ | **难度**: ⭐⭐

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",  // React 17+
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

**面试要点**：
- 掌握组件 Props 和 State 的类型定义
- 熟悉常用 Hooks 的类型用法
- 了解事件类型的使用

---

## 八、代码复用模式

### 8.1 高阶组件（HOC）

#### 📌 组件增强
**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐⭐

**定义**：高阶组件是一个函数，接收一个组件，返回一个新组件

```javascript
// HOC 定义
function withLoading(WrappedComponent) {
  return function WithLoadingComponent({ isLoading, ...props }) {
    if (isLoading) {
      return <div>Loading...</div>;
    }
    return <WrappedComponent {...props} />;
  };
}

// 使用
const UserListWithLoading = withLoading(UserList);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  
  return <UserListWithLoading isLoading={isLoading} users={users} />;
}
```

**常见 HOC 模式**：

```javascript
// 1. 属性代理
function withUser(WrappedComponent) {
  return function(props) {
    const user = useContext(UserContext);
    return <WrappedComponent {...props} user={user} />;
  };
}

// 2. 反向继承
function withAuth(WrappedComponent) {
  return class extends WrappedComponent {
    componentDidMount() {
      if (!this.props.isAuthenticated) {
        this.props.history.push('/login');
      }
      super.componentDidMount && super.componentDidMount();
    }
  };
}
```

**优缺点**：
- ✅ 逻辑复用
- ✅ 不影响被包裹组件的内部逻辑
- ❌ props 可能重名被覆盖
- ❌ 多层嵌套难以调试

### 8.2 Render Props

#### 📌 渲染逻辑复用
**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

```javascript
// Render Props 组件
class Mouse extends React.Component {
  state = { x: 0, y: 0 };
  
  handleMouseMove = (e) => {
    this.setState({
      x: e.clientX,
      y: e.clientY
    });
  };
  
  render() {
    return (
      <div onMouseMove={this.handleMouseMove}>
        {this.props.render(this.state)}
      </div>
    );
  }
}

// 使用
function App() {
  return (
    <Mouse render={({ x, y }) => (
      <h1>鼠标位置: ({x}, {y})</h1>
    )} />
  );
}

// 或者使用 children
class Mouse extends React.Component {
  // ...
  render() {
    return (
      <div onMouseMove={this.handleMouseMove}>
        {this.props.children(this.state)}
      </div>
    );
  }
}

function App() {
  return (
    <Mouse>
      {({ x, y }) => <h1>鼠标位置: ({x}, {y})</h1>}
    </Mouse>
  );
}
```

**优缺点**：
- ✅ 数据共享、代码复用
- ✅ 将渲染逻辑交给调用者
- ❌ 无法在 return 外访问数据
- ❌ 嵌套写法不够优雅

### 8.3 自定义 Hooks

#### 📌 现代复用方案（推荐）
**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

```javascript
// 自定义 Hook
function useMouse() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  return position;
}

// 使用
function App() {
  const { x, y } = useMouse();
  return <h1>鼠标位置: ({x}, {y})</h1>;
}
```

**三种模式对比**：

| 特性 | HOC | Render Props | 自定义 Hooks |
|------|-----|--------------|-------------|
| 复用逻辑 | ✅ | ✅ | ✅ |
| 代码简洁 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 易于理解 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 类型支持 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 推荐程度 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**面试要点**：
- 现代 React 推荐使用自定义 Hooks
- HOC 和 Render Props 是 Hooks 之前的方案
- 理解三种模式的优劣和适用场景

---

## 九、面试高频问题汇总

### 9.1 基础概念

**Q1: React 是什么？有什么特点？**
- 用于构建用户界面的 JavaScript 库
- 组件化、声明式、虚拟 DOM、单向数据流

**Q2: 虚拟 DOM 是什么？为什么要用虚拟 DOM？**
- JavaScript 对象描述 DOM 结构
- 减少直接操作 DOM，提高性能
- 跨平台能力（React Native）

**Q3: React 和 Vue 的区别？**
- 模板 vs JSX
- 响应式 vs 不可变数据
- Options API vs Hooks
- 生态和社区

### 9.2 Hooks 相关

**Q4: 为什么 Hooks 不能在条件判断中使用？**
- Hooks 依赖调用顺序维护状态
- 条件判断会改变顺序，导致状态错位

**Q5: useEffect 和 useLayoutEffect 的区别？**
- useEffect：异步执行，不阻塞渲染
- useLayoutEffect：同步执行，阻塞渲染
- useLayoutEffect 用于需要同步读取 DOM 的场景

**Q6: useMemo 和 useCallback 的区别？**
- useMemo：缓存计算结果
- useCallback：缓存函数引用
- useCallback 是 useMemo 的语法糖

### 9.3 性能优化

**Q7: React 如何进行性能优化？**
- React.memo 避免不必要的渲染
- useMemo/useCallback 缓存值和函数
- 代码分割（React.lazy + Suspense）
- 虚拟列表（react-window）
- 避免内联对象和函数

**Q8: 什么时候使用 useMemo？**
- 计算开销大的操作
- 引用类型作为 useEffect 依赖
- 引用类型作为子组件 props（配合 React.memo）

### 9.4 原理相关

**Q9: React Fiber 是什么？**
- React 16 引入的新架构
- 将渲染工作分片，可中断和恢复
- 支持优先级调度

**Q10: React 的 Diff 算法？**
- Tree Diff：只对比同层节点
- Component Diff：同类型组件才对比
- Element Diff：通过 key 优化列表

---

## 十、学习资源

### 官方文档
- [React 官方文档](https://react.dev/)
- [React 中文文档](https://zh-hans.react.dev/)
- [Redux 官方文档](https://redux.js.org/)

### 推荐文章
- [React Hooks 入门 - 阮一峰](https://www.ruanyifeng.com/blog/2019/09/react-hooks.html)
- [React Hooks 教程](https://github.com/puxiao/react-hook-tutorial)
- [剑指前端 - React 面试题](https://febook.hzfe.org/awesome-interview/book3/frame-react-hooks)

### 实践项目
- [React + TypeScript Demo](https://github.com/yuyudiandian/react_typescript_demo)
- [Weather App](https://github.com/maoxiaoke/weather-app)

---

## 📝 复习建议

### 优先级划分

**⭐⭐⭐⭐⭐ 必须掌握**：
- useState、useEffect 基础用法
- React.memo、useMemo、useCallback 优化
- Hooks 规则和原理
- 组件通信方式
- 生命周期

**⭐⭐⭐⭐ 重点掌握**：
- useRef、useContext、useReducer
- 自定义 Hooks
- Redux 基础
- React Router 基础
- 性能优化方案

**⭐⭐⭐ 了解即可**：
- Fiber 架构
- Diff 算法细节
- HOC 和 Render Props
- React + TypeScript 高级用法

### 学习路径

1. **基础阶段**：组件、Props、State、事件处理
2. **进阶阶段**：Hooks、性能优化、状态管理
3. **原理阶段**：虚拟 DOM、Fiber、Diff 算法
4. **实战阶段**：项目实践、最佳实践

### 面试准备

1. **手写代码**：自定义 Hooks、简易 Redux
2. **原理讲解**：Hooks 原理、Fiber 架构
3. **性能优化**：优化方案、实际案例
4. **项目经验**：技术选型、难点解决

---

**最后更新**: 2024-01
**文档版本**: v1.0

**模拟生命周期**：

```jsx
// 1. componentDidMount - 只执行一次
useEffect(() => {
  console.log('组件挂载');
}, []);

// 2. componentDidUpdate - 每次更新都执行
useEffect(() => {
  console.log('组件更新');
});

// 3. componentDidUpdate - 监听特定状态
useEffect(() => {
  console.log('count 变化了');
}, [count]);

// 4. componentWillUnmount - 组件卸载
useEffect(() => {
  return () => {
    console.log('组件卸载');
  };
}, []);
```

**注意事项**：
- 依赖数组为空 `[]`：只在挂载时执行一次
- 不传依赖数组：每次渲染都执行
- 传入依赖数组：依赖变化时执行

---

### 3.4 useRef

**频度**: ⭐⭐ | **难度**: 🔥

**用途**：
1. 访问 DOM 元素
2. 保存可变值（不会触发重新渲染）

**基本用法**：

```jsx
function TextInput() {
  const inputRef = useRef(null);
  
  const focusInput = () => {
    inputRef.current.focus();
  };
  
  return (
    <>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  );
}
```

**useRef vs createRef**：
- `createRef`：每次渲染都创建新对象
- `useRef`：始终返回同一个对象引用

---

### 3.5 useContext

**频度**: ⭐⭐ | **难度**: 🔥🔥

**用途**：跨组件传递数据，避免 props 层层传递

**使用步骤**：

```jsx
// 1. 创建 Context
const ThemeContext = React.createContext('light');

// 2. Provider 提供数据
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 3. 使用 useContext 消费数据
function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Button</button>;
}
```

---

### 3.6 useReducer

**频度**: ⭐⭐ | **难度**: 🔥🔥

**定义**：
- useState 的替代方案
- 适合复杂的状态逻辑
- 类似 Redux 的 reducer

**基本用法**：

```jsx
const initialState = { count: 0 };

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return (
    <>
      Count: {state.count}
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
    </>
  );
}
```

**useReducer + useContext 替代 Redux**：

```jsx
// 1. 创建 Context
const StateContext = React.createContext();
const DispatchContext = React.createContext();

// 2. Provider
function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

// 3. 使用
function Component() {
  const state = useContext(StateContext);
  const dispatch = useContext(DispatchContext);
  
  return <div>{state.count}</div>;
}
```

---

### 3.7 useMemo ⭐⭐⭐

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**定义**：
缓存计算结果，避免不必要的重复计算。

**使用场景**：
1. 计算开销大的操作
2. 依赖项未变化时，返回缓存值

**基本用法**：

```jsx
function ExpensiveComponent({ a, b }) {
  // 只有 a 或 b 变化时才重新计算
  const result = useMemo(() => {
    return expensiveCalculation(a, b);
  }, [a, b]);
  
  return <div>{result}</div>;
}
```

**使用原则**：
- ✅ 计算开销大的操作
- ✅ 作为其他 Hook 的依赖项
- ✅ 引用类型需要保持引用稳定
- ❌ 不要过度使用（有成本）
- ❌ 简单计算不需要使用

**类比**：
- 类似 Vue 的 `computed`
- 类似函数式编程的 `memoization`

---

### 3.8 useCallback ⭐⭐⭐

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**定义**：
缓存函数引用，避免子组件不必要的重新渲染。

**基本用法**：

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  // 只有 count 变化时才创建新函数
  const handleClick = useCallback(() => {
    console.log(count);
  }, [count]);
  
  return <Child onClick={handleClick} />;
}
```

**使用场景**：
1. 传递给子组件的回调函数
2. 作为其他 Hook 的依赖项
3. 配合 React.memo 使用

**useCallback vs useMemo**：

```jsx
// useCallback
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);

// 等价于
const memoizedCallback = useMemo(() => {
  return () => doSomething(a, b);
}, [a, b]);
```

---

### 3.9 自定义 Hook

**频度**: ⭐⭐ | **难度**: 🔥🔥

**定义**：
将组件逻辑提取到可复用的函数中。

**命名规则**：
- 必须以 `use` 开头
- 内部可以调用其他 Hook

**示例 - useFetch**：

```jsx
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [url]);
  
  return { data, loading, error };
}

// 使用
function App() {
  const { data, loading, error } = useFetch('/api/users');
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{JSON.stringify(data)}</div>;
}
```

---

## 四、性能优化 ⭐⭐⭐

### 4.1 React.memo

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**定义**：
高阶组件，用于优化函数组件，类似类组件的 `PureComponent`。

**基本用法**：

```jsx
const MyComponent = React.memo(function MyComponent(props) {
  return <div>{props.name}</div>;
});

// 自定义比较函数
const MyComponent = React.memo(
  function MyComponent(props) {
    return <div>{props.name}</div>;
  },
  (prevProps, nextProps) => {
    // 返回 true 表示不重新渲染
    return prevProps.name === nextProps.name;
  }
);
```

**工作原理**：
- 浅比较 props
- props 未变化时，跳过渲染
- 返回上次渲染结果

---

### 4.2 优化组合：React.memo + useMemo + useCallback

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥🔥

**核心思想**：
避免子组件不必要的重新渲染。

**完整示例**：

```jsx
// 子组件 - 使用 React.memo
const Child = React.memo(({ name, onClick }) => {
  console.log('Child render');
  return <button onClick={onClick}>{name}</button>;
});

// 父组件
function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('Button');
  
  // 缓存对象 - 使用 useMemo
  const config = useMemo(() => ({
    color: 'blue',
    size: 'large'
  }), []);
  
  // 缓存函数 - 使用 useCallback
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <Child name={name} onClick={handleClick} />
    </div>
  );
}
```

**优化条件**（必须同时满足）：
1. 子组件使用 `React.memo` 包裹
2. 传递给子组件的所有 props 都被缓存
3. 引用类型使用 `useMemo` 缓存
4. 函数使用 `useCallback` 缓存

**注意事项**：
- 不要过度优化
- 缓存本身有成本
- 简单组件不需要优化

---

## 五、代码复用模式

### 5.1 高阶组件（HOC）

**频度**: ⭐⭐ | **难度**: 🔥🔥

**定义**：
接收组件作为参数，返回新组件的函数。

**基本用法**：

```jsx
function withLoading(WrappedComponent) {
  return function WithLoadingComponent({ isLoading, ...props }) {
    if (isLoading) return <div>Loading...</div>;
    return <WrappedComponent {...props} />;
  };
}

// 使用
const UserListWithLoading = withLoading(UserList);
```

**优点**：
- 逻辑复用
- 不影响被包裹组件的内部逻辑

**缺点**：
- props 可能被覆盖
- 嵌套过多时难以调试

---

### 5.2 Render Props

**频度**: ⭐⭐ | **难度**: 🔥🔥

**定义**：
通过 props 传递渲染函数，实现逻辑复用。

**基本用法**：

```jsx
class Mouse extends React.Component {
  state = { x: 0, y: 0 };
  
  handleMouseMove = (e) => {
    this.setState({ x: e.clientX, y: e.clientY });
  };
  
  render() {
    return (
      <div onMouseMove={this.handleMouseMove}>
        {this.props.render(this.state)}
      </div>
    );
  }
}

// 使用
<Mouse render={({ x, y }) => (
  <h1>鼠标位置：({x}, {y})</h1>
)} />
```

**优点**：
- 数据共享
- 代码复用
- 渲染逻辑由调用者决定

**缺点**：
- 嵌套写法不够优雅
- 无法在 return 外访问数据

---

### 5.3 自定义 Hooks（推荐）

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**优点**：
- 代码简洁
- 逻辑清晰
- 易于测试

**对比**：

| 特性 | HOC | Render Props | 自定义 Hooks |
|------|-----|--------------|--------------|
| 代码简洁度 | 中 | 低 | 高 |
| 嵌套问题 | 有 | 有 | 无 |
| 类型推导 | 困难 | 困难 | 容易 |
| 推荐度 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 六、核心原理 ⭐⭐⭐

### 6.1 Hooks 原理

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥🔥

**核心机制**：

1. **Fiber 节点上的链表**
   - 每个函数组件对应一个 Fiber 节点
   - Fiber 节点的 `memoizedState` 属性存储 Hooks 链表
   - 每次调用 Hook，就在链表上添加一个节点

2. **Hook 节点结构**：
```javascript
{
  memoizedState: null,  // 当前 Hook 的状态
  baseState: null,      // 基础状态
  queue: null,          // 更新队列
  next: null            // 指向下一个 Hook
}
```

3. **执行流程**：
   - **Mount 阶段**：创建 Hook 链表，初始化状态
   - **Update 阶段**：按顺序遍历链表，更新状态
   - **Unmount 阶段**：执行清理函数

**为什么不能在循环、条件中使用 Hooks？**

```jsx
// ❌ 错误示例
function Component() {
  if (condition) {
    const [state, setState] = useState(0);  // 可能不执行
  }
  const [count, setCount] = useState(0);    // 位置错乱
}
```

**原因**：
- Hooks 依赖调用顺序来维护状态
- 条件判断会导致 Hook 调用顺序不一致
- 链表节点错位，状态混乱

**正确做法**：
```jsx
// ✅ 正确示例
function Component() {
  const [state, setState] = useState(0);
  const [count, setCount] = useState(0);
  
  if (condition) {
    // 在这里使用 state
  }
}
```

---

### 6.2 Diff 算法

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥🔥

**核心策略**：

1. **同层比较**
   - 只比较同一层级的节点
   - 不跨层级比较
   - 时间复杂度：O(n)

2. **类型比较**
   - 不同类型的元素，直接替换
   - 相同类型的元素，更新属性

3. **Key 的作用**
   - 帮助 React 识别哪些元素改变了
   - 提高列表渲染性能

**示例**：

```jsx
// 没有 key - 性能差
{list.map(item => <div>{item.name}</div>)}

// 有 key - 性能好
{list.map(item => <div key={item.id}>{item.name}</div>)}
```

**注意事项**：
- key 应该稳定、唯一
- 不要使用 index 作为 key（列表会变化时）
- key 只在兄弟节点间唯一即可

---

### 6.3 Fiber 架构

**频度**: ⭐⭐ | **难度**: 🔥🔥🔥

**为什么需要 Fiber？**
- React 15 的 Stack Reconciler 是同步的
- 大型应用渲染时会阻塞主线程
- 导致页面卡顿、掉帧

**Fiber 的特性**：
1. **可中断**：渲染可以被打断
2. **可恢复**：可以从中断处继续
3. **优先级**：不同任务有不同优先级
4. **时间切片**：将渲染工作分片执行

**工作原理**：
- 将渲染工作拆分为多个小任务
- 每个任务执行完后，检查是否有更高优先级任务
- 有则暂停当前任务，执行高优先级任务
- 利用浏览器空闲时间（requestIdleCallback）

---

## 七、React Router

### 7.1 基本使用

**频度**: ⭐⭐⭐ | **难度**: 🔥

**核心组件**：

```jsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/user/:id" element={<User />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 7.2 编程式导航

**频度**: ⭐⭐⭐ | **难度**: 🔥

```jsx
import { useNavigate, useParams, useLocation } from 'react-router-dom';

function Component() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  
  // 导航
  navigate('/home');
  navigate('/user/123');
  navigate(-1);  // 后退
  
  // 获取参数
  const { id } = params;
  
  // 获取 location
  console.log(location.pathname);
  console.log(location.search);
}
```

---

## 八、Redux

### 8.1 核心概念

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**三大原则**：
1. **单一数据源**：整个应用的 state 存储在一棵树中
2. **State 只读**：唯一改变 state 的方法是触发 action
3. **纯函数修改**：使用纯函数 reducer 来修改 state

**核心概念**：
- **Store**：存储应用状态
- **Action**：描述发生了什么
- **Reducer**：根据 action 更新 state

**基本使用**：

```jsx
// 1. 创建 reducer
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

// 2. 创建 store
import { createStore } from 'redux';
const store = createStore(counterReducer);

// 3. 订阅变化
store.subscribe(() => {
  console.log(store.getState());
});

// 4. 派发 action
store.dispatch({ type: 'INCREMENT' });
```

### 8.2 React-Redux

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**核心 API**：

```jsx
import { Provider, useSelector, useDispatch } from 'react-redux';

// 1. Provider 提供 store
function App() {
  return (
    <Provider store={store}>
      <Counter />
    </Provider>
  );
}

// 2. 使用 Hooks
function Counter() {
  // 获取 state
  const count = useSelector(state => state.count);
  
  // 获取 dispatch
  const dispatch = useDispatch();
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+1</button>
    </div>
  );
}
```

---

## 九、TypeScript + React

### 9.1 函数组件类型

**频度**: ⭐⭐ | **难度**: 🔥🔥

```tsx
// 方式1：React.FC
const Component: React.FC<Props> = ({ name }) => {
  return <div>{name}</div>;
};

// 方式2：直接定义（推荐）
interface Props {
  name: string;
  age?: number;
}

function Component({ name, age }: Props) {
  return <div>{name}</div>;
}
```

### 9.2 Hooks 类型

```tsx
// useState
const [count, setCount] = useState<number>(0);
const [user, setUser] = useState<User | null>(null);

// useRef
const inputRef = useRef<HTMLInputElement>(null);

// useReducer
type State = { count: number };
type Action = { type: 'increment' } | { type: 'decrement' };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
  }
};

const [state, dispatch] = useReducer(reducer, { count: 0 });
```

### 9.3 事件类型

```tsx
function Component() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log(e.currentTarget);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);
  };
  
  return (
    <>
      <button onClick={handleClick}>Click</button>
      <input onChange={handleChange} />
    </>
  );
}
```

---

## 十、高频面试题

### 10.1 为什么 Hooks 不能在循环、条件中使用？⭐⭐⭐

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥🔥

**答案要点**：
1. Hooks 依赖调用顺序维护状态
2. 内部使用链表存储 Hook 状态
3. 条件判断会导致调用顺序不一致
4. 链表节点错位，状态混乱

**详细解释**：
- React 在 Fiber 节点的 `memoizedState` 上维护 Hook 链表
- 每次渲染按顺序遍历链表
- 如果某个 Hook 因条件判断未执行，后续 Hook 会取到错误的状态

---

### 10.2 useEffect 和 useLayoutEffect 的区别？⭐⭐

**频度**: ⭐⭐ | **难度**: 🔥🔥

**区别**：

| 特性 | useEffect | useLayoutEffect |
|------|-----------|-----------------|
| 执行时机 | 浏览器绘制后（异步） | 浏览器绘制前（同步） |
| 阻塞渲染 | 不阻塞 | 阻塞 |
| 使用场景 | 大部分副作用 | DOM 测量、同步更新 |

**使用建议**：
- 优先使用 `useEffect`
- 需要同步更新 DOM 时使用 `useLayoutEffect`

---

### 10.3 React 性能优化手段？⭐⭐⭐

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**优化手段**：

1. **组件层面**
   - 使用 `React.memo` 避免不必要渲染
   - 使用 `PureComponent`（类组件）
   - 合理拆分组件

2. **Hooks 层面**
   - `useMemo` 缓存计算结果
   - `useCallback` 缓存函数引用
   - 避免在 render 中创建新对象/函数

3. **列表渲染**
   - 使用稳定的 key
   - 虚拟滚动（react-window）

4. **代码分割**
   - `React.lazy` + `Suspense`
   - 路由懒加载

5. **其他**
   - 避免内联对象/函数
   - 使用 Web Worker 处理复杂计算
   - 使用 Profiler 分析性能

---

### 10.4 受控组件 vs 非受控组件？⭐⭐

**频度**: ⭐⭐ | **难度**: 🔥

**受控组件**：
- 表单数据由 React 组件管理
- 通过 state 和 onChange 控制

```jsx
function Controlled() {
  const [value, setValue] = useState('');
  
  return (
    <input 
      value={value} 
      onChange={e => setValue(e.target.value)} 
    />
  );
}
```

**非受控组件**：
- 表单数据由 DOM 自己管理
- 通过 ref 获取值

```jsx
function Uncontrolled() {
  const inputRef = useRef();
  
  const handleSubmit = () => {
    console.log(inputRef.current.value);
  };
  
  return <input ref={inputRef} />;
}
```

**对比**：
- 受控组件：实时验证、条件禁用、格式化输入
- 非受控组件：简单场景、文件上传

---

### 10.5 React 18 新特性？⭐⭐

**频度**: ⭐⭐ | **难度**: 🔥🔥

**主要特性**：

1. **并发渲染（Concurrent Rendering）**
   - 可中断的渲染
   - 自动批处理（Automatic Batching）

2. **新 Hooks**
   - `useId`：生成唯一 ID
   - `useTransition`：标记低优先级更新
   - `useDeferredValue`：延迟更新值

3. **Suspense 改进**
   - 支持服务端渲染
   - 流式 SSR

4. **Strict Mode 改进**
   - 检测副作用
   - 模拟组件卸载/重新挂载

---

### 10.6 setState 是同步还是异步？⭐⭐⭐

**频度**: ⭐⭐⭐ | **难度**: 🔥🔥

**答案**：
- 在 React 18 之前：**看情况**
  - React 事件处理函数中：异步
  - setTimeout、原生事件中：同步
  
- 在 React 18 之后：**都是异步**（自动批处理）

**示例**：

```jsx
// React 17
function Component() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    setCount(count + 1);
    console.log(count);  // 0（异步）
  };
  
  const handleTimeout = () => {
    setTimeout(() => {
      setCount(count + 1);
      console.log(count);  // 1（同步）
    }, 0);
  };
}

// React 18 - 都是异步
```

**为什么异步？**
- 性能优化：批量更新，减少渲染次数
- 保持一致性：props 和 state 同步更新

---

### 10.7 虚拟 DOM 一定比真实 DOM 快吗？⭐⭐

**频度**: ⭐⭐ | **难度**: 🔥🔥

**答案**：不一定

**分析**：
1. **虚拟 DOM 的优势**
   - 减少不必要的 DOM 操作
   - 批量更新
   - 跨平台能力

2. **虚拟 DOM 的劣势**
   - 需要额外的计算（Diff）
   - 内存占用

3. **什么时候慢？**
   - 简单场景：直接操作 DOM 更快
   - 首次渲染：虚拟 DOM 有额外开销

4. **什么时候快？**
   - 复杂场景：大量 DOM 更新
   - 频繁更新：批量处理更高效

**结论**：
虚拟 DOM 的价值不在于性能，而在于：
- 声明式编程
- 组件化
- 跨平台

---

## 十一、实战技巧

### 11.1 常用自定义 Hooks

**useDebounce**：

```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}
```

**useLocalStorage**：

```jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });
  
  const setStoredValue = (newValue) => {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(newValue));
  };
  
  return [value, setStoredValue];
}
```

**usePrevious**：

```jsx
function usePrevious(value) {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}
```

---

### 11.2 错误边界

**频度**: ⭐⭐ | **难度**: 🔥🔥

**定义**：
捕获子组件树中的 JavaScript 错误，记录错误并展示降级 UI。

**实现**（只能用类组件）：

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.log('Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    
    return this.props.children;
  }
}

// 使用
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

**注意**：
- 无法捕获事件处理器中的错误
- 无法捕获异步代码中的错误
- 无法捕获自身的错误

---

### 11.3 代码分割

**频度**: ⭐⭐ | **难度**: 🔥

**React.lazy + Suspense**：

```jsx
import React, { lazy, Suspense } from 'react';

// 懒加载组件
const LazyComponent = lazy(() => import('./LazyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  );
}
```

**路由懒加载**：

```jsx
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Suspense>
  );
}
```

---

## 十二、学习资源

### 12.1 官方文档
- [React 官方文档](https://react.dev/)
- [React 中文文档](https://zh-hans.react.dev/)

### 12.2 推荐阅读
- [React 技术揭秘](https://react.iamkasong.com/)
- [图解 React 原理](https://7km.top/)

### 12.3 实战项目
- [React 官方示例](https://github.com/facebook/react)
- [Awesome React](https://github.com/enaqx/awesome-react)

---

## 十三、面试准备清单

### 核心必会 ⭐⭐⭐
- [ ] React 基本概念（虚拟 DOM、JSX、组件）
- [ ] Hooks 使用（useState、useEffect、useMemo、useCallback）
- [ ] Hooks 原理（为什么不能在条件中使用）
- [ ] 性能优化（React.memo、useMemo、useCallback）
- [ ] 生命周期（类组件 + Hooks 模拟）
- [ ] Diff 算法
- [ ] 代码复用（HOC、Render Props、自定义 Hooks）

### 进阶掌握 ⭐⭐
- [ ] Fiber 架构
- [ ] 并发渲染
- [ ] React 18 新特性
- [ ] Redux 原理
- [ ] React Router 使用
- [ ] TypeScript + React

### 加分项 ⭐
- [ ] 源码阅读经验
- [ ] 性能优化实战
- [ ] 自定义 Hooks 封装
- [ ] 错误边界处理
- [ ] SSR（服务端渲染）

---

## 总结

React 面试重点：
1. **基础扎实**：虚拟 DOM、组件、生命周期
2. **Hooks 熟练**：常用 Hooks + 原理
3. **性能优化**：React.memo + useMemo + useCallback
4. **原理理解**：Fiber、Diff、Hooks 原理
5. **实战经验**：自定义 Hooks、性能优化案例

祝你面试顺利！🎉


---

## 十一、React Hooks 深入 ⭐⭐⭐ 🔥🔥🔥

### 11.1 Hooks 原理 - 为什么不能在循环、条件和嵌套函数中使用 ⭐⭐⭐ 🔥🔥🔥

**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: 🔥🔥🔥🔥🔥

**核心原因**：React Hooks 依赖调用顺序来维护状态

**原理解析**：

React 在每次组件渲染时，所有的 Hook 都会按照它们出现的顺序被调用。React 在内部维护一个有序表（链表）来保存 Hooks 的状态。

```javascript
// React 内部维护的 Hooks 链表
// 第一次渲染
useState(0)     // → 保存到位置 0
useState(false) // → 保存到位置 1
useEffect(...)  // → 保存到位置 2

// 第二次渲染（正常情况）
useState(0)     // → 从位置 0 读取
useState(false) // → 从位置 1 读取
useEffect(...)  // → 从位置 2 读取
```

**如果在条件中使用 Hook 会发生什么**：

```javascript
// ❌ 错误示例
function Component({ condition }) {
  if (condition) {
    const [count, setCount] = useState(0); // 可能被跳过
  }
  const [name, setName] = useState(''); // 位置可能错位
}

// 第一次渲染（condition = true）
useState(0)    // → 位置 0
useState('')   // → 位置 1

// 第二次渲染（condition = false）
// useState(0) 被跳过
useState('')   // → 从位置 0 读取 ❌ 错位了！应该读取位置 1
```

**为什么这样设计**：

1. **性能考虑**：通过顺序访问链表，避免使用 Map 或对象查找
2. **简化实现**：不需要为每个 Hook 指定唯一标识符
3. **保持状态一致性**：确保每次渲染时 Hook 的调用顺序相同

**React 如何保留和重用 Hook 的调用结果**：

```javascript
// Fiber 节点结构（简化）
{
  memoizedState: {
    // Hook 1: useState
    memoizedState: 0,
    next: {
      // Hook 2: useEffect
      memoizedState: { create: fn, deps: [] },
      next: {
        // Hook 3: useState
        memoizedState: '',
        next: null
      }
    }
  }
}
```

**正确做法**：

```javascript
// ✅ 正确：始终在顶层调用
function Component({ condition }) {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  // 在 Hook 调用之后使用条件判断
  if (condition) {
    // 使用 count
  }
}
```

**Hooks 规则总结**：

1. ✅ 只在函数组件的最顶层调用 Hooks
2. ✅ 只在 React 函数中调用 Hooks（函数组件或自定义 Hook）
3. ❌ 不要在循环中调用
4. ❌ 不要在条件判断中调用
5. ❌ 不要在嵌套函数中调用
6. ❌ 不要在普通 JavaScript 函数中调用

**工具支持**：

使用 `eslint-plugin-react-hooks` 插件自动检查 Hooks 规则：

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**面试要点**：
- Hooks 通过调用顺序维护状态，使用链表结构
- 条件判断会导致顺序错位，读取到错误的状态
- 这是 React 为了性能和简化实现做的权衡
- 必须使用 ESLint 插件来检查 Hooks 规则

---

### 11.2 useReducer + useContext 替代 Redux ⭐⭐⭐ 🔥🔥🔥

**考点频度**: ⭐⭐⭐⭐⭐ | **难度**: 🔥🔥🔥🔥

**核心思想**：使用 React 内置 Hooks 实现轻量级状态管理

**完整实现**：

```javascript
// 1. 定义初始状态
// initState.js
export default {
  count: 0,
  user: null
};

// 2. 定义 Reducer
// reducer.js
import { useReducer } from 'react';
import initState from './initState';

const reducer = (state, action) => {
  const { type, ...payload } = action;

  switch(type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'DECREMENT':
      return { ...state, count: state.count - 1 };
    case 'SET_USER':
      return { ...state, user: payload.user };
    default:
      return state;
  }
};

export { reducer, initState };

// 3. 创建 Context
// context.js
import React from 'react';

export const StateContext = React.createContext();
export const DispatchContext = React.createContext();

// 4. 创建 Provider 组件
// Provider.js
import React, { useReducer } from 'react';
import { StateContext, DispatchContext } from './context';
import { reducer, initState } from './reducer';

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initState);
  
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

// 5. 创建自定义 Hook（可选，简化使用）
// hooks.js
import { useContext } from 'react';
import { StateContext, DispatchContext } from './context';

export function useAppState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}

export function useAppDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within AppProvider');
  }
  return context;
}

// 6. 在根组件中使用 Provider
// App.js
import React from 'react';
import { AppProvider } from './Provider';
import Counter from './Counter';

function App() {
  return (
    <AppProvider>
      <Counter />
    </AppProvider>
  );
}

export default App;

// 7. 在子组件中使用
// Counter.js
import React from 'react';
import { useAppState, useAppDispatch } from './hooks';

function Counter() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  
  return (
    <div>
      <div>Count: {state.count}</div>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>-</button>
    </div>
  );
}

export default Counter;
```

**优化：分离 State 和 Dispatch Context**

为什么要分离？
- 避免不必要的重新渲染
- 只使用 dispatch 的组件不会因为 state 变化而重新渲染

```javascript
// ❌ 不好：state 和 dispatch 在同一个 Context
const AppContext = React.createContext();

function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, initState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// 问题：即使组件只使用 dispatch，state 变化时也会重新渲染

// ✅ 好：分离 state 和 dispatch
const StateContext = React.createContext();
const DispatchContext = React.createContext();

function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, initState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

// 只使用 dispatch 的组件不会因为 state 变化而重新渲染
```

**与 Redux 对比**：

| 特性 | Redux | useReducer + useContext |
|------|-------|------------------------|
| **学习成本** | 高 | 低 |
| **代码量** | 多 | 少 |
| **中间件** | 丰富 | 需自己实现 |
| **DevTools** | 支持 | 不支持 |
| **性能优化** | 内置优化 | 需手动优化 |
| **适用场景** | 大型应用 | 中小型应用 |

**性能优化建议**：

```javascript
// 1. 使用 React.memo 避免不必要的渲染
const Counter = React.memo(function Counter() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  
  return (
    <div>
      <div>Count: {state.count}</div>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
    </div>
  );
});

// 2. 使用 useMemo 缓存派生状态
function Component() {
  const state = useAppState();
  
  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(state);
  }, [state]);
  
  return <div>{expensiveValue}</div>;
}

// 3. 使用 useCallback 缓存回调函数
function Component() {
  const dispatch = useAppDispatch();
  
  const handleIncrement = useCallback(() => {
    dispatch({ type: 'INCREMENT' });
  }, [dispatch]);
  
  return <button onClick={handleIncrement}>+</button>;
}
```

**面试要点**：
- 适合中小型应用，大型应用推荐 Redux
- 需要分离 State 和 Dispatch Context 优化性能
- 配合 React.memo、useMemo、useCallback 使用
- 理解与 Redux 的优劣和适用场景

---

### 11.3 useRef + forwardRef ⭐⭐⭐ 🔥🔥

**考点频度**: ⭐⭐⭐⭐ | **难度**: 🔥🔥🔥

**useRef 的两大用途**：

#### 1. 访问 DOM 元素

```javascript
function TextInput() {
  const inputRef = useRef(null);
  
  const focusInput = () => {
    inputRef.current.focus();
  };
  
  return (
    <>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  );
}
```

#### 2. 保存可变值（不触发重新渲染）

```javascript
function Timer() {
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);
  
  useEffect(() => {
    // 保存定时器 ID
    timerRef.current = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
    
    return () => {
      // 清理定时器
      clearInterval(timerRef.current);
    };
  }, []);
  
  return <div>Count: {count}</div>;
}
```

**forwardRef：转发 ref 到子组件**

```javascript
// 子组件：使用 forwardRef 包裹
const FancyInput = React.forwardRef((props, ref) => {
  return <input ref={ref} className="fancy-input" {...props} />;
});

// 父组件：可以直接访问子组件的 DOM
function Parent() {
  const inputRef = useRef(null);
  
  const focusInput = () => {
    inputRef.current.focus();
  };
  
  return (
    <>
      <FancyInput ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  );
}
```

**useImperativeHandle：自定义暴露给父组件的实例值**

```javascript
const FancyInput = React.forwardRef((props, ref) => {
  const inputRef = useRef(null);
  
  // 自定义暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current.focus();
    },
    clear: () => {
      inputRef.current.value = '';
    }
  }));
  
  return <input ref={inputRef} {...props} />;
});

// 父组件使用
function Parent() {
  const inputRef = useRef(null);
  
  return (
    <>
      <FancyInput ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>Focus</button>
      <button onClick={() => inputRef.current.clear()}>Clear</button>
    </>
  );
}
```

**useRef vs createRef**：

```javascript
// createRef：每次渲染都创建新对象
class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.inputRef = React.createRef(); // 每次渲染都是新对象
  }
  
  render() {
    return <input ref={this.inputRef} />;
  }
}

// useRef：始终返回同一个对象引用
function MyComponent() {
  const inputRef = useRef(null); // 始终是同一个对象
  
  return <input ref={inputRef} />;
}
```

**面试要点**：
- useRef 可以保存任何可变值，不仅仅是 DOM 引用
- useRef 的值变化不会触发重新渲染
- forwardRef 用于转发 ref 到子组件
- useImperativeHandle 用于自定义暴露给父组件的实例值

---

### 11.4 常用自定义 Hooks ⭐⭐⭐ 🔥🔥

**考点频度**: ⭐⭐⭐⭐ | **难度**: ⭐⭐⭐

**1. useDebounce - 防抖**

```javascript
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// 使用
function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      // 发起搜索请求
      fetchSearchResults(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);
  
  return (
    <input
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
  );
}
```

**2. useThrottle - 节流**

```javascript
function useThrottle(value, delay) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return throttledValue;
}
```

**3. usePrevious - 获取上一次的值**

```javascript
function usePrevious(value) {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

// 使用
function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);
  
  return (
    <div>
      <div>当前: {count}</div>
      <div>之前: {prevCount}</div>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
```

**4. useLocalStorage - 持久化状态**

```javascript
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });
  
  const setValue = value => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  
  return [storedValue, setValue];
}

// 使用
function App() {
  const [name, setName] = useLocalStorage('name', 'Bob');
  
  return (
    <input
      value={name}
      onChange={e => setName(e.target.value)}
    />
  );
}
```

**5. useToggle - 布尔值切换**

```javascript
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  
  const toggle = useCallback(() => {
    setValue(v => !v);
  }, []);
  
  return [value, toggle];
}

// 使用
function Modal() {
  const [isOpen, toggleOpen] = useToggle(false);
  
  return (
    <>
      <button onClick={toggleOpen}>Toggle Modal</button>
      {isOpen && <div>Modal Content</div>}
    </>
  );
}
```

**6. useOnClickOutside - 点击外部关闭**

```javascript
function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = event => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// 使用
function Dropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  
  useOnClickOutside(ref, () => setIsOpen(false));
  
  return (
    <div ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && <div>Dropdown Content</div>}
    </div>
  );
}
```

**7. useInterval - 声明式定时器**

```javascript
function useInterval(callback, delay) {
  const savedCallback = useRef();
  
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// 使用
function Counter() {
  const [count, setCount] = useState(0);
  
  useInterval(() => {
    setCount(count + 1);
  }, 1000);
  
  return <div>{count}</div>;
}
```

**面试要点**：
- 自定义 Hook 必须以 use 开头
- 可以调用其他 Hooks
- 用于提取组件逻辑，实现代码复用
- 掌握常用自定义 Hooks 的实现

---

## 十二、补充资料

### 参考链接

- [React Hooks 常用自定义 Hook](https://juejin.cn/post/6844904074433789959)
- [useReducer + useContext 替代 Redux](https://juejin.cn/post/6995105000523317278)
- [useReducer + useContext 实践](https://juejin.cn/post/6844904153773244429)

---

**文档更新**: 2024-01
**补充内容**: React Hooks 深入原理、useReducer + useContext 状态管理、useRef + forwardRef、常用自定义 Hooks
