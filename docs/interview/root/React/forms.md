# React 表单

> 解决什么问题：表单是中后台系统最高频的交互模式（运营平台 80% 页面都是表单），怎么高效管理表单状态、校验、提交？
>
> 本质：表单 = 受控状态管理（每个字段一个状态）+ 校验逻辑 + 提交处理。难点在复杂表单（几十个字段、联动、动态增减）时的性能和可维护性。
>
> 场景：DD 运营平台的配置表单（活动规则、策略配置、人群圈选）。

---

## 目录

- [React 表单的核心问题](#react-表单的核心问题)
- [受控 vs 非受控](#受控-vs-非受控)
- [主流方案对比](#主流方案对比)
- [React Hook Form（推荐）](#react-hook-form推荐)
- [性能问题与优化](#性能问题与优化)
- [复杂场景](#复杂场景)
- [Q&A](#qa)

---

## React 表单的核心问题

```
为什么表单在 React 里"难"？

  1. 每个输入框一个 state → 几十个字段 = 几十个 useState
  2. 每次输入触发 setState → 整个表单组件 re-render
  3. 校验逻辑和 UI 耦合 → 难复用
  4. 联动（A 字段变了 B 字段选项变）→ 依赖管理复杂
  5. 动态表单（可增减字段）→ 数据结构不固定

= 简单表单不是问题，复杂表单（30+ 字段 + 联动 + 动态）是真正的痛点
```

---

## 受控 vs 非受控

| | 受控组件 | 非受控组件 |
|---|---|---|
| 状态在哪 | React state（`value + onChange`） | DOM 自身（`ref` 取值） |
| 何时拿值 | 实时（每次输入都更新 state） | 提交时（`ref.current.value`） |
| 性能 | 每次输入 re-render | 输入不触发 re-render |
| 适合 | 需要实时校验/联动 | 简单表单、追求性能 |
| 代表 | Ant Design Form、Formik | React Hook Form（默认非受控） |

**本质**：受控 = React 管 DOM 的值（状态驱动）；非受控 = DOM 自己管值，React 只在需要时去读。

---

## 主流方案对比

| 方案 | 原理 | 性能 | 复杂表单 | 学习成本 |
|------|------|------|---------|---------|
| **纯 useState** | 每个字段一个 state | 差（全量 re-render） | 难维护 | 无 |
| **Formik** | 受控，状态集中管理 | 中（优化过但仍受控） | 好 | 低 |
| **React Hook Form** | 非受控 + ref，提交时收集 | 好（输入不 re-render） | 好 | 中 |
| **Ant Design Form** | 受控 + Store 模式 | 中 | 好（配合 antd 组件） | 低（antd 生态内） |

**2026 推荐**：React Hook Form（性能最好 + 生态成熟 + TypeScript 友好）。如果项目用 Ant Design 就直接用 antd Form（和 UI 组件深度集成）。

---

## React Hook Form（推荐）

```typescript
import { useForm } from 'react-hook-form';

interface FormData {
  name: string;
  email: string;
  age: number;
}

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    console.log(data);  // { name: "Tom", email: "...", age: 25 }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* register 返回 ref + onChange → 非受控，输入不触发 re-render */}
      <input {...register('name', { required: '必填' })} />
      {errors.name && <span>{errors.name.message}</span>}

      <input {...register('email', { pattern: { value: /^\S+@\S+$/, message: '邮箱格式错误' } })} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="number" {...register('age', { min: { value: 18, message: '需满18岁' } })} />

      <button type="submit">提交</button>
    </form>
  );
}
```

**为什么快**：`register` 给 input 注册 ref，值存在 DOM 里而非 state。输入时不触发 React re-render。只在校验/提交时才读值。

**配合 Zod/Yup 做 Schema 校验**：

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, '必填'),
  email: z.string().email('邮箱格式错误'),
  age: z.number().min(18, '需满18岁'),
});

const { register, handleSubmit } = useForm({
  resolver: zodResolver(schema),  // Schema 驱动校验，逻辑和 UI 解耦
});
```

---

## 性能问题与优化

```
问题：30 个字段的表单，每改一个字段整个表单 re-render？

原因：受控模式下，表单状态在父组件 → 改任意字段 → setState → 父组件 re-render → 所有子 input 都 re-render

解法：
  1. React Hook Form（非受控，从根源消除问题）
  2. 字段级订阅（只有被修改的字段 re-render）
  3. memo + useCallback（减少子组件不必要渲染）
  4. 表单分区（大表单拆成多个子表单组件，各自管理状态）
```

```typescript
// React Hook Form 的 watch 是字段级订阅
const { watch } = useForm();

// 只有 name 变化时触发 re-render（不是整个表单）
const nameValue = watch('name');
```

---

## 复杂场景

### 联动（A 字段的值影响 B 字段）

```typescript
const { watch, setValue } = useForm();

// 监听 province 变化 → 更新 city 选项
const province = watch('province');
useEffect(() => {
  const cities = getCitiesByProvince(province);
  setValue('city', cities[0]);  // 重置 city
}, [province]);
```

### 动态增减字段（数组表单）

```typescript
import { useFieldArray } from 'react-hook-form';

function DynamicForm() {
  const { control, register } = useForm({
    defaultValues: { items: [{ name: '', price: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`items.${index}.name`)} />
          <input type="number" {...register(`items.${index}.price`)} />
          <button onClick={() => remove(index)}>删除</button>
        </div>
      ))}
      <button onClick={() => append({ name: '', price: 0 })}>添加</button>
    </>
  );
}
```

### 多步骤表单（分步提交）

```typescript
// 每步一个独立 useForm，最后合并提交
// 或用一个 useForm + 分步显示不同字段组
const [step, setStep] = useState(1);
const { register, handleSubmit, trigger } = useForm();

const nextStep = async () => {
  const valid = await trigger(['name', 'email']);  // 只校验当前步的字段
  if (valid) setStep(s => s + 1);
};
```

---

## Q&A

**Q：受控和非受控怎么选？**

A：需要实时联动/实时校验 → 受控（antd Form）。追求性能/大表单 → 非受控（React Hook Form）。大部分中后台表单用 React Hook Form + Zod 就够了。

**Q：表单校验放前端还是后端？**

A：都要。前端校验提升用户体验（即时反馈），后端校验保证数据安全（前端可被绕过）。前端用 Zod/Yup 定义 Schema，后端用同一套 Schema（或 class-validator）做二次校验。

**Q：antd Form 和 React Hook Form 的区别？**

A：antd Form 是受控模式（Form.Item 内部管理 state），和 antd 组件深度集成（一行代码接入 Select/DatePicker）。React Hook Form 是非受控（性能更好），但接入 antd 组件需要 Controller 包装。用 antd 全家桶就用 antd Form，否则用 React Hook Form。

**Q：动态表单（字段数量不固定）怎么处理？**

A：React Hook Form 的 `useFieldArray`。底层维护一个数组，每项有唯一 id，支持 append/remove/move。比自己管 `items: state[]` + map 渲染要健壮得多（处理了 key 稳定性和性能）。
