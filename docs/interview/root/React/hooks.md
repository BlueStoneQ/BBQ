# React Hooks

## 目录

- [核心原理](#核心原理)
- [useState](#usestate)
- [useEffect](#useeffect)
- [useRef](#useref)
- [useMemo / useCallback](#usememo--usecallback)
- [useContext](#usecontext)
- [自定义 Hooks](#自定义-hooks)
- [Hooks 规则与原理](#hooks-规则与原理)
- [常见陷阱](#常见陷阱)

---

## 核心原理

**Hooks 本质**：让函数组件拥有状态和副作用能力。

**底层实现**：每个组件实例维护一个 **hooks 链表**（fiber.memoizedState），按调用顺序存储每个 hook 的状态。

```
组件第一次渲染：
  useState(0)    → 链表节点 1: { state: 0 }
  useEffect(fn)  → 链表节点 2: { effect: fn, deps: [...] }
  useRef(null)   → 链表节点 3: { current: null }

组件重渲染时：
  按同样顺序读取链表 → 节点 1 拿到 state → 节点 2 对比 deps → ...
```

**这就是为什么 Hooks 不能放在条件语句里**——顺序必须固定，否则链表对不上。

---

## useState

### 基础

```tsx
const [count, setCount] = useState(0);

// 直接设值
setCount(5);

// 函数式更新（基于前一个状态）
setCount(prev => prev + 1);
```

### 关键点

| 点 | 说明 |
|----|------|
| 异步批量 | 多次 setState 在同一事件中会合并为一次渲染（React 18 自动批量） |
| 引用类型 | 必须返回新引用才触发渲染（`setList([...list, item])`） |
| 惰性初始化 | `useState(() => expensiveCompute())` 只在首次渲染执行 |
| 闭包陷阱 | 事件处理函数中拿到的是当次渲染的 state 快照 |

### 闭包陷阱

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    // ❌ 连续调用 3 次，结果是 1 不是 3（都基于同一个快照 count=0）
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);

    // ✅ 函数式更新，每次基于最新值
    setCount(c => c + 1);
    setCount(c => c + 1);
    setCount(c => c + 1);  // 结果是 3
  }
}
```

---

## useEffect

### 基础

```tsx
useEffect(() => {
  // 副作用（订阅、请求、DOM 操作）
  const subscription = subscribe(id);

  // 清理函数（组件卸载或依赖变化前执行）
  return () => subscription.unsubscribe();
}, [id]);  // 依赖数组：id 变化时重新执行
```

### 依赖数组的三种形态

| 形态 | 含义 | 执行时机 |
|------|------|---------|
| `useEffect(fn, [a, b])` | 依赖 a 或 b 变化时执行 | a/b 变了才跑 |
| `useEffect(fn, [])` | 无依赖 | 只在 mount 时跑一次 |
| `useEffect(fn)` | 无数组 | 每次渲染都跑（几乎不用） |

### 执行时机

```
渲染 → DOM 更新 → 浏览器绘制 → useEffect 执行（异步，不阻塞绘制）
```

对比 `useLayoutEffect`：
```
渲染 → DOM 更新 → useLayoutEffect 执行（同步）→ 浏览器绘制
```

useLayoutEffect 适用：需要在绘制前读取/修改 DOM（测量尺寸、防闪烁）。

### 常见模式

```tsx
// 数据请求
useEffect(() => {
  let cancelled = false;
  fetchData(id).then(data => {
    if (!cancelled) setData(data);  // 防止组件卸载后 setState
  });
  return () => { cancelled = true; };
}, [id]);

// 事件监听
useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* ... */ };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

---

## useRef

### 两个用途

**1. 持有 DOM 引用**

```tsx
function Input() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();  // 组件挂载后自动聚焦
  }, []);

  return <input ref={inputRef} />;
}
```

**2. 持有可变值（不触发渲染）**

```tsx
function Timer() {
  const intervalRef = useRef<number | null>(null);

  function start() {
    intervalRef.current = setInterval(() => { /* ... */ }, 1000);
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }
  // intervalRef.current 变化不会触发重渲染
}
```

### vs useState

| | useState | useRef |
|--|---------|--------|
| 变化触发渲染 | ✅ | ❌ |
| 渲染间保持值 | ✅ | ✅ |
| 适用 | UI 相关状态 | 定时器 ID、DOM、上一次的值 |

---

## useMemo / useCallback

### useMemo — 缓存值

```tsx
const expensive = useMemo(() => computeHeavy(data), [data]);
// data 不变 → 返回缓存结果，不重新计算
```

### useCallback — 缓存函数

```tsx
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
// id 不变 → 返回同一个函数引用
```

### 本质关系

```tsx
useCallback(fn, deps)  ===  useMemo(() => fn, deps)
```

useCallback 就是 useMemo 的语法糖，专门用于缓存函数。

### 什么时候用 / 不用

| 场景 | 用 | 不用 |
|------|---|------|
| 传给 memo 子组件的 props | ✅ | |
| 作为 useEffect 依赖 | ✅ | |
| 计算量大的派生数据 | ✅ | |
| 组件内部简单计算 | | ✅（缓存本身有开销） |
| 不传给子组件的回调 | | ✅ |

---

## useContext

### 基础

```tsx
// 创建
const ThemeContext = createContext<'light' | 'dark'>('light');

// 提供
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Page />
    </ThemeContext.Provider>
  );
}

// 消费
function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

### 性能问题

**Context 值变化 → 所有消费者重渲染**（无论是否用到变化的字段）。

```tsx
// ❌ 整个 state 作为 value，任何字段变化所有消费者都重渲染
<AppContext.Provider value={{ user, theme, settings }}>

// ✅ 拆分 Context，按变化频率分离
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
```

**大型应用状态管理用 Zustand/Redux，不用 Context**——它们有 selector 机制，只在选中的字段变化时重渲染。

---

## 自定义 Hooks

### 本质

自定义 Hook = 把可复用的状态逻辑抽成函数（以 `use` 开头）。

```tsx
// 封装：窗口尺寸
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handler = () => setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return size;
}

// 使用
function Component() {
  const { width } = useWindowSize();
  return <div>{width > 768 ? 'Desktop' : 'Mobile'}</div>;
}
```

### 常见自定义 Hook

| Hook | 用途 |
|------|------|
| `useDebounce(value, delay)` | 防抖 |
| `usePrevious(value)` | 获取上一次的值 |
| `useLocalStorage(key, initial)` | 持久化状态 |
| `useAsync(asyncFn)` | 异步请求状态管理 |
| `useInterval(callback, delay)` | 安全的 setInterval |

---

## Hooks 规则与原理

### 两条规则

1. **只在顶层调用**（不能在 if/for/嵌套函数中）
2. **只在 React 函数组件或自定义 Hook 中调用**

### 为什么？

因为 React 用**调用顺序**来匹配 hook 和它的状态（链表）：

```tsx
// 第一次渲染：
useState(0)     → 链表[0]
useEffect(fn)   → 链表[1]
useState('')    → 链表[2]

// 如果第二次渲染时条件跳过了第一个 useState：
useEffect(fn)   → 链表[0]  ← 错！拿到了 useState 的状态
useState('')    → 链表[1]  ← 错！整个链表错位
```

---

## 常见陷阱

### 1. 闭包陷阱（Stale Closure）

```tsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count);  // ❌ 永远是 0（闭包捕获了初始值）
      setCount(count + 1); // ❌ 永远设为 1
    }, 1000);
    return () => clearInterval(id);
  }, []);  // 空依赖 = effect 只跑一次 = 闭包锁死初始 count

  // ✅ 解决：函数式更新
  setCount(c => c + 1);
  // ✅ 或者用 ref 持有最新值
}
```

### 2. useEffect 无限循环

```tsx
// ❌ 每次渲染创建新对象 → 依赖变化 → effect 重跑 → setState → 重渲染 → 循环
useEffect(() => {
  fetchData(options);
}, [options]);  // options 是 {} 字面量，每次都是新引用

// ✅ useMemo 稳定引用
const options = useMemo(() => ({ page, size }), [page, size]);
```

### 3. 忘记清理

```tsx
// ❌ 组件卸载后 setState → 内存泄漏 + 警告
useEffect(() => {
  fetchData().then(setData);
}, []);

// ✅ 清理
useEffect(() => {
  let active = true;
  fetchData().then(d => { if (active) setData(d); });
  return () => { active = false; };
}, []);
```
