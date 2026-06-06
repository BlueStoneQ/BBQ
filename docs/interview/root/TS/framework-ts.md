# Vue + React TSX 中的 TS 范式

> 解决什么问题：框架中 TS 怎么用？Props 怎么定义？事件/Ref/Hook 类型怎么写？
> 原则：让 TS 为组件 API 服务——调用方有补全、有报错、有文档。

---

## 目录

- [React TSX 中的 TS](#react-tsx-中的-ts)
  - [Props 定义](#react-props-定义)
  - [事件类型](#react-事件类型)
  - [Ref 类型](#react-ref-类型)
  - [Hook 类型](#react-hook-类型)
  - [泛型组件](#react-泛型组件)
- [Vue 3 中的 TS](#vue-3-中的-ts)
  - [Props 定义](#vue-props-定义)
  - [Emit 类型](#vue-emit-类型)
  - [Ref 类型](#vue-ref-类型)
  - [Composable 类型](#vue-composable-类型)

---

## React TSX 中的 TS

### React Props 定义

```tsx
// 基础 Props
interface ButtonProps {
  text: string;
  variant?: 'primary' | 'secondary';  // 可选 + 联合类型
  disabled?: boolean;
  onClick: () => void;
}

function Button({ text, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  return <button className={variant} disabled={disabled} onClick={onClick}>{text}</button>;
}

// 带 children
interface CardProps {
  title: string;
  children: React.ReactNode;  // 任意 JSX 内容
}

// 继承原生 HTML 属性
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
// 这样 InputProps 自动拥有 onChange/value/placeholder 等所有 input 属性

// 排除某些属性后继承
type CustomButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onClick: (id: string) => void;  // 覆盖 onClick 类型
};
```

### React 事件类型

```tsx
// 常用事件类型
type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;
type SubmitHandler = (e: React.FormEvent<HTMLFormElement>) => void;
type ClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => void;
type KeyHandler = (e: React.KeyboardEvent<HTMLInputElement>) => void;

// 实际使用
function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    onSearch(e.target.value);
  };
  return <input onChange={handleChange} />;
}
```

### React Ref 类型

```tsx
// DOM ref
const inputRef = useRef<HTMLInputElement>(null);
// inputRef.current → HTMLInputElement | null

// 可变值 ref
const timerRef = useRef<number | null>(null);
// timerRef.current → number | null（可赋值）

// forwardRef
interface InputProps { label: string }
const Input = forwardRef<HTMLInputElement, InputProps>(({ label }, ref) => {
  return <input ref={ref} aria-label={label} />;
});
```

### React Hook 类型

```tsx
// useState 类型推导
const [user, setUser] = useState<User | null>(null);
// user: User | null

// useReducer
type Action = { type: 'SET'; payload: User } | { type: 'CLEAR' };
const [state, dispatch] = useReducer(reducer, initialState);

// 自定义 Hook 返回类型
function useToggle(initial = false): [boolean, () => void] {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle];
}

// 复杂 Hook（返回对象）
interface UseTaskReturn {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useTask(userId: string): UseTaskReturn {
  // ...
}
```

### React 泛型组件

```tsx
// 列表组件：不关心具体数据类型
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={keyExtractor(item)}>{renderItem(item, i)}</li>
      ))}
    </ul>
  );
}

// 使用时 T 自动推导
<List
  items={users}                         // T 推导为 User
  renderItem={(user) => <span>{user.name}</span>}  // user: User
  keyExtractor={(user) => user.id}
/>
```

---

## Vue 3 中的 TS

### Vue Props 定义

```vue
<script setup lang="ts">
// 方式 1：defineProps + 泛型（推荐）
interface Props {
  title: string;
  count?: number;
  status: 'active' | 'inactive';
  items: string[];
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  status: 'active',
});

// 方式 2：运行时声明（兼容 Options API）
const props = defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 },
});
</script>
```

### Vue Emit 类型

```vue
<script setup lang="ts">
// 类型安全的 emit
const emit = defineEmits<{
  change: [value: string];
  submit: [data: FormData, reset: boolean];
  'update:modelValue': [value: number];
}>();

// 使用
emit('change', 'hello');        // ✅
emit('change', 123);            // ❌ 类型错误
emit('submit', formData, true); // ✅
</script>
```

### Vue Ref 类型

```vue
<script setup lang="ts">
import { ref, type Ref } from 'vue';

// 自动推导
const count = ref(0);         // Ref<number>
const user = ref<User | null>(null);  // Ref<User | null>

// 模板 ref（DOM）
const inputEl = ref<HTMLInputElement>();
// 使用时：inputEl.value?.focus()

// 组件 ref
const childRef = ref<InstanceType<typeof ChildComponent>>();
</script>
```

### Vue Composable 类型

```ts
// composables/useCounter.ts
interface UseCounterOptions {
  min?: number;
  max?: number;
}

interface UseCounterReturn {
  count: Ref<number>;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export function useCounter(initial = 0, options?: UseCounterOptions): UseCounterReturn {
  const count = ref(initial);
  
  const increment = () => {
    if (options?.max !== undefined && count.value >= options.max) return;
    count.value++;
  };
  
  const decrement = () => {
    if (options?.min !== undefined && count.value <= options.min) return;
    count.value--;
  };
  
  const reset = () => { count.value = initial; };
  
  return { count, increment, decrement, reset };
}
```

---

## 对比：React vs Vue 的 TS 写法

| 场景 | React | Vue 3 |
|------|-------|-------|
| Props 定义 | `interface Props {}` → 函数参数解构 | `defineProps<Props>()` |
| 事件 | Props 中传回调函数 | `defineEmits<{...}>()` |
| DOM Ref | `useRef<HTMLElement>(null)` | `ref<HTMLElement>()` |
| 泛型组件 | `function List<T>(props: ListProps<T>)` | `<script setup generic="T">` (Vue 3.3+) |
| Hook/Composable | 返回类型声明 interface | 返回类型声明 interface |
