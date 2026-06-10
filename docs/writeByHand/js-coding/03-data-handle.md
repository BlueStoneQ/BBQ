## 三、数据处理



## 目录

- [3.1 数组扁平化（flat）](#31-数组扁平化flat)
- [3.2 数组去重（unique）](#32-数组去重unique)
- [3.3 扁平对象转树（flatObj2Tree）](#33-扁平对象转树flatobj2tree)
- [3.4 树转扁平对象（treeFlat）](#34-树转扁平对象treeflat)
- [3.5 lodash.get 实现](#35-lodash.get-实现)
- [3.6 数组 API 实现](#36-数组-api-实现)
- [3.7 日期格式化](#37-日期格式化)
- [3.8 数字千分位分隔](#38-数字千分位分隔)
- [3.9 大数相加](#39-大数相加)
- [3.10 URL 参数解析](#310-url-参数解析)
- [3.11 数字转汉字](#311-数字转汉字)
- [3.12 循环有序数组查找](#312-循环有序数组查找)

---

### 3.1 数组扁平化（flat）

⭐⭐⭐
**考点**：递归、数组方法

#### 2.1.1 递归实现

```javascript
const flat1 = (arr) => {
  let result = [];

  for (const item of arr) {
    result = result.concat(
      Array.isArray(item) ? flat1(item) : item
    );
  }

  return result;
}
```

#### 2.1.2 reduce 实现

```javascript
const flat2 = (arr) => {
  return arr.reduce((pre, cur) => {
    return Array.isArray(cur) 
      ? pre.concat(flat2(cur)) 
      : pre.concat(cur);
  }, []);
}
```

#### 2.1.3 toString 实现

```javascript
const flat3 = (arr) => {
  return arr.toString().split(',').map(item => +item);
}
```

**总结**：
- **核心思路**：递归处理嵌套数组，将所有元素展开到一维数组
- **关键点**：
  1. 递归处理嵌套数组
  2. reduce 方法更简洁
  3. toString 方法有局限性（只适用于数字数组）

---

### 3.2 数组去重（unique）

⭐⭐⭐
**考点**：Set、Map、对象

#### 2.2.1 Set 实现

```javascript
const uniqueArray1 = (arr) => {
  return Array.from(new Set(arr));
}
```

#### 2.2.2 Map 实现

```javascript
const uniqueArray2 = (arr) => {
  const map = new Map();
  const res = [];

  for (const item of arr) {
    if (map.has(item)) continue;
    res.push(item);
    map.set(item, true);
  }

  return res;
}
```

**总结**：
- **核心思路**：使用 Set 或 Map 记录已出现的元素
- **关键点**：
  1. Set 是最简洁的方式
  2. Map 可以处理更复杂的去重逻辑
  3. 注意对象和 NaN 的去重处理

---

### 3.3 扁平对象转树（flatObj2Tree）

⭐⭐⭐
**考点**：数据结构转换、Map

**实现思路**：
1. 构建 id -> item 的映射表
2. 遍历数组，根据 pid 找到父节点
3. 将当前节点添加到父节点的 children 中

**方法一：两次遍历（清晰易懂）**

```javascript
const flat2Tree = (list) => {
  const res = []
  // 核心数据结构：Map 建立 id → node 的索引
  const id2NodeMap = new Map()

  // 第一次遍历：建索引
  for (const node of list) {
    id2NodeMap.set(node.id, node)
  }

  // 第二次遍历：根据 pid 挂载到父节点
  id2NodeMap.forEach((node) => {
    if (node.pid === 0) {
      // 根节点直接放入结果
      res.push(node)
      return
    }
    // 非根节点：找到父节点，挂到 children
    const parentNode = id2NodeMap.get(node.pid)
    if (!parentNode.children) parentNode.children = []
    parentNode.children.push(node)
  })

  return res
}
```

**方法二：一次遍历（处理子节点先于父节点出现的情况）**

```javascript
const flatObj2Tree = (data) => {
  const result = [];
  const id2Objmap = new Map();

  // 构建映射表
  for (const item of data) {
    const { id, pid } = item;

    // 处理当前节点
    if (!id2Objmap.has(id)) {
      id2Objmap.set(id, item);
    } else {
      // 
      id2Objmap.set(id, { ...item, ...id2Objmap.get(id) });
    }

    // 处理根节点
    if (pid === null) {
      delete item.pid;
      result.push(item);
      continue;
    }

    // 处理非根节点: 建立pid的占位node({}), 等到后面遍历到pid对应的node的时候, 在前面会有合并
    if (!id2Objmap.has(pid)) {
      id2Objmap.set(pid, {});
    }

    const parentItem = id2Objmap.get(pid);
    if (!parentItem.children) {
      parentItem.children = [];
    }

    delete item.pid;
    parentItem.children.push(item);
  }

  return result;
}
```

**总结**：
- **核心思路**：使用 Map 构建 id 到节点的映射(核心构建id2NodeMap)，一次遍历()完成转换
- **关键点**：
  1. 使用 Map 构建 id -> item 的映射表
  2. 根据 pid 找到父节点，添加到父节点的 children 中
  3. 处理根节点（pid 为 null）和非根节点

---

### 3.4 树转扁平对象（treeFlat）

⭐⭐⭐
**考点**：树结构的扁平化

**实现思路**：递归遍历树，删除 children 属性

**方法一：递归实现**：
// 核心就是对于children部分需要递归 + 结果需要展开返回给上层, 自底向上展开

```javascript
const flatTree = (tree) => {
  let result = [];

  for (const item of tree) {
    if (item.children && item.children.length) {
      result = result.concat(flatTree(item.children));
    }

    delete item.children;
    result.push(item);
  }

  return result;
}
```

**方法二：reduce 实现**：

```javascript
const flatTree = (tree) => {
  return tree.reduce((lastRes, item) => {
    const { children = [], ...otherItem } = item;
    return lastRes.concat(
      otherItem,
      children && children.length ? flatTree(children) : []
    );
  }, []);
}
```

**测试**：
```javascript
const tree = [
  {
    id: 1,
    name: '1',
    pid: 0,
    children: [
      { id: 2, name: '2', pid: 1, children: [] },
      {
        id: 3,
        name: '3',
        pid: 1,
        children: [
          { id: 4, name: '4', pid: 3, children: [] }
        ]
      }
    ]
  }
];

flatTree(tree);
// [
//   { id: 1, name: '1', pid: 0 },
//   { id: 2, name: '2', pid: 1 },
//   { id: 3, name: '3', pid: 1 },
//   { id: 4, name: '4', pid: 3 }
// ]
```

---

### 3.5 lodash.get 实现

⭐⭐
**考点**：字符串处理、递归

**作用**：根据路径获取对象属性值

```javascript
const myGet = (source, path, defaultValue = undefined) => {
  // 格式化 path: a[3].b -> a.3.b -> [a,3,b]
  const keyList = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let res = source;

  for (const key of keyList) {
    res = res && res[key];

    if (!res) {
      return defaultValue;
    }
  }

  return res;
}
```

**使用示例**：
```javascript
const source = {
  a: [0, 1, 2, { b: 5 }]
};

myGet(source, 'a[3].b'); // 5
myGet(source, 'a[5].b'); // undefined
```

**关键点**：
- 使用正则处理数组索引
- 递归访问嵌套属性
- 支持默认值

---

### 3.6 数组 API 实现

⭐⭐⭐
**考点**：数组常用方法的实现

#### 3.6.1 Array.prototype.map

```javascript
Array.prototype.myMap = function(callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }

  const result = [];
  const arr = this;

  for (let i = 0; i < arr.length; i++) {
    result.push(callback.call(thisArg, arr[i], i, arr));
  }

  return result;
};
```

#### 3.6.2 Array.prototype.filter

```javascript
Array.prototype.myFilter = function(callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }

  const result = [];
  const arr = this;

  for (let i = 0; i < arr.length; i++) {
    if (callback.call(thisArg, arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }

  return result;
};
```

#### 3.6.3 Array.prototype.reduce

```javascript
Array.prototype.myReduce = function(callback, initialValue) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }

  const arr = this;
  let accumulator = initialValue !== undefined ? initialValue : arr[0];
  const startIndex = initialValue !== undefined ? 0 : 1;

  for (let i = startIndex; i < arr.length; i++) {
    accumulator = callback(accumulator, arr[i], i, arr);
  }

  return accumulator;
};
```

#### 3.6.4 Array.prototype.push

```javascript
Array.prototype.myPush = function(...items) {
  const arr = this;
  const len = arr.length;

  for (let i = 0; i < items.length; i++) {
    arr[len + i] = items[i];
  }

  return arr.length;
};
```

---

### 3.7 日期格式化

⭐⭐
**考点**：日期处理

```javascript
function dateFormat(date, format = 'yyyy/MM/dd') {
  if (!date) return '';
  if (Object.prototype.toString.call(date) !== '[object Date]') return '';

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return format
    .replace(/yyyy/, year)
    .replace(/MM/, month < 10 ? '0' + month : month)
    .replace(/dd/, day < 10 ? '0' + day : day);
}
```

**使用示例**：
```javascript
dateFormat(new Date('2020-12-01'), 'yyyy/MM/dd'); // 2020/12/01
dateFormat(new Date('2020-04-01'), 'yyyy年MM月dd日'); // 2020年04月01日
```

---

### 3.8 数字千分位分隔

⭐⭐
**考点**：正则表达式、字符串处理

**实现**：

```javascript
function splitWithDot(num) {
  const numStr = num.toString();

  // 有小数点
  if (/\./.test(numStr)) {
    return numStr.replace(/(?!^)(?=(\d{3})+\.)/g, ',');
  }

  // 无小数点
  return numStr.replace(/(?!^)(?=(\d{3})+$)/g, ',');
}
```

**使用示例**：
```javascript
splitWithDot(12345678.12345); // 12,345,678.12345
splitWithDot(12345678); // 12,345,678
```

**关键点**：
- 使用正则的正向前瞻 `(?=pattern)`
- 区分整数和小数的处理

**正则拆解** — `/(?!^)(?=(\d{3})+$)/g`：

| 部分 | 含义 |
|------|------|
| `(?!^)` | 负向前瞻：不在字符串开头（避免 `123` → `,123`） |
| `(?=...)` | 正向前瞻（零宽断言）：只判断位置，不消费字符。匹配的是"位置"不是"字符" |
| `(\d{3})+` | 3 个数字为一组，重复 1 次或多次（3/6/9/...位） |
| `$` 或 `\.` | 锚点：无小数用 `$`（末尾），有小数用 `\.`（小数点）— 保证从右往左数 |
| `g` | 全局匹配所有满足条件的位置 |

**为什么能"插入"逗号**：`(?=...)` 是零宽断言，匹配的是两个字符之间的位置（宽度=0），replace 在这个位置插入 `,` 不会替换任何字符。

**示例推演**（`12345678`）：
```
位置0: ^开头 → (?!^) 排除 → ❌
位置2: 往后看 345678（6位 = 3×2）+ $ → ✅ 插逗号
位置5: 往后看 678（3位 = 3×1）+ $ → ✅ 插逗号
→ 结果: 12,345,678
```

---

### 3.9 大数相加

⭐⭐⭐
**考点**：大数运算、字符串处理

**实现**：

```javascript
function bigNumSum(num1, num2) {
  let i = num1.length - 1
  let j = num2.length - 1
  let carry = 0
  const result = []

  while (i >= 0 || j >= 0) {
    const n1 = i >= 0 ? +num1[i] : 0
    const n2 = j >= 0 ? +num2[j] : 0
    const sum = n1 + n2 + carry

    carry = sum > 9 ? 1 : 0
    result.push(sum % 10)

    i--
    j--
  }

  if (carry) result.push(carry)

  return result.reverse().join('')
}
```

**使用示例**：
```javascript
bigNumSum('13132132132199', '9'); // '13132132132208'
```

**关键点**：
- 使用字符串避免精度丢失
- 从个位开始逐位相加
- 处理进位

---

### 3.10 URL 参数解析

⭐⭐⭐
**考点**：字符串处理、URL 解析

**实现**：

```javascript
function parseParam(url) {
  const resObj = {};
  const query = url.split('?')[1];

  if (!query) return resObj;

  const queryList = query.split('&');

  for (let item of queryList) {
    const [key, val] = item.split('=');
    let value = val ? decodeURIComponent(val) : true;

    // 转换数字类型
    if (/^\d+$/.test(value)) {
      value = +value;
    }

    // 处理重复的 key
    if (resObj.hasOwnProperty(key)) {
      resObj[key] = [].concat(resObj[key], value);
    } else {
      resObj[key] = value;
    }
  }

  return resObj;
}
```

**使用示例**：
```javascript
const url = 'http://www.domain.com/?user=anonymous&id=123&id=456&city=%E5%8C%97%E4%BA%AC&enabled';
parseParam(url);
// {
//   user: 'anonymous',
//   id: [123, 456],
//   city: '北京',
//   enabled: true
// }
```

**关键点**：
- 使用 decodeURIComponent 解码
- 处理重复参数
- 类型转换

---

### 3.11 数字转汉字

⭐⭐
**考点**：数字转换、算法

**实现**：

```javascript
function num2hanzi(num) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千', '万', '十万', '百万', '千万', '亿'];

  if (num === 0) return digits[0];

  let result = '';
  let unitIndex = 0;

  while (num > 0) {
    const digit = num % 10;

    if (digit !== 0) {
      result = digits[digit] + units[unitIndex] + result;
    } else if (result && result[0] !== '零') {
      result = digits[0] + result;
    }

    num = Math.floor(num / 10);
    unitIndex++;
  }

  return result;
}
```

---

### 3.12 循环有序数组查找

⭐⭐⭐
**考点**：二分查找、旋转数组

**题目**：在一个循环有序的列表中查找指定的值。比如 `[6,7,8,1,2,3,4,5]` 就是一个循环有序数组。

#### 3.12.1 暴力解法

```javascript
function searchInRotatedArray(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) {
      return i;
    }
  }
  return -1;
}
```

**时间复杂度**：O(n)

#### 3.12.2 二分查找优化

```javascript
function searchInRotatedArray(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    }

    // 判断哪一半是有序的
    if (arr[left] <= arr[mid]) {
      // 左半部分有序
      if (target >= arr[left] && target < arr[mid]) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    } else {
      // 右半部分有序
      if (target > arr[mid] && target <= arr[right]) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  return -1;
}
```

**使用示例**：
```javascript
const arr = [6, 7, 8, 1, 2, 3, 4, 5];
searchInRotatedArray(arr, 3); // 5
searchInRotatedArray(arr, 8); // 2
searchInRotatedArray(arr, 10); // -1
```

**时间复杂度**：O(log n)

**关键点**：
- 旋转数组至少有一半是有序的
- 判断 target 在有序的那一半还是无序的那一半
- 根据判断结果调整搜索范围

---

