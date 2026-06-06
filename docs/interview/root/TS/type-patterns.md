# TS 常见数据类型处理

> 解决什么问题：日常开发中 90% 的 TS 场景怎么写？不做体操，只做实战。
> 本质：TS 的价值 = 编译时发现错误 + IDE 自动补全 + 代码即文档。
> 原则：类型服务于业务，不是业务服务于类型。

---

## 目录

- [基础类型速查](#基础类型速查)
- [Object 类型处理](#object-类型处理)
- [函数类型处理](#函数类型处理)
- [Promise / 异步类型](#promise--异步类型)
- [数组 / 元组](#数组--元组)
- [联合类型与类型收窄](#联合类型与类型收窄)
- [工具类型实战（Partial/Pick/Omit/Record）](#工具类型实战)
- [泛型实战](#泛型实战)
- [类型断言与类型守卫](#类型断言与类型守卫)
- [常用模式速查表](#常用模式速查表)

---

## 基础类型速查

```ts
// 基本
let name: string = 'Tom';
let age: number = 25;
let isDone: boolean = false;
let id: string | number = '123';   // 联合类型

// 数组
let list: number[] = [1, 2, 3];
let list2: Array<string> = ['a', 'b'];

// 对象
let user: { name: string; age: number } = { name: 'Tom', age: 25 };

// 函数
const add = (a: number, b: number): number => a + b;

// any / unknown / never
let x: any;       // 放弃类型检查（尽量不用）
let y: unknown;   // 安全的 any（使用前必须收窄）
function fail(): never { throw new Error(); }  // 永远不返回
```

---

## Object 类型处理

### interface vs type

```ts
// interface：描述对象形状（可扩展、可合并）
interface User {
  id: string;
  name: string;
  age?: number;          // 可选
  readonly createdAt: Date;  // 只读
}

// type：更灵活（可以联合/交叉/映射）
type Status = 'active' | 'inactive' | 'banned';
type UserWithRole = User & { role: string };  // 交叉类型

// 什么时候用哪个？
// interface：描述对象/类的形状（大部分情况）
// type：联合类型、映射类型、需要用到条件类型时
```

### 可选 / 必选 / 只读

```ts
interface Config {
  host: string;           // 必选
  port?: number;          // 可选（等于 number | undefined）
  readonly secret: string; // 只读（赋值后不能改）
}

// 索引签名（动态 key）
interface Dictionary {
  [key: string]: unknown;
}

// Record 更简洁
type Dict = Record<string, unknown>;
```

### 嵌套对象

```ts
interface Task {
  id: string;
  title: string;
  assignee: {
    id: string;
    name: string;
    avatar?: string;
  };
  tags: string[];
  metadata: Record<string, unknown>;
}
```

---

## 函数类型处理

### 基础

```ts
// 参数 + 返回值
function greet(name: string): string {
  return `Hello, ${name}`;
}

// 箭头函数
const add = (a: number, b: number): number => a + b;

// 函数类型声明
type Comparator<T> = (a: T, b: T) => number;
const sortByAge: Comparator<User> = (a, b) => a.age - b.age;
```

### 可选参数 / 默认值 / 剩余参数

```ts
function request(url: string, method: string = 'GET', headers?: Record<string, string>) {
  // method 有默认值，headers 可选
}

function merge<T>(...objects: T[]): T {
  return Object.assign({}, ...objects);
}
```

### 函数重载

```ts
// 根据参数类型返回不同类型
function parse(input: string): object;
function parse(input: object): string;
function parse(input: string | object): object | string {
  return typeof input === 'string' ? JSON.parse(input) : JSON.stringify(input);
}
```

### 回调函数类型

```ts
// 事件处理
type EventHandler<E = Event> = (event: E) => void;
type OnChange = (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;

// 异步回调
type AsyncCallback<T> = (error: Error | null, result?: T) => void;
```

---

## Promise / 异步类型

```ts
// 函数返回 Promise
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// Promise.all 类型自动推导
const [user, tasks] = await Promise.all([
  fetchUser('1'),        // Promise<User>
  fetchTasks('1'),       // Promise<Task[]>
]);
// user: User, tasks: Task[]

// 提取 Promise 内部类型
type Awaited<T> = T extends Promise<infer U> ? U : T;
type UserType = Awaited<ReturnType<typeof fetchUser>>;  // User
```

### API 响应类型

```ts
// 通用 API 响应结构
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 使用
async function getTaskList(): Promise<ApiResponse<Task[]>> {
  return request.get('/tasks');
}

// 解构时自动推导
const { data: tasks } = await getTaskList();  // tasks: Task[]
```

---

## 数组 / 元组

```ts
// 数组
const ids: string[] = ['a', 'b', 'c'];
const users: User[] = [{ id: '1', name: 'Tom' }];

// 只读数组
const ROLES: readonly string[] = ['admin', 'user'];
// ROLES.push('x');  // ❌ 报错

// 元组（固定长度 + 每个位置类型不同）
type Coordinate = [number, number];
type Response = [data: User | null, error: Error | null];  // 具名元组

const [data, error]: Response = await safeRequest();
```

---

## 联合类型与类型收窄

### 联合类型

```ts
type Status = 'loading' | 'success' | 'error';
type Result = User | null;
type ID = string | number;
```

### 类型收窄（Narrowing）

```ts
// typeof
function format(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase();  // 这里 TS 知道是 string
  }
  return value.toFixed(2);      // 这里 TS 知道是 number
}

// in 操作符
interface Dog { bark(): void }
interface Cat { meow(): void }
function speak(animal: Dog | Cat) {
  if ('bark' in animal) animal.bark();
  else animal.meow();
}

// 判别联合（Discriminated Union）— 最常用
type Action =
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'LOADING' };

function reducer(state: State, action: Action) {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.payload };  // payload: User
    case 'SET_ERROR': return { ...state, error: action.payload }; // payload: string
    case 'LOADING': return { ...state, loading: true };
  }
}
```

---

## 工具类型实战

### 内置工具类型

| 工具类型 | 作用 | 实际用途 |
|---------|------|---------|
| `Partial<T>` | 所有属性变可选 | 表单编辑（只传改了的字段） |
| `Required<T>` | 所有属性变必选 | 表单提交验证后 |
| `Pick<T, K>` | 只取某些属性 | API 返回部分字段 |
| `Omit<T, K>` | 去掉某些属性 | 创建时不需要 id |
| `Record<K, V>` | 构造对象类型 | 字典/映射 |
| `Readonly<T>` | 所有属性只读 | 配置/常量 |
| `ReturnType<T>` | 提取函数返回类型 | 推导 hook 返回值 |
| `Parameters<T>` | 提取函数参数类型 | 包装函数 |
| `NonNullable<T>` | 去掉 null/undefined | 过滤后确定有值 |

### 实际用法

```ts
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: Date;
}

// 创建用户时不需要 id 和 createdAt
type CreateUserInput = Omit<User, 'id' | 'createdAt'>;

// 编辑用户时所有字段可选（只传改了的）
type UpdateUserInput = Partial<Omit<User, 'id'>>;

// 列表只需要部分字段
type UserListItem = Pick<User, 'id' | 'name' | 'avatar'>;

// 状态映射
type LoadingState = Record<string, boolean>;
// { [key: string]: boolean }

// API 参数提取
type FetchUserParams = Parameters<typeof fetchUser>[0];  // string（id）
```

---

## 泛型实战

### 为什么需要泛型

```ts
// ❌ 没泛型：丢失类型信息
function first(arr: any[]): any { return arr[0]; }

// ✅ 有泛型：保留类型信息
function first<T>(arr: T[]): T | undefined { return arr[0]; }

const num = first([1, 2, 3]);      // number
const str = first(['a', 'b']);     // string
```

### 常见泛型模式

```ts
// 1. API 请求封装
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  return res.json();
}
const user = await request<User>('/api/user/1');  // 返回 User 类型

// 2. Hook 泛型
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });
  const setValue = (value: T) => {
    setStored(value);
    localStorage.setItem(key, JSON.stringify(value));
  };
  return [stored, setValue];
}

// 3. 泛型约束
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
getProperty(user, 'name');  // string
getProperty(user, 'xxx');   // ❌ 编译报错
```

---

## 类型断言与类型守卫

### 类型断言（as）

```ts
// 当你比 TS 更了解类型时
const input = document.getElementById('name') as HTMLInputElement;
input.value = 'hello';

// 非空断言（确定不是 null）
const el = document.getElementById('app')!;  // 去掉 null
```

### 类型守卫（Type Guard）

```ts
// 自定义类型守卫
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj;
}

// 使用
function processData(data: unknown) {
  if (isUser(data)) {
    console.log(data.name);  // 这里 TS 知道是 User
  }
}

// 数组过滤（去除 null）
const results: (User | null)[] = [user1, null, user2];
const users: User[] = results.filter((u): u is User => u !== null);
```

---

## 常用模式速查表

| 场景 | 写法 |
|------|------|
| API 返回类型 | `Promise<ApiResponse<User>>` |
| 表单编辑（部分字段） | `Partial<Omit<User, 'id'>>` |
| 创建（不含自动生成字段） | `Omit<User, 'id' \| 'createdAt'>` |
| 列表项（部分字段） | `Pick<User, 'id' \| 'name'>` |
| 字典/映射 | `Record<string, T>` |
| 联合类型状态 | `type Status = 'idle' \| 'loading' \| 'error'` |
| 判别联合 Action | `{ type: string; payload: T }` |
| Hook 返回值推导 | `ReturnType<typeof useXxx>` |
| 去 null | `NonNullable<T>` 或 filter 类型守卫 |
| 泛型请求 | `request<User>('/api/user')` |
| 事件类型 | `React.ChangeEvent<HTMLInputElement>` |
