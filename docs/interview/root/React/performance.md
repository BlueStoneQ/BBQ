# React Performance Optimization

## 目录

- [核心原理](#核心原理)
- [减少重渲染](#减少重渲染)
- [昂贵计算](#昂贵计算)
- [列表优化](#列表优化)
- [代码分割](#代码分割)
- [并发特性](#并发特性)
- [性能分析](#性能分析)

---

## 核心原理

React 性能问题 99% 归结为一件事：**不必要的重渲染**。

```
状态变化 → 组件重渲染 → 子组件也重渲染 → DOM Diff → 更新真实 DOM
```

优化思路：**减少触发渲染的范围，减少渲染时的计算量**。

---

## 减少重渲染

### 1. React.memo — 跳过 props 未变的子组件

```tsx
// 问题：父组件每次渲染，Child 都跟着渲染（即使 props 没变）
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <Child name="fixed" />  {/* count 变了，Child 也重渲染 */}
    </>
  );
}

// 解决：memo 包裹，props 不变就跳过
const Child = React.memo(({ name }: { name: string }) => {
  console.log('render');  // props 不变时不会打印
  return <div>{name}</div>;
});
```

**原理**：memo 对 props 做浅比较（Object.is），相同则跳过渲染。

**注意**：如果传了引用类型（对象/数组/函数），每次父渲染都是新引用 → memo 失效。需要配合 useMemo/useCallback。

### 2. useCallback — 稳定函数引用

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  // ❌ 每次渲染都是新函数 → 传给 memo 子组件会失效
  const handleClick = () => console.log('click');

  // ✅ 引用稳定，依赖不变就不重建
  const handleClick = useCallback(() => {
    console.log('click');
  }, []);  // 空依赖 = 永远同一个引用

  return <MemoChild onClick={handleClick} />;
}
```

**什么时候用**：传给 memo 子组件的回调函数、作为 useEffect 依赖的函数。

**什么时候不用**：不传给子组件的内部函数（加了反而多一次 hook 调用开销）。

**核心配合关系**：useCallback/useMemo 保证 props 引用稳定 + 子组件用 React.memo 包裹。**两者缺一不可**——只用 memo 但传了不稳定的 props = memo 失效；只用 useCallback 但子组件没 memo = 白缓存。

### 列表场景实践

```tsx
import { memo, useCallback, useMemo } from 'react';

// ① 列表项组件：用 memo 包裹，props 不变就跳过渲染
const TodoItem = memo(({ todo, onToggle, onDelete }: {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  console.log(`render: ${todo.id}`);  // 只有自己的 props 变了才打印
  return (
    <li>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
      />
      <span>{todo.text}</span>
      <button onClick={() => onDelete(todo.id)}>×</button>
    </li>
  );
});

// ② 父组件：用 useCallback 稳定回调，用 useMemo 稳定派生数据
function TodoList() {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  // useCallback：稳定函数引用，todos 变了函数才重建
  const handleToggle = useCallback((id: string) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ));
  }, []);  // 用函数式更新，不依赖 todos → 空依赖 → 永远同一个引用

  const handleDelete = useCallback((id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  // useMemo：稳定派生数据，filter/todos 不变就不重新计算
  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active': return todos.filter(t => !t.done);
      case 'done': return todos.filter(t => t.done);
      default: return todos;
    }
  }, [todos, filter]);

  return (
    <div>
      <FilterBar current={filter} onChange={setFilter} />
      <ul>
        {filteredTodos.map(todo => (
          // ③ 传给 memo 子组件的 props 全部是稳定引用
          <TodoItem
            key={todo.id}        // 唯一 key，Diff 正确识别
            todo={todo}          // 对象引用：只有该 todo 被修改时才变
            onToggle={handleToggle}  // useCallback 稳定
            onDelete={handleDelete}  // useCallback 稳定
          />
        ))}
      </ul>
    </div>
  );
}

// 效果：
// - 切换 filter → 只有新增/移除的项渲染，其他项跳过
// - toggle 某一项 → 只有该项重渲染，其他 999 项跳过
// - 如果没有 memo + useCallback → 任何状态变化所有项都重渲染
```

**关键点总结**：

| 做法 | 作用 |
|------|------|
| `TodoItem` 用 `memo` 包裹 | props 不变就跳过渲染 |
| `handleToggle/handleDelete` 用 `useCallback` + 空依赖 | 函数引用永远不变 |
| `useCallback` 内用函数式更新 `setTodos(prev => ...)` | 不依赖外部 todos → 依赖数组可以为空 |
| `filteredTodos` 用 `useMemo` | 避免每次渲染都重新 filter |
| `key={todo.id}` | Diff 正确识别节点，避免错误复用 |

### 3. 状态下沉 — 缩小渲染范围

```tsx
// ❌ 整个大组件因为 hover 状态重渲染
function Page() {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)}>
      <HeavyComponent />  {/* 被迫重渲染 */}
      {hover && <Tooltip />}
    </div>
  );
}

// ✅ 把 hover 状态下沉到小组件
function HoverArea() {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)}>
      {hover && <Tooltip />}
    </div>
  );
}

function Page() {
  return (
    <>
      <HeavyComponent />  {/* 不受影响 */}
      <HoverArea />
    </>
  );
}
```

### 4. children 模式 — 避免不必要的子树渲染

```tsx
// ✅ children 作为 props 传入，父组件状态变化不会导致 children 重渲染
function ScrollTracker({ children }: { children: ReactNode }) {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return <div data-scroll={scrollY}>{children}</div>;
}

// children 在外层已经创建好了，ScrollTracker 重渲染不会重建 children
<ScrollTracker>
  <HeavyContent />
</ScrollTracker>
```

---

## 昂贵计算

### useMemo — 缓存计算结果

```tsx
function Dashboard({ data }: { data: Item[] }) {
  // ❌ 每次渲染都重新计算（data 有 10000 条）
  const sorted = data.sort((a, b) => b.value - a.value);

  // ✅ 只在 data 变化时重新计算
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data]
  );

  return <List items={sorted} />;
}
```

**什么时候用**：计算量大（排序/过滤/聚合大数组）、创建复杂对象传给子组件。

**什么时候不用**：简单计算（a + b）、不传给子组件的临时变量。

---

## 列表优化

### 虚拟列表（Virtualization）

只渲染可视区域内的元素，滚动时动态替换。

**核心原理**：

```
容器（固定高度，overflow: auto）
  └── 占位层（总高度 = itemCount × itemHeight，撑出滚动条）
      └── 渲染层（只渲染可视区 + 缓冲区的几十个元素，absolute 定位）

关键计算：
  scrollTop → 当前滚动了多少
  startIndex = Math.floor(scrollTop / itemHeight)
  endIndex = startIndex + Math.ceil(containerHeight / itemHeight)
  只渲染 [startIndex, endIndex] 范围内的元素
```

**核心实现（~40 行）**：

```tsx
function VirtualList({ items, itemHeight, containerHeight }: {
  items: any[];
  itemHeight: number;
  containerHeight: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {/* 占位层：撑出真实滚动高度 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 只渲染可视区元素，absolute 定位 */}
        {visibleItems.map((item, i) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              top: (startIndex + i) * itemHeight,
              height: itemHeight,
              width: '100%',
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**超出可视区的 item 是复用还是销毁？**

React 虚拟列表是**销毁重建**（声明式模型），不是 RecyclerView 那种 DOM 池复用：

| | React 虚拟列表 | Android RecyclerView |
|--|---|---|
| 策略 | 不在 visibleItems 里 = unmount | View 回收到池子里复用 |
| 复用机制 | 通过 key + Diff 复用同 key 的 Fiber/DOM | ViewHolder 池，零创建 |
| 实际开销 | 很小（同时只有 ~20 个 DOM 节点） | 几乎零（只更新数据绑定） |
| 为什么够用 | Web DOM 创建本身很快（微秒级） | Native View 创建相对昂贵 |

**生产环境用库**：

| 库 | 特点 |
|---|------|
| `react-window` | 轻量 ~6KB，固定/可变高度 |
| `@tanstack/react-virtual` | 现代，headless，支持水平/网格/动态高度 |
| `react-virtuoso` | 开箱即用，自动测量高度 |

新项目推荐 `@tanstack/react-virtual`。

**效果**：10 万条数据，DOM 中只有 ~20 个节点（可视区 + 缓冲区）。

### key 的正确使用

```tsx
// ❌ 用 index 做 key（增删时所有元素重渲染）
items.map((item, i) => <Item key={i} data={item} />)

// ✅ 用唯一 ID 做 key（只渲染变化的元素）
items.map(item => <Item key={item.id} data={item} />)
```

---

## 代码分割

### React.lazy + Suspense

```tsx
// 路由级拆分：每个页面单独一个 chunk
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

**不需要额外构建配置**。`import()` 是 ES 标准动态导入语法，Webpack/Vite/Rollup 看到它会自动把目标模块拆成单独 chunk：

```
构建产物：
  dist/
  ├── index.js              ← 主 bundle（路由壳 + 公共代码）
  ├── Dashboard-[hash].js   ← 自动拆出的 chunk
  └── Settings-[hash].js    ← 自动拆出的 chunk

运行时：
  访问 /dashboard → 浏览器动态加载 Dashboard chunk → 渲染
  没访问 /settings → Settings chunk 不加载
```

**Vite 完全支持**，且是零配置（底层用 Rollup 做 code splitting，自动按文件名命名 chunk）。Webpack 也支持，可选用 magic comment 自定义 chunk 名：

```tsx
// Webpack：magic comment 命名（可选，方便调试/预加载）
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard'));
// Vite：不需要，自动用文件路径命名
```

**React 当前推荐的构建工具**：

| 工具 | 定位 | 说明 |
|------|------|------|
| **Vite** | 当前主流 | React 官方文档推荐，开发快（ESM 原生）、构建快（Rollup） |
| **Next.js** | 全栈框架 | React 团队推荐的"框架级"方案（SSR/RSC/路由/部署一体） |
| **Remix** | 全栈框架 | 类似 Next，侧重 Web 标准（form/loader） |
| Webpack | 老项目 | 仍然广泛使用，但新项目不再首选 |
| Turbopack | 实验性 | Vercel 开发，Webpack 继任者，Next.js 14+ 内置 |

**2026 选型建议**：
- 纯前端 SPA → **Vite**
- 需要 SSR/SEO/全栈 → **Next.js**
- 老项目迁移 → 保持 Webpack，逐步切 Vite

**效果**：首屏只加载当前路由的代码，其他页面按需加载。

---

## 并发特性

### useTransition — 低优先级更新

```tsx
function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);  // 高优先级：输入框立即响应

    startTransition(() => {
      setResults(filterHugeList(e.target.value));  // 低优先级：可中断
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : <ResultList items={results} />}
    </>
  );
}
```

**本质**：把耗时的状态更新标记为"可中断"，不阻塞用户输入。

### useDeferredValue — 延迟派生值

```tsx
function Search({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  // deferredQuery 会"滞后"于 query，让输入框保持流畅
  // 当 CPU 空闲时才更新 deferredQuery → 触发列表重渲染

  const results = useMemo(() => filterList(deferredQuery), [deferredQuery]);
  return <List items={results} />;
}
```

---

## 性能分析

### React DevTools Profiler

1. 打开 React DevTools → Profiler 面板
2. 点击录制 → 操作页面 → 停止
3. 看火焰图：灰色 = 跳过渲染，彩色 = 渲染了（颜色越深越慢）

### 关键指标

| 指标 | 含义 | 目标 |
|------|------|------|
| Render duration | 组件渲染耗时 | < 16ms（60fps） |
| Commit count | 一次交互触发几次 commit | 越少越好 |
| "Why did this render?" | 渲染原因 | 确认是否必要 |

### 常见问题排查

```
问题：列表滚动卡顿
  → Profiler 看：每次滚动所有 item 都重渲染
  → 原因：没用 memo / key 用了 index
  → 解决：memo + 唯一 key + 虚拟列表

问题：输入框打字卡顿
  → Profiler 看：每次 keystroke 触发大量子组件渲染
  → 原因：状态放太高，整棵树重渲染
  → 解决：状态下沉 / useTransition / useDeferredValue
```

---

## 总结

| 手段 | 解决什么 | 一句话 |
|------|---------|--------|
| React.memo | 子组件不必要渲染 | props 不变就跳过 |
| useCallback | 函数引用不稳定导致 memo 失效 | 稳定回调引用 |
| useMemo | 重复计算 / 引用不稳定 | 缓存计算结果 |
| 状态下沉 | 状态放太高，波及无关组件 | 缩小渲染范围 |
| 虚拟列表 | 大量 DOM 节点 | 只渲染可视区 |
| lazy + Suspense | 首屏加载太大 | 按需加载 |
| useTransition | 耗时更新阻塞交互 | 标记低优先级 |
