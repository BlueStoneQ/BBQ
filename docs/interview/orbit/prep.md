# Orbit Labs — 面试准备
> 一面会有coding 一般是easy-medium的难度～
> 
> 他们一般就算是考coding 也是practical coding    也有可能考察算法，但也是为了看看你的foundation那种，不会太为难你~但是需要你好好刷题，梳理好项目~

→ [JD 拆解](./jd.md)

→ [手写题练习](./write.md)

---

# practical coding
一般是什么 你看JD 有可能考哪些方面 

| 方向 | 可能的题 | 难度 |
|------|---------|------|
| **React/Hooks** | 实现 useDebounce / usePrevious / 自定义 hook | Easy |
| **异步处理** | Promise 并发控制（限制 N 个并发）/ 实现 Promise.all | Easy-Medium |
| **事件系统** | 实现 EventEmitter（on/off/emit） | Easy |
| **实时数据** | WebSocket 消息队列 / 节流防抖实现 | Medium |
| **状态管理** | 实现简易 Zustand / 发布订阅模式 | Medium |
| **数据转换** | 扁平数组 → 树结构 / 深拷贝 / 对象 diff | Easy-Medium |

| ~~**算法（foundation）**~~ | 两数之和 / 有效括号 / LRU Cache | Easy-Medium |

**准备 Top 5**：Promise 并发限制、自定义 Hook、EventEmitter、深拷贝、LRU Cache

# TSX 考点

| TS 高频考点 | 示例 |
|------------|------|
| 泛型 Hook | `function useDebounce<T>(value: T, delay: number): T` |
| 组件 Props 类型 | `interface Props { onPress: (id: string) => void; data: Item[] }` |
| 联合类型 + 类型守卫 | `type Status = 'loading' | 'success' | 'error'` + narrowing |
| Promise 泛型 | `function fetchData<T>(url: string): Promise<T>` |
| 工具类型 | `Record<string, T>` / `Partial<T>` / `Pick<T, K>` |

练的时候直接 `.tsx` 写，参数加类型、返回值加类型、props 用 interface。

---

# 手写题题库（TS 版练习）

→ [JavaScript Coding Questions](../../writeByHand/JavaScript-Coding-Questions.md)

→ [JS Coding 实现合集](../../writeByHand/js-coding/README.md)

练习时全部用 TypeScript 写，加泛型 + 类型约束。
