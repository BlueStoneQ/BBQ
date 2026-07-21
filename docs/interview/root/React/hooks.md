# React Hooks

## 目录

- [使用场景](#使用场景)
- [核心原理](#核心原理)
- [useState](#usestate)
- [useEffect](#useeffect)
- [useRef](#useref)
- [useContext](#usecontext)
- [useMemo / useCallback / React.memo](#usememo--usecallback--reactmemo)
- [自定义 Hooks](#自定义-hooks)
  - [本质](#本质)
  - [常见自定义 Hook 实现](#常见自定义-hook-实现)
    - [useDebounce](#usedebounce--防抖值)
    - [usePrevious](#useprevious--获取上一次的值)
    - [useLocalStorage](#uselocalstorage--持久化状态)
    - [useInterval](#useinterval--安全的定时器)
  - [常用生命周期场景](#常用生命周期场景)
  - [关键区别](#关键区别)
- [Hooks 规则与原理](#hooks-规则与原理)
  - [两条规则](#两条规则)
  - [为什么？](#为什么)
- [常见陷阱](#常见陷阱)
  - [1. 闭包陷阱（Stale Closure）](#1-闭包陷阱stale-closure)
  - [2. useEffect 无限循环](#2-useeffect-无限循环)
  - [3. 忘记清理](#3-忘记清理)
- [注释](#注释)
  - [综合实战：memo + useCallback + useMemo 全家桶](#注释综合例子)

---
## 使用场景

**判断标准**：这段逻辑需要用到 React 的生命周期能力（state/effect/ref），且会被复用。

| 需要封装成 Hook | 不需要（用普通函数） |
|---|---|
| 需要 useState / useEffect / useRef | 纯计算（没有副作用/状态） |
| 涉及组件生命周期（挂载/卸载/更新时做事） | 和渲染无关的工具函数 |
| 多个组件会复用同一套逻辑 | 只在一个地方用一次 |

**典型该封 Hook 的**：

| Hook | 为什么必须是 Hook |
|------|-----------------|
| useDebounce | 需要 useEffect 管 timer 生命周期 + 卸载清理 |
| useFetch | 需要 useState 存 loading/data/error + useEffect 发请求 |
| useInterval | 需要 useRef 存最新回调 + useEffect 管 setInterval 生命周期 |
| useLocalStorage | 需要 useState 同步 + useEffect 监听 storage 事件 |

**不该封 Hook 的**：`formatDate()`、`deepClone()`、`debounce(fn)` — 纯输入输出的计算，不需要 React 的任何能力。

**一句话**：需要"感知渲染周期"的逻辑 → Hook。纯输入输出 → 普通函数。

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

### useEffect和生命周期

| 类比 Class 生命周期 | useEffect 写法 |
|---|---|
| `componentDidMount` | `useEffect(() => { ... }, [])` — 空依赖，只跑一次 |
| `componentDidUpdate` | `useEffect(() => { ... }, [dep])` — dep 变了就跑 |
| `componentWillUnmount` | `useEffect(() => { return () => { cleanup } }, [])` — return 的函数 |
| 每次渲染后都跑 | `useEffect(() => { ... })` — 不写依赖数组 |

```tsx
useEffect(() => {
  // 挂载 + dep 变化时执行
  const sub = subscribe(dep)
  
  return () => {
    // 卸载时 或 dep 变化前（清理上一次）执行
    sub.unsubscribe()
  }
}, [dep])
```

---

## useRef

### 本质

**useRef = 一个跨 render 持久存在、修改不触发 re-render 的"容器"。**

```
普通变量：每次 render 重新创建 → 值丢了
useState：值持久，但改了触发 re-render
useRef：  值持久 + 改了不触发 re-render → 适合存"不影响 UI 的东西"
```

`.current` 是这个容器的"抽屉"——你往里存什么 React 都不关心，也不会因为你改了它而重新渲染。

**作用域**：组件实例级（不是全局）。每个组件实例有自己独立的 ref，组件卸载时 ref 也跟着销毁。

### 为什么不用普通变量？

```tsx
function Timer() {
  // ❌ 普通变量：每次 render 组件函数重新执行 → 变量重新声明 → 上次存的值丢了
  let intervalId = null;

  function start() {
    intervalId = setInterval(() => {}, 1000);  // 存了
  }
  function stop() {
    clearInterval(intervalId);  // 下次 render 后 intervalId 又是 null → 清不掉！
  }
}

function Timer() {
  // ✅ useRef：值存在 React 内部，不随函数重新执行而丢失
  const intervalRef = useRef<number | null>(null);

  function start() {
    intervalRef.current = setInterval(() => {}, 1000);  // 存了
  }
  function stop() {
    clearInterval(intervalRef.current!);  // 任何时候都能拿到 → 清得掉
  }
}
```

**根本原因**：函数组件 = 每次 render 重新调用整个函数体 → `let` 变量每次都重新声明。useRef 的值存在 React 内部的 fiber 节点上，跨 render 持久存在。

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
  // ref值是横跨渲染的 
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

## useMemo / useCallback / React.memo

> → [综合实战例子](#注释综合例子)

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

### 完整示例：memo + useCallback + useMemo 配合

```tsx
import { memo, useCallback, useMemo } from 'react';

// 子组件：用 memo 包裹 → props 不变就跳过 re-render
const TaskCard = memo(function TaskCard({ task, onComplete }: {
  task: Task;
  onComplete: (id: string) => void;
}) {
  return (
    <div>
      <span>{task.title}</span>
      <button onClick={() => onComplete(task.id)}>完成</button>
    </div>
  );
});

// 父组件
function TaskList({ tasks }: { tasks: Task[] }) {
  // useCallback → 函数引用稳定 → TaskCard 的 memo 才能生效
  const handleComplete = useCallback((id: string) => {
    completeTask(id);
  }, []);

  // useMemo → 计算结果缓存 → tasks 没变不重新过滤
  const pendingTasks = useMemo(
    () => tasks.filter(t => t.status === 'pending'),
    [tasks]
  );

  return (
    <div>
      {pendingTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={handleComplete}  // ← 稳定引用，memo 生效
        />
      ))}
    </div>
  );
}
```

**三者配合关系**：
```
memo(组件)      → 浅比较 props，没变就跳过 re-render
useCallback(fn) → 让传给子组件的函数引用稳定 → memo 判定"没变"
useMemo(value)  → 让传给子组件的对象/数组引用稳定 → memo 判定"没变"

缺任何一个 → memo 形同虚设：
  只有 memo 没有 useCallback → 函数每次新引用 → memo 无效
  只有 useCallback 没有 memo → 子组件不做浅比较 → 稳定引用没意义
```

---

## useContext

### 核心 API（就 3 个）

| API | 作用 |
|-----|------|
| `createContext(defaultValue)` | 创建 Context 对象 |
| `<Ctx.Provider value={...}>` | 提供值（组件） |
| `useContext(Ctx)` | 消费值（Hook） |

### 最小用法

```tsx
// 1. 创建
const ThemeContext = createContext<'light' | 'dark'>('light')

// 2. 提供
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>

// 3. 消费
function Button() {
  const theme = useContext(ThemeContext)
  return <button className={theme}>Click</button>
}
```

### 完整实践（Provider + 自定义 Hook）

```tsx
// 1. 定义类型
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

// 2. 创建（null 默认值，强制配合 Provider 使用）
const ThemeContext = createContext<ThemeContextType | null>(null)

// 3. 封装 Provider
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  // useMemo 稳定 value 引用，避免无意义重渲染
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// 4. 封装消费 Hook（加 null 检查）
function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// 5. 使用
function App() {
  return (
    <ThemeProvider>
      <Toolbar />
    </ThemeProvider>
  )
}

function Toolbar() {
  const { theme, toggleTheme } = useTheme()
  return <button onClick={toggleTheme}>当前: {theme}</button>
}
```

### 性能注意

**Context value 变化 → 所有消费者强制重渲染**（穿透 memo）。

```tsx
// ❌ 所有字段合一个 Context，任何变化全量通知
<AppContext.Provider value={{ user, theme, settings }}>

// ✅ 按变化频率拆分
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
```

**渲染范围**：只有直接 `useContext` 的组件会被强制更新，中间没消费的组件会被跳过。

**大型应用用 Zustand/Redux**，不用 Context — 它们有 selector 机制，只在选中字段变化时重渲染。

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

#### useDebounce — 防抖值

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// 场景1：搜索框 — 值防抖，停止输入 300ms 后才请求
function Search() {
  const [keyword, setKeyword] = useState('')
  // 其实就是最新的值, 在300ms后才更新到state上, 在fetch的时候 使用, 避免因为 debouncedKeyword 不稳定, 造成频繁 fetch
  const debouncedKeyword = useDebounce(keyword, 300)

  useEffect(() => {
    if (debouncedKeyword) fetchResults(debouncedKeyword)
  }, [debouncedKeyword])

  return <input value={keyword} onChange={e => setKeyword(e.target.value)} />
}

// 场景2：表单提交 — loading 锁，第一次生效后锁住
function Form() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (loading) return
    setLoading(true)
    try { await submitForm(data) }
    finally { setLoading(false) }
  }

  return <button disabled={loading} onClick={handleSubmit}>提交</button>
}
```

#### usePrevious — 获取上一次的值

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

#### useLocalStorage — 持久化状态

```tsx
// 这个 hook 返回了 [value, setValue]，外部调用 setValue('dark') → state 变了 → 重渲染 → useEffect 检测到 value 变 → 写入 storage
function useLocalStorage<T>(key: string, initialValue: T) {
  // useLocalStorage 执行的时候, 会从storage中取值作为本次值
  // useState 的初始化函数只在首次 mount 时执行一次（懒初始化），后续 re-render 不会再执行。
  const [value, setValue] = useState<T>(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : initialValue;
  });

  // 如果key 和 value 有变化, 则会重新 同步存储到 storage中 
  // useEffect本质上 是一个任务注册器, 把这里的回调 和 deps 之间建立依赖
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// 使用
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

#### useInterval — 安全的定时器

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

**数据请求放在什么时机？**

放在 `componentDidMount`（对应 `useEffect(..., [])`），依赖变化时也会重新请求（对应 `componentDidUpdate`）。

为什么不放 render 之前（`componentWillMount`）？
- 请求是异步的，放 render 前也不可能等到结果再渲染，没有意义
- `componentWillMount` 在 React 17 已废弃，Concurrent Mode 下可能被多次调用，导致重复请求
- 放 `didMount` 保证 DOM 已挂载，可以安全 setState 更新 UI

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


---

# 注释

<a id="注释综合例子"></a>
### 综合实战：memo + useCallback + useMemo + useMemo 全家桶

场景：商品列表页，父组件管理筛选条件，子组件展示商品卡片。

```tsx
import { memo, useState, useCallback, useMemo } from 'react'

// ─── 子组件：memo 包裹 ───
interface ProductProps {
  product: Product
  onAddToCart: (id: string) => void
}

const ProductCard = memo(({ product, onAddToCart }: ProductProps) => {
  console.log('ProductCard render:', product.id) // 观察是否跳过
  return (
    <div>
      <h3>{product.name} - ¥{product.price}</h3>
      <button onClick={() => onAddToCart(product.id)}>加购</button>
    </div>
  )
})

// ─── 父组件 ───
function ProductList({ products }: { products: Product[] }) {
  const [keyword, setKeyword] = useState('')
  const [cart, setCart] = useState<string[]>([])

  // ✅ useMemo：过滤是 O(n) 计算，keyword/products 不变不重算
  const filtered = useMemo(
    () => products.filter(p => p.name.includes(keyword)),
    [products, keyword]
  )

  // ✅ useCallback：函数引用稳定 → ProductCard 的 memo 才能生效
  const handleAddToCart = useCallback((id: string) => {
    setCart(prev => [...prev, id])
  }, [])

  return (
    <div>
      <input value={keyword} onChange={e => setKeyword(e.target.value)} />
      <p>购物车: {cart.length} 件</p>
      {filtered.map(p => (
        <ProductCard
          key={p.id}
          product={p}               // ← 对象引用来自 useMemo，稳定
          onAddToCart={handleAddToCart} // ← 函数引用来自 useCallback，稳定
        />
      ))}
    </div>
  )
}
```

**为什么三者缺一不可**：

| 缺少 | 后果 |
|------|------|
| 没有 `memo` | 父组件每次 setState → 子组件无条件重渲染，useCallback/useMemo 白做 |
| 没有 `useCallback` | `handleAddToCart` 每次新引用 → memo 浅比较 props 发现变了 → 子组件重渲染 |
| 没有 `useMemo` | `filtered` 每次新数组引用 → 里面的 product 对象也是新的 → memo 无效 |

**一句话**：`memo` 是门卫，`useCallback/useMemo` 是保证你拿的是同一张通行证。
