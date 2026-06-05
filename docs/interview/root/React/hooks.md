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

**底层实现**：一个函数组件 = 一个 Fiber 节点 = 一条 Hooks 链表。

```
Fiber 节点（对应 <TodoList /> 组件）
  │
  └── memoizedState ──→ Hook1(useState) → Hook2(useEffect) → Hook3(useRef) → null
                         │                  │                  │
                         state: 0           effect: fn         current: null
                         queue: [...]       deps: [id]
```

每次渲染时，React 内部有一个"当前 hook 指针"，从链表头开始，每调用一个 hook 就往后移一位：

```tsx
function TodoList() {
  // 指针 → Hook1，读取 state
  const [count, setCount] = useState(0);
  
  // 指针 → Hook2，对比 deps 决定是否重跑 effect
  useEffect(() => { /* ... */ }, [count]);
  
  // 指针 → Hook3，读取 ref.current
  const ref = useRef(null);
}
```

**这就是为什么 Hooks 不能放在条件语句里**——如果 if 跳过了某个 hook，指针错位，Hook2 读到 Hook3 的数据，全乱了。

---

## useState

### API 签名

```tsx
const [state, setState] = useState<T>(initialValue: T | (() => T));

// setState 两种用法：
setState(newValue);           // 直接设值
setState(prev => newValue);   // 函数式更新（基于前一个状态）
```

**作用**：为函数组件添加可变状态，状态变化触发重渲染。

**场景**：表单输入、开关状态、计数器、任何需要 UI 响应的数据。

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

### API 签名

```tsx
useEffect(
  setup: () => (void | (() => void)),  // 副作用函数，可选返回清理函数
  deps?: any[]                          // 依赖数组
): void;
```

**作用**：在渲染后执行副作用（数据请求、订阅、DOM 操作）。

**场景**：API 请求、事件监听、定时器、WebSocket 连接、第三方库初始化。

### 基础

```tsx
useEffect(() => {
  // 副作用（订阅、请求、DOM 操作）
  const subscription = subscribe(id);

  // 清理函数（组件卸载时 或 依赖变化后下一次 effect 执行前 执行）
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

### API 签名

```tsx
const ref = useRef<T>(initialValue: T): { current: T };
```

**作用**：持有一个可变值，变化不触发重渲染，组件整个生命周期内保持同一个引用。

**场景**：DOM 引用（聚焦/滚动/测量）、定时器 ID、上一次的值、任何"需要跨渲染保持但不需要触发 UI 更新"的数据。

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

### API 签名

```tsx
const memoizedValue = useMemo<T>(factory: () => T, deps: any[]): T;
const memoizedFn = useCallback<T>(fn: T, deps: any[]): T;
// useCallback(fn, deps) === useMemo(() => fn, deps)
```

**作用**：缓存计算结果（useMemo）或函数引用（useCallback），依赖不变就返回缓存。

**场景**：
- useMemo：大数组排序/过滤、复杂对象创建、传给 memo 子组件的对象 props
- useCallback：传给 memo 子组件的回调函数、作为 useEffect 依赖的函数

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

### API 签名

```tsx
const value = useContext<T>(Context: React.Context<T>): T;
```

**作用**：读取最近的 Provider 提供的 Context 值，Provider value 变化时自动重渲染。

**场景**：主题切换、语言国际化、当前用户信息等低频变化的全局状态。

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

## useReducer

### API 签名

```tsx
const [state, dispatch] = useReducer(reducer, initialState);
```

**作用**：管理复杂的局部状态（多个相关字段 + 复杂更新逻辑）。是 useState 的加强版。

**什么时候用**：当一个组件里 useState 写了 3-4 个且它们互相关联时（如 loading + data + error）。

### 和 useState 的区别

| | useState | useReducer |
|---|---|---|
| 适合 | 简单独立值（一两个） | 多字段联动 + 复杂更新 |
| 更新方式 | `setState(newValue)` | `dispatch({ type, payload })` |
| 逻辑位置 | 散落在事件处理函数里 | 集中在 reducer 纯函数里 |
| 可测试性 | 一般 | 好（reducer 是纯函数，可单独测试） |

### 完整示例

```tsx
// 1. 定义状态和 Action 类型
interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type FetchAction<T> =
  | { type: 'START' }
  | { type: 'SUCCESS'; payload: T }
  | { type: 'ERROR'; error: string };

// 2. Reducer 纯函数（旧状态 + action → 新状态）
function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  switch (action.type) {
    case 'START':
      return { ...state, loading: true, error: null };
    case 'SUCCESS':
      return { data: action.payload, loading: false, error: null };
    case 'ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

// 3. 组件中使用
function TaskList() {
  const [state, dispatch] = useReducer(fetchReducer<Task[]>, {
    data: null, loading: false, error: null,
  });

  useEffect(() => {
    dispatch({ type: 'START' });
    fetchTasks()
      .then(data => dispatch({ type: 'SUCCESS', payload: data }))
      .catch(e => dispatch({ type: 'ERROR', error: e.message }));
  }, []);

  if (state.loading) return <Spinner />;
  if (state.error) return <Error message={state.error} />;
  return <List items={state.data} />;
}
```

### 要点

- **仍然是组件内局部状态**（不跨组件，跨组件用 Zustand）
- reducer 是纯函数：给相同输入永远返回相同输出 → 容易测试
- 和 Redux 的 reducer 语法一样，只是作用域是组件级而不是全局
- 可以和 useContext 组合成"穷人版 Redux"（详见 [状态管理实战](./state-management-patterns.md)）

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

### 常见自定义 Hook 实现

**useDebounce — 防抖值**

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// 使用：输入框搜索
function Search() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) fetchResults(debouncedQuery);
  }, [debouncedQuery]);
}
```

**usePrevious — 获取上一次的值**

```tsx
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;  // effect 在渲染后执行，所以 ref 存的是"上一次"的值
  });

  return ref.current;
}

// 使用：对比前后值
function Counter({ count }: { count: number }) {
  const prevCount = usePrevious(count);
  return <span>从 {prevCount} 变到 {count}</span>;
}
```

**useLocalStorage — 持久化状态**

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// 使用
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

**useInterval — 安全的定时器**

```tsx
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // 每次渲染更新 ref（不重启定时器）
  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (delay === null) return;  // delay 为 null 时暂停
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// 使用：不会有闭包陷阱
function Timer() {
  const [count, setCount] = useState(0);
  useInterval(() => setCount(c => c + 1), 1000);
}
```

**useAsync — 异步请求状态管理**

```tsx
function useAsync<T>(asyncFn: () => Promise<T>, deps: any[] = []) {
  const [state, setState] = useState<{
    loading: boolean;
    data: T | null;
    error: Error | null;
  }>({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null, error: null });

    asyncFn()
      .then(data => { if (!cancelled) setState({ loading: false, data, error: null }); })
      .catch(error => { if (!cancelled) setState({ loading: false, data: null, error }); });

    return () => { cancelled = true; };
  }, deps);

  return state;
}

// 使用
function UserProfile({ id }: { id: string }) {
  const { loading, data, error } = useAsync(() => fetchUser(id), [id]);
  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return <div>{data.name}</div>;
}
```

---

## Hooks 与生命周期的对应关系

| 类组件生命周期 | Hooks 等价 | 常见用途 |
|---------------|-----------|---------|
| `constructor` | `useState(initialValue)` / `useRef(initial)` | 初始化状态 |
| `componentDidMount` | `useEffect(fn, [])` | 请求数据、订阅事件、初始化第三方库 |
| `componentDidUpdate` | `useEffect(fn, [deps])` | 依赖变化时重新请求、同步外部系统 |
| `componentWillUnmount` | `useEffect` 的返回函数 | 取消订阅、清除定时器、断开连接 |
| `shouldComponentUpdate` | `React.memo` | 跳过不必要的重渲染 |
| `getDerivedStateFromProps` | 渲染期间直接计算 / `useMemo` | 从 props 派生 state |
| `getSnapshotBeforeUpdate` | `useLayoutEffect` | DOM 更新前读取布局信息 |
| `componentDidCatch` | 暂无 Hook 等价（仍需 class ErrorBoundary） | 错误边界 |

### 常用生命周期场景

```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  // ≈ componentDidMount + componentDidUpdate(userId 变化时)
  useEffect(() => {
    let cancelled = false;
    fetchUser(userId).then(data => {
      if (!cancelled) setUser(data);
    });
    // ≈ componentWillUnmount（或 userId 变化前的清理）
    return () => { cancelled = true; };
  }, [userId]);

  // ≈ componentDidMount（只执行一次）
  useEffect(() => {
    analytics.trackPageView('profile');
    const ws = new WebSocket(WS_URL);
    // ≈ componentWillUnmount
    return () => ws.close();
  }, []);

  // ≈ getSnapshotBeforeUpdate（DOM 更新后、绘制前同步执行）
  useLayoutEffect(() => {
    const height = ref.current?.getBoundingClientRect().height;
    // 在浏览器绘制前读取/修改 DOM，避免闪烁
  }, [user]);
}
```

### 关键区别

- 类组件：生命周期按**时间点**组织（mount/update/unmount 分开写）
- Hooks：按**关注点**组织（一个 useEffect 包含 mount + update + cleanup，相关逻辑放一起）

```tsx
// 类组件：WebSocket 逻辑分散在三个生命周期
componentDidMount() { this.ws = new WebSocket(url); }
componentDidUpdate(prev) { if (prev.url !== this.props.url) { this.ws.close(); this.ws = new WebSocket(url); } }
componentWillUnmount() { this.ws.close(); }

// Hooks：WebSocket 逻辑集中在一个 useEffect
useEffect(() => {
  const ws = new WebSocket(url);
  return () => ws.close();
}, [url]);  // url 变了自动 close 旧的 + 建新的
```

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
