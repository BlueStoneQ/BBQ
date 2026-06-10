# 错题集

> 记录核心实现错误（忽略拼写），关注思路和关键逻辑。

## 目录

- [2.2 函数组合（compose）](#22-函数组合compose)
- [2.4 AOP 面向切面编程](#24-aop-面向切面编程)
- [2.6 记忆函数（memoize）](#26-记忆函数memoize)
- [3.9 大数相加（bigNumSum）](#39-大数相加bignumsum)

---

<!-- 
格式：贴原版代码 + 注释标注错误 + 正确写法
只记录核心实现问题，不记录变量名拼写等低级错误
-->


---

## 2.2 函数组合（compose）

```javascript
// 我的实现：
const combineFn = (...args) => {
  return [...args].reverse().reduce((fn, preRes) => {
    return fn(preRes)  // ❌ 这里立即执行了，没有等待输入值 x
  })
}

// 问题：compose 应该返回一个"接收初始值的函数"，不是立即执行
// 正确：
const compose = (...fns) => {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x);
  //     ↑ 返回函数接收 x        ↑acc是上一个函数的输出  ↑x是初始值
};
```

- **核心错误**：compose 是高阶函数，必须返回一个函数来接收初始参数。你直接在 reduce 里执行了。
- **reduce 参数**：`(累积值, 当前项)` — 累积值是上一个函数的输出，当前项是下一个要执行的函数。
- **第二版错误**：reduce 遍历的对象搞反了——应该遍历函数列表（fnArgs），初始值是输入参数（args[0]）。

```javascript
// 第二版我的实现（标注错误）：
const combineFn = (...fnArgs) => {
  return (...args) => {
    return [...args].reverse().reduce((fn, preRes) => {
      //    ↑ ❌ 遍历的是 args（输入参数），应该遍历 fnArgs（函数列表）
      //         ↑ ❌ 回调参数含义搞反了：第一个是累积值（上一个输出），第二个是当前函数
      return fn(preRes)
    })
  }
}

// 正确写法：
const compose = (...fnArgs) => {
  return (...args) => {
    return fnArgs.reduceRight((acc, fn) => fn(acc), args[0]);
    //     ↑ 遍历函数列表    ↑累积值(上一个输出) ↑当前函数  ↑初始值
  };
};
```


---

## 2.4 AOP 面向切面编程

```javascript
// 我的实现：
Function.prototype.before = function (fn) {
  const originalFn = this
  fn && fn.apply(this)   // ❌ 立即执行了，应该返回新函数
  originalFn()           // ❌ 立即执行了
}
// 问题：调用 .before(fn) 时就执行了，没有返回新函数

// 正确：返回新函数（高阶函数/装饰器模式）
Function.prototype.before = function (beforeFn) {
  const originalFn = this;
  return function (...args) {       // ← 返回新函数
    beforeFn.apply(this, args);     // 先执行前置
    return originalFn.apply(this, args); // 再执行原函数
  };
};
```

- **核心错误**：AOP 是装饰器——包装后返回新函数，不是立即执行。
- **记忆**：所有"增强函数"的手写题（curry/compose/partial/AOP/memoize）都是高阶函数，都要 return function。


---

## 2.6 记忆函数（memoize）

```javascript
// 我的实现：
const mem = (fn) => {
  const map = new Map()
  return function(...args) {
    const key = [args].join('-')
    if (map.has(key)) {
      return map.get(key)
    }
    return fn.apply(this, ...args);  // ❌ 计算了但没存入缓存
    //                    ↑ ❌ apply 第二个参数是数组，不需要展开
  }
}

// 正确：计算后要存缓存
const mem = (fn) => {
  const map = new Map()
  return function(...args) {
    const key = args.join('-')       // args 本身就是数组，不需要 [args]
    if (map.has(key)) return map.get(key)
    const result = fn.apply(this, args)  // apply 第二个参数直接传数组
    map.set(key, result)             // ← 关键：存入缓存
    return result
  }
}
```

- **核心错误**：计算了结果但忘了 `map.set(key, result)` 存入缓存。


---

## 3.4 树转扁平对象（treeFlat）

```javascript
// 我的实现：
const obj2flat = (tree) => {
  const res = []
  for (const node of tree) {
    res.push(node)              // ❌ 没去掉 children 字段
    if (node.children) {
      for (const subNode of node.children) {
        res.push(obj2flat(subNode))  // ❌ 1. 传单个节点，函数期望数组
                                     // ❌ 2. push 数组会嵌套，应该展开
      }
    }
  }
  return res
}

// 正确：
const obj2flat = (tree) => {
  const res = []
  for (const node of tree) {
    const { children, ...rest } = node  // ← 解构去掉 children
    res.push(rest)
    if (children) {
      res.push(...obj2flat(children))   // ← 传数组 + 展开合并
    }
  }
  return res
}
```

- **核心错误**：
  1. 递归参数：函数接收数组，应传 `node.children`（数组），不是 `subNode`（单个节点）
  2. 结果合并：`push(数组)` 会嵌套，用 `push(...数组)` 展开
  3. 去掉 children：解构 `{ children, ...rest }` 分离


---

## 3.9 大数相加（bigNumSum）

```javascript
// 我的实现：
const bigNumSum = (num1, num2) => {
  const _num1List = (num1 > num2 ? num1 : num2).split('').reverse()
  //                 ↑ ❌ 字符串比较是字典序！'9' > '13132132132199' = true
  const _num2List = (num1 > num2 ? num2 : num1).split('').reverse()

  for (let i = 0; i < _num1List.length; i++) {
    const _num2 = +_num2List[i] || 0
    if (!_num2) {        // ❌ 当 _num2 = 0 时跳过了，但 0 + 进位 ≠ 0
      sumRes[i] = _num1
      continue           // ← 跳过了 preSum 的累加
    }
    // ...
  }
}
```

**错误点**：

1. **字符串字典序比较** — `num1 > num2` 比的是字典序不是数值大小。`'9' > '13...'` = true（字符 '9' > '1'）→ 短的被当成长的。
   - 修正：不需要排序谁长谁短，用 `Math.max(len1, len2)` 或双下标。

2. **`!_num2` 跳过 0 值** — 某位是 `0` 时，`!0` = true → 跳过了加法。但 `0 + 进位` 可能 = 1。
   - 修正：去掉 `if (!_num2) continue`，统一走加法逻辑。

**推荐写法（双下标，不 reverse）**：

```javascript
const bigNumSum = (num1, num2) => {
  let i = num1.length - 1
  let j = num2.length - 1
  let carry = 0
  let result = ''

  while (i >= 0 || j >= 0 || carry) {
    const n1 = i >= 0 ? +num1[i--] : 0
    const n2 = j >= 0 ? +num2[j--] : 0
    const sum = n1 + n2 + carry
    result = (sum % 10) + result
    carry = Math.floor(sum / 10)
  }

  return result
}
```

- 从末尾往前走，不需要 split/reverse
- while 条件包含 `carry` → 自动处理最高位进位
- 不需要判断谁长谁短
