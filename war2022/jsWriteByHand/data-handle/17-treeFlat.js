/**
 * 将tree型结构flat成扁平的结构
 * 2022-7-2
 * 
 * me：一个多叉树的遍历，然后再访问者中加入扁平化数据的操作
 * 
 * ❌ - 未完成
 */

const tree2FlatObj = (tree) => {
  // base case
  if (tree.length === 0) {
    return tree;
  }


  let result = [];

  for (const item of tree) {
    if (item.children) {
      result = result.concat(tree2FlatObj(item.children));
    }

    result.push(item);
  }

  return result;
}


// test
const input = [{
  id: 1,
  name: 'body',
  children: [{
    id: 2,
    name: 'title',
    children: [{
      id: 3,
      name: 'div'
    }]
  }]
}]


// 期望的结果
const expectRes = [{
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

console.dir(JSON.stringify(tree2FlatObj(input), 2));