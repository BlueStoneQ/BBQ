# 状态管理

## 文档索引

- [状态管理原理与选型深度](./state-management-deep.md)

## 目录

- [选型思路](#选型思路)
- [Context](#context)
- [Zustand](#zustand)
  - [为什么推荐](#为什么推荐)
  - [基础用法](#基础用法)
  - [中间件](#中间件)
  - [Selector 坑点：引用类型导致重复渲染](#selector-坑点引用类型导致重复渲染)
- [Redux Toolkit](#redux-toolkit)
  - [什么时候用 RTK 而不是 Zustand](#什么时候用-rtk-而不是-zustand)
  - [基础用法](#基础用法-1)
- [对比](#对比)
- [Q&A：为什么选 Zustand 而不是 MobX / Redux？](#qa为什么选-zustand-而不是-mobx--redux)
  - [完整选型理由](#完整选型理由)
  - [Zustand vs MobX 核心差异](#zustand-vs-mobx-核心差异)
  - [MobX 什么场景更合适？](#mobx-什么场景更合适)
  - [Redux 的问题](#redux-的问题)
  - [useSyncExternalStore 是什么](#usesyncexternalstore-是什么)
  - [面试话术](#面试话术)

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

### Selector 坑点：引用类型导致重复渲染

Zustand 默认用 `Object.is` 浅比较 selector 返回值来决定是否 re-render：

```
上次 selector 结果 === 这次结果？
  是 → 不 re-render
  否 → re-render
```

**原始值没坑**：
```tsx
// ✅ number/string/boolean → Object.is(1, 1) = true → 不会重复渲染
const bears = useBearStore((s) => s.bears);
```

**引用类型有坑**：
```tsx
// ❌ 每次返回新对象 → Object.is({}, {}) = false → 每次都 re-render
const stats = useBearStore((s) => ({ count: s.bears, name: s.name }));

// ❌ filter/map 每次返回新数组 → 每次都 re-render
const activeDevices = useBearStore((s) => s.devices.filter(d => d.active));
```

**解法**：

```tsx
// 方案 1：拆成多个 selector（各取原始值，最推荐）
const count = useBearStore((s) => s.bears);
const name = useBearStore((s) => s.name);

// 方案 2：用 useShallow（zustand 内置，逐字段浅比较）
import { useShallow } from 'zustand/react/shallow';

const stats = useBearStore(useShallow((s) => ({ count: s.bears, name: s.name })));

// 方案 3：转成原始值做稳定化
const activeIds = useBearStore((s) =>
  s.devices.filter(d => d.active).map(d => d.id).join(',')
);
```

**一句话**：selector 返回原始值没坑，返回新对象/新数组就会重复渲染。用拆 selector 或 `useShallow` 解决。

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

---

## Q&A：为什么选 Zustand 而不是 MobX / Redux？

### 完整选型理由

1. **范式契合** — Zustand 是纯 hooks + 函数式，和 React 函数组件的方向一致。MobX 是 OOP 响应式（class + Proxy + observer 装饰器），和 React 方向拧着。Redux 是 Flux 仪式（action → reducer），概念重
2. **React 官方集成** — Zustand 底层用 `useSyncExternalStore`（React 18 官方 hook），天然兼容 Concurrent Mode，不存在 tearing 问题。MobX 自己实现订阅机制（forceUpdate hack），需要额外适配
3. **轻量 / 降低复杂度** — 2KB 包体，API 就 create/set/get。不引入 action/reducer/middleware/saga 这些额外概念，避免架构本身成为负担。Redux 改一个值需要 action type + action creator + reducer + dispatch，Zustand 只要 `set({ count: 1 })`
4. **多实例友好** — 无 Provider，每个 `create()` 返回独立 store，天然适配 RN 多 ReactInstance 架构。MobX class 单例在多实例下需要手动隔离
5. **TS 体验** — 类型自然推导，不需要像 Redux 那样手动声明 RootState/AppDispatch，也不像 MobX 那样 decorator + Proxy 导致类型推断弱

### Zustand vs MobX 核心差异

| | Zustand | MobX |
|---|---|---|
| 范式 | 函数式 hooks | OOP 响应式（class + Proxy） |
| 更新机制 | 手动 selector（显式声明依赖） | Proxy 自动追踪（隐式依赖） |
| React 集成 | `useSyncExternalStore`（官方 hook） | 自实现订阅 + `observer()` 包裹 |
| 调试 | 显式 selector → 依赖关系一目了然 | 隐式追踪 → 不看运行时日志不知道订阅了啥 |
| 异步 | 直接 async/await | 必须 `runInAction` 包裹异步后的赋值 |
| 常见坑 | selector 返回新引用需注意 | observer 忘包 → 不更新；解构丢响应性 |

### MobX 什么场景更合适？

大量组件各自订阅不同字段 + 高频更新（如股票行情），MobX 的自动依赖追踪确实省心，不用手写 selector 也能做到最细粒度更新。

### Redux 的问题

Redux 被诟病多年的核心问题：**把简单事情仪式化**。为了"可预测性"，每次状态变更都要走 action → reducer 完整链路。对中小项目来说就是纯负担——架构本身的复杂度超过了业务复杂度。RTK 简化了 boilerplate，但心智模型没变。

Redux 仍然适合的场景：10人+ 大团队需要严格状态审计 + 复杂异步流（saga）+ 需要时间旅行调试。

### `useSyncExternalStore` 是什么

React 18 提供的官方 hook，专门用于"外部 store 接入 React"：

```typescript
// Zustand 内部简化实现
import { useSyncExternalStore } from 'react';

function useStore(selector) {
  return useSyncExternalStore(
    store.subscribe,                      // 订阅变化
    () => selector(store.getState()),     // 获取当前值
  );
}
```

它解决 Concurrent Mode 下的 **tearing 问题**（同一次渲染中不同组件读到不同版本的 state）。Zustand 用了它 = 和 React 的契约是最正式的，未来 React 内部演进不会断。

### 面试话术

> "选 Zustand 首先是范式契合——纯 hooks + 函数式，底层用 React 18 的 `useSyncExternalStore` 天然兼容 Concurrent Mode。其次是轻量降低复杂度，避免 Redux 的 action/reducer 仪式或 MobX 的 Proxy 魔法带来额外心智负担。再加上无 Provider、TS 类型自然推导、多实例天然隔离，是目前 React 新项目社区首选方案。
>
> 当然，如果是大量组件高频独立订阅的场景（股票行情），MobX 的自动追踪更省心；如果是大团队需要严格状态审计 + 复杂异步流，Redux 的仪式感反而是约束力。选型要看场景。"
