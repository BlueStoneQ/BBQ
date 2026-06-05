# React 经典问题

## 目录

- [重复渲染](#重复渲染)
- [重复请求](#重复请求)
- [闭包陷阱](#闭包陷阱)
- [useEffect 无限循环](#useeffect-无限循环)
- [状态更新不生效](#状态更新不生效)
- [Context 性能问题](#context-性能问题)

---

## 重复渲染

### 问题

父组件 setState → 所有子组件跟着重渲染（即使 props 没变）。

### 原因

React 默认行为：父组件渲染 → 子组件无条件渲染。不会自动对比 props。

### 解法

| 手段 | 做法 |
|------|------|
| `React.memo` | 包裹子组件，props 不变就跳过 |
| `useCallback` | 稳定传给子组件的函数引用 |
| `useMemo` | 稳定传给子组件的对象/数组引用 |
| 状态下沉 | 把频繁变化的状态移到更小的组件里 |
| Zustand selector | 只订阅用到的字段，其他字段变了不重渲染 |

**Zustand selector 示例**：

```tsx
// Store 有很多字段
const useStore = create((set) => ({
  user: { name: 'Tom', avatar: '...' },
  theme: 'dark',
  notifications: [],
  setTheme: (t) => set({ theme: t }),
}));

// ❌ 订阅整个 store：任何字段变了，这个组件都重渲染
function Header() {
  const store = useStore();  // theme 变了 → 重渲染，notifications 变了 → 也重渲染
  return <span>{store.user.name}</span>;
}

// ✅ selector 只取 user.name：只有 name 变了才重渲染
function Header() {
  const name = useStore((state) => state.user.name);  // notifications/theme 变了 → 不重渲染
  return <span>{name}</span>;
}

// ✅ 多个字段用 shallow 比较
import { shallow } from 'zustand/shallow';

function Profile() {
  const { name, avatar } = useStore(
    (state) => ({ name: state.user.name, avatar: state.user.avatar }),
    shallow  // 浅比较对象字段，避免每次返回新对象引用导致重渲染
  );
  return <img src={avatar} alt={name} />;
}
```

**原理**：Zustand 内部对每个 selector 的返回值做 `Object.is` 比较（或 shallow 比较），值没变就不触发组件重渲染。这比 Context 精准得多——Context 是 value 引用变了所有消费者都重渲染。

```tsx
// ❌ 每次 Parent 渲染，Child 都跟着渲染
function Parent() {
  const [count, setCount] = useState(0);
  return <Child onClick={() => console.log('click')} />;  // 每次新函数
}

// ✅ memo + useCallback
const Child = memo(({ onClick }) => <button onClick={onClick}>Click</button>);

function Parent() {
  const [count, setCount] = useState(0);
  const handleClick = useCallback(() => console.log('click'), []);
  return <Child onClick={handleClick} />;  // 引用稳定，Child 不重渲染
}
```

### 排查工具

- React DevTools Profiler → 看哪些组件渲染了、为什么渲染
- `React.memo` 的第二个参数可以自定义对比逻辑

---

## 重复请求

### 问题

同一个接口被调用多次（页面加载时发了 2~3 次相同请求）。

### 原因 & 解法

| 原因 | 场景 | 解法 |
|------|------|------|
| **useEffect 依赖不稳定** | deps 是对象字面量，每次渲染都是新引用 → effect 重跑 | useMemo 稳定依赖 |
| **StrictMode 双调用** | 开发模式下 React 故意调两次 useEffect | 正常行为，生产环境不会 |
| **组件重复挂载** | 路由切换回来重新 mount → 重新请求 | TanStack Query 缓存 |
| **父组件重渲染导致子组件重新 mount** | key 变了 → 组件销毁重建 → useEffect 重跑 | 稳定 key |
| **用户快速操作** | 连续点击/快速切换 Tab | 防抖 + loading 禁用 + 请求取消 |

```tsx
// ❌ 依赖不稳定 → 无限请求
useEffect(() => {
  fetchData(options);
}, [options]);  // options = {} 字面量，每次渲染都是新引用

// ✅ useMemo 稳定依赖
const options = useMemo(() => ({ page, size }), [page, size]);
useEffect(() => {
  fetchData(options);
}, [options]);

// ✅✅ 最佳方案：用 TanStack Query（自带去重 + 缓存）
function UserList() {
  const { data } = useQuery({
    queryKey: ['users', page, size],  // 相同 key 不重复请求
    queryFn: () => fetchUsers(page, size),
    staleTime: 30_000,  // 30s 内不重新请求
  });
}
```

### 请求取消（防止竞态）

```tsx
useEffect(() => {
  const controller = new AbortController();
  
  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') throw err;  // 忽略取消错误
    });

  // 组件卸载或依赖变化时取消上一次请求
  return () => controller.abort();
}, [id]);
```

---

## 闭包陷阱

### 问题

事件处理函数或定时器中拿到的是**过期的 state 值**。

### 原因

函数组件每次渲染创建新的闭包，闭包捕获的是**当次渲染时的 state 快照**。

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    // ❌ 3 次都基于同一个快照 count=0，结果是 1 不是 3
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
  }

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count);  // ❌ 永远是 0（闭包锁死初始值）
    }, 1000);
    return () => clearInterval(id);
  }, []);  // 空依赖 = 闭包只捕获初始 count
}
```

### 解法

| 方案 | 做法 |
|------|------|
| **函数式更新** | `setCount(c => c + 1)`（基于最新值，不依赖闭包） |
| **useRef** | `countRef.current = count`（ref 永远指向最新值） |
| **正确的依赖** | useEffect deps 加上 count（但可能导致重新创建定时器） |

```tsx
// ✅ 函数式更新
setCount(c => c + 1);  // 每次基于最新值

// ✅ useRef 持有最新值
const countRef = useRef(count);
countRef.current = count;  // 每次渲染更新 ref

useEffect(() => {
  const id = setInterval(() => {
    console.log(countRef.current);  // 永远是最新值
  }, 1000);
  return () => clearInterval(id);
}, []);
```

---

## useEffect 无限循环

### 问题

组件不停重渲染，控制台疯狂打印。

### 原因

useEffect 内 setState → 触发重渲染 → useEffect 重跑 → 又 setState → 循环。

```tsx
// ❌ 无限循环
useEffect(() => {
  setData(transform(rawData));  // setState → 重渲染 → effect 重跑 → setState...
});  // 没有依赖数组 = 每次渲染都跑

// ❌ 依赖是对象字面量
useEffect(() => {
  fetchData({ page, size });
}, [{ page, size }]);  // 每次都是新对象 → 依赖永远"变了" → 无限循环
```

### 解法

| 原因 | 解法 |
|------|------|
| 没写依赖数组 | 加上 `[]` 或正确的 deps |
| 依赖是对象字面量 | useMemo 包裹，或拆成基本类型 deps |
| effect 内 setState 的值每次都不同 | 加条件判断（值没变就不 set） |

```tsx
// ✅ 拆成基本类型依赖
useEffect(() => {
  fetchData({ page, size });
}, [page, size]);  // 基本类型，Object.is 能正确对比

// ✅ 条件判断
useEffect(() => {
  const newData = transform(rawData);
  if (!isEqual(newData, data)) {
    setData(newData);  // 只在真正变了时才 set
  }
}, [rawData]);
```

---

## 状态更新不生效

### 问题

调了 setState 但 UI 没更新。

### 原因 & 解法

| 原因 | 示例 | 解法 |
|------|------|------|
| **直接 mutate 对象** | `state.list.push(item); setState(state)` | 返回新引用：`setState({...state, list: [...state.list, item]})` |
| **同一个引用** | `const arr = state.arr; arr.push(x); setState({arr})` | 同上，必须新数组/新对象 |
| **异步中读旧值** | setTimeout 中用 state | 用 ref 或函数式更新 |
| **批量更新合并** | 连续 setState 只生效最后一次 | 用函数式更新 `setState(prev => ...)` |

```tsx
// ❌ 直接 mutate → React 认为引用没变 → 不重渲染
const handleAdd = () => {
  todos.push(newTodo);
  setTodos(todos);  // 同一个数组引用，Object.is 判断没变
};

// ✅ 返回新引用
const handleAdd = () => {
  setTodos([...todos, newTodo]);  // 新数组，触发重渲染
};
```

---

## Context 性能问题

### 问题

Context value 变了 → 所有 consumer 全量重渲染（即使只用了其中一个字段, 强制渲染）。

### 原因

Context 没有 selector 机制，`useContext` 只要 value 引用变了就重渲染。

```tsx
// ❌ 任何字段变了，所有 consumer 都重渲染
const AppContext = createContext({ user, theme, settings, notifications });

// 组件只用了 theme，但 notifications 变了也会重渲染
function Button() {
  const { theme } = useContext(AppContext);  // notifications 变了我也重渲染
}
```

### 解法

| 方案 | 做法 |
|------|------|
| **拆分 Context** | 按变化频率拆成多个 Context（ThemeContext / UserContext / NotificationContext） |
| **memo 子组件** | Consumer 组件用 memo 包裹（但 useContext 会穿透 memo） |
| **换 Zustand** | 有 selector，只订阅用到的字段 |

```tsx
// ✅ 拆分 Context
<ThemeContext.Provider value={theme}>
  <NotificationContext.Provider value={notifications}>
    <App />
  </NotificationContext.Provider>
</ThemeContext.Provider>

// ✅✅ 用 Zustand 替代（最推荐）
const theme = useAppStore(s => s.theme);  // 只有 theme 变了才重渲染
```
