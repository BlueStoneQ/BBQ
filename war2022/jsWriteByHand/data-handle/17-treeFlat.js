/**
 * 【题目 3.4】树转扁平对象数组（treeFlat）
 * 要求：将树形结构遍历展开为扁平列表（3.3 的逆操作）。
 */

/**
 * 将tree型结构flat成扁平的结构
 * 2022-7-2
 * 
 * Tree的扁平化
 * me：一个多叉树的遍历，然后再访问者中加入扁平化数据的操作
 * 
 * 参考：https://juejin.cn/post/6987224048564437029
 */

// 递归版
const flatTree = (tree) => {
    const flatArr = []

    for (const node of tree) {
        const { children = [], ...restNode } = node
        flatArr.push(restNode)

        if (children.length === 0) continue

        flatArr.push(...flatTree(children))
    }

    return flatArr
}

// 迭代版：调用栈不存在爆栈的风险，其实就是类似树的BFS，不过BFS用的queue + shift，这里本质是DFS：stack + pop
const flatTreeIter = (tree) => {
    const flatArr = []
    // BFS的核心数据结构：stack
    const stack = [ ...tree ]

    while(stack.length > 0) {
        const curNode = stack.pop() // pop性能比shift好，不牵涉移动后面节点， shift 就变成BFS了
        const { children = [], ...restNode } = curNode

        flatArr.push(restNode)

        for (const subNode of children) {
            stack.push(subNode)
        }
    }

    return flatArr
}


/** 下面的没有迭代，以上面的为准 **************************************************************************************** */

/**
 * 方法1: 迭代法
 * @param {*} tree 
 * @returns 
 */
const flatTree1 = (tree) => {
  let result = [];

  for (const item of tree) {
    if (item.children && item.children.length) {
      result = result.concat(flatTree1(item.children));
    }

    delete item.children

    result.push(item);
  }

  return result;
}

/**
 * 利用reduce实现
 */
const flatTree2 = (tree) => {
  return tree.reduce((lastRes, item) => {
    // otherItem 除去children的其他属性
    const { children = [], ...otherItem } = item
    return lastRes.concat(otherItem, (children && children.length) ? flatTree2(children) : [])
  }, [])
}

// test
let tree = [
  {
      "id": 1,
      "name": "1",
      "pid": 0,
      "children": [
          {
              "id": 2,
              "name": "2",
              "pid": 1,
              "children": []
          },
          {
              "id": 3,
              "name": "3",
              "pid": 1,
              "children": [
                 {
                   "id": 4,
                   "name": "4",
                   "pid": 3,
                   "children": []
                 }
              ]
          }
      ]
  }
]

// 以下2个测试不要连续进行，因为第一个会在原来位置更改tree， 导致第二次输入变形
// console.log('tree2FlatObj1: \n', flatTree1(tree))
console.log('tree2FlatObj2: \n', flatTree2(tree))

/**
 *  expect: 
[
  { id: 1, name: '1', pid: 0 },
  { id: 2, name: '2', pid: 1 },
  { id: 3, name: '3', pid: 1 },
  { id: 4, name: '4', pid: 3 }
] 
 */