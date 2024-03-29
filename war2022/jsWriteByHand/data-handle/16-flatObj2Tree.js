/**
 * 扁平的js对象转化为树
 * 2022-6-16
 * https://juejin.cn/post/6946136940164939813#heading-47
 * https://febook.hzfe.org/awesome-interview/book3/coding-arr-to-tree
 * 其实就是根据pid 来生成树型结构
 * TODO: 1. 其实 应该要考这种的互相转换
 * 2. 关键字：构建中间数据结构:id2ObjMap
 */

/**
 * 方法1：迭代法
 * 核心：使用map + data遍历2次
 * @param {*} data
 * @returns 
 */
const flatObj2Tree = (data) => {
  const result = [];

  const id2Objmap = new Map();

  // 需要建立一张： id->item的查表
  for (const item of data) {
    const { id } = item;
    id2Objmap.set(id, item);
  }

  for (const item of data) {
    const { pid } = item;

    // 删除掉pid属性
    delete item.pid;

    // 父节点为根节点, 这里根据题目要求为pid === null
    if (pid === null) {
      result.push(item);
    }

    // 父节点为非根节点
    if (id2Objmap.has(pid)) {
      const parentItem = id2Objmap.get(pid);

      parentItem.children = [].concat(parentItem.children || [], item);
    }
  }

  return result;
}

/**
 * 方法1-pro[最优]：迭代法 - 将方法1中的2次迭代合并为一次
 * 边迭代 边构建
 * 剑指前端：https://febook.hzfe.org/awesome-interview/book3/coding-arr-to-tree#%E5%8F%98%E4%BD%93%E4%B8%80
 * 
 * 思路骨架：
- map<id, node>
- while
    - root节点处理
        - pid === null
        - del pid
        - res.push(rootNode)
    - 其他节点处理
        - map.has(pid)
            - yes: 
                - parant = map.get(pid)
                - parant.child.push(curNode)
            - no: 
                - parent = { children: [] }
                - map.set(pid, parent)
                - parent.children.push(curNode)
                - curNode: del pid
 */
const flatObj2Tree1 = (data) => {
  // defend
  const result = [];
  // 可查表
  const id2Objmap = new Map();

  for (let item of data) {
    // 查下当前item的父元素在不在查表中
    const { pid, id } = item;

    // 1. 构建核心数据结构：id2ObjMap
    // 处理id
    if (!id2Objmap.has(id)) {
      // 有效的id 但是map中没有的 我们要在map中建立该id为key的值
      id2Objmap.set(id, item);
    } else {
      // 如果当前id之前已经有值了 可以合并当前值 - 为的是一些在下面初始化为{ children: [] } 的pid-item,遇到了它们本来的值
      id2Objmap.set(id, { ...item, ...id2Objmap.get(id) }); // ...id2Objmap.get(id) 是后面 id2Objmap.set(pid, {}) 所提前构建的
    }

    // 处理pid
    // 2. 寻找父节点插入
    // 2-1. 父节点为根节点
    if (pid === null) {
      // 如果当前节点是在root下 题目中为pid === null, 则将该节点放在root节点下
      delete item.pid; // 剔除pid属性
      result.push(item);
      continue;
    }

    // 2-2. 父节点为非根节点 1. 通过map找到 或者 在map中构造父节点 2. 剔除要加入的item.pid 3. 加入item
    // 1. 如果父节点不存在 则初始化父节点
    if (!id2Objmap.has(pid)) {
      id2Objmap.set(pid, {});
    }
    // 2. 如果父节点没有children节点 则初始化children节点
    const parentItem = id2Objmap.get(pid);
    if (!parentItem.children) {
      parentItem.children = [];
    }

    delete item.pid; // 剔除pid属性

    // 3. 将当前item放置到对应的父节点下
    parentItem.children.push(item);
  }

  return result;
}

/**
 * 方法3：只依靠递归 不使用map 
 * 时间复杂度：O(2^n)， 时间复杂度过高 不建议使用
 *  因为每一个元素的状态无外乎取与不取，一共2种状态 就是2的来历
 *  - 可以参考回溯算法的复杂度分析：https://zhuanlan.zhihu.com/p/448969860
 *  复杂度分析：https://github.com/youngyangyang04/leetcode-master/blob/master/problems/%E5%89%8D%E5%BA%8F/%E9%80%92%E5%BD%92%E7%AE%97%E6%B3%95%E7%9A%84%E6%97%B6%E9%97%B4%E4%B8%8E%E7%A9%BA%E9%97%B4%E5%A4%8D%E6%9D%82%E5%BA%A6%E5%88%86%E6%9E%90.md
 * ·递归时间复杂度分析：递归的次数n * 每次递归中的操作次数n
 *  每次递归实际上 就是解决一个item，那么一共有n次递归，则节点有2^n + 1个节点，则复杂度为2^n
 * 空间复杂度：O(1)
 * 思路也比较简单，实现一个方法，该方法传入tree父节点和父id，循环遍历数组，无脑查询，找到对应的子节点，push到父节点中，再递归查找子节点的子节点。
 * https://juejin.cn/post/6987224048564437029
 * https://febook.hzfe.org/awesome-interview/book3/coding-arr-to-tree#%E8%A7%A3%E6%B3%95%E4%B8%80
 */
const flatObj2Tree2 = (items) => {
  const res = []

  const getChildren = (parentChildren, parentId) => {
    for (const item of items) {
      if (parentId === item.pid) {
        const newItem = {
          children: [],
          ...item
        }
        parentChildren.push(newItem)
        getChildren(newItem.children, newItem.id)
        
        if (newItem.children.length <= 0) delete newItem.children
      }
    }
  }

  getChildren(res, null)

  return res
}


// test

// 转换前：
const source = [
  { pid: null, id: 1, data: "1" },
  { pid: 1, id: 2, data: "2-1" },
  { pid: 1, id: 3, data: "2-2" },
  { pid: 2, id: 4, data: "3-1" },
  { pid: 3, id: 5, data: "3-2" },
  { pid: 4, id: 6, data: "4-1" },
];

// console.dir(JSON.stringify(flatObj2Tree(source), 2));
console.dir(JSON.stringify(flatObj2Tree1(source), 2));
// console.dir(JSON.stringify(flatObj2Tree2(source), 2));

// expect 转换为: 
// const tree = {
//   id: 1,
//   pid: 0,
//   data: 'a',
//   children: [
//     {id: 2, pid: 1, data: 'b'},
//     {id: 3, pid: 1, data: 'c'},
//   ]
// }
