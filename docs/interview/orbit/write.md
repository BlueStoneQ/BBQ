→ [面试准备](./prep.md)

→ [猜题：可能考什么](#注释猜题)

# TSX手写: RN/React

## 目录

- [RN ↔ React 常用组件对照](#rn--react-常用组件对照)
- [常用Hooks](#常用hooks)
- [状态管理手写专题](#状态管理手写专题)
  - [zustand](#zustand)
  - [context](#context)
  - [props & callback](#pops--callback)
- [综合例子](#综合例子)
  - [list](#list)
  - [表单](#表单)
  - [context使用: theme?场景案例](#context使用-theme场景案例)
- [TS](#ts)
  - [常用体操操作:函数等](#常用体操操作函数等)
  - [Promise使用](#promise使用)
  - [Class](#class)
- [手写: TS版](#手写-ts版专门的ts文件)
  - [eventEmitter](#eventemitter)
  - [promise并发](#promise并发)
  - [观察者模式](#观察者模式)
- [算法精选: TS版](#算法精选-ts版每次loop-top5)
- [附录 & 注释](#附录--注释)

---

## RN ↔ React 常用组件对照

| # | Web (React) | RN | 注意 |
|---|---|---|---|
| 1 | `<div>` | `<View>` | 容器，默认 flexbox（RN 默认 column） |
| 2 | `<span>` / 裸文本 | `<Text>` | RN 文本**必须**包 Text，不能裸写 |
| 3 | `<button onClick>` | `<Pressable onPress>` | 不用 TouchableOpacity（已过时） |
| 4 | `<input>` | `<TextInput>` | 受控：`value` + `onChangeText` |
| 5 | `<img src>` | `<Image source={{ uri }}>` | source 是对象不是字符串 |
| 6 | `<ul>` / `map()` | `<FlatList data renderItem>` | 虚拟化列表，自带回收 |
| 7 | `<div onClick>` | `<Pressable onPress>` | 所有可点击区域用 Pressable |
| 8 | CSS / className | `StyleSheet.create` + `style` | 对象写法，驼峰命名 |
| 9 | `window.scrollTo` | `ScrollView` / `FlatList.scrollToIndex` | 无 window |
| 10 | `<a href>` | `navigation.navigate()` | 无超链接，走路由 |
---
## 常用Hooks
- → [React Hooks 文档](../root/React/hooks.md)
## 状态管理手写专题
### zustand
### context
### pops & callback
## 综合例子
### list
```
我们在这里写一个最佳实践的最小例子: 列表: 综合状态管理 + 网络请求 + 子组件使用 + hooks自定义

FlatList/FlashList、分页加载、状态管理（Zustand）、网络请求（fetch/TanStack Query）、子组件 memo、自定义 Hook、TS 泛型
```
- 目录设计: feature based风格
```
- pages
 - CardList
    - hooks
    - components
    - store
    - index.tsx
```
- hooks设计: 网络请求?
```tsx
// fetch
interface IFetchOptions {
    params?: Record<string, string>
    headers?: Record<string, string>
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, unknown>
}

export const useFetch = async <T>(url: string, options?: IFetchOptions): Promise<T> => {
    const query = options?.params ? `?${new URLSearchParams(options.params).toString()}`: ''
    const res = await fetch(url + query, {
        method: options?.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        },
        body: options?.body && JSON.stringify(options.body)
    })
    if (!res.ok) throw  new Error(`HTTP ${res.status}`)
    return await res.json() as T
}

// 使用
const user = await useFetch<User>('/api/user', {
  params: { id: '123' },             // → /api/user?id=123
  headers: { Authorization: 'Bearer xxx' },
})
```
- store设计
```ts
import { create } from 'zustand'

interface ISelectedStore {
    selectedIds: string[]
    toggleSelect: (id: string) => void
    clearSelection: () => void
}

export const useSelectedStore = create<ISelectedStore>((set) => ({
    selectedIds: [],
    toggleSelect: (id: string) => {
        set((state) => ({
            selectedIds: state.selectedIds.includes(id)
                ? state.selectedIds.filter(i => i !== id)
                : [...state.selectedIds, id]
        }))
    },
    clearSelection: () => {
        set({selectedIds: []})
    }
}))
```
- 子组件: Item
```tsx
import React, { memo } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'

// Iprops
interface IProps {
    text: string
    onPress: (text: string) => void
}

export const Item = memo(({ text, onPress }: IProps) => {
    return (
        <Pressable style={styles.item} onPress={ () => onPress(text) }>
            <Text>{text}</Text>
        </Pressable>
    )
})

const styles = StyleSheet.create({
    item: { padding: 16, borderColor: '#eee' } 
})
```
- List组件组件
```tsx
import React, { useCallback, useMemo } from 'react'
import { FlatList } from 'react-native'
import { Item } from './item'

interface IProps {
    id: string
    dataList: string[]
}

const handlePress = useCallback((text: string) => {}, [])

export const List = ({ dataList }: IProps) => (
    <FlatList
        data={dataList}
        keyExtractor={(item) => item.id}
        renderItem={item => (
            <Item key={item.key} text={item.text} onPress={() => handlePress(item.text)} />
        )}
    />
)
```
- 父页面: cardList, mem优化, 生命周期 
```tsx
```
### 表单
- hooks: 节流/防抖, 提交?
- 我们是不是有一个专门的讲hooks的文档, 在React/RN那边, 你在index中找下
- → [React Hooks 文档](../root/React/hooks.md)
- → [React Coding Example（综合示例）](../root/React/coding-example.md)
- → [React 性能优化（memo/useCallback/useMemo）](../root/React/performance.md)
- store: formData
- 页面
### context使用: theme?场景案例
```
受控组件、表单验证、提交异步处理、状态 store、错误处理、TS interface 定义
```
- zustad的store定义
# TS
## 常用体操操作:函数等
- top5
- partial
## Promise使用
```ts
// ✅ function 声明式
function fetchData<T>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fetch(url)
      .then(res => res.json())
      .then(data => resolve(data as T))
      .catch(reject)
  })
}

// ✅ 箭头函数式（async/await，推荐）
const fetchData = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  const data = await res.json()
  return data as T
}

// 调用时 T 被具体化
const user = await fetchData<User>('/api/user')  // user 的类型是 User
```
## Class

```ts
// interface — 约束类必须实现的方法
interface IStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

// abstract — 抽象类，不能直接 new，只能继承
abstract class BaseStorage implements IStorage {
  protected prefix: string  // protected: 子类可访问，外部不行

  constructor(prefix: string) {
    this.prefix = prefix
  }

  // 抽象方法：子类必须实现
  abstract get(key: string): string | null
  abstract set(key: string, value: string): void
  abstract remove(key: string): void

  // 具体方法：子类直接继承
  getKey(key: string): string {
    return `${this.prefix}:${key}`
  }
}

// 具体类 — 继承 + 实现
class LocalStorage extends BaseStorage {
  private storage: Storage  // private: 仅类内部访问

  constructor(prefix: string = 'app') {
    super(prefix)  // 调用父类构造
    this.storage = window.localStorage
  }

  get(key: string): string | null {
    return this.storage.getItem(this.getKey(key))
  }

  set(key: string, value: string): void {
    this.storage.setItem(this.getKey(key), value)
  }

  remove(key: string): void {
    this.storage.removeItem(this.getKey(key))
  }
}

// 泛型类
class Cache<T> {
  private data = new Map<string, { value: T; expiry: number }>()

  set(key: string, value: T, ttl: number): void {
    this.data.set(key, { value, expiry: Date.now() + ttl })
  }

  get(key: string): T | null {
    const item = this.data.get(key)
    if (!item || Date.now() > item.expiry) return null
    return item.value
  }
}

// 使用
const store = new LocalStorage('myApp')
store.set('token', 'abc123')

const cache = new Cache<User>()
cache.set('user', { name: 'Q' }, 5000)
```

**关键字速记**：

| 关键字 | 作用 |
|--------|------|
| `interface` | 约束结构（类/对象必须满足的形状） |
| `implements` | 类实现接口 |
| `abstract` | 抽象类/方法，不能直接 new |
| `extends` | 继承 |
| `private` | 仅类内部 |
| `protected` | 类内部 + 子类 |
| `public` | 默认，任何地方 |
| `readonly` | 只读，构造后不可改 |
| `super()` | 调用父类构造函数 |

# 手写: TS版:专门的TS文件
- [JS Coding 实现合集](../../writeByHand/js-coding/README.md)
### eventEmitter
### promise并发
### 观察者模式
# 算法精选: TS版:每次loop top5

# 附录 & 注释

<a id="注释猜题"></a>
### 可能考的 Practical Coding 题型

| 类别 | 可能的题 |
|------|---------|
| **自定义 Hook** | useDebounce / useFetch / usePrevious / useInterval / useWebSocket |
| **组件封装** | Modal / Toast / 搜索框（含防抖）/ 下拉刷新列表 |
| **状态模式** | 简易 Zustand 实现 / Context + useReducer 封装 |
| **高阶组件/模式** | withAuth（权限 HOC）/ render props / compound components |
| **工具函数** | Promise 并发控制 / EventEmitter / 深拷贝 / 节流防抖 |
| **综合场景** | "实现一个搜索组件：输入框防抖 300ms → 请求接口 → 展示列表" |

结合他们 JD（Fintech + 实时数据），最可能的"practical"场景题：

"实现一个 useWebSocket hook，支持自动重连 + 消息队列"

或

"实现一个搜索组件，输入框防抖 300ms 后请求接口，展示结果列表"

这两个都是 Hook + 组件的综合题，比单独写 Hook 或单独写组件更贴近"practical"。
