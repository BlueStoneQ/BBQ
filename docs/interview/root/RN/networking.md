# RN 网络层最佳实践（2026）

## 推荐技术栈

```
TanStack Query (v5) + axios + 自封装 request 层
```

## 底层原理：RN 网络请求链路

RN 的 `fetch()` 不是浏览器的 fetch，而是 polyfill，底层调用原生网络模块：

```
JS 层: fetch() / XMLHttpRequest / axios
        ↓ (Bridge / JSI)
Native 层: 原生网络模块
        ↓
iOS: NSURLSession
Android: OkHttp
        ↓
网络层: DNS → TCP → TLS → HTTP
```

**为什么这么设计：**
- 复用原生网络栈：Cookie 管理、证书校验、HTTP/2、连接复用、系统代理
- 安全：TLS 证书绑定（SSL Pinning）必须在原生层做
- 性能：OkHttp/NSURLSession 是久经优化的原生实现

---

## 分层架构

```
┌─────────────────────────────────┐
│  UI 组件层                       │
│  useQuery / useMutation         │
├─────────────────────────────────┤
│  API 层 (api/*.ts)              │
│  定义接口函数，返回 Promise      │
├─────────────────────────────────┤
│  Request 层 (request.ts)        │
│  axios 实例 + 拦截器             │
├─────────────────────────────────┤
│  Native 网络栈                   │
│  NSURLSession / OkHttp          │
└─────────────────────────────────┘
```

---

## 各层实现

### 1. Request 层 — axios 实例

```tsx
// src/lib/request.ts
import axios from 'axios';
import { getToken, refreshToken } from '@/auth';

const request = axios.create({
  baseURL: Config.API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截
request.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // 链路追踪
  config.headers['X-Request-ID'] = generateRequestId();
  return config;
});

// 响应拦截：统一错误处理 + token 无感刷新
request.interceptors.response.use(
  res => res.data,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return request(error.config); // 重试原请求
      }
      navigateToLogin();
    }
    return Promise.reject(normalizeError(error));
  }
);

export default request;
```

### 2. API 层 — 按模块拆分

```tsx
// src/api/task.ts
import request from '@/lib/request';
import type { Task, TaskQuery, TaskSubmit } from '@/types';

export const taskApi = {
  list: (params: TaskQuery) =>
    request.get<Task[]>('/tasks', { params }),

  detail: (id: string) =>
    request.get<Task>(`/tasks/${id}`),

  submit: (data: TaskSubmit) =>
    request.post<Task>('/tasks/submit', data),

  approve: (id: string) =>
    request.patch(`/tasks/${id}/approve`),
};
```

### 3. 数据层 — TanStack Query

```tsx
// src/hooks/useTask.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/api/task';

// 查询
export function useTaskList(params: TaskQuery) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => taskApi.list(params),
    staleTime: 30_000,       // 30s 内不重新请求
    gcTime: 5 * 60_000,     // 缓存保留 5 分钟
  });
}

// 变更 + 乐观更新
export function useSubmitTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskApi.submit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

### 4. 组件层 — 直接消费

```tsx
function TaskListScreen() {
  const { data, isLoading, error, refetch } = useTaskList({ status: 'pending' });
  const { mutate: submit, isPending } = useSubmitTask();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorView onRetry={refetch} />;

  return (
    <FlatList
      data={data}
      renderItem={({ item }) => (
        <TaskCard task={item} onSubmit={() => submit(item)} />
      )}
      refreshing={isLoading}
      onRefresh={refetch}
    />
  );
}
```

---

## 技术选型对比

| 选择 | 理由 |
|---|---|
| TanStack Query | 自动缓存、去重、重试、乐观更新、离线支持，不用手写 loading/error 状态 |
| axios（非裸 fetch） | 拦截器好用、取消请求、自动 JSON 转换、错误处理一致 |
| 不用 RTK Query | 除非已经用了 Redux；Zustand + TanStack Query 更轻量 |
| 不用 SWR | TanStack Query 功能更全（mutation、离线、devtools） |

---

## 企业级增强

| 能力 | 方案 |
|---|---|
| 离线支持 | TanStack Query + AsyncStorage persistor |
| WebSocket 实时推送 | 聊天/通知用 Socket.io，收到推送后 `queryClient.setQueryData` 更新缓存 |
| 接口类型安全 | OpenAPI → codegen 自动生成 API 层 + 类型 |
| 请求重试 | TanStack Query 内置 `retry: 3` |
| 请求去重 | TanStack Query 自动处理（相同 queryKey 只发一次） |
| 错误上报 | request 拦截器里统一上报到 Sentry |
| SSL Pinning | 原生层配置证书绑定（金融类 App 必做） |

---

## WebSocket + TanStack Query 配合（聊天场景）

```tsx
// 实时消息推送更新缓存
useEffect(() => {
  const socket = io(WS_URL);

  socket.on('new_message', (msg: Message) => {
    // 直接更新缓存，无需重新请求
    queryClient.setQueryData(['messages', msg.chatId], (old: Message[]) =>
      old ? [...old, msg] : [msg]
    );
  });

  socket.on('task_updated', (task: Task) => {
    // 让相关查询失效，下次访问时自动重新请求
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  });

  return () => { socket.disconnect(); };
}, []);
```

---

## 大厂定制：替换底层网络库

大厂通常不用默认的 OkHttp/NSURLSession，而是替换为自研网络库：

```
字节: TTNet（QUIC + 多路复用 + 智能路由）
携程: 自研网络库（连接池 + DNS 优化）
美团: Shark（长连接 + 请求合并）
```

替换方式：通过 Native Module 将自研网络库暴露给 JS 层，或 hook RN 的 Networking 模块。

---

## 总结

**2026 年 RN 网络层 = TanStack Query 管状态 + axios 管传输 + 分层封装管工程。**

不要手写 `useEffect + useState` 管请求了，那是 2020 年的写法。TanStack Query 帮你处理了缓存、去重、重试、失效、乐观更新等所有复杂场景。
