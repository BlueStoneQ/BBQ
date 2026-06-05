# React 状态管理实战（原生 + Zustand）

> 两种方式：React 原生（useState / useReducer / useContext）+ 第三方（Zustand）
> 结论：局部用原生，跨组件用 Zustand。不要混着乱来。

---

## 目录

- [全景对比：什么时候用哪个](#全景对比什么时候用哪个)
- [useState — 最简单的状态](#usestate--最简单的状态)
- [useReducer — 复杂联动状态](#usereducer--复杂联动状态)
- [useContext — 跨组件共享](#usecontext--跨组件共享)
- [组合模式：useReducer + useContext](#组合模式usereducer--usecontext)
- [Zustand — 替代 Context 的最佳实践](#zustand--替代-context-的最佳实践)
- [为什么 Zustand 优于 Context](#为什么-zustand-优于-context)
- [实际项目中的状态分层](#实际项目中的状态分层)

---

## 全景对比：什么时候用哪个

| 方案 | 作用范围 | 适合 | 不适合 |
|------|---------|------|--------|
| `useState` | 单组件内 | 简单值（开关/loading/输入） | 多字段联动 |
| `useReducer` | 单组件内 | 复杂状态（多字段 + 状态机逻辑） | 跨组件共享 |
| `useContext` | 组件树 | 低频全局配置（主题/语言/用户） | 高频变化的状态（性能差） |
| **Zustand** | 全局 | 跨组件 + 高频变化 + 精准更新 | 过于简单的局部状态（杀鸡用牛刀） |

---

## useState — 最简单的状态

```tsx
// 基础值
const [loading, setLoading] = useState(false);
const [count, setCount] = useState(0);

// 对象
const [user, setUser] = useState<User | null>(null);

// 更新对象的某个字段（不可变更新）
const [filters, setFilters] = useState({ status: '', keyword: '' });
setFilters(prev => ({ ...prev, status: 'done' }));  // 只改 status，keyword 保持

// 函数式更新（新值依赖旧值时必须用）
setCount(prev => prev + 1);
setTasks(prev => [...prev, newTask]);
```

**要点**：
- 最常用，90% 的状态用这个
- setState 是异步批量的（同一事件里多次调用取的是同一个快照）
- 新值依赖旧值 → 用函数式 `prev => ...`

---

## useReducer — 复杂联动状态

**什么时候用**：当你发现一个组件里 useState 写了 3-4 个且它们互相关联时。

```tsx
// 定义状态类型
interface FetchState {
  data: Task[] | null;
  loading: boolean;
  error: string | null;
}

// 定义 Action 类型（联合类型）
type FetchAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Task[] }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'RESET' };

// Reducer 纯函数（输入旧状态 + action → 输出新状态）
function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { data: action.payload, loading: false, error: null };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'RESET':
      return { data: null, loading: false, error: null };
  }
}

// 使用
function TaskList() {
  const [state, dispatch] = useReducer(fetchReducer, {
    data: null, loading: false, error: null,
  });

  const loadTasks = async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const tasks = await fetchTasks();
      dispatch({ type: 'FETCH_SUCCESS', payload: tasks });
    } catch (e) {
      dispatch({ type: 'FETCH_ERROR', error: e.message });
    }
  };

  return (
    <div>
      {state.loading && <Spinner />}
      {state.error && <Error message={state.error} />}
      {state.data && <List items={state.data} />}
    </div>
  );
}
```

**要点**：
- 仍然是组件内部状态（不跨组件）
- 状态转换逻辑集中在 reducer 里（可测试、可追踪）
- 类似 Redux 的 reducer，但是局部的

---

## useContext — 跨组件共享

**解决的问题**：不用一层层传 props（prop drilling），让深层子组件直接读值。

```tsx
// 1. 创建 Context
interface AuthContextValue {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 2. Provider 提供值（放在组件树顶层）
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (token: string) => {
    const userData = await fetchUser(token);
    setUser(userData);
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. 任何子组件直接读（不管嵌套多深）
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}

function ProfilePage() {
  const { user, logout } = useAuth();  // 直接读，不用层层传 props
  return <div>{user?.name} <button onClick={logout}>退出</button></div>;
}

// 4. App 顶层包裹
function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
```

**问题**：Context value 变了 → **所有 consumer 都 re-render**（没有 selector 机制）。

---

## 组合模式：useReducer + useContext

React 原生实现"全局状态管理"的方式（Zustand 出现之前的做法）：

```tsx
// 把 useReducer 的状态通过 Context 共享给整棵树
const TaskContext = createContext<{
  state: TaskState;
  dispatch: React.Dispatch<TaskAction>;
} | null>(null);

function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  return (
    <TaskContext.Provider value={{ state, dispatch }}>
      {children}
    </TaskContext.Provider>
  );
}

// 子组件
function TaskCard() {
  const { state, dispatch } = useContext(TaskContext);
  return <button onClick={() => dispatch({ type: 'COMPLETE', id: '1' })}>完成</button>;
}
```

**这就是"穷人版 Redux"**——能用，但有 Context 的性能问题（value 变了全 re-render）。

---

## Zustand — 替代 Context 的最佳实践

```tsx
// 一个 create 搞定，不需要 Provider / Context / useReducer
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,

  login: async (token) => {
    const user = await fetchUser(token);
    set({ user });
  },

  logout: () => set({ user: null }),
}));

// 使用（selector 精准订阅）
function ProfilePage() {
  const user = useAuthStore((s) => s.user);        // 只订阅 user
  const logout = useAuthStore((s) => s.logout);    // 只订阅 logout
  return <div>{user?.name} <button onClick={logout}>退出</button></div>;
}

// 不需要 Provider 包裹 ✅
function App() {
  return <Router />;  // 直接用，哪里都能读
}
```

---

## 为什么 Zustand 优于 Context

| 维度 | useContext | Zustand |
|------|-----------|---------|
| **精准更新** | ❌ value 任何字段变 → 所有 consumer re-render | ✅ selector 只订阅用到的字段 |
| **Provider 包裹** | 需要 | 不需要 |
| **代码量** | 多（Context + Provider + useReducer + 自定义 Hook） | 少（一个 create 搞定） |
| **性能** | 差（大量 consumer 时） | 好（selector 精准） |
| **适合** | 低频 + 简单（主题/语言） | 高频 + 复杂（业务状态） |

**结论**：
- 主题 / 语言这种"几乎不变"的 → useContext 够了
- 业务状态（任务/聊天/筛选/用户信息）→ Zustand

---

## 实际项目中的状态分层

```tsx
// App.tsx — 全局配置用 Context（低频，不需要 selector）
<ThemeProvider>
  <AuthProvider>
    <App />
  </AuthProvider>
</ThemeProvider>

// features/task/ — 业务状态用 Zustand
const useTaskUIStore = create(...)   // 筛选/选中/展开
const useTaskList = () => { ... }    // 数据获取用自定义 Hook

// components/TaskCard.tsx — 局部状态用 useState
const [expanded, setExpanded] = useState(false);
```

**原则**：
```
能 useState 就不 useReducer
能 useState/useReducer 就不 Zustand（别提升作用域）
需要跨组件且高频变化 → Zustand
需要跨组件但几乎不变 → useContext
```
