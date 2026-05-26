# React 18/19 新特性

## 目录

- [React 18](#react-18)
- [React 19](#react-19)

---

## React 18

### 自动批量更新（Automatic Batching）

```tsx
// React 17：只有事件处理函数内批量
// React 18：所有场景都自动批量（setTimeout、Promise、原生事件）

setTimeout(() => {
  setCount(1);
  setFlag(true);
  // React 17：两次渲染
  // React 18：一次渲染（自动批量）
}, 0);

// 如果需要强制同步更新：
import { flushSync } from 'react-dom';
flushSync(() => setCount(1));  // 立即渲染
flushSync(() => setFlag(true));  // 再渲染一次
```

### Concurrent 渲染

React 18 引入并发渲染能力（opt-in），核心 API：

| API | 作用 |
|-----|------|
| `createRoot` | 启用并发模式（替代 `ReactDOM.render`） |
| `useTransition` | 标记低优先级状态更新 |
| `useDeferredValue` | 延迟派生值更新 |
| `Suspense` + streaming SSR | 服务端流式渲染 |

### useId

```tsx
// 生成稳定的唯一 ID（SSR/CSR 一致）
function Input() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Name</label>
      <input id={id} />
    </>
  );
}
```

### Suspense 增强

```tsx
// React 18：Suspense 支持任意异步操作（不只是 lazy）
<Suspense fallback={<Skeleton />}>
  <AsyncComponent />  {/* 内部 throw Promise → 显示 fallback */}
</Suspense>
```

---

## React 19

### use() Hook

```tsx
// 在组件内直接 await Promise（替代 useEffect + useState 模式）
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);  // 自动 suspend 直到 resolve
  return <div>{user.name}</div>;
}

// 也可以读 Context
function Button() {
  const theme = use(ThemeContext);  // 等价于 useContext，但可以在条件语句中用
}
```

### Server Components

```
服务端组件（默认）：
  - 在服务端渲染，不发送 JS 到客户端
  - 可以直接访问数据库/文件系统
  - 不能用 useState/useEffect（无交互）

客户端组件（'use client'）：
  - 传统 React 组件，有交互能力
  - 打包到客户端 JS bundle
```

```tsx
// 服务端组件（默认）
async function UserList() {
  const users = await db.query('SELECT * FROM users');  // 直接查数据库
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// 客户端组件
'use client';
function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(true)}>❤️</button>;
}
```

### Actions（表单处理）

```tsx
// useActionState（替代手动管理 loading/error）
function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      const result = await login(formData.get('email'), formData.get('password'));
      if (result.error) return { error: result.error };
      redirect('/dashboard');
    },
    { error: null }
  );

  return (
    <form action={formAction}>
      <input name="email" />
      <input name="password" type="password" />
      {state.error && <p>{state.error}</p>}
      <button disabled={isPending}>
        {isPending ? 'Loading...' : 'Login'}
      </button>
    </form>
  );
}
```

### useOptimistic

```tsx
// 乐观更新：立即显示预期结果，失败再回滚
function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );

  async function addTodo(formData: FormData) {
    const newTodo = { id: Date.now(), text: formData.get('text') };
    addOptimistic(newTodo);  // 立即显示
    await saveTodo(newTodo);  // 实际保存（失败会自动回滚）
  }

  return (
    <form action={addTodo}>
      <input name="text" />
      <ul>{optimisticTodos.map(t => <li key={t.id}>{t.text}</li>)}</ul>
    </form>
  );
}
```

### React Compiler（实验性）

自动在编译时插入 memo/useMemo/useCallback，开发者不再需要手动优化：

```tsx
// 你写的代码（无任何优化）
function Component({ items }) {
  const sorted = items.sort((a, b) => a - b);
  return <List data={sorted} />;
}

// React Compiler 自动转换为（等价于手动 useMemo）
function Component({ items }) {
  const sorted = useMemo(() => items.sort((a, b) => a - b), [items]);
  return <List data={sorted} />;
}
```

---

## 总结

| 版本 | 核心主题 | 关键特性 |
|------|---------|---------|
| React 18 | 并发渲染 | 自动批量、useTransition、Suspense 增强、useId |
| React 19 | 服务端优先 + DX 提升 | use()、Server Components、Actions、useOptimistic、Compiler |
