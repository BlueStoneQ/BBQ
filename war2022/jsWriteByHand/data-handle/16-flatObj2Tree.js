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

    if (id2Objmap.has(pid)) {
      const parentItem = id2Objmap.get(pid);

      parentItem.children = [].concat(parentItem.children || [], item);

      continue;
    }

    result.push(item);
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

console.dir(JSON.stringify(flatObj2Tree(source), 2));

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
