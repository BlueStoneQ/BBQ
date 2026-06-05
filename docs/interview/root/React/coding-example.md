# React 编码实战范式（AI Coding 速查）

> 一个完整的功能模块长什么样：页面 + 组件 + TSX + 请求 + 状态管理 + 列表优化
>
> 场景：任务列表（获取数据 + 筛选 + 完成操作 + 列表渲染优化）

---

## 编码 / 重构关注点清单

写代码或审代码时脑子里过这些：

| # | 关注点 | 检查 |
|---|--------|------|
| 1 | **分层** | 逻辑在 Hook 里？组件只管渲染？API 是纯函数？ |
| 2 | **类型安全** | Props 有 interface？函数有返回类型？不用 any？ |
| 3 | **状态归属** | 这个状态该 useState / Zustand / Query？放对层了吗？ |
| 4 | **渲染性能** | 列表 item 用 memo？selector 取具体字段？key 用 id？ |
| 5 | **副作用清理** | useEffect return 了 cleanup？定时器/订阅取消了？ |
| 6 | **错误处理** | 请求有 try-catch？UI 有 error 状态？有兜底 fallback？ |
| 7 | **依赖数组** | useEffect / useCallback / useMemo 的 deps 写对了？ |
| 8 | **命名** | 组件 PascalCase？Hook 用 use 前缀？文件名和导出一致？ |
| 9 | **可复用** | 这段逻辑写了两遍？应该抽 Hook 或组件？ |
| 10 | **用户体验** | 有 loading 态？有空状态？有 error 重试？按钮有反馈？ |

---

## 目录

- [文件结构](#文件结构)
- [1. 类型定义（types.ts）](#1-类型定义typests)
- [2. API 层（services/task-api.ts）](#2-api-层servicestask-apits)
- [3. 状态管理](#3-状态管理)
  - [React 原生：useState + useReducer](#react-原生usestate--usereducer)
  - [Zustand：跨组件共享状态](#zustandstore)
- [4. 自定义 Hook（hooks/useTaskList.ts）](#4-自定义-hookhooksusetasklistts)
- [5. 组件（components/TaskCard.tsx）](#5-组件componentstaskcardtsx)
- [6. 页面（pages/TaskListPage.tsx）](#6-页面pagestasklistpagetsx)
- [7. 列表性能优化](#7-列表性能优化)
- [8. 组件封装原则速查](#8-组件封装原则速查)
- [9. TSX 常用模式速查](#9-tsx-常用模式速查)

---

## 文件结构

```
src/features/task/
├── types.ts                # 类型定义
├── services/
│   └── task-api.ts         # API 请求（纯函数，不依赖 React）
├── stores/
│   └── task-store.ts       # Zustand store（UI 状态）
├── hooks/
│   └── useTaskList.ts      # 数据获取 + 业务逻辑
├── components/
│   ├── TaskCard.tsx         # 任务卡片（纯展示组件）
│   └── TaskFilters.tsx     # 筛选栏
└── pages/
    └── TaskListPage.tsx    # 页面（组合层）
```

---

## 1. 类型定义（types.ts）

```typescript
// types.ts — 该模块的所有类型集中定义

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string;
  createdAt: string;
  reward: number;  // 数字资产奖励
}

export interface TaskFilters {
  status?: TaskStatus;
  keyword?: string;
}
```

---

## 2. API 层（services/task-api.ts）

```typescript
// services/task-api.ts — 纯函数，不依赖 React，可独立测试

import type { Task, TaskFilters } from '../types';

const API_BASE = '/api/v1';

export async function fetchTasks(filters?: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.keyword) params.set('keyword', filters.keyword);

  // fetch 默认是 GET，参数拼在 URL query string 里
  const res = await fetch(`${API_BASE}/tasks?${params}`);
  // res.ok = HTTP 状态码 200-299 时为 true
  // 注意：fetch 对 404/500 不会 reject（只有网络错误才 reject），必须手动检查
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();  // 解析 response body 为 JSON
}

export async function completeTask(taskId: string): Promise<Task> {
  // POST 请求需要指定 method
  const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**要点**：
- API 层是纯函数（输入 → 输出），不用 hooks，不依赖 React
- 可以被 Hook / 测试 / 其他模块直接调用
- 只负责"检测错误 + 抛出"，不负责"怎么处理错误"（处理交给调用方 Hook）

---

## 3. 状态管理

### React 原生：useState + useReducer

**局部状态用 useState**（组件内部、不需要跨组件共享）：

```typescript
// 简单状态
const [loading, setLoading] = useState(false);
const [expanded, setExpanded] = useState(false);

// 对象状态
const [filters, setFilters] = useState<TaskFilters>({ status: undefined, keyword: '' });

// 更新对象中的某个字段
setFilters(prev => ({ ...prev, status: 'completed' }));
```

**复杂局部状态用 useReducer**（多个相关状态 + 复杂更新逻辑，仍然是组件内部状态，不跨组件共享）：

```typescript
// 当 useState 太多且互相关联时 → useReducer
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Task[] }
  | { type: 'FETCH_ERROR'; error: string };

interface State {
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

function taskReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, tasks: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

// 使用
const [state, dispatch] = useReducer(taskReducer, { tasks: [], loading: false, error: null });
dispatch({ type: 'FETCH_START' });
```

### Zustand（store）

**跨组件共享的客户端状态用 Zustand**：

```typescript
// stores/task-store.ts
import { create } from 'zustand';
import type { TaskFilters } from '../types';

interface TaskUIStore {
  // 状态
  filters: TaskFilters;
  selectedTaskId: string | null;

  // 操作
  setFilters: (filters: Partial<TaskFilters>) => void;
  selectTask: (id: string | null) => void;
  resetFilters: () => void;
}

export const useTaskUIStore = create<TaskUIStore>((set) => ({
  filters: {},
  selectedTaskId: null,

  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  selectTask: (id) => set({ selectedTaskId: id }),

  resetFilters: () => set({ filters: {}, selectedTaskId: null }),
}));
```

**使用时用 selector 精准订阅**：

```tsx
// ✅ 只订阅 filters，filters 没变这个组件不 re-render
const filters = useTaskUIStore((s) => s.filters);        // ← 这个箭头函数就是 selector
const setFilters = useTaskUIStore((s) => s.setFilters);  // ← selector：只取 setFilters

// ❌ 不要这样（取整个 store，任何字段变都 re-render）
const store = useTaskUIStore();  // ← 没有 selector = 订阅所有字段
```

### 什么时候用哪个？

| 场景 | 方案 | 例子 |
|------|------|------|
| 组件内部的 UI 状态 | `useState` | 展开/折叠、loading、表单输入 |
| 组件内复杂关联状态 | `useReducer` | 请求状态机（loading + error + data） |
| 跨组件共享的客户端状态 | `Zustand` | 筛选条件、选中项、用户偏好 |
| 服务端数据（需要缓存/刷新） | `TanStack Query` 或手写 Hook | 任务列表、用户信息 |

---

## 4. 自定义 Hook（hooks/useTaskList.ts）

```typescript
// hooks/useTaskList.ts — 封装"获取任务列表"的完整逻辑

import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, completeTask } from '../services/task-api';
import { useTaskUIStore } from '../stores/task-store';
import type { Task } from '../types';

export function useTaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从 Zustand 读取筛选条件（跨组件共享）
  const filters = useTaskUIStore((s) => s.filters);

  // 获取任务列表
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTasks(filters);
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // filters 变了自动重新请求
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 完成任务（乐观更新）
  const handleComplete = useCallback(async (taskId: string) => {
    // 乐观更新：先改 UI，再发请求
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' as const } : t))
    );
    try {
      await completeTask(taskId);
    } catch {
      // 失败回滚
      loadTasks();
    }
  }, [loadTasks]);

  return { tasks, loading, error, refresh: loadTasks, complete: handleComplete };
}
```

**要点**：
- Hook 封装了数据获取 + 错误处理 + 乐观更新
- 组件不关心请求细节，只用返回值
- `useCallback` 包 loadTasks → 防止 useEffect 无限循环

---

## 5. 组件（components/TaskCard.tsx）

```tsx
// components/TaskCard.tsx — 纯展示组件

import { memo, useCallback } from 'react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onPress?: (id: string) => void;
}

// memo 包裹 → task 引用没变就不 re-render（列表优化关键）
export const TaskCard = memo(function TaskCard({ task, onComplete, onPress }: TaskCardProps) {

  const handleComplete = useCallback(() => {
    onComplete(task.id);
  }, [task.id, onComplete]);

  const handlePress = useCallback(() => {
    onPress?.(task.id);
  }, [task.id, onPress]);

  return (
    <div onClick={handlePress} className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>
      <p className="text-sm text-gray-500 mt-1">{task.description}</p>
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-gray-400">{task.assignee}</span>
        {task.status !== 'completed' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleComplete(); }}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
          >
            完成 (+{task.reward}币)
          </button>
        )}
      </div>
    </div>
  );
});

// 子组件：状态徽章
function StatusBadge({ status }: { status: Task['status'] }) {
  const colors = {
    pending: 'bg-gray-200 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };
  const labels = { pending: '待接取', in_progress: '进行中', completed: '已完成' };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
```

**要点**：
- `memo` 包裹 → props 不变则不 re-render（列表场景关键优化）
- Props 用 interface 严格定义
- 事件处理用 `useCallback`（传给子组件时防重复渲染）
- `e.stopPropagation()` → 按钮点击不冒泡到外层 onPress

---

## 6. 页面（pages/TaskListPage.tsx）

```tsx
// pages/TaskListPage.tsx — 页面只做组合，不写业务逻辑

import { useTaskList } from '../hooks/useTaskList';
import { useTaskUIStore } from '../stores/task-store';
import { TaskCard } from '../components/TaskCard';
import type { TaskFilters } from '../types';

export function TaskListPage() {
  // Hook 管逻辑
  const { tasks, loading, error, refresh, complete } = useTaskList();
  const filters = useTaskUIStore((s) => s.filters);
  const setFilters = useTaskUIStore((s) => s.setFilters);

  // 页面只做组合 + 骨架
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <div className="flex flex-col h-full">
      {/* 筛选栏 */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* 列表 */}
      {loading ? (
        <LoadingSkeleton count={5} />
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 p-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={complete}
            />
          ))}
          {tasks.length === 0 && <EmptyState message="暂无任务" />}
        </div>
      )}
    </div>
  );
}

// 筛选栏（简单内联，复杂了再抽组件）
function FilterBar({ filters, onChange }: { filters: TaskFilters; onChange: (f: Partial<TaskFilters>) => void }) {
  return (
    <div className="flex gap-2 p-4 border-b">
      <select
        value={filters.status || ''}
        onChange={(e) => onChange({ status: e.target.value as any || undefined })}
        className="border rounded px-2 py-1"
      >
        <option value="">全部</option>
        <option value="pending">待接取</option>
        <option value="in_progress">进行中</option>
        <option value="completed">已完成</option>
      </select>
      <input
        value={filters.keyword || ''}
        onChange={(e) => onChange({ keyword: e.target.value })}
        placeholder="搜索任务..."
        className="border rounded px-2 py-1 flex-1"
      />
    </div>
  );
}

function LoadingSkeleton({ count }: { count: number }) {
  return <div className="space-y-3 p-4">{Array.from({ length: count }).map((_, i) => (
    <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
  ))}</div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex-1 flex items-center justify-center text-gray-400">{message}</div>;
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-red-500">{message}</p>
      <button onClick={onRetry} className="px-4 py-2 bg-blue-500 text-white rounded">重试</button>
    </div>
  );
}
```

---

## 7. 列表性能优化

| 优化手段 | 做法 | 为什么 |
|---------|------|--------|
| **key 用唯一 ID** | `key={task.id}` | React Diff 靠 key 判断哪个 item 变了，不用 index |
| **memo 包组件** | `memo(TaskCard)` | props 不变 → 不 re-render。列表 100 项只有 1 项变 → 只重渲 1 个 |
| **useCallback 稳定回调** | `onComplete={complete}` | complete 引用稳定 → memo 才能生效 |
| **虚拟列表** | `react-window` / `react-virtuoso` | 只渲染可视区的 item，1000 项列表也不卡 |
| **分页 / 无限滚动** | 后端分页 + 前端 append | 不一次加载全部数据 |
| **防抖搜索** | `useDebounce(keyword, 300)` | 输入时不每个字符都请求 |

```tsx
// 虚拟列表示例（当列表 > 100 项时考虑）
import { FixedSizeList } from 'react-window';

<FixedSizeList height={600} itemCount={tasks.length} itemSize={100} width="100%">
  {({ index, style }) => (
    <div style={style}>
      <TaskCard task={tasks[index]} onComplete={complete} />
    </div>
  )}
</FixedSizeList>
```

---

## 8. 组件封装原则速查

| 原则 | 说明 |
|------|------|
| **Props 严格定义** | 用 interface，不用 any |
| **单一职责** | 一个组件只做一件事 |
| **纯展示** | 组件不调 API、不管全局状态（交给 Hook） |
| **可复用** | 不耦合具体业务数据结构（通过 Props 注入） |
| **默认值** | 可选 Props 给默认值（`onPress?: () => void`） |
| **组合优于继承** | 用 children / render props，不用继承 |

**纯展示（Presentational）vs 容器（Container）示例**：

```tsx
// ❌ 组件又获取数据又渲染（职责混合）
function TaskCard({ taskId }) {
  const [task, setTask] = useState(null);
  useEffect(() => { fetchTask(taskId).then(setTask); }, [taskId]);
  const dispatch = useStore(s => s.dispatch);
  return <div onClick={() => dispatch(complete(taskId))}>{task?.title}</div>;
}

// ✅ 纯展示组件（Presentational）：只管 props → UI
function TaskCard({ task, onComplete }: { task: Task; onComplete: () => void }) {
  return <div onClick={onComplete}>{task.title}</div>;
}

// ✅ 逻辑交给自定义 Hook
function useTask(taskId: string) {
  const { data: task } = useQuery({ queryKey: ['task', taskId], queryFn: () => fetchTask(taskId) });
  const { mutate: completeTask } = useMutation({ mutationFn: () => completeTaskApi(taskId) });
  return { task, completeTask };
}

// ✅ 容器组件（Container）：Hook 管逻辑 + 组合展示组件
function TaskDetailScreen({ taskId }: { taskId: string }) {
  const { task, completeTask } = useTask(taskId);
  if (!task) return <Skeleton />;
  return <TaskCard task={task} onComplete={completeTask} />;
}
```

好处：纯展示组件容易测试（传 props 就能测）、容易复用（不绑定数据源）、方便 memo 优化。

---

## 9. TSX 常用模式速查

```tsx
// 条件渲染
{isLoading && <Spinner />}
{error ? <ErrorView /> : <Content />}
{items.length > 0 && <List items={items} />}

// 列表渲染
{tasks.map(task => <TaskCard key={task.id} task={task} />)}

// 事件处理
<button onClick={() => handleClick(id)}>点击</button>
<button onClick={(e) => { e.stopPropagation(); doSomething(); }}>不冒泡</button>

// 受控输入
<input value={keyword} onChange={(e) => setKeyword(e.target.value)} />

// 样式条件
<div className={`base ${active ? 'bg-blue-500' : 'bg-gray-200'}`} />

// 展开/折叠
const [expanded, setExpanded] = useState(false);
<button onClick={() => setExpanded(!expanded)}>展开</button>
{expanded && <DetailPanel />}

// 早返回（Guard Clause）
if (!data) return null;
if (loading) return <Skeleton />;
if (error) return <ErrorView />;
return <Content data={data} />;
```
