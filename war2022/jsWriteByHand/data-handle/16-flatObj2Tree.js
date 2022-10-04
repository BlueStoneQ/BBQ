/**
 * 扁平的js对象转化为树
 * 2022-6-16
 * https://juejin.cn/post/6946136940164939813#heading-47
 * https://febook.hzfe.org/awesome-interview/book3/coding-arr-to-tree
 * 其实就是根据pid 来生成树型结构
 * TODO: 1. 其实 应该要考这种的互相转换
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
 * 方法1-pro：迭代法 - 将方法1中的2次迭代合并为一次
 * 边迭代 边构建
 * 剑指前端：https://febook.hzfe.org/awesome-interview/book3/coding-arr-to-tree#%E5%8F%98%E4%BD%93%E4%B8%80
 */
const flatObj2Tree1 = (data) => {
  // defend
  const result = [];
  // 可查表
  const id2Objmap = new Map();

  for (let item of data) {
    // 查下当前item的父元素在不在查表中
    const { pid, id } = item;

    if (!id2Objmap.has(id)) {
      // 有效的id 但是map中没有的 我们要在map中建立该id为key的值
      id2Objmap.set(id, item);
    } else {
      // 如果当前id之前已经有值了 可以合并当前值 - 为的是一些在后面初始化为{ children: [] } 的pid-item,遇到了它们本来的值
      id2Objmap.set(id, { ...item, ...id2Objmap.get(id) });
    }

    // 父节点为根节点
    if (pid === null) {
      // 如果当前节点是在root下 题目中为pid === null, 则将该节点放在root节点下
      delete result.pid; // 剔除pid属性

      result.push(item);
      continue;
    }

    // 父节点为非根节点
    // 1. 如果父节点不存在 则初始化父节点
    if (!id2Objmap.has(pid)) {
      id2Objmap.set(pid, {});
    }
    // 2. 如果父节点没有children节点 则初始化children节点
    const parentItem = id2Objmap.get(pid);
    if (!parentItem.children) {
      parentItem.children = [];
    }

    // 3. 将当前item放置到对应的父节点下
    parentItem.children.push(item);
  }

  return result;
}



/**
 * 方法2： 递归法？？ 
 * https://febook.hzfe.org/awesome-interview/book3/coding-arr-to-tree#%E8%A7%A3%E6%B3%95%E4%B8%80
 */


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
