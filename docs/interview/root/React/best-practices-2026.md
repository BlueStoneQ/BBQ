# React 工程最佳实践（2026）

> 问题：一个新 React 项目从零开始，选型 + 目录 + 模块设计 + 核心部件应该怎么组织？
> 结论：函数式 + Hooks + 按功能切模块 + Zustand 状态 + TanStack Query 数据 + 严格分层

---

## 目录

- [技术选型速查](#技术选型速查)
- [目录结构设计](#目录结构设计)
  - [核心原则](#核心原则)
  - [推荐结构](#推荐结构react-项目)
  - [依赖规则](#依赖规则)
- [功能模块设计（Feature-based）](#功能模块设计feature-based)
  - [一个 Feature 的边界](#一个-feature-的边界)
  - [Feature 之间怎么通信？](#feature-之间怎么通信)
- [核心部件与分层](#核心部件与分层)
- [组件设计原则](#组件设计原则)
  - [容器组件 vs 展示组件（2026 版本）](#容器组件-vs-展示组件2026-版本)
  - [组件分类](#组件分类)
- [状态管理分层](#状态管理分层)
- [数据获取模式](#数据获取模式)
  - [TanStack Query（推荐）](#tanstack-query推荐)
- [样式方案](#样式方案)
- [工程化配套](#工程化配套)
- [一个完整 Feature 长什么样](#一个完整-feature-长什么样)
- [速记](#速记)

---

## 技术选型速查

| 领域 | 2026 首选 | 备选 | 不推荐 |
|------|-----------|------|--------|
| UI 框架 | React 19 | — | Class 组件 |
| 语言 | TypeScript（strict） | — | 纯 JS |
| 状态管理（客户端） | **Zustand** | Jotai | Redux（太重）/ MobX（OOP） |
| 数据获取（服务端状态） | **TanStack Query** | SWR | 手写 useEffect + fetch |
| 路由 | React Router 7 / TanStack Router | Next.js App Router | — |
| 样式 | Tailwind CSS 4 | CSS Modules | CSS-in-JS runtime（性能差） |
| 表单 | React Hook Form | — | 自己手管每个 field |
| 测试 | Vitest + Testing Library | Jest | Enzyme |
| 构建 | Vite 6 | — | Webpack（除非遗留） |
| Lint | ESLint flat config + Prettier | Biome | — |
| Monorepo | pnpm workspace | Turborepo | Lerna |

---

## 目录结构设计

### 核心原则

```
按功能切（Feature-based），不按类型切（Type-based）

❌ 按类型切（难以扩展，改一个功能要跳 5 个目录）：
src/
├── components/    ← 几百个组件堆在一起
├── hooks/         ← 所有 hook 堆在一起
├── stores/        ← 所有 store 堆在一起
├── services/      ← 所有 API 堆在一起
└── pages/

✅ 按功能切（高内聚低耦合，改一个功能只动一个目录）：
src/
├── features/      ← 每个功能模块自包含
│   ├── task/
│   ├── chat/
│   └── wallet/
├── shared/        ← 跨功能共享的工具/组件/hooks
└── app/           ← 入口/路由/全局配置
```

### 推荐结构（React 项目）

```
src/
├── app/                        ← 应用入口 + 全局配置
│   ├── App.tsx                 # 根组件（Provider 堆叠）
│   ├── router.tsx              # 路由配置
│   └── providers.tsx           # 全局 Provider 组合
│
├── features/                   ← 业务功能模块（核心）
│   ├── task/                   # 任务模块
│   │   ├── components/         # 该模块专属组件
│   │   ├── hooks/              # 该模块专属 hooks
│   │   ├── stores/             # 该模块的 Zustand store
│   │   ├── services/           # 该模块的 API 层
│   │   ├── types.ts            # 该模块的类型定义
│   │   ├── pages/              # 页面
│   │   └── index.ts            # 模块公开 API（导出给外部用的）
│   ├── chat/
│   ├── wallet/
│   └── account/
│
├── shared/                     ← 跨模块共享
│   ├── components/             # 通用 UI 组件（Button/Modal/Toast）
│   ├── hooks/                  # 通用 hooks（useDebounce/useNetwork）
│   ├── utils/                  # 工具函数（formatDate/currency）
│   ├── services/               # 通用服务（API client/auth/storage）
│   ├── types/                  # 全局类型
│   └── constants/              # 常量
│
├── design-system/              ← 设计系统（可选，大项目用）
│   ├── tokens/                 # Design Token（颜色/间距/字体）
│   ├── primitives/             # 基础原子组件
│   └── theme.ts                # 主题配置
│
└── __tests__/                  ← 集成测试（单元测试随模块放）
```

### 依赖规则

```
app → 可以导入 features/* 和 shared/*
features/* → 只能导入 shared/*（不能互相导入）
shared → 不导入任何 feature
```

这和 XRN 的多 Bundle 依赖规则一样——**单向依赖，高内聚低耦合**。

---

## 功能模块设计（Feature-based）

### 一个 Feature 的边界

```
一个 Feature = 一个业务领域的完整闭环

包含：
  - 页面（screens/pages）
  - 该领域的组件
  - 该领域的状态（store）
  - 该领域的 API 调用（services）
  - 该领域的类型定义

不包含：
  - 和其他 feature 直接交互的代码（通过 shared/services 或事件解耦）
```

### Feature 之间怎么通信？

```
❌ 直接导入另一个 feature 的 store/组件
✅ 通过 shared 层中转：
  - 事件总线（EventEmitter）
  - 全局 store（shared/stores/app-store.ts）
  - 路由参数

类比 XRN 的多 Bundle 通信思想——feature 之间不直接耦合。
```

---

## 核心部件与分层

```
一个 React/RN 应用的分层架构：

┌─────────────────────────────────────┐
│         Screen / Page               │  ← 页面：组合组件 + 编排逻辑
├─────────────────────────────────────┤
│         Components                  │  ← UI 组件：纯展示 + 交互
├─────────────────────────────────────┤
│         Hooks                       │  ← 逻辑复用：状态 + 副作用 + 业务规则
├─────────────────────────────────────┤
│  Store (Zustand)  │  Query (TanStack) │  ← 状态层：客户端状态 + 服务端缓存
├─────────────────────────────────────┤
│         Services / API              │  ← 数据层：网络请求 + 数据转换
├─────────────────────────────────────┤
│         Types / Constants           │  ← 基础层：类型定义 + 常量
└─────────────────────────────────────┘
```

| 层 | 职责 | 依赖方向 |
|---|---|---|
| Screen | 组合组件 + 调用 hooks + 布局 | → Components + Hooks |
| Components | 纯 UI 渲染 + 事件回调 | → 只接收 props，不知道 store |
| Hooks | 封装业务逻辑 + 组合 store/query | → Store + Query + Services |
| Store | 客户端状态（UI 状态/表单/临时数据） | → 独立，不依赖上层 |
| Query | 服务端数据缓存 + 请求管理 | → Services |
| Services | API 请求 + 数据转换 | → 独立 |

---

## 组件设计原则

### 容器组件 vs 展示组件（2026 版本）

不再用 Class 的 Container/Presentational 划分，而是用 **Hook 抽逻辑 + 组件纯展示**：

```tsx
// ❌ 旧模式：组件里混杂逻辑
function TaskList() {
  const [tasks, setTasks] = useState([]);
  useEffect(() => { fetch('/api/tasks').then(...) }, []);
  const handleComplete = (id) => { ... };
  return <FlatList data={tasks} ... />;
}

// ✅ 新模式：Hook 管逻辑，组件纯渲染
function useTaskList() {
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const completeMutation = useMutation({ mutationFn: completeTask });
  return { tasks, complete: completeMutation.mutate };
}

function TaskList() {
  const { tasks, complete } = useTaskList();
  return <FlatList data={tasks} renderItem={({ item }) => (
    <TaskCard task={item} onComplete={() => complete(item.id)} />
  )} />;
}
```

### 组件分类

| 类型 | 特征 | 例子 |
|------|------|------|
| **原子组件** | 最小粒度，无业务逻辑 | Button / Input / Avatar |
| **分子组件** | 组合原子，有轻量交互 | SearchBar / TaskCard / UserBadge |
| **有机体组件** | 组合分子，有业务逻辑 | TaskList / ChatThread / WalletBalance |
| **Screen** | 页面级，编排有机体 | TaskScreen / ChatScreen |

---

## 状态管理分层

```
不同类型的状态用不同方案：

┌─────────────────────────────────────────┐
│  useState / useReducer                   │  ← 局部状态（组件内部）
│  用于：表单输入、开关、动画状态           │
├─────────────────────────────────────────┤
│  Zustand                                 │  ← 客户端全局状态
│  用于：用户信息、UI 偏好、跨页面状态      │
├─────────────────────────────────────────┤
│  TanStack Query                          │  ← 服务端状态（数据缓存）
│  用于：API 数据、列表、详情               │
├─────────────────────────────────────────┤
│  URL / Route Params                      │  ← 导航状态
│  用于：页面参数、筛选条件、分页           │
└─────────────────────────────────────────┘
```

**原则**：
- 能用 useState 就不提升到 Zustand
- 服务端数据用 Query 管（自带缓存/重试/失效），不要放进 Zustand
- Zustand 只管"纯客户端状态"（用户操作产生的、不来自服务端的）

---

## 数据获取模式

### TanStack Query（推荐）

```tsx
// services/task-service.ts — 纯函数，不依赖 React
export async function fetchTasks(): Promise<Task[]> {
  const res = await api.get('/tasks');
  return res.data;
}

// hooks/useTaskList.ts — 封装 Query
export function useTaskList() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  });
}

// 组件里用
function TaskScreen() {
  const { data, isLoading, error } = useTaskList();
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorView />;
  return <TaskList tasks={data} />;
}
```

**为什么不手写 useEffect + fetch？**
- 自带缓存（同一个 queryKey 多处使用只请求一次）
- 自带 loading/error 状态
- 自带重试 / 失效刷新 / 后台刷新
- 自带分页 / 无限滚动支持

---

## 样式方案

### 推荐：Tailwind CSS

```tsx
<div className="flex-1 p-4">
  <h1 className="text-lg font-semibold">Title</h1>
</div>
```

**为什么选 Tailwind？**
- 零运行时（编译时生成 CSS，不像 styled-components 有 runtime 开销）
- 原子化复用，bundle 体积小
- 和设计系统天然对齐（Design Token = Tailwind config）
- 2026 年 React 社区主流方案

---

## 工程化配套

| 工具 | 配置 | 作用 |
|------|------|------|
| TypeScript | `strict: true` | 类型安全 |
| ESLint | flat config + react rules | 代码规范 |
| Prettier | 统一格式 | 格式化 |
| Husky + lint-staged | pre-commit hook | 提交前检查 |
| Vitest / Jest | 单元 + 集成测试 | 质量保障 |
| CI/CD | GitHub Actions / GitLab CI | 自动构建/测试/发布 |

---

## 一个完整 Feature 长什么样

以 xz 的**任务系统**为例：

```
src/features/task/
├── components/
│   ├── TaskCard.tsx          # 任务卡片（纯展示）
│   ├── TaskStatusBadge.tsx   # 状态徽章
│   └── TaskFilters.tsx       # 筛选栏
├── hooks/
│   ├── useTaskList.ts        # 任务列表 Query
│   ├── useTaskActions.ts     # 任务操作（完成/接取/提交）
│   └── useTaskFilters.ts     # 筛选逻辑
├── stores/
│   └── task-ui-store.ts      # 纯 UI 状态（展开/折叠/选中）
├── services/
│   └── task-api.ts           # API 请求函数
├── pages/
│   ├── TaskListPage.tsx      # 任务列表页
│   └── TaskDetailPage.tsx    # 任务详情页
├── types.ts                  # Task / TaskStatus / TaskFilter 类型
└── index.ts                  # 导出公开 API
```

```tsx
// pages/TaskListPage.tsx — 页面只做组合
export function TaskListPage() {
  const { tasks, isLoading } = useTaskList();
  const { filters, setFilter } = useTaskFilters();
  const { complete, submit } = useTaskActions();

  if (isLoading) return <TaskListSkeleton />;

  return (
    <div className="flex-1 p-4">
      <TaskFilters value={filters} onChange={setFilter} />
      <div className="space-y-3">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={() => complete(task.id)}
            onSubmit={() => submit(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

这就是 2026 年一个 React/RN 项目应该长的样子。

---

## 速记

```
选型：TS + Zustand + TanStack Query + React Router / TanStack Router
目录：feature-based（按功能切，不按类型切）
状态：局部 useState → 客户端 Zustand → 服务端 Query
组件：Hook 管逻辑，组件纯渲染
依赖：单向（app → features → shared），features 之间不互相导入
样式：Tailwind CSS（零运行时，原子化）
```
