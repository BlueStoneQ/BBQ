// test 实现一个函数，将拍平的数组转换为树形结构
const array2Tree = (arr) => {
  // defend
  let result = {};
  const map = new Map();

  for (const item of arr) {
    const { id } = item;
    map.set(id, {});
  }

  for (const {id, parent} of arr) {
    if (parent === null) {
      result = { id, children: [] };
    }

    if (map.has(parent)) {
      if (!map.get(parent).children) {
        map.get(parent).children = [];
      }
      map.get(parent).children.push({id});
    }
  }

  // console.dir(map.toString());

  for (const [id, item] of map) {
    result.children.push(item);
  }

  return result;
}

// 输入：
const nodes = [
  { id: 1, parent: null },
  { id: 2, parent: 1 },
  { id: 3, parent: 1 },
  { id: 4, parent: 2 },
  { id: 5, parent: 2 },
];
// 输出：
const tree = {
  id: 1,
  children: [
    {
      id: 2,
      children: [
        {
          id: 4,
        },
        {
          id: 5,
        },
      ],
    },
    {
      id: 3,
    },
  ],
};

console.log(JSON.stringify(array2Tree(nodes), 2));