/**
 * 扁平的js对象转化为树
 * 2022-6-16
 * https://juejin.cn/post/6946136940164939813#heading-47
 * 其实就是根据pid 来生成树型结构
 * TODO: 1. 其实 应该要考这种的互相转换
 */

/**
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

// test

// 转换前：
const source = [{
  id: 1,
  pid: 0,
  name: 'body'
}, {
  id: 2,
  pid: 1,
  name: 'title'
}, {
  id: 3,
  pid: 2,
  name: 'div'
}]

console.dir(JSON.stringify(flatObj2Tree(source), 2));

// expect 转换为: 
// const tree = [{
// id: 1,
// name: 'body',
// children: [{
//   id: 2,
//   name: 'title',
//   children: [{
//     id: 3,
//     name: 'div'
//   }]
// }
// }]
