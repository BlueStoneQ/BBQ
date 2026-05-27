# 状态管理

## 文档索引

- [状态管理原理与选型深度](./state-management-deep.md)

## 目录

- [选型思路](#选型思路)
- [Context](#context)
- [Zustand](#zustand)
- [Redux Toolkit](#redux-toolkit)
- [对比](#对比)

---

## 选型思路

| 场景 | 推荐 | 理由 |
|------|------|------|
| 主题/语言等低频全局状态 | Context | 简单，变化少不影响性能 |
| 中小型应用 | Zustand | 极简 API，selector 精准更新 |
| 大型应用/复杂异步流 | Redux Toolkit (RTK) | 中间件生态、DevTools、可预测 |
| 服务端状态（请求缓存） | TanStack Query / SWR | 专门解决请求缓存/重试/失效 |
| 表单状态 | React Hook Form / Formik | 专门解决表单验证/性能 |

**原则**：不要用一个方案解决所有问题。服务端状态用 Query，客户端状态用 Zustand/Redux，局部状态用 useState。

---

## Context

```tsx
// 1. 创建 Context（提供默认值）
const ThemeContext = createContext<'light' | 'dark'>('light');

// 2. Provider 提供值（theme 来自 useState）
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  return (
    <ThemeContext.Provider value={theme}>
      <Page />
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        切换主题
      </button>
    </ThemeContext.Provider>
  );
}

// 3. Consumer 读取值
function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

**问题**：value 变化 → 所有 consumer 重渲染（无 selector）。

**适用**：变化频率低的全局配置（主题、语言、用户信息）。

---

## Zustand

### 为什么推荐

- API 极简（3 行创建 store）
- **selector 精准更新**（只订阅用到的字段）
- 不需要 Provider 包裹
- 支持中间件（persist、devtools、immer）
- 体积小（~1KB）

### 基础用法

```tsx
import { create } from 'zustand';

interface BearStore {
  bears: number;
  increase: () => void;
  reset: () => void;
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  reset: () => set({ bears: 0 }),
}));

// 使用（自动精准订阅）
function BearCount() {
  const bears = useBearStore((state) => state.bears);  // 只有 bears 变才重渲染
  return <span>{bears}</span>;
}

function Controls() {
  const increase = useBearStore((state) => state.increase);
  return <button onClick={increase}>+</button>;
}
```

### 中间件

```tsx
import { persist, devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    persist(
      (set) => ({ /* ... */ }),
      { name: 'bear-storage' }  // localStorage key
    )
  )
);
```

---

## Redux Toolkit

### 什么时候用 RTK 而不是 Zustand

- 团队已有 Redux 经验/代码
- 需要复杂中间件（saga、thunk 链式异步）
- 需要严格的单向数据流和时间旅行调试
- 大型应用多人协作，需要强约束

### 基础用法

```tsx
// slice
import { createSlice, configureStore } from '@reduxjs/toolkit';

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1; },  // immer，可直接 mutate
    decrement: (state) => { state.value -= 1; },
  },
});

// store
const store = configureStore({
  reducer: { counter: counterSlice.reducer },
});

// 组件
function Counter() {
  const count = useSelector((state: RootState) => state.counter.value);
  const dispatch = useDispatch();
  return <button onClick={() => dispatch(increment())}>Count: {count}</button>;
}
```

---

## 对比

| | Context | Zustand | Redux Toolkit |
|--|---------|---------|---------------|
| 学习成本 | 低 | 低 | 中 |
| 精准更新 | ❌（全量重渲染） | ✅（selector） | ✅（useSelector） |
| 体积 | 0（内置） | ~1KB | ~10KB |
| DevTools | ❌ | ✅（中间件） | ✅（强） |
| 中间件 | ❌ | ✅ | ✅（丰富） |
| Provider | 需要 | 不需要 | 需要 |
| 适用规模 | 小 | 中小 | 中大 |
| 异步处理 | 自己写 | 直接在 action 里 async | thunk / saga |
