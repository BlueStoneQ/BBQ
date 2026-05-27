# 状态管理原理与选型

## 目录

- [解决什么问题](#解决什么问题)
- [通用原理](#通用原理)
- [Zustand 实现原理](#zustand-实现原理)
- [各方案对比](#各方案对比)
- [2026 最佳实践](#2026-最佳实践)

---

## 解决什么问题

React 自带的状态管理（useState + Context）有两个痛点：

1. **Props Drilling**：状态要层层传递，中间组件被迫接收和转发不相关的 props
2. **Context 性能**：Provider value 变了 → 所有 consumer 全量重渲染（无 selector，无法精准订阅）

第三方状态管理的核心价值：**把状态从组件树中抽出来，让任何组件直接订阅需要的字段，变了才重渲染**。

---

## 通用原理

所有第三方状态管理方案本质都是同一个模式：

```
外部 Store（独立于组件树，不依赖 Context/Provider）
  │
  ├── 状态存储（一个对象/Map，存在闭包或模块变量中）
  ├── 订阅机制（组件订阅 store 变化，store 变了通知组件）
  ├── 精准更新（selector 选择性订阅，只有用到的字段变了才重渲染）
  └── 触发更新（调用 action → 修改 state → 通知订阅者 → 组件重渲染）
```

React 18 提供了 `useSyncExternalStore` API，让外部 store 能安全地触发 React 重渲染（处理并发模式下的 tearing 问题）。

---

## Zustand 实现原理

**一句话**：闭包（存状态）+ 发布订阅（通知变化）+ selector（精准更新）。

### 核心实现（~50 行）

```typescript
import { useSyncExternalStore } from 'react';

function create<T>(createState: (set: SetState<T>, get: () => T) => T) {
  // ─── 闭包：状态存在这里（模块级单例，不在组件树中）───
  let state: T;
  const listeners = new Set<() => void>();  // 订阅者集合

  // ─── setState：修改状态 + 通知订阅者 ───
  const setState = (partial: Partial<T> | ((s: T) => Partial<T>)) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...next };       // immutable 更新
    listeners.forEach(fn => fn());       // 发布：通知所有订阅者
  };

  const getState = () => state;

  // 初始化状态
  state = createState(setState, getState);

  // ─── 返回一个 React Hook ───
  function useStore<U>(selector: (s: T) => U): U {
    return useSyncExternalStore(
      // subscribe：组件挂载时订阅，卸载时取消
      (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
      // getSnapshot：返回 selector 选中的值
      // React 内部用 Object.is 对比前后值，没变就跳过重渲染
      () => selector(state)
    );
  }

  useStore.getState = getState;
  useStore.setState = setState;
  return useStore;
}
```

### 为什么不需要 Provider

```
Context 方案：
  状态存在 Provider 的 value 中 → 必须在组件树上层包裹 Provider
  组件通过 useContext 从组件树中"向上查找"Provider 拿值

Zustand 方案：
  状态存在模块闭包中（create 函数的局部变量）→ 和组件树无关
  组件通过 useSyncExternalStore 直接订阅闭包中的 store
  不需要 Provider，因为 store 不在组件树里
```

### 精准更新的关键：selector

```tsx
// ❌ Context：theme 变了，所有 consumer 都重渲染（即使只用了 user）
const { user, theme } = useContext(AppContext);

// ✅ Zustand：只订阅 bears，其他字段变了不重渲染
const bears = useStore(s => s.bears);
// 内部：useSyncExternalStore 对比 selector(state) 的返回值
// bears 没变 → Object.is(prev, next) === true → 跳过重渲染
```

### 中间件机制

```typescript
// Zustand 中间件 = 包装 setState（装饰器模式）
const logMiddleware = (config) => (set, get, api) =>
  config(
    (...args) => {
      console.log('prev:', get());
      set(...args);                    // 调用原始 set
      console.log('next:', get());
    },
    get,
    api
  );

// 使用
const useStore = create(logMiddleware((set) => ({
  bears: 0,
  increase: () => set(s => ({ bears: s.bears + 1 })),
})));
```

常用中间件：
- `persist`：自动持久化到 localStorage
- `devtools`：接入 Redux DevTools
- `immer`：允许直接 mutate 写法

---

## 各方案对比

| 方案 | 原理 | 精准更新 | Provider | 体积 | 适用 |
|------|------|---------|----------|------|------|
| **Context** | React 内置 | ❌ 全量重渲染 | 需要 | 0 | 低频全局状态 |
| **Zustand** | 闭包 + 发布订阅 | ✅ selector | 不需要 | ~1KB | 中小型（推荐） |
| **Redux Toolkit** | 单一 Store + Reducer | ✅ useSelector | 需要 | ~10KB | 大型/复杂异步 |
| **Jotai** | 原子化（每个状态一个 atom） | ✅ 天然细粒度 | 需要（轻量） | ~3KB | 细粒度状态多 |
| **Valtio** | Proxy 自动追踪 | ✅ 自动 | 不需要 | ~3KB | 快速原型 |
| **MobX** | Observable + 自动追踪 | ✅ 自动 | 不需要 | ~15KB | 中大型 |

### 原理分类

```
手动订阅（显式 selector）：Zustand、Redux
  → 你告诉框架"我用了哪些字段"

自动追踪（Proxy/Observable）：Valtio、MobX、Jotai
  → 框架自动检测"你读了哪些字段"

各有取舍：
  手动 = 可预测、好调试、但要写 selector
  自动 = 写法简洁、但隐式依赖、调试难
```

---

## 2026 最佳实践

| 状态类型 | 推荐方案 | 理由 |
|---------|---------|------|
| **客户端 UI 状态** | Zustand | 极简、精准更新、无 Provider |
| **服务端状态（API 缓存）** | TanStack Query / SWR | 专门解决请求缓存/重试/失效/乐观更新 |
| **表单状态** | React Hook Form | 专门解决表单验证/性能（非受控模式） |
| **局部状态** | useState | 不需要共享的状态不要放全局 |
| **大型团队/复杂异步** | Redux Toolkit | 强约束、中间件生态、DevTools |

**原则**：不要用一个方案解决所有问题。按状态类型选工具，各司其职。

```tsx
// 典型项目的状态分层
function App() {
  return (
    <QueryClientProvider client={queryClient}>  {/* 服务端状态 */}
      <AppContent />                             {/* Zustand 管客户端状态，无 Provider */}
    </QueryClientProvider>
  );
}

// 组件中
function DeviceList() {
  const filter = useAppStore(s => s.filter);           // Zustand：客户端状态
  const { data } = useQuery(['devices', filter], fetchDevices);  // TanStack Query：服务端状态
  const [search, setSearch] = useState('');             // useState：局部状态
}
```
